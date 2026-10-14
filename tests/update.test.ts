import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CHECK_EVERY_MS,
  checkForUpdate,
  checkUpdateNow,
  type DownloadEvent,
  dueForCheck,
  installUpdate,
  manualCheckRunning,
  percent,
  resetUpdateForTests,
  RETRY_AFTER_FAILURE_MS,
  retryDelay,
  setUpdateDeps,
  shouldCheck,
  subscribeManualCheck,
  subscribeUpdate,
  updatesEnabled,
  updateState,
} from '../src/desktop/update.ts';
import { noticesFor } from '../src/ui/notifications.ts';
import { manualCheckText, updateToastKey, updateToastText } from '../src/ui/update-toast.ts';

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
  it('confere na primeira vez e na hora marcada', () => {
    expect(shouldCheck(undefined, 0)).toBe(true);
    expect(shouldCheck(CHECK_EVERY_MS, CHECK_EVERY_MS - 1)).toBe(false);
    expect(shouldCheck(CHECK_EVERY_MS, CHECK_EVERY_MS)).toBe(true);
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
    expect(await checkForUpdate(() => 1000)).toEqual({ status: 'disponivel', version: '1.2.3' });
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
    expect(await checkForUpdate(() => 1000)).toEqual({ status: 'nenhuma' });
    expect(warn).toHaveBeenCalled();
    // Falhou (o latest.json ainda não subiu, por exemplo): tenta de novo logo.
    expect(dueForCheck(1000 + RETRY_AFTER_FAILURE_MS - 1)).toBe(false);
    expect(dueForCheck(1000 + RETRY_AFTER_FAILURE_MS)).toBe(true);
    warn.mockRestore();
  });

  it('falhas seguidas espaçam a nova tentativa até o intervalo normal', () => {
    expect([1, 2, 3, 4, 10].map(retryDelay)).toEqual([
      RETRY_AFTER_FAILURE_MS,
      2 * RETRY_AFTER_FAILURE_MS,
      4 * RETRY_AFTER_FAILURE_MS,
      CHECK_EVERY_MS,
      CHECK_EVERY_MS,
    ]);
  });

  it('a nova tentativa conta da falha e volta ao começo depois de um sucesso', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let now = 0;
    let fail = true;
    setUpdateDeps({
      check: () => {
        // O pedido demora um minuto até falhar.
        now += 60_000;
        return fail ? Promise.reject(new Error('offline')) : Promise.resolve(null);
      },
      relaunch: vi.fn(),
    });
    const clock = () => now;
    await checkForUpdate(clock);
    expect(dueForCheck(60_000 + RETRY_AFTER_FAILURE_MS - 1)).toBe(false);
    expect(dueForCheck(60_000 + RETRY_AFTER_FAILURE_MS)).toBe(true);
    await checkForUpdate(clock);
    expect(dueForCheck(now + 2 * RETRY_AFTER_FAILURE_MS - 1)).toBe(false);
    fail = false;
    await checkForUpdate(clock);
    fail = true;
    await checkForUpdate(clock);
    expect(dueForCheck(now + RETRY_AFTER_FAILURE_MS)).toBe(true);
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
    await checkForUpdate(() => 0);
    const late = checkForUpdate(() => CHECK_EVERY_MS);
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
    const deps = fakeUpdateDeps();
    const checking = deps.check();
    await vi.runAllTimersAsync();
    const update = await checking;
    expect(update?.version).toBe('99.0.0');
    const events: string[] = [];
    const done = update!.downloadAndInstall((e) => events.push(e.event));
    await vi.runAllTimersAsync();
    await done;
    expect(events).toEqual(['Started', ...Array<string>(10).fill('Progress'), 'Finished']);
    await deps.relaunch();
    expect(reload).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('=nenhuma não acha versão nova; =falha falha', async () => {
    vi.useFakeTimers();
    const { fakeUpdateDeps } = await import('../src/dev/fake-update.ts');
    const none = fakeUpdateDeps('nenhuma').check();
    await vi.runAllTimersAsync();
    expect(await none).toBeNull();
    const fail = fakeUpdateDeps('falha').check();
    const rejected = expect(fail).rejects.toThrow('falhou');
    await vi.runAllTimersAsync();
    await rejected;
    vi.useRealTimers();
  });
});

describe('verificar atualizações pelo menu', () => {
  it('só no app publicado, ou no pnpm dev com ?simular-atualizacao', () => {
    expect(updatesEnabled({ desktop: true, dev: false, search: '' })).toBe(true);
    expect(updatesEnabled({ desktop: false, dev: false, search: '' })).toBe(false);
    expect(updatesEnabled({ desktop: false, dev: false, search: '?simular-atualizacao' })).toBe(
      false,
    );
    expect(updatesEnabled({ desktop: true, dev: true, search: '' })).toBe(false);
    expect(updatesEnabled({ desktop: false, dev: true, search: '?simular-atualizacao' })).toBe(
      true,
    );
    expect(
      updatesEnabled({ desktop: false, dev: true, search: '?simular-atualizacao=falha' }),
    ).toBe(true);
  });

  it('marca "verificando" durante a conferência e avisa quem acompanha', async () => {
    let answer: (u: null) => void = () => undefined;
    setUpdateDeps({
      check: () => new Promise((r) => (answer = r)),
      relaunch: vi.fn(),
    });
    const seen: boolean[] = [];
    subscribeManualCheck(() => seen.push(manualCheckRunning()));
    expect(manualCheckRunning()).toBe(false);
    const run = checkUpdateNow(() => 0);
    expect(manualCheckRunning()).toBe(true);
    answer(null);
    await run;
    expect(manualCheckRunning()).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it('versão nova: o estado vira "disponível" e o aviso é o de sempre', async () => {
    setUpdateDeps(fakeDeps());
    const outcome = await checkUpdateNow(() => 0);
    expect(outcome).toEqual({ failed: false, state: { status: 'disponivel', version: '1.2.3' } });
    expect(updateState()).toEqual({ status: 'disponivel', version: '1.2.3' });
    expect(manualCheckText(outcome!, '1.0.0')).toBeUndefined();
  });

  it('sem versão nova: confirma a versão em uso', async () => {
    setUpdateDeps(fakeDeps({ none: true }));
    const outcome = await checkUpdateNow(() => 0);
    expect(outcome).toEqual({ failed: false, state: { status: 'nenhuma' } });
    expect(manualCheckText(outcome!, '0.22.0-dev.7')).toEqual({
      description: 'Você está na versão mais recente (0.22.0-dev.7).',
      title: 'Nenhuma versão nova',
    });
  });

  it('falha: avisa e diz que o app continua conferindo sozinho', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setUpdateDeps({ check: () => Promise.reject(new Error('offline')), relaunch: vi.fn() });
    const outcome = await checkUpdateNow(() => 1000);
    expect(outcome).toEqual({ failed: true, state: { status: 'nenhuma' } });
    expect(manualCheckText(outcome!, '1.0.0')).toEqual({
      description: 'O app continua conferindo sozinho a cada 15 minutos.',
      title: 'Não deu para verificar agora',
    });
    // A falha segue a regra das automáticas: nova tentativa logo.
    expect(dueForCheck(1000 + RETRY_AFTER_FAILURE_MS)).toBe(true);
    expect(manualCheckRunning()).toBe(false);
    warn.mockRestore();
  });

  it('falha com uma versão já conhecida: volta o aviso dela', () => {
    const state = { status: 'disponivel', version: '1.2.3' } as const;
    expect(manualCheckText({ failed: true, state }, '1.0.0')).toBeUndefined();
  });

  it('sem quem confira, conta como falha em vez de dizer que está em dia', async () => {
    expect(await checkUpdateNow()).toEqual({ failed: true, state: { status: 'nenhuma' } });
    expect(manualCheckRunning()).toBe(false);
  });

  it('o segundo clique durante a conferência não confere de novo', async () => {
    let answer: (u: null) => void = () => undefined;
    const check = vi.fn(() => new Promise<null>((r) => (answer = r)));
    setUpdateDeps({ check, relaunch: vi.fn() });
    const first = checkUpdateNow(() => 0);
    expect(await checkUpdateNow(() => 0)).toBeUndefined();
    answer(null);
    expect(await first).toEqual({ failed: false, state: { status: 'nenhuma' } });
    expect(check).toHaveBeenCalledOnce();
  });

  it('pedida durante uma conferência automática, usa o resultado dela', async () => {
    let answer: (u: null) => void = () => undefined;
    const check = vi.fn(() => new Promise<null>((r) => (answer = r)));
    setUpdateDeps({ check, relaunch: vi.fn() });
    const automatic = checkForUpdate(() => 0);
    const manual = checkUpdateNow(() => 5000);
    answer(null);
    expect(await manual).toEqual({ failed: false, state: { status: 'nenhuma' } });
    expect(await automatic).toEqual({ status: 'nenhuma' });
    expect(check).toHaveBeenCalledOnce();
  });

  it('remarca a próxima conferência automática para daqui a 15 minutos', async () => {
    setUpdateDeps(fakeDeps({ none: true }));
    await checkForUpdate(() => 0);
    expect(dueForCheck(CHECK_EVERY_MS)).toBe(true);
    // Verificou no menu aos 14 minutos: a automática dos 15 não sai logo depois.
    const at = 14 * 60_000;
    await checkUpdateNow(() => at);
    expect(dueForCheck(CHECK_EVERY_MS)).toBe(false);
    expect(dueForCheck(at + CHECK_EVERY_MS - 1)).toBe(false);
    expect(dueForCheck(at + CHECK_EVERY_MS)).toBe(true);
  });
});
