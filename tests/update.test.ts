import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CHECK_EVERY_MS,
  checkForUpdate,
  type DownloadEvent,
  dueForCheck,
  installUpdate,
  percent,
  resetUpdateForTests,
  setUpdateDeps,
  shouldCheck,
  subscribeUpdate,
  updateState,
} from '../src/desktop/update.ts';
import { noticesFor } from '../src/ui/notifications.ts';
import { updateToastKey, updateToastText } from '../src/ui/update-toast.ts';

afterEach(() => resetUpdateForTests());

function fakeDeps(opts: { fail?: boolean; none?: boolean } = {}) {
  const relaunch = vi.fn(() => Promise.resolve());
  const check = vi.fn(() =>
    Promise.resolve(
      opts.none
        ? null
        : {
            async downloadAndInstall(onEvent: (e: DownloadEvent) => void) {
              onEvent({ data: { contentLength: 200 }, event: 'Started' });
              onEvent({ data: { chunkLength: 50 }, event: 'Progress' });
              if (opts.fail) throw new Error('assinatura inválida');
              onEvent({ data: { chunkLength: 150 }, event: 'Progress' });
              onEvent({ event: 'Finished' });
            },
            version: '1.2.3',
          },
    ),
  );
  return { check, relaunch };
}

describe('atualização automática', () => {
  it('confere na primeira vez e depois de uma hora', () => {
    expect(shouldCheck(undefined, 0)).toBe(true);
    expect(shouldCheck(0, CHECK_EVERY_MS - 1)).toBe(false);
    expect(shouldCheck(0, CHECK_EVERY_MS)).toBe(true);
  });

  it('percentual só com o tamanho conhecido', () => {
    expect(percent(50, 200)).toBe(25);
    expect(percent(300, 200)).toBe(100);
    expect(percent(50, undefined)).toBeUndefined();
    expect(percent(50, 0)).toBeUndefined();
  });

  it('sem quem confira (navegador, desenvolvimento), não faz nada', async () => {
    expect(await checkForUpdate()).toEqual({ status: 'nenhuma' });
    await installUpdate();
    expect(updateState()).toEqual({ status: 'nenhuma' });
  });

  it('versão nova: disponível, baixa com progresso e reinicia', async () => {
    const deps = fakeDeps();
    setUpdateDeps(deps);
    const seen: unknown[] = [];
    subscribeUpdate(() => seen.push(updateState()));
    expect(await checkForUpdate(1000)).toEqual({ status: 'disponivel', version: '1.2.3' });
    expect(dueForCheck(1000 + CHECK_EVERY_MS - 1)).toBe(false);
    expect(dueForCheck(1000 + CHECK_EVERY_MS)).toBe(true);
    await installUpdate();
    expect(seen).toEqual([
      { status: 'disponivel', version: '1.2.3' },
      { status: 'baixando', version: '1.2.3' },
      { progress: 25, status: 'baixando', version: '1.2.3' },
      { progress: 100, status: 'baixando', version: '1.2.3' },
    ]);
    expect(deps.relaunch).toHaveBeenCalledOnce();
  });

  it('sem versão nova, nada muda; falha na conferência passa em silêncio', async () => {
    setUpdateDeps(fakeDeps({ none: true }));
    expect(await checkForUpdate()).toEqual({ status: 'nenhuma' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setUpdateDeps({ check: () => Promise.reject(new Error('offline')), relaunch: vi.fn() });
    expect(await checkForUpdate()).toEqual({ status: 'nenhuma' });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('falha no download vira "falhou", sem reiniciar', async () => {
    const deps = fakeDeps({ fail: true });
    setUpdateDeps(deps);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await checkForUpdate();
    await installUpdate();
    expect(updateState()).toEqual({ status: 'falhou', version: '1.2.3' });
    expect(deps.relaunch).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('conferência que termina durante o download não o desfaz', async () => {
    let release: (u: { downloadAndInstall: () => Promise<void>; version: string }) => void = () =>
      undefined;
    let calls = 0;
    let finish: () => void = () => undefined;
    const update = {
      downloadAndInstall: () => new Promise<void>((r) => (finish = r)),
      version: '3.0.0',
    };
    setUpdateDeps({
      check: () => {
        calls++;
        return calls === 1
          ? Promise.resolve(update)
          : (new Promise((r) => (release = r)) as Promise<typeof update>);
      },
      relaunch: vi.fn(() => Promise.resolve()),
    });
    await checkForUpdate(0);
    const late = checkForUpdate(CHECK_EVERY_MS);
    const install = installUpdate();
    release({ ...update });
    expect(await late).toEqual({ status: 'baixando', version: '3.0.0' });
    finish();
    await install;
  });

  it('instalada, mas o reinício falha: pede para fechar e abrir', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setUpdateDeps({
      check: fakeDeps().check,
      relaunch: () => Promise.reject(new Error('sem permissão')),
    });
    await checkForUpdate();
    await installUpdate();
    expect(updateState()).toEqual({ status: 'reiniciar', version: '1.2.3' });
    expect(await checkForUpdate()).toEqual({ status: 'reiniciar', version: '1.2.3' });
    expect(updateToastText(updateState())?.title).toBe('Atualização instalada');
    error.mockRestore();
  });

  it('não confere de novo nem instala duas vezes durante o download', async () => {
    let finish: () => void = () => undefined;
    const check = vi.fn(() =>
      Promise.resolve({
        downloadAndInstall: () => new Promise<void>((r) => (finish = r)),
        version: '2.0.0',
      }),
    );
    setUpdateDeps({ check, relaunch: vi.fn(() => Promise.resolve()) });
    await checkForUpdate();
    const first = installUpdate();
    await installUpdate();
    expect(await checkForUpdate()).toEqual({ status: 'baixando', version: '2.0.0' });
    expect(check).toHaveBeenCalledOnce();
    finish();
    await first;
  });
});

describe('aviso e sino da atualização', () => {
  it('texto de cada estado', () => {
    expect(updateToastText({ status: 'nenhuma' })).toBeUndefined();
    expect(updateToastText({ status: 'disponivel', version: '1.2.3' })).toEqual({
      action: 'atualizar',
      description: 'Versão 1.2.3. O app reinicia ao atualizar.',
      title: 'Nova versão disponível',
    });
    expect(updateToastText({ progress: 40, status: 'baixando', version: '1.2.3' })).toEqual({
      description: 'Baixando a versão 1.2.3 (40%).',
      title: 'Atualizando…',
    });
    expect(updateToastText({ status: 'baixando', version: '1.2.3' })?.description).toBe(
      'Baixando a versão 1.2.3.',
    );
    expect(updateToastText({ status: 'falhou', version: '1.2.3' })?.action).toBe('baixar');
  });

  it('fechar o aviso vale para o estado, não para cada percentual', () => {
    const v = '1.2.3';
    expect(updateToastKey({ progress: 10, status: 'baixando', version: v })).toBe(
      updateToastKey({ progress: 90, status: 'baixando', version: v }),
    );
    expect(updateToastKey({ status: 'falhou', version: v })).not.toBe(
      updateToastKey({ status: 'baixando', version: v }),
    );
    expect(updateToastKey({ status: 'nenhuma' })).toBe('nenhuma');
  });

  it('o progresso só avisa quando o percentual muda', async () => {
    const seen: unknown[] = [];
    setUpdateDeps({
      check: () =>
        Promise.resolve({
          async downloadAndInstall(onEvent: (e: DownloadEvent) => void) {
            onEvent({ data: { contentLength: 1000 }, event: 'Started' });
            for (let i = 0; i < 1000; i++) onEvent({ data: { chunkLength: 1 }, event: 'Progress' });
          },
          version: '4.0.0',
        }),
      relaunch: vi.fn(() => Promise.resolve()),
    });
    await checkForUpdate();
    subscribeUpdate(() => seen.push(updateState()));
    await installUpdate();
    // "baixando" sem percentual, e um aviso por percentual de 0 a 100.
    expect(seen).toHaveLength(1 + 101);
  });

  it('o sino guarda a versão nova, antes das outras notificações', () => {
    const notices = noticesFor({
      appVersion: '1.0.0',
      connection: { kind: 'sem-aba' },
      storage: 'cifrado',
      update: { status: 'disponivel', version: '1.2.3' },
    });
    expect(notices.map((n) => [n.id, n.level, n.action])).toEqual([
      ['atualizacao', 'aviso', 'atualizacao'],
      ['ligacao', 'info', undefined],
    ]);
    expect(
      noticesFor({ appVersion: '1', storage: 'cifrado', update: { status: 'nenhuma' } }),
    ).toEqual([]);
  });
});

describe('atualização simulada do pnpm dev', () => {
  it('uma versão nova que baixa em dez partes e recarrega', async () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    const { fakeUpdateDeps } = await import('../src/dev/fake-update.ts');
    const update = await fakeUpdateDeps.check();
    expect(update?.version).toBe('99.0.0');
    const events: string[] = [];
    const done = update!.downloadAndInstall((e) => events.push(e.event));
    await vi.runAllTimersAsync();
    await done;
    expect(events).toEqual(['Started', ...Array<string>(10).fill('Progress'), 'Finished']);
    await fakeUpdateDeps.relaunch();
    expect(reload).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
