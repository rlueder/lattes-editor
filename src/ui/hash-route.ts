// Âncoras legíveis na URL: "#producoes/artigos-completos-publicados/2023".
// O primeiro trecho é a seção; o caminho inteiro é o id do grupo ou do ano.

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

export function writeHash(route: HashRoute): void {
  const target = route.anchor ?? route.sectionId;
  if (location.hash.slice(1) !== target) history.replaceState(null, '', `#${target}`);
}
