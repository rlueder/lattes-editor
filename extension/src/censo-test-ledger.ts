// A base das listas e o registro do que os itens de teste acrescentaram, na
// página do Lattes (docs/lattes-formularios/itens-de-teste.md). As regras
// puras ficam em src/census/test-ledger.ts.

import { snapshotCvLists } from '../../src/bridge/cv-lists.ts';
import {
  diffSnapshots,
  listKey,
  type ListSnapshot,
  type PlacedRow,
} from '../../src/census/test-ledger.ts';
import { TEST_MARK } from '../../src/census/test-plan.ts';

const BASE = 'lattes-editor:itens-de-teste:base';

interface StoredBase {
  at: string;
  lists: ListSnapshot;
}

export function loadBase(): StoredBase | undefined {
  try {
    const raw = localStorage.getItem(BASE);
    return raw ? (JSON.parse(raw) as StoredBase) : undefined;
  } catch {
    return undefined;
  }
}

/** Sem armazenamento, não há base, e a passada não começa: é melhor que seguir sem ela. */
export function saveBase(lists: ListSnapshot): void {
  localStorage.setItem(BASE, JSON.stringify({ at: new Date().toISOString(), lists }));
}

export function clearBase(): void {
  localStorage.removeItem(BASE);
}

/** Todas as listas que o menu abre, e as de dentro delas (src/bridge/cv-lists.ts). */
export async function snapshotLists(
  menuHtml: string,
  code: string,
  get: (path: string) => Promise<{ html: string }>,
): Promise<ListSnapshot> {
  return snapshotCvLists(menuHtml, code, async (path) => (await get(path)).html);
}

/** O que mudou em relação à base agora: o registro do que entrou e o que sumiu. */
export async function ledgerNow(
  menuHtml: string,
  code: string,
  get: (path: string) => Promise<{ html: string }>,
): Promise<{ added: PlacedRow[]; missing: PlacedRow[]; now: ListSnapshot }> {
  const base = loadBase();
  if (!base) throw new Error('Sem a base das listas: rode "Ler formulários" antes de criar.');
  const now = await snapshotLists(menuHtml, code, get);
  return { ...diffSnapshots(base.lists, now), now };
}

/**
 * Uma atuação só sai inteira (dele(), que leva atividades, vínculos e
 * projetos) se a página dela não existia na base: é uma atuação de teste.
 */
export function newAtuacao(row: PlacedRow): boolean {
  const base = loadBase();
  return !!base && /cargos_vinculos/i.test(row.link) && !(listKey(row.link) in base.lists);
}

/**
 * Quantas vezes a marca dos itens de teste aparece no currículo inteiro, pela
 * versão atual da tela de envio (pkg_publicar.cv_espelho, só leitura). As
 * listas não mostram tudo: as atividades de uma atuação aparecem nelas só
 * pela natureza e pelo período, e 21 atividades de teste passaram assim pela
 * base de 18/10/2026. A versão atual mostra a descrição de cada uma.
 */
export async function markInCv(
  code: string,
  get: (path: string) => Promise<{ html: string }>,
): Promise<number> {
  const { html } = await get(`pkg_publicar.cv_espelho?f_cod=${code}&f_idioma=1`);
  return html.split(TEST_MARK).length - 1;
}
