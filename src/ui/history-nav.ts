// Voltar e avançar no app de desktop, que não tem os botões do navegador. A
// navegação já mora no hash da URL (seções, grupos, Panorama). A API de
// histórico não diz se há para onde voltar ou avançar, então cada entrada
// leva a própria posição no `history.state` ({ navIndex }), e a maior posição
// alcançada diz se há o que avançar. Toda escrita no histórico passa por
// pushHash e replaceHash, para a posição não se perder; uma entrada nova que
// chegue sem posição (um link "#..." seguido pelo próprio navegador) ganha a
// próxima na hora.

/** Onde se está no histórico desta janela e até onde ele vai. */
export interface NavPosition {
  index: number;
  max: number;
}

const INDEX_KEY = 'navIndex';
const MAX_STORE_KEY = 'lattes-editor:historico-max';

/** A posição gravada numa entrada do histórico; undefined se ela não tem. */
export function indexOf(state: unknown): number | undefined {
  if (typeof state !== 'object' || state === null) return undefined;
  const value = (state as Record<string, unknown>)[INDEX_KEY];
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

/** O estado da entrada com a posição, mantendo o que mais houver nele. */
export function stateWith(state: unknown, index: number): Record<string, unknown> {
  const base =
    typeof state === 'object' && state !== null ? (state as Record<string, unknown>) : {};
  return { ...base, [INDEX_KEY]: index };
}

/** Ao abrir: a posição da entrada atual (0 se não tem) e o máximo guardado na sessão. */
export function startPosition(state: unknown, storedMax: number | undefined): NavPosition {
  const index = indexOf(state) ?? 0;
  return { index, max: Math.max(index, storedMax ?? index) };
}

/** Entrada nova: a próxima posição, e o que havia adiante deixa de existir. */
export function afterPush(pos: NavPosition): NavPosition {
  return { index: pos.index + 1, max: pos.index + 1 };
}

/**
 * Depois de voltar, avançar ou seguir um link: a entrada com posição diz onde
 * se está; a que chega sem posição é nova.
 */
export function afterTraverse(pos: NavPosition, state: unknown): NavPosition {
  const index = indexOf(state);
  if (index === undefined) return afterPush(pos);
  return { index, max: Math.max(pos.max, index) };
}

export const canGoBack = (pos: NavPosition): boolean => pos.index > 0;
export const canGoForward = (pos: NavPosition): boolean => pos.index < pos.max;

export interface NavKey {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}

/**
 * Atalhos de voltar e avançar: ⌘[ e ⌘], ⌘← e ⌘→ no Mac; Ctrl+[ e Ctrl+], Alt+←
 * e Alt+→ nos outros. Quem chama ignora a tecla dentro de um campo de texto,
 * onde ⌘← e ⌘→ andam até o começo e o fim da linha.
 */
export function navShortcut(e: NavKey, mac: boolean): 'back' | 'forward' | undefined {
  if (e.shiftKey) return undefined;
  const mod = mac ? e.metaKey && !e.ctrlKey && !e.altKey : e.ctrlKey && !e.metaKey && !e.altKey;
  if (mod && e.key === '[') return 'back';
  if (mod && e.key === ']') return 'forward';
  const arrowMod = mac
    ? e.metaKey && !e.ctrlKey && !e.altKey
    : e.altKey && !e.ctrlKey && !e.metaKey;
  if (arrowMod && e.key === 'ArrowLeft') return 'back';
  if (arrowMod && e.key === 'ArrowRight') return 'forward';
  return undefined;
}

// A posição desta janela, com avisos para o cabeçalho redesenhar os botões.

let position: NavPosition = { index: 0, max: 0 };
const listeners = new Set<() => void>();

function readStoredMax(): number | undefined {
  try {
    const value = Number(sessionStorage.getItem(MAX_STORE_KEY));
    return Number.isInteger(value) && value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function setPosition(next: NavPosition): void {
  if (next.index === position.index && next.max === position.max) return;
  position = next;
  try {
    sessionStorage.setItem(MAX_STORE_KEY, String(next.max));
  } catch {
    // Sem armazenamento: o máximo vale até recarregar.
  }
  for (const listener of listeners) listener();
}

export function navPosition(): NavPosition {
  return position;
}

export function subscribeNav(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Vai para outro hash criando uma entrada no histórico, com a posição dela. */
export function pushHash(hash: string): void {
  const next = afterPush(position);
  history.pushState(stateWith(null, next.index), '', hash);
  setPosition(next);
}

/** Troca o hash da entrada atual sem criar outra, mantendo a posição dela. */
export function replaceHash(url: string): void {
  history.replaceState(stateWith(history.state, position.index), '', url);
}

let started = false;

/**
 * Marca a entrada atual e acompanha voltar, avançar e os links seguidos pelo
 * navegador. Uma vez por janela, antes da primeira navegação.
 */
export function startHistoryNav(): void {
  if (started) return;
  started = true;
  position = startPosition(history.state, readStoredMax());
  if (indexOf(history.state) === undefined) {
    history.replaceState(stateWith(history.state, position.index), '', location.href);
  }
  const onTraverse = () => {
    const next = afterTraverse(position, history.state);
    if (indexOf(history.state) === undefined) {
      history.replaceState(stateWith(history.state, next.index), '', location.href);
    }
    setPosition(next);
  };
  // O link seguido pelo navegador dispara os dois; a segunda chamada já acha a posição.
  window.addEventListener('popstate', onTraverse);
  window.addEventListener('hashchange', onTraverse);
}
