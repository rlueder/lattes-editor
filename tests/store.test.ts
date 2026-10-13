import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { BridgeOp } from '../src/bridge/plan.ts';
import { sentEntry } from '../src/bridge/sent-log.ts';
import type { WorkingCopy } from '../src/model/store.ts';

type Store = typeof import('../src/model/store.ts');
let store: Store;

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
  // Um banco da versão 1, como o de quem já usava o editor antes do registro
  // do que foi enviado, para conferir que a versão 2 não perde nada.
  const v1 = new Dexie('lattes-editor');
  v1.version(1).stores({ history: '++id, savedAt', working: 'id' });
  await v1.table('working').put(copy('<v1/>', 10));
  await v1.table('history').add({ note: 'Arquivo carregado', savedAt: 10, xml: '<v1/>' });
  v1.close();
  store = await import('../src/model/store.ts');
});

describe('banco local (IndexedDB)', () => {
  it('a versão 2 mantém a cópia de trabalho e o histórico da versão 1', async () => {
    expect((await store.loadWorkingCopy())?.xml).toBe('<v1/>');
    expect((await store.listHistory()).map((h) => h.xml)).toEqual(['<v1/>']);
    expect(await store.listSent('0000000000000001')).toEqual([]);
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
});
