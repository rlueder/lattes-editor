// O que mudou no Lattes desde a exportação carregada: compara os itens
// numerados da página de conferência (src/bridge/espelho.ts) com as produções
// e os eventos da exportação. Como o Exportar recusa enquanto há pendência
// (docs/lattes_internals.md, seção 10), a exportação é uma versão publicada,
// e a diferença é o que foi feito no Lattes depois dela.
//
// Compara títulos, não campos: um item cujo título aparece na linha da página
// conta como presente nos dois lados, mesmo que o ano ou um autor tenha mudado.

import type { EspelhoItem } from '../bridge/espelho.ts';
import { childElements, firstChild, getAttr, walk, type XElement } from '../model/xml.ts';
import { itemMeta } from '../ui/item-meta.ts';
import { normalizeTitle } from './consistency.ts';

/** Títulos mais curtos que isto casariam com qualquer linha; não são comparados. */
const MIN_TITLE = 4;

export interface EspelhoDiff {
  /** Itens da exportação com título curto ou vazio demais para comparar. */
  skipped: number;
  /** Itens da exportação cujo título não está na página: tirados ou renomeados no Lattes. */
  onlyInExport: { item: XElement; title: string }[];
  /** Itens da página sem título correspondente na exportação: incluídos no Lattes. */
  onlyInLattes: EspelhoItem[];
}

/**
 * As produções e eventos que a página mostra em "Produção" e "Eventos":
 * produção bibliográfica, técnica e participação em eventos.
 */
export function comparableItems(root: XElement): XElement[] {
  const items: XElement[] = [];
  const containers = [
    firstChild(root, 'PRODUCAO-BIBLIOGRAFICA'),
    firstChild(root, 'PRODUCAO-TECNICA'),
    firstChild(
      firstChild(root, 'DADOS-COMPLEMENTARES') ?? root,
      'PARTICIPACAO-EM-EVENTOS-CONGRESSOS',
    ),
  ].filter((el): el is XElement => el !== undefined);
  for (const c of containers) {
    walk(c, (el) => {
      if (getAttr(el, 'SEQUENCIA-PRODUCAO') !== undefined && childElements(el).length > 0) {
        items.push(el);
      }
    });
  }
  return items;
}

export function diffEspelho(lattes: EspelhoItem[], root: XElement): EspelhoDiff {
  const exported = comparableItems(root).map((item) => {
    const title = itemMeta(item).title;
    return { item, key: normalizeTitle(title), title };
  });
  const comparable = exported.filter((e) => e.key.length >= MIN_TITLE);
  const matched = new Set<number>();
  const onlyInLattes: EspelhoItem[] = [];
  for (const line of lattes) {
    const text = ` ${normalizeTitle(line.text)} `;
    // Cada linha casa com um item só, para duplicatas contarem certo.
    const hit = comparable.findIndex((e, i) => !matched.has(i) && text.includes(` ${e.key} `));
    if (hit >= 0) matched.add(hit);
    else onlyInLattes.push(line);
  }
  return {
    onlyInExport: comparable
      .filter((_, i) => !matched.has(i))
      .map(({ item, title }) => ({ item, title })),
    onlyInLattes,
    skipped: exported.length - comparable.length,
  };
}
