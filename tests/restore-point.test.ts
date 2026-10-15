// O ponto de restauração antes da rodada de escrita (LAT-59), sem Lattes: cada
// resultado da exportação e da gravação, e o que a pessoa lê. O caminho com o
// Lattes simulado está em lattes-simulado-copias.test.ts.

import { describe, expect, it, vi } from 'vitest';

import { zipOne } from '../scripts/lattes-simulado/exportar.ts';
import {
  beginSendSession,
  doneText,
  type ExportReply,
  exportReplyOf,
  latestText,
  makeRestorePoint,
  noRestoreText,
  type RestoreOutcome,
  stopText,
} from '../src/bridge/restore-point.ts';
import type { BackupFile, BackupStore } from '../src/model/backups.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';

const ID = '0000000000000001';
const cvZip = (id: string) =>
  zipOne(
    `${id}.xml`,
    encodeLatin1(
      `<?xml version="1.0" encoding="ISO-8859-1"?>\n<CURRICULO-VITAE NUMERO-IDENTIFICADOR="${id}"/>`,
    ),
  );

const LATEST: BackupFile = {
  kind: 'ponto-zero',
  name: 'ponto-zero-2026-10-01.zip',
  savedAt: 1,
  size: 9,
};

function fakeStore(overrides: Partial<BackupStore> = {}): BackupStore {
  return {
    folder: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([LATEST]),
    saveBaseline: vi.fn().mockResolvedValue(undefined),
    saveRestorePoint: vi.fn().mockResolvedValue('restauracao-2026-10-15-1432.zip'),
    where: 'pasta',
    ...overrides,
  };
}

const run = (reply: ExportReply, store = fakeStore()) =>
  makeRestorePoint({
    exportNow: () => Promise.resolve(reply),
    lattesId: ID,
    now: () => new Date(2026, 9, 15, 14, 32),
    ops: [{ kind: 'idioma' }, { kind: 'idioma' }],
    store,
  });

describe('ponto de restauração', () => {
  it('exporta e guarda com a contagem da fila; a exportação também tenta ser o ponto zero', async () => {
    const store = fakeStore();
    const bytes = cvZip(ID);
    const outcome = await run({ bytes, ok: true }, store);
    expect(outcome).toEqual({
      file: 'restauracao-2026-10-15-1432.zip',
      kind: 'feito',
      where: 'pasta',
    });
    expect(store.saveBaseline).toHaveBeenCalledWith(ID, bytes, 'conector', expect.any(Date));
    expect(store.saveRestorePoint).toHaveBeenCalledWith(ID, bytes, { idioma: 2 }, expect.any(Date));
  });

  it('com pendência no Lattes, não há ponto, e a cópia mais recente vai junto', async () => {
    const outcome = await run({ ok: false, reason: 'pendente' });
    expect(outcome).toEqual({
      detail: undefined,
      kind: 'sem-ponto',
      latest: LATEST,
      reason: 'pendente',
    });
  });

  it('sem extensão que exporte, também pede confirmação; a lista que falha não derruba', async () => {
    const store = fakeStore({ list: vi.fn().mockRejectedValue(new Error('x')) });
    expect(await run({ ok: false, reason: 'sem-exportar' }, store)).toMatchObject({
      kind: 'sem-ponto',
      latest: undefined,
      reason: 'sem-exportar',
    });
  });

  it('sessão caída, aba fechada, silêncio ou outro currículo param a rodada', async () => {
    expect(await run({ ok: false, reason: 'sessao' })).toEqual({
      detail: undefined,
      kind: 'parar',
      reason: 'sessao',
    });
    expect(await run({ ok: false, reason: 'sem-resposta' })).toMatchObject({
      reason: 'sem-resposta',
    });
    expect(await run({ bytes: cvZip('0000000000000002'), ok: true })).toEqual({
      kind: 'parar',
      reason: 'outro-cv',
    });
    expect(await run({ bytes: new Uint8Array([1, 2, 3]), ok: true })).toMatchObject({
      kind: 'parar',
      reason: 'erro',
    });
  });

  it('se a cópia não grava, não há ponto, e a pessoa decide', async () => {
    const store = fakeStore({
      saveBaseline: vi.fn().mockRejectedValue(new Error('ponto zero falhou')),
      saveRestorePoint: vi.fn().mockRejectedValue(new Error('Sem permissão em Documentos.')),
    });
    const outcome = await run({ bytes: cvZip(ID), ok: true }, store);
    expect(outcome).toEqual({
      detail: 'Sem permissão em Documentos.',
      kind: 'sem-ponto',
      latest: LATEST,
      reason: 'gravacao',
    });
    const plain = fakeStore({ saveRestorePoint: vi.fn().mockRejectedValue('texto') });
    expect(await run({ bytes: cvZip(ID), ok: true }, plain)).toMatchObject({ detail: 'texto' });
  });
});

describe('começo da rodada de escrita', () => {
  const noPoint: RestoreOutcome = { kind: 'sem-ponto', reason: 'pendente' };

  it('com ponto feito, grava sem perguntar', async () => {
    const confirmWithout = vi.fn();
    const onOutcome = vi.fn();
    const go = await beginSendSession({
      confirmWithout,
      onOutcome,
      restore: () => Promise.resolve({ file: 'r.zip', kind: 'feito', where: 'pasta' }),
    });
    expect(go).toBe(true);
    expect(confirmWithout).not.toHaveBeenCalled();
    expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ kind: 'feito' }));
  });

  it('sem ponto, só grava com a confirmação explícita', async () => {
    const restore = () => Promise.resolve(noPoint);
    expect(await beginSendSession({ confirmWithout: () => Promise.resolve(false), restore })).toBe(
      false,
    );
    expect(await beginSendSession({ confirmWithout: () => Promise.resolve(true), restore })).toBe(
      true,
    );
  });

  it('rodada parada nunca grava nem pergunta', async () => {
    const confirmWithout = vi.fn().mockResolvedValue(true);
    const go = await beginSendSession({
      confirmWithout,
      restore: () => Promise.resolve({ kind: 'parar', reason: 'sessao' }),
    });
    expect(go).toBe(false);
    expect(confirmWithout).not.toHaveBeenCalled();
  });
});

describe('textos do ponto de restauração', () => {
  it('explicam por que não houve ponto e onde está a última cópia', () => {
    expect(noRestoreText({ kind: 'sem-ponto', reason: 'pendente' })).toMatch(
      /não enviadas ao CNPq/,
    );
    expect(noRestoreText({ kind: 'sem-ponto', reason: 'sem-exportar' })).toMatch(
      /Atualize a extensão/,
    );
    expect(
      noRestoreText({ detail: 'Disco cheio.', kind: 'sem-ponto', reason: 'gravacao' }),
    ).toMatch(/\(Disco cheio\)\.$/);
    expect(noRestoreText({ kind: 'sem-ponto', reason: 'gravacao' })).toMatch(/não foi guardada\.$/);
    expect(latestText(undefined)).toMatch(/nenhuma cópia/);
    expect(latestText(LATEST)).toMatch(/o ponto zero, de .*ponto-zero-2026-10-01\.zip\.$/);
    expect(latestText({ ...LATEST, kind: 'restauracao' })).toMatch(/um ponto de restauração/);
  });

  it('dizem por que a rodada parou, sem nada enviado', () => {
    const reasons = [
      'sessao',
      'sem-aba',
      'consentimento',
      'outro-cv',
      'sem-resposta',
      'erro',
    ] as const;
    for (const reason of reasons) {
      expect(stopText({ kind: 'parar', reason })).toMatch(/^Nada foi enviado/);
    }
    expect(stopText({ detail: 'Tela mudou.', kind: 'parar', reason: 'erro' })).toMatch(
      /\(Tela mudou\)\.$/,
    );
  });

  it('dizem onde o ponto ficou', () => {
    expect(doneText({ file: 'r.zip', kind: 'feito', where: 'pasta' })).toMatch(/na pasta/);
    expect(doneText({ file: 'r.zip', kind: 'feito', where: 'navegador' })).toMatch(
      /neste navegador/,
    );
  });
});

describe('resposta da extensão ao pedido do ponto', () => {
  it('o ZIP em base64 vira bytes; sem ZIP, o motivo; base64 estragado, erro', () => {
    expect(exportReplyOf({ zip: 'UEsDBA==' })).toEqual({
      bytes: new Uint8Array([0x50, 0x4b, 3, 4]),
      ok: true,
    });
    expect(exportReplyOf({ reason: 'pendente' })).toEqual({
      detail: undefined,
      ok: false,
      reason: 'pendente',
    });
    expect(exportReplyOf({ detail: 'x' })).toMatchObject({ ok: false, reason: 'erro' });
    expect(exportReplyOf({ zip: '%%%' })).toMatchObject({ ok: false, reason: 'erro' });
  });
});
