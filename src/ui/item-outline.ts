// Índice do item aberto ("Neste item", no painel lateral): as subseções do
// cartão aberto mais recente. Os ids das subseções são internos, nunca vão
// para a URL; as âncoras legíveis ("seção/grupo/ano") têm barra, estes não.

/** Entrada do índice; o mesmo formato que a JumpBar recebe. */
export interface OutlineEntry {
  id: string;
  label: string;
}

/** Marca dos títulos de subseção que entram no índice do cartão; o valor é o rótulo, sem a contagem. */
export const OUTLINE_HEAD_ATTR = 'data-outline-head';

const PREFIX = 'item-';

/**
 * Id do título da subseção `index` do cartão `base` (um id do useId do React).
 * Fica só com letras, dígitos, "_" e "-": sem barra, não colide com as
 * âncoras da URL, e funciona em seletor CSS e em "#…".
 */
export function outlineId(base: string, index: number): string {
  return `${PREFIX}${base.replace(/[^\w-]/g, '')}-${index}`;
}

/**
 * Ordem de abertura dos cartões: abrir põe no fim (mesmo se já estava),
 * fechar tira. O último da lista é o que o índice mostra.
 */
export function trackOpen<T>(stack: readonly T[], card: T, open: boolean): T[] {
  const rest = stack.filter((c) => c !== card);
  return open ? [...rest, card] : rest;
}

/** O cartão aberto mais recente que ainda vale (montado e aberto); undefined se nenhum. */
export function activeCard<T>(stack: readonly T[], alive: (card: T) => boolean): T | undefined {
  for (let i = stack.length - 1; i >= 0; i--) {
    const card = stack[i]!;
    if (alive(card)) return card;
  }
  return undefined;
}

/**
 * Entradas do índice a partir dos títulos, na ordem do documento. Título sem
 * id ou sem texto fica de fora. Com menos de duas subseções não há o que
 * indexar, e a lista volta vazia.
 */
export function outlineEntries(heads: readonly { id: string; text: string }[]): OutlineEntry[] {
  const entries = heads
    .map((h) => ({ id: h.id, label: h.text.replace(/\s+/g, ' ').trim() }))
    .filter((e) => e.id !== '' && e.label !== '');
  return entries.length > 1 ? entries : [];
}

/** Mesmas entradas, na mesma ordem: evita renderizar o painel à toa. */
export function sameEntries(a: readonly OutlineEntry[], b: readonly OutlineEntry[]): boolean {
  return a.length === b.length && a.every((e, i) => e.id === b[i]!.id && e.label === b[i]!.label);
}
