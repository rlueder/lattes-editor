import { childElements, type XElement } from '../model/xml.ts';

/** Linha de resumo de um item: título ou nome, mais o ano. */
export function summarize(el: XElement): string {
  const sources = [el, ...childElements(el).filter((c) => c.name.startsWith('DADOS-BASICOS'))];
  const pick = (test: (name: string) => boolean) => {
    for (const s of sources) {
      const hit = s.attrs.find((a) => test(a.name) && a.value.trim() !== '');
      if (hit) return hit.value;
    }
    return undefined;
  };
  const title =
    pick((n) => n.startsWith('TITULO') && !n.endsWith('INGLES')) ??
    pick((n) => n.startsWith('NOME') && !n.endsWith('INGLES')) ??
    pick((n) => n.startsWith('DESCRICAO'));
  const year = pick((n) => /^ANO($|-)/.test(n));
  return [title, year].filter(Boolean).join(' · ');
}
