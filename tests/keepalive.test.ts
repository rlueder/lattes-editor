// A sessão do Lattes viva enquanto o app está aberto (src/bridge/keepalive.ts).
import { describe, expect, it } from 'vitest';

import { KEEPALIVE_MS, keepaliveDue } from '../src/bridge/keepalive.ts';

const ready = { appConnected: true, busy: false, consent: true, tab: true };

describe('pedido para manter a sessão do Lattes', () => {
  it('a cada 20 minutos, a contar do último pedido ou do menu carregado', () => {
    expect(KEEPALIVE_MS).toBe(20 * 60_000);
    expect(keepaliveDue({}, 0, ready)).toBe(true);
    expect(keepaliveDue({ at: 0 }, KEEPALIVE_MS - 1, ready)).toBe(false);
    expect(keepaliveDue({ at: 0 }, KEEPALIVE_MS, ready)).toBe(true);
  });

  it('só com o app ligado, o aviso aceito, a aba aberta e nada mais usando a aba', () => {
    for (const off of ['appConnected', 'consent', 'tab'] as const) {
      expect(keepaliveDue({}, 0, { ...ready, [off]: false })).toBe(false);
    }
    expect(keepaliveDue({}, 0, { ...ready, busy: true })).toBe(false);
  });

  it('depois que a sessão cai, para até o menu carregar de novo', () => {
    expect(keepaliveDue({ at: 0, dead: true }, KEEPALIVE_MS * 10, ready)).toBe(false);
  });
});
