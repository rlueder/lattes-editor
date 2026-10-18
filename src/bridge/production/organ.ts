// Órgão e unidade do projeto pela janela de órgãos do Lattes
// (docs/development/PLAN.md, Fase 2). No XML, eles ficam na participação em
// projeto (PARTICIPACAO-EM-PROJETO), que é o pai do projeto; no Lattes, no
// formulário do próprio projeto (GN_PROJETO), em f_codorgao ou f_codorgao2,
// com o texto em f_orgao e f_orgao_old.
//
// A janela (pkg_projeto.pp_orgao_cargo, lida em 18/10/2026) lista os órgãos
// da instituição e, aberta num órgão, as unidades dele. A escolha chama
// atribuir(código, nome, tipo, órgão de cima): tipo 0 grava o código em
// f_codorgao, os outros em f_codorgao2, e o texto vira "órgão/\nunidade".
// Inferido, porque a exportação nunca foi vista com órgão: que o Lattes
// exporte o órgão de cima em CODIGO-ORGAO e a unidade em CODIGO-UNIDADE. Se
// não for assim, a conferência do código de antes falha e nada vai.

import type { Change } from '../../model/changes.ts';
import { getAttr, type XElement } from '../../model/xml.ts';
import type { LattesPort } from '../apply.ts';
import { getChecked, Stop } from '../create-shared.ts';
import { type Pairs, pairValue } from '../form.ts';
import { cvCodeFrom } from '../lattes-html.ts';
import { organLetter, organsPath, parseOrgans } from '../lattes-lists.ts';
import type { FieldValues } from '../plan.ts';
import type { Resolved } from './lookups.ts';

/** Onde o XML guarda o órgão e a unidade. */
export const ORGAN_PARTS = {
  holder: 'PARTICIPACAO-EM-PROJETO',
  organ: { code: 'CODIGO-ORGAO', name: 'NOME-ORGAO' },
  unit: { code: 'CODIGO-UNIDADE', name: 'NOME-UNIDADE' },
} as const;

const ATTRS: readonly string[] = [
  ORGAN_PARTS.organ.code,
  ORGAN_PARTS.organ.name,
  ORGAN_PARTS.unit.code,
  ORGAN_PARTS.unit.name,
];

/** A escolha: o código que o Lattes tem agora e o novo, com o órgão de cima de uma unidade. */
export interface OrganChoice {
  before: string;
  code: string;
  /** O órgão de cima, quando a escolha é uma unidade. */
  parent?: string;
}

/** O texto que a janela grava em f_orgao e f_orgao_old. */
export const organText = (organ: string, unit: string) => (unit ? `${organ}/\n${unit}` : organ);

/** A mudança é do órgão ou da unidade da participação? */
export const isOrganChange = (change: Change) =>
  change.element === ORGAN_PARTS.holder && change.fields.some((f) => ATTRS.includes(f.attr));

/**
 * O órgão de uma mudança na participação, ou o motivo de ficar à mão. O
 * período da participação não tem campo no formulário do projeto.
 */
export function planOrgan(
  change: Change,
  el: XElement,
  periodReason: string,
):
  | { choice: OrganChoice; rows: { after: string; before: string; label: string; name: string }[] }
  | { reason: string } {
  if (change.fields.some((f) => !ATTRS.includes(f.attr))) return { reason: periodReason };
  const now = (attr: string) => getAttr(el, attr) ?? '';
  const was = (attr: string) => change.fields.find((f) => f.attr === attr)?.before ?? now(attr);
  const { organ, unit } = ORGAN_PARTS;
  const codeChanged = change.fields.some((f) => f.attr === organ.code || f.attr === unit.code);
  if (!codeChanged) {
    return { reason: 'Órgão e unidade: escolha pela lista do Lattes, que grava o código junto' };
  }
  const code = now(unit.code) || now(organ.code);
  if (!code) return { reason: 'O órgão do projeto não fica vazio pelo conector; troque no Lattes' };
  const choice: OrganChoice = {
    before: was(unit.code) || was(organ.code),
    code,
    ...(now(unit.code) ? { parent: now(organ.code) } : {}),
  };
  return {
    choice,
    rows: [
      {
        after: organText(now(organ.name), now(unit.name)).replace('\n', ' '),
        before: organText(was(organ.name), was(unit.name)).replace('\n', ' '),
        label: 'Órgão/Unidade',
        name: 'f_codorgao',
      },
    ],
  };
}

/**
 * Os ocultos do órgão, para juntar ao set da operação. Antes de buscar,
 * confere que o Lattes tem o código que o editor tinha; depois refaz a
 * janela de órgãos (só GET) e fica com o único resultado de mesmo código.
 */
export async function resolveOrgan(
  choice: OrganChoice,
  port: LattesPort,
  pairs: Pairs,
): Promise<Resolved> {
  try {
    return await resolve(choice, port, pairs);
  } catch (err) {
    if (err instanceof Stop) return { detail: err.message, status: err.status };
    throw err;
  }
}

async function resolve(choice: OrganChoice, port: LattesPort, pairs: Pairs): Promise<Resolved> {
  const missing = ['f_codorgao', 'f_codorgao2', 'f_orgao_old'].filter(
    (f) => !pairs.some(([k]) => k === f),
  );
  if (missing.length > 0) {
    return {
      detail: `O formulário do Lattes não tem ${missing.join(', ')}; nada foi enviado`,
      status: 'erro',
    };
  }
  const now = (pairValue(pairs, 'f_codorgao') || pairValue(pairs, 'f_codorgao2') || '').trim();
  if (now !== choice.before.trim()) {
    return {
      detail: 'O Lattes não está como o editor espera: Órgão/Unidade',
      status: 'divergente',
    };
  }
  const cv = pairValue(pairs, 'f_cod') || cvCodeFrom(await port.menuHtml()) || '';
  // Como o orgao() da página: V com f_cod_inst, D com f_cod_inst2.
  const v = pairValue(pairs, 'f_cod_inst')?.trim() ?? '';
  const d = pairValue(pairs, 'f_cod_inst2')?.trim() ?? '';
  const institution = v ? `V${v}` : d ? `D${d}` : '';
  if (!cv || !institution) {
    return { detail: 'O projeto no Lattes está sem instituição', status: 'erro' };
  }
  // A letra do órgão de cima no link não está no XML: V (tipo 0) e, sem ele, D.
  const parents = choice.parent ? ['0', '1'].map((k) => organLetter(k) + choice.parent) : [''];
  let found: ReturnType<typeof parseOrgans> = [];
  for (const parent of parents) {
    const html = await getChecked(port, organsPath(cv, institution, parent));
    found = parseOrgans(html, choice.parent).filter(
      (o) => o.code === choice.code && Boolean(o.parent) === Boolean(choice.parent),
    );
    if (found.length > 0) break;
  }
  if (found.length !== 1) {
    return {
      detail: `Órgão não encontrado na janela de órgãos do Lattes (${found.length} resultados com o código)`,
      status: 'erro',
    };
  }
  const hit = found[0]!;
  const set: FieldValues = {
    f_codorgao: hit.kind === '0' ? hit.code : '',
    f_codorgao2: hit.kind === '0' ? '' : hit.code,
    f_orgao_old: hit.parent ? organText(hit.parent, hit.name) : hit.name,
  };
  if (pairs.some(([k]) => k === 'f_orgao')) set.f_orgao = set.f_orgao_old!;
  return { check: {}, set };
}
