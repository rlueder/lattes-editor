// "Atualizar do Lattes" de ponta a ponta no Lattes simulado: a exportação é a
// versão publicada; itens criados ou trocados depois, só na versão de
// trabalho, voltam ao editor pelas listas e pelos formulários, só com GET.

import { afterEach, describe, expect, it } from 'vitest';

import { formNamesOf } from '../src/bridge/refresh/coverage.ts';
import { mergeReadings } from '../src/bridge/refresh/merge.ts';
import { planRefresh } from '../src/bridge/refresh/plan.ts';
import {
  type FormReading,
  readRefreshPart,
  type RefreshPart,
  type RefreshRequest,
} from '../src/bridge/refresh/read.ts';
import type { ListSnapshot } from '../src/census/test-ledger.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { maxSequenciaProducao } from '../src/model/document.ts';
import { loadedOf } from '../src/model/form-read.ts';
import { isNewProduction, newItem, pendingItems } from '../src/model/production.ts';
import { insertInSchemaOrder } from '../src/model/schema-order.ts';
import {
  childElements,
  element,
  firstChild,
  getAttr,
  parseXml,
  serializeElement,
  serializeXml,
  setAttr,
  type XDocument,
  type XElement,
} from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import {
  findIn,
  type LattesSimuladoNoTeste,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

let lattes: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await lattes?.close();
  lattes = undefined;
});

/** As passadas como o editor as pede: listas em partes, depois os formulários. */
async function refresh(sim: LattesSimuladoNoTeste, base: XDocument, working: XDocument) {
  const menu = await sim.port.menuHtml();
  const ask = (request: RefreshRequest): Promise<RefreshPart> =>
    readRefreshPart(
      { get: sim.port.get, readForm: sim.port.readForm },
      menu,
      sim.state.code,
      request,
    );
  const lists: ListSnapshot = {};
  const unread: string[] = [];
  let queue: string[] | undefined;
  do {
    const part = await ask({ queue, step: 'listas' });
    if (part.step !== 'listas') throw new Error('parte errada');
    Object.assign(lists, part.lists);
    unread.push(...part.unread);
    queue = part.queue;
  } while (queue.length > 0);
  const plan = planRefresh(lists, unread, working.root, base.root);
  const readings: FormReading[] = [];
  if (plan.reads.length > 0) {
    const part = await ask({
      reads: plan.reads.map((r) => ({ forms: formNamesOf(r.group), link: r.link })),
      step: 'formularios',
    });
    if (part.step !== 'formularios') throw new Error('parte errada');
    readings.push(...part.forms);
  }
  const merged = mergeReadings({
    base: base.root,
    counter: maxSequenciaProducao(base) + 1,
    now: 1,
    plan,
    readings,
    working: working.root,
  });
  return { lists, merged, plan };
}

const items = (root: XElement, name: string) => {
  const out: XElement[] = [];
  const walk = (el: XElement) => {
    for (const c of childElements(el)) {
      if (c.name === name) out.push(c);
      else walk(c);
    }
  };
  walk(root);
  return out;
};

const basics = (item: XElement) =>
  childElements(item).find((c) => c.name.startsWith('DADOS-BASICOS'))!;

/** Um artigo criado no Lattes depois da exportação, só na versão de trabalho do simulado. */
function addArticle(sim: LattesSimuladoNoTeste, title: string): XElement {
  const seq = ++sim.state.nextProduction;
  const item = newItem(lattesSchema, 'ARTIGO-PUBLICADO', seq);
  setAttr(basics(item), 'TITULO-DO-ARTIGO', title);
  setAttr(basics(item), 'ANO-DO-ARTIGO', '2026');
  setAttr(basics(item), 'IDIOMA', 'Português');
  const detail = firstChild(item, 'DETALHAMENTO-DO-ARTIGO')!;
  setAttr(detail, 'TITULO-DO-PERIODICO-OU-REVISTA', 'Revista Exemplo');
  insertInSchemaOrder(
    lattesSchema,
    item,
    element('AUTORES', {
      'NOME-COMPLETO-DO-AUTOR': 'Ana Beatriz Souza Lima',
      'NOME-PARA-CITACAO': 'LIMA, A. B. S.',
      'NRO-ID-CNPQ': '',
      'ORDEM-DE-AUTORIA': '1',
    }),
  );
  const container = sim.state.ensurePath(['PRODUCAO-BIBLIOGRAFICA', 'ARTIGOS-PUBLICADOS']);
  insertInSchemaOrder(lattesSchema, container, item);
  return item;
}

describe('Atualizar do Lattes no simulado', () => {
  it('traz o item novo e o título trocado, sem POST, e nada vira alteração a enviar', async () => {
    lattes = await withLattesSimulado();
    const published = serializeXml(lattes.state.published);
    const base = parseXml(published);
    const working = parseXml(published);

    addArticle(lattes, 'Leitura incremental de currículos');
    const work = items(lattes.state.root, 'TRABALHO-EM-EVENTOS')[0]!;
    const workSeq = getAttr(work, 'SEQUENCIA-PRODUCAO')!;
    setAttr(basics(work), 'TITULO-DO-TRABALHO', 'Título trocado direto no Lattes');

    const { merged, plan } = await refresh(lattes, base, working);

    expect(merged.added).toEqual(['Leitura incremental de currículos']);
    expect(merged.changed).toEqual(['Título trocado direto no Lattes']);
    expect(plan.reads).toHaveLength(2);
    // Só leituras: nenhum POST, nenhum f_ctr.
    expect(lattes.state.log.every((l) => l.method === 'GET' && !l.ctr)).toBe(true);

    // O artigo novo entrou nos dois documentos, com número acima de todos.
    const max = maxSequenciaProducao(parseXml(published));
    const fresh = items(working.root, 'ARTIGO-PUBLICADO').find(
      (a) => getAttr(basics(a), 'TITULO-DO-ARTIGO') === 'Leitura incremental de currículos',
    )!;
    expect(Number(getAttr(fresh, 'SEQUENCIA-PRODUCAO'))).toBe(max + 1);
    expect(merged.counter).toBe(max + 2);
    expect(
      getAttr(firstChild(fresh, 'DETALHAMENTO-DO-ARTIGO')!, 'TITULO-DO-PERIODICO-OU-REVISTA'),
    ).toBe('Revista Exemplo');
    expect(getAttr(childElements(fresh, 'AUTORES')[0]!, 'NOME-COMPLETO-DO-AUTOR')).toBe(
      'Ana Beatriz Souza Lima',
    );

    // Marcado como lido do Lattes, ele não vai de novo pelo Importar.
    const loaded = loadedOf({ lattesForms: merged.marks, loadedMaxSequencia: max });
    expect(isNewProduction(fresh, max)).toBe(true);
    expect(isNewProduction(fresh, loaded)).toBe(false);
    expect(pendingItems(working, loaded)).toEqual([]);
    expect(diffDocuments(base.root, working.root)).toEqual([]);
    expect(merged.marks.map((m) => m.kind).sort()).toEqual(['alterado', 'novo']);
    expect(merged.marks.find((m) => m.kind === 'alterado')?.seq).toBe(workSeq);
  });

  it('não mexe nos itens que a lista já mostra, byte a byte', async () => {
    lattes = await withLattesSimulado();
    const published = serializeXml(lattes.state.published);
    const base = parseXml(published);
    const working = parseXml(published);
    const { merged, plan } = await refresh(lattes, base, working);
    expect(plan.reads).toEqual([]);
    expect(merged.added).toEqual([]);
    expect(serializeXml(base)).toBe(published);
    expect(serializeXml(working)).toBe(published);
  });

  it('um campo trocado pela pessoa no editor fica, e o resto vem do Lattes', async () => {
    lattes = await withLattesSimulado();
    const published = serializeXml(lattes.state.published);
    const base = parseXml(published);
    const working = parseXml(published);
    const inLattes = items(lattes.state.root, 'TRABALHO-EM-EVENTOS')[0]!;
    const seq = getAttr(inLattes, 'SEQUENCIA-PRODUCAO')!;
    setAttr(basics(inLattes), 'TITULO-DO-TRABALHO', 'Novo título no Lattes');
    setAttr(basics(inLattes), 'HOME-PAGE-DO-TRABALHO', 'https://example.org/lattes');
    const mine = findIn(
      working.root,
      (el) => el.name === 'TRABALHO-EM-EVENTOS' && getAttr(el, 'SEQUENCIA-PRODUCAO') === seq,
    )!;
    setAttr(basics(mine), 'HOME-PAGE-DO-TRABALHO', 'https://example.org/editor');

    const { merged } = await refresh(lattes, base, working);
    expect(merged.changed).toEqual(['Novo título no Lattes']);
    expect(getAttr(basics(mine), 'TITULO-DO-TRABALHO')).toBe('Novo título no Lattes');
    expect(getAttr(basics(mine), 'HOME-PAGE-DO-TRABALHO')).toBe('https://example.org/editor');
    const changes = diffDocuments(base.root, working.root);
    expect(changes.flatMap((c) => c.fields.map((f) => [f.attr, f.before, f.after]))).toEqual([
      ['HOME-PAGE-DO-TRABALHO', 'https://example.org/lattes', 'https://example.org/editor'],
    ]);
  });

  it('o item criado no editor que entrou pelo Importar deixa de ser item novo', async () => {
    lattes = await withLattesSimulado();
    const published = serializeXml(lattes.state.published);
    const base = parseXml(published);
    const working = parseXml(published);
    const max = maxSequenciaProducao(base);
    // No editor: um artigo novo, ainda a importar.
    const mine = newItem(lattesSchema, 'ARTIGO-PUBLICADO', max + 1);
    setAttr(basics(mine), 'TITULO-DO-ARTIGO', 'Artigo importado pelo editor');
    setAttr(basics(mine), 'ANO-DO-ARTIGO', '2025');
    const container = firstChild(
      firstChild(working.root, 'PRODUCAO-BIBLIOGRAFICA')!,
      'ARTIGOS-PUBLICADOS',
    )!;
    insertInSchemaOrder(lattesSchema, container, mine);
    expect(pendingItems(working, max)).toEqual([mine]);
    // No Lattes: o mesmo artigo, com o número que o servidor deu.
    addArticle(lattes, 'Artigo importado pelo editor');
    const added = items(lattes.state.root, 'ARTIGO-PUBLICADO').at(-1)!;
    setAttr(basics(added), 'ANO-DO-ARTIGO', '2025');

    const { merged, plan } = await refresh(lattes, base, working);
    expect(plan.reads.map((r) => r.seq)).toEqual([String(max + 1)]);
    expect(merged.added).toEqual(['Artigo importado pelo editor']);
    const loaded = loadedOf({ lattesForms: merged.marks, loadedMaxSequencia: max });
    expect(pendingItems(working, loaded)).toEqual([]);
    expect(diffDocuments(base.root, working.root)).toEqual([]);
    expect(serializeElement(mine).join('')).toContain('Revista Exemplo');
  });
});
