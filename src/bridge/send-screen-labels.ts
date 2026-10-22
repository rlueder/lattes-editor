// Textos da tela de envio do Lattes que a leitura de formulários (html-scan.ts)
// não liga ao controle certo: o rótulo de cada rádio num <label for> e o texto
// do link do Termo de Uso, que fica no fim do texto da declaração (lido em
// 21/10/2026, pkg_publicar.mostrar_cv).

import { plainText } from './html-text.ts';

/** O texto do link do Termo de Uso na tela, como a leitura do rótulo o pega. */
export function termsText(html: string): string | undefined {
  for (const m of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi)) {
    const text = plainText(m[1] ?? '').trim();
    if (/termo\s+de\s+uso/i.test(text)) return text;
  }
  return undefined;
}

/** O texto de cada <label for="id">, pelo id. */
export function labelsFor(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(
    /<label\b[^>]*\bfor\s*=\s*["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/label\s*>/gi,
  )) {
    out.set(m[1]!, plainText(m[2] ?? '').trim());
  }
  return out;
}

/** O id de cada rádio de um nome, pelo valor. */
export function radioIdsOf(html: string, name: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = (a: string) =>
      new RegExp(`\\b${a}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
    const n = attr('name');
    if ((n?.[1] ?? n?.[2] ?? n?.[3])?.toLowerCase() !== name) continue;
    const id = attr('id');
    const value = attr('value');
    const idText = id?.[1] ?? id?.[2] ?? id?.[3];
    const valueText = value?.[1] ?? value?.[2] ?? value?.[3];
    if (idText && valueText !== undefined) out.set(valueText, idText);
  }
  return out;
}
