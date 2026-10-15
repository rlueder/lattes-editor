// Um bloco em edição de cada vez no modo de leitura. Abrir outro bloco
// (clique, "Editar" ou E) fecha o que estava aberto antes, do mesmo jeito que
// "Concluir": o campo em foco grava ao perder o foco, e as mudanças valem na
// hora, como no resto do editor.

/** O bloco aberto, visto de fora. */
export interface OpenEditor {
  /** Fecha o bloco, gravando antes o campo em foco. */
  close: () => void;
}

let current: OpenEditor | null = null;

export function openEditor(): OpenEditor | null {
  return current;
}

/** O bloco passa a ser o aberto. */
export function registerOpen(editor: OpenEditor): void {
  current = editor;
}

/** O bloco fechou; se era o aberto, não há mais bloco aberto. */
export function unregister(editor: OpenEditor): void {
  if (current === editor) current = null;
}

/**
 * Abrir um bloco: fecha antes o outro bloco aberto (o próprio continua
 * aberto) e então abre.
 */
export function openOnly(open: () => void, editor: OpenEditor): void {
  if (current && current !== editor) current.close();
  open();
}

/** Só para testes: volta ao estado inicial. */
export function resetEditSession(): void {
  current = null;
}
