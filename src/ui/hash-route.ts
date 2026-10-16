// Âncoras legíveis na URL: "#producoes/artigos-completos-publicados/2023".
// O primeiro trecho é a seção; o caminho inteiro é o id do grupo ou do ano.

import { pushHash, replaceHash } from './history-nav.ts';

export interface HashRoute {
  /** Id do elemento para rolar até ele; ausente quando a URL aponta só a seção. */
  anchor?: string;
  sectionId: string;
}

export function parseHash(hash: string): HashRoute | undefined {
  let path = hash.replace(/^#/, '');
  try {
    path = decodeURIComponent(path);
  } catch {
    return undefined;
  }
  const [sectionId, ...rest] = path.split('/').filter(Boolean);
  if (!sectionId) return undefined;
  return rest.length ? { anchor: path, sectionId } : { sectionId };
}

/**
 * Põe a rota na URL. Trocar de seção cria uma entrada no histórico, para
 * voltar e avançar (do navegador ou do app de desktop, history-nav.ts) andarem
 * entre as seções; ir a um grupo ou ano da mesma seção só troca o endereço.
 */
export function writeHash(route: HashRoute): void {
  const target = route.anchor ?? route.sectionId;
  if (location.hash.slice(1) === target) return;
  if (parseHash(location.hash)?.sectionId === route.sectionId) replaceHash(`#${target}`);
  else pushHash(`#${target}`);
}
