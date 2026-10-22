// A pausa pertence à extensão, fora do armazenamento da página do CNPq.
// Persiste ao recarregar a aba e vale para todas as tarefas deste navegador.
import { MAX_COOLDOWN_MS } from '../../src/bridge/transport.ts';
import { isLattesMenu, isRealLattesMenu } from './lattes-hosts.ts';

const KEY = 'traffic-pause-until';
let saving: Promise<void> = Promise.resolve();

export async function readTrafficPause(): Promise<number> {
  let until = 0;
  saving = saving
    .catch(() => undefined)
    .then(async () => {
      const value = (await chrome.storage.session.get(KEY))[KEY];
      until =
        typeof value === 'number' && Number.isFinite(value)
          ? Math.min(value, Date.now() + MAX_COOLDOWN_MS)
          : 0;
      // Corrige o valor antigo uma vez, para o teto não avançar a cada leitura.
      if (until !== value && typeof value === 'number' && Number.isFinite(value))
        await chrome.storage.session.set({ [KEY]: until });
    });
  await saving;
  return until;
}

export function handleTrafficPause(
  raw: unknown,
  sender: chrome.runtime.MessageSender,
  respond: (response?: unknown) => void,
): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const message = raw as { type?: unknown; until?: unknown };
  const allowed = __CANAL_DEV__
    ? isLattesMenu(sender.tab?.url, true)
    : isRealLattesMenu(sender.tab?.url);
  if (message.type === 'traffic-pause-read' && allowed) {
    void readTrafficPause().then(
      (until) => respond({ until }),
      () => respond({ error: true }),
    );
    return true;
  }
  if (
    message.type !== 'traffic-pause' ||
    typeof message.until !== 'number' ||
    !Number.isFinite(message.until) ||
    !allowed
  )
    return false;
  const until = Math.min(message.until, Date.now() + MAX_COOLDOWN_MS);
  // Duas abas não podem fazer uma pausa curta substituir uma mais longa.
  saving = saving
    .catch(() => undefined)
    .then(async () => {
      const previous = (await chrome.storage.session.get(KEY))[KEY];
      await chrome.storage.session.set({
        [KEY]: Math.max(
          until,
          typeof previous === 'number' && Number.isFinite(previous)
            ? Math.min(previous, Date.now() + MAX_COOLDOWN_MS)
            : 0,
        ),
      });
    });
  void saving.then(
    () => respond({ ok: true }),
    () => respond({ ok: false }),
  );
  return true;
}
