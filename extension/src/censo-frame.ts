// Os quadros Dev não navegam nem enviam formulários por conta própria. O HTML,
// seus scripts e as folhas de estilo passam pelo transporte antes de executar.
import { encodeLatin1Form } from '../../src/bridge/form.ts';
import { decodeLatin1 } from '../../src/model/latin1.ts';
import { censusGet, clearCensusCache } from './censo-reading.ts';
import { silenceDialogs } from './censo-test-pages.ts';
import { censusTraffic } from './censo-traffic.ts';

export interface FrameState {
  error?: Error;
  submitted: boolean;
  writing: boolean;
}
const states = new WeakMap<HTMLIFrameElement, FrameState>();
export const frameState = (frame: HTMLIFrameElement) => states.get(frame)!;

async function htmlFor(html: string, url: string): Promise<string> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc
    .querySelectorAll(
      'base, meta[http-equiv], iframe, frame, object, embed, img, source, video, audio',
    )
    .forEach((el) => el.remove());
  for (const script of doc.querySelectorAll<HTMLScriptElement>('script[src]')) {
    const response = await censusGet(new URL(script.getAttribute('src')!, url));
    script.removeAttribute('src');
    script.textContent = decodeLatin1(response.bytes).replace(/<\/script/gi, '<\\/script');
  }
  for (const link of doc.querySelectorAll<HTMLLinkElement>('link')) {
    if (link.rel === 'stylesheet' && link.getAttribute('href')) {
      const response = await censusGet(new URL(link.getAttribute('href')!, url));
      const style = doc.createElement('style');
      style.textContent = decodeLatin1(response.bytes);
      link.replaceWith(style);
    } else link.remove();
  }
  const base = doc.createElement('base');
  base.href = url;
  doc.head.prepend(base);
  const policy = doc.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; form-action 'none'; frame-src 'none'; connect-src 'none'";
  doc.head.prepend(policy);
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

async function render(frame: HTMLIFrameElement, html: string, url: string): Promise<void> {
  const safe = await htmlFor(html, url);
  censusTraffic.signal.throwIfAborted();
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(safe);
  doc.close();
  silenceDialogs(frame.contentWindow!);
  doc.addEventListener('submit', (event) => {
    event.preventDefault();
    (event.target as HTMLFormElement).submit();
  });
}

export async function openFrame(path: string, code: string): Promise<HTMLIFrameElement> {
  const url = new URL(`/cvlattesweb/${path}`, location.origin);
  url.searchParams.set('f_cod', code);
  const response = await censusTraffic.request(url);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:900px;height:600px;z-index:99999';
  // Sem allow-forms: o navegador recusa o envio nativo de formulários neste quadro.
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  document.body.append(frame);
  const state: FrameState = { submitted: false, writing: false };
  states.set(frame, state);
  const abort = () => {
    frame.contentWindow?.stop();
    frame.remove();
  };
  censusTraffic.signal.addEventListener('abort', abort, { once: true });
  const w = frame.contentWindow! as Window & typeof globalThis;
  const send = (form: HTMLFormElement) => {
    if (state.writing) {
      state.error = new Error('Envio duplicado no mesmo quadro');
      return;
    }
    state.writing = true;
    void (async () => {
      try {
        const action = new URL(form.getAttribute('action') || url.href, url);
        const method = form.method.toUpperCase();
        const pairs: [string, string][] = [];
        for (const [name, value] of new w.FormData(form)) {
          if (typeof value !== 'string') throw new Error('Arquivo em formulário Dev não suportado');
          pairs.push([name, value]);
        }
        const body = encodeLatin1Form(pairs);
        if (method !== 'POST') throw new Error('Formulário Dev sem POST recusado');
        state.submitted = true;
        clearCensusCache();
        const result = await censusTraffic.request(action, 'POST', body);
        await render(frame, decodeLatin1(result.bytes), result.url || action.href);
      } catch (err) {
        state.error = err instanceof Error ? err : new Error(String(err));
      } finally {
        state.writing = false;
        frame.dispatchEvent(new Event('dev-response'));
      }
    })();
  };
  w.HTMLFormElement.prototype.submit = function () {
    send(this);
  };
  frame.contentDocument!.addEventListener('submit', (event) => {
    event.preventDefault();
    send(event.target as HTMLFormElement);
  });
  try {
    await render(frame, decodeLatin1(response.bytes), response.url || url.href);
    return frame;
  } catch (err) {
    frame.remove();
    throw err;
  }
}
