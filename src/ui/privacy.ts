// Modo de privacidade da página Dados gerais: esconde os dados pessoais
// sensíveis (documentos, nascimento, filiação, endereço residencial) para
// mostrar a tela a alguém ou compartilhá-la sem expor o currículo inteiro.

import { createContext, useContext } from 'react';

/** Atributos sensíveis de DADOS-GERAIS (LGPD: documentos, filiação, raça, deficiência). */
const SENSITIVE_PERSONAL = new Set([
  'CPF',
  'NUMERO-DO-PASSAPORTE',
  'NUMERO-IDENTIDADE',
  'ORGAO-EMISSOR',
  'UF-ORGAO-EMISSOR',
  'DATA-DE-EMISSAO',
  'DATA-NASCIMENTO',
  'CIDADE-NASCIMENTO',
  'UF-NASCIMENTO',
  'PAIS-DE-NASCIMENTO',
  'NOME-DO-PAI',
  'NOME-DA-MAE',
  'SEXO',
  'RACA-OU-COR',
  'PCD',
  'DATA-FALECIMENTO',
]);

/** O endereço residencial inteiro é sensível; o profissional aparece no currículo público. */
export function isSensitiveAttr(element: string, attr: string): boolean {
  if (element === 'ENDERECO-RESIDENCIAL') return true;
  return element === 'DADOS-GERAIS' && SENSITIVE_PERSONAL.has(attr);
}

export const PrivacyContext = createContext(false);

/** Verdadeiro quando os campos sensíveis devem aparecer mascarados. */
export function useHideSensitive(): boolean {
  return useContext(PrivacyContext);
}

const KEY = 'lattes-editor:privacidade';

export function readHideSensitive(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function writeHideSensitive(hide: boolean): void {
  try {
    localStorage.setItem(KEY, hide ? '1' : '0');
  } catch {
    // Sem armazenamento: vale até recarregar a página.
  }
}
