import { withPageTask } from '../../src/bridge/page-task.ts';
import { LattesTransport } from '../../src/bridge/transport.ts';

export function pageTraffic(): LattesTransport {
  const page = globalThis as unknown as { __lattesTraffic?: LattesTransport };
  return (page.__lattesTraffic ??= new LattesTransport({
    saveCooldown: async (until) => {
      try {
        await chrome.runtime.sendMessage({ type: 'traffic-pause', until });
      } catch {
        /* A pausa ainda vale na página se o worker estiver indisponível. */
      }
    },
  }));
}

export async function syncTrafficPause(): Promise<void> {
  const reply = (await chrome.runtime.sendMessage({ type: 'traffic-pause-read' })) as {
    until?: number;
  };
  if (typeof reply?.until !== 'number')
    throw new Error('A pausa da sessão não pôde ser consultada');
  pageTraffic().respectPause(reply.until);
}

// A pausa é relida sob a trava: outra aba pode tê-la recebido durante a injeção.
export function withTraffic<T>(work: () => Promise<T>): Promise<T> {
  return withPageTask(async () => {
    await syncTrafficPause();
    return work();
  });
}
