// Dados do cartão de perfil do menu lateral, tirados do documento carregado.

import { firstChild, getAttr, type XDocument } from '../model/xml.ts';

export interface Profile {
  /** DATA-ATUALIZACAO do arquivo carregado (DDMMAAAA). */
  date?: string;
  fileName: string;
  /** NUMERO-IDENTIFICADOR, os 16 dígitos do endereço público do CV. */
  lattesId?: string;
  name: string;
}

export function ownerName(doc: XDocument): string {
  const dg = firstChild(doc.root, 'DADOS-GERAIS');
  return (dg && getAttr(dg, 'NOME-COMPLETO')) || 'Currículo Lattes';
}

export function profileOf(doc: XDocument, fileName: string, date?: string): Profile {
  return {
    date,
    fileName,
    lattesId: getAttr(doc.root, 'NUMERO-IDENTIFICADOR'),
    name: ownerName(doc),
  };
}

/** Iniciais do primeiro e do último nome, pulando "da", "de", "dos". */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w.length > 2 || /^[A-ZÀ-Ý]/.test(w));
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * Código de 10 caracteres do currículo (o `id=` de
 * buscatextual.cnpq.br/buscatextual/visualizacv.do), tirado de um endereço
 * colado ou do próprio código. A exportação não traz esse código.
 */
export function parseCvCode(text: string): string | undefined {
  const t = text.trim();
  const fromUrl = /[?&]id=([A-Za-z][0-9A-Za-z]{9})(?:[&#]|$)/.exec(t);
  if (fromUrl) return fromUrl[1]!.toUpperCase();
  return /^[A-Za-z][0-9A-Za-z]{9}$/.test(t) ? t.toUpperCase() : undefined;
}

/** Foto do currículo no CNPq; só responde com o código de 10 caracteres. */
export function photoUrl(code: string): string {
  return `https://servicosweb.cnpq.br/wspessoa/servletrecuperafoto?tipo=1&id=${encodeURIComponent(code)}`;
}

/** Identificador do currículo sintético das fixtures (scripts/gen-fixtures.ts). */
const EXAMPLE_LATTES_ID = '0000000000000001';

/**
 * Foto de mentira para o currículo de exemplo (pnpm dev:exemplo), que não tem
 * código no CNPq: um retrato fixo do i.pravatar.cc (img=32, escolhido a dedo;
 * o sorteio por identificador pode cair numa foto imprópria). Só no dev; no
 * build, import.meta.env.DEV é false e a função devolve sempre undefined.
 */
export function examplePhotoUrl(lattesId: string | undefined): string | undefined {
  if (!import.meta.env.DEV || lattesId !== EXAMPLE_LATTES_ID) return undefined;
  return 'https://i.pravatar.cc/300?img=32';
}

const CODE_KEY = 'lattes-editor:codigo-cv:';

/** O código fica lembrado no navegador, por identificador de 16 dígitos. */
export function readCvCode(lattesId: string): string | undefined {
  try {
    return localStorage.getItem(CODE_KEY + lattesId) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writeCvCode(lattesId: string, code: string | undefined): void {
  try {
    if (code) localStorage.setItem(CODE_KEY + lattesId, code);
    else localStorage.removeItem(CODE_KEY + lattesId);
  } catch {
    // Sem armazenamento: vale até recarregar a página.
  }
}
