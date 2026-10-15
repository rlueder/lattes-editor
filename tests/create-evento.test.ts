// Participação em evento incluída pelo formulário de eventos, no lugar do
// Importar (LAT-57): o planejamento, o caminho (só com a chave ligada) e o
// envio de ponta a ponta contra o Lattes simulado.

import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { DEMO_XML } from '../scripts/lattes-simulado/estado.ts';
import { applyAll, applyOp } from '../src/bridge/apply.ts';
import { checkContract, isBreaking, LATTES_CONTRACT } from '../src/bridge/contract.ts';
import { EVENT_ELEMENTS } from '../src/bridge/create-evento.ts';
import { CREATE_SPECS } from '../src/bridge/create-items.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { DIRECT_INCLUSION_TYPES, directInclusion } from '../src/model/direct-inclusion.ts';
import { loadCv } from '../src/model/document.ts';
import { isPendingImport } from '../src/model/production.ts';
import { element, getAttr, walk, type XElement } from '../src/model/xml.ts';
import { type LattesSimuladoNoTeste, withLattesSimulado } from './helpers/lattes-simulado.ts';

const DEMO = new Uint8Array(readFileSync(DEMO_XML));

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

const OWNER = {
  'NOME-COMPLETO-DO-PARTICIPANTE-DE-EVENTOS-CONGRESSOS': 'Ana Beatriz Souza Lima',
  'NRO-ID-CNPQ': '3871592046158372',
  'ORDEM-PARTICIPANTE': '1',
};

function congresso(
  basics: Record<string, string> = {},
  detail: Record<string, string> = {},
  extra: XElement[] = [element('PARTICIPANTE-DE-EVENTOS-CONGRESSOS', OWNER)],
) {
  return element('PARTICIPACAO-EM-CONGRESSO', { 'SEQUENCIA-PRODUCAO': '90' }, [
    element('DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO', {
      ANO: '2025',
      'FLAG-DIVULGACAO-CIENTIFICA': 'NAO',
      'FLAG-RELEVANCIA': 'NAO',
      'FORMA-PARTICIPACAO': 'Participante',
      'MEIO-DE-DIVULGACAO': 'NAO_INFORMADO',
      NATUREZA: 'Congresso',
      PAIS: 'Brasil',
      'TIPO-PARTICIPACAO': 'Apresentação oral',
      TITULO: 'Genômica de Butia',
      ...basics,
    }),
    element('DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO', {
      'CIDADE-DO-EVENTO': 'Gramado',
      'NOME-DO-EVENTO': '70º Congresso Brasileiro de Genética',
      ...detail,
    }),
    ...extra,
  ]);
}

async function plan(item: XElement) {
  const original = await loadCv(DEMO, 'demo.xml');
  const working = structuredClone(original.doc);
  find(working.root, (el) => el.name === 'PARTICIPACAO-EM-EVENTOS-CONGRESSOS').children.push(item);
  const entries = diffDocuments(original.doc.root, working.root).map((change) => ({
    change,
    itemTitle: '',
  }));
  return planChanges(entries, working.root, { createItems: true });
}

describe('evento: Importar ou formulário', () => {
  it('com a chave desligada, o evento novo segue no arquivo do Importar; ligada, sai dele', () => {
    expect([...DIRECT_INCLUSION_TYPES].sort()).toEqual([...EVENT_ELEMENTS].sort());
    const item = congresso();
    expect(isPendingImport(item, 33)).toBe(true);
    expect(directInclusion()).toEqual(new Set());
    expect(isPendingImport(item, 33, directInclusion(true))).toBe(false);
    // Um tipo que segue pelo Importar não muda.
    const artigo = element('ARTIGO-PUBLICADO', { 'SEQUENCIA-PRODUCAO': '91' });
    expect(isPendingImport(artigo, 33, directInclusion(true))).toBe(true);
  });

  it('o evento novo vira inclusão com os campos do formulário', async () => {
    const { ops, unsupported } = await plan(congresso());
    expect(unsupported).toEqual([]);
    expect(ops).toEqual([
      expect.objectContaining({
        kind: 'criar-evento',
        set: {
          f_ano: '2025',
          f_cidade: 'Gramado',
          F_COD_PROD: 'A31',
          F_FORMA: '39',
          f_homepage: '',
          f_nme_evento: '70º Congresso Brasileiro de Genética',
          f_pais: 'BRA',
          F_STA_DIVULGACAO_CIENTIFICA: 'N',
          f_titulo: 'Genômica de Butia',
          f_titulo_en: '',
          F_TPO: 'Apresentação oral',
        },
      }),
    ]);
  });

  it('o que o formulário não tem vai à mão, com o motivo', async () => {
    const reason = async (item: XElement) => (await plan(item)).unsupported[0]?.reason;
    expect(await reason(congresso({ IDIOMA: 'Português' }))).toBe(
      'O formulário de eventos do Lattes não tem: Idioma',
    );
    expect(await reason(congresso({ 'FLAG-RELEVANCIA': 'SIM' }))).toMatch(/Relevância/);
    expect(await reason(congresso({ 'FORMA-PARTICIPACAO': '' }))).toMatch(/forma de participação/);
    expect(await reason(congresso({ 'TIPO-PARTICIPACAO': 'Moderador' }))).toMatch(
      /tipo de participação/,
    );
    expect(await reason(congresso({ ANO: '' }))).toMatch(/nome e do ano/);
    expect(await reason(congresso({ PAIS: 'Atlântida' }))).toMatch(/País sem código/);
    expect(await reason(congresso({ TITULO: '' }))).toMatch(/precisa do título/);
    expect(
      await reason(
        congresso({}, {}, [
          element('PARTICIPANTE-DE-EVENTOS-CONGRESSOS', OWNER),
          element('PARTICIPANTE-DE-EVENTOS-CONGRESSOS', {
            'NOME-COMPLETO-DO-PARTICIPANTE-DE-EVENTOS-CONGRESSOS': 'Outra Pessoa',
          }),
        ]),
      ),
    ).toMatch(/Participantes além de você/);
    expect(
      await reason(
        congresso({}, {}, [element('PALAVRAS-CHAVE', { 'PALAVRA-CHAVE-1': 'genética' })]),
      ),
    ).toMatch(/palavras-chave/);
    // Ouvinte: sem tipo nem título.
    const ouvinte = await plan(
      congresso({ 'FORMA-PARTICIPACAO': 'Ouvinte', 'TIPO-PARTICIPACAO': '', TITULO: '' }),
    );
    expect(ouvinte.ops[0]).toMatchObject({ set: { F_FORMA: '40', F_TPO: '' } });
  });
});

describe('incluir evento no Lattes simulado', () => {
  it('inclui, confere, e a exportação traz o evento com a própria pessoa', async () => {
    const lattes = await start();
    const { ops } = await plan(congresso());
    const [r] = await applyAll(ops, lattes.port);
    expect(r).toMatchObject({ status: 'conferido' });
    expect(r!.detail).toMatch(/^Criada e conferida no Lattes \(evento \d+\)$/);
    const novo = find(
      lattes.state.root,
      (el) =>
        el.name === 'DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO' &&
        getAttr(el, 'NOME-DO-EVENTO') === '70º Congresso Brasileiro de Genética',
    );
    expect(getAttr(novo, 'CIDADE-DO-EVENTO')).toBe('Gramado');

    // De novo: já está no Lattes, nada é enviado.
    const posts = lattes.state.log.filter((l) => l.method === 'POST').length;
    expect(await applyOp(ops[0]!, lattes.port)).toMatchObject({
      detail: 'O Lattes já tem essa participação (mesmo evento, ano e forma)',
      status: 'divergente',
    });
    expect(lattes.state.log.filter((l) => l.method === 'POST').length).toBe(posts);
  });

  it('sem lista, sem link ou com campo a mais, para antes de enviar', async () => {
    const { ops } = await plan(congresso());
    const op = ops[0]!;
    const lattes = await start({
      intercept: async (req, _state, next) => {
        const out = await next();
        if (/^pkg_evento\.lista$/i.test(req.proc) && 'html' in out) {
          return {
            ...out,
            html: out.html.replace(
              /PKG_EVENTO\.form\?f_cod=\w+&amp;F_STA_DIVULGACAO_CIENTIFICA=(?=')/g,
              'x',
            ),
          };
        }
        return out;
      },
    });
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'Inclusão de evento não encontrada na lista do Lattes',
      status: 'erro',
    });
    const plain = await start();
    expect(
      await applyOp({ ...op, set: { ...op.set, f_outro: 'x' } } as typeof op, plain.port),
    ).toMatchObject({ detail: 'O formulário de eventos não tem: f_outro', status: 'erro' });
  });

  it('o contrato do formulário de inclusão de eventos bate com o simulado', async () => {
    const lattes = await start();
    const report = await checkContract(lattes.port, {
      forms: { ...LATTES_CONTRACT.forms, 'criar-evento': CREATE_SPECS['criar-evento'] },
      menu: LATTES_CONTRACT.menu,
    });
    const form = report.forms.find((f) => f.kind === 'criar-evento')!;
    expect(form.drifts.filter(isBreaking)).toEqual([]);
    expect(['ok', 'mudou']).toContain(form.status);
  });
});
