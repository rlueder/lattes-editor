// Currículo de exemplo para testar o editor sem um currículo real: com
// ?exemplo na URL e nenhum currículo aberto, carrega
// fixtures/synthetic_full.xml, que tem todo elemento e todo atributo do
// schema (todas as seções preenchidas, todos os valores falsos).
//
// Só existe no `pnpm dev`: main.tsx importa este módulo atrás de
// import.meta.env.DEV, e no build ele nem entra no bundle. `pnpm dev:exemplo`
// abre o editor numa porta própria, e o IndexedDB, que é por origem, fica
// separado do currículo de verdade aberto na porta padrão.

import { loadCv } from '../model/document.ts';
import { loadWorkingCopy, newWorkingCopy, replaceWorkingCopy } from '../model/store.ts';

export const EXAMPLE_URL = '/fixtures/synthetic_full.xml';

/** Abre o exemplo se a URL pedir e não houver currículo; devolve se abriu. */
export async function openExampleIfAsked(search: string): Promise<boolean> {
  if (!new URLSearchParams(search).has('exemplo')) return false;
  // Um currículo já aberto (o exemplo editado, ou outro) nunca é substituído.
  if (await loadWorkingCopy()) return false;
  const res = await fetch(EXAMPLE_URL);
  if (!res.ok) throw new Error(`${EXAMPLE_URL} respondeu ${res.status}`);
  const cv = await loadCv(new Uint8Array(await res.arrayBuffer()), 'synthetic_full.xml');
  await replaceWorkingCopy(newWorkingCopy(cv, Date.now()));
  return true;
}
