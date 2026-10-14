import { describe, expect, it } from 'vitest';

import {
  attemptUrl,
  initialPhotoState,
  type PhotoEvent,
  photoReducer,
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
    let s = run([{ attempt: 0, base, type: 'fail' }]);
    expect(s).toMatchObject({ attempt: 0, failures: 1, status: 'waiting' });
    s = run([{ attempt: 0, base, type: 'retry' }], s);
    expect(s).toMatchObject({ attempt: 1, status: 'loading' });
    s = run(
      [
        { attempt: 1, base, type: 'fail' },
        { attempt: 1, base, type: 'retry' },
        { attempt: 2, base, type: 'fail' },
        { attempt: 2, base, type: 'retry' },
        { attempt: 3, base, type: 'fail' },
      ],
      s,
    );
    expect(s).toMatchObject({ attempt: 3, failures: 4, status: 'gave-up' });
  });

  it('erro e tempo esgotado da mesma tentativa contam uma falha só', () => {
    // A terceira tentativa falha e marca a espera de 60 s; o tempo esgotado
    // dessa mesma tentativa, que chega depois, não pode desistir no lugar dela.
    const third = { attempt: 2, base, failures: 2, status: 'loading' } as const;
    const s = run(
      [
        { attempt: 2, base, type: 'fail' },
        { attempt: 2, base, type: 'fail' },
      ],
      third,
    );
    expect(s).toMatchObject({ attempt: 2, failures: 3, status: 'waiting' });
  });

  it('ignora eventos de tentativa antiga ou de outra foto', () => {
    const s = run([
      { attempt: 0, base, type: 'fail' },
      { attempt: 0, base, type: 'retry' },
    ]);
    expect(run([{ attempt: 0, base, type: 'fail' }], s)).toBe(s);
    expect(run([{ attempt: 0, base, type: 'retry' }], s)).toBe(s);
    expect(run([{ attempt: 1, base: 'https://example.org/outra', type: 'fail' }], s)).toBe(s);
    expect(run([{ base: 'https://example.org/outra', type: 'wake' }], s)).toBe(s);
  });

  it('outra foto começa do zero, sem herdar a tentativa da anterior', () => {
    const s = run([
      { attempt: 0, base, type: 'fail' },
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
    expect(run([{ attempt: 0, base, type: 'fail' }], loaded)).toBe(loaded);
    expect(run([{ attempt: 0, base, type: 'load' }], loaded)).toBe(loaded);
    expect(run([{ attempt: 0, base, type: 'retry' }], loaded)).toBe(loaded);
    const late = run([
      { attempt: 0, base, type: 'fail' },
      { attempt: 0, base, type: 'load' },
    ]);
    expect(late.status).toBe('loaded');
  });

  it('rede ou janela de volta abrem nova rodada só depois de desistir', () => {
    const gaveUp = { attempt: 3, base, failures: 4, status: 'gave-up' } as const;
    expect(run([{ base, type: 'wake' }], gaveUp)).toMatchObject({
      attempt: 4,
      failures: 0,
      status: 'loading',
    });
    expect(run([{ attempt: 3, base, type: 'load' }], gaveUp)).toBe(gaveUp);
    const loading = initialPhotoState(base);
    expect(run([{ base, type: 'wake' }], loading)).toBe(loading);
  });
});
