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
  type FormControl,
  type Pairs,
  pairValue,
  setPairs,
  successfulPairs,
  withScriptValues,
} from '../form.ts';
import { findLinks, isLogonPage } from '../lattes-html.ts';
import type { FieldValues } from '../plan.ts';
import {
  authorRows,
  GRID_LABELS,
  GRID_SPECS,
  gridKeysOf,
  gridPairs,
  type Grids,
  keywordLabels,
  keywordRows,
  MAX_KEYWORDS,
  readGrids,
  sameWords,
  serializeGrid,
} from './grids.ts';
import { resolveLookups } from './lookups.ts';
import { sameAuthors, withLeads } from './members.ts';
import { opaquePairs, readOpaque } from './opaque.ts';
import { organLoose, resolveOrgan } from './organ.ts';
import {
  EDIT_PRODUCTION_ENABLED,
  folded,
  PRODUCTION_LOOKUPS_ENABLED,
  type ProductionOp,
  productionTarget,
  PROJECT_ORGAN_ENABLED,
} from './plan.ts';
import { resolveStudent } from './student.ts';
import type { GridField, ProductionTarget } from './types.ts';

/** O ano do item na página: o do campo, ou o da data de t.year.fallback quando ele vem vazio. */
function shownYear(controls: FormControl[], field: string, fallback?: string): string {
  const year = valueOf(controls, field).trim();
  if (year || !fallback) return year;
  return /^\d{2}\/\d{2}\/(\d{4})$/.exec(valueOf(controls, fallback).trim())?.[1] ?? '';
}

/** Um campo de target.virtual: linha de um vetor da página, e não um controle. */
const isVirtual = (field: string) => field.includes(':');

const valueOf = (controls: FormControl[], name: string) =>
  controls.find((c) => c.name === name)?.value ?? '';

/**
 * A natureza da linha não é de outro tipo? Lida do rádio marcado mesmo que
 * desabilitado (inferido: a edição pode travar a natureza). Sem campo ou sem
 * rádio marcado, a linha conta, e o título e o ano decidem.
 */
function sameNature(controls: FormControl[], t: ProductionTarget): boolean {
  if (!t.nature) return true;
  const { field, values } = t.nature;
  const value = controls.find((c) => c.name === field && (c.type !== 'radio' || c.checked))?.value;
  return value === undefined || values.includes(value.trim());
}

/** O formulário do item: o único da lista com o título e o ano dele. */
async function locate(
  op: ProductionOp,
  t: ProductionTarget,
  port: LattesPort,
  menu: string,
): Promise<{ controls: FormControl[]; html: string; path: string }> {
  const params = { ...t.list.params, ...op.listParams };
  // Parâmetro vazio: a lista que não o tem (o programa de computador com
  // registro é a lista de PC sem f_reg; a sem registro tem f_reg=N).
  const lists = findLinks(menu, t.list.proc).filter((l) =>
    Object.entries(params).every(([k, v]) => (v === '' ? !l.params[k] : l.params[k] === v)),
  );
  // A mesma lista aparece às vezes também com f_sta_divulgacao_cientifica.
  const list = lists.find((l) => !('f_sta_divulgacao_cientifica' in l.params)) ?? lists[0];
  if (!list) throw new Stop('erro', `O menu do Lattes não tem a lista (${t.list.proc})`);
  const listHtml = await getChecked(port, list.path);
  const titleField = t.title.field ?? 'f_titulo';
  const yearField = t.year.field ?? 'f_ano';
  const found: { controls: FormControl[]; html: string; path: string }[] = [];
  const isRow = t.list.isRow ?? ((p: Record<string, string>) => Boolean(p.f_seq));
  for (const link of findLinks(listHtml, t.list.formProc).filter((l) => isRow(l.params))) {
    const html = await getChecked(port, link.path);
    const controls = withScriptValues(html, port.readForm(html, t.form.name));
    if (!controls) continue;
    if (
      folded(valueOf(controls, titleField)) === folded(op.match.title) &&
      shownYear(controls, yearField, t.year.fallback) === op.match.year &&
      sameNature(controls, t)
    ) {
      found.push({ controls, html, path: link.path });
    }
  }
  if (found.length === 0) {
    throw new Stop(
      'divergente',
      'O Lattes não tem um item com esse título e esse ano; nada foi enviado',
    );
  }
  if (found.length > 1) {
    throw new Stop(
      'divergente',
      'O Lattes tem mais de um item com esse título e esse ano; nada foi enviado',
    );
  }
  return found[0]!;
}

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
    const { controls, html, path } = await locate(op, t, port, menu);
    const pairs = successfulPairs(controls);
    if (pairValue(pairs, 'f_ctr') !== 'U') {
      return result('erro', 'O formulário não está em modo de alteração');
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
    if (opaque.filled.length > 0) {
      return result(
        'erro',
        `O item tem no Lattes ${opaque.filled.map((g) => g.label).join(', ')}, que o conector não sabe reenviar; nada foi enviado`,
      );
    }

    // O antes: os campos que a alteração troca, e as grades que ela mexe.
    // Duas mudanças na mesma grade viram operações iguais (members.ts): a
    // segunda acha o Lattes já como o editor quer e não envia nada.
    if (
      op.authors &&
      !op.keywords &&
      fields.length === 0 &&
      sameAuthors(grids.f_autores_l ?? [], op.authors.after)
    ) {
      return result('conferido', 'O Lattes já estava assim; nada foi enviado');
    }
    // Só o que tem um antes conferido: o que a página limpa junto (clears) e o
    // texto pedido fora do XML (asks) vão sem.
    const wrong = fields.filter(
      (f) => f in op.expect && folded(pairValue(pairs, f)) !== folded(op.expect[f]),
    );
    if (op.keywords && !sameWords(keywordLabels(grids.f_plv_l ?? []), op.keywords.before)) {
      wrong.push('f_plv_l');
    }
    if (op.authors && !sameAuthors(grids.f_autores_l ?? [], op.authors.before)) {
      wrong.push('f_autores_l');
    }
    for (const f of virtualFields) {
      if (f in op.expect && folded(virtualNow[f] ?? '') !== folded(op.expect[f])) wrong.push(f);
    }
    if (wrong.length > 0) {
      return result(
        'divergente',
        `O Lattes não está como o editor espera: ${wrong.map((f) => labelOf(op, f)).join(', ')}`,
      );
    }

    // As grades: as lidas, e no lugar delas as que a alteração troca.
    const replace: Grids = {};
    if (op.keywords) replace.f_plv_l = keywordRows(grids.f_plv_l ?? [], op.keywords.after);
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
    chosen = { ...built, ...virtualBuilt, ...chosen };
    // A página carrega esses campos vazios: a releitura não os confere.
    for (const k of Object.keys({ ...built, ...virtualBuilt })) chosenCheck[k] = null;
    posted = true;
    const response = await port.post(
      t.form.action,
      encodeLatin1Form(
        setPairs(pairs, {
          ...set,
          ...chosen,
          ...gridPairs(grids, replace, t.gridKeys),
          ...opaquePairs(t.opaqueGrids ?? []),
        }),
      ),
    );
    if (isLogonPage(response)) return result('sessao', 'A sessão do Lattes expirou; entre de novo');

    // Releitura.
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
    const notSaved = fields.filter((f) => folded(pairValue(afterPairs, f)) !== folded(op.set[f]));
    if (op.keywords && !sameWords(keywordLabels(afterGrids.f_plv_l ?? []), op.keywords.after)) {
      notSaved.push('f_plv_l');
    }
    if (op.authors && !sameAuthors(afterGrids.f_autores_l ?? [], op.authors.after)) {
      notSaved.push('f_autores_l');
    }
    // Os virtuais, lidos de novo do vetor da página.
    const virtualAfter = virtualFields.length > 0 ? t.virtual?.read(afterHtml) : {};
    for (const f of virtualFields) {
      if (folded(virtualAfter?.[f] ?? '') !== folded(op.set[f])) notSaved.push(f);
    }
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
      new Set([...fields, ...Object.keys(chosen), ...t.grids, ...opaqueFields]),
    );
    const changed = [
      ...lost.map((g) => GRID_LABELS[g]),
      ...afterOpaque.filled.map((g) => g.label),
      ...others,
    ];
    if (changed.length > 0) {
      return result(
        'divergente',
        `Outros campos mudaram no Lattes: ${changed.join(', ')}. Confira no Lattes`,
      );
    }
    return result('conferido', 'Gravado e conferido no Lattes');
  } catch (err) {
    if (err instanceof Stop) return result(err.status, err.message);
    const why = err instanceof Error ? err.message : String(err);
    // Depois do POST, sem saber se gravou: divergente, como as outras falhas no meio.
    return posted
      ? result('divergente', `Falha no meio do envio (${why}); confira no Lattes`)
      : result('erro', `Falha ao ler o Lattes (${why}); nada foi enviado`);
  }
}
