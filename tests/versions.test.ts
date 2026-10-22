import 'fake-indexeddb/auto';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import Dexie from 'dexie';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { importStorageKey, randomKeyBytes } from '../src/model/seal.ts';
import type { LattesVersion, WorkingCopy } from '../src/model/store.ts';
import {
  childElements,
  cloneElement,
  parseXml,
  serializeXml,
  setAttr,
  walk,
  type XElement,
} from '../src/model/xml.ts';
import { buildSections } from '../src/ui/sections.ts';
import {
  diffSummary,
  diffVersions,
  exportDateOf,
  exportStamp,
  versionDate,
} from '../src/ui/version-diff.ts';

type Store = typeof import('../src/model/store.ts');
let store: Store;
let key: CryptoKey;

const copy = (xml: string): WorkingCopy => ({
  encoding: 'ISO-8859-1',
  fileName: 'curriculo.xml',
  id: 'current',
  loadedAt: 1,
  loadedMaxSequencia: 3,
  nextSequencia: 4,
  originalXml: xml,
  savedAt: 1,
  xml,
});

const version = (xml: string, loadedAt: number, lattesId = '0000000000000001') => ({
  exportedAt: '15032024 101500',
  lattesId,
  loadedAt,
  xml,
});

beforeAll(async () => {
  // Banco da versão 2, como o de quem já tinha o registro do enviado: a
  // versão 3 só acrescenta as versões do Lattes e não perde nada.
  const v2 = new Dexie('lattes-editor');
  v2.version(2).stores({
    history: '++id, savedAt',
    sent: '++id, lattesId, sentAt',
    working: 'id',
  });
  await v2.table('working').put(copy('<v2/>'));
  await v2.table('history').add({ note: 'Arquivo carregado', savedAt: 10, xml: '<v2/>' });
  v2.close();
  store = await import('../src/model/store.ts');
  key = await importStorageKey(randomKeyBytes());
});

describe('versões do Lattes no banco local', () => {
  it('a versão 3 mantém o que havia na 2', async () => {
    expect(await store.openStorage(key)).toBe('cifrado');
    expect((await store.loadWorkingCopy())?.xml).toBe('<v2/>');
    expect((await store.listHistory()).map((h) => h.note)).toEqual(['Arquivo carregado']);
    expect(await store.listVersions('0000000000000001')).toEqual([]);
  });

  describe('com a chave', () => {
    beforeEach(async () => {
      await store.openStorage(key);
      await store.db.versions.clear();
    });

    it('guarda a exportação cifrada, com só a data e o currículo em claro', async () => {
      expect((await store.addVersion(version('<CURRICULO-VITAE A="1"/>', 100))).added).toBe(true);
      const [row] = await store.db.versions.toArray();
      expect(row).toMatchObject({ exportedAt: '15032024 101500', lattesId: '0000000000000001' });
      expect(JSON.stringify(row)).not.toContain('CURRICULO-VITAE');
      expect((await store.listVersions('0000000000000001'))[0]?.xml).toBe(
        '<CURRICULO-VITAE A="1"/>',
      );
    });

    it('a mesma exportação aberta de novo não vira versão nova', async () => {
      await store.addVersion(version('<A/>', 100));
      expect((await store.addVersion(version('<A/>', 200))).added).toBe(false);
      expect((await store.addVersion(version('<B/>', 300))).added).toBe(true);
      expect((await store.addVersion(version('<A/>', 400))).added).toBe(true);
      const list = await store.listVersions('0000000000000001');
      expect(list.map((v) => v.xml)).toEqual(['<A/>', '<B/>', '<A/>']);
    });

    it('fica com as últimas, por currículo', async () => {
      for (let i = 0; i < store.VERSION_LIMIT + 3; i++) {
        await store.addVersion(version(`<V${i}/>`, i));
      }
      await store.addVersion(version('<outro/>', 1, '0000000000000002'));
      const list = await store.listVersions('0000000000000001');
      expect(list).toHaveLength(store.VERSION_LIMIT);
      expect(list[0]?.xml).toBe(`<V${store.VERSION_LIMIT + 2}/>`);
      expect(list.at(-1)?.xml).toBe('<V3/>');
      expect(await store.listVersions('0000000000000002')).toHaveLength(1);
      expect(await store.listVersions('0000000000000001', 1)).toHaveLength(1);
    });

    it('somando os currículos, as mais antigas saem além do teto', async () => {
      const perCv = 10;
      const cvs = Math.ceil(store.VERSION_TOTAL_LIMIT / perCv) + 1;
      for (let c = 0; c < cvs; c++) {
        for (let i = 0; i < perCv; i++) {
          await store.addVersion(
            version(`<C${c}V${i}/>`, c * 100 + i, String(c).padStart(16, '0')),
          );
        }
      }
      expect(await store.db.versions.count()).toBe(store.VERSION_TOTAL_LIMIT);
      // O primeiro currículo, o mais antigo, perdeu versões; o último ficou inteiro.
      expect((await store.listVersions('0'.padStart(16, '0'))).length).toBeLessThan(perCv);
      expect(await store.listVersions(String(cvs - 1).padStart(16, '0'))).toHaveLength(perCv);
    });

    it('a lista vem sem o XML; o teto geral nunca leva a nova nem a anterior', async () => {
      await store.addVersion(version('<A/>', 5000));
      // Uma versão nova com relógio atrasado: seria a mais antiga de todas.
      for (let i = 0; i < store.VERSION_TOTAL_LIMIT; i++) {
        await store.addVersion(version(`<X${i}/>`, 6000 + i, '0000000000000009'));
      }
      const res = await store.addVersion(version('<B/>', 1));
      expect(res.added).toBe(true);
      expect(await store.getVersion(res.previousId!)).toMatchObject({ xml: '<A/>' });
      const info = await store.listVersionInfo('0000000000000001');
      expect(info.map((v) => v.loadedAt).sort()).toEqual([1, 5000]);
      expect(info[0]).not.toHaveProperty('xml');
    });

    it('sobrevive a abrir outro arquivo e a fechar; apagar é por currículo', async () => {
      await store.addVersion(version('<A/>', 1));
      await store.addVersion(version('<B/>', 2, '0000000000000002'));
      await store.replaceWorkingCopy(copy('<novo/>'));
      await store.clearAll();
      expect(await store.listVersions('0000000000000001')).toHaveLength(1);
      await store.clearVersions('0000000000000001');
      expect(await store.listVersions('0000000000000001')).toEqual([]);
      expect(await store.listVersions('0000000000000002')).toHaveLength(1);
    });

    it('uma versão que não abre fica de fora', async () => {
      await store.addVersion(version('<A/>', 1));
      await store.addVersion(version('<B/>', 2));
      const [first] = await store.db.versions.orderBy('loadedAt').toArray();
      await store.db.versions.update(first!.id!, {
        sealed: { data: new ArrayBuffer(8), iv: new Uint8Array(12) },
      });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect((await store.listVersions('0000000000000001')).map((v) => v.xml)).toEqual(['<B/>']);
      warn.mockRestore();
    });

    it('com outra chave, só versões já bastam para saber que a chave sumiu; apagar leva elas', async () => {
      await store.db.transaction('rw', store.db.working, store.db.history, store.db.sent, () =>
        Promise.all([store.db.working.clear(), store.db.history.clear(), store.db.sent.clear()]),
      );
      await store.addVersion(version('<A/>', 1));
      const other = await importStorageKey(randomKeyBytes());
      expect(await store.openStorage(other)).toBe('chave-perdida');
      expect(await store.listVersions('0000000000000001')).toEqual([]);
      await store.resetStorage();
      expect(await store.db.versions.count()).toBe(0);
      key = other;
    });

    it('sem chave, nada é gravado', async () => {
      store.markStorageUnavailable('teste');
      expect((await store.addVersion(version('<A/>', 1))).added).toBe(false);
      expect(await store.db.versions.count()).toBe(0);
    });
  });
});

const fixture = async (): Promise<XElement> => {
  const name = 'synthetic_full.xml';
  const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, '../fixtures', name)));
  // Uma cópia independente: o documento de cada versão é outro objeto.
  return parseXml(serializeXml((await loadCv(bytes, name)).doc)).root;
};

const first = (root: XElement, name: string): XElement => {
  let found: XElement | undefined;
  walk(root, (node) => {
    if (!found && node.name === name) found = node;
  });
  return found!;
};

describe('o que mudou entre duas exportações', () => {
  it('conta itens novos, alterados uma vez cada, e removidos, por seção', async () => {
    const older = await fixture();
    const newer = await fixture();
    // Um artigo novo (cópia com outra sequência) e o título do existente mudado.
    const article = first(newer, 'ARTIGO-PUBLICADO');
    const added = cloneElement(article);
    setAttr(added, 'SEQUENCIA-PRODUCAO', '999');
    const container = first(newer, 'ARTIGOS-PUBLICADOS');
    container.children.push(added);
    const basics = childElements(article, 'DADOS-BASICOS-DO-ARTIGO')[0]!;
    setAttr(basics, 'TITULO-DO-ARTIGO', 'Outro título');
    setAttr(basics, 'ANO-DO-ARTIGO', '2030');
    // Um idioma removido.
    const idiomas = first(newer, 'IDIOMAS');
    idiomas.children = idiomas.children.filter(
      (c) => !(c.kind === 'element' && c.name === 'IDIOMA'),
    );

    // Outro artigo com o mesmo título, também alterado: conta à parte.
    const twin = cloneElement(article);
    setAttr(twin, 'SEQUENCIA-PRODUCAO', '998');
    container.children.push(twin);
    const olderTwin = cloneElement(first(older, 'ARTIGO-PUBLICADO'));
    setAttr(olderTwin, 'SEQUENCIA-PRODUCAO', '998');
    first(older, 'ARTIGOS-PUBLICADOS').children.push(olderTwin);

    const diff = diffVersions(older, newer, buildSections(newer));
    expect(diff.added).toBe(1);
    expect(diff.changed).toBe(2);
    expect(diff.removed).toBeGreaterThanOrEqual(1);
    const all = diff.groups.flatMap((g) => g.changes);
    const novo = all.find((c) => c.change.kind === 'novo')!;
    expect(novo.route?.sectionId).toBe('producoes');
    expect(novo.route?.anchor).toBeTruthy();
    expect(diffSummary(diff, '15/03/2024')).toMatch(
      /^Desde a versão de 15\/03\/2024: 1 item novo, 2 alterados, \d+ removidos?\.$/,
    );
  });

  it('item apagado e criado de novo no Lattes, com outro número, não aparece como removido e novo', async () => {
    const older = await fixture();
    const newer = await fixture();
    const article = first(newer, 'ARTIGO-PUBLICADO');
    setAttr(article, 'SEQUENCIA-PRODUCAO', '777');
    expect(diffVersions(older, newer, buildSections(newer))).toMatchObject({
      added: 0,
      changed: 0,
      removed: 0,
    });

    // Criado de novo com um campo diferente: um item alterado, sem a sequência entre os campos.
    const basics = childElements(article, 'DADOS-BASICOS-DO-ARTIGO')[0]!;
    setAttr(basics, 'ANO-DO-ARTIGO', '2031');
    const diff = diffVersions(older, newer, buildSections(newer));
    expect(diff).toMatchObject({ added: 0, changed: 1, removed: 0 });
    const change = diff.groups.flatMap((g) => g.changes)[0]!.change;
    expect(change.fields.map((f) => f.attr)).not.toContain('SEQUENCIA-PRODUCAO');
  });

  it('atuação recriada com outro número, junto com os vínculos, também não aparece', async () => {
    const older = await fixture();
    const newer = await fixture();
    const work = first(newer, 'ATUACAO-PROFISSIONAL');
    walk(work, (el) => {
      for (const a of el.attrs)
        if (a.name.startsWith('SEQUENCIA') && a.value) a.value = `9${a.value}`;
    });
    expect(diffVersions(older, newer, buildSections(newer))).toMatchObject({
      added: 0,
      changed: 0,
      removed: 0,
    });
  });

  it('sem diferença, diz que nada mudou', async () => {
    const a = await fixture();
    const diff = diffVersions(a, await fixture(), buildSections(a));
    expect(diff).toMatchObject({ added: 0, changed: 0, removed: 0 });
    expect(diffSummary(diff, '15/03/2024')).toBe('Nada mudou desde a versão de 15/03/2024.');
  });

  it('data da versão pela exportação, ou pela abertura quando falta', () => {
    const root = parseXml(
      '<CURRICULO-VITAE DATA-ATUALIZACAO="15032024" HORA-ATUALIZACAO="101500"/>',
    ).root;
    expect(exportStamp(root)).toBe('15032024 101500');
    expect(exportStamp(parseXml('<CURRICULO-VITAE DATA-ATUALIZACAO="15032024"/>').root)).toBe(
      '15032024',
    );
    expect(exportStamp(parseXml('<CURRICULO-VITAE/>').root)).toBeUndefined();
    expect(exportDateOf('<CURRICULO-VITAE DATA-ATUALIZACAO="15032024"/>')).toBe('15032024');
    expect(exportDateOf(undefined)).toBeUndefined();
    const v: Pick<LattesVersion, 'exportedAt' | 'loadedAt'> = {
      exportedAt: '15032024 101500',
      loadedAt: 0,
    };
    expect(versionDate(v)).toBe('15/03/2024');
    expect(versionDate({ loadedAt: new Date(2026, 9, 13).getTime() })).toBe('13/10/2026');
  });
});
