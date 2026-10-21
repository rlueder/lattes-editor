// O motivo dos campos de uma mudança que não vão ao Lattes (plan.ts).

/** O motivo dos campos que não vão: o formulário não tem, à mão, ou valor sem par. */
export function fieldsLeft(
  unknown: string[],
  manual: Map<string, string[]>,
  unmapped: string[],
): { reason: string } | undefined {
  if (unknown.length > 0) {
    return { reason: `O formulário deste tipo no Lattes não tem: ${unknown.join(', ')}` };
  }
  if (manual.size > 0) {
    return {
      reason: [...manual].map(([why, labels]) => `${labels.join(', ')}: ${why}`).join('; '),
    };
  }
  if (unmapped.length > 0) {
    return { reason: `Valor sem correspondência no formulário do Lattes: ${unmapped.join(', ')}` };
  }
  return undefined;
}
