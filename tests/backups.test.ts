// Cópias de segurança (LAT-59): nomes e sidecar, o banco do navegador (que só
// acrescenta e que nenhum "Limpar" alcança) e a pasta do desktop pelos
// comandos do app, com o invoke simulado. Que o Rust nunca sobrescreve está
// nos testes de src-tauri/src/copias.rs.

import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { zipOne } from '../scripts/lattes-simulado/exportar.ts';
import { sentEntry } from '../src/bridge/sent-log.ts';
import { backupDb, browserBackupBytes, browserBackupStore } from '../src/model/backup-store.ts';
import {
  baselineName,
  dayStamp,
  isBaselineCandidate,
  isLattesZipName,
  kindOfName,
  latestBackup,
  minuteStamp,
  queueSummary,
  restorePointName,
  sha256Hex,
  sidecarJson,
} from '../src/model/backups.ts';
import { loadCv } from '../src/model/document.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { importStorageKey, randomKeyBytes } from '../src/model/seal.ts';
import * as store from '../src/model/store.ts';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

const { backupStore, folderBackupStore, keepBaseline, keepPristineBaseline, revealBackup } =
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

  it('o ponto zero é sempre o ZIP do Lattes', () => {
    const d = new Date(2026, 9, 15);
    expect(baselineName(d)).toBe('ponto-zero-2026-10-15.zip');
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
    // O ZIP vai cru, como Uint8Array (InvokeBody::Raw no Rust), nunca como vetor de números.
    const [cmd, body, options] = invoke.mock.calls[0]!;
    expect(cmd).toBe('backup_save_baseline');
    expect(body).toBeInstanceOf(Uint8Array);
    expect([...body]).toEqual([...ZIP]);
    expect(options.headers).toMatchObject({ 'x-lattes-id': '1', 'x-stamp': '2026-10-15' });
    expect(JSON.parse(options.headers['x-sidecar'])).toMatchObject({
      origem: 'conector',
      tipo: 'ponto-zero',
    });

    invoke.mockResolvedValueOnce(null);
    expect(await folderBackupStore.saveBaseline('1', ZIP, 'arquivo', now)).toBeUndefined();

    invoke.mockResolvedValueOnce('restauracao-2026-10-15-0805.zip');
    expect(await folderBackupStore.saveRestorePoint('1', ZIP, { idioma: 1 }, now)).toBe(
      'restauracao-2026-10-15-0805.zip',
    );
    const [cmd2, body2, options2] = invoke.mock.calls[2]!;
    expect(cmd2).toBe('backup_save_restore_point');
    expect(body2).toBeInstanceOf(Uint8Array);
    expect(options2.headers).toMatchObject({ 'x-lattes-id': '1', 'x-stamp': '2026-10-15-0805' });
    expect(JSON.parse(options2.headers['x-sidecar'])).toMatchObject({
      fila: { idioma: 1 },
      tipo: 'restauracao',
    });
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

describe('o que vira ponto zero', () => {
  const ID = '1234567890123456';
  const cvXml = (attrs: string) =>
    encodeLatin1(
      `<?xml version="1.0" encoding="ISO-8859-1"?>\n<CURRICULO-VITAE ${attrs}><DADOS-GERAIS NOME-COMPLETO="Pessoa"/></CURRICULO-VITAE>`,
    );
  const PRISTINE = `SISTEMA-ORIGEM-XML="LATTES_OFFLINE" NUMERO-IDENTIFICADOR="${ID}"`;
  const pristineZip = zipOne(`${ID}.xml`, cvXml(PRISTINE));
  const check = async (bytes: Uint8Array, fileName: string, origin: 'arquivo' | 'conector') =>
    isBaselineCandidate({
      bytes,
      fileName,
      origin,
      root: (await loadCv(bytes, fileName)).doc.root,
    });

  it('reconhece o nome do Exportar: CV_<id>.zip, <id>.zip e o download repetido', () => {
    expect(isLattesZipName(`CV_${ID}.zip`, ID)).toBe(true);
    expect(isLattesZipName(`${ID}.zip`, ID)).toBe(true);
    expect(isLattesZipName(`CV_${ID} (1).zip`, ID)).toBe(true);
    expect(isLattesZipName(`cv_${ID}.ZIP`, ID)).toBe(true);
    expect(isLattesZipName('CV_9999999999999999.zip', ID)).toBe(false);
    expect(isLattesZipName(`meu-curriculo.zip`, ID)).toBe(false);
    expect(isLattesZipName(`CV_${ID}-editado.zip`, ID)).toBe(false);
    expect(isLattesZipName(`CV_${ID}.xml`, ID)).toBe(false);
  });

  it('pelo conector, sempre', async () => {
    expect(await check(pristineZip, 'qualquer.zip', 'conector')).toBe(true);
  });

  it('de um arquivo, só o ZIP como o Exportar entrega', async () => {
    expect(await check(pristineZip, `CV_${ID}.zip`, 'arquivo')).toBe(true);
    expect(await check(pristineZip, `${ID}.zip`, 'arquivo')).toBe(true);
    // Nome que não é o do Lattes.
    expect(await check(pristineZip, 'curriculo.zip', 'arquivo')).toBe(false);
    // Sem SISTEMA-ORIGEM-XML, ou com o identificador de outro currículo no nome.
    const noOrigin = zipOne(`${ID}.xml`, cvXml(`NUMERO-IDENTIFICADOR="${ID}"`));
    expect(await check(noOrigin, `CV_${ID}.zip`, 'arquivo')).toBe(false);
    expect(await check(pristineZip, 'CV_1111111111111111.zip', 'arquivo')).toBe(false);
    // A entrada do ZIP com outro nome (alguém recompactou).
    const renamed = zipOne('curriculo.xml', cvXml(PRISTINE));
    expect(await check(renamed, `CV_${ID}.zip`, 'arquivo')).toBe(false);
    // ZIP que não abre na leitura das entradas.
    expect(
      await isBaselineCandidate({
        bytes: new Uint8Array([0x50, 0x4b, 1]),
        fileName: `CV_${ID}.zip`,
        origin: 'arquivo',
        root: (await loadCv(pristineZip, 'x.zip')).doc.root,
      }),
    ).toBe(false);
  });

  it('XML solto, nunca, nem com tudo certo', async () => {
    const loose = cvXml(PRISTINE);
    expect(await check(loose, `${ID}.xml`, 'arquivo')).toBe(false);
    expect(await check(loose, `CV_${ID}.zip`, 'arquivo')).toBe(false);
  });

  it('o que não passa abre igual e só não é guardado', async () => {
    const store = {
      ...folderBackupStore,
      saveBaseline: vi.fn().mockResolvedValue('ponto-zero-x.zip'),
    };
    const root = (await loadCv(pristineZip, 'x.zip')).doc.root;
    expect(await keepPristineBaseline(root, pristineZip, 'curriculo.zip', 'arquivo', store)).toBe(
      undefined,
    );
    expect(store.saveBaseline).not.toHaveBeenCalled();
    expect(await keepPristineBaseline(root, pristineZip, `CV_${ID}.zip`, 'arquivo', store)).toBe(
      'ponto-zero-x.zip',
    );
    expect(store.saveBaseline).toHaveBeenCalledWith(ID, pristineZip, 'arquivo', expect.any(Date));
  });
});

describe('sidecar no cabeçalho do invoke', () => {
  it('uma linha, só ASCII, e o mesmo JSON depois de lido', () => {
    const text = sidecarJson(
      { arquivo: 'a.zip', origem: 'arquivo', tipo: 'ponto-zero', versao: 'versão-ç' },
      ZIP,
      at('2026-10-15T12:00:00Z'),
      'abc',
      { header: true },
    );
    expect(text).not.toMatch(/\n/);
    expect(text).toMatch(/^[\x20-\x7e]+$/);
    expect(JSON.parse(text)).toMatchObject({ versao: 'versão-ç' });
  });
});
