import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppPort } from '../extension/src/app-port.ts';
import { editorMessage } from '../src/bridge/protocol.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ligação nativa do conector', () => {
  it('conecta uma vez, aceita só envelopes do editor e pode reconectar após queda', () => {
    let receive!: (message: unknown) => void;
    let disconnect!: () => void;
    const port = {
      onDisconnect: {
        addListener: (cb: () => void) => {
          disconnect = cb;
        },
      },
      onMessage: {
        addListener: (cb: (message: unknown) => void) => {
          receive = cb;
        },
      },
      postMessage: vi.fn(),
    };
    const connectNative = vi.fn(() => port);
    vi.stubGlobal('chrome', {
      runtime: { connectNative },
      storage: { session: { remove: async () => undefined } },
    });
    const received = vi.fn();
    const app = new AppPort('host-sintético', received);
    app.connect();
    app.connect();
    expect(connectNative).toHaveBeenCalledTimes(1);
    receive({ type: 'ola' });
    expect(received).not.toHaveBeenCalled();
    receive(editorMessage({ type: 'ola', version: '1' }));
    expect(received).toHaveBeenCalledTimes(1);
    app.send({ type: 'ola', version: '1' });
    expect(port.postMessage).toHaveBeenCalledTimes(1);
    disconnect();
    expect(app.connected).toBe(false);
    app.connect();
    expect(connectNative).toHaveBeenCalledTimes(2);
  });
});
