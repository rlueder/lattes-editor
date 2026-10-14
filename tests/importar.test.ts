import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONSENT_KEY, consentRecord } from '../extension/src/consent.ts';
import { importRunning, runImport } from '../extension/src/import-run.ts';
import { sendImport } from '../extension/src/lattes-tab.ts';
import { fromBase64 } from '../src/bridge/export.ts';
import {
  IMPORT_ENABLED,
  importBusy,
  importItems,
  type ImportPort,
  type ImportRequest,
  importStopMessage,
  pageShape,
  pickYear,
  readStep2,
  requestProblem,
  step1ScreenState,
  STEP2_MODULE_VALUES,
} from '../src/bridge/importar.ts';
import { buildMinimalImportFile, itemYear } from '../src/import-export/import-file.ts';
import {
  canImportByConnector,
  IMPORT_REPLY_TIMEOUT_MS,
  importMessage,
  importStatus,
} from '../src/import-export/import-request.ts';
import { IMPORT_MODULES } from '../src/import-export/importable.ts';
import { loadCv, maxSequenciaProducao } from '../src/model/document.ts';
import { decodeLatin1 } from '../src/model/latin1.ts';
import {
  addProduction,
  authorElementName,
  importableTypes,
  itemPart,
  newItem,
  productionType,
  setAuthors,
} from '../src/model/production.ts';
import { getAttr, parseXml, serializeXml, setAttr, type XElement } from '../src/model/xml.ts';
import { lattesSchema as schema } from '../src/schema/lattes.ts';

const ROOT = join(import.meta.dirname, '..');
const XSD = join(ROOT, 'schema/CurriculoLattes_2022_patched.xsd');
const CODE = 'K1234567A8';

const loadFixture = async (name: string) =>
  loadCv(new Uint8Array(readFileSync(join(ROOT, 'fixtures', name))), name);

/** Preenche o que a validação exige: enums, título e ano, como faria o formulário. */
function fill(el: XElement, year = '2025'): void {
  for (const a of el.attrs) {
    const spec = schema.elements[el.name]?.attributes.find((s) => s.name === a.name);
    if (spec?.enum && !spec.enum.includes(a.value)) a.value = spec.enum[0]!;
    if (/^ANO($|-)/.test(a.name) && !a.value) a.value = year;
    if (a.name.startsWith('TITULO') && !a.name.endsWith('INGLES') && !a.value) a.value = 'Título';
  }
  for (const c of el.children) if (c.kind === 'element') fill(c, year);
}

const ME = { citation: 'TESTE, P. A.', lattesId: '0000000000000001', name: 'Pessoa de Teste Ação' };

function validates(bytes: Uint8Array, name: string): void {
  const dir = mkdtempSync(join(tmpdir(), 'lattes-minimo-'));
  const path = join(dir, name);
  writeFileSync(path, bytes);
  execFileSync('xmllint', ['--noout', '--schema', XSD, path], { stdio: 'pipe' });
}

/** Um currículo com um item novo de Eventos (participação em congresso). */
async function cvWithEvent(year = '2024') {
  const cv = await loadFixture('synthetic_full.xml');
  const loadedMax = maxSequenciaProducao(cv.doc);
  const type = productionType(schema, 'PARTICIPACAO-EM-CONGRESSO')!;
  const item = newItem(schema, type.itemName, loadedMax + 1);
  fill(item, year);
  addProduction(schema, cv.doc, type, item);
  return { cv, loadedMax };
}

describe('arquivo mínimo (opção 1 do guia, 3.3)', () => {
  it('um item novo de cada tipo: só eles, DADOS-GERAIS mínimo e XSD válido', async () => {
    const cv = await loadFixture('synthetic_full.xml');
    const loadedMax = maxSequenciaProducao(cv.doc);
    let next = loadedMax + 1;
    for (const type of importableTypes(schema)) {
      const item = newItem(schema, type.itemName, next++);
      if (authorElementName(schema, type.itemName)) setAuthors(schema, item, [ME]);
      fill(item, next % 2 ? '2019' : '2023');
      addProduction(schema, cv.doc, type, item);
    }
    const before = serializeXml(cv.doc);

    const file = buildMinimalImportFile(
      cv.doc,
      cv.encoding,
      loadedMax,
      new Date(2026, 9, 14, 8, 1, 2),
    );
    expect(serializeXml(cv.doc)).toBe(before);
    expect(file.fileName).toBe('0000000000000001-itens-novos.xml');
    expect(file.newItems).toBe(importableTypes(schema).length);
    expect(file.modules).toHaveLength(17);
    expect(file.oldestYear).toBe(2019);
    validates(file.bytes, file.fileName);

    const minimal = parseXml(decodeLatin1(file.bytes));
    expect(getAttr(minimal.root, 'DATA-ATUALIZACAO')).toBe('14102026');
    expect(getAttr(minimal.root, 'HORA-ATUALIZACAO')).toBe('080102');
    expect(getAttr(minimal.root, 'NUMERO-IDENTIFICADOR')).toBe('0000000000000001');
    const general = minimal.root.children.find(
      (c): c is XElement => c.kind === 'element' && c.name === 'DADOS-GERAIS',
    )!;
    expect(general.attrs.map((a) => a.name).sort()).toEqual([
      'NACIONALIDADE',
      'NOME-COMPLETO',
      'NOME-EM-CITACOES-BIBLIOGRAFICAS',
      'PERMISSAO-DE-DIVULGACAO',
    ]);
    expect(general.children).toEqual([]);
    // Nenhum item já existente vai junto.
    const seqs: number[] = [];
    const visit = (el: XElement) => {
      const seq = getAttr(el, 'SEQUENCIA-PRODUCAO');
      if (seq) seqs.push(Number(seq));
      for (const c of el.children) if (c.kind === 'element') visit(c);
    };
    visit(minimal.root);
    expect(seqs.length).toBe(file.newItems);
    expect(seqs.every((s) => s > loadedMax)).toBe(true);
    const text = decodeLatin1(file.bytes);
    expect(text).not.toMatch(/CPF=|DATA-NASCIMENTO|NOME-DA-MAE|ENDERECO|FORMACAO-ACADEMICA/);
  });

  it('um item só: um módulo, os contêineres dele e nada mais', async () => {
    const { cv, loadedMax } = await cvWithEvent('2024');
    const file = buildMinimalImportFile(cv.doc, cv.encoding, loadedMax);
    expect(file.newItems).toBe(1);
    expect(file.modules.map((m) => m.id)).toEqual(['eventos']);
    expect(file.oldestYear).toBe(2024);
    validates(file.bytes, file.fileName);
    const minimal = parseXml(decodeLatin1(file.bytes));
    const names = minimal.root.children
      .filter((c): c is XElement => c.kind === 'element')
      .map((c) => c.name);
    expect(names).toEqual(['DADOS-GERAIS', 'DADOS-COMPLEMENTARES']);
  });

  it('sem item novo, sem ano ou com ano inválido', async () => {
    const cv = await loadFixture('synthetic_minimal.xml');
    const loadedMax = maxSequenciaProducao(cv.doc);
    const empty = buildMinimalImportFile(cv.doc, cv.encoding, loadedMax);
    expect(empty.newItems).toBe(0);
    expect(empty.modules).toEqual([]);
    expect(empty.oldestYear).toBeUndefined();

    const type = productionType(schema, 'ARTIGO-PUBLICADO')!;
    const item = newItem(schema, type.itemName, loadedMax + 1);
    addProduction(schema, cv.doc, type, item);
    expect(itemYear(item)).toBeUndefined();
    expect(buildMinimalImportFile(cv.doc, cv.encoding, loadedMax).oldestYear).toBeUndefined();
    setAttr(itemPart(item, 'DADOS-BASICOS')!, 'ANO-DO-ARTIGO', '20x5');
    expect(itemYear(item)).toBeUndefined();
    setAttr(itemPart(item, 'DADOS-BASICOS')!, 'ANO-DO-ARTIGO', ' 2021 ');
    expect(itemYear(item)).toBe(2021);
    expect(itemYear(parseXml('<X SEQUENCIA-PRODUCAO="1"/>').root)).toBeUndefined();
  });

  it('documento sem DADOS-GERAIS sai com um vazio', () => {
    const doc = parseXml('<CURRICULO-VITAE><PRODUCAO-TECNICA/></CURRICULO-VITAE>');
    const file = buildMinimalImportFile(doc, 'UTF-8', 0);
    expect(file.fileName).toBe('curriculo-itens-novos.xml');
    expect(new TextDecoder().decode(file.bytes)).toContain('<DADOS-GERAIS/>');
  });
});

describe('pedido do editor (importMessage)', () => {
  it('desligado (padrão), nada sai', async () => {
    expect(IMPORT_ENABLED).toBe(false);
    const { cv, loadedMax } = await cvWithEvent();
    expect(importMessage(cv.doc, cv.encoding, loadedMax, { id: 'a' })).toBeUndefined();
  });

  it('ligado: o arquivo mínimo em base64, a caixa 16 (Eventos) e o ano', async () => {
    const { cv, loadedMax } = await cvWithEvent('2022');
    const msg = importMessage(cv.doc, cv.encoding, loadedMax, { id: 'a', lattesId: '1' }, true)!;
    expect(msg).toMatchObject({
      fileName: '0000000000000001-itens-novos.xml',
      id: 'a',
      lattesId: '1',
      modules: [16],
      oldestYear: 2022,
      type: 'importar',
    });
    expect(decodeLatin1(fromBase64(msg.file))).toContain('PARTICIPACAO-EM-CONGRESSO');
  });

  it('ligado, sem item novo: nada sai', async () => {
    const cv = await loadFixture('synthetic_minimal.xml');
    const max = maxSequenciaProducao(cv.doc);
    expect(importMessage(cv.doc, cv.encoding, max, { id: 'a' }, true)).toBeUndefined();
  });

  it('o botão só aparece ligado, com extensão que importa e leitura do Lattes', () => {
    const lido = { features: ['importar'], state: { kind: 'lido' as const, version: '1' } };
    expect(canImportByConnector(lido)).toBe(false);
    expect(canImportByConnector(lido, true)).toBe(true);
    expect(canImportByConnector({ ...lido, features: ['foto'] }, true)).toBe(false);
    expect(canImportByConnector({ ...lido, features: undefined }, true)).toBe(false);
    expect(
      canImportByConnector({ features: ['importar'], state: { kind: 'sem-extensao' } }, true),
    ).toBe(false);
  });

  it('cada um dos 17 módulos tem a caixa do passo 2 na ordem da tela', () => {
    expect(IMPORT_MODULES.map((m) => STEP2_MODULE_VALUES[m.id])).toEqual(
      Array.from({ length: 17 }, (_, i) => i + 1),
    );
  });
});

// Um Lattes falso, com as telas como a seção 13 de lattes_internals.md as descreve.

const STEP1 = `<html><body><form name="fl" action="pkg_importa_xml.inicio" method="post" enctype="multipart/form-data">
  <input type="file" name="file">
  <input type="hidden" name="f_cod" value="${CODE}">
  <input type="hidden" name="f_ctr" value="I">
  <input type="hidden" name="f_ret" value="">
  <input type="button" value="Enviar" onclick="check()">
</form></body></html>`;

const boxes = (n = 17) =>
  Array.from(
    { length: n },
    (_, i) => `<input type="checkbox" name="f_chkp" value="${i + 1}" checked>`,
  ).join('\n');

function step2({
  action = 'pkg_importa_xml.mostra_modulos',
  code = CODE,
  extra = '',
  modules = boxes(),
  solic = '987654',
  years = '<select name="f_ano_prod"><option value="2026" selected>2026</option><option value="2024">2024</option><option value="2007">2007</option></select>',
} = {}) {
  return `<html><head><title>Importar</title></head><body>
<form name="pkg_imp_xml" method="post" action="${action}">
  <input type="hidden" name="f_cod" value="${code}">
  <input type="hidden" name="f_solic" value="${solic}">
  <input type="hidden" name="f_ctr" value="">
  <input type="checkbox" name="f_all" checked> Selecionar todos
  ${modules}
  ${years}
  ${extra}
  <input type="button" value="Confirmar" onclick="enviar()">
  <input type="button" value="Descartar" onclick="excluir()">
</form></body></html>`;
}

const STEP3 = `<html><head><title>Importa&ccedil;&atilde;o</title></head><body>
<form name="pkg_imp_itens" action="pkg_importa_xml.confirma">
  <input type="hidden" name="f_solic" value="987654">
  <input type="checkbox" name="f_item" value="1" checked> Participação em congresso X
  <button type="button" onclick="confirmar()">Confirmar</button>
</form></body></html>`;

const LOGON = '<SCRIPT>location="pkg_sec.logon?f_cod=ini"</SCRIPT>';

interface Call {
  body?: string;
  fields?: [string, string][];
  file?: { name: string; type: string; xml: string };
  method: string;
  path: string;
}

function fakeLattes(pages: { s1?: string; s2?: string; s3?: string } = {}) {
  const calls: Call[] = [];
  const port: ImportPort = {
    get: async (path) => {
      calls.push({ method: 'GET', path });
      return { html: pages.s1 ?? STEP1, url: path };
    },
    post: async (path, body) => {
      calls.push({ body, method: 'POST', path });
      return { html: pages.s3 ?? STEP3, url: path };
    },
    postMultipart: async (path, fields, file) => {
      calls.push({
        fields,
        file: { name: file.name, type: file.type, xml: decodeLatin1(file.bytes) },
        method: 'MULTIPART',
        path,
      });
      return { html: pages.s2 ?? step2(), url: path };
    },
  };
  return { calls, port };
}

const REQ: ImportRequest = {
  file: new TextEncoder().encode('<CURRICULO-VITAE/>'),
  fileName: 'x-itens-novos.xml',
  modules: [16],
  oldestYear: 2024,
};

describe('Importar pelo conector contra um Lattes falso', () => {
  it('desligado (padrão): nem abre a tela do Importar', async () => {
    const { calls, port } = fakeLattes();
    const r = await importItems(port, CODE, REQ);
    expect(r.reason).toBe('desligado');
    expect(calls).toEqual([]);
  });

  it('fluxo inteiro ligado: arquivo do editor, passos 1 e 2, e para no passo 3 sem confirmar', async () => {
    const { cv, loadedMax } = await cvWithEvent('2024');
    const msg = importMessage(cv.doc, cv.encoding, loadedMax, { id: 'p1' }, true)!;
    const { calls, port } = fakeLattes();
    const r = await importItems(
      port,
      CODE,
      {
        file: fromBase64(msg.file),
        fileName: msg.fileName,
        modules: msg.modules,
        oldestYear: msg.oldestYear,
      },
      true,
    );

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      `GET pkg_importa_xml.inicio?f_cod=${CODE}`,
      'MULTIPART pkg_importa_xml.inicio',
      'POST pkg_importa_xml.mostra_modulos',
    ]);
    const upload = calls[1]!;
    expect(upload.fields).toEqual([
      ['f_cod', CODE],
      ['f_ctr', 'I'],
      ['f_ret', ''],
    ]);
    expect(upload.file?.name).toBe('0000000000000001-itens-novos.xml');
    expect(upload.file?.xml).toContain('PARTICIPACAO-EM-CONGRESSO');
    expect(upload.file?.xml).not.toContain('CPF=');
    const sent = new URLSearchParams(calls[2]!.body);
    expect(sent.get('f_cod')).toBe(CODE);
    expect(sent.get('f_solic')).toBe('987654');
    expect(sent.get('f_ctr')).toBe('I');
    expect(sent.getAll('f_chkp')).toEqual(['16']);
    expect(sent.get('f_ano_prod')).toBe('2024');
    expect(sent.has('f_all')).toBe(false);

    expect(r.reason).toBe('passo-3');
    expect(r.request).toBe('987654');
    expect(r.detail).toMatch(/^Passo 3 ainda não mapeado/);
    expect(r.detail).toContain('987654');
    expect(r.page).toEqual({
      buttons: ['Confirmar'],
      forms: [
        {
          action: 'pkg_importa_xml.confirma',
          fields: ['f_solic', 'f_item'],
          name: 'pkg_imp_itens',
        },
      ],
      title: 'Importação',
    });
    // A forma da página não carrega o texto dos itens.
    expect(JSON.stringify(r.page)).not.toContain('congresso');
  });

  it('vários módulos: cada caixa uma vez, em ordem', async () => {
    const { calls, port } = fakeLattes();
    await importItems(port, CODE, { ...REQ, modules: [17, 1, 16, 1] }, true);
    expect(new URLSearchParams(calls[2]!.body).getAll('f_chkp')).toEqual(['1', '16', '17']);
  });

  it('solicitação pendente antes de começar: para sem enviar nada nem descartar', async () => {
    for (const s1 of [
      '<p>Existe solicita&ccedil;&atilde;o de Importa&ccedil;&atilde;o de XML pendente</p>',
      `<p>Existe solicitação de Importação de XML pendente</p>${STEP1}`,
      step2(),
    ]) {
      const { calls, port } = fakeLattes({ s1 });
      const r = await importItems(port, CODE, REQ, true);
      expect(r.reason).toBe('pendente');
      expect(r.detail).toContain('Existe solicitação de Importação de XML pendente');
      expect(calls.map((c) => c.method)).toEqual(['GET']);
    }
  });

  it('sessão caída em qualquer passo', async () => {
    let lattes = fakeLattes({ s1: LOGON });
    expect((await importItems(lattes.port, CODE, REQ, true)).reason).toBe('sessao');
    expect(lattes.calls).toHaveLength(1);

    lattes = fakeLattes({ s2: LOGON });
    expect((await importItems(lattes.port, CODE, REQ, true)).reason).toBe('sessao');
    expect(lattes.calls).toHaveLength(2);

    lattes = fakeLattes({ s3: LOGON });
    const r = await importItems(lattes.port, CODE, REQ, true);
    expect(r).toMatchObject({ reason: 'sessao', request: '987654' });
    expect(importStopMessage(r)).toMatch(/^A sessão do Lattes caiu\. A solicitação 987654/);
  });

  it('tela do passo 1 diferente da mapeada: para antes de enviar', async () => {
    for (const s1 of [
      '<html><body>Manutenção</body></html>',
      STEP1.replace('multipart/form-data', 'application/x-www-form-urlencoded'),
      STEP1.replace('pkg_importa_xml.inicio', 'outro.proc'),
      STEP1.replace('name="f_ret"', 'name="f_volta"'),
    ]) {
      const { calls, port } = fakeLattes({ s1 });
      const r = await importItems(port, CODE, REQ, true);
      expect(r.reason).toBe('mudou');
      expect(r.page).toBeDefined();
      expect(calls).toHaveLength(1);
    }
  });

  it('passo 2 diferente do mapeado: para sem confirmar', async () => {
    const cases: [string, RegExp][] = [
      ['<html>Arquivo inválido</html>', /não mostrou o passo 2/],
      [step2({ action: 'outro.proc' }), /aponta para outro lugar/],
      [step2({ extra: '<input type="hidden" name="f_novo" value="1">' }), /f_novo/],
      [step2({ solic: '' }), /f_solic/],
      [step2({ modules: boxes(16) }), /17 mapeadas/],
      [step2({ modules: boxes().replace(/checkbox/g, 'hidden') }), /17 mapeadas/],
      [step2({ years: '<select name="f_ano_prod"></select>' }), /filtro de ano/],
    ];
    for (const [s2, problem] of cases) {
      const { calls, port } = fakeLattes({ s2 });
      const r = await importItems(port, CODE, REQ, true);
      expect(r.reason).toBe('mudou');
      expect(r.detail).toMatch(problem);
      expect(r.detail).toContain('pendente');
      expect(calls.map((c) => c.method)).toEqual(['GET', 'MULTIPART']);
    }
  });

  it('passo 2 de outro currículo: para e diz qual solicitação ficou pendente', async () => {
    const { calls, port } = fakeLattes({ s2: step2({ code: 'Z9999999Z9' }) });
    const r = await importItems(port, CODE, REQ, true);
    expect(r).toMatchObject({ reason: 'outro-cv', request: '987654' });
    expect(importStopMessage(r)).toContain('987654');
    expect(calls).toHaveLength(2);
  });

  it('filtro de ano em botões de opção, e sem ano que cubra o item mais antigo', async () => {
    const radios =
      '<input type="radio" name="f_ano_prod" value="2026" checked> 2026 <input type="radio" name="f_ano_prod" value="2010"> 2010';
    let lattes = fakeLattes({ s2: step2({ years: radios }) });
    await importItems(lattes.port, CODE, { ...REQ, oldestYear: 2015 }, true);
    expect(new URLSearchParams(lattes.calls[2]!.body).get('f_ano_prod')).toBe('2010');

    lattes = fakeLattes();
    const r = await importItems(lattes.port, CODE, { ...REQ, oldestYear: 2001 }, true);
    expect(r).toMatchObject({ reason: 'mudou', request: '987654' });
    expect(r.detail).toContain('2001');
    expect(lattes.calls).toHaveLength(2);
  });

  it('pedido inválido ou sem código: nada vai ao Lattes', async () => {
    const bad: ImportRequest[] = [
      { ...REQ, fileName: 'x.txt' },
      { ...REQ, file: new Uint8Array() },
      { ...REQ, modules: [] },
      { ...REQ, modules: [18] },
      { ...REQ, modules: [1.5] },
    ];
    for (const req of bad) {
      const { calls, port } = fakeLattes();
      expect((await importItems(port, CODE, req, true)).reason).toBe('arquivo');
      expect(calls).toEqual([]);
    }
    const { calls, port } = fakeLattes();
    expect((await importItems(port, undefined, REQ, true)).reason).toBe('erro');
    expect(calls).toEqual([]);
    expect(requestProblem(REQ)).toBeUndefined();
  });
});

describe('falhas de rede no meio do Importar', () => {
  it('antes do envio, a falha sobe (nada foi enviado)', async () => {
    const { port } = fakeLattes();
    port.get = async () => Promise.reject(new Error('rede'));
    await expect(importItems(port, CODE, REQ, true)).rejects.toThrow('rede');
  });

  it('no envio do arquivo: avisa que pode ter ficado solicitação pendente', async () => {
    const { port } = fakeLattes();
    port.postMultipart = async () => Promise.reject(new Error('rede'));
    const r = await importItems(port, CODE, REQ, true);
    expect(r).toMatchObject({ reason: 'erro', request: undefined });
    expect(r.detail).toContain('pendente');
  });

  it('depois do passo 2 lido: devolve o número da solicitação pendente', async () => {
    const { calls, port } = fakeLattes();
    port.post = async (path, body) => {
      calls.push({ body, method: 'POST', path });
      return Promise.reject(new Error('rede'));
    };
    const r = await importItems(port, CODE, REQ, true);
    expect(r).toMatchObject({ reason: 'erro', request: '987654' });
    expect(r.detail).toContain('A solicitação 987654 ficou pendente');
    expect(calls).toHaveLength(3);
  });
});

describe('o botão do Importar (importStatus)', () => {
  it('nada clicado, nada pedido, esperando, resposta e prazo vencido', () => {
    expect(importStatus(undefined, undefined, 0)).toEqual({ busy: false });
    expect(importStatus({ at: 0 }, undefined, 0)).toMatchObject({
      busy: false,
      text: expect.stringMatching(/Não há item novo/),
    });
    const sent = { at: 1000, id: 'p1' };
    expect(importStatus(sent, undefined, 2000).busy).toBe(true);
    // Resposta de um pedido anterior não vale por este.
    expect(importStatus(sent, { id: 'p0', reason: 'erro' }, 2000).busy).toBe(true);
    expect(
      importStatus(
        sent,
        { detail: 'Passo 3 ainda não mapeado', id: 'p1', reason: 'passo-3' },
        2000,
      ),
    ).toEqual({ busy: false, text: 'Passo 3 ainda não mapeado' });
    expect(importStatus(sent, undefined, 1000 + IMPORT_REPLY_TIMEOUT_MS)).toMatchObject({
      busy: false,
      text: expect.stringMatching(/não respondeu/),
    });
  });
});

describe('leituras das telas do Importar', () => {
  it('passo 1 e passo 2 lidos sem DOM', () => {
    expect(step1ScreenState(STEP1)).toBe('ok');
    expect(step1ScreenState(STEP1, 'https://x/pkg_sec.logon')).toBe('sessao');
    expect(step1ScreenState(STEP1.replace(/"/g, "'"))).toBe('ok');
    expect(readStep2(step2())).toEqual({
      code: CODE,
      request: '987654',
      years: [2026, 2024, 2007],
    });
  });

  it('ano do filtro', () => {
    expect(pickYear([2026, 2024, 2007], 2024)).toBe(2024);
    expect(pickYear([2026, 2024, 2007], 2020)).toBe(2007);
    expect(pickYear([2026, 2024], 2001)).toBeUndefined();
    expect(pickYear([2026, 2024, 2007], undefined)).toBe(2007);
  });

  it('forma de uma página sem formulário nem título', () => {
    expect(pageShape('<p>nada</p>')).toEqual({ buttons: [], forms: [], title: undefined });
    expect(pageShape('<title> </title><form><input name=a><input type=submit value=Ir>')).toEqual({
      buttons: ['Ir'],
      forms: [{ action: undefined, fields: ['a'], name: undefined }],
      title: undefined,
    });
  });

  it('mensagens de parada', () => {
    expect(importStopMessage({ reason: 'consentimento' })).toMatch(/Aceite o aviso/);
    expect(importStopMessage({ reason: 'sem-aba' })).toMatch(/não achou o Lattes/);
    expect(importStopMessage({ reason: 'sessao' })).toBe(
      'A sessão do Lattes caiu. Entre de novo e tente outra vez.',
    );
    expect(importStopMessage({ reason: 'outro-cv' })).toMatch(/outro currículo/);
    expect(importStopMessage({ detail: 'Passo 3 ainda não mapeado', reason: 'passo-3' })).toBe(
      'Passo 3 ainda não mapeado',
    );
    expect(importStopMessage({ reason: 'erro' })).toBe('A importação não foi feita no Lattes.');
  });

  it('um envio por vez na aba do Lattes', () => {
    const idle = { importing: false, photo: false, queue: false, verifying: false };
    expect(importBusy(idle)).toBeUndefined();
    for (const key of Object.keys(idle)) {
      expect(importBusy({ ...idle, [key]: true })?.reason).toBe('erro');
    }
  });
});

describe('Importar no service worker (extensão)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubChrome({
    consent = true,
    result,
    tabs = [{ id: 3 }],
  }: { consent?: boolean; result?: unknown; tabs?: { id?: number }[] } = {}) {
    const executeScript = vi.fn(async (opts: { args?: unknown[] }) =>
      opts.args ? [{ result }] : [],
    );
    vi.stubGlobal('chrome', {
      scripting: { executeScript },
      storage: {
        local: {
          get: async () => (consent ? { [CONSENT_KEY]: consentRecord() } : {}),
        },
      },
      tabs: { query: async () => tabs },
    });
    return executeScript;
  }

  const CALL = {
    file: 'PA==',
    fileName: 'a.xml',
    id: 'p1',
    lattesId: '1',
    modules: [16],
    oldestYear: 2024,
  };
  const IDLE = { photo: false, queue: false, verifying: false };

  it('dois pedidos juntos: o segundo é recusado enquanto o primeiro roda', async () => {
    let release: () => void = () => undefined;
    const executeScript = vi.fn(async (opts: { args?: unknown[] }) => {
      if (!opts.args) return [];
      await new Promise<void>((resolve) => (release = resolve));
      return [{ result: { reason: 'passo-3' } }];
    });
    vi.stubGlobal('chrome', {
      scripting: { executeScript },
      storage: { local: { get: async () => ({ [CONSENT_KEY]: consentRecord() }) } },
      tabs: { query: async () => [{ id: 3 }] },
    });
    const replies: string[] = [];
    const reply = async (r: { reason: string }) => void replies.push(r.reason);
    const first = runImport(CALL, IDLE, reply, true);
    await vi.waitFor(() => expect(importRunning()).toBe(true));
    expect(await runImport(CALL, IDLE, reply, true)).toBe(false);
    expect(replies).toEqual(['erro']);
    await vi.waitFor(() => expect(executeScript.mock.calls.some(([o]) => o.args)).toBe(true));
    release();
    expect(await first).toBe(true);
    expect(replies).toEqual(['erro', 'passo-3']);
    expect(importRunning()).toBe(false);
  });

  it('sem o currículo do editor, nada vai à aba', async () => {
    const exec = stubChrome();
    expect(await sendImport(CALL)).toMatchObject({ reason: 'outro-cv' });
    expect(exec).not.toHaveBeenCalled();
  });

  it('desligado: responde "desligado" sem tocar na aba', async () => {
    const exec = stubChrome();
    const reply = vi.fn(async () => undefined);
    expect(await runImport(CALL, IDLE, reply)).toBe(false);
    expect(reply).toHaveBeenCalledWith(expect.objectContaining({ reason: 'desligado' }));
    expect(exec).not.toHaveBeenCalled();
  });

  it('ligado: roda na aba, devolve o resultado e relê o menu; ocupado, recusa', async () => {
    const exec = stubChrome({ result: { reason: 'passo-3', request: '9' } });
    const reply = vi.fn(async () => undefined);
    expect(await runImport(CALL, IDLE, reply, true)).toBe(true);
    expect(reply).toHaveBeenCalledWith({
      id: 'p1',
      reason: 'passo-3',
      request: '9',
      type: 'importacao',
    });
    expect(importRunning()).toBe(false);
    const call = exec.mock.calls.find(([o]) => o.args)![0] as { args: [string, string[]] };
    expect(call.args[0]).toBe('importar');
    expect(JSON.parse(call.args[1][0]!)).toEqual({
      file: 'PA==',
      fileName: 'a.xml',
      modules: [16],
      oldestYear: 2024,
    });
    expect(call.args[1][1]).toBe('1');

    for (const busy of [{ photo: true }, { queue: true }, { verifying: true }]) {
      expect(await runImport(CALL, { ...IDLE, ...busy }, reply, true)).toBe(false);
      expect(reply).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'erro' }));
    }
  });

  it('sem consentimento, sem aba ou aba que não responde', async () => {
    stubChrome({ consent: false });
    expect((await sendImport(CALL, '1')).reason).toBe('consentimento');
    stubChrome({ tabs: [] });
    expect((await sendImport(CALL, '1')).reason).toBe('sem-aba');
    stubChrome({ result: undefined });
    expect(await sendImport(CALL, '1')).toMatchObject({ reason: 'erro' });
    vi.stubGlobal('chrome', {
      scripting: { executeScript: async () => Promise.reject(new Error('fechou')) },
      storage: { local: { get: async () => ({ [CONSENT_KEY]: consentRecord() }) } },
      tabs: { query: async () => [{ id: 3 }] },
    });
    const failed = await sendImport(CALL, '1');
    expect(failed).toMatchObject({ reason: 'erro' });
    expect(failed.detail).toContain('pendente');
  });
});
