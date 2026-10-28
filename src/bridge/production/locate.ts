// O formulário de um item na lista do Lattes: o único com o título, o ano e
// a natureza dele (applyProduction, apply.ts).

import { buildPath } from '../../census/run.ts';
import { CENSUS_TARGETS } from '../../census/targets-production.ts';
import type { LattesPort } from '../apply.ts';
import { getChecked, Stop } from '../create-shared.ts';
import { type FormControl, withScriptValues } from '../form.ts';
import { cvCodeFrom, findLinks, type LattesLink } from '../lattes-html.ts';
import { folded, type ProductionOp } from './plan.ts';
import type { ProductionTarget } from './types.ts';

/** Índice de títulos, sem guardar valores dos formulários entre operações. */
export type ProductionScans = Map<string, { html: string; titles: Map<string, string> }>;

/** O ano do item na página: o do campo, ou o da data de t.year.fallback quando ele vem vazio. */
function shownYear(controls: FormControl[], field: string, fallback?: string): string {
  const year = valueOf(controls, field).trim();
  if (year || !fallback) return year;
  return /^\d{2}\/\d{2}\/(\d{4})$/.exec(valueOf(controls, fallback).trim())?.[1] ?? '';
}

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

/** A lista do tipo no menu e as linhas dela (links de alteração). */
export async function productionRows(
  op: Pick<ProductionOp, 'listParams'>,
  t: ProductionTarget,
  port: LattesPort,
  menu: string,
): Promise<{ html: string; links: LattesLink[]; path: string }> {
  const params = { ...t.list.params, ...op.listParams };
  // Parâmetro vazio: a lista que não o tem (o programa de computador com
  // registro é a lista de PC sem f_reg; a sem registro tem f_reg=N).
  const lists = findLinks(menu, t.list.proc).filter((l) =>
    Object.entries(params).every(([k, v]) => (v === '' ? !l.params[k] : l.params[k] === v)),
  );
  // A mesma lista aparece às vezes também com f_sta_divulgacao_cientifica.
  const list = lists.find((l) => !('f_sta_divulgacao_cientifica' in l.params)) ?? lists[0];
  if (!list) throw new Stop('erro', `O menu do Lattes não tem a lista (${t.list.proc})`);
  const html = await getChecked(port, list.path);
  const isRow = t.list.isRow ?? ((p: Record<string, string>) => Boolean(p.f_seq));
  const links = findLinks(html, t.list.formProc).filter((l) => isRow(l.params));
  return { html, links, path: list.path };
}

/** O formulário do item: o único da lista com o título e o ano dele. */
export async function locate(
  op: Pick<ProductionOp, 'listParams' | 'match'>,
  t: ProductionTarget,
  port: LattesPort,
  menu: string,
): Promise<{ controls: FormControl[]; html: string; path: string }> {
  const { html: listHtml, links, path: listPath } = await productionRows(op, t, port, menu);
  const titleField = t.title.field ?? 'f_titulo';
  const yearField = t.year.field ?? 'f_ano';
  const found: { controls: FormControl[]; html: string; path: string }[] = [];
  const scans = port.productionScans;
  const scanKey = `${t.id}|${listPath}`;
  let scan = scans?.get(scanKey);
  if (!scan || scan.html !== listHtml) {
    scan = { html: listHtml, titles: new Map() };
    // Poucas categorias por vez; a cópia sai da memória ao recarregar a aba.
    if (scans && scans.size >= 8) scans.clear();
    scans?.set(scanKey, scan);
  }
  const title = folded(t.title.toForm ? t.title.toForm(op.match.title) : op.match.title);
  for (const link of links) {
    // Uma lista inalterada permite pular títulos diferentes, nunca reutilizar
    // os controles de uma gravação. Todos os homônimos são relidos para
    // conferir ano e natureza, inclusive quando já houve outra operação.
    const known = scan.titles.get(link.path);
    if (known !== undefined && known !== title) continue;
    const html = await getChecked(port, link.path);
    const controls = withScriptValues(html, port.readForm(html, t.form.name));
    if (!controls)
      throw new Stop('erro', 'Um formulário da lista não pôde ser lido; nada foi enviado');
    const observed = folded(valueOf(controls, titleField));
    scan.titles.set(link.path, observed);
    if (
      observed === title &&
      shownYear(controls, yearField, t.year.fallback) ===
        (t.year.toForm ? t.year.toForm(op.match.year) : op.match.year) &&
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

/**
 * O formulário de inclusão do tipo: o link da lista que não é de linha
 * ("Incluir novo item"), quando a lista ainda não tem item com o título e o
 * ano (a inclusão repetida faria um item igual).
 */
export async function inclusion(
  op: Pick<ProductionOp, 'listParams' | 'match'>,
  t: ProductionTarget,
  port: LattesPort,
  menu: string,
): Promise<{ controls: FormControl[]; html: string; path: string }> {
  try {
    await locate(op, t, port, menu);
    throw new Stop(
      'divergente',
      'O Lattes já tem um item com esse título e esse ano; nada foi enviado',
    );
  } catch (err) {
    if (!(err instanceof Stop) || !/não tem um item/.test(err.message)) throw err;
  }
  const path = inclusionPath(t, cvCodeFrom(menu) ?? '');
  if (!path) {
    throw new Stop('erro', 'O endereço da inclusão deste tipo não é conhecido; nada foi enviado');
  }
  const html = await getChecked(port, path);
  const controls = withScriptValues(html, port.readForm(html, t.form.name));
  if (!controls) {
    throw new Stop('erro', 'O formulário de inclusão não pôde ser lido; nada foi enviado');
  }
  return { controls, html, path };
}

/**
 * O formulário de inclusão do tipo, pelo endereço que o censo leu na lista
 * (census/targets-production.ts): o "à mão" do artigo, e não a entrada por
 * DOI ou por periódico que a mesma lista oferece.
 */
export function inclusionPath(t: ProductionTarget, code: string): string | undefined {
  const entry = CENSUS_TARGETS.find(
    (c) =>
      c.elements.includes(t.element) &&
      c.locate.kind === 'fixed' &&
      c.locate.proc.toLowerCase() === t.list.formProc.toLowerCase(),
  );
  return entry?.locate.kind === 'fixed' ? buildPath(code, entry.locate) : undefined;
}
