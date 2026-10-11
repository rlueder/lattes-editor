/** Sugere a forma de citação ABNT a partir do nome: "Maria da Silva" vira "SILVA, M. D.". */
export function suggestCitation(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name.trim().toUpperCase();
  const last = parts.at(-1)!;
  const initials = parts
    .slice(0, -1)
    .filter((p) => !/^(da|de|do|das|dos|e)$/i.test(p))
    .map((p) => `${p[0]!.toUpperCase()}.`)
    .join(' ');
  return `${last.toUpperCase()}, ${initials}`;
}
