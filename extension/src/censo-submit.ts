import { frameState } from './censo-frame.ts';
import { censusTraffic } from './censo-traffic.ts';

export type FrameWindow = Window & {
  autorGrid?: { getProvider: () => Record<string, unknown>[] };
  check?: () => void;
  del?: () => void;
  enviar?: () => void;
};
interface MsgBox {
  btnConfirmar?: Pick<HTMLElement, 'addEventListener' | 'click'>;
  exibir: (p: { conteudo?: string; fnConfirmar?: string; tipo?: string }) => unknown;
}

/** O envio só conclui depois da resposta controlada ou da validação da página. */
export function submit(
  frame: HTMLIFrameElement,
  start: (w: FrameWindow) => void,
): Promise<string[]> {
  const signal = censusTraffic.signal;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const w = frame.contentWindow as FrameWindow;
    const box = (window as unknown as { caixaMsg?: MsgBox }).caixaMsg;
    const original = box?.exibir;
    const button = box?.btnConfirmar;
    const confirm = w.confirm;
    const msgs: string[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let done = false;
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      for (const timer of timers) clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      frame.removeEventListener('dev-response', response);
      if (box && original) box.exibir = original;
      if (box) box.btnConfirmar = button;
      w.confirm = confirm;
      if (error) reject(error);
      else resolve(msgs);
    };
    const abort = () =>
      finish(
        signal.reason instanceof Error
          ? signal.reason
          : new Error('Envio interrompido; confira no Lattes antes de repetir'),
      );
    const later = (run: () => void, ms = 0) =>
      timers.push(
        setTimeout(() => {
          if (!done && !signal.aborted) run();
        }, ms),
      );
    const response = () => {
      const error = frameState(frame).error;
      if (error) finish(error);
      else later(() => finish(), 1500);
    };
    frame.addEventListener('dev-response', response);
    signal.addEventListener('abort', abort, { once: true });
    if (box)
      box.exibir = (p) => {
        if (done || signal.aborted) return;
        if (p.tipo === 'confirm') {
          const fn = /getDocument\(\)\.(\w+)\(/.exec(String(p.fnConfirmar ?? ''))?.[1];
          const target = fn ? (w as unknown as Record<string, unknown>)[fn] : undefined;
          if (typeof target === 'function') (target as () => void).call(w);
          else if (fn === undefined && /Confirma a exclus/i.test(String(p.conteudo ?? ''))) {
            box.btnConfirmar = {
              addEventListener: (_type: string, run: unknown) => {
                if (typeof run === 'function') later(() => run());
              },
              click: () => undefined,
            } as MsgBox['btnConfirmar'];
          } else if (box.btnConfirmar) later(() => box.btnConfirmar!.click());
          else w.enviar?.();
          return;
        }
        msgs.push(
          String(p.conteudo ?? '')
            .replace(/<br\s*\/?>/gi, ' ')
            .trim(),
        );
        // A mensagem pode chegar enquanto a resposta está sendo renderizada.
        if (!frameState(frame).writing) finish();
      };
    w.confirm = () => true;
    timers.push(
      setTimeout(
        () => finish(new Error('Sem resposta em 30 s; confira no Lattes antes de repetir')),
        30_000,
      ),
    );
    try {
      start(w);
    } catch (err) {
      finish(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
