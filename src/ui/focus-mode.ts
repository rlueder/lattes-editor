// Modo foco (protótipo, com ?leitura): só o conteúdo e o índice "Nesta
// seção". O menu de seções e o cabeçalho saem de cena e voltam por cima do
// conteúdo quando o ponteiro encosta na borda (como no iA Writer), quando o
// foco do teclado entra neles ou pelo puxador na borda, em tela de toque.
// Aqui fica a lógica sem React: a escolha guardada, o atalho e a borda.

/** Chave da escolha neste aparelho. */
export const FOCUS_KEY = 'lattes-editor:modo-foco';

type ReadStore = Pick<Storage, 'getItem'>;
type WriteStore = Pick<Storage, 'setItem'>;

function defaultStore(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** O modo foco estava ligado neste aparelho; sem armazenamento, desligado. */
export function readFocusMode(store: ReadStore | undefined = defaultStore()): boolean {
  try {
    return store?.getItem(FOCUS_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeFocusMode(on: boolean, store: WriteStore | undefined = defaultStore()): void {
  try {
    store?.setItem(FOCUS_KEY, on ? '1' : '0');
  } catch {
    // Sem armazenamento (janela privada): vale até recarregar.
  }
}

export interface KeyLike {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}

/**
 * ⌘⇧F no Mac, Ctrl+Shift+F nos outros. Livre no editor, que usa ⌘K, G e uma
 * letra, ⌘Enter e E (docs/estilo_da_interface.md, "Teclado"). Não conferido
 * em todos os navegadores.
 */
export function isFocusShortcut(e: KeyLike, mac: boolean): boolean {
  const mod = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  return mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f';
}

export function focusShortcutLabel(mac: boolean): string {
  return mac ? '⌘⇧F' : 'Ctrl+Shift+F';
}

/**
 * Borda que revela: faixa de 16px (em cima e à esquerda), espera de 150ms e
 * 24px de folga para sair do painel. A espera é a guarda contra a barra do
 * navegador: passar pela faixa a caminho das abas não abre o cabeçalho; só
 * parar ou andar dentro dela por 150ms.
 */
export const EDGE = { delay: 150, slack: 24, zone: 16 } as const;

export interface EdgeState {
  /**
   * Escolher uma seção no painel revelado fecha o painel; com o ponteiro
   * ainda na faixa da borda, ele só volta depois de o ponteiro sair da faixa
   * e voltar a ela.
   */
  blocked?: boolean;
  left: boolean;
  /** Desde quando o ponteiro está na faixa da esquerda (ainda sem revelar). */
  leftSince?: number;
  top: boolean;
  topSince?: number;
}

export const NO_EDGE: EdgeState = { left: false, top: false };

/** Os painéis fechados depois de uma escolha, sem reabrir com o ponteiro parado na borda. */
export const DISMISSED: EdgeState = { blocked: true, left: false, top: false };

export interface PointerAt {
  /** Instante, em ms. */
  t: number;
  x: number;
  y: number;
}

/** Tamanho dos painéis revelados: largura do menu e altura do cabeçalho. */
export interface PanelSize {
  left: number;
  top: number;
}

/**
 * O próximo estado das bordas. Um painel aparece quando o ponteiro fica na
 * faixa da borda pelo tempo de espera (passar rápido pela borda não abre) e
 * some quando o ponteiro sai dele com folga.
 */
export function nextEdge(s: EdgeState, p: PointerAt, panels: PanelSize): EdgeState {
  // Fechado por uma escolha: fica fechado até o ponteiro sair das faixas.
  if (s.blocked) return p.x > EDGE.zone && p.y > EDGE.zone ? NO_EDGE : DISMISSED;
  const side = (
    open: boolean,
    since: number | undefined,
    pos: number,
    size: number,
  ): { open: boolean; since?: number } => {
    if (open) return pos > size + EDGE.slack ? { open: false } : { open: true };
    if (pos > EDGE.zone) return { open: false };
    const start = since ?? p.t;
    return p.t - start >= EDGE.delay ? { open: true } : { open: false, since: start };
  };
  const l = side(s.left, s.leftSince, p.x, panels.left);
  const t = side(s.top, s.topSince, p.y, panels.top);
  return { left: l.open, leftSince: l.since, top: t.open, topSince: t.since };
}

/** Quanto falta para uma borda armada abrir, para reavaliar sem novo movimento. */
export function edgeWait(s: EdgeState, now: number): number | undefined {
  const waits = [s.leftSince, s.topSince]
    .filter((v): v is number => v !== undefined)
    .map((since) => Math.max(0, EDGE.delay - (now - since)));
  return waits.length ? Math.min(...waits) : undefined;
}

/**
 * Classes da moldura: o modo foco e os painéis à mostra, pela borda, pelo
 * puxador (toque) ou pelo atalho temporário (⌘K mostra o cabeçalho).
 */
export function shellClass(focus: boolean, reveal: { left: boolean; top: boolean }): string {
  if (!focus) return 'shell';
  return ['shell', 'is-focus', reveal.left && 'reveal-left', reveal.top && 'reveal-top']
    .filter(Boolean)
    .join(' ');
}
