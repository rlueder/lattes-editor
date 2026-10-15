// A forma das linhas de autor que o menu do Lattes oferece às grades de
// autores (o vetor autorDP, docs/lattes_internals.md, seção 18), sem nenhum
// nome (LAT-57). Responde ao que falta para incluir produções e registros
// pelo conector: em que ordem vêm as chaves de cada linha (a grade serializa
// na ordem do objeto) e como é o código `c` da linha do dono do currículo,
// que check() reconhece por começar com "-", ser vazio ou ser "D".

import { foldText } from '../bridge/html-text.ts';

export interface OwnerMatch {
  /** Por qual chave a linha casou: o nome (`l`) ou a citação (`t`). */
  by: 'l' | 't';
  codePattern: string;
  keys: string[];
}

export interface AuthorShape {
  /** Quantas linhas com cada código, com letras como "A" e dígitos como "9". */
  codePatterns: Record<string, number>;
  /**
   * A linha com o código vazio, a que o check() aceita como a própria pessoa:
   * quantas há e se alguma casa com os nomes dados (pelo nome ou pela citação).
   */
  emptyCode: { count: number; matchesOwner?: boolean };
  /** As listas de chaves, na ordem do objeto, e quantas linhas têm cada uma. */
  keyOrders: Record<string, number>;
  /** Cada linha que casou com os nomes dados, sem o nome: chave, código e chaves. */
  owner?: { matches: OwnerMatch[] };
  total: number;
}

/** O código sem valor: letras viram A, dígitos viram 9, o resto fica. */
const pattern = (value: unknown) =>
  String(value ?? '')
    .replace(/[A-Za-z]/g, 'A')
    .replace(/\d/g, '9');

/**
 * A forma do vetor. `ownerNames` são o nome completo e as citações do dono:
 * uma linha casa quando o `l` é igual a um deles, ou o `t` é igual a um deles,
 * sem acento nem caixa.
 */
export function authorShape(rows: unknown, ownerNames?: string | string[]): AuthorShape {
  const list = Array.isArray(rows) ? rows : [];
  const keyOrders: Record<string, number> = {};
  const codePatterns: Record<string, number> = {};
  const targets = new Set(
    (Array.isArray(ownerNames) ? ownerNames : ownerNames ? [ownerNames] : [])
      .map((n) => foldText(n))
      .filter(Boolean),
  );
  const matches: OwnerMatch[] = [];
  const emptyCode: AuthorShape['emptyCode'] = { count: 0 };
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const keys = Object.keys(record);
    keyOrders[keys.join(',')] = (keyOrders[keys.join(',')] ?? 0) + 1;
    const code = pattern(record.c);
    codePatterns[code] = (codePatterns[code] ?? 0) + 1;
    const by = targets.has(foldText(String(record.l ?? '')))
      ? 'l'
      : targets.has(foldText(String(record.t ?? '')))
        ? 't'
        : undefined;
    if (by) matches.push({ by, codePattern: code, keys });
    if (String(record.c ?? '').trim() === '') {
      emptyCode.count += 1;
      if (targets.size > 0) emptyCode.matchesOwner = Boolean(emptyCode.matchesOwner || by);
    }
  }
  return {
    codePatterns,
    emptyCode,
    keyOrders,
    ...(targets.size > 0 ? { owner: { matches } } : {}),
    total: list.length,
  };
}
