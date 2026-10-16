// Palavras-chave de um item que já está no Lattes (LAT-58), nos dois tipos de
// produção com grade de palavras: trabalho técnico (GN_RELATORIO, POST
// PKG_RELATORIO.FORM, aberto por pkg_relatorio.form na lista
// pkg_relatorio.lista) e outra produção bibliográfica (GN_BIB, POST
// PRC_BIB_OUTRAPROD, aberto por prc_bib_outraprod na lista
// prc_bib_demais_lista com f_cod_tipo=1Z).
//
// Observado no Lattes real em 16/10/2026, só por GET (seção 16 de
// docs/lattes_internals.md): os dois formulários vêm com f_ctr U e com os
// ocultos das quatro grades (f_autores_l, f_area_l, f_plv_l, f_setor_l)
// vazios. O check() de cada página é que os preenche, logo antes do envio,
// serializando os vetores escritos no próprio HTML (autorProvider,
// areaProvider, palavraProvider, setorProvider): de cada linha, os valores das
// chaves da lista do formulário, na ordem do objeto, unidos por "|"; as linhas
// unidas por "@". O nome e a citação dos autores passam antes por um
// decodificador de entidades HTML. Uma palavra já gravada vem com c igual à
// posição dela ("1", "2"...).
//
// Por isso esta operação não segue o caminho comum de apply.ts, que envia o
// formulário como veio: com as grades vazias, o envio apagaria autores, áreas
// e setores. Ela refaz as quatro grades como o check() faria, troca só a de
// palavras, e na releitura confere que as outras três voltaram iguais.
//
// Inferido: que uma palavra nova vá com c=-1, como na inclusão (seção 16);
// que o f_seq da lista abra o item (o censo achou f_seq e SEQUENCIA-PRODUCAO
// diferentes em 3 de 8 trabalhos técnicos, e por isso a linha se acha pelo
// título e pelo ano, nunca pelo número).

import type { Change } from '../model/changes.ts';
import { foldText } from '../model/fold-text.ts';
import { childElements, getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort, OpResult } from './apply.ts';
import { getChecked, Stop } from './create-shared.ts';
import {
  encodeLatin1Form,
  type FormControl,
  type Pairs,
  setPairs,
  successfulPairs,
} from './form.ts';
import { decodeHtmlEntities } from './html-text.ts';
import { findLinks, isLogonPage } from './lattes-html.ts';
import { parseJsLiteral } from './lattes-lists.ts';
import type { BridgeOp, OpBase } from './plan.ts';

/** Palavras-chave de trabalho técnico e outra produção bibliográfica. Ligada para o teste ao vivo. */
export const EDIT_KEYWORDS_ENABLED = true;

export type KeywordTarget = 'outra-bibliografica' | 'trabalho-tecnico';

interface Target {
  action: string;
  basics: string;
  element: string;
  form: string;
  formProc: string;
  listParams: Record<string, string>;
  listProc: string;
  titleAttr: string;
}

const TARGETS: Record<KeywordTarget, Target> = {
  'outra-bibliografica': {
    action: 'PRC_BIB_OUTRAPROD',
    basics: 'DADOS-BASICOS-DE-OUTRA-PRODUCAO',
    element: 'OUTRA-PRODUCAO-BIBLIOGRAFICA',
    form: 'GN_BIB',
    formProc: 'prc_bib_outraprod',
    listParams: { f_cod_tipo: '1Z' },
    listProc: 'prc_bib_demais_lista',
    titleAttr: 'TITULO',
  },
  'trabalho-tecnico': {
    action: 'PKG_RELATORIO.FORM',
    basics: 'DADOS-BASICOS-DO-TRABALHO-TECNICO',
    element: 'TRABALHO-TECNICO',
    form: 'GN_RELATORIO',
    formProc: 'pkg_relatorio.form',
    listParams: {},
    listProc: 'pkg_relatorio.lista',
    titleAttr: 'TITULO-DO-TRABALHO-TECNICO',
  },
};

export interface KeywordsOp extends OpBase {
  /** As palavras depois do envio, na ordem. */
  after: string[];
  /** As palavras que o Lattes tem de ter agora, na ordem. */
  before: string[];
  kind: 'palavras-chave';
  /** Título e ano do item, para achar a linha da lista. */
  match: { title: string; year: string };
  target: KeywordTarget;
}

export function isKeywordsOp(op: BridgeOp): op is KeywordsOp {
  return op.kind === 'palavras-chave';
}

/** O oculto de cada grade, o vetor que a página escreve e as chaves que o check() serializa. */
const GRIDS = [
  ['f_autores_l', 'autorProvider', ['c', 'l', 't', 'pais', 'add']],
  ['f_area_l', 'areaProvider', ['l', 'c', 'r', 'p']],
  ['f_plv_l', 'palavraProvider', ['l', 'c']],
  ['f_setor_l', 'setorProvider', ['l', 'c']],
] as const;

type GridField = (typeof GRIDS)[number][0];
export type GridRow = Record<string, unknown>;
export type Grids = Record<GridField, GridRow[]>;

/** Máximo de palavras da grade (palavraNumMaxRegistros, nos dois formulários). */
const MAX_KEYWORDS = 6;

/** O vetor `nome = [...]` da página, ou undefined se ela não o tem. */
export function readProvider(html: string, name: string): GridRow[] | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*`).exec(html);
  if (!m) return undefined;
  try {
    const { value } = parseJsLiteral(html, m.index + m[0].length);
    if (!Array.isArray(value)) return undefined;
    return value.filter((r): r is GridRow => !!r && typeof r === 'object');
  } catch {
    return undefined;
  }
}

/** As quatro grades da página; os autores já com as entidades decodificadas, como a página faz. */
export function readGrids(html: string): Grids | { missing: string } {
  const out: Partial<Grids> = {};
  for (const [field, provider] of GRIDS) {
    const rows = readProvider(html, provider);
    if (!rows) return { missing: provider };
    out[field] =
      field === 'f_autores_l'
        ? rows.map((r) =>
            Object.fromEntries(
              Object.entries(r).map(([k, v]) =>
                (k === 'l' || k === 't') && typeof v === 'string'
                  ? [k, decodeHtmlEntities(v)]
                  : [k, v],
              ),
            ),
          )
        : rows;
  }
  return out as Grids;
}

/** Uma grade como o check() a escreve no oculto. */
export function serializeGrid(rows: readonly GridRow[], keys: readonly string[]): string {
  const lines: string[] = [];
  for (const row of rows) {
    const values = Object.entries(row)
      .filter(([k]) => keys.includes(k))
      .map(([k, v]) => (k === 'r' ? `r${String(v)}` : String(v)));
    if (values.length > 0) lines.push(values.join('|'));
  }
  return lines.join('@');
}

const gridKeys = (field: GridField) => GRIDS.find(([f]) => f === field)![2];

/** Os quatro ocultos, com as palavras trocadas por estas linhas. */
export function gridPairs(grids: Grids, keywords: readonly GridRow[]): Record<GridField, string> {
  return {
    f_area_l: serializeGrid(grids.f_area_l, gridKeys('f_area_l')),
    f_autores_l: serializeGrid(grids.f_autores_l, gridKeys('f_autores_l')),
    f_plv_l: serializeGrid(keywords, gridKeys('f_plv_l')),
    f_setor_l: serializeGrid(grids.f_setor_l, gridKeys('f_setor_l')),
  };
}

const keywordLabels = (rows: readonly GridRow[]) =>
  rows.map((r) => r.l).filter((l): l is string => typeof l === 'string' && l.trim() !== '');

const sameWords = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length &&
  a.every((w, i) => foldText(decodeHtmlEntities(w).trim()) === foldText(b[i]!.trim()));

/**
 * A linha de uma palavra nova, com l antes de c: a serialização segue a ordem
 * das chaves do objeto (como o check() da página), e um literal de objeto
 * teria as chaves reordenadas pelo lint.
 */
const newKeyword = (word: string): GridRow =>
  Object.fromEntries([
    ['l', word],
    ['c', '-1'],
  ]);

/**
 * As linhas da grade de palavras depois do envio: a palavra que já estava
 * segue com a linha dela (o c da posição); a nova entra com c=-1.
 */
export function keywordRows(current: readonly GridRow[], after: readonly string[]): GridRow[] {
  return after.map((word) => {
    const kept = current.find(
      (r) =>
        typeof r.l === 'string' &&
        foldText(decodeHtmlEntities(r.l).trim()) === foldText(word.trim()),
    );
    return kept ?? newKeyword(word);
  });
}

// Plano --------------------------------------------------------------------------

const ATTRS = Array.from({ length: MAX_KEYWORDS }, (_, i) => `PALAVRA-CHAVE-${i + 1}`);

const targetOf = (name: string | undefined): KeywordTarget | undefined =>
  (Object.entries(TARGETS) as [KeywordTarget, Target][]).find(([, t]) => t.element === name)?.[0];

/** A mudança é das palavras-chave de um item que esta operação leva? */
export function isKeywordsChange(change: Change, chain: XElement[]): boolean {
  return (
    change.element === 'PALAVRAS-CHAVE' &&
    (change.kind === 'novo' || change.kind === 'alterado') &&
    targetOf(chain.at(-2)?.name) !== undefined
  );
}

/** A operação das palavras-chave, ou o motivo de ficar à mão. */
export function planKeywords(
  change: Change,
  chain: XElement[],
  label: string,
): KeywordsOp | { reason: string } {
  const el = chain.at(-1);
  const item = chain.at(-2);
  const target = targetOf(item?.name);
  if (!el || !item || !target || el.name !== 'PALAVRAS-CHAVE') {
    return { reason: 'O item não existe mais na cópia de trabalho' };
  }
  const t = TARGETS[target];
  const basics = childElements(item, t.basics)[0];
  const title = (basics && getAttr(basics, t.titleAttr))?.trim() ?? '';
  const year = (basics && getAttr(basics, 'ANO'))?.trim() ?? '';
  if (!title || !year)
    return { reason: 'O item não tem título ou ano para achar a linha no Lattes' };
  const now = ATTRS.map((a) => getAttr(el, a) ?? '');
  const was = ATTRS.map((a, i) => {
    const f = change.fields.find((x) => x.attr === a);
    return f ? f.before : change.kind === 'novo' ? '' : now[i]!;
  });
  const words = (list: string[]) => list.map((w) => w.trim()).filter(Boolean);
  const before = words(was);
  const after = words(now);
  if (after.some((w) => /[|@]/.test(w))) {
    return { reason: 'Palavra-chave com "|" ou "@", que o Lattes usa para separar a grade' };
  }
  return {
    after,
    before,
    expect: { f_plv_l: before.join(', ') },
    key: change.key,
    kind: 'palavras-chave',
    label,
    match: { title, year },
    set: { f_plv_l: after.join(', ') },
    target,
  };
}

// Envio --------------------------------------------------------------------------

const valueOf = (controls: FormControl[], name: string) =>
  controls.find((c) => c.name === name)?.value ?? '';

/** O formulário do item: o único da lista com o título e o ano dele. */
async function locate(
  op: KeywordsOp,
  port: LattesPort,
): Promise<{ controls: FormControl[]; html: string; path: string }> {
  const t = TARGETS[op.target];
  const menu = await port.menuHtml();
  const lists = findLinks(menu, t.listProc).filter((l) =>
    Object.entries(t.listParams).every(([k, v]) => l.params[k] === v),
  );
  // A lista de outras produções aparece também com f_sta_divulgacao_cientifica.
  const list = lists.find((l) => !('f_sta_divulgacao_cientifica' in l.params)) ?? lists[0];
  if (!list) throw new Stop('erro', `O menu do Lattes não tem a lista (${t.listProc})`);
  const listHtml = await getChecked(port, list.path);
  const found: { controls: FormControl[]; html: string; path: string }[] = [];
  for (const link of findLinks(listHtml, t.formProc).filter((l) => l.params.f_seq)) {
    const html = await getChecked(port, link.path);
    const controls = port.readForm(html, t.form);
    if (!controls) continue;
    const sameTitle = foldText(valueOf(controls, 'f_titulo').trim()) === foldText(op.match.title);
    if (sameTitle && valueOf(controls, 'f_ano').trim() === op.match.year) {
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

/** Os campos que mudaram, fora as grades (que a página só preenche no envio). */
function otherChanges(a: Pairs, b: Pairs): string[] {
  const grid = new Set<string>(GRIDS.map(([f]) => f));
  const names = new Set([...a, ...b].map(([k]) => k).filter((k) => !grid.has(k)));
  const value = (p: Pairs, n: string) =>
    p
      .filter(([k]) => k === n)
      .map(([, v]) => v)
      .join('\n');
  return [...names].filter((n) => value(a, n) !== value(b, n));
}

export async function applyKeywords(op: KeywordsOp, port: LattesPort): Promise<OpResult> {
  const result = (status: OpResult['status'], detail: string): OpResult => ({
    detail,
    key: op.key,
    status,
  });
  if (!EDIT_KEYWORDS_ENABLED) {
    return result('erro', 'Esta extensão não altera palavras-chave; a alteração fica à mão');
  }
  if (op.after.length > MAX_KEYWORDS) {
    return result('erro', `O Lattes aceita até ${MAX_KEYWORDS} palavras-chave`);
  }
  const t = TARGETS[op.target];
  let posted = false;
  try {
    const { controls, html, path } = await locate(op, port);
    const pairs = successfulPairs(controls);
    if (pairs.find(([k]) => k === 'f_ctr')?.[1] !== 'U') {
      return result('erro', 'O formulário não está em modo de alteração');
    }
    const grids = readGrids(html);
    if ('missing' in grids) {
      return result(
        'erro',
        `A página do Lattes não tem a grade ${grids.missing}; nada foi enviado`,
      );
    }
    if (!sameWords(keywordLabels(grids.f_plv_l), op.before)) {
      return result('divergente', 'O Lattes não está como o editor espera: Palavras-chave');
    }
    const sent = gridPairs(grids, keywordRows(grids.f_plv_l, op.after));
    posted = true;
    const response = await port.post(t.action, encodeLatin1Form(setPairs(pairs, sent)));
    if (isLogonPage(response)) return result('sessao', 'A sessão do Lattes expirou; entre de novo');

    // Releitura: as palavras novas, e as outras grades e campos como estavam.
    const afterHtml = await getChecked(port, path);
    const afterControls = port.readForm(afterHtml, t.form);
    const afterGrids = readGrids(afterHtml);
    if (!afterControls || 'missing' in afterGrids) {
      return result(
        'divergente',
        'Depois do envio, a página do item não pôde ser relida; confira no Lattes',
      );
    }
    if (!sameWords(keywordLabels(afterGrids.f_plv_l), op.after)) {
      return result('divergente', 'O Lattes não gravou: Palavras-chave');
    }
    const lost = (['f_autores_l', 'f_area_l', 'f_setor_l'] as const).filter(
      (f) => serializeGrid(grids[f], gridKeys(f)) !== serializeGrid(afterGrids[f], gridKeys(f)),
    );
    const others = otherChanges(pairs, successfulPairs(afterControls));
    const changed = [...lost.map((f) => GRID_LABELS[f]), ...others];
    if (changed.length > 0) {
      return result('divergente', `Outros campos mudaram no Lattes: ${changed.join(', ')}`);
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

const GRID_LABELS: Record<GridField, string> = {
  f_area_l: 'Áreas do conhecimento',
  f_autores_l: 'Autores',
  f_plv_l: 'Palavras-chave',
  f_setor_l: 'Setores de atividade',
};

/** Rótulos para a lista do painel e do editor (field-labels.ts). */
export const KEYWORDS_FIELD_LABELS: Record<string, string> = { f_plv_l: 'Palavras-chave' };
