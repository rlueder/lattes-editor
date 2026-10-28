// As produções, orientações, bancas, patentes, registros, demais trabalhos e
// licenças, pelos alvos do motor de alteração (src/bridge/production/targets/):
// cada linha das listas do tipo abre o formulário de alteração, e o
// formulário volta ao XML pela especificação do alvo, ao contrário
// (refresh/apply-reading.ts). Numa lista com mais de um tipo (orientações,
// bancas, livros e capítulos), a natureza do formulário diz qual.
//
// O número do item é o f_seq do link, o do servidor: é com ele que o conector
// acha o item depois. Projetos e linhas de pesquisa ficam dentro de uma
// atuação e são lidos com ela (atuacao.ts).

import { emptyAttrs, newItem, pruneEmptyExtras } from '../../../model/production.ts';
import { element, getAttr, setAttr, type XElement } from '../../../model/xml.ts';
import { lattesSchema } from '../../../schema/lattes.ts';
import { parseAreaTree } from '../../lattes-lists.ts';
import type { ProductionTarget } from '../../production/types.ts';
import { applyReading } from '../../refresh/apply-reading.ts';
import { refreshGroups } from '../../refresh/coverage.ts';
import { ensurePart, partOf } from '../../refresh/from-form.ts';
import { targetOf } from '../../refresh/merge.ts';
import { setItemAreas } from '../areas.ts';
import { fillEmptyChoices } from '../fill.ts';
import type { LoadContext, LoadSection } from '../loader.ts';
import { readHolders, readPatentDates } from '../registry.ts';
import { ensurePath, formIn, listsOf, place, rowLinks } from './common.ts';
import { schemaPath } from './schema-path.ts';

/** Os tipos lidos dentro da atuação (atuacao.ts). */
const IN_ATUACAO = new Set(['linha-de-pesquisa', 'projeto']);

/** Um item vazio do tipo: com SEQUENCIA-PRODUCAO quando o tipo a tem. */
function blank(t: ProductionTarget, seq: string): XElement {
  const spec = lattesSchema.elements[t.element];
  if (spec?.attributes.some((a) => a.name === 'SEQUENCIA-PRODUCAO')) {
    return newItem(lattesSchema, t.element, Number(seq) || 0);
  }
  return element(t.element, emptyAttrs(lattesSchema, t.element));
}

/**
 * O ano que a página não mostra e o check() tira da data (t.year.fallback: o
 * programa com registro e o desenho industrial), como a busca do item na lista
 * faz (production/locate.ts). Que o Lattes guarde esse ano no XML é inferido.
 */
function yearFromDate(t: ProductionTarget, item: XElement, values: Record<string, string>): void {
  if (!t.year?.fallback) return;
  const part = partOf(item, t.year.child);
  if (part && getAttr(part, t.year.attr)) return;
  const year = /^\d{2}\/\d{2}\/(\d{4})$/.exec((values[t.year.fallback] ?? '').trim())?.[1];
  if (year) setAttr(part ?? ensurePart(item, t.year.child), t.year.attr, year);
}

async function load(ctx: LoadContext): Promise<void> {
  const tree = parseAreaTree(ctx.menu) ?? [];
  for (const group of refreshGroups()) {
    const targets = group.targets.filter((t) => !IN_ATUACAO.has(t.id));
    if (targets.length === 0) continue;
    const first = targets[0]!;
    const pages = listsOf(ctx, first.list.proc, first.list.params);
    // Uma lista com mais de um tipo pode abrir formulários diferentes (livro e capítulo).
    const links = [
      ...new Map(
        targets
          .flatMap((t) => rowLinks(pages, t.list.formProc, t.list.isRow))
          .map((l) => [l.path.toLowerCase(), l]),
      ).values(),
    ];
    if (links.length === 0) continue;
    const html = await ctx.fetch(links.map((l) => l.path));
    const names = [...new Set(targets.map((t) => t.form.name))];
    for (const link of links) {
      const reading = formIn(ctx, html.get(link.path), link.path, names);
      if (!reading?.values) {
        ctx.gap(group.label, 'o formulário do item não abriu');
        continue;
      }
      // O nome do formulário separa os tipos que o têm diferente (livro e capítulo);
      // a natureza, os que o dividem (orientações, bancas).
      const byForm = targets.filter((x) => x.form.name === reading.form);
      const t = targetOf(byForm.length ? byForm : targets, reading.values);
      if (!t) {
        ctx.gap(group.label, 'o tipo do item não foi reconhecido no formulário');
        continue;
      }
      const path = schemaPath(t.element);
      if (!path) {
        ctx.gap(group.label, 'o tipo não tem lugar no currículo');
        continue;
      }
      const item = blank(t, link.params.f_seq ?? '');
      applyReading(t, item, reading, { fresh: true });
      fillEmptyChoices(t, item, reading.values);
      yearFromDate(t, item, reading.values);
      // As áreas pela árvore do menu (a leitura da alteração não as refaz).
      const areaRows = reading.grids?.f_area_l;
      if (t.grids.includes('f_area_l') && areaRows) {
        const unknown = setItemAreas(item, areaRows, tree);
        if (unknown.length > 0)
          ctx.gap(group.label, 'área fora da árvore de áreas do Lattes', unknown.length);
      }
      // Depositantes e, na patente, as situações com as datas (registry.ts).
      const page = html.get(link.path) ?? '';
      const more = readHolders(t, item, page);
      if (more > 0) ctx.gap(group.label, 'depositante além do primeiro', more);
      if (t.id === 'patente') {
        const unknown = readPatentDates(item, page);
        if (unknown.length > 0)
          ctx.gap(group.label, 'situação da patente sem data conhecida', unknown.length);
      }
      pruneEmptyExtras(item);
      place(ensurePath(ctx.root, path), item);
    }
  }
}

export const PRODUCAO: LoadSection = { id: 'producao', load };
