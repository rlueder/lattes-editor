// Participação em eventos (pkg_evento.lista, a geral e a de divulgação
// científica; PKG_EVENTO.form, GN_TEC): o tipo do evento pela natureza
// (F_COD_PROD; o rótulo da opção é a NATUREZA do XML, observado em A31 e A35),
// a forma de participação pelo rádio F_FORMA e os campos pelas tabelas do
// conector (edit-items.ts) ao contrário. O número do item é o f_seq.
//
// O tipo de participação (F_TPO) a página monta por script depois de abrir
// (montaTipoApres); quando o HTML não traz a opção escolhida, ele fica de fora
// e vai para o que não foi lido.

import { emptyAttrs, newItem } from '../../../model/production.ts';
import { setAttr, type XElement } from '../../../model/xml.ts';
import { lattesSchema } from '../../../schema/lattes.ts';
import {
  EVENT_BASICS_FIELDS,
  EVENT_CODES,
  EVENT_DETAIL_FIELDS,
  EVENT_NATURE_LABELS,
  FORMA_CODES,
} from '../../edit-items.ts';
import type { LoadContext, LoadSection } from '../loader.ts';
import { readTable } from '../reverse.ts';
import { ensurePath, formIn, listsOf, place, rowLinks } from './common.ts';

const SECTION = 'Participação em eventos';

const ELEMENT_OF = Object.fromEntries(Object.entries(EVENT_CODES).map(([el, c]) => [c, el]));
const FORMA_OF = Object.fromEntries(Object.entries(FORMA_CODES).map(([x, c]) => [c, x]));

const partName = (item: string, kind: 'DADOS-BASICOS' | 'DETALHAMENTO') =>
  `${kind}-${item.startsWith('OUTRAS-') ? 'DE' : 'DA'}-${item}`;

function part(item: XElement, name: string): XElement {
  const el = ensurePath(item, [name]);
  if (el.attrs.length === 0) el.attrs = emptyAttrs(lattesSchema, name).map((a) => ({ ...a }));
  return el;
}

async function load(ctx: LoadContext): Promise<void> {
  const links = rowLinks(listsOf(ctx, 'pkg_evento.lista'), 'pkg_evento.form');
  if (links.length === 0) return;
  const pages = await ctx.fetch(links.map((l) => l.path));
  const container = ensurePath(ctx.root, [
    'DADOS-COMPLEMENTARES',
    'PARTICIPACAO-EM-EVENTOS-CONGRESSOS',
  ]);
  for (const link of links) {
    const v = formIn(ctx, pages.get(link.path), link.path, ['GN_TEC'])?.values;
    if (!v) {
      ctx.gap(SECTION, 'o formulário do item não abriu');
      continue;
    }
    const code = v.F_COD_PROD ?? '';
    const name = ELEMENT_OF[code];
    if (!name) {
      ctx.gap(SECTION, 'a natureza do evento não foi reconhecida');
      continue;
    }
    const item = newItem(lattesSchema, name, Number(v.f_seq || link.params.f_seq) || 0);
    const basics = part(item, partName(name, 'DADOS-BASICOS'));
    const detail = part(item, partName(name, 'DETALHAMENTO'));
    const unread = [
      ...readTable(basics, EVENT_BASICS_FIELDS, v),
      ...readTable(detail, EVENT_DETAIL_FIELDS, v),
    ];
    if (unread.length > 0) ctx.gap(SECTION, `valor sem opção (${unread.join(', ')})`);
    setAttr(basics, 'NATUREZA', EVENT_NATURE_LABELS[code] ?? '');
    const forma = FORMA_OF[v.F_FORMA ?? ''] ?? '';
    setAttr(basics, 'FORMA-PARTICIPACAO', forma);
    if (v.F_TPO) setAttr(basics, 'TIPO-PARTICIPACAO', v.F_TPO);
    else if (forma && forma !== 'Ouvinte') {
      ctx.gap(SECTION, 'o tipo de participação, que a página monta por script');
    }
    place(container, item);
  }
}

export const EVENTOS: LoadSection = { id: 'eventos', load };
