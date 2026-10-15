// A grade de autores (e de equipe) dos formulários do Lattes, como o check()
// de cada página a serializa (docs/lattes_internals.md, seções 16, 21 e 22).
//
// Observado (recaptura de 15/10/2026): a inclusão abre a grade vazia; o
// check() exige a própria pessoa nela, e a reconhece pela linha cujo código
// `c` é vazio (ou começa com "-", ou é "D"); a serialização junta, de cada
// linha, os valores das chaves da lista do formulário (c, l, t, pais, add; nos
// registros também tit; no projeto c, l, t, tit, add) na ordem do objeto, com
// "|", e as linhas com "@". As linhas escolhidas na sugestão vêm do vetor
// autorDP do menu, com as chaves l, c, t e deletable nessa ordem (14 linhas,
// lote 4), e update.grid() as copia para a linha da grade; o vetor tem uma
// linha só com `c` vazio. Inferido: que essa linha seja a da própria pessoa
// (é a única que o check() aceita, e recuperaPosicaoUsuario() do projeto a
// procura por "||").

import { decodeHtmlEntities } from './html-text.ts';
import { parseJsLiteral } from './lattes-lists.ts';

export interface MenuAuthor {
  c: string;
  l: string;
  t: string;
}

/** As linhas do vetor autorDP do menu (`autorDP = [...]`), lidas como literal. */
export function menuAuthors(menuHtml: string): MenuAuthor[] | undefined {
  const m = /\bautorDP\s*=\s*/.exec(menuHtml);
  if (!m) return undefined;
  try {
    const { value } = parseJsLiteral(menuHtml, m.index + m[0].length);
    if (!Array.isArray(value)) return undefined;
    const rows: MenuAuthor[] = [];
    for (const raw of value) {
      if (!raw || typeof raw !== 'object') return undefined;
      const r = raw as Record<string, unknown>;
      if (typeof r.l !== 'string' || typeof r.t !== 'string') return undefined;
      rows.push({ c: String(r.c ?? ''), l: decodeHtmlEntities(r.l), t: decodeHtmlEntities(r.t) });
    }
    return rows;
  } catch {
    return undefined;
  }
}

/** A linha da própria pessoa: a única com o código vazio; undefined se não houver uma só. */
export function ownerAuthor(menuHtml: string): MenuAuthor | undefined {
  const own = (menuAuthors(menuHtml) ?? []).filter((r) => r.c.trim() === '');
  return own.length === 1 ? own[0] : undefined;
}

/**
 * A grade serializada como o check() a monta: de cada linha, os valores das
 * chaves de `keys`, na ordem em que estão no objeto, unidos por "|"; as linhas
 * unidas por "@".
 */
export function serializeGrid(rows: Record<string, unknown>[], keys: readonly string[]): string {
  return rows
    .map((row) =>
      Object.entries(row)
        .filter(([k]) => keys.includes(k))
        .map(([, v]) => String(v))
        .join('|'),
    )
    .filter((line) => line !== '')
    .join('@');
}

/** As chaves que cada formulário serializa em f_autores_l (seção 21). */
export const AUTHOR_KEYS = ['c', 'l', 't', 'pais', 'add'] as const;
export const REGISTRY_AUTHOR_KEYS = ['c', 'l', 't', 'pais', 'add', 'tit'] as const;
export const TEAM_KEYS = ['c', 'l', 't', 'tit', 'add'] as const;

/**
 * A linha da própria pessoa como a grade a guarda depois de escolhida na
 * sugestão: a linha do autorDP com editable (update.grid), e as chaves a mais
 * que o formulário põe (tit "s" para o coordenador do projeto).
 */
export function ownerGridRow(
  owner: MenuAuthor,
  extra: Record<string, string> = {},
): Record<string, unknown> {
  // A ordem das chaves é a do autorDP (l, c, t) e decide a ordem dos valores
  // na serialização: por isso a linha se monta de uma lista, e não de um
  // objeto literal, que o lint reordenaria.
  return Object.fromEntries([
    ['l', owner.l],
    ['c', owner.c],
    ['t', owner.t],
    ['deletable', false],
    ['editable', false],
    ...Object.entries(extra),
  ]);
}
