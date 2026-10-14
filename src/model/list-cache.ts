// A cópia das listas do Lattes que o conector lê (src/bridge/lattes-lists.ts):
// áreas do conhecimento e agências. São dados públicos, mas vão cifrados como
// o resto do banco (src/model/store.ts); em claro só o nome e a data da leitura.

import { unseal } from './seal.ts';
import { seal } from './seal.ts';
import { db, storageKey } from './store.ts';

export type CachedListName = 'agencias' | 'areas';

export interface CachedList<T> {
  items: T;
  /** Quando o conector leu a lista no Lattes (ms). */
  readAt: number;
}

/** Guarda a lista no lugar da anterior. Sem chave, não guarda: vale só nesta sessão. */
export async function saveCachedList<T>(
  name: CachedListName,
  items: T,
  readAt: number,
): Promise<void> {
  const key = storageKey();
  if (!key) return;
  await db.lists.put({ name, readAt, sealed: await seal(key, { items }) });
}

/** A última leitura guardada, ou undefined se não há, ou se ela não abre. */
export async function loadCachedList<T>(name: CachedListName): Promise<CachedList<T> | undefined> {
  const key = storageKey();
  const row = key ? await db.lists.get(name) : undefined;
  if (!key || !row) return undefined;
  try {
    const { items } = await unseal<{ items: T }>(key, row.sealed);
    return { items, readAt: row.readAt };
  } catch (err) {
    console.warn('A cópia de uma lista do Lattes não pôde ser lida:', err);
    return undefined;
  }
}
