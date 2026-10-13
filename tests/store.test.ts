import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BridgeOp } from '../src/bridge/plan.ts';
import { sentEntry } from '../src/bridge/sent-log.ts';
import { importStorageKey, randomKeyBytes } from '../src/model/seal.ts';
import type { WorkingCopy } from '../src/model/store.ts';

type Store = typeof import('../src/model/store.ts');
let store: Store;
let key: CryptoKey;

const copy = (xml: string, savedAt: number): WorkingCopy => ({
  encoding: 'ISO-8859-1',
  fileName: 'curriculo.xml',
  id: 'current',
  loadedAt: 1,
  loadedMaxSequencia: 3,
  nextSequencia: 4,
  originalXml: '<CURRICULO-VITAE/>',
  savedAt,
  xml,
});

const resumo = (texto: string): BridgeOp => ({
  expect: { F_TEXTO: 'antes' },
  key: `resumo-${texto}`,
  kind: 'resumo',
  label: 'Resumo',
  set: { F_TEXTO: texto },
});

beforeAll(async () => {
  // Um banco da versão 1, em claro, como o de quem já usava o editor antes do
  // registro do enviado e da cifra: a versão 2 não perde nada, e abrir com a
  // chave cifra o que estava em claro.
  const v1 = new Dexie('lattes-editor');
  v1.version(1).stores({ history: '++id, savedAt', working: 'id' });
  await v1.table('working').put(copy('<v1/>', 10));
  await v1.table('history').add({ note: 'Arquivo carregado', savedAt: 10, xml: '<v1/>' });
  v1.close();
  store = await import('../src/model/store.ts');
  key = await importStorageKey(randomKeyBytes());
});

describe('banco local (IndexedDB)', () => {
  it('sem chave, não lê nem grava nada', async () => {
    expect(store.storageStatus().status).toBe('sem-chave');
    expect(await store.loadWorkingCopy()).toBeUndefined();
    await store.saveWorkingCopy(copy('<nao/>', 11), 'não grava');
    expect(await store.db.history.count()).toBe(1);
  });

  it('a versão 2 mantém os dados da 1, e abrir com a chave cifra o que estava em claro', async () => {
    expect(await store.openStorage(key)).toBe('cifrado');
    expect((await store.loadWorkingCopy())?.xml).toBe('<v1/>');
    expect((await store.listHistory()).map((h) => h.xml)).toEqual(['<v1/>']);
    expect(await store.listSent('0000000000000001')).toEqual([]);
    const raw = [...(await store.db.working.toArray()), ...(await store.db.history.toArray())];
    for (const row of raw) {
      expect(row.sealed).toBeDefined();
      expect(JSON.stringify(row)).not.toContain('<v1/>');
      expect(row).not.toHaveProperty('xml');
    }
  });

  describe('depois de começar do zero', () => {
    beforeEach(async () => {
      await store.db.transaction('rw', store.db.working, store.db.history, store.db.sent, () =>
        Promise.all([store.db.working.clear(), store.db.history.clear(), store.db.sent.clear()]),
      );
    });

    it('guarda só os últimos pontos de histórico, do mais recente ao mais antigo', async () => {
      for (let i = 1; i <= store.HISTORY_LIMIT + 2; i++) {
        await store.saveWorkingCopy(copy(`<v${i}/>`, i), `edição ${i}`);
      }
      const history = await store.listHistory();
      expect(history).toHaveLength(store.HISTORY_LIMIT);
      expect(history[0]?.note).toBe(`edição ${store.HISTORY_LIMIT + 2}`);
      expect(history.at(-1)?.note).toBe('edição 3');
      expect((await store.loadWorkingCopy())?.xml).toBe(`<v${store.HISTORY_LIMIT + 2}/>`);
    });

    it('o registro do enviado é por currículo, do mais recente ao mais antigo', async () => {
      const a = await store.addSent(sentEntry(resumo('um'), '0000000000000001', 100));
      await store.addSent(sentEntry(resumo('dois'), '0000000000000001', 300));
      await store.addSent(sentEntry(resumo('outro'), '0000000000000002', 200));
      await store.addSent(
        sentEntry(resumo('antes'), '0000000000000001', 400, { undoOf: a ?? undefined }),
      );
      const sent = await store.listSent('0000000000000001');
      expect(sent.map((e) => e.sentAt)).toEqual([400, 300, 100]);
      expect(sent[0]?.undoOf).toBe(a);
      expect(sent[0]?.rows).toEqual([
        { after: 'antes', before: 'antes', label: 'Resumo', name: 'F_TEXTO' },
      ]);
      expect((await store.listSent('0000000000000002')).map((e) => e.op.label)).toEqual(['Resumo']);
    });

    it('os pontos de antes do envio ficam fora da rotação das edições', async () => {
      await store.addHistoryPoint({
        keep: true,
        note: 'Lattes antes do envio',
        savedAt: 1,
        xml: '<a/>',
      });
      for (let i = 2; i <= store.HISTORY_LIMIT + 5; i++) {
        await store.saveWorkingCopy(copy(`<v${i}/>`, i), `edição ${i}`);
      }
      const notes = (await store.listHistory()).map((h) => h.note);
      expect(notes).toContain('Lattes antes do envio');
      expect(notes.filter((n) => n.startsWith('edição'))).toHaveLength(store.HISTORY_LIMIT);

      for (let i = 0; i < store.KEPT_LIMIT + 2; i++) {
        await store.addHistoryPoint({
          keep: true,
          note: `antes ${i}`,
          savedAt: 1000 + i,
          xml: '<b/>',
        });
      }
      const kept = (await store.listHistory()).filter((h) => h.keep);
      expect(kept).toHaveLength(store.KEPT_LIMIT);
      expect(kept.map((h) => h.note)).not.toContain('Lattes antes do envio');
    });

    it('uma linha que não abre fica de fora, sem derrubar a lista', async () => {
      await store.addSent(sentEntry(resumo('um'), '0000000000000001', 100));
      await store.addSent(sentEntry(resumo('dois'), '0000000000000001', 200));
      const [first] = await store.db.sent.toArray();
      await store.db.sent.update(first!.id!, {
        sealed: { data: new ArrayBuffer(8), iv: new Uint8Array(12) },
      });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect((await store.listSent('0000000000000001')).map((e) => e.sentAt)).toEqual([200]);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('apagar o registro do enviado vale só para aquele currículo', async () => {
      await store.addSent(sentEntry(resumo('um'), '0000000000000001', 100));
      await store.addSent(sentEntry(resumo('outro'), '0000000000000002', 200));
      await store.clearSent('0000000000000001');
      expect(await store.listSent('0000000000000001')).toEqual([]);
      expect(await store.listSent('0000000000000002')).toHaveLength(1);
    });

    it('abrir outra exportação e fechar o arquivo não apagam o registro do enviado', async () => {
      await store.addSent(sentEntry(resumo('um'), '0000000000000001', 100));
      await store.saveWorkingCopy(copy('<editado/>', 5), 'edição');

      await store.replaceWorkingCopy(copy('<novo/>', 6));
      expect((await store.listHistory()).map((h) => h.note)).toEqual(['Arquivo carregado']);
      expect(await store.listSent('0000000000000001')).toHaveLength(1);

      await store.clearAll();
      expect(await store.loadWorkingCopy()).toBeUndefined();
      expect(await store.listHistory()).toEqual([]);
      expect(await store.listSent('0000000000000001')).toHaveLength(1);
    });
  });

  describe('com a chave errada (chaveiro apagado)', () => {
    beforeEach(async () => {
      await store.db.transaction('rw', store.db.working, store.db.history, store.db.sent, () =>
        Promise.all([store.db.working.clear(), store.db.history.clear(), store.db.sent.clear()]),
      );
      await store.openStorage(key);
    });

    it('não lê nem grava, e começar de novo apaga o que não dá para ler', async () => {
      await store.saveWorkingCopy(copy('<secreto/>', 1), 'edição');
      await store.addSent(sentEntry(resumo('um'), '0000000000000001', 100));

      const other = await importStorageKey(randomKeyBytes());
      expect(await store.openStorage(other)).toBe('chave-perdida');
      expect(await store.loadWorkingCopy()).toBeUndefined();
      expect(await store.listSent('0000000000000001')).toEqual([]);
      await store.saveWorkingCopy(copy('<outro/>', 2), 'não grava');
      expect(await store.db.history.count()).toBe(1);

      await store.resetStorage();
      expect(store.storageStatus().status).toBe('cifrado');
      expect(await store.db.sent.count()).toBe(0);
      await store.saveWorkingCopy(copy('<novo/>', 3), 'edição');
      expect((await store.loadWorkingCopy())?.xml).toBe('<novo/>');
      await store.openStorage(other);
      expect(store.storageStatus().status).toBe('cifrado');
    });

    it('chaveiro indisponível guarda o motivo e para de gravar', async () => {
      expect(store.markStorageUnavailable('sem Secret Service')).toBe('sem-chave');
      expect(store.storageStatus()).toEqual({ reason: 'sem Secret Service', status: 'sem-chave' });
      expect(await store.addSent(sentEntry(resumo('x'), '1', 1))).toBeUndefined();
      expect(await store.listHistory()).toEqual([]);
      await store.addHistoryPoint({ note: 'n', savedAt: 1, xml: '<x/>' });
      await store.replaceWorkingCopy(copy('<x/>', 1));
      await store.resetStorage();
      expect(store.storageStatus().status).toBe('sem-chave');
      await store.openStorage(key);
    });
  });
});
