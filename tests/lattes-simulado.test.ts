// O conector de ponta a ponta contra o Lattes simulado (scripts/lattes-simulado/):
// conferência do contrato, Exportar, alteração, exclusão, inclusão, envio ao
// CNPq e os três passos do Importar, cada um com a chave forçada a ligar só
// aqui. O simulado nasce de fixtures/demo.xml.

import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { DEMO_XML } from '../scripts/lattes-simulado/estado.ts';
import {
  DONE_MESSAGE,
  DTD_ALERT,
  NO_PRODUCTION_ALERT,
  PENDING_NOTICE,
} from '../scripts/lattes-simulado/importar.ts';
import { applyAll } from '../src/bridge/apply.ts';
import { biographicContract } from '../src/bridge/biographic.ts';
import { checkContract, isBreaking, LATTES_CONTRACT } from '../src/bridge/contract.ts';
import { CREATE_ATUACAO_SPEC } from '../src/bridge/create.ts';
import { CREATE_FIELD_LABELS } from '../src/bridge/create-labels.ts';
import { projetoOp, TEAM_BY_HAND } from '../src/bridge/create-projeto.ts';
import { editContract } from '../src/bridge/edit-items.ts';
import { isEspelhoPage, parseEspelho } from '../src/bridge/espelho.ts';
import { exportCv, fromBase64 } from '../src/bridge/export.ts';
import { pairValue, successfulPairs } from '../src/bridge/form.ts';
import { importItems, readStep2, STEP2_MODULE_VALUES } from '../src/bridge/importar.ts';
import { cvCodeFrom, lattesIdFrom } from '../src/bridge/lattes-html.ts';
import { lattesStatusFrom } from '../src/bridge/lattes-status.ts';
import { uploadPhoto } from '../src/bridge/photo.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { buildImportFile } from '../src/import-export/import-file.ts';
import { importMessage } from '../src/import-export/import-request.ts';
import { diffDocuments, resolvePath } from '../src/model/changes.ts';
import { loadCv, maxSequenciaProducao } from '../src/model/document.ts';
import { addProduction, newItem, productionType } from '../src/model/production.ts';
import {
  childElements,
  element,
  getAttr,
  serializeXml,
  setAttr,
  walk,
  type XDocument,
  type XElement,
} from '../src/model/xml.ts';
import { lattesSchema as schema } from '../src/schema/lattes.ts';
import { type LattesSimuladoNoTeste, withLattesSimulado } from './helpers/lattes-simulado.ts';

const DEMO = new Uint8Array(readFileSync(DEMO_XML));
const ALL_ON = { biographicOps: true, createItems: true, deleteItems: true, editItems: true };

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function start(options: Parameters<typeof withLattesSimulado>[0] = {}) {
  open = await withLattesSimulado(options);
  return open;
}

function find(root: XElement, match: (el: XElement) => boolean): XElement {
  let hit: XElement | undefined;
  walk(root, (el) => {
    if (!hit && match(el)) hit = el;
  });
  if (!hit) throw new Error('elemento não achado');
  return hit;
}

/** O que o editor faria: carrega a exportação, edita e planeja. */
async function planEdits(edit: (doc: XDocument) => void, bytes: Uint8Array = DEMO) {
  const original = await loadCv(bytes, 'demo.xml');
  const working = structuredClone(original.doc);
  edit(working);
  const entries = diffDocuments(original.doc.root, working.root).map((change) => ({
    change,
    itemTitle: '',
  }));
  return { ...planChanges(entries, working.root, ALL_ON), entries, working };
}

async function exported(lattes: LattesSimuladoNoTeste) {
  const menu = await lattes.port.menuHtml();
  return exportCv(lattes.exportPort, cvCodeFrom(menu), lattesIdFrom(menu));
}

const isIdioma = (code: string) => (el: XElement) =>
  el.name === 'IDIOMA' && getAttr(el, 'IDIOMA') === code;

describe('Lattes simulado: o conector de ponta a ponta', () => {
  it('o contrato fixo bate sem diferença, e o das chaves desligadas não tem nada que quebre', async () => {
    const lattes = await start();
    const fixed = await checkContract(lattes.port);
    expect(fixed.status).toBe('ok');
    expect(fixed.lists?.every((l) => l.status === 'ok')).toBe(true);

    const gated = await checkContract(lattes.port, {
      forms: {
        ...LATTES_CONTRACT.forms,
        ...biographicContract(true).forms,
        ...editContract(true).forms,
        'criar-atuacao': CREATE_ATUACAO_SPEC,
      },
      menu: [...LATTES_CONTRACT.menu, ...biographicContract(true).menu, ...editContract(true).menu],
    });
    expect(gated.menu.every((m) => m.found)).toBe(true);
    expect(gated.forms.flatMap((f) => f.drifts).filter(isBreaking)).toEqual([]);
    expect(gated.forms.every((f) => f.status === 'ok' || f.status === 'mudou')).toBe(true);
  });

  it('exporta o currículo publicado, igual ao de partida', async () => {
    const lattes = await start();
    const r = await exported(lattes);
    if (!r.ok) throw new Error(r.reason);
    expect(r.fileName).toBe('CV_3871592046158372.zip');
    const back = await loadCv(r.bytes, r.fileName);
    const seed = await loadCv(DEMO, 'demo.xml');
    expect(serializeXml(back.doc)).toBe(serializeXml(seed.doc));
  });

  it('altera, exclui e inclui pelo conector, e o envio ao CNPq leva tudo à exportação', async () => {
    const lattes = await start();
    const plan = await planEdits((doc) => {
      setAttr(find(doc.root, isIdioma('EN')), 'PROFICIENCIA-DE-ESCRITA', 'RAZOAVELMENTE');
      const vinculo = find(doc.root, (el) => el.name === 'VINCULOS');
      setAttr(vinculo, 'OUTRAS-INFORMACOES', 'Coordena o Laboratório — genômica');
      const mestrado = find(doc.root, (el) => el.name === 'MESTRADO');
      setAttr(mestrado, 'ANO-DE-CONCLUSAO', '2012');
      const idiomas = find(doc.root, (el) => el.name === 'IDIOMAS');
      idiomas.children = idiomas.children.filter(
        (c) => c.kind !== 'element' || getAttr(c, 'IDIOMA') !== 'ES',
      );
      const atuacoes = find(doc.root, (el) => el.name === 'ATUACOES-PROFISSIONAIS');
      atuacoes.children.push(
        element(
          'ATUACAO-PROFISSIONAL',
          {
            'CODIGO-INSTITUICAO': '000000000003',
            'NOME-INSTITUICAO': 'Universidade Estadual de Campinas',
            'SEQUENCIA-ATIVIDADE': '9',
          },
          [
            element('VINCULOS', {
              'ANO-FIM': '',
              'ANO-INICIO': '2026',
              'CARGA-HORARIA-SEMANAL': '20',
              'FLAG-DEDICACAO-EXCLUSIVA': 'NAO',
              'FLAG-VINCULO-EMPREGATICIO': 'SIM',
              'MES-INICIO': '3',
              'SEQUENCIA-HISTORICO': '1',
              'TIPO-DE-VINCULO': 'CELETISTA',
            }),
          ],
        ),
      );
    });
    expect(plan.unsupported).toEqual([]);
    expect(plan.ops.map((o) => o.kind).sort()).toEqual([
      'criar-atuacao',
      'excluir-idioma',
      'formacao',
      'idioma',
      'vinculo',
    ]);

    const results = await applyAll(plan.ops, lattes.port);
    expect(results.map((r) => [r.status, r.detail])).toEqual(
      results.map((r) => ['conferido', r.detail]),
    );
    expect(results.find((r) => r.assigned)?.assigned).toEqual({ 'SEQUENCIA-ATIVIDADE': '3' });

    // Gravado e não publicado: o menu mostra a pendência e o Exportar recusa.
    expect(lattesStatusFrom(await lattes.port.menuHtml())?.pending).toBe(true);
    expect(await exported(lattes)).toMatchObject({ ok: false, reason: 'pendente' });

    // Enviar ao CNPq como a tela faz (observado em 14/10/2026).
    const sent = await lattes.port.get(
      `pkg_publicar.enviar?f_chk=1&f_idioma=1&f_chk_en=1&f_email_contato=&f_email_alternativo=&f_cod=${lattes.state.code}&f_ctr=U`,
    );
    expect(sent).toContain('O currículo foi enviado para publicação.');
    expect(lattesStatusFrom(await lattes.port.menuHtml())?.pending).toBe(false);

    const r = await exported(lattes);
    if (!r.ok) throw new Error(r.reason);
    const doc = (await loadCv(r.bytes, r.fileName)).doc;
    expect(getAttr(find(doc.root, isIdioma('EN')), 'PROFICIENCIA-DE-ESCRITA')).toBe(
      'RAZOAVELMENTE',
    );
    expect(() => find(doc.root, isIdioma('ES'))).toThrow();
    expect(
      getAttr(
        find(doc.root, (el) => el.name === 'MESTRADO'),
        'ANO-DE-CONCLUSAO',
      ),
    ).toBe('2012');
    expect(
      getAttr(
        find(doc.root, (el) => el.name === 'VINCULOS'),
        'OUTRAS-INFORMACOES',
      ),
    ).toBe('Coordena o Laboratório — genômica');
    const unicamp = find(
      doc.root,
      (el) => el.name === 'ATUACAO-PROFISSIONAL' && getAttr(el, 'SEQUENCIA-ATIVIDADE') === '3',
    );
    expect(getAttr(unicamp, 'CODIGO-INSTITUICAO')).toBe('000000000003');
    expect(getAttr(childElements(unicamp, 'VINCULOS')[0]!, 'TIPO-DE-VINCULO')).toBe('CELETISTA');
    // Passou pelo f_stavinc invertido (0) e voltou SIM na exportação.
    expect(getAttr(childElements(unicamp, 'VINCULOS')[0]!, 'FLAG-VINCULO-EMPREGATICIO')).toBe(
      'SIM',
    );
  });

  it('f_stavinc é o inverso de FLAG-VINCULO-EMPREGATICIO, como no Lattes (observado em 15/10/2026)', async () => {
    const lattes = await start();
    const form = async () => {
      const html = await lattes.port.get(
        `PKG_ATIV.vinculos?f_cod=${lattes.state.code}&f_codinst=&f_seq_ativ=1&f_seq_hist=1`,
      );
      return pairValue(successfulPairs(lattes.port.readForm(html, 'GN_ATIV_VINC')!), 'f_stavinc');
    };
    // A demonstração exporta SIM: o formulário mostra Não (0).
    expect(await form()).toBe('0');

    const plan = await planEdits((doc) =>
      setAttr(
        find(doc.root, (el) => el.name === 'VINCULOS'),
        'FLAG-VINCULO-EMPREGATICIO',
        'NAO',
      ),
    );
    expect(plan.ops).toMatchObject([
      { expect: { f_stavinc: '0' }, kind: 'vinculo', set: { f_stavinc: '1' } },
    ]);
    expect((await applyAll(plan.ops, lattes.port)).map((r) => r.status)).toEqual(['conferido']);
    expect(await form()).toBe('1');

    await lattes.port.get(
      `pkg_publicar.enviar?f_chk=1&f_idioma=1&f_chk_en=1&f_email_contato=&f_email_alternativo=&f_cod=${lattes.state.code}&f_ctr=U`,
    );
    const r = await exported(lattes);
    if (!r.ok) throw new Error(r.reason);
    const doc = (await loadCv(r.bytes, r.fileName)).doc;
    const vinculo = find(doc.root, (el) => el.name === 'VINCULOS');
    expect(getAttr(vinculo, 'FLAG-VINCULO-EMPREGATICIO')).toBe('NAO');
    // A dedicação exclusiva não é invertida.
    expect(getAttr(vinculo, 'FLAG-DEDICACAO-EXCLUSIVA')).toBe('SIM');
  });

  it('inclui formação e projeto pelo conector, sobre uma atuação incluída antes', async () => {
    const lattes = await start();
    const code = lattes.state.code;
    const publish = () =>
      lattes.port.get(
        `pkg_publicar.enviar?f_chk=1&f_idioma=1&f_chk_en=1&f_email_contato=&f_email_alternativo=&f_cod=${code}&f_ctr=U`,
      );
    // Primeiro a atuação na Unicamp, publicada e exportada de novo.
    const first = await planEdits((doc) => {
      find(doc.root, (el) => el.name === 'ATUACOES-PROFISSIONAIS').children.push(
        element(
          'ATUACAO-PROFISSIONAL',
          {
            'CODIGO-INSTITUICAO': '000000000003',
            'NOME-INSTITUICAO': 'Universidade Estadual de Campinas',
            'SEQUENCIA-ATIVIDADE': '9',
          },
          [
            element('VINCULOS', {
              'ANO-INICIO': '2026',
              'FLAG-VINCULO-EMPREGATICIO': 'SIM',
              'SEQUENCIA-HISTORICO': '1',
              'TIPO-DE-VINCULO': 'CELETISTA',
            }),
          ],
        ),
      );
    });
    expect((await applyAll(first.ops, lattes.port)).map((r) => r.status)).toEqual(['conferido']);
    await publish();
    const exportedNow = await exported(lattes);
    if (!exportedNow.ok) throw new Error(exportedNow.reason);

    const plan = await planEdits((doc) => {
      find(doc.root, (el) => el.name === 'FORMACAO-ACADEMICA-TITULACAO').children.push(
        element('MESTRADO', {
          'ANO-DE-INICIO': '2024',
          'CODIGO-AGENCIA-FINANCIADORA': '000000000002',
          'CODIGO-CURSO': '00000004',
          'CODIGO-INSTITUICAO': '000000000003',
          'FLAG-BOLSA': 'SIM',
          NIVEL: '3',
          'NOME-AGENCIA': 'Coordenação de Aperfeiçoamento de Pessoal de Nível Superior',
          'NOME-COMPLETO-DO-ORIENTADOR': 'Orientadora de Teste',
          'NOME-CURSO': 'Genética e Biologia Molecular',
          'NOME-INSTITUICAO': 'Universidade Estadual de Campinas',
          'SEQUENCIA-FORMACAO': '9',
          'STATUS-DO-CURSO': 'EM_ANDAMENTO',
          'TITULO-DA-DISSERTACAO-TESE': 'Genômica de populações de Butia',
        }),
      );
      const unicamp = find(
        doc.root,
        (el) => el.name === 'ATUACAO-PROFISSIONAL' && getAttr(el, 'SEQUENCIA-ATIVIDADE') === '3',
      );
      unicamp.children.push(
        element('ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO', {}, [
          element(
            'PARTICIPACAO-EM-PROJETO',
            { 'ANO-INICIO': '2026', 'SEQUENCIA-FUNCAO-ATIVIDADE': '9' },
            [
              element('PROJETO-DE-PESQUISA', {
                'ANO-FIM': '',
                'ANO-INICIO': '2026',
                NATUREZA: 'PESQUISA',
                'NOME-DO-PROJETO': 'Sementes de palmeiras em bancos de germoplasma',
                'SEQUENCIA-PROJETO': '9',
                SITUACAO: 'EM_ANDAMENTO',
              }),
            ],
          ),
        ]),
      );
    }, exportedNow.bytes);
    // O projeto vai à mão pela equipe e pelo órgão (seção 21); a operação que
    // projetoOp() monta segue exercida aqui, para quando a equipe for lida.
    expect(plan.unsupported.map((u) => u.reason)).toEqual([TEAM_BY_HAND]);
    expect(plan.ops.map((o) => o.kind)).toEqual(['criar-formacao']);
    const projectChange = plan.entries.find((e) => e.change.element !== 'MESTRADO')!.change;
    const projetoNovo = projetoOp(
      projectChange,
      resolvePath(plan.working.root, projectChange.path),
      'Projeto',
    );
    if ('reason' in projetoNovo) throw new Error(projetoNovo.reason);
    const results = await applyAll([...plan.ops, projetoNovo], lattes.port);
    expect(results.map((r) => [r.status, r.detail])).toEqual(
      results.map((r) => ['conferido', r.detail]),
    );
    expect(results.map((r) => r.assigned)).toEqual(
      expect.arrayContaining([{ 'SEQUENCIA-FORMACAO': '5' }, { 'SEQUENCIA-PROJETO': '2' }]),
    );

    await publish();
    const after = await exported(lattes);
    if (!after.ok) throw new Error(after.reason);
    const doc = (await loadCv(after.bytes, after.fileName)).doc;
    const mestrado = find(
      doc.root,
      (el) => el.name === 'MESTRADO' && getAttr(el, 'SEQUENCIA-FORMACAO') === '5',
    );
    expect(mestrado.attrs.filter((a) => a.value).map((a) => [a.name, a.value])).toEqual(
      expect.arrayContaining([
        ['CODIGO-INSTITUICAO', '000000000003'],
        ['NOME-INSTITUICAO', 'Universidade Estadual de Campinas'],
        ['CODIGO-CURSO', '00000004'],
        ['NOME-CURSO', 'Genética e Biologia Molecular'],
        ['CODIGO-AGENCIA-FINANCIADORA', '000000000002'],
        ['STATUS-DO-CURSO', 'EM_ANDAMENTO'],
        ['TITULO-DA-DISSERTACAO-TESE', 'Genômica de populações de Butia'],
      ]),
    );
    const projeto = find(
      doc.root,
      (el) => el.name === 'PROJETO-DE-PESQUISA' && getAttr(el, 'SEQUENCIA-PROJETO') === '2',
    );
    expect(getAttr(projeto, 'NOME-DO-PROJETO')).toBe(
      'Sementes de palmeiras em bancos de germoplasma',
    );
    const unicamp = find(
      doc.root,
      (el) => el.name === 'ATUACAO-PROFISSIONAL' && getAttr(el, 'SEQUENCIA-ATIVIDADE') === '3',
    );
    expect(childElements(unicamp, 'ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO')).toHaveLength(1);
  });

  it('formação incluída com a agência mostrada diferente não é dada por conferida', async () => {
    // Depois do POST, o campo desabilitado da agência mostra outra coisa.
    const lattes = await start({
      intercept: async (req, state, next) => {
        const out = await next();
        if (req.method === 'POST' && /^pkg_formacao\.form$/i.test(req.proc)) {
          const novo = find(
            state.root,
            (el) => el.name === 'MESTRADO' && getAttr(el, 'SEQUENCIA-FORMACAO') === '5',
          );
          setAttr(novo, 'NOME-AGENCIA', 'Outra agência');
        }
        return out;
      },
    });
    const plan = await planEdits((doc) => {
      find(doc.root, (el) => el.name === 'FORMACAO-ACADEMICA-TITULACAO').children.push(
        element('MESTRADO', {
          'ANO-DE-INICIO': '2024',
          'CODIGO-AGENCIA-FINANCIADORA': '000000000002',
          'CODIGO-INSTITUICAO': '000000000003',
          'FLAG-BOLSA': 'SIM',
          NIVEL: '3',
          'NOME-AGENCIA': 'Coordenação de Aperfeiçoamento de Pessoal de Nível Superior',
          'NOME-INSTITUICAO': 'Universidade Estadual de Campinas',
          'SEQUENCIA-FORMACAO': '9',
          'STATUS-DO-CURSO': 'EM_ANDAMENTO',
        }),
      );
    });
    expect(plan.ops.map((o) => o.kind)).toEqual(['criar-formacao']);
    const [r] = await applyAll(plan.ops, lattes.port);
    expect(r).toMatchObject({
      assigned: { 'SEQUENCIA-FORMACAO': '5' },
      status: 'divergente',
    });
    expect(r!.detail).toMatch(/^Criada no Lattes \(formação 5\), mas gravada diferente: /);
    expect(r!.detail).toContain(CREATE_FIELD_LABELS.f_nme_agencia ?? 'f_nme_agencia');
  });

  it('para a fila quando a sessão vence no meio, como o Lattes de verdade', async () => {
    const lattes = await start({ expireAfterRequests: 3 });
    const plan = await planEdits((doc) =>
      setAttr(find(doc.root, isIdioma('EN')), 'PROFICIENCIA-DE-ESCRITA', 'POUCO'),
    );
    const [r] = await applyAll(plan.ops, lattes.port);
    expect(r?.status).toBe('sessao');
    expect(await exportCv(lattes.exportPort, lattes.state.code)).toMatchObject({
      ok: false,
      reason: 'sessao',
    });
    expect(await lattes.port.menuHtml()).toContain("location = 'pkg_sec.logon?f_cod=ini'");
  });

  it('Importar: recusa o arquivo mínimo, aceita o inteiro e faz os passos 1 a 3', async () => {
    const lattes = await start();
    const cv = await loadCv(DEMO, 'demo.xml');
    const loadedMax = maxSequenciaProducao(cv.doc);
    const type = productionType(schema, 'PARTICIPACAO-EM-CONGRESSO')!;
    const item = newItem(schema, type.itemName, loadedMax + 1);
    const basics = childElements(item)[0]!;
    setAttr(basics, 'TITULO', 'Marcadores genômicos em Butia catarinensis');
    setAttr(basics, 'ANO', '2026');
    setAttr(basics, 'NATUREZA', 'Congresso');
    setAttr(basics, 'FORMA-PARTICIPACAO', 'Participante');
    setAttr(childElements(item)[1]!, 'NOME-DO-EVENTO', '70º Congresso Brasileiro de Genética');
    // Com a própria pessoa entre os participantes: o caso que entrou no Lattes.
    item.children.push(
      element('PARTICIPANTE-DE-EVENTOS-CONGRESSOS', {
        'NOME-COMPLETO-DO-PARTICIPANTE-DE-EVENTOS-CONGRESSOS': 'Ana Beatriz Souza Lima',
        'ORDEM-PARTICIPANTE': '1',
      }),
    );
    addProduction(schema, cv.doc, type, item);
    const code = lattes.state.code;

    // Opção 1, o arquivo mínimo: recusado pelo DTD (observado em 14/10/2026).
    const minimal = importMessage(cv.doc, cv.encoding, loadedMax, { id: 'p1' }, true)!;
    const refused = await importItems(
      lattes.importPort,
      code,
      {
        file: fromBase64(minimal.file),
        fileName: minimal.fileName,
        modules: minimal.modules,
        oldestYear: minimal.oldestYear,
      },
      true,
    );
    expect(refused.reason).toBe('arquivo');
    expect(refused.detail).toContain(DTD_ALERT);
    expect(lattes.state.importRequest).toBeUndefined();

    // Opção 2, o currículo inteiro com o item novo: passos 1 e 2 pelo conector.
    const full = buildImportFile(cv.doc, cv.encoding, loadedMax);
    const stopped = await importItems(
      lattes.importPort,
      code,
      {
        file: full.bytes,
        fileName: full.fileName,
        modules: full.modules.map((m) => STEP2_MODULE_VALUES[m.id]!),
        oldestYear: 2026,
      },
      true,
    );
    expect(stopped.reason).toBe('passo-3');
    expect(stopped.page?.forms[0]?.action).toBe('pkg_importa_xml.mostra_lista_prod');
    const request = stopped.request!;

    // O conector para ali. Reabrir o Importar leva ao passo 2 da solicitação pendente.
    const reopened = await lattes.port.get(`pkg_importa_xml.inicio?f_cod=${code}`);
    expect(reopened).toContain(PENDING_NOTICE);
    const step2 = readStep2(reopened);
    // Os anos são os das produções do arquivo, do mais novo ao mais antigo.
    expect(step2).toMatchObject({ code, request });
    const years = 'years' in step2 ? step2.years : [];
    expect(years[0]).toBe(2026);
    expect(years).toEqual([...years].sort((a, b) => b - a));

    // A pessoa confirma o passo 2 e o passo 3.
    const step3 = await lattes.port.post(
      'pkg_importa_xml.mostra_modulos',
      `f_cod=${code}&f_solic=${request}&f_chkp=dummy&f_ctr=I&f_chkp=16&f_ano_prod=2026`,
    );
    const rows = [...step3.matchAll(/name="f_sq" value="(\d+)"[^]*?class="quadrado (\w+)"/g)];
    expect(rows.map((m) => m[2])).toEqual(['verde']);
    const done = await lattes.port.post(
      'pkg_importa_xml.mostra_lista_prod',
      // Os campos e a ordem do envio do navegador no passo 3 (14/10/2026).
      `f_cod=${code}&f_solic=${request}&f_sq=dummy&f_ctr=I&f_chkp=dummy&f_chkp=16&f_all=on&f_sq=${rows[0]![1]}`,
    );
    expect(done).toContain(DONE_MESSAGE);
    expect(lattes.state.importRequest).toBeUndefined();
    expect(lattes.state.imported).toEqual([
      {
        inserted: true,
        seq: String(loadedMax + 1),
        title: 'Marcadores genômicos em Butia catarinensis',
      },
    ]);

    // Entrou na lista e no espelho, sem pendência; o Exportar segue com a versão publicada.
    const list = await lattes.port.get(`pkg_evento.lista?f_cod=${code}`);
    expect(list).toContain('70º Congresso Brasileiro de Genética');
    const espelho = await lattes.port.get(`pkg_publicar.cv_espelho?f_cod=${code}&f_idioma=1`);
    expect(isEspelhoPage(espelho)).toBe(true);
    expect(parseEspelho(espelho).some((i) => i.text.includes('Butia catarinensis'))).toBe(true);
    expect(lattesStatusFrom(await lattes.port.menuHtml())?.pending).toBe(false);
    const r = await exported(lattes);
    if (!r.ok) throw new Error(r.reason);
    expect(new TextDecoder('latin1').decode(r.bytes)).not.toContain('Butia catarinensis');
  });

  it('Importar: o evento sem a pessoa some depois do "sucesso", mas gasta o número', async () => {
    const lattes = await start();
    const cv = await loadCv(DEMO, 'demo.xml');
    const loadedMax = maxSequenciaProducao(cv.doc);
    const type = productionType(schema, 'PARTICIPACAO-EM-CONGRESSO')!;
    const item = newItem(schema, type.itemName, loadedMax + 1);
    setAttr(childElements(item)[0]!, 'TITULO', 'Sem participante');
    setAttr(childElements(item)[0]!, 'ANO', '2026');
    addProduction(schema, cv.doc, type, item);
    const full = buildImportFile(cv.doc, cv.encoding, loadedMax);
    const code = lattes.state.code;
    const r = await importItems(
      lattes.importPort,
      code,
      { file: full.bytes, fileName: full.fileName, modules: [16], oldestYear: 2026 },
      true,
    );
    const step3 = await lattes.port.post(
      'pkg_importa_xml.mostra_modulos',
      `f_cod=${code}&f_solic=${r.request}&f_ctr=I&f_chkp=16&f_ano_prod=2026`,
    );
    const id = /name="f_sq" value="(\d+)"/.exec(step3)![1]!;
    const done = await lattes.port.post(
      'pkg_importa_xml.mostra_lista_prod',
      `f_cod=${code}&f_solic=${r.request}&f_ctr=I&f_sq=${id}`,
    );
    expect(done).toContain(DONE_MESSAGE);
    expect(lattes.state.imported).toEqual([
      { inserted: false, seq: String(loadedMax + 1), title: 'Sem participante' },
    ]);
    expect(await lattes.port.get(`pkg_evento.lista?f_cod=${code}`)).not.toContain(
      'Sem participante',
    );
    expect(lattes.state.nextProduction).toBe(loadedMax + 1);
  });

  it('Importar: arquivo só com evento é recusado como sem produções científicas', async () => {
    const lattes = await start();
    const cv = await loadCv(DEMO, 'demo.xml');
    // Todos os atributos de DADOS-GERAIS, e da produção só os eventos.
    const root = cv.doc.root;
    root.children = root.children.filter(
      (c) => c.kind !== 'element' || c.name === 'DADOS-GERAIS' || c.name === 'DADOS-COMPLEMENTARES',
    );
    const bytes = new TextEncoder().encode(serializeXml(cv.doc).replace(/ISO-8859-1/, 'UTF-8'));
    const r = await importItems(
      lattes.importPort,
      lattes.state.code,
      { file: bytes, fileName: 'so-evento.xml', modules: [16] },
      true,
    );
    expect(r.reason).toBe('arquivo');
    expect(r.detail).toContain(NO_PRODUCTION_ALERT);
  });

  it('evento de ouvinte incluído na tela do Lattes e alterado pelo conector', async () => {
    const lattes = await start();
    const code = lattes.state.code;
    // A pessoa inclui pela tela: POST do formulário com f_ctr=I.
    const created = await lattes.port.post(
      'PKG_EVENTO.FORM',
      `f_ctr=I&f_cod=${code}&f_seq=&F_FORMA=40&F_COD_PROD=A32&f_nme_evento=Semin%E1rio+de+Gen%E9tica&f_ano=2025&f_pais=BRA&f_titulo=&F_STA_DIVULGACAO_CIENTIFICA=N&f_tipo_privacidade=1`,
    );
    expect(created).toContain('checkPublicacao()');
    await lattes.port.get(
      `pkg_publicar.enviar?f_chk=1&f_idioma=1&f_chk_en=1&f_email_contato=&f_email_alternativo=&f_cod=${code}&f_ctr=U`,
    );
    const r = await exported(lattes);
    if (!r.ok) throw new Error(r.reason);

    const plan = await planEdits((doc) => {
      const basics = find(
        doc.root,
        (el) =>
          el.name === 'DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO' &&
          getAttr(el, 'FORMA-PARTICIPACAO') === 'Ouvinte',
      );
      setAttr(basics, 'TITULO', 'Ouvinte no seminário');
    }, r.bytes);
    expect(plan.ops.map((o) => o.kind)).toEqual(['evento']);
    const [result] = await applyAll(plan.ops, lattes.port);
    expect(result?.status).toBe('conferido');
    expect(lattesStatusFrom(await lattes.port.menuHtml())?.pending).toBe(true);
    const espelho = await lattes.port.get(`pkg_publicar.cv_espelho?f_cod=${code}&f_idioma=1`);
    expect(espelho).toContain('Ouvinte no seminário');
  });

  it('troca a foto e lê a nova de volta', async () => {
    const lattes = await start();
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    const r = await uploadPhoto(lattes.photoPort, lattes.state.code, jpeg);
    expect(r).toEqual({ ok: true });
    expect([...lattes.state.photo]).toEqual([...jpeg]);
  });
});

describe('Lattes simulado: o servidor', () => {
  it('responde nas duas bases, mas o POST do Exportar só funciona em /cvlattesweb/', async () => {
    const lattes = await start();
    const curriculoweb = `${lattes.url}/curriculoweb/`;
    const menu = await fetch(lattes.at('PKG_MENU.menu', curriculoweb));
    expect(menu.status).toBe(200);
    await expect(
      fetch(lattes.at('PKG_IMPCV.get_arquivo', curriculoweb), {
        body: `f_cod=${lattes.state.code}&f_ctr=G&f_tpo_arq=3`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST',
      }),
    ).rejects.toThrow();
  });

  it('segue a assinatura dos procedimentos e não conhece o que não simula', async () => {
    const lattes = await start();
    expect((await fetch(lattes.at('pkg_formacao.lista?f_cod=x'))).status).toBe(404);
    expect((await fetch(lattes.at('pkg_nao_existe.form'))).status).toBe(404);
    expect((await fetch(`${lattes.url}/outra/coisa`)).status).toBe(404);
    // Sem diferença de caixa no nome do procedimento.
    expect(await lattes.port.get(`PKG_IDIOMA.LISTA?f_cod=${lattes.state.code}`)).toContain(
      'pkg_idioma.form',
    );
  });

  it('sessão: vence, leva ao login e volta pelo login', async () => {
    const lattes = await start();
    await fetch(`${lattes.url}/__simulado/expirar`, { method: 'POST' });
    expect(await lattes.port.get('pkg_idioma.lista')).toContain('pkg_sec.logon?f_cod=ini');
    expect(await lattes.port.get('pkg_sec.logon?f_cod=ini')).toContain('name="logon"');
    const back = await fetch(lattes.at('pkg_sec.logon'), { method: 'POST', redirect: 'manual' });
    expect(back.status).toBe(302);
    expect(lattes.state.sessionActive).toBe(true);
    const estado = (await (await fetch(`${lattes.url}/__simulado/estado`)).json()) as {
      sessao: boolean;
    };
    expect(estado.sessao).toBe(true);
  });

  it('exclusão de evento pela tela: mesma resposta de sucesso, some da lista e do espelho', async () => {
    const lattes = await start();
    const code = lattes.state.code;
    const list = await lattes.port.get(`pkg_evento.lista?f_cod=${code}`);
    const seq = /f_seq=(\d+)/.exec(list)![1]!;
    const form = await lattes.port.get(
      `PKG_EVENTO.form?f_cod=${code}&F_STA_DIVULGACAO_CIENTIFICA=&f_seq=${seq}`,
    );
    expect(form).toContain("dc.f_ctr.value = 'E'");
    const done = await lattes.port.post('PKG_EVENTO.FORM', `f_ctr=E&f_cod=${code}&f_seq=${seq}`);
    expect(done).toContain('A operação foi realizada com sucesso! !');
    expect(await lattes.port.get(`pkg_evento.lista?f_cod=${code}`)).not.toContain(`f_seq=${seq}'`);
    expect(lattes.state.pending).toBe(true);
  });

  it('Importar: descartar no passo 2 volta ao passo 1 e encerra a solicitação', async () => {
    const lattes = await start({ importOutcome: 'descartar' });
    const full = buildImportFile((await loadCv(DEMO, 'demo.xml')).doc, 'ISO-8859-1', 0);
    const step2 = await lattes.importPort.postMultipart(
      'pkg_importa_xml.inicio',
      [
        ['f_cod', lattes.state.code],
        ['f_ctr', 'I'],
        ['f_ret', ''],
      ],
      { bytes: full.bytes, field: 'file', name: full.fileName, type: 'text/xml' },
    );
    expect(step2.html).toContain('O arquivo foi enviado com sucesso!');
    const form = readStep2(step2.html);
    if ('problem' in form) throw new Error(form.problem);
    const back = await lattes.port.post(
      'pkg_importa_xml.mostra_modulos',
      `f_cod=${lattes.state.code}&f_solic=${form.request}&f_ctr=D`,
    );
    expect(back).toContain('name="fl"');
    expect(lattes.state.importRequest).toBeUndefined();
  });

  it('ler páginas não muda o currículo', async () => {
    const lattes = await start();
    const before = serializeXml(lattes.state.working);
    const code = lattes.state.code;
    const list = await lattes.port.get(`pkg_evento.lista?f_cod=${code}`);
    for (const seq of [...list.matchAll(/f_seq=(\d+)/g)].map((m) => m[1])) {
      await lattes.port.get(
        `PKG_EVENTO.form?f_cod=${code}&F_STA_DIVULGACAO_CIENTIFICA=&f_seq=${seq}`,
      );
    }
    await lattes.port.get(`pkg_publicar.cv_espelho?f_cod=${code}&f_idioma=1`);
    await checkContract(lattes.port);
    expect(serializeXml(lattes.state.working)).toBe(before);
    expect(lattes.state.pending).toBe(false);
  });

  it('inclusão de idioma: recusa código vazio ou já cadastrado', async () => {
    const lattes = await start();
    const code = lattes.state.code;
    for (const idioma of ['', 'EN', 'ZZ']) {
      const out = await lattes.port.post(
        'PKG_IDIOMA.FORM',
        `f_ctr=I&f_cod=${code}&f_seq=&F_COD_IDIOMA=${idioma}&FC_LE=on&F_LE=B`,
      );
      expect(out).toContain('ainda não cadastrado');
    }
    expect(lattes.state.pending).toBe(false);
    await lattes.port.post(
      'PKG_IDIOMA.FORM',
      `f_ctr=I&f_cod=${code}&f_seq=&F_COD_IDIOMA=FR&FC_LE=on&F_LE=B`,
    );
    const fr = find(lattes.state.root, isIdioma('FR'));
    expect(getAttr(fr, 'DESCRICAO-DO-IDIOMA')).toBe('Francês');
    expect(getAttr(fr, 'PROFICIENCIA-DE-LEITURA')).toBe('BEM');
    expect(lattes.state.pending).toBe(true);
  });

  it('o controle recusa pedido de outra origem', async () => {
    const lattes = await start();
    const other = await fetch(`${lattes.url}/__simulado/expirar`, {
      headers: { Origin: 'https://exemplo.com' },
      method: 'POST',
    });
    expect(other.status).toBe(403);
    expect(lattes.state.sessionActive).toBe(true);
    const same = await fetch(`${lattes.url}/__simulado/publicar`, {
      headers: { Origin: lattes.url },
      method: 'POST',
    });
    expect(same.status).toBe(200);
  });

  it('responde com a gravação quando há uma para o procedimento', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'lattes-gravadas-'));
    writeFileSync(join(dir, 'pkg_idioma.lista.get.html'), '<p>gravada {{f_cod}}</p>', 'latin1');
    const lattes = await start({ recordings: dir });
    expect(await lattes.port.get('pkg_idioma.lista')).toBe(`<p>gravada ${lattes.state.code}</p>`);
  });
});
