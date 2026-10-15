// O filtro de período das seções: cada registro vale pelos anos que mostra na
// coluna da esquerda. Item com início vai do início ao fim, e o que ainda
// está em andamento vale até o ano corrente; item pontual vale pelo seu ano;
// item só com o ano de fim, por esse ano.

import { childElements, getAttr, type XElement } from '../model/xml.ts';
import { END_ATTRS, itemMeta } from './item-meta.ts';
import type { YearRange } from './year-range.ts';

export function recordYears(el: XElement, now: number): undefined | YearRange {
  const meta = itemMeta(el);
  if (meta.start) {
    const to = meta.current ? now : (meta.end?.year ?? meta.start.year);
    return { from: meta.start.year, to: Math.max(meta.start.year, to) };
  }
  const year = meta.year ?? endOnly(el);
  return year === undefined ? undefined : { from: year, to: year };
}

/** Ano de fim de um item sem ano de início (formação só com o ano de conclusão). */
function endOnly(el: XElement): number | undefined {
  for (const h of [el, ...childElements(el).filter((c) => c.name.startsWith('DADOS-BASICOS'))]) {
    for (const attr of END_ATTRS) {
      const v = getAttr(h, attr);
      if (v && /^\d{4}$/.test(v)) return Number(v);
    }
  }
  return undefined;
}

/** O registro tem algum ano dentro do período. Sem ano nenhum, fica de fora. */
export function inYears(el: XElement, range: YearRange, now: number): boolean {
  const r = recordYears(el, now);
  return r !== undefined && r.from <= range.to && r.to >= range.from;
}

/** Primeiro e último ano dos registros, para os limites do seletor; undefined sem anos. */
export function yearBounds(items: XElement[], now: number): undefined | YearRange {
  const spans = items.flatMap((el) => recordYears(el, now) ?? []);
  if (spans.length === 0) return undefined;
  return {
    from: Math.min(...spans.map((s) => s.from)),
    to: Math.max(now, ...spans.map((s) => s.to)),
  };
}
