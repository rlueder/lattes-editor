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
} from '../form.ts';
import { findLinks, isLogonPage } from '../lattes-html.ts';
import {
  authorNames,
  authorRows,
  GRID_LABELS,
  GRID_SPECS,
  gridPairs,
  type Grids,
  keywordLabels,
  keywordRows,
  MAX_KEYWORDS,
  readGrids,
  sameWords,
  serializeGrid,
} from './grids.ts';
import { EDIT_PRODUCTION_ENABLED, folded, type ProductionOp, productionTarget } from './plan.ts';
import type { GridField, ProductionTarget } from './types.ts';

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
  const lists = findLinks(menu, t.list.proc).filter((l) =>
    Object.entries(t.list.params ?? {}).every(([k, v]) => l.params[k] === v),
  );
  // A mesma lista aparece às vezes também com f_sta_divulgacao_cientifica.
  const list = lists.find((l) => !('f_sta_divulgacao_cientifica' in l.params)) ?? lists[0];
  if (!list) throw new Stop('erro', `O menu do Lattes não tem a lista (${t.list.proc})`);
  const listHtml = await getChecked(port, list.path);
  const titleField = t.title.field ?? 'f_titulo';
  const yearField = t.year.field ?? 'f_ano';
  const found: { controls: FormControl[]; html: string; path: string }[] = [];
  for (const link of findLinks(listHtml, t.list.formProc).filter((l) => l.params.f_seq)) {
    const html = await getChecked(port, link.path);
    const controls = port.readForm(html, t.form.name);
    if (!controls) continue;
    if (
      folded(valueOf(controls, titleField)) === folded(op.match.title) &&
      valueOf(controls, yearField).trim() === op.match.year &&
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

export async function applyProduction(op: ProductionOp, port: LattesPort): Promise<OpResult> {
  const result = (status: OpResult['status'], detail: string): OpResult => ({
    detail,
    key: op.key,
    status,
  });
  const t = productionTarget(op.target);
  if (!EDIT_PRODUCTION_ENABLED || !t) {
    return result('erro', 'Esta extensão não altera este tipo de item; a alteração fica à mão');
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
    const fields = Object.keys(op.set).filter((f) => !(f in GRID_SPECS));
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

    // O antes: os campos que a alteração troca, e as grades que ela mexe.
    const wrong = fields.filter((f) => folded(pairValue(pairs, f)) !== folded(op.expect[f]));
    if (op.keywords && !sameWords(keywordLabels(grids.f_plv_l ?? []), op.keywords.before)) {
      wrong.push('f_plv_l');
    }
    if (
      op.authors &&
      !sameWords(
        authorNames(grids.f_autores_l ?? []),
        op.authors.before.map((a) => a.name),
      )
    ) {
      wrong.push('f_autores_l');
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
      replace.f_autores_l = rows;
    }
    const set = Object.fromEntries(fields.map((f) => [f, op.set[f] ?? '']));
    posted = true;
    const response = await port.post(
      t.form.action,
      encodeLatin1Form(setPairs(pairs, { ...set, ...gridPairs(grids, replace) })),
    );
    if (isLogonPage(response)) return result('sessao', 'A sessão do Lattes expirou; entre de novo');

    // Releitura.
    const afterHtml = await getChecked(port, path);
    const afterControls = port.readForm(afterHtml, t.form.name);
    const afterGrids = readGrids(afterHtml, t.grids);
    if (!afterControls || 'missing' in afterGrids) {
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
    if (
      op.authors &&
      !sameWords(
        authorNames(afterGrids.f_autores_l ?? []),
        op.authors.after.map((a) => a.name),
      )
    ) {
      notSaved.push('f_autores_l');
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
        serializeGrid(grids[g] ?? [], GRID_SPECS[g].keys) !==
        serializeGrid(afterGrids[g] ?? [], GRID_SPECS[g].keys),
    );
    const others = otherChanges(pairs, afterPairs, new Set([...fields, ...t.grids]));
    const changed = [...lost.map((g) => GRID_LABELS[g]), ...others];
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
