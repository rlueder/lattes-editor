// O código de instituição do Lattes contra o do XML (create-shared.ts, sameCode).

import { describe, expect, it } from 'vitest';

import { sameCode } from '../src/bridge/create-shared.ts';

describe('código de instituição do Lattes e do XML', () => {
  it('a letra da frente é uma a mais, e o código do XML pode começar por letra', () => {
    expect(sameCode('D001100000990', '001100000990')).toBe(true);
    expect(sameCode('VK4WU00000006', 'K4WU00000006')).toBe(true);
    expect(sameCode('K4WU00000006', 'K4WU00000006')).toBe(true);
    expect(sameCode('VK4WU00000006', 'VK4WU00000006')).toBe(true);
  });

  it('tirar a letra dos dois lados não casa códigos diferentes', () => {
    expect(sameCode('VK4WU00000006', 'X4WU00000006')).toBe(false);
    expect(sameCode('D001100000990', 'V001100000990')).toBe(false);
    expect(sameCode(undefined, '001100000990')).toBe(false);
  });
});
