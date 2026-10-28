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

/** Atribuição, replace() ou assign() de location apontando para pkg_sec.logon. */
const LOGON_REDIRECT =
  /location(?:\.href)?\s*=\s*["'][^"']*pkg_sec\.logon|location\.(?:replace|assign)\(\s*["'][^"']*pkg_sec\.logon/i;

/** Tags que uma página só de redirecionamento pode ter. Qualquer outra é conteúdo. */
const STUB_TAGS = new Set(['body', 'br', 'head', 'html', 'link', 'meta']);

/**
 * Página que só redireciona: tirando scripts, estilos, título, noscript e
 * comentários (fechados ou não, para uma resposta truncada), não sobra texto
 * nem elemento além da estrutura do documento. Uma página de conteúdo com um
 * script que leva ao login (um botão, um tempo esgotado) tem texto, formulário,
 * frame ou imagem e não conta.
 */
function isRedirectStub(html: string): boolean {
  const rest = html
    .replace(/<(script|style|title|noscript)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '');
  for (const m of rest.matchAll(/<\/?([a-z][\w-]*)/gi)) {
    if (!STUB_TAGS.has(m[1]!.toLowerCase())) return false;
  }
  const text = rest.replace(/<[^>]*>/g, '').replace(/&(?:nbsp|#160|#xa0);/gi, '');
  return text.trim() === '';
}

/**
 * A sessão caiu: o Lattes devolve a tela de login (pkg_sec.logon). Com a
 * sessão vencida, cada página vem como um script que só redireciona
 * (<SCRIPT>location="pkg_sec.logon?f_cod=ini"</SCRIPT>, visto em 14/10/2026); o
 * fetch não roda o script, então o redirecionamento precisa ser lido no HTML.
 * Só a forma com atribuição foi vista; replace() e assign() entram por
 * precaução.
 */
export function isLogonPage(html: string, url = ''): boolean {
  return (
    /pkg_sec\.logon/i.test(url) ||
    /<form[^>]*pkg_sec\.logon/i.test(html) ||
    // Sem cookie de sessão, o menu responde com este alerta antes de mandar
    // para lattes.cnpq.br (visto em 14/10/2026).
    /alert\(\s*["']Problemas na autentica/i.test(html) ||
    (LOGON_REDIRECT.test(html) && isRedirectStub(html))
  );
}

/**
 * Código de 10 caracteres do currículo (o f_cod das chamadas internas). O
 * f_cod do menu é a sessão, com 32 caracteres, e não casa aqui.
 */
export function cvCodeFrom(html: string): string | undefined {
  return /f_cod=([A-Z][0-9A-Z]{9})(?![0-9A-Z])/.exec(html)?.[1];
}

/**
 * O identificador público de 16 dígitos do currículo aberto na sessão, que a
 * página do menu do Lattes mostra no link lattes.cnpq.br/<16 dígitos>
 * (observado em 11/10/2026). É o mesmo NUMERO-IDENTIFICADOR da exportação.
 */
export function lattesIdFrom(html: string): string | undefined {
  return /lattes\.cnpq\.br\/(\d{16})(?!\d)/.exec(html)?.[1];
}

/** A sessão do Lattes é do mesmo currículo que está aberto no editor? */
export function sameCv(editorId: string | undefined, sessionId: string | undefined): boolean {
  return Boolean(editorId && sessionId && editorId === sessionId);
}

/**
 * O erro do banco do Lattes que a resposta de um POST traz no lugar da página
 * ("Erro. ORA-01403: não foram encontrados dados ORA-06512: na
 * FOMENTO.PKG_MANUTENCAO_PROD_UNIFICADA…", observado em 28/10/2026 ao salvar
 * pela própria página um trabalho em eventos que entrou pelo Importar). O
 * comando todo volta atrás: nada do envio fica gravado. Só o primeiro código e
 * a mensagem dele.
 */
export function lattesDbError(html: string): string | undefined {
  const m = /Erro\.?\s*(ORA-\d{5}:[^<]*?)(?=\s*ORA-\d{5}|<|$)/i.exec(html);
  return m?.[1]?.replace(/\s+/g, ' ').trim();
}
