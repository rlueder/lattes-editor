// Regras só do canal Dev: os quadros controlados usam about:blank. Uma navegação
// HTTP disparada por script da página não pode contornar o transporte.
import { isLattesMenu } from './lattes-hosts.ts';

export function handleDevFrameGuard(
  raw: unknown,
  sender: chrome.runtime.MessageSender,
  respond: (value: unknown) => void,
): boolean {
  if (!__CANAL_DEV__ || !raw || typeof raw !== 'object') return false;
  const m = raw as { type?: unknown; active?: unknown };
  const tabId = sender.tab?.id;
  if (
    m.type !== 'dev-frame-guard' ||
    typeof m.active !== 'boolean' ||
    tabId === undefined ||
    !isLattesMenu(sender.tab?.url, true)
  )
    return false;
  const id = 1_000_000 + tabId;
  void chrome.declarativeNetRequest
    .updateSessionRules({
      addRules: m.active
        ? [
            {
              action: { type: 'block' },
              condition: { resourceTypes: ['sub_frame'], tabIds: [tabId], urlFilter: '|http' },
              id,
              priority: 1,
            },
          ]
        : [],
      removeRuleIds: [id],
    })
    .then(
      () => respond({ ok: true }),
      () => respond({ ok: false }),
    );
  return true;
}
