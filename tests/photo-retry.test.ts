import { describe, expect, it } from 'vitest';

import {
  attemptUrl,
  FOCUS_WAKE_MIN_MS,
  focusWakes,
  initialPhotoState,
  type PhotoEvent,
  photoReducer,
  photoSrc,
  retryDelay,
} from '../src/ui/photo-retry.ts';

describe('foto do perfil: novas tentativas', () => {
  it('espera mais a cada falha e para depois da terceira', () => {
    expect(retryDelay(1)).toBe(3_000);
    expect(retryDelay(2)).toBe(15_000);
    expect(retryDelay(3)).toBe(60_000);
    expect(retryDelay(4)).toBeUndefined();
  });

  it('a primeira tentativa é o endereço puro; as outras não reaproveitam a resposta', () => {
    const url = 'https://servicosweb.cnpq.br/wspessoa/servletrecuperafoto?tipo=1&id=K1234567A8';
    expect(attemptUrl(url, 0)).toBe(url);
    expect(attemptUrl(url, 2)).toBe(`${url}&t=2`);
    expect(attemptUrl('https://i.pravatar.cc/300', 1)).toBe('https://i.pravatar.cc/300?t=1');
    expect(attemptUrl('data:image/png;base64,AAAA', 3)).toBe('data:image/png;base64,AAAA');
  });
});

describe('foto do perfil: estado das tentativas', () => {
  const base = 'https://example.org/foto';
  const run = (events: PhotoEvent[], from = initialPhotoState(base)) =>
    events.reduce(photoReducer, from);

  it('falha, espera, tenta de novo e desiste depois da terceira espera', () => {
    let s = run([{ attempt: 0, base, reason: 'error', type: 'fail' }]);
    expect(s).toMatchObject({ attempt: 0, failures: 1, status: 'waiting' });
    s = run([{ attempt: 0, base, type: 'retry' }], s);
    expect(s).toMatchObject({ attempt: 1, status: 'loading' });
    s = run(
      [
        { attempt: 1, base, reason: 'error', type: 'fail' },
        { attempt: 1, base, type: 'retry' },
        { attempt: 2, base, reason: 'error', type: 'fail' },
        { attempt: 2, base, type: 'retry' },
        { attempt: 3, base, reason: 'error', type: 'fail' },
      ],
      s,
    );
    expect(s).toMatchObject({ attempt: 3, failures: 4, status: 'gave-up' });
  });

  it('erro e tempo esgotado da mesma tentativa contam uma falha só', () => {
    // A terceira tentativa falha e marca a espera de 60 s; o tempo esgotado
    // dessa mesma tentativa, que chega depois, não pode desistir no lugar dela.
    const third = { attempt: 2, base, failures: 2, request: 2, status: 'loading' } as const;
    const s = run(
      [
        { attempt: 2, base, reason: 'error', type: 'fail' },
        { attempt: 2, base, reason: 'timeout', type: 'fail' },
      ],
      third,
    );
    expect(s).toMatchObject({ attempt: 2, failures: 3, status: 'waiting' });
  });

  it('ignora eventos de tentativa antiga ou de outra foto', () => {
    const s = run([
      { attempt: 0, base, reason: 'error', type: 'fail' },
      { attempt: 0, base, type: 'retry' },
    ]);
    expect(run([{ attempt: 0, base, reason: 'error', type: 'fail' }], s)).toBe(s);
    expect(run([{ attempt: 0, base, type: 'retry' }], s)).toBe(s);
    expect(
      run([{ attempt: 1, base: 'https://example.org/outra', reason: 'error', type: 'fail' }], s),
    ).toBe(s);
    expect(run([{ base: 'https://example.org/outra', type: 'wake' }], s)).toBe(s);
  });

  it('outra foto começa do zero, sem herdar a tentativa da anterior', () => {
    const s = run([
      { attempt: 0, base, reason: 'error', type: 'fail' },
      { attempt: 0, base, type: 'retry' },
      { base: 'https://example.org/outra', type: 'reset' },
    ]);
    expect(s).toEqual(initialPhotoState('https://example.org/outra'));
    // A espera da foto anterior que ainda dispara não avança a nova.
    expect(run([{ attempt: 0, base, type: 'retry' }], s)).toBe(s);
  });

  it('carregou: não volta a falhar; resposta atrasada durante a espera vale', () => {
    const loaded = run([{ attempt: 0, base, type: 'load' }]);
    expect(loaded.status).toBe('loaded');
    expect(run([{ attempt: 0, base, reason: 'error', type: 'fail' }], loaded)).toBe(loaded);
    expect(run([{ attempt: 0, base, type: 'load' }], loaded)).toBe(loaded);
    expect(run([{ attempt: 0, base, type: 'retry' }], loaded)).toBe(loaded);
    const late = run([
      { attempt: 0, base, reason: 'error', type: 'fail' },
      { attempt: 0, base, type: 'load' },
    ]);
    expect(late.status).toBe('loaded');
  });

  it('rede ou janela de volta abrem nova rodada só depois de desistir', () => {
    const gaveUp = { attempt: 3, base, failures: 4, request: 3, status: 'gave-up' } as const;
    expect(run([{ base, type: 'wake' }], gaveUp)).toMatchObject({
      attempt: 4,
      failures: 0,
      request: 4,
      status: 'loading',
    });
    const loading = initialPhotoState(base);
    expect(run([{ base, type: 'wake' }], loading)).toBe(loading);
  });
});

describe('foto do perfil: pedido lento e foco da janela', () => {
  const base = 'https://example.org/foto';
  const run = (events: PhotoEvent[], from = initialPhotoState(base)) =>
    events.reduce(photoReducer, from);

  it('depois de só demorar, a tentativa seguinte mantém o pedido em curso', () => {
    const s = run([
      { attempt: 0, base, reason: 'timeout', type: 'fail' },
      { attempt: 0, base, type: 'retry' },
    ]);
    expect(s).toMatchObject({ attempt: 1, request: 0, status: 'loading' });
    expect(photoSrc(s)).toBe(base);
    // O mesmo pedido termina mais tarde: vale.
    expect(run([{ attempt: 1, base, type: 'load' }], s).status).toBe('loaded');
    // Se ele dá erro, a próxima tentativa troca o endereço.
    const next = run(
      [
        { attempt: 1, base, reason: 'error', type: 'fail' },
        { attempt: 1, base, type: 'retry' },
      ],
      s,
    );
    expect(next).toMatchObject({ attempt: 2, request: 2 });
    expect(photoSrc(next)).toBe(`${base}?t=2`);
  });

  it('depois de desistir, o endereço fica e uma resposta atrasada ainda vale', () => {
    const gaveUp = {
      attempt: 3,
      base,
      failures: 4,
      lastFailure: 'timeout',
      request: 1,
      status: 'gave-up',
    } as const;
    expect(photoSrc(gaveUp)).toBe(`${base}?t=1`);
    expect(run([{ attempt: 3, base, type: 'load' }], gaveUp).status).toBe('loaded');
    expect(photoSrc(initialPhotoState(undefined))).toBeUndefined();
  });

  it('o foco só abre outra rodada passado o intervalo mínimo', () => {
    expect(focusWakes(1_000, 1_000)).toBe(false);
    expect(focusWakes(1_000, 1_000 + FOCUS_WAKE_MIN_MS - 1)).toBe(false);
    expect(focusWakes(1_000, 1_000 + FOCUS_WAKE_MIN_MS)).toBe(true);
  });
});
