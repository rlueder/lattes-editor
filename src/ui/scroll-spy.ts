// Qual grupo está ativo ao rolar, igual no caminho da barra fixa
// (StickyTitle) e no "Nesta seção" (JumpBar): o último cujo título já chegou
// à borda de baixo da barra que gruda no alto (a do título, quando à mostra;
// senão o cabeçalho). Uma folga pequena conta o título que o salto deixa
// logo abaixo da barra (scroll-margin de 8px). No fim da página, quando os
// últimos títulos não sobem até a barra, vale o último visível.

/** Folga além da borda: cobre os 8px que o salto deixa entre a barra e o título. */
export const SPY_SLACK = 12;

/** A borda de baixo do que gruda no alto da janela, em px da janela. */
export function spyEdge(doc: Pick<Document, 'querySelector'>): number {
  const bar = doc.querySelector('.sticky-title.visible .sticky-title-bar');
  if (bar) return bar.getBoundingClientRect().bottom;
  // No modo foco o cabeçalho sai para cima da janela: a borda é 0.
  return Math.max(0, doc.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0);
}

/**
 * O grupo ativo: o último cujo topo está até a borda (com a folga); antes do
 * primeiro, o primeiro. No fim da página, o último que já aparece na janela.
 */
export function activeGroup(
  tops: { id: string; top: number | undefined }[],
  edge: number,
  page: { atBottom: boolean; viewport: number },
): string | undefined {
  let current = tops[0]?.id;
  for (const t of tops) {
    if (t.top !== undefined && t.top <= edge + SPY_SLACK) current = t.id;
  }
  if (page.atBottom) {
    for (const t of tops) if (t.top !== undefined && t.top < page.viewport) current = t.id;
  }
  return current;
}

/** Os topos dos títulos na janela, para activeGroup. */
export function headTops(doc: Pick<Document, 'getElementById'>, ids: string[]) {
  return ids.map((id) => ({ id, top: doc.getElementById(id)?.getBoundingClientRect().top }));
}

/** A página está no fim da rolagem (com 2px de folga). */
export function atPageBottom(): boolean {
  return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
}
