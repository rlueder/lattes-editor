// Leituras do HTML do Lattes que não precisam de DOM: links internos com
// parâmetros, a página de login (sessão caída) e o código do currículo.

export interface LattesLink {
  params: Record<string, string>;
  /** Caminho relativo a /cvlattesweb/, como aparece na página. */
  path: string;
  proc: string;
}

/**
 * Links para um procedimento (comparação sem caixa), com &amp; resolvido. Os
 * links aparecem em href, em onclick (setarUrl("…")) e em JavaScript. Um nome
 * terminado em ponto ("pkg_resume.") casa qualquer procedimento do pacote.
 */
export function findLinks(html: string, proc: string): LattesLink[] {
  const escaped = proc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (proc.endsWith('.') ? '\\w+' : '');
  const re = new RegExp(`${escaped}\\?[^'"\\s<>]*`, 'gi');
  const seen = new Set<string>();
  const out: LattesLink[] = [];
  for (const m of html.matchAll(re)) {
    const path = m[0].replace(/&amp;/g, '&').replace(/&quot;.*$/, '');
    if (seen.has(path)) continue;
    seen.add(path);
    const [name, query = ''] = path.split('?');
    const params: Record<string, string> = {};
    for (const part of query.split('&')) {
      const i = part.indexOf('=');
      if (i > 0) params[part.slice(0, i).toLowerCase()] = part.slice(i + 1);
    }
    out.push({ params, path, proc: name! });
  }
  return out;
}

/** A sessão caiu: o Lattes devolve a tela de login (pkg_sec.logon). */
export function isLogonPage(html: string, url = ''): boolean {
  return /pkg_sec\.logon/i.test(url) || /<form[^>]*pkg_sec\.logon/i.test(html);
}

/**
 * Código de 10 caracteres do currículo (o f_cod das chamadas internas). O
 * f_cod do menu é a sessão, com 32 caracteres, e não casa aqui.
 */
export function cvCodeFrom(html: string): string | undefined {
  return /f_cod=([A-Z][0-9A-Z]{9})(?![0-9A-Z])/.exec(html)?.[1];
}
