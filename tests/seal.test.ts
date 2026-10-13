import { describe, expect, it } from 'vitest';

import {
  decodeKey,
  DEVELOPMENT_KEY,
  encodeKey,
  importStorageKey,
  isSealed,
  randomKeyBytes,
  seal,
  unseal,
} from '../src/model/seal.ts';

describe('cifra dos dados locais', () => {
  it('cifra e decifra com a mesma chave, sem deixar o texto à vista', async () => {
    const key = await importStorageKey(randomKeyBytes());
    const value = { note: 'Resumo editado', xml: '<CURRICULO-VITAE NOME="Pessoa"/>' };
    const sealed = await seal(key, value);
    expect(isSealed(sealed)).toBe(true);
    expect(new TextDecoder().decode(sealed.data)).not.toContain('CURRICULO');
    expect(await unseal(key, sealed)).toEqual(value);
  });

  it('cada cifra usa um vetor novo, e outra chave não decifra', async () => {
    const key = await importStorageKey(randomKeyBytes());
    const a = await seal(key, 'x');
    const b = await seal(key, 'x');
    expect(a.iv).not.toEqual(b.iv);
    const other = await importStorageKey(randomKeyBytes());
    await expect(unseal(other, a)).rejects.toThrow();
  });

  it('a chave vai ao chaveiro em base64 e volta igual', () => {
    const raw = randomKeyBytes();
    const text = encodeKey(raw);
    expect(text).toHaveLength(44);
    expect(decodeKey(text)).toEqual(raw);
    expect(() => decodeKey('AAAA')).toThrow();
    expect(() => importStorageKey(new Uint8Array(16))).toThrow();
    expect(DEVELOPMENT_KEY).toHaveLength(32);
  });

  it('reconhece o que não está cifrado', () => {
    expect(isSealed(undefined)).toBe(false);
    expect(isSealed({ xml: '<a/>' })).toBe(false);
    expect(isSealed({ data: new ArrayBuffer(1), iv: 'x' })).toBe(false);
  });
});
