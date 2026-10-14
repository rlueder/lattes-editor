// Filtro das listas de opções digitáveis (ComboSelect): sem diferença entre
// maiúsculas e acentos, a partir do primeiro caractere, com quem começa pelo
// texto antes de quem só o contém. Código curto, como a UF "RS", também vale.

import { foldText } from '../model/fold-text.ts';

export { foldText };

export interface FilterableOption {
  label: string;
  value: string;
}

/**
 * As opções que casam com o que foi digitado: primeiro as que começam pelo
 * texto (no nome ou no código), depois as que só o contêm, cada grupo na ordem
 * da lista. A opção vazia ("(escolha)") só aparece sem texto digitado.
 */
export function rankOptions<T extends FilterableOption>(options: readonly T[], query: string): T[] {
  const q = foldText(query);
  if (!q) return [...options];
  const starts: T[] = [];
  const contains: T[] = [];
  for (const o of options) {
    if (o.value === '') continue;
    const label = foldText(o.label);
    const value = foldText(o.value);
    if (label.startsWith(q) || value.startsWith(q)) starts.push(o);
    else if (label.includes(q)) contains.push(o);
  }
  return [...starts, ...contains];
}
