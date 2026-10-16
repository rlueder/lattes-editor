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
// memória do simulado (não vão para a exportação).

import { AUTHOR_PART } from '../../src/bridge/production/grids.ts';
import { PRODUCTION_TARGETS } from '../../src/bridge/production/targets/index.ts';
import type { AuthorPart } from '../../src/bridge/production/types.ts';
import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import type { LattesState } from './estado.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { writeFields } from './producao.ts';
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
    g = { areas: [], setores: [] };
    extra.set(item, g);
  }
  return g;
};

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
function authorRows(item: XElement, part: AuthorPart): Row[] {
  return childElements(item, part.element).map((a) =>
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

/** Os quatro vetores da página de edição de um item. */
export function gridScripts(item: XElement | undefined, part: AuthorPart = AUTHOR_PART): string {
  const g = item ? gridsOf(item) : { areas: [], setores: [] };
  return [
    provider('var autorProvider', item ? authorRows(item, part) : []),
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
    req,
  );
  applyGrids(item, req);
  state.touch();
  return html(back);
}
