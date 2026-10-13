// No app de desktop, um link para fora do editor (Chrome Web Store, página
// de lançamentos, currículo no Lattes) abre no navegador padrão, pelo plugin
// opener do Tauri. Sem isso, a janela do app ignora o link ou navega para
// longe do editor. No navegador, nada muda.

/** Esquemas que o plugin abre (a permissão opener:allow-default-urls). */
const SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/** Um endereço que sai do editor: outro site, e-mail ou telefone. */
export function isExternalHref(href: string, origin: string): boolean {
  try {
    const url = new URL(href, origin);
    return SCHEMES.has(url.protocol) && url.origin !== origin;
  } catch {
    return false;
  }
}

/** O link clicado, se for para fora; undefined para o resto dos cliques. */
export function externalLinkOf(
  event: Pick<MouseEvent, 'button' | 'defaultPrevented' | 'target'>,
  origin: string,
): string | undefined {
  if (event.defaultPrevented || event.button !== 0) return undefined;
  // O clique pode ser num ícone ou texto dentro do link: vale o <a> mais próximo.
  const target = event.target as Partial<Pick<Element, 'closest'>> | null;
  const anchor = target?.closest?.('a[href]') as { href?: unknown } | null | undefined;
  const href = anchor?.href;
  return typeof href === 'string' && isExternalHref(href, origin) ? href : undefined;
}

/**
 * Abre um endereço fora do editor a partir de um botão (sem <a>): no app de
 * desktop, pelo plugin opener; no navegador, numa aba nova.
 */
export function openExternal(url: string): void {
  if (!('__TAURI_INTERNALS__' in window)) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void import('@tauri-apps/api/core')
    .then(({ invoke }) => invoke('plugin:opener|open_url', { url }))
    .catch((err: unknown) => console.error('Link externo não abriu:', err));
}

/** Liga a interceptação no documento inteiro; devolve como desligar. */
export function openExternalLinksNatively(): () => void {
  const onClick = (event: MouseEvent) => {
    const url = externalLinkOf(event, location.origin);
    if (!url) return;
    event.preventDefault();
    void import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke('plugin:opener|open_url', { url }))
      .catch((err: unknown) => console.error('Link externo não abriu:', err));
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
