// Campos de DOI e de endereço na web: limpeza ao sair do campo, aviso de
// formato e o link na prévia. ISSN e ISBN entram na mesma limpeza e no mesmo
// aviso (src/model/standard-numbers.ts), sem link.
//
// Formato guardado: nenhuma exportação real no repositório mostra um DOI ou
// uma página preenchidos, e o censo LAT-55 (docs/lattes-formularios/) só diz
// que o valor do XML é o mesmo do campo do formulário (HOME-PAGE e
// HOME-PAGE-DO-TRABALHO casam por valor, sem conflito), não se leva
// "https://" nem se o DOI vem com o endereço do doi.org. Por isso o valor é
// guardado como foi digitado, só sem espaços; o link da prévia e o aviso
// leem o valor sem mudá-lo.

import { normalizeDoi } from '../lookups/crossref.ts';
import {
  cleanIsbn,
  cleanIssn,
  isbnError,
  isIsbnAttr,
  isIssnAttr,
  isIssnOrIsbnAttr,
  issnError,
  issnOrIsbnError,
} from '../model/standard-numbers.ts';

/** Atributo de DOI: DOI e qualquer *-DOI. */
export function isDoiAttr(attr: string): boolean {
  return attr === 'DOI' || attr.endsWith('-DOI');
}

/** Atributo de endereço na web: HOME-PAGE, HOME-PAGE-DO-TRABALHO e parecidos. */
export function isUrlAttr(attr: string): boolean {
  return /^HOME-PAGE/.test(attr);
}

/**
 * Padrão de DOI recomendado pelo Crossref, sem diferença de maiúscula. DOI não
 * tem dígito verificador: o padrão só confere a forma, não se o DOI existe.
 */
export const DOI_PATTERN = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;

/** DOI como se guarda: o que foi digitado, sem espaços nas pontas. */
export function cleanDoi(value: string): string {
  return value.trim();
}

/**
 * Aviso de formato do DOI, ou undefined se está bom ou vazio. O mesmo que a
 * conferência antes do envio (src/model/validate.ts) pede: 10.xxxx/…
 */
export function doiError(value: string): string | undefined {
  const v = value.trim();
  if (!v || DOI_PATTERN.test(v)) return undefined;
  const inside = normalizeDoi(v);
  return inside && DOI_PATTERN.test(inside)
    ? `DOI: formato esperado 10.xxxx/… (aqui, ${inside})`
    : 'DOI: formato esperado 10.xxxx/…';
}

/** Endereço do DOI no doi.org, para o link da prévia. */
export function doiLink(value: string): string | undefined {
  const doi = normalizeDoi(value);
  return doi && DOI_PATTERN.test(doi) ? `https://doi.org/${doi}` : undefined;
}

/** Endereço como se guarda: sem espaços, nem nas pontas nem no meio. */
export function cleanUrl(value: string): string {
  return value.replace(/\s+/g, '');
}

/** O endereço com esquema, para abrir: sem esquema, vale https://. */
export function urlForLink(value: string): string {
  const v = cleanUrl(value);
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

/** Aviso de endereço inválido, ou undefined se está bom ou vazio. */
export function urlError(value: string): string | undefined {
  const v = cleanUrl(value);
  if (!v) return undefined;
  let url: URL;
  try {
    url = new URL(urlForLink(v));
  } catch {
    return 'Endereço inválido: confira o domínio (exemplo: www.ufrgs.br)';
  }
  const host = url.hostname;
  if (!/^https?:$/.test(url.protocol) || !host.includes('.') || host === 'localhost') {
    return 'Endereço inválido: confira o domínio (exemplo: www.ufrgs.br)';
  }
  return undefined;
}

/** A limpeza de um campo ao sair dele: DOI, endereço, ISSN e ISBN; os outros passam iguais. */
export function cleanLinkValue(attr: string, value: string): string {
  if (isDoiAttr(attr)) return cleanDoi(value);
  if (isUrlAttr(attr)) return cleanUrl(value);
  if (isIssnAttr(attr)) return cleanIssn(value);
  if (isIsbnAttr(attr)) return cleanIsbn(value);
  if (isIssnOrIsbnAttr(attr)) {
    // Oito caracteres é ISSN (fica com o hífen); o resto, ISBN só com dígitos.
    return cleanIsbn(value).length === 8 ? cleanIssn(value) : cleanIsbn(value);
  }
  return value;
}

/** O aviso de formato de um campo de DOI, endereço, ISSN ou ISBN; undefined nos outros. */
export function linkError(attr: string, value: string): string | undefined {
  if (isDoiAttr(attr)) return doiError(value);
  if (isUrlAttr(attr)) return urlError(value);
  if (isIssnAttr(attr)) return issnError(value);
  if (isIsbnAttr(attr)) return isbnError(value);
  if (isIssnOrIsbnAttr(attr)) return issnOrIsbnError(value);
  return undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * O link da prévia para um valor: DOI vai ao doi.org; e-mail vira mailto:;
 * endereço (pelo atributo, ou pelo valor que começa com http(s):// ou www.)
 * vira link, com https:// quando não há esquema. Undefined quando não é link.
 */
export function linkHref(attr: string, value: string): string | undefined {
  const v = value.trim();
  if (!v) return undefined;
  if (isDoiAttr(attr)) return doiLink(v);
  if (attr === 'E-MAIL') return EMAIL.test(v) ? `mailto:${v}` : undefined;
  if (isUrlAttr(attr) || attr === 'ORCID-ID' || /^(https?:\/\/|www\.)/i.test(v)) {
    return urlError(v) ? undefined : urlForLink(v);
  }
  return undefined;
}

/** Texto do link de endereço, encurtado como na prévia: sem esquema, www. e barra final. */
export function shortUrl(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

/** Um pedaço de texto corrido, com o link quando o pedaço é endereço ou e-mail. */
export interface TextPiece {
  href?: string;
  text: string;
}

/**
 * Corta um texto corrido nos endereços (http(s)://…) e e-mails que ele traz,
 * para cada um virar link: o "DOI: https://doi.org/…" da referência, os
 * e-mails do campo de contatos. A pontuação final (ponto, vírgula) fica fora
 * do link; o texto não muda.
 */
export function linkPieces(text: string): TextPiece[] {
  const re = /https?:\/\/[^\s<>"]+|[^\s@:;,<>"]+@[^\s@;,<>"]+\.[^\s@;,<>"]+/gi;
  const out: TextPiece[] = [];
  let pos = 0;
  for (const m of text.matchAll(re)) {
    let found = m[0];
    const trail = /[.,;:)\]]+$/.exec(found)?.[0] ?? '';
    found = found.slice(0, found.length - trail.length);
    if (!found) continue;
    if (m.index > pos) out.push({ text: text.slice(pos, m.index) });
    out.push({ href: found.includes('://') ? found : `mailto:${found}`, text: found });
    pos = m.index + found.length;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

/** Onde ficam os links num texto: início, fim e destino (de linkPieces). */
export function linkRanges(text: string): { end: number; href: string; start: number }[] {
  let pos = 0;
  return linkPieces(text).flatMap((p) => {
    const start = pos;
    pos += p.text.length;
    return p.href ? [{ end: pos, href: p.href, start }] : [];
  });
}
