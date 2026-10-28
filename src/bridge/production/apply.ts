// Alterar no lugar, no Lattes, um item de produção, orientação ou banca
// (plan.ts). Acha a linha pelo título e pelo ano (o f_seq da lista nem sempre
// é a SEQUENCIA-PRODUCAO: 3 de 8 trabalhos técnicos no censo), confere que o
// Lattes está como o editor espera, envia o formulário com os campos trocados
// e as grades refeitas (grids.ts) e lê de volta: os campos trocados, as
// grades e todos os outros campos.

import type { LattesPort, OpResult } from '../apply.ts';
import { menuAuthors } from '../author-grid.ts';
import { getChecked, Stop } from '../create-shared.ts';
import {
  encodeLatin1Form,
  type Pairs,
  pairValue,
  successfulPairs,
  withScriptValues,
} from '../form.ts';
import { isLogonPage } from '../lattes-html.ts';
import { withChoices } from '../multi-choice.ts';
import type { FieldValues } from '../plan.ts';
import { afterWrong, beforeWrong, createdPath } from './apply-checks.ts';
import { doiProblem } from './doi.ts';
import {
  authorRows,
  GRID_LABELS,
  GRID_SPECS,
  gridKeysOf,
  gridPairs,
  type Grids,
  keywordRows,
  MAX_KEYWORDS,
  readGrids,
  serializeGrid,
} from './grids.ts';
import { SEVERAL_HOLDERS } from './holders.ts';
import { depositorReplace, severalDepositors } from './institution-holder.ts';
import { areaGridRows, setorGridRows } from './item-lists.ts';
import { inclusion, locate } from './locate.ts';
import { resolveLookups } from './lookups.ts';
import { sameAuthors, withLeads } from './members.ts';
import { readOpaque } from './opaque.ts';
import { organLoose, resolveOrgan } from './organ.ts';
import {
  EDIT_PRODUCTION_ENABLED,
  folded,
  PRODUCTION_LOOKUPS_ENABLED,
  type ProductionOp,
  productionTarget,
  PROJECT_ORGAN_ENABLED,
} from './plan.ts';
import { projectGridValues } from './project-links.ts';
import { resolveStudent } from './student.ts';
import type { GridField } from './types.ts';

/** Um campo de target.virtual: linha de um vetor da página, e não um controle. */
const isVirtual = (field: string) => field.includes(':');

/** Os campos que mudaram entre dois envios, fora estes (os trocados e as grades). */
function otherChanges(a: Pairs, b: Pairs, skip: Set<string>): string[] {
  const names = new Set([...a, ...b].map(([k]) => k).filter((k) => !skip.has(k)));
  const value = (p: Pairs, n: string) =>
    p
      .filter(([k]) => k === n)
      .map(([, v]) => v)
      .join('\n');
  return [...names].filter((n) => value(a, n) !== value(b, n));
}

const labelOf = (op: ProductionOp, name: string) =>
  op.rows.find((r) => r.name === name)?.label ?? name;

export async function applyProduction(
  op: ProductionOp,
  port: LattesPort,
  { projectOrgan = PROJECT_ORGAN_ENABLED }: { projectOrgan?: boolean } = {},
): Promise<OpResult> {
  const result = (status: OpResult['status'], detail: string): OpResult => ({
    detail,
    key: op.key,
    status,
  });
  const t = productionTarget(op.target);
  if (!EDIT_PRODUCTION_ENABLED || !t) {
    return result('erro', 'Esta extensão não altera este tipo de item; a alteração fica à mão');
  }
  if (op.lookups && (!PRODUCTION_LOOKUPS_ENABLED || !t.lookups)) {
    return result('erro', 'Esta extensão não envia a escolha pelas buscas; a alteração fica à mão');
  }
  if (op.organ && (!projectOrgan || !t.organ)) {
    return result('erro', 'Esta extensão não envia o órgão do projeto; a alteração fica à mão');
  }
  if (op.keywords && op.keywords.after.length > MAX_KEYWORDS) {
    return result('erro', `O Lattes aceita até ${MAX_KEYWORDS} palavras-chave`);
  }
  let posted = false;
  try {
    const menu = await port.menuHtml();
    const found = op.create ? await inclusion(op, t, port, menu) : await locate(op, t, port, menu);
    const { controls, html } = found;
    const pairs = successfulPairs(controls);
    if (pairValue(pairs, 'f_ctr') !== (op.create ? 'I' : 'U')) {
      return result(
        'erro',
        `O formulário não está em modo de ${op.create ? 'inclusão' : 'alteração'}`,
      );
    }
    // Um campo da especificação que a página não tem (ligação inferida que
    // não confere): nada vai, em vez de um POST com um parâmetro a mais.
    const fields = Object.keys(op.set).filter((f) => !(f in GRID_SPECS) && !isVirtual(f));
    // Os campos que são linhas de um vetor da página (target.virtual).
    const virtualFields = Object.keys(op.set).filter(isVirtual);
    const virtualNow = virtualFields.length > 0 ? t.virtual?.read(html) : {};
    if (!virtualNow) {
      return result(
        'erro',
        `A página do Lattes não trouxe ${virtualFields.map((f) => labelOf(op, f)).join(', ')}; nada foi enviado`,
      );
    }
    const absent = fields.filter((f) => !controls.some((c) => c.name === f));
    if (absent.length > 0) {
      return result(
        'erro',
        `O formulário do Lattes não tem o campo de ${absent.map((f) => labelOf(op, f)).join(', ')}; nada foi enviado`,
      );
    }
    const grids = readGrids(html, t.grids);
    if ('missing' in grids) {
      return result(
        'erro',
        `A página do Lattes não tem a grade ${grids.missing}; nada foi enviado`,
      );
    }
    const opaque = readOpaque(html, t.opaqueGrids ?? []);
    if ('missing' in opaque) {
      return result(
        'erro',
        `A página do Lattes não tem a grade ${opaque.missing}; nada foi enviado`,
      );
    }
    if (opaque.unsendable.length > 0) {
      return result(
        'erro',
        `O item tem no Lattes ${opaque.unsendable.map((g) => g.label).join(', ')}, que o conector não sabe reenviar; nada foi enviado`,
      );
    }

    // A natureza de um financiador: a linha dele na grade, com a letra nova.
    const gridEdit = await projectGridValues(port, found.path, html, t.opaqueGrids ?? [], op);
    if ('status' in gridEdit) return result(gridEdit.status, gridEdit.detail);
    Object.assign(opaque.values, gridEdit.values);

    // Mais de um depositante na página: como a exportação os junta não foi visto.
    if (op.holders && severalDepositors(grids)) {
      return result('erro', `${SEVERAL_HOLDERS}; nada foi enviado`);
    }

    // O antes: os campos que a alteração troca, e as grades que ela mexe.
    // Duas mudanças na mesma grade viram operações iguais (members.ts): a
    // segunda acha o Lattes já como o editor quer e não envia nada.
    if (
      !op.create &&
      op.authors &&
      !op.keywords &&
      fields.length === 0 &&
      sameAuthors(grids.f_autores_l ?? [], op.authors.after)
    ) {
      return result('conferido', 'O Lattes já estava assim; nada foi enviado');
    }
    const virtualDone = (f: string) => folded(virtualNow[f] ?? '') === folded(op.set[f]);
    // Na inclusão não há antes: o formulário vem vazio.
    // Os campos que a página não mostra depois de gravar (FieldMap.unshown).
    const blind = new Set(
      Object.values(t.fields).flatMap((m) => (typeof m !== 'string' && m.unshown ? [m.field] : [])),
    );
    const seen = fields.filter((f) => !blind.has(f));
    const wrong = op.create ? [] : beforeWrong(op, pairs, grids, seen, virtualFields, virtualNow);
    if (wrong.length > 0) {
      return result(
        'divergente',
        `O Lattes não está como o editor espera: ${wrong.map((f) => labelOf(op, f)).join(', ')}`,
      );
    }
    // Só depois da conferência: um antes que não bate (uma grade, outro campo)
    // segue divergente mesmo com os virtuais já no valor novo.
    if (
      virtualFields.length > 0 &&
      Object.keys(op.set).every(isVirtual) &&
      !op.lookups &&
      !op.organ &&
      virtualFields.every(virtualDone)
    ) {
      return result('conferido', 'O Lattes já estava assim; nada foi enviado');
    }

    // As grades: as lidas, e no lugar delas as que a alteração troca.
    const replace: Grids = {};
    if (op.keywords) replace.f_plv_l = keywordRows(grids.f_plv_l ?? [], op.keywords.after);
    if (op.areas || op.setores) {
      const built = op.areas
        ? areaGridRows(grids.f_area_l ?? [], menu, op.areas.after)
        : setorGridRows(grids.f_setor_l ?? [], menu, op.setores!.after);
      if ('unknown' in built) {
        return result(
          'erro',
          `Fora da lista do Lattes: ${built.unknown.join(', ')}. Escolha pela lista do Lattes uma vez`,
        );
      }
      replace[op.areas ? 'f_area_l' : 'f_setor_l'] = built.rows;
    }
    if (op.authors) {
      const { missing, rows } = authorRows(
        grids.f_autores_l ?? [],
        menuAuthors(menu) ?? [],
        op.authors.after,
      );
      if (missing.length > 0) {
        return result(
          'erro',
          `Autor que não está na lista do Lattes: ${missing.join(', ')}. Inclua-o no Lattes uma vez; depois o editor consegue mandar`,
        );
      }
      replace.f_autores_l = withLeads(rows, op.authors.after);
    }
    if (op.holders) {
      const built = await depositorReplace(port, pairs, menu, grids, op.holders);
      if ('status' in built) return result(built.status, built.detail);
      Object.assign(replace, built.replace);
    }
    const set = Object.fromEntries(fields.map((f) => [f, op.set[f] ?? '']));
    // As escolhas pelas buscas: os ocultos que a página escreveria (lookups.ts).
    let chosen: FieldValues = {};
    let chosenCheck: FieldValues = {};
    if (op.lookups && t.lookups) {
      const resolved = await resolveLookups(op.lookups, t.lookups, port, pairs);
      if ('status' in resolved) return result(resolved.status, resolved.detail);
      chosen = resolved.set;
      chosenCheck = resolved.check;
    }
    // O orientando com nome novo: a validação que o Salvar da página faz (student.ts).
    if (t.student && 'f_nme_orient' in set) {
      const student = await resolveStudent(set.f_nme_orient ?? '', port, pairs);
      chosen = { ...chosen, ...student.set };
      chosenCheck = { ...chosenCheck, ...student.check };
    }
    let organShown: string | undefined;
    if (op.organ) {
      const shown = controls.find((c) => c.name === 'f_orgao')?.value ?? '';
      const resolved = await resolveOrgan(op.organ, port, pairs, shown);
      if ('status' in resolved) return result(resolved.status, resolved.detail);
      chosen = { ...chosen, ...resolved.set };
      chosenCheck = { ...chosenCheck, ...resolved.check };
      organShown = resolved.shown;
    }
    // As conferências do DOI que o check() da página faz (doi.ts).
    // O DOI vai como foi conferido: sem espaço nas pontas.
    if (set.f_cod_doi !== undefined) set.f_cod_doi = set.f_cod_doi.trim();
    const doi = set.f_cod_doi;
    if (t.doi && doi) {
      const problem = await doiProblem(doi, t.doi, html, port);
      if (problem) return result('erro', problem);
    }
    // O que o check() da página monta antes do envio (target.built).
    const built = t.built ? t.built(html, set) : {};
    if (!built) {
      return result('erro', 'A página do Lattes não trouxe o que o envio monta; nada foi enviado');
    }
    const virtualSet = Object.fromEntries(virtualFields.map((f) => [f, op.set[f] ?? '']));
    const virtualBuilt = virtualFields.length > 0 ? t.virtual?.build(html, virtualSet) : {};
    if (!virtualBuilt) {
      return result('erro', 'A página do Lattes não trouxe o que o envio monta; nada foi enviado');
    }
    if ('reason' in virtualBuilt) return result('erro', `${virtualBuilt.reason}; nada foi enviado`);
    chosen = { ...built, ...virtualBuilt, ...chosen };
    // A página carrega esses campos vazios: a releitura não os confere.
    for (const k of Object.keys({ ...built, ...virtualBuilt })) chosenCheck[k] = null;
    posted = true;
    const response = await port.post(
      t.form.action,
      encodeLatin1Form(
        withChoices(pairs, {
          ...set,
          ...chosen,
          ...gridPairs(grids, replace, t.gridKeys),
          // As grades que o conector não monta vão como a página as trouxe.
          ...opaque.values,
        }),
      ),
    );
    if (isLogonPage(response)) return result('sessao', 'A sessão do Lattes expirou; entre de novo');

    // Releitura.
    // Na inclusão, o item novo: o único da lista com o título e o ano enviados.
    const path = op.create ? await createdPath(op, t, port) : found.path;
    if (path === undefined) {
      return result(
        'divergente',
        'Enviado, mas o item novo não apareceu na lista do Lattes; confira no Lattes',
      );
    }
    const afterHtml = await getChecked(port, path);
    const afterControls = withScriptValues(afterHtml, port.readForm(afterHtml, t.form.name));
    const afterGrids = readGrids(afterHtml, t.grids);
    const afterOpaque = readOpaque(afterHtml, t.opaqueGrids ?? []);
    if (!afterControls || 'missing' in afterGrids || 'missing' in afterOpaque) {
      return result(
        'divergente',
        'Depois do envio, a página do item não pôde ser relida; confira no Lattes',
      );
    }
    const afterPairs = successfulPairs(afterControls);
    const virtualAfter = virtualFields.length > 0 ? t.virtual?.read(afterHtml) : {};
    // Os autores como foram (o nome da linha do menu, quando a pessoa foi achada pela citação).
    const sentRows = replace.f_autores_l;
    const sent =
      op.authors && sentRows
        ? {
            ...op,
            authors: {
              ...op.authors,
              after: op.authors.after.map((a, i) => ({
                ...a,
                name: String(sentRows[i]?.l ?? a.name),
              })),
            },
          }
        : op;
    const notSaved = afterWrong(sent, afterPairs, afterGrids, seen, virtualFields, virtualAfter);
    // O texto do órgão leva uma quebra de linha, que a página pode devolver como \r\n.
    const loose = (v: string | null | undefined) => folded(v).replace(/\s+/g, ' ');
    for (const [f, v] of Object.entries(chosen)) {
      if (chosenCheck[f] === null) continue;
      if (loose(pairValue(afterPairs, f)) !== loose(chosenCheck[f] ?? v)) notSaved.push(f);
    }
    // O órgão: o texto que a página mostra (f_orgao, desabilitado) depois de gravar.
    const organNow = afterControls.find((c) => c.name === 'f_orgao')?.value;
    if (organShown !== undefined && organLoose(organNow) !== organLoose(organShown)) {
      notSaved.push('f_codorgao');
    }
    if (notSaved.length > 0) {
      return result(
        'divergente',
        `O Lattes não gravou: ${notSaved.map((f) => labelOf(op, f)).join(', ')}. Confira no Lattes`,
      );
    }
    // Na inclusão, o formulário de antes vinha vazio: não há o que comparar.
    const unread = fields.filter((f) => blind.has(f)).map((f) => labelOf(op, f));
    const blindNote = unread.length
      ? `. A página do Lattes não mostra ${unread.join(', ')} depois de gravar: confira na exportação`
      : '';
    if (op.create) return result('conferido', `Incluído e conferido no Lattes${blindNote}`);
    const untouched = t.grids.filter((g) => !(g in replace));
    const lost = untouched.filter(
      (g: GridField) =>
        serializeGrid(grids[g] ?? [], gridKeysOf(g, t.gridKeys)) !==
        serializeGrid(afterGrids[g] ?? [], gridKeysOf(g, t.gridKeys)),
    );
    const opaqueFields = (t.opaqueGrids ?? []).map((g) => g.field);
    const others = otherChanges(
      pairs,
      afterPairs,
      new Set([
        ...fields,
        ...Object.keys(chosen),
        ...t.grids,
        ...opaqueFields,
        ...Object.keys(gridEdit.values),
      ]),
    );
    // As grades que o conector não monta voltam como foram.
    const opaqueChanged = (t.opaqueGrids ?? []).filter(
      (g) => afterOpaque.values[g.field] !== opaque.values[g.field],
    );
    const changed = [
      ...lost.map((g) => GRID_LABELS[g]),
      ...opaqueChanged.map((g) => g.label),
      ...others,
    ];
    if (changed.length > 0) {
      return result(
        'divergente',
        `Outros campos mudaram no Lattes: ${changed.join(', ')}. Confira no Lattes`,
      );
    }
    return result('conferido', `Gravado e conferido no Lattes${blindNote}`);
  } catch (err) {
    if (err instanceof Stop) return result(err.status, err.message);
    const why = err instanceof Error ? err.message : String(err);
    // Depois do POST, sem saber se gravou: divergente, como as outras falhas no meio.
    return posted
      ? result('divergente', `Falha no meio do envio (${why}); confira no Lattes`)
      : result('erro', `Falha ao ler o Lattes (${why}); nada foi enviado`);
  }
}
