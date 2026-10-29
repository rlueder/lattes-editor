// Os itens que "Atualizar do Lattes" leu dos formulários do Lattes
// (src/bridge/refresh/), e não da exportação. A marca fica na cópia de
// trabalho (WorkingCopy.lattesForms), cifrada com ela, e some quando uma
// exportação nova é carregada: a exportação toma o lugar da cópia inteira.
//
// Um item lido do formulário entra na exportação carregada (o original das
// diferenças) e na cópia de trabalho ao mesmo tempo, porque ele já está no
// Lattes. Sem a marca, um item novo lido assim, com SEQUENCIA-PRODUCAO acima
// do maior da exportação, pareceria um item criado no editor e iria de novo
// pelo Importar. Faltam a ele os atributos que só a exportação traz (códigos,
// números de sequência, marcas derivadas); a marca diz isso na tela.

import type { Loaded } from './production.ts';

export interface FormReadMark {
  /**
   * novo: o item não estava na exportação; alterado: estava, e o formulário
   * trouxe outros valores.
   */
  kind: 'alterado' | 'novo';
  /** Quando foi lido (ms desde 1970). */
  readAt: number;
  /** SEQUENCIA-PRODUCAO do item no editor. */
  seq: string;
  /** O tipo no conector (o id em src/bridge/production/targets/). */
  target: string;
}

/**
 * O que o Lattes já tem, para decidir o que é item novo do editor: o maior
 * número da exportação e os itens novos lidos dos formulários.
 */
export function loadedOf(meta: {
  lattesForms?: readonly FormReadMark[];
  loadedMaxSequencia: number;
}): Loaded {
  const inLattes = new Set(
    (meta.lattesForms ?? []).filter((m) => m.kind === 'novo').map((m) => m.seq),
  );
  return inLattes.size === 0 ? meta.loadedMaxSequencia : { inLattes, max: meta.loadedMaxSequencia };
}

/** As marcas de antes com as novas: a leitura mais recente de cada item vale; "novo" não vira "alterado". */
export function mergeMarks(
  before: readonly FormReadMark[] = [],
  added: readonly FormReadMark[],
): FormReadMark[] {
  const bySeq = new Map(before.map((m) => [m.seq, m]));
  for (const m of added) {
    const old = bySeq.get(m.seq);
    bySeq.set(m.seq, old?.kind === 'novo' ? { ...m, kind: 'novo' } : m);
  }
  return [...bySeq.values()];
}
