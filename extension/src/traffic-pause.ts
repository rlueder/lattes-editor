// A pausa pertence à extensão, fora do armazenamento da página do CNPq.
// Persiste ao recarregar a aba e vale para todas as tarefas deste navegador.
import { isLattesMenu, isRealLattesMenu } from './lattes-hosts.ts';

const KEY = 'traffic-pause-until';
let saving: Promise<void> = Promise.resolve();

export async function readTrafficPause(): Promise<number> {
  await saving.catch(() => undefined);
  const value = (await chrome.storage.session.get(KEY))[KEY];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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
  if (
    message.type !== 'traffic-pause' ||
    typeof message.until !== 'number' ||
    !Number.isFinite(message.until) ||
    !allowed
  )
    return false;
  const until = message.until;
  // Duas abas não podem fazer uma pausa curta substituir uma mais longa.
  saving = saving
    .catch(() => undefined)
    .then(async () => {
      const previous = (await chrome.storage.session.get(KEY))[KEY];
      await chrome.storage.session.set({
        [KEY]: Math.max(
          until,
          typeof previous === 'number' && Number.isFinite(previous) ? previous : 0,
        ),
      });
    });
  void saving.then(
    () => respond({ ok: true }),
    () => respond({ ok: false }),
  );
  return true;
}
