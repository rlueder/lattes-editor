// Ponte restrita à aba do menu Dev. O censo usa o transporte da extensão;
// nenhum estado de tráfego é escrito no armazenamento do site do CNPq.
import { pageTraffic, withTraffic } from './page-traffic.ts';

export const DEV_TRAFFIC = 'lattes-editor:dev-traffic';
const traffic = pageTraffic();
const ready = chrome.runtime.sendMessage({ active: false, type: 'dev-frame-guard' });

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window || event.origin !== location.origin || event.data !== DEV_TRAFFIC)
    return;
  const port = event.ports[0];
  if (!port) return;
  let finish!: () => void;
  let pending = false;
  let guarded = false;
  const ended = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const timer = setTimeout(() => {
    if (guarded) traffic.cancel();
    finish();
  }, 150_000);
  const reply = (id: number, value?: unknown, error?: string) =>
    port.postMessage({ error, id, value });
  void (async () => {
    try {
      await ready;
      await withTraffic(async () => {
        try {
          await traffic.run(async () => {
            const guard = (await chrome.runtime.sendMessage({
              active: true,
              type: 'dev-frame-guard',
            })) as { ok?: boolean };
            if (!guard?.ok) throw new Error('A proteção dos quadros Dev não pôde ser ativada');
            guarded = true;
            reply(0, true);
            port.onmessage = (message: MessageEvent) => {
              const m = message.data as {
                id: number;
                type: string;
                url?: string;
                body?: string;
                method?: string;
              };
              if (m.type === 'cancel') {
                traffic.cancel();
                finish();
                return;
              }
              if (m.type === 'end') {
                finish();
                return;
              }
              if (m.type !== 'request' || pending) {
                reply(m.id, undefined, 'Pedido Dev concorrente ou inválido');
                return;
              }
              pending = true;
              void (async () => {
                try {
                  const url = new URL(m.url ?? '', location.href);
                  if (
                    url.origin !== location.origin ||
                    (m.method === 'POST' && !/^\/(cvlattesweb|curriculoweb)\//i.test(url.pathname))
                  )
                    throw new Error('O censo só pode pedir páginas da sessão atual do Lattes');
                  if (!['GET', 'POST'].includes(m.method ?? 'GET'))
                    throw new Error('Método Dev recusado');
                  const res = await traffic.request(url, {
                    body: m.body,
                    credentials: 'include',
                    method: m.method ?? 'GET',
                    ...(m.body === undefined
                      ? {}
                      : { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),
                  });
                  const bytes = await traffic.bytes(res);
                  reply(m.id, {
                    bytes,
                    headers: [...res.headers],
                    status: res.status,
                    url: res.url,
                  });
                } catch (err) {
                  reply(m.id, undefined, err instanceof Error ? err.message : String(err));
                } finally {
                  pending = false;
                }
              })();
            };
            port.start();
            await ended;
          });
        } finally {
          if (guarded)
            await chrome.runtime
              .sendMessage({ active: false, type: 'dev-frame-guard' })
              .catch(() => undefined);
        }
      });
    } catch (err) {
      reply(0, undefined, err instanceof Error ? err.message : String(err));
    } finally {
      clearTimeout(timer);
      reply(-1, true);
      port.close();
    }
  })();
});
