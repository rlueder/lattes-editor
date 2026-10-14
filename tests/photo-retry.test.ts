import { describe, expect, it } from 'vitest';

import { attemptUrl, retryDelay } from '../src/ui/photo-retry.ts';

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
