// Textos da tela de envio do Lattes que a leitura de formulários (html-scan.ts)
// não liga ao controle certo: o rótulo de cada rádio num <label for> e o texto
// do link do Termo de Uso, que fica no fim do texto da declaração (lido em
// 21/10/2026, pkg_publicar.mostrar_cv).

import { plainText } from './html-text.ts';

/** Espaços juntados, para comparar textos lidos por caminhos diferentes. */
export const squash = (t: string) => t.replace(/\s+/g, ' ').trim();

/** O trecho do formulário publicar, onde ficam a declaração e o link do termo. */
export function publicarForm(html: string): string {
  const m = /<form\b[^>]*\bname\s*=\s*["']?publicar["']?[^>]*>([\s\S]*?)<\/form\s*>/i.exec(html);
  return m?.[1] ?? '';
}

/** O texto do link do Termo de Uso dentro do formulário publicar. */
export function termsText(html: string): string | undefined {
  for (const m of publicarForm(html).matchAll(/<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi)) {
    const text = squash(plainText(m[1] ?? ''));
    if (/termo\s+de\s+uso/i.test(text)) return text;
  }
  return undefined;
}

/**
 * Um atributo da tag: o nome tem de vir depois de um espaço, para data-id não
 * passar por id nem data-name por name.
 */
function attrOf(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

/** O texto de cada <label for="id">, pelo id. */
export function labelsFor(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label\s*>/gi)) {
    const id = attrOf(` ${m[1] ?? ''}`, 'for');
    if (id) out.set(id, plainText(m[2] ?? '').trim());
  }
  return out;
}

/** O id de cada rádio de um nome, pelo valor. */
export function radioIdsOf(html: string, name: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = m[0];
    if (attrOf(tag, 'name')?.toLowerCase() !== name) continue;
    const id = attrOf(tag, 'id');
    const value = attrOf(tag, 'value');
    if (id && value !== undefined) out.set(value, id);
  }
  return out;
}
