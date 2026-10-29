import { describe, expect, it, vi } from 'vitest';

import { LattesTransport, READ_PACE, retryAfterMs } from '../src/bridge/transport.ts';

const ok = () => Promise.resolve(new Response('ok'));
function clock() {
  let time = 0;
  const waits: number[] = [];
  return {
    now: () => time,
    wait: async (ms: number) => {
      waits.push(ms);
      time += ms;
    },
    waits,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe('tráfego do conector', () => {
  it.each([403, 429, 503])(
    'HTTP %i para a tarefa, respeita Retry-After e não repete POST',
    async (status) => {
      const c = clock();
      const fetch = vi.fn(
        async () => new Response('pare', { status, headers: { 'Retry-After': '120' } }),
      );
      const traffic = new LattesTransport({ ...c, fetch, spacingMs: 0 });
      await expect(
        traffic.run(async () => {
          await traffic
            .request('https://example.invalid/', { method: 'POST' })
            .catch(() => undefined);
          await traffic.request('https://example.invalid/');
        }),
      ).rejects.toThrow(`HTTP ${status}`);
      expect(fetch).toHaveBeenCalledTimes(1);
      await expect(
        traffic.run(async () => traffic.request('https://example.invalid/')),
      ).rejects.toThrow('120 segundos');
      c.advance(120_000);
      fetch.mockImplementation(ok);
      await traffic.run(async () => traffic.request('https://example.invalid/'));
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it('converte segundos e datas de Retry-After sem inventar prazo para texto inválido', () => {
    const now = Date.parse('2026-10-21T12:00:00Z');
    expect(retryAfterMs('30', now)).toBe(30_000);
    expect(retryAfterMs('Wed, 21 Oct 2026 12:01:00 GMT', now)).toBe(60_000);
    expect(retryAfterMs('Wed, 21 Oct 2026 11:00:00 GMT', now)).toBe(0);
    expect(retryAfterMs('inválido', now)).toBe(0);
    expect(retryAfterMs(null, now)).toBe(0);
  });

  it('espaça pedidos também entre tarefas', async () => {
    const c = clock();
    const traffic = new LattesTransport({ ...c, fetch: ok, spacingMs: 750 });
    await traffic.run(async () => {
      await traffic.request('a');
      await traffic.request('b');
    });
    await traffic.run(async () => traffic.request('c'));
    expect(c.waits).toEqual([750, 750]);
  });

  it('o orçamento inclui leituras e não volta a pedir depois de alcançá-lo', async () => {
    const fetch = vi.fn(ok);
    const traffic = new LattesTransport({ fetch, budget: 2, spacingMs: 0 });
    await expect(
      traffic.run(async () => {
        for (let i = 0; i < 4; i++) await traffic.request('a');
      }),
    ).rejects.toThrow('limite de pedidos');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('limita a soma de várias tarefas na mesma janela de um minuto', async () => {
    const c = clock();
    const fetch = vi.fn(ok);
    const traffic = new LattesTransport({ ...c, fetch, perMinute: 2, spacingMs: 0 });
    for (let i = 0; i < 2; i++) await traffic.run(async () => traffic.request('a'));
    await expect(traffic.run(async () => traffic.request('a'))).rejects.toThrow('limite');
    c.advance(60_000);
    await traffic.run(async () => traffic.request('a'));
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('não admite outra tarefa enquanto a primeira está na rede', async () => {
    let finish!: (response: Response) => void;
    const traffic = new LattesTransport({
      fetch: () =>
        new Promise((r) => {
          finish = r;
        }),
    });
    const first = traffic.run(async () => traffic.request('a'));
    await expect(traffic.run(async () => traffic.request('b'))).rejects.toThrow('ocupado');
    finish(new Response('ok'));
    await first;
  });

  it('parar cancela o pedido atual e impede o próximo', async () => {
    const fetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_r, reject) => {
          init!.signal!.addEventListener('abort', () => reject(new Error('abortado')));
        }),
    );
    const traffic = new LattesTransport({ fetch });
    const first = traffic.run(async () => traffic.request('a'));
    traffic.cancel();
    await expect(first).rejects.toThrow('interrompida');
    expect(fetch).toHaveBeenCalledTimes(1);
    traffic.cancel();
  });

  it('parar durante o espaçamento não deixa sair o próximo pedido', async () => {
    let resume!: () => void;
    const fetch = vi.fn(ok);
    const traffic = new LattesTransport({
      fetch,
      now: () => 0,
      wait: () =>
        new Promise((r) => {
          resume = r;
        }),
    });
    await traffic.run(async () => traffic.request('a'));
    const next = traffic.run(async () => traffic.request('b'));
    traffic.cancel();
    resume();
    await expect(next).rejects.toThrow('interrompida');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falha de rede e erro HTTP comum param sem repetir', async () => {
    for (const fetch of [
      vi.fn(async () => {
        throw new Error('rede');
      }),
      vi.fn(async () => new Response('', { status: 500 })),
    ]) {
      const traffic = new LattesTransport({ fetch });
      await expect(traffic.run(async () => traffic.request('a'))).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(1);
    }
    await expect(new LattesTransport().request('a')).rejects.toThrow('fora de uma tarefa');
  });

  it('um núcleo que engole uma falha não conclui a tarefa como conferida', async () => {
    const traffic = new LattesTransport({ fetch: async () => new Response('', { status: 429 }) });
    await expect(
      traffic.run(async () => {
        await traffic.request('a').catch(() => undefined);
        return 'ok';
      }),
    ).rejects.toThrow('HTTP 429');
  });
});

describe('prazo e persistência do freio de tráfego', () => {
  it('o prazo da tarefa cancela a rede antes do prazo externo da aba', async () => {
    vi.useFakeTimers();
    try {
      const traffic = new LattesTransport({
        fetch: (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init!.signal!.addEventListener('abort', () => reject(new Error('abortado')));
          }),
      });
      const check = expect(traffic.run(async () => traffic.request('a'))).rejects.toThrow(
        'interrompida',
      );
      await vi.advanceTimersByTimeAsync(150_000);
      await check;
    } finally {
      vi.useRealTimers();
    }
  });

  it('uma página nova respeita a pausa guardada pela anterior', async () => {
    const c = clock();
    let stored = 0;
    const policy = {
      ...c,
      loadCooldown: () => stored,
      saveCooldown: (until: number) => {
        stored = until;
      },
    };
    const first = new LattesTransport({
      ...policy,
      fetch: async () => new Response('', { status: 429 }),
    });
    await expect(first.run(async () => first.request('a'))).rejects.toThrow('429');
    const fetch = vi.fn(ok);
    const next = new LattesTransport({ ...policy, fetch });
    await expect(next.run(async () => next.request('b'))).rejects.toThrow('pausa');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('a interrupção do corpo depois do POST preserva a incerteza da gravação', async () => {
    const traffic = new LattesTransport({
      fetch: async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error('corpo interrompido'));
            },
          }),
        ),
    });
    const result = await traffic.run(
      async () => {
        const response = await traffic.request('a', { method: 'POST' });
        await traffic.bytes(response);
        return { posted: false };
      },
      (_error, posted) => ({ posted }),
    );
    expect(result.posted).toBe(true);
  });
});

it('limita Retry-After e pausas antigas a uma hora, inclusive em caso de overflow', async () => {
  const { MAX_COOLDOWN_MS } = await import('../src/bridge/transport.ts');
  const now = Date.parse('2026-10-21T12:00:00Z');
  expect(retryAfterMs('9999999999999999999999999999', now)).toBe(MAX_COOLDOWN_MS);
  expect(retryAfterMs('9'.repeat(400), now)).toBe(MAX_COOLDOWN_MS);
  expect(retryAfterMs('Wed, 21 Oct 2099 12:00:00 GMT', now)).toBe(MAX_COOLDOWN_MS);
  let time = now;
  const fetch = vi.fn(ok);
  const traffic = new LattesTransport({ now: () => time, fetch, loadCooldown: () => now + 1e12 });
  await expect(traffic.run(() => traffic.request('a'))).rejects.toThrow('pausa');
  time += MAX_COOLDOWN_MS;
  await traffic.run(() => traffic.request('a'));
  expect(fetch).toHaveBeenCalledTimes(1);
});

describe('o passo de cada tarefa', () => {
  it('a leitura afrouxa a espera e o teto por minuto; a tarefa comum fica com a política', async () => {
    const waits: number[] = [];
    let now = 0;
    const t = new LattesTransport({
      fetch: async () => new Response('ok'),
      now: () => now,
      wait: async (ms) => {
        waits.push(ms);
        now += ms;
      },
    });
    await t.run(async () => {
      await t.request('https://x.invalid/a');
      await t.request('https://x.invalid/b');
    });
    await t.run(
      async () => {
        await t.request('https://x.invalid/c');
        await t.request('https://x.invalid/d');
      },
      undefined,
      READ_PACE,
    );
    expect(waits).toEqual([750, 320, 320]);
  });

  it('pedidos em paralelo na mesma tarefa saem um a cada passo', async () => {
    const waits: number[] = [];
    const t = new LattesTransport({
      fetch: async () => new Response('ok'),
      now: () => 0,
      wait: async (ms) => {
        waits.push(ms);
      },
    });
    await t.run(
      () => Promise.all(['a', 'b', 'c'].map((p) => t.request(`https://x.invalid/${p}`))),
      undefined,
      READ_PACE,
    );
    expect(waits).toEqual([320, 640]);
  });

  it('uma política sem espera continua sem espera numa tarefa de leitura', async () => {
    const waits: number[] = [];
    const t = new LattesTransport({
      fetch: async () => new Response('ok'),
      spacingMs: 0,
      wait: async (ms) => {
        waits.push(ms);
      },
    });
    await t.run(
      async () => {
        await t.request('https://x.invalid/a');
        await t.request('https://x.invalid/b');
      },
      undefined,
      READ_PACE,
    );
    expect(waits).toEqual([]);
  });
});
