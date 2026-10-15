// ↓ e ↑ no "Nesta seção" (JumpBar com arrowKeys): pular para o próximo grupo
// da seção ou o anterior, como o clique na lista. A tecla só vale fora de
// campos, listas e menus, sem modificador e sem janela ou menu aberto; na
// primeira e na última divisão, segue para a rolagem normal da página.

interface KeyLike {
  altKey: boolean;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}

/** Onde as setas já têm uso: campos, listas, menus, abas, grades. */
const USES_ARROWS =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role=combobox], [role=listbox], [role=menu], [role=menubar], [role=tablist], [role=radiogroup], [role=slider], [role=grid], [role=tree]';

/** Janela, menu ou lista aberta por cima da página (inclui o ⌘K). */
const OPEN_OVERLAY =
  '[role=dialog], [role=alertdialog], [role=menu], [role=listbox], dialog[open], [data-popup-open]';

export function arrowJumpAllowed(e: KeyLike, doc: Pick<Document, 'querySelector'>): boolean {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return false;
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
  const target = e.target as Element | null;
  if (target && typeof target.closest === 'function' && target.closest(USES_ARROWS)) return false;
  return doc.querySelector(OPEN_OVERLAY) === null;
}

/** A divisão seguinte (1) ou a anterior (-1); undefined nas pontas, para não prender a tecla. */
export function nextJump(
  ids: string[],
  active: string | undefined,
  step: 1 | -1,
): string | undefined {
  const at = active === undefined ? -1 : ids.indexOf(active);
  const next = at + step;
  if (at < 0) return step === 1 ? ids[0] : undefined;
  return next >= 0 && next < ids.length ? ids[next] : undefined;
}
