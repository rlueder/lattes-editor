// As áreas de atuação no Lattes simulado: a página prc_area_atuacao, com o
// formulário GN_AREA_ATU e o vetor areaProvider, e o POST, que troca a lista
// inteira pelo f_area_l. A forma da página e do envio é a lida no Lattes real
// em 18/10/2026 (docs/lattes_internals.md, seção 18); os códigos das áreas,
// sintéticos (buscas.ts). Uma área fora da tabela do simulado leva um código
// 9999 da própria linha, como as criadas pela pessoa no Lattes.

import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import { AREA_CHILDREN, AREAS } from './buscas.ts';
import type { LattesState } from './estado.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

const bigValue = (label: string) =>
  label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

/** Cada nó da tabela do simulado: o código e os quatro nomes. */
function nodes(): { c: string; names: [string, string, string, string] }[] {
  const out: { c: string; names: [string, string, string, string] }[] = [];
  for (const [bc, bl] of AREAS) {
    const big = bigValue(bl);
    for (const [c, l, subs] of AREA_CHILDREN[bc] ?? []) {
      out.push({ c, names: [big, l, '', ''] });
      for (const [sc, sl] of subs) out.push({ c: sc, names: [big, l, sl, ''] });
    }
  }
  return out;
}

const ATTRS = [
  'NOME-GRANDE-AREA-DO-CONHECIMENTO',
  'NOME-DA-AREA-DO-CONHECIMENTO',
  'NOME-DA-SUB-AREA-DO-CONHECIMENTO',
  'NOME-DA-ESPECIALIDADE',
] as const;

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

function areasOf(state: LattesState): XElement[] {
  const container = state.find(['DADOS-GERAIS', 'AREAS-DE-ATUACAO']);
  return container ? childElements(container, 'AREA-DE-ATUACAO') : [];
}

const label = (el: XElement) =>
  (getAttr(el, ATTRS[3]) || getAttr(el, ATTRS[2]) || getAttr(el, ATTRS[1]) || '').trim();

function codeOf(el: XElement, index: number): string {
  const names = ATTRS.map((a) => fold(getAttr(el, a) ?? ''));
  const hit = nodes().find((n) => n.names.every((v, i) => fold(v) === names[i]));
  return hit?.c ?? `9999${String(index + 1).padStart(4, '0')}`;
}

function form(state: LattesState): SimResponse {
  const rows = areasOf(state).map((el, i) => ({
    c: codeOf(el, i),
    editable: false,
    l: label(el),
    priv: state.privacy.get(el) ?? '1',
    vis: 'Público',
  }));
  const body = `<form name="GN_AREA_ATU" method="post" action="prc_area_atuacao">
${h.hidden('f_cod', state.code)}${h.hidden('f_area_l', '')}${h.hidden('f_ctr', 'I')}${h.hidden('f_setor_prod', '')}${h.hidden('f_privacidade', '')}
</form>
<script>
areaProvider = 
${JSON.stringify([...rows, {}])};
</script>`;
  return html(h.page('Áreas de atuação', body));
}

function post(req: SimRequest, state: LattesState): SimResponse {
  const general = state.find(['DADOS-GERAIS']);
  if (!general || req.get('f_ctr') !== 'I') return html(h.savedScript('PKG_MENU.menu'));
  const old = areasOf(state);
  const lines = (req.get('f_area_l') ?? '').split('@').filter(Boolean);
  const privs = (req.get('f_privacidade') ?? '').split('@');
  const container = state.ensure(general, 'AREAS-DE-ATUACAO');
  container.children = [];
  lines.forEach((line, i) => {
    const [l = '', c = ''] = line.split('|');
    const node = nodes().find((n) => n.c === c);
    // Fora da tabela: a linha que já estava com o mesmo nome (área criada pela pessoa).
    const kept = old.find((el, j) => codeOf(el, j) === c || fold(label(el)) === fold(l));
    const names = node?.names ?? (kept ? ATTRS.map((a) => getAttr(kept, a) ?? '') : null);
    if (!names) return;
    const el = element('AREA-DE-ATUACAO', {
      'SEQUENCIA-AREA-DE-ATUACAO': String(i + 1),
      ...Object.fromEntries(ATTRS.map((a, k) => [a, names[k] ?? ''])),
    });
    state.privacy.set(el, privs[i] || '1');
    insertInSchemaOrder(lattesSchema, container, el);
  });
  state.touch();
  return html(h.savedScript('PKG_MENU.menu'));
}

export const AREAS_ROUTES: Routes = {
  prc_area_atuacao: (req, state) => (req.method === 'POST' ? post(req, state) : form(state)),
};
