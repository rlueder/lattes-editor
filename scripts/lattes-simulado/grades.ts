// As grades de autores, áreas, palavras-chave e setores dos formulários de
// produção no Lattes simulado (seção 16 de docs/lattes_internals.md). As
// telas de cada tipo saem da especificação dele (producao.ts).
//
// Observado no Lattes real em 16/10/2026, só por GET: a página escreve cada
// grade como um vetor em script (`var autorProvider = [...]`,
// `palavraProvider = [...]`, `areaProvider = [...]`,
// `var setorProvider = [...]`), cada um terminado por um objeto vazio; os
// ocultos f_autores_l, f_area_l, f_plv_l e f_setor_l vêm vazios, e o check()
// os preenche antes do envio. A palavra já gravada traz c igual à posição.
//
// Inferido, e por isso aqui de propósito: que o servidor grave cada grade
// como chegou no oculto. Um envio que mandasse a grade de autores vazia
// apagaria os autores, e é isso que o teste do conector precisa ver
// acontecer quando a operação erra. As áreas e os setores ficam só na
// memória do simulado (não vão para a exportação); sem envio, saem do XML do
// item, pelas tabelas de setores e áreas do simulado.

import { AUTHOR_PART } from '../../src/bridge/production/grids.ts';
import { PRODUCTION_TARGETS } from '../../src/bridge/production/targets/index.ts';
import type { AuthorPart } from '../../src/bridge/production/types.ts';
import { writeFields } from '../../src/bridge/refresh/from-form.ts';
import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import { AREA_CHILDREN, SECTORS } from './buscas.ts';
import type { LattesState } from './estado.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type SimResponse } from './tipos.ts';

type Row = Record<string, string | boolean>;

interface Grids {
  areas: Row[];
  setores: Row[];
}

/** Áreas e setores de cada item, que o XML do simulado não guarda na forma da grade. */
const extra = new WeakMap<XElement, Grids>();

const gridsOf = (item: XElement): Grids => {
  let g = extra.get(item);
  if (!g) {
    g = fromXml(item);
    extra.set(item, g);
  }
  return g;
};

/**
 * As áreas e os setores que o XML do item já tem, como a página do Lattes os
 * mostraria: cada um com o código da tabela do simulado (setorDP e areaDP);
 * o que não está na tabela não aparece, como no Lattes.
 */
function fromXml(item: XElement): Grids {
  const setor = childElements(item, 'SETORES-DE-ATIVIDADE')[0];
  const setores = ['SETOR-DE-ATIVIDADE-1', 'SETOR-DE-ATIVIDADE-2', 'SETOR-DE-ATIVIDADE-3']
    .map((a) => (setor && getAttr(setor, a)) || '')
    .map((l) => SECTORS.find(([, name]) => name === l))
    .filter((x): x is [string, string] => x !== undefined)
    .map(([c, l]) => labelRow(l, c));
  const box = childElements(item, 'AREAS-DO-CONHECIMENTO')[0];
  const areas = (box ? childElements(box) : [])
    .map((el) => {
      const names = [
        'NOME-DA-AREA-DO-CONHECIMENTO',
        'NOME-DA-SUB-AREA-DO-CONHECIMENTO',
        'NOME-DA-ESPECIALIDADE',
      ].map((a) => getAttr(el, a) ?? '');
      const code = areaCodeByNames(names.filter(Boolean));
      const label = names.filter(Boolean).at(-1) ?? '';
      return code && label ? labelRow(label, code) : undefined;
    })
    .filter((r): r is Row => r !== undefined);
  return { areas, setores };
}

/** O código da área pelos nomes do caminho, na tabela de áreas do simulado (buscas.ts). */
function areaCodeByNames(names: string[]): string | undefined {
  for (const children of Object.values(AREA_CHILDREN)) {
    for (const [code, name, below] of children) {
      if (name !== names[0]) continue;
      if (names.length === 1) return code;
      const sub = below.find(([, n]) => n === names[1]);
      if (sub && names.length === 2) return sub[0];
    }
  }
  return undefined;
}

/** Põe áreas e setores ([rótulo, código]) num item, para um teste ver se o envio os preserva. */
export function seedGrids(
  item: XElement,
  grids: { areas?: [string, string][]; setores?: [string, string][] },
): void {
  const g = gridsOf(item);
  if (grids.areas) g.areas = grids.areas.map(([l, c]) => labelRow(l, c));
  if (grids.setores) g.setores = grids.setores.map(([l, c]) => labelRow(l, c));
}

/** Os rótulos das áreas e dos setores guardados para o item. */
export function storedGrids(item: XElement): Grids {
  return gridsOf(item);
}

/**
 * Uma linha com as chaves na ordem da página real: a serialização segue essa
 * ordem, e um literal de objeto teria as chaves reordenadas pelo lint.
 */
const ordered = (...entries: [string, boolean | string][]): Row => Object.fromEntries(entries);

/** Uma linha de área ou setor: l, c, editable. */
const labelRow = (l: string, c: string) => ordered(['l', l], ['c', c], ['editable', false]);

/** A grade de autores, ou de participantes da banca (o elemento que part diz). */
function authorRows(item: XElement, part: AuthorPart, skip?: (author: XElement) => boolean): Row[] {
  return childElements(item, part.element)
    .filter((a) => !skip?.(a))
    .map((a) =>
      ordered(
        ['l', getAttr(a, part.name) ?? ''],
        ['c', getAttr(a, part.cnpq) ?? ''],
        ['t', getAttr(a, part.citation) ?? ''],
        ['editable', false],
        ['deletable', true],
      ),
    );
}

const KEYWORD_ATTRS = Array.from({ length: 6 }, (_, i) => `PALAVRA-CHAVE-${i + 1}`);

function keywordRows(item: XElement): Row[] {
  const kw = childElements(item, 'PALAVRAS-CHAVE')[0];
  const words = KEYWORD_ATTRS.map((a) => (kw && getAttr(kw, a)) ?? '').filter(Boolean);
  return words.map((l, i) => labelRow(l, String(i + 1)));
}

/** Um vetor como a página o escreve: JSON com o objeto vazio no fim. */
const provider = (decl: string, rows: Row[]) =>
  `<script>\n${decl} = \n${JSON.stringify([...rows, {}])};\n</script>`;

/**
 * Os quatro vetores da página de edição de um item. `skip`: os autores do XML
 * que a página não mostra (os depositantes que a exportação copia nos
 * autores, registro-grades.ts).
 */
export function gridScripts(
  item: XElement | undefined,
  part: AuthorPart = AUTHOR_PART,
  skip?: (author: XElement) => boolean,
): string {
  const g = item ? gridsOf(item) : { areas: [], setores: [] };
  return [
    provider('var autorProvider', item ? authorRows(item, part, skip) : []),
    provider('palavraProvider', item ? keywordRows(item) : []),
    provider('areaProvider', g.areas),
    provider('var setorProvider', g.setores),
  ].join('\n');
}

export const GRID_HIDDEN = ['f_autores_l', 'f_plv_l', 'f_setor_l', 'f_area_l']
  .map((n) => h.hidden(n, ''))
  .join('');

const rowsOf = (grid: string) =>
  grid
    .split('@')
    .filter(Boolean)
    .map((r) => r.split('|'));

/** Grava as quatro grades do POST no item, como chegaram. */
export function applyGrids(item: XElement, req: SimRequest, part: AuthorPart = AUTHOR_PART): void {
  // Autores: l|c|t, a ordem das chaves do autorProvider desta página.
  for (const a of childElements(item, part.element)) {
    item.children = item.children.filter((c) => c !== a);
  }
  rowsOf(req.get('f_autores_l') ?? '').forEach(([l = '', c = '', t = ''], i) => {
    insertInSchemaOrder(
      lattesSchema,
      item,
      element(part.element, {
        [part.citation]: t,
        [part.cnpq]: c,
        [part.name]: l,
        [part.order]: String(i + 1),
      }),
    );
  });
  const words = rowsOf(req.get('f_plv_l') ?? '').map(([l = '']) => l);
  let kw = childElements(item, 'PALAVRAS-CHAVE')[0];
  if (words.length && !kw) {
    kw = element('PALAVRAS-CHAVE', {});
    insertInSchemaOrder(lattesSchema, item, kw);
  }
  if (kw) KEYWORD_ATTRS.forEach((a, i) => setAttr(kw!, a, words[i] ?? ''));
  const g = gridsOf(item);
  g.areas = rowsOf(req.get('f_area_l') ?? '').map(([l = '', c = '']) => labelRow(l, c));
  g.setores = rowsOf(req.get('f_setor_l') ?? '').map(([l = '', c = '']) => labelRow(l, c));
}

/** As grades de uma formação: palavras-chave, áreas e setores, sem autores. */
export function applyFormationGrids(item: XElement, req: SimRequest): void {
  const words = rowsOf(req.get('f_plv_l') ?? '').map(([l = '']) => l);
  let kw = childElements(item, 'PALAVRAS-CHAVE')[0];
  if (words.length && !kw) {
    kw = element('PALAVRAS-CHAVE', {});
    insertInSchemaOrder(lattesSchema, item, kw);
  }
  if (kw) KEYWORD_ATTRS.forEach((a, i) => setAttr(kw!, a, words[i] ?? ''));
  const g = gridsOf(item);
  g.areas = rowsOf(req.get('f_area_l') ?? '').map(([l = '', c = '']) => labelRow(l, c));
  g.setores = rowsOf(req.get('f_setor_l') ?? '').map(([l = '', c = '']) => labelRow(l, c));
}

// Trabalho técnico: o POST (o GET está em censo.ts) -------------------------------

/** Os trabalhos técnicos do simulado (os mesmos da lista de censo.ts). */
function techWorks(state: LattesState): XElement[] {
  const container = state.find(['PRODUCAO-TECNICA']);
  return container ? childElements(container, 'TRABALHO-TECNICO') : [];
}

export function techWorkPost(req: SimRequest, state: LattesState): SimResponse {
  const back = h.savedScript(`pkg_relatorio.lista?f_cod=${state.code}`);
  if (req.get('f_ctr') !== 'U') return html(back);
  const item = techWorks(state).find((t) => getAttr(t, 'SEQUENCIA-PRODUCAO') === req.get('f_seq'));
  if (!item) return html(h.page('Trabalhos técnicos', '<p>Registro não encontrado.</p>'));
  writeFields(
    PRODUCTION_TARGETS.find((t) => t.id === 'trabalho-tecnico')!,
    item,
    (field) => req.get(field),
  );
  applyGrids(item, req);
  state.touch();
  return html(back);
}
