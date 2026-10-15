// A forma das linhas de autor que o menu do Lattes oferece às grades de
// autores (o vetor autorDP, docs/lattes_internals.md, seção 18), sem nenhum
// nome (LAT-57). Responde ao que falta para incluir produções e registros
// pelo conector: em que ordem vêm as chaves de cada linha (a grade serializa
// na ordem do objeto) e como é o código `c` da linha do dono do currículo,
// que check() reconhece por começar com "-", ser vazio ou ser "D".

import { foldText } from '../bridge/html-text.ts';

export interface AuthorShape {
  /** Quantas linhas com cada código, com letras como "A" e dígitos como "9". */
  codePatterns: Record<string, number>;
  /** As listas de chaves, na ordem do objeto, e quantas linhas têm cada uma. */
  keyOrders: Record<string, number>;
  /** A linha do dono (pelo nome dado), sem o nome: chaves e o padrão do código. */
  owner?: { codePattern: string; keys: string[]; matches: number };
  total: number;
}

/** O código sem valor: letras viram A, dígitos viram 9, o resto fica. */
const pattern = (value: unknown) =>
  String(value ?? '')
    .replace(/[A-Za-z]/g, 'A')
    .replace(/\d/g, '9');

export function authorShape(rows: unknown, ownerName?: string): AuthorShape {
  const list = Array.isArray(rows) ? rows : [];
  const keyOrders: Record<string, number> = {};
  const codePatterns: Record<string, number> = {};
  const target = ownerName ? foldText(ownerName) : '';
  let owner: AuthorShape['owner'];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const keys = Object.keys(record);
    keyOrders[keys.join(',')] = (keyOrders[keys.join(',')] ?? 0) + 1;
    const code = pattern(record.c);
    codePatterns[code] = (codePatterns[code] ?? 0) + 1;
    if (target && foldText(String(record.l ?? '')) === target) {
      owner = { codePattern: code, keys, matches: (owner?.matches ?? 0) + 1 };
    }
  }
  return { codePatterns, keyOrders, ...(owner ? { owner } : {}), total: list.length };
}
