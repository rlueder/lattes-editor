// As palavras-chave, áreas e setores de uma formação (lido em 19/10/2026 no
// Lattes real, na edição de uma formação do currículo): a página traz
// palavraProvider, areaProvider e setorProvider como as de produção, e o
// check() os serializa em f_plv_l, f_area_l e f_setor_l. Os ocultos vêm
// vazios; um envio com eles como vieram apagaria as três grades. Por isso
// todo envio de formação leva as grades como a página as trouxe, e a mudança
// numa delas troca só a dela.

import type { Change } from '../model/changes.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import { areaLabel } from './areas-atuacao.ts';
import { FORMACAO_ELEMENTS } from './biographic.ts';
import type { FormacaoOp } from './formacao-edit.ts';
import type { FieldValues } from './plan.ts';
import {
  gridPairs,
  type Grids,
  keywordLabels,
  keywordRows,
  readGrids,
  sameWords,
} from './production/grids.ts';
import {
  areaGridRows,
  type AreaList,
  gridLabels,
  isAreaChange,
  type LabelList,
  planAreaList,
  planSetorList,
  sameLabels,
  setorGridRows,
} from './production/item-lists.ts';

const FIELDS = ['f_plv_l', 'f_area_l', 'f_setor_l'] as const;
const KEYWORD_ATTRS = Array.from({ length: 6 }, (_, i) => `PALAVRA-CHAVE-${i + 1}`);

/** As listas da formação que a mudança troca. */
export interface FormacaoGrids {
  areas?: AreaList;
  keywords?: LabelList;
  setores?: LabelList;
}

const LEVELS_AP = new Set(['POS-DOUTORADO', 'LIVRE-DOCENCIA']);

/** A formação de uma mudança nas palavras-chave, áreas ou setores dela; undefined se não é. */
export function planFormacaoGrids(
  change: Change,
  chain: readonly XElement[],
  label: string,
): FormacaoOp | { reason: string } | undefined {
  const index = chain.findIndex(
    (e, i) =>
      FORMACAO_ELEMENTS.has(e.name) && chain[i - 1]?.name === 'FORMACAO-ACADEMICA-TITULACAO',
  );
  const item = chain[index];
  if (!item) return undefined;
  const el = chain.at(-1);
  if (!el) return undefined;
  let grids: FormacaoGrids;
  if (change.element === 'PALAVRAS-CHAVE') {
    const now = KEYWORD_ATTRS.map((a) =>
      change.kind === 'removido' ? '' : (getAttr(el, a) ?? ''),
    );
    const was = KEYWORD_ATTRS.map((a, i) => {
      const f = change.fields.find((x) => x.attr === a);
      return f ? f.before : change.kind === 'novo' ? '' : now[i]!;
    });
    const clean = (list: string[]) => list.map((w) => w.trim()).filter(Boolean);
    grids = { keywords: { after: clean(now), before: clean(was) } };
  } else if (isAreaChange(change)) {
    const areas = planAreaList(change, item);
    if ('reason' in areas) return areas;
    grids = { areas };
  } else if (change.element === 'SETORES-DE-ATIVIDADE') {
    grids = { setores: planSetorList(change, el) };
  } else return undefined;
  const seq = getAttr(item, 'SEQUENCIA-FORMACAO');
  if (!seq) return { reason: 'Formação sem número de sequência' };
  const list = (grids.keywords ??
    grids.setores ?? {
      after: grids.areas!.after.map(areaLabel),
      before: grids.areas!.before.map(areaLabel),
    }) as LabelList;
  const name = grids.keywords ? 'f_plv_l' : grids.areas ? 'f_area_l' : 'f_setor_l';
  return {
    expect: {},
    grids,
    // A instituição confere que a linha da lista é mesmo a formação (formacao-edit.ts).
    identity: { f_inst_old: [getAttr(item, 'NOME-INSTITUICAO') ?? ''] },
    key: change.key,
    kind: 'formacao',
    label,
    ...(LEVELS_AP.has(item.name) ? { list: 'AP' as const } : {}),
    lookupRows: [
      {
        after: list.after.join('; '),
        before: list.before.join('; '),
        label: grids.keywords
          ? 'Palavras-chave'
          : grids.areas
            ? 'Áreas do conhecimento'
            : 'Setores de atividade',
        name,
      },
    ],
    seq,
    set: {},
  };
}

/** O que o envio de uma formação leva nas grades, e como conferir depois. */
export function formacaoGridSend(
  op: FormacaoOp,
  html: string,
  menu: string,
):
  | { detail: string; status: 'divergente' | 'erro' }
  | { check: (afterHtml: string) => string[]; set: FieldValues } {
  const read = readGrids(html, FIELDS);
  if ('missing' in read) {
    return {
      detail: `A página da formação não tem a grade ${read.missing}; nada foi enviado`,
      status: 'erro',
    };
  }
  const g = op.grids ?? {};
  const wrong: string[] = [];
  if (g.keywords && !sameWords(keywordLabels(read.f_plv_l ?? []), g.keywords.before))
    wrong.push('Palavras-chave');
  if (g.areas && !sameLabels(gridLabels(read.f_area_l ?? []), g.areas.before.map(areaLabel))) {
    wrong.push('Áreas do conhecimento');
  }
  if (g.setores && !sameLabels(gridLabels(read.f_setor_l ?? []), g.setores.before)) {
    wrong.push('Setores de atividade');
  }
  if (wrong.length > 0) {
    return {
      detail: `O Lattes não está como o editor espera: ${wrong.join(', ')}`,
      status: 'divergente',
    };
  }
  const replace: Grids = {};
  if (g.keywords) replace.f_plv_l = keywordRows(read.f_plv_l ?? [], g.keywords.after);
  const built = g.areas
    ? areaGridRows(read.f_area_l ?? [], menu, g.areas.after)
    : g.setores
      ? setorGridRows(read.f_setor_l ?? [], menu, g.setores.after)
      : undefined;
  if (built && 'unknown' in built) {
    return {
      detail: `Fora da lista do Lattes: ${built.unknown.join(', ')}. Escolha pela lista do Lattes uma vez`,
      status: 'erro',
    };
  }
  if (built) replace[g.areas ? 'f_area_l' : 'f_setor_l'] = built.rows;
  const wanted = {
    f_area_l: g.areas ? g.areas.after.map(areaLabel) : gridLabels(read.f_area_l ?? []),
    f_plv_l: g.keywords ? g.keywords.after : keywordLabels(read.f_plv_l ?? []),
    f_setor_l: g.setores ? g.setores.after : gridLabels(read.f_setor_l ?? []),
  };
  return {
    check(afterHtml) {
      const now = readGrids(afterHtml, FIELDS);
      if ('missing' in now) return [...FIELDS];
      return FIELDS.filter((f) => {
        const labels = f === 'f_plv_l' ? keywordLabels(now[f] ?? []) : gridLabels(now[f] ?? []);
        return !sameLabels(labels, wanted[f]);
      });
    },
    set: gridPairs(read, replace),
  };
}
