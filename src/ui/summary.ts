import type { XElement } from '../model/xml.ts';
import { formatPeriod, itemMeta } from './item-meta.ts';

/** Linha de resumo de um item: título ou nome, mais o período ou o ano. */
export function summarize(el: XElement): string {
  const meta = itemMeta(el);
  return [meta.title, formatPeriod(meta)].filter(Boolean).join(' · ');
}
