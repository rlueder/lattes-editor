// A passada que exercita toda opção (scripts/passada/variantes.ts), na aba do
// menu do Lattes pela ponte local (scripts/censo-ponte.ts), sem a extensão.
// Grava no currículo: só roda acompanhada, com o "ok" do dono.
//
//   chamar '__passada.base()'          # as listas antes de tudo (fica na aba)
//   chamar '__passada.gerar()'         # as variantes, sobre o currículo lido por __carregarPonte
//   chamar '__passada.importar()'      # o Importar até o passo 3, que o dono confirma no Lattes
//   chamar '__passada.registro()'      # o que as listas têm a mais que a base
//
// Só saem contagens, nomes de tipo e os textos das linhas de teste (que
// começam com TEST_MARK); uma linha nova sem a marca sai só contada.

import { EVENT_CODES } from '../src/bridge/edit-items.ts';
import { toBase64 } from '../src/bridge/export.ts';
import {
  importItems,
  type ImportPort,
  pageShape,
  readStep2,
  step1ScreenState,
  STEP2_MODULE_VALUES,
} from '../src/bridge/importar.ts';
import { cvCodeFrom } from '../src/bridge/lattes-html.ts';
import { manualReason } from '../src/bridge/production/manual.ts';
import { PRODUCTION_TARGETS } from '../src/bridge/production/targets/index.ts';
import type { ListSnapshot } from '../src/census/test-ledger.ts';
import { TEST_MARK } from '../src/census/test-plan.ts';
import { buildMinimalImportFile } from '../src/import-export/import-file.ts';
import { decodeLatin1, encodeLatin1 } from '../src/model/latin1.ts';
import { insertInSchemaOrder } from '../src/model/schema-order.ts';
import {
  element,
  firstChild,
  getAttr,
  parseXml,
  serializeElement,
  serializeXml,
  walk,
  type XDocument,
  type XElement,
} from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import { withListValues } from './cobertura-exemplo.ts';
import { type Fate, snapshot, state, TAG, text } from './passada/aba.ts';
import { apagar } from './passada/apagar.ts';
import { campos, conferir, conferirPaginas } from './passada/conferencia.ts';
import { exercitar } from './passada/exercitar.ts';
import { incluir } from './passada/incluir.ts';
import { importableElements, type Variant, variantsOf } from './passada/variantes.ts';

/** O exemplo sintético, já decodificado do Latin-1 (build-conector-ponte.ts). */
declare const __EXEMPLO__: string;
const exemplo = __EXEMPLO__;

async function base() {
  state.base = await snapshot();
  sessionStorage.setItem('passada:base', JSON.stringify(state.base));
  return {
    linhas: Object.values(state.base).flat().length,
    listas: Object.keys(state.base).length,
  };
}

/** As variantes de todo tipo que o Importar aceita e que tem tela no Lattes. */
function gerar() {
  const doc = state.loaded?.doc;
  if (!doc) return 'rode __carregarPonte.carregar() antes';
  const example = parseXml(withListValues(exemplo).xml);
  let max = 0;
  walk(doc.root, (el) => {
    max = Math.max(max, Number(getAttr(el, 'SEQUENCIA-PRODUCAO')) || 0);
  });
  const variants: Variant[] = [];
  const skipped: string[] = [];
  for (const t of importableElements()) {
    let ex: XElement | undefined;
    walk(example.root, (el) => {
      if (!ex && el.name === t.element) ex = el;
    });
    // Sem tela no Lattes (artísticas antigas), ou sem formulário que o conector
    // conheça: importado, não teria como sair.
    const known =
      PRODUCTION_TARGETS.some((x) => x.element === t.element) || t.element in EVENT_CODES;
    if (!ex || manualReason([ex]) || !known) {
      skipped.push(t.element);
      continue;
    }
    const vs = variantsOf(t.element, ex, t.module, t.path, max + 1 + variants.length);
    variants.push(...vs);
  }
  state.variants = variants;
  const byModule: Record<string, number> = {};
  for (const v of variants) byModule[v.module] = (byModule[v.module] ?? 0) + 1;
  return { foraDaPassada: skipped, itens: variants.length, porModulo: byModule };
}

/** O currículo lido com as variantes dos módulos pedidos, nos caminhos do XSD. */
function withVariants(
  doc: XDocument,
  modules?: string[],
  only?: Set<string>,
): { doc: XDocument; max: number } {
  const copy: XDocument = { ...doc, root: structuredClone(doc.root) };
  let max = 0;
  walk(copy.root, (el) => {
    max = Math.max(max, Number(getAttr(el, 'SEQUENCIA-PRODUCAO')) || 0);
  });
  for (const v of state.variants ?? []) {
    if (modules && !modules.includes(v.module)) continue;
    if (only && !only.has(v.tag)) continue;
    let parent = copy.root;
    for (const name of v.path) {
      let next = firstChild(parent, name);
      if (!next) {
        next = element(name);
        insertInSchemaOrder(lattesSchema, parent, next);
      }
      parent = next;
    }
    insertInSchemaOrder(lattesSchema, parent, structuredClone(v.item));
  }
  return { doc: copy, max };
}

function importPort(): ImportPort {
  const fetchText = async (path: string, init?: RequestInit) => {
    const res = await fetch(new URL(path, location.href), { credentials: 'include', ...init });
    return { html: text(await res.arrayBuffer()), url: res.url };
  };
  return {
    get: (path) => fetchText(path),
    post: (path, body) =>
      fetchText(path, {
        body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST',
      }),
    postMultipart: (path, fields, f) => {
      const body = new FormData();
      body.append(f.field, new Blob([f.bytes as BlobPart], { type: f.type }), f.name);
      for (const [name, value] of fields) body.append(name, value);
      return fetchText(path, { body, method: 'POST' });
    },
  };
}

/** O arquivo do Importar das variantes (sem enviar). */
function importFile(modules?: string[], only?: Set<string>) {
  const doc = state.loaded!.doc!;
  const { doc: full, max } = withVariants(doc, modules, only);
  const file = buildMinimalImportFile(full, 'ISO-8859-1', max);
  // O Lattes confere o arquivo contra o DTD e recusa o DADOS-GERAIS mínimo; o
  // único Importar que passou levava a raiz e o DADOS-GERAIS de uma exportação
  // de verdade (seção 13 de lattes_internals.md). Vão os da exportação
  // guardada (usarExportacao), sem os filhos; o Importar só inclui os módulos
  // marcados no passo 2, e o DADOS-GERAIS do arquivo não muda o currículo.
  const source = state.exported ?? doc.root;
  const parsed = parseXml(decodeLatin1(file.bytes));
  parsed.root.attrs = structuredClone(source.attrs);
  const general = firstChild(source, 'DADOS-GERAIS');
  const target = firstChild(parsed.root, 'DADOS-GERAIS');
  if (general && target) target.attrs = structuredClone(general.attrs);
  file.bytes = encodeLatin1(serializeXml(parsed));
  return file;
}

/**
 * A forma do arquivo, para conferir contra o DTD fora da aba: nomes e códigos
 * de enumerado ficam, todo outro texto vira a (letras) e 9 (dígitos).
 */
function arquivo(modules?: string[]) {
  if (!state.loaded?.doc || !state.variants) return 'rode carregar() e gerar() antes';
  const xml = decodeLatin1(importFile(modules).bytes);
  return xml.replace(/="([^"]*)"/g, (_m, v: string) =>
    /^[A-Z_]+$/.test(v)
      ? `="${v}"`
      : `="${v.normalize('NFD').replace(/\p{M}/gu, '').replace(/\p{L}/gu, 'a').replace(/\d/g, '9')}"`,
  );
}

/** O Importar das variantes até o passo 3, que o dono confirma no Lattes. */
async function importar(modules?: string[], only?: Set<string>) {
  if (!state.loaded?.doc || !state.variants) return 'rode carregar() e gerar() antes';
  const file = importFile(modules, only);
  const port = importPort();
  const result = await importItems(port, cvCodeFrom(document.documentElement.outerHTML), {
    file: file.bytes,
    fileName: file.fileName,
    modules: file.modules.map((m) => STEP2_MODULE_VALUES[m.id]!),
    oldestYear: file.oldestYear,
  });
  return {
    arquivo: {
      bytes: file.bytes.length,
      itens: file.newItems,
      modulos: file.modules.map((m) => m.id),
    },
    detalhe: result.detail,
    motivo: result.reason,
    solicitacao: result.request,
    tamanhoBase64: toBase64(file.bytes).length,
  };
}

/**
 * Para achar o que o Importar recusa: um XML montado fora da aba (em base64,
 * Latin-1), com a raiz e o DADOS-GERAIS da exportação guardada postos aqui.
 */
async function importarXml(
  b64: string,
  modules: number[],
  oldestYear?: number,
  keepGeneral = false,
) {
  const parsed = parseXml(decodeLatin1(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
  const source = state.exported ?? state.loaded?.doc?.root;
  if (source && !keepGeneral) {
    parsed.root.attrs = structuredClone(source.attrs);
    const general = firstChild(source, 'DADOS-GERAIS');
    const target = firstChild(parsed.root, 'DADOS-GERAIS');
    if (general && target) target.attrs = structuredClone(general.attrs);
  }
  const result = await importItems(importPort(), cvCodeFrom(document.documentElement.outerHTML), {
    file: encodeLatin1(serializeXml(parsed)),
    fileName: 'teste.xml',
    modules,
    oldestYear,
  });
  return { detalhe: result.detail, motivo: result.reason, solicitacao: result.request };
}

/**
 * Uma solicitação que ficou no passo 2: o envio do passo 2 como o navegador o
 * faz (seção 13), até o passo 3, que o dono confirma no Lattes.
 */
async function passo2(modules: number[], year?: number) {
  const code = cvCodeFrom(document.documentElement.outerHTML) ?? '';
  const port = importPort();
  const screen = await port.get(`pkg_importa_xml.inicio?f_cod=${code}`);
  const form = readStep2(screen.html);
  if ('problem' in form) return form.problem;
  const body = new URLSearchParams([
    ['f_cod', code],
    ['f_solic', form.request],
    ['f_chkp', 'dummy'],
    ['f_ctr', 'I'],
    ...modules.map((m): [string, string] => ['f_chkp', String(m)]),
    ['f_ano_prod', String(year ?? Math.min(...form.years))],
  ]).toString();
  const step3 = await port.post('pkg_importa_xml.mostra_modulos', body);
  state.step3 = { html: step3.html, modules, request: form.request };
  return { anos: form.years, pagina: pageShape(step3.html), solicitacao: form.request };
}

/** "Descartar" no passo 2 (seção 13, item 5): encerra a solicitação sem importar nada. */
async function descartar() {
  const code = cvCodeFrom(document.documentElement.outerHTML) ?? '';
  const port = importPort();
  const screen = await port.get(`pkg_importa_xml.inicio?f_cod=${code}`);
  const form = readStep2(screen.html);
  if ('problem' in form) return form.problem;
  const body = new URLSearchParams([
    ['f_cod', code],
    ['f_solic', form.request],
    ['f_chkp', 'dummy'],
    ['f_ctr', 'D'],
  ]).toString();
  const after = await port.post('pkg_importa_xml.mostra_modulos', body);
  return { passo1: step1ScreenState(after.html, after.url) === 'ok', solicitacao: form.request };
}

/** O XML de uma variante, para montar os testes do que o Importar recusa. */
function variante(tag: string) {
  const v = state.variants?.find((x) => x.tag === tag);
  return v ? serializeElement(v.item).join('') : 'sem essa variante';
}

/**
 * O Confirmar do passo 3 (seção 13): só as linhas cujo texto tem a marca do
 * teste, com f_ctr=I. A resposta de sucesso não prova que o item entrou: a
 * conferência é pelas listas (registro()).
 */
async function passo3(max?: number) {
  const step = state.step3;
  if (!step) return 'rode passo2() antes';
  const code = cvCodeFrom(document.documentElement.outerHTML) ?? '';
  const doc = new DOMParser().parseFromString(step.html, 'text/html');
  const rows = [...doc.querySelectorAll<HTMLInputElement>('input[name="f_sq"]')]
    .filter((box) => box.value !== 'dummy')
    .map((box) => ({
      id: box.value,
      // Verde: "não está cadastrada"; vermelho: já está (seção 13).
      novo: Boolean(box.closest('tr')?.querySelector('.verde')),
      text: (box.closest('tr')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    }));
  const chosen = rows.filter((r) => r.novo && r.text.includes(TEST_MARK)).slice(0, max ?? Infinity);
  const fates = (state.fates ??= {});
  for (const r of rows) {
    const tag = TAG.exec(r.text)?.[1];
    if (tag) fates[tag] = chosen.includes(r) ? 'confirmada' : 'existente';
  }
  if (chosen.length === 0) return { escolhidas: 0, linhas: rows.length };
  const body = new URLSearchParams([
    ['f_cod', code],
    ['f_solic', step.request],
    ['f_sq', 'dummy'],
    ['f_ctr', 'I'],
    ['f_chkp', 'dummy'],
    ...step.modules.map((m): [string, string] => ['f_chkp', String(m)]),
    ['f_all', 'on'],
    ...chosen.map((r): [string, string] => ['f_sq', r.id]),
  ]).toString();
  const answer = await importPort().post('pkg_importa_xml.mostra_lista_prod', body);
  state.step3 = undefined;
  return {
    escolhidas: chosen.length,
    linhas: rows.length,
    resposta: [...answer.html.matchAll(/(?:alert|exibir)\(\{?[^)]{0,240}/g)]
      .map((m) => m[0].replace(/\s+/g, ' ').slice(0, 200))
      .slice(0, 4),
    semMarca: rows.length - chosen.length,
    sucesso: /realizada com sucesso/i.test(answer.html),
    titulo: /<title>([^<]*)/i.exec(answer.html)?.[1]?.trim(),
  };
}

/** O destino de cada variante, por tipo. */
function destinos() {
  const fates =
    state.fates ??
    (JSON.parse(sessionStorage.getItem('passada:destinos') ?? '{}') as Record<string, Fate>);
  const out: Record<string, Record<Fate | 'sem-envio', string[]>> = {};
  for (const v of state.variants ?? []) {
    const fate = fates[v.tag] ?? 'sem-envio';
    ((out[v.element] ??= {} as Record<Fate | 'sem-envio', string[]>)[fate] ??= []).push(
      v.tag.split(' ')[1]!,
    );
  }
  return out;
}

/**
 * Uma rodada: as variantes que ainda não estão nas listas, até `size`, pelo
 * Importar inteiro (envio, passo 2 e o Confirmar só das linhas novas com a
 * marca). O Confirmar com 316 linhas não gravou nada (28/10/2026); com 20,
 * gravou e encerrou a solicitação.
 */
async function rodada(size = 20) {
  if (!state.variants) return 'rode gerar() antes';
  const lists = await snapshot();
  const texts = Object.values(lists)
    .flat()
    .map((r) => r.text);
  const fates = (state.fates ??= JSON.parse(
    sessionStorage.getItem('passada:destinos') ?? '{}',
  ) as Record<string, Fate>);
  const missing = state.variants.filter(
    (v) =>
      !fates[v.tag] &&
      !texts.some(
        (t) => t.includes(`${TEST_MARK} ${v.tag} `) || t.endsWith(`${TEST_MARK} ${v.tag}`),
      ),
  );
  const batch = missing.slice(0, size);
  if (batch.length === 0) return { faltam: 0 };
  const sent = await importar(undefined, new Set(batch.map((v) => v.tag)));
  if (typeof sent === 'string' || (sent.motivo !== 'pendente' && sent.motivo !== 'passo-3')) {
    return { envio: sent, faltam: missing.length };
  }
  const modules = [...new Set(batch.map((v) => STEP2_MODULE_VALUES[v.module]!))].sort(
    (a, b) => a - b,
  );
  const step2 = await passo2(modules);
  if (typeof step2 === 'string') return { faltam: missing.length, passo2: step2 };
  const step3 = await passo3();
  // Enviada e fora do passo 3: o Lattes não a aceitou no módulo (o artigo
  // "resumo" no de artigos completos, 28/10/2026).
  for (const v of batch) fates[v.tag] ??= 'fora-do-passo-3';
  sessionStorage.setItem('passada:destinos', JSON.stringify(fates));
  return { confirmar: step3, enviadas: batch.length, faltamAntes: missing.length };
}

/** O que as listas têm a mais e a menos que a base: as linhas de teste por extenso, o resto contado. */
async function registro() {
  const before =
    state.base ??
    (JSON.parse(sessionStorage.getItem('passada:base') ?? 'null') as ListSnapshot | null);
  if (!before) return 'rode base() antes';
  const now = await snapshot();
  const extra: string[] = [];
  let extraWithoutMark = 0;
  const withoutMarkIn: Record<string, number> = {};
  let missing = 0;
  for (const [key, rows] of Object.entries(now)) {
    const was = [...(before[key] ?? [])].map((r) => r.text);
    for (const r of rows) {
      const i = was.indexOf(r.text);
      if (i >= 0) {
        was.splice(i, 1);
        continue;
      }
      if (r.text.includes(TEST_MARK)) extra.push(`${key.split('?')[0]} :: ${r.text.slice(0, 90)}`);
      else {
        extraWithoutMark++;
        withoutMarkIn[key] = (withoutMarkIn[key] ?? 0) + 1;
      }
    }
    missing += was.length;
  }
  for (const key of Object.keys(before)) if (!(key in now)) missing += before[key]!.length;
  return {
    aMaisComMarca: extra.length,
    aMaisSemMarca: extraWithoutMark,
    linhas: extra,
    semMarcaPorLista: withoutMarkIn,
    sumiram: missing,
  };
}

(globalThis as unknown as { __passada: unknown }).__passada = {
  apagar,
  arquivo,
  base,
  campos,
  conferir,
  conferirPaginas,
  descartar,
  destinos,
  exercitar,
  gerar,
  importar,
  importarXml,
  incluir,
  passo2,
  passo3,
  registro,
  rodada,
  variante,
};
