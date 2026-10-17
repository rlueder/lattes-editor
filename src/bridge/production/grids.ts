// As grades de autores, áreas, palavras-chave e setores dos formulários de
// produção, orientação e banca (seção 16 de docs/lattes_internals.md).
//
// Observado no Lattes real em 16/10/2026, só por GET: os formulários vêm com
// os ocultos das grades vazios, e o check() de cada página os preenche logo
// antes do envio, serializando os vetores escritos no próprio HTML
// (autorProvider, areaProvider, palavraProvider, setorProvider): de cada
// linha, os valores das chaves da lista do formulário, na ordem do objeto,
// unidos por "|"; as linhas unidas por "@". O nome e a citação dos autores
// passam antes por um decodificador de entidades HTML. Uma palavra já gravada
// vem com c igual à posição dela ("1", "2"...).
//
// Por isso o envio não pode ir com o formulário como veio do GET: com as
// grades vazias, apagaria autores, áreas e setores. O motor refaz cada grade
// como o check() faria e troca só a que a alteração mexe.

import { foldText } from '../../model/fold-text.ts';
import { decodeHtmlEntities } from '../html-text.ts';
import { parseJsLiteral } from '../lattes-lists.ts';
import type { AuthorPart, GridField } from './types.ts';

export type GridRow = Record<string, unknown>;
export type Grids = Partial<Record<GridField, GridRow[]>>;

/** O vetor que a página escreve para cada grade e as chaves que o check() serializa. */
export const GRID_SPECS: Record<GridField, { keys: readonly string[]; provider: string }> = {
  f_area_l: { keys: ['l', 'c', 'r', 'p'], provider: 'areaProvider' },
  f_autores_l: { keys: ['c', 'l', 't', 'pais', 'add'], provider: 'autorProvider' },
  f_plv_l: { keys: ['l', 'c'], provider: 'palavraProvider' },
  f_setor_l: { keys: ['l', 'c'], provider: 'setorProvider' },
};

export const GRID_LABELS: Record<GridField, string> = {
  f_area_l: 'Áreas do conhecimento',
  f_autores_l: 'Autores',
  f_plv_l: 'Palavras-chave',
  f_setor_l: 'Setores de atividade',
};

/**
 * Os autores de uma produção. Só o nome e a ordem vão: o autor que já está
 * na grade segue com a citação da linha dele, e a conferência compara os
 * nomes. Sem isso, trocar só a citação voltava "conferido" com o Lattes
 * guardando a antiga.
 */
export const AUTHOR_PART: AuthorPart = {
  citation: 'NOME-PARA-CITACAO',
  cnpq: 'NRO-ID-CNPQ',
  element: 'AUTORES',
  label: 'Autores',
  name: 'NOME-COMPLETO-DO-AUTOR',
  order: 'ORDEM-DE-AUTORIA',
  sent: ['NOME-COMPLETO-DO-AUTOR', 'ORDEM-DE-AUTORIA'],
};

/**
 * Os participantes de uma banca, na mesma grade f_autores_l (seção 21 de
 * docs/lattes_internals.md: o check() das bancas exige o próprio nome nela).
 * Inferido: que a página escreva o vetor como autorProvider, igual ao do
 * trabalho técnico; o censo não guardou os scripts das bancas. A grade não
 * tem CPF, e a citação de quem já está na grade segue a da linha dela, então
 * só o nome e a ordem vão.
 */
export const BANCA_PARTICIPANTS: AuthorPart = {
  citation: 'NOME-PARA-CITACAO-DO-PARTICIPANTE-DA-BANCA',
  cnpq: 'NRO-ID-CNPQ',
  element: 'PARTICIPANTE-BANCA',
  label: 'Participantes da banca',
  name: 'NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA',
  order: 'ORDEM-PARTICIPANTE',
  sent: ['NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA', 'ORDEM-PARTICIPANTE'],
};

/** Máximo de palavras da grade (palavraNumMaxRegistros). */
export const MAX_KEYWORDS = 6;

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

/** As grades pedidas, lidas da página; os autores já decodificados, como a página faz. */
export function readGrids(html: string, fields: readonly GridField[]): Grids | { missing: string } {
  const out: Grids = {};
  for (const field of fields) {
    const { provider } = GRID_SPECS[field];
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
  return out;
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

/** As chaves que o check() serializa na grade, com as do tipo no lugar das comuns. */
export const gridKeysOf = (
  field: GridField,
  keys: Partial<Record<GridField, readonly string[]>> = {},
): readonly string[] => keys[field] ?? GRID_SPECS[field].keys;

/** Os ocultos das grades, com as que a alteração troca no lugar das lidas. */
export function gridPairs(
  grids: Grids,
  replace: Grids = {},
  keys: Partial<Record<GridField, readonly string[]>> = {},
): Record<string, string> {
  return Object.fromEntries(
    (Object.keys(grids) as GridField[]).map((f) => [
      f,
      serializeGrid(replace[f] ?? grids[f] ?? [], gridKeysOf(f, keys)),
    ]),
  );
}

export const keywordLabels = (rows: readonly GridRow[]) =>
  rows.map((r) => r.l).filter((l): l is string => typeof l === 'string' && l.trim() !== '');

const same = (a: string, b: string) =>
  foldText(decodeHtmlEntities(a).trim()) === foldText(decodeHtmlEntities(b).trim());

export const sameWords = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((w, i) => same(w, b[i]!));

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
  return after.map(
    (word) => current.find((r) => typeof r.l === 'string' && same(r.l, word)) ?? newKeyword(word),
  );
}

/** Um autor do XML: o nome, a citação e o ID CNPq, quando há. */
export interface AuthorSpec {
  citation: string;
  cnpq: string;
  /** Na grade com a marca de responsável (a equipe do projeto): se é o responsável. */
  lead?: boolean;
  name: string;
}

export const authorNames = (rows: readonly GridRow[]) =>
  rows.map((r) => r.l).filter((l): l is string => typeof l === 'string' && l.trim() !== '');

/**
 * As linhas da grade de autores depois do envio, na ordem do XML. O autor que
 * já está na grade segue com a linha dela; o que não está sai da lista de
 * autores conhecidos do menu (autorDP, com l, c, t), como a sugestão da página
 * faria. Autor que não está em nenhuma das duas fica de fora: o formato de
 * um coautor digitado na hora não foi observado. Devolve os que faltaram.
 */
export function authorRows(
  current: readonly GridRow[],
  known: readonly { c: string; l: string; t: string }[],
  after: readonly AuthorSpec[],
): { missing: string[]; rows: GridRow[] } {
  const rows: GridRow[] = [];
  const missing: string[] = [];
  for (const a of after) {
    const kept = current.find((r) => typeof r.l === 'string' && same(r.l, a.name));
    if (kept) {
      rows.push(kept);
      continue;
    }
    const menu = known.find((k) => same(k.l, a.name) || (a.citation && same(k.t, a.citation)));
    if (!menu) {
      missing.push(a.name);
      continue;
    }
    rows.push(
      Object.fromEntries([
        ['l', menu.l],
        ['c', menu.c],
        ['t', menu.t],
        ['deletable', true],
      ]),
    );
  }
  return { missing, rows };
}
