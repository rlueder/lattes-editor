// Áreas de atuação (prc_area_atuacao, GN_AREA_ATU; docs/lattes_internals.md,
// seção 22): a grade areaProvider da página, uma linha por área com o código
// do nó, de volta para as quatro partes do nome pela árvore de áreas do menu
// (areaDP), na ordem da página.

import { element, setAttr } from '../../../model/xml.ts';
import { findLinks } from '../../lattes-html.ts';
import { parseAreaTree } from '../../lattes-lists.ts';
import { readProvider } from '../../production/grids.ts';
import { AREA_ATTRS, areaPath } from '../areas.ts';
import type { LoadContext, LoadSection } from '../loader.ts';
import { ensurePath, place } from './common.ts';

const SECTION = 'Áreas de atuação';

async function load(ctx: LoadContext): Promise<void> {
  const link = findLinks(ctx.menu, 'prc_area_atuacao')[0];
  if (!link) {
    ctx.gap(SECTION, 'o menu não tem as áreas de atuação');
    return;
  }
  const html = (await ctx.fetch([link.path])).get(link.path);
  const rows = html
    ? readProvider(html, 'areaProvider')?.filter((r) => typeof r.l === 'string' && r.l.trim())
    : undefined;
  if (!rows) {
    ctx.gap(SECTION, 'a página não trouxe a grade de áreas');
    return;
  }
  if (rows.length === 0) return;
  const tree = parseAreaTree(ctx.menu) ?? [];
  const container = ensurePath(ctx.root, ['DADOS-GERAIS', 'AREAS-DE-ATUACAO']);
  rows.forEach((row, i) => {
    const path = areaPath(tree, String(row.c ?? ''));
    if (!path) {
      ctx.gap(SECTION, 'área fora da árvore de áreas do Lattes');
      return;
    }
    const el = element('AREA-DE-ATUACAO', { 'SEQUENCIA-AREA-DE-ATUACAO': String(i + 1) });
    for (const [key, attr] of Object.entries(AREA_ATTRS) as [keyof typeof path, string][]) {
      setAttr(el, attr, path[key]);
    }
    place(container, el);
  });
}

export const AREAS_ATUACAO: LoadSection = { id: 'areas-atuacao', load };
