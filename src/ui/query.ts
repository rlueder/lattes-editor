// Busca enquanto se digita: a filtragem só começa com 3 caracteres. Com menos,
// a lista aparece inteira, sem o vai e vem de resultados a cada letra.

export const MIN_QUERY = 3;

/** O texto que vale para a busca: aparado, ou vazio se ainda tem menos de 3 caracteres. */
export function effectiveQuery(query: string): string {
  const q = query.trim();
  return q.length >= MIN_QUERY ? q : '';
}
