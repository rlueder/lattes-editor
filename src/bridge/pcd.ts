// Pessoa com deficiência no formulário de identificação (prc_ident, lido em
// 18/10/2026; docs/lattes_internals.md, seção 18): o rádio f_pcd_r (N ou S),
// um f_pcd oculto com DUMMY e uma caixa f_pcd por tipo (A auditiva, F física,
// I intelectual, V visual, E espectro autista, M múltipla), e a privacidade
// f_priv_pcd. O navegador manda o DUMMY e depois cada caixa marcada, todas com
// o mesmo nome; os pares do formulário guardam um valor por nome, por isso
// os tipos vão à parte.

import type { FormControl, Pairs } from './form.ts';

export const PCD_TYPES = ['A', 'F', 'I', 'V', 'E', 'M'] as const;

/** Os pares com os f_pcd trocados: o DUMMY e os tipos, no lugar do primeiro f_pcd. */
export function withPcd(pairs: Pairs, types: readonly string[]): Pairs {
  const out: Pairs = [];
  let placed = false;
  for (const [k, v] of pairs) {
    if (k !== 'f_pcd') {
      out.push([k, v]);
      continue;
    }
    if (placed) continue;
    placed = true;
    out.push(['f_pcd', 'DUMMY'], ...types.map((t): [string, string] => ['f_pcd', t]));
  }
  if (!placed) out.push(['f_pcd', 'DUMMY'], ...types.map((t): [string, string] => ['f_pcd', t]));
  return out;
}

/** Os tipos marcados na página, na ordem dela. */
export const pcdChecked = (controls: readonly FormControl[]): string[] =>
  controls
    .filter((c) => c.name === 'f_pcd' && c.type === 'checkbox' && c.checked)
    .map((c) => c.value);

/** Os tipos na ordem das caixas da página (PCD_TYPES). */
export const pcdOrder = (codes: readonly string[]): string[] =>
  [...codes].sort(
    (a, b) =>
      PCD_TYPES.indexOf(a as (typeof PCD_TYPES)[number]) -
      PCD_TYPES.indexOf(b as (typeof PCD_TYPES)[number]),
  );

/** Os mesmos tipos marcados, em qualquer ordem. */
export const samePcd = (a: readonly string[], b: readonly string[]): boolean =>
  [...a].sort().join() === [...b].sort().join();
