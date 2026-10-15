// Cópias de segurança (LAT-59): nomes e sidecar, o banco do navegador (que só
// acrescenta e que nenhum "Limpar" alcança) e a pasta do desktop pelos
// comandos do app, com o invoke simulado. Que o Rust nunca sobrescreve está
// nos testes de src-tauri/src/copias.rs.

import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { sentEntry } from '../src/bridge/sent-log.ts';
import { backupDb, browserBackupBytes, browserBackupStore } from '../src/model/backup-store.ts';
import {
  backupExt,
  baselineName,
  dayStamp,
  kindOfName,
  latestBackup,
  minuteStamp,
  queueSummary,
  restorePointName,
  sha256Hex,
  sidecarJson,
} from '../src/model/backups.ts';
import { importStorageKey, randomKeyBytes } from '../src/model/seal.ts';
import * as store from '../src/model/store.ts';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

const { backupStore, folderBackupStore, keepBaseline, revealBackup } =
  await import('../src/desktop/backup-folder.ts');

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const ZIP = new Uint8Array([0x50, 0x4b, 3, 4, 9, 9]);
const XML = new TextEncoder().encode('<CURRICULO-VITAE/>');
const at = (iso: string) => new Date(iso);

describe('cópias de segurança: nomes e sidecar', () => {
  it('datas na hora local, com zeros à esquerda', () => {
    const d = new Date(2026, 0, 5, 9, 7);
    expect(dayStamp(d)).toBe('2026-01-05');
    expect(minuteStamp(d)).toBe('2026-01-05-0907');
    expect(restorePointName(d)).toBe('restauracao-2026-01-05-0907.zip');
    expect(restorePointName(d, 3)).toBe('restauracao-2026-01-05-0907-3.zip');
  });

  it('o ponto zero guarda o ZIP como .zip e um XML solto como .xml', () => {
    const d = new Date(2026, 9, 15);
    expect(backupExt(ZIP)).toBe('zip');
    expect(backupExt(XML)).toBe('xml');
    expect(backupExt(new Uint8Array([0x50]))).toBe('xml');
    expect(baselineName(ZIP, d)).toBe('ponto-zero-2026-10-15.zip');
    expect(baselineName(XML, d)).toBe('ponto-zero-2026-10-15.xml');
    expect(kindOfName('ponto-zero-2026-10-15.zip')).toBe('ponto-zero');
    expect(kindOfName('restauracao-2026-10-15-1200.zip')).toBe('restauracao');
    expect(kindOfName('anotacao.txt')).toBeUndefined();
  });

  it('a fila vira contagem por tipo, sem valor nenhum', () => {
    expect(
      queueSummary([{ kind: 'idioma' }, { kind: 'idioma' }, { kind: 'excluir-idioma' }]),
    ).toEqual({ 'excluir-idioma': 1, idioma: 2 });
    expect(queueSummary([])).toEqual({});
  });

  it('o sidecar traz data, origem, tamanho e o SHA-256 do arquivo', async () => {
    const sha = await sha256Hex(new TextEncoder().encode('abc'));
    expect(sha).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const json = JSON.parse(
      sidecarJson(
        { arquivo: 'a.zip', origem: 'arquivo', tipo: 'ponto-zero', versao: '1.0.0' },
        ZIP,
        at('2026-10-15T12:00:00Z'),
        sha,
      ),
    );
    expect(json).toEqual({
      arquivo: 'a.zip',
      bytes: 6,
      data: '2026-10-15T12:00:00.000Z',
      origem: 'arquivo',
      sha256: sha,
      tipo: 'ponto-zero',
      versao: '1.0.0',
    });
  });

  it('a mais recente é a de data maior', () => {
    const a = { kind: 'ponto-zero' as const, name: 'a', savedAt: 1, size: 1 };
    const b = { kind: 'restauracao' as const, name: 'b', savedAt: 5, size: 1 };
    expect(latestBackup([b, a])).toBe(b);
    expect(latestBackup([])).toBeUndefined();
  });
});

describe('cópias de segurança no navegador (IndexedDB)', () => {
  const ID = '1111222233334444';

  it('o ponto zero é gravado uma vez só, e o primeiro fica intacto', async () => {
    const first = await browserBackupStore.saveBaseline(
      ID,
      ZIP,
      'arquivo',
      at('2026-10-15T12:00:00Z'),
    );
    expect(first).toBe(`ponto-zero-${dayStamp(at('2026-10-15T12:00:00Z'))}.zip`);
    // Outro arquivo, outro dia, outra origem: nada muda.
    expect(
      await browserBackupStore.saveBaseline(ID, XML, 'conector', at('2026-11-01T12:00:00Z')),
    ).toBe(undefined);
    const list = await browserBackupStore.list(ID);
    expect(list).toEqual([
      { kind: 'ponto-zero', name: first, savedAt: Date.parse('2026-10-15T12:00:00Z'), size: 6 },
    ]);
    expect([...((await browserBackupBytes(ID, first!)) ?? [])]).toEqual([...ZIP]);
    const row = await backupDb.backups.where('lattesId').equals(ID).first();
    expect(JSON.parse(row!.sidecar)).toMatchObject({
      origem: 'arquivo',
      sha256: await sha256Hex(ZIP),
    });
    expect(await browserBackupStore.folder(ID)).toBeUndefined();
    expect(await browserBackupBytes(ID, 'nao-existe.zip')).toBeUndefined();
  });

  it('pontos de restauração no mesmo minuto ganham outro nome, nunca substituem', async () => {
    const now = at('2026-10-15T14:32:10Z');
    const a = await browserBackupStore.saveRestorePoint(ID, ZIP, { idioma: 1 }, now);
    const b = await browserBackupStore.saveRestorePoint(ID, XML, { vinculo: 2 }, now);
    expect(a).toBe(restorePointName(now));
    expect(b).toBe(restorePointName(now, 2));
    expect([...((await browserBackupBytes(ID, a)) ?? [])]).toEqual([...ZIP]);
    const rows = await backupDb.backups.where('lattesId').equals(ID).toArray();
    expect(JSON.parse(rows.find((r) => r.name === b)!.sidecar)).toMatchObject({
      arquivo: b,
      fila: { vinculo: 2 },
      tipo: 'restauracao',
    });
  });

  it('nenhum "Limpar" alcança as cópias, nem o recomeço de chave perdida', async () => {
    const before = await backupDb.backups.count();
    expect(before).toBeGreaterThan(0);
    await store.openStorage(await importStorageKey(randomKeyBytes()));
    await store.clearAll();
    await store.clearVersions(ID);
    await store.clearSent(ID);
    expect(await backupDb.backups.count()).toBe(before);
    // Algo cifrado com esta chave, para a próxima não abrir o banco.
    await store.addSent(
      sentEntry({ expect: {}, key: 'k', kind: 'resumo', label: 'R', set: {} }, ID, 1),
    );
    // Outra chave: o banco fica em "chave-perdida", e o recomeço apaga o resto.
    expect(await store.openStorage(await importStorageKey(randomKeyBytes()))).toBe('chave-perdida');
    await store.resetStorage();
    expect(await backupDb.backups.count()).toBe(before);
  });

  it('o desktop usa a pasta; o navegador, o banco', () => {
    expect(backupStore(true)).toBe(folderBackupStore);
    expect(backupStore(false)).toBe(browserBackupStore);
    expect(backupStore().where).toBe('navegador');
  });
});

describe('cópias de segurança no desktop (pasta)', () => {
  it('manda os bytes exatos, a data e o sidecar ao app', async () => {
    invoke.mockResolvedValueOnce('ponto-zero-2026-10-15.zip');
    const now = new Date(2026, 9, 15, 8, 5);
    expect(await folderBackupStore.saveBaseline('1', ZIP, 'conector', now)).toBe(
      'ponto-zero-2026-10-15.zip',
    );
    const [cmd, args] = invoke.mock.calls[0]!;
    expect(cmd).toBe('backup_save_baseline');
    expect(args).toMatchObject({ bytes: [...ZIP], ext: 'zip', lattesId: '1', stamp: '2026-10-15' });
    expect(JSON.parse(args.sidecar)).toMatchObject({ origem: 'conector', tipo: 'ponto-zero' });

    invoke.mockResolvedValueOnce(null);
    expect(await folderBackupStore.saveBaseline('1', XML, 'arquivo', now)).toBeUndefined();
    expect(invoke.mock.calls[1]![1]).toMatchObject({ ext: 'xml' });

    invoke.mockResolvedValueOnce('restauracao-2026-10-15-0805.zip');
    expect(await folderBackupStore.saveRestorePoint('1', ZIP, { idioma: 1 }, now)).toBe(
      'restauracao-2026-10-15-0805.zip',
    );
    const [cmd2, args2] = invoke.mock.calls[2]!;
    expect(cmd2).toBe('backup_save_restore_point');
    expect(args2).toMatchObject({ lattesId: '1', stamp: '2026-10-15-0805' });
    expect(JSON.parse(args2.sidecar)).toMatchObject({ fila: { idioma: 1 }, tipo: 'restauracao' });
  });

  it('lista só os arquivos do app, da mais antiga à mais recente, e mostra a pasta', async () => {
    invoke.mockResolvedValueOnce([
      { modifiedAt: 20, name: 'restauracao-2026-10-15-0805.zip', size: 3 },
      { modifiedAt: 10, name: 'ponto-zero-2026-10-15.zip', size: 2 },
      { modifiedAt: 5, name: 'outro.zip', size: 1 },
    ]);
    expect(await folderBackupStore.list('1')).toEqual([
      { kind: 'ponto-zero', name: 'ponto-zero-2026-10-15.zip', savedAt: 10, size: 2 },
      { kind: 'restauracao', name: 'restauracao-2026-10-15-0805.zip', savedAt: 20, size: 3 },
    ]);
    invoke.mockResolvedValueOnce('/Users/x/Documents/LattesEditor/Cópias de segurança/1');
    expect(await folderBackupStore.folder('1')).toMatch(/Cópias de segurança\/1$/);
    invoke.mockResolvedValue(undefined);
    await revealBackup('1', 'ponto-zero-2026-10-15.zip');
    await revealBackup('1');
    expect(invoke).toHaveBeenCalledWith('backup_reveal', {
      lattesId: '1',
      name: 'ponto-zero-2026-10-15.zip',
    });
    expect(invoke).toHaveBeenCalledWith('backup_reveal', { lattesId: '1', name: null });
  });

  it('o ponto zero nunca atrapalha a abertura do currículo', async () => {
    const failing = {
      ...folderBackupStore,
      saveBaseline: vi.fn().mockRejectedValue(new Error('TCC')),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await keepBaseline('1', ZIP, 'arquivo', failing)).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    expect(await keepBaseline(undefined, ZIP, 'arquivo', failing)).toBeUndefined();
    expect(failing.saveBaseline).toHaveBeenCalledTimes(1);
    const ok = {
      ...folderBackupStore,
      saveBaseline: vi.fn().mockResolvedValue('ponto-zero-x.zip'),
    };
    expect(await keepBaseline('1', ZIP, 'conector', ok)).toBe('ponto-zero-x.zip');
    warn.mockRestore();
  });
});
