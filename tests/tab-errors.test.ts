// O motivo de verdade quando a aba do Lattes falha (extension/src/tab-errors.ts),
// os dez últimos erros guardados, e a segunda tentativa da leitura quando a aba
// recarrega no meio (lattes-tab.ts). O 29/10/2026 que motivou: o editor abriu
// logo depois do envio ao CNPq, a aba recarregava, e o motivo virou "não
// respondeu".

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONSENT_KEY, consentRecord } from '../extension/src/consent.ts';
import { readCurriculo, readEspelho, sendPhoto } from '../extension/src/lattes-tab.ts';
import {
  ERRORS_KEY,
  explainTabError,
  MAX_ERRORS,
  readTabErrors,
  recordTabError,
  scrub,
  TAB_RELOADED,
  worthRetry,
} from '../extension/src/tab-errors.ts';
import {
  reloadedSince,
  TAB_BUSY,
  TAB_CLOSED,
  TAB_SILENT,
  tabReloaded,
} from '../extension/src/tab-guard.ts';

/** O chrome de mentira: armazenamento em memória, uma aba do Lattes e o executeScript dado. */
function fakeChrome(
  execute: (injection: {
    args?: unknown[];
    files?: string[];
    target: { tabId: number };
  }) => Promise<unknown>,
  tabs: () => number | undefined = () => 7,
) {
  const local: Record<string, unknown> = { [CONSENT_KEY]: consentRecord() };
  const area = (store: Record<string, unknown>) => ({
    get: (key: string) => Promise.resolve({ [key]: store[key] }),
    set: (items: Record<string, unknown>) => {
      Object.assign(store, items);
      return Promise.resolve();
    },
  });
  vi.stubGlobal('chrome', {
    scripting: { executeScript: vi.fn(execute) },
    storage: { local: area(local), session: area({}) },
    tabs: {
      get: () => Promise.resolve({ id: 7, status: 'complete' }),
      onRemoved: { addListener: () => undefined, removeListener: () => undefined },
      onUpdated: { addListener: () => undefined },
      query: () => {
        const id = tabs();
        return Promise.resolve(id === undefined ? [] : [{ id }]);
      },
    },
  });
  return local;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('o motivo de uma falha da aba do Lattes', () => {
  it('cada motivo com o nome dele, e não "não respondeu" para tudo', () => {
    expect(explainTabError(new Error(TAB_CLOSED), false)).toBe('A aba do Lattes fechou.');
    expect(explainTabError(new Error(TAB_BUSY), false)).toBe(`${TAB_BUSY}.`);
    expect(
      explainTabError(
        new Error('O conector está ocupado com outra leitura ou gravação no Lattes'),
        false,
      ),
    ).toBe('O conector está ocupado com outra leitura ou gravação no Lattes.');
    expect(
      explainTabError(
        new Error('O conector está ocupado com outra leitura em https://wwws.cnpq.br/x?f_cod=K1.'),
        false,
      ),
    ).toBe('O conector está ocupado com outra leitura em (endereço).');
    // Porta fechada também vem da extensão recarregando: não é a aba que recarregou.
    expect(
      explainTabError(
        new Error('Could not establish connection. Receiving end does not exist.'),
        false,
      ),
    ).toBe(`${TAB_SILENT} (Could not establish connection. Receiving end does not exist).`);
    expect(explainTabError(new Error('Frame with ID 0 was removed.'), false)).toBe(
      `${TAB_RELOADED}.`,
    );
    expect(explainTabError(undefined, true)).toBe(`${TAB_RELOADED}.`);
    expect(explainTabError(new Error(TAB_SILENT), false)).toBe(`${TAB_SILENT} em 3 minutos.`);
    expect(explainTabError(undefined, false)).toBe(`${TAB_SILENT}.`);
  });

  it('o que o chrome diz vai sem o endereço nem o código do currículo', () => {
    const msg =
      'Cannot access contents of url "https://wwws.cnpq.br/cvlattesweb/PKG_MENU.menu?f_cod=K1234567A8".';
    expect(explainTabError(new Error(msg), false)).toBe(
      `${TAB_SILENT} (Cannot access contents of url "(endereço)").`,
    );
    expect(scrub('pkg_x?f_cod=K1234567A8&f_seq=2')).toBe('pkg_x?f_cod=…&f_seq=2');
  });

  it('só a aba que recarregou vale uma segunda tentativa', () => {
    expect(worthRetry(`${TAB_RELOADED}.`)).toBe(true);
    expect(worthRetry(`${TAB_SILENT}.`)).toBe(false);
  });

  it('a recarga conta só depois do começo da chamada, e só na aba dela', () => {
    tabReloaded(31, 1000);
    expect(reloadedSince(31, 900)).toBe(true);
    expect(reloadedSince(31, 1100)).toBe(false);
    expect(reloadedSince(32, 0)).toBe(false);
  });
});

describe('os últimos erros guardados', () => {
  it('fica o mais novo primeiro, até dez, sem o endereço', async () => {
    const local = fakeChrome(() => Promise.resolve([]));
    for (let i = 0; i < MAX_ERRORS + 2; i++) await recordTabError('exportar', `erro ${i}`);
    await recordTabError('listas', 'em https://wwws.cnpq.br/x?f_cod=K1');
    const list = await readTabErrors();
    expect(list).toHaveLength(MAX_ERRORS);
    expect(list[0]).toMatchObject({ message: 'em (endereço)', op: 'listas' });
    expect(list[1]!.message).toBe(`erro ${MAX_ERRORS + 1}`);
    expect(local[ERRORS_KEY]).toEqual(list);
  });

  it('dois erros ao mesmo tempo ficam os dois', async () => {
    fakeChrome(() => Promise.resolve([]));
    await Promise.all([recordTabError('exportar', 'um'), recordTabError('listas', 'dois')]);
    expect((await readTabErrors()).map((e) => e.message)).toEqual(['dois', 'um']);
  });

  it('sem armazenamento, guardar não derruba nada', async () => {
    vi.stubGlobal('chrome', {});
    await expect(recordTabError('exportar', 'x')).resolves.toBeUndefined();
    expect(await readTabErrors()).toEqual([]);
  });
});

describe('a leitura que pega a aba recarregando', () => {
  it('espera a aba carregar e tenta uma vez mais; os dois motivos ficam guardados', async () => {
    let call = 0;
    fakeChrome((injection) => {
      if (injection.files) return Promise.resolve([]);
      call++;
      return call === 1
        ? Promise.reject(new Error('Frame with ID 0 was removed.'))
        : Promise.resolve([{ result: { bytes: 'zip', fileName: 'CV_1.zip' } }]);
    });
    expect(await readCurriculo()).toEqual({ bytes: 'zip', fileName: 'CV_1.zip' });
    expect(call).toBe(2);
    const [entry] = await readTabErrors();
    expect(entry).toMatchObject({ message: `${TAB_RELOADED}. Nova tentativa.`, op: 'exportar' });
  });

  it('se a segunda também falha, o motivo vai ao editor', async () => {
    fakeChrome((injection) =>
      injection.files
        ? Promise.resolve([])
        : Promise.reject(new Error('Frame with ID 0 was removed.')),
    );
    expect(await readCurriculo()).toEqual({ detail: `${TAB_RELOADED}.`, reason: 'erro' });
    expect((await readTabErrors()).map((e) => e.message)).toEqual([
      `${TAB_RELOADED}.`,
      `${TAB_RELOADED}. Nova tentativa.`,
    ]);
  });

  it('depois da segunda tentativa noutra aba, as listas vão à aba que respondeu', async () => {
    let call = 0;
    const lists: number[] = [];
    const ids = [7, 8];
    fakeChrome(
      (injection) => {
        if (injection.files) return Promise.resolve([]);
        if (injection.args?.[0] === 'listasCv') {
          lists.push(injection.target.tabId);
          return Promise.resolve([{ result: { lists: {}, queue: [], unread: [] } }]);
        }
        call++;
        return call === 1
          ? Promise.reject(new Error('Frame with ID 0 was removed.'))
          : Promise.resolve([{ result: { items: [] } }]);
      },
      () => ids.shift() ?? 8,
    );
    expect(await readEspelho()).toMatchObject({ items: [], listsUnread: [] });
    expect(lists).toEqual([8]);
  });

  it('sem aba do Lattes depois da recarga, o erro não diz que houve nova tentativa', async () => {
    const ids: (number | undefined)[] = [7, undefined];
    fakeChrome(
      (injection) =>
        injection.files
          ? Promise.resolve([])
          : Promise.reject(new Error('Frame with ID 0 was removed.')),
      () => ids.shift(),
    );
    expect(await readCurriculo()).toEqual({ detail: `${TAB_RELOADED}.`, reason: 'erro' });
    expect((await readTabErrors()).map((e) => e.message)).toEqual([`${TAB_RELOADED}.`]);
  });

  it('a gravação nunca tenta de novo: o motivo volta na primeira falha', async () => {
    let call = 0;
    fakeChrome((injection) => {
      if (injection.files) return Promise.resolve([]);
      call++;
      return Promise.reject(new Error('Frame with ID 0 was removed.'));
    });
    expect(await sendPhoto('jpeg', '1')).toEqual({
      detail: `${TAB_RELOADED}.`,
      ok: false,
      reason: 'erro',
    });
    expect(call).toBe(1);
  });
});
