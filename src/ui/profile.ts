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
