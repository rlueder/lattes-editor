import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';

import { importStorageKey, randomKeyBytes, seal } from '../src/model/seal.ts';

describe('migração do histórico cifrado da versão 4', () => {
  it('preserva XMLs e pontos marcados e cria notas pequenas para a lista', async () => {
    const key = await importStorageKey(randomKeyBytes());
    const old = new Dexie('lattes-editor');
    old.version(4).stores({
      history: '++id, savedAt',
      lists: 'name',
      sent: '++id, lattesId, sentAt',
      versions: '++id, lattesId, loadedAt',
      working: 'id',
    });
    const kept = await seal(key, { note: 'Ponto anterior', xml: '<guardado/>' });
    await old.table('history').add({ keep: true, savedAt: 1, sealed: kept });
    await old
      .table('history')
      .add({ savedAt: 2, sealed: await seal(key, { note: 'Edição antiga', xml: '<antigo/>' }) });
    old.close();
    const store = await import('../src/model/store.ts');
    try {
      await store.openStorage(key);
      const infos = await store.listHistoryInfo();
      expect(infos.map((info) => info.note)).toEqual(['Edição antiga', 'Ponto anterior']);
      expect((await store.getHistoryEntry(infos[1]!.id!))?.xml).toBe('<guardado/>');
      const row = await store.db.history.get(infos[1]!.id!);
      expect(row?.sealed).toEqual(kept);
      expect(row?.bucket).toBe(1);
      for (let i = 0; i < 52; i++)
        await store.addHistoryPoint({ note: 'Edição nova', savedAt: 10 + i, xml: '<novo/>' });
      expect((await store.listHistoryInfo()).filter((info) => !info.keep)).toHaveLength(50);
      expect((await store.listHistoryInfo()).filter((info) => info.keep)).toHaveLength(1);
      const notes = await store.db.historyNotes.toArray();
      expect(JSON.stringify(notes)).not.toContain('Ponto anterior');
    } finally {
      await store.db.delete();
    }
  });
});
