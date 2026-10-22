// A página do formulário fica numa origem opaca. Só dados serializados cruzam a ponte.
import { encodeLatin1Form } from '../../src/bridge/form.ts';
import { decodeLatin1 } from '../../src/model/latin1.ts';
import { htmlFor } from './censo-frame-html.ts';
import { FRAME_POLICY, type FrameCommand, framePost } from './censo-frame-protocol.ts';
import { type FrameQueue, postFrameCommand, receiveFrameReply } from './censo-frame-rpc.ts';
import { clearCensusCache } from './censo-reading.ts';
import { censusTraffic } from './censo-traffic.ts';

declare const __CENSUS_FRAME_RUNTIME__: string;

export interface FrameState {
  error?: Error;
  submitted: boolean;
  writing: boolean;
}
interface Session extends FrameQueue, FrameState {
  port: MessagePort;
  posted: boolean;
  url: string;
}
const states = new WeakMap<HTMLIFrameElement, Session>();
export const frameState = (frame: HTMLIFrameElement): FrameState => states.get(frame)!;

export function frameCommand<T>(frame: HTMLIFrameElement, command: FrameCommand): Promise<T> {
  const state = states.get(frame);
  censusTraffic.signal.throwIfAborted();
  if (!state) return Promise.reject(new Error('Quadro Dev fechado'));
  return postFrameCommand<T>(state, command);
}

async function receivePost(state: Session, raw: unknown): Promise<void> {
  const m = raw as { id?: number };
  if (
    !state.pending ||
    m.id !== state.pending.id ||
    state.pending.command.type !== 'action' ||
    state.posted
  )
    throw new Error('Envio do quadro sem uma ação autorizada');
  const { pairs, url } = framePost(raw, state.url);
  state.posted = true;
  state.writing = true;
  state.submitted = true;
  try {
    clearCensusCache();
    const result = await censusTraffic.request(url, 'POST', encodeLatin1Form(pairs));
    state.url = result.url || url.href;
    const html = await htmlFor(decodeLatin1(result.bytes), state.url);
    censusTraffic.signal.throwIfAborted();
    state.port.postMessage({ id: m.id, response: html });
  } finally {
    state.writing = false;
  }
}

export async function openFrame(path: string, code: string): Promise<HTMLIFrameElement> {
  const url = new URL(`/cvlattesweb/${path}`, location.origin);
  url.searchParams.set('f_cod', code);
  const response = await censusTraffic.request(url);
  const base = response.url || url.href;
  const html = await htmlFor(decodeLatin1(response.bytes), base);
  censusTraffic.signal.throwIfAborted();
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:900px;height:600px;z-index:99999';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.referrerPolicy = 'no-referrer';
  const signal = censusTraffic.signal;
  const channel = new MessageChannel();
  const state: Session = {
    next: 0,
    port: channel.port1,
    posted: false,
    submitted: false,
    url: base,
    writing: false,
  };
  states.set(frame, state);
  const fail = (error: unknown) => {
    state.error = error instanceof Error ? error : new Error(String(error));
    state.pending?.reject(state.error);
    state.pending = undefined;
  };
  const remove = frame.remove.bind(frame);
  const close = () => {
    signal.removeEventListener('abort', close);
    fail(new Error('Quadro Dev fechado; confira qualquer envio antes de repetir'));
    channel.port1.close();
    channel.port2.close();
    remove();
  };
  frame.remove = close;
  signal.addEventListener('abort', close, { once: true });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('O quadro Dev isolado não iniciou')), 5000);
      const abort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      signal.addEventListener('abort', abort, { once: true });
      channel.port1.onmessage = (event: MessageEvent) => {
        if (!event.data || typeof event.data !== 'object') {
          fail(new Error('Mensagem inválida do quadro Dev'));
          return;
        }
        const m = event.data as {
          type?: string;
          id?: number;
          value?: unknown;
          error?: string;
          fatal?: boolean;
        };
        if (m.type === 'ready') {
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
          resolve();
        } else if (m.type === 'post') void receivePost(state, m).catch(fail);
        else if (m.type === 'error') fail(new Error(m.error || 'Erro no quadro Dev'));
        else receiveFrameReply(state, m);
      };
      // A origem opaca exige "*"; a porta é transferida somente a este WindowProxy.
      frame.addEventListener(
        'load',
        () => frame.contentWindow!.postMessage('lattes-editor:frame-init', '*', [channel.port2]),
        { once: true },
      );
      frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${FRAME_POLICY}"><script>${__CENSUS_FRAME_RUNTIME__.replace(/<\/script/gi, '<\\/script')}</script>`;
      document.body.append(frame);
    });
    await frameCommand(frame, { html, type: 'render' });
    return frame;
  } catch (error) {
    close();
    throw error;
  }
}
