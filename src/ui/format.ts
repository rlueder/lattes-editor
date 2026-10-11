// Formatação de valores do Lattes para exibição.

/** "17082026" → "17/08/2026"; qualquer outra coisa fica de fora. */
export function formatLattesDate(value?: string): string | undefined {
  const m = /^(\d{2})(\d{2})(\d{4})$/.exec(value ?? '');
  return m ? `${m[1]}/${m[2]}/${m[3]}` : undefined;
}
