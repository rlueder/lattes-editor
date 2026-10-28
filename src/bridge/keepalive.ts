// A sessão do Lattes viva enquanto o editor está aberto: a extensão pede uma
// página pequena do Lattes de tempos em tempos (docs/lattes_internals.md,
// seção 7). Só com o app ligado, o aviso aceito, a aba do menu aberta e nada
// mais usando a aba; depois que a sessão cai, para até o menu carregar de novo.

/** Intervalo entre os pedidos. */
export const KEEPALIVE_MS = 20 * 60_000;

/**
 * A menor página da sessão medida em 27/10/2026 (cerca de 4 KB, lista de
 * linhas de pesquisa): como toda página do cvlattesweb, responde com o
 * redirecionamento ao login quando a sessão venceu.
 */
export const KEEPALIVE_PAGE = 'pkg_linhapesq.lista';

/** Onde a extensão guarda o estado (chrome.storage.session, some ao fechar o navegador). */
export const KEEPALIVE_KEY = 'lattes-editor:keepalive';

export interface KeepaliveState {
  /** Quando foi o último pedido (ms). */
  at?: number;
  /** A sessão caiu no último pedido: para até o menu carregar de novo. */
  dead?: boolean;
}

/** Hora de pedir de novo? */
export function keepaliveDue(
  state: KeepaliveState,
  now: number,
  ready: { appConnected: boolean; busy: boolean; consent: boolean; tab: boolean },
): boolean {
  if (!ready.appConnected || !ready.consent || !ready.tab || ready.busy || state.dead) return false;
  return state.at === undefined || now - state.at >= KEEPALIVE_MS;
}
