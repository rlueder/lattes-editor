import type { FrameCommand } from './censo-frame-protocol.ts';

export interface FrameQueue {
  error?: Error;
  next: number;
  pending?: {
    id: number;
    command: FrameCommand;
    resolve(value: unknown): void;
    reject(error: Error): void;
  };
  port: Pick<MessagePort, 'postMessage'>;
  posted: boolean;
}

/** Uma falha de clonagem libera a reserva e o prazo antes de devolver o erro. */
export function postFrameCommand<T>(state: FrameQueue, command: FrameCommand): Promise<T> {
  if (state.error) return Promise.reject(state.error);
  if (state.pending) return Promise.reject(new Error('Comando concorrente no quadro Dev'));
  const id = ++state.next;
  state.posted = false;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      state.error = new Error('Sem resposta em 30 s; confira no Lattes antes de repetir');
      state.pending = undefined;
      reject(state.error);
    }, 30_000);
    state.pending = {
      command,
      id,
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value as T);
      },
    };
    try {
      state.port.postMessage({ command, id });
    } catch (error) {
      clearTimeout(timer);
      state.pending = undefined;
      reject(error);
    }
  });
}

/** Erros do comando não inutilizam o quadro; violações fatais impedem novas ações. */
export function receiveFrameReply(
  state: FrameQueue,
  message: { id?: number; error?: string; fatal?: boolean; value?: unknown },
): void {
  const pending = state.pending;
  if (!pending || pending.id !== message.id) return;
  state.pending = undefined;
  if (message.error) {
    const error = new Error(message.error);
    if (message.fatal) state.error = error;
    pending.reject(error);
  } else pending.resolve(message.value);
}
