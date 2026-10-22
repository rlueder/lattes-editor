import { CensusStopped } from '../../src/census/stop.ts';
// O canal é aberto pelo script isolado da extensão Dev, inclusive para chamadas
// pelo console. Sem ele, o censo recusa rede em vez de contornar os limites.
const CHANNEL = 'lattes-editor:dev-traffic';
export interface CensusResponse {
  bytes: Uint8Array;
  headers: [string, string][];
  status: number;
  url: string;
}

export class CensusTraffic {
  private port?: MessagePort;
  private localFetch?: typeof fetch;
  private next = 0;
  private ended?: () => void;
  private pending = new Map<number, { resolve(v: CensusResponse): void; reject(e: Error): void }>();
  private controller?: AbortController;
  get running(): boolean {
    return Boolean(this.port);
  }
  get signal(): AbortSignal {
    if (!this.controller) throw new CensusStopped('Censo fora de uma tarefa protegida');
    return this.controller.signal;
  }
  private fail(error: Error): void {
    this.controller?.abort(error);
    for (const p of this.pending.values()) p.reject(error);
    this.pending.clear();
  }
  cancel(): void {
    this.port?.postMessage({ type: 'cancel' });
    this.fail(
      new CensusStopped('Censo interrompido; confira qualquer gravação antes de continuar'),
    );
  }
  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.port) throw new CensusStopped('O censo já está ocupado');
    const channel = new MessageChannel();
    this.port = channel.port1;
    this.controller = new AbortController();
    this.localFetch = globalThis.fetch.bind(globalThis);
    const deadline = setTimeout(() => this.cancel(), 145_000);
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new CensusStopped('Abra a extensão Dev atualizada antes de rodar o censo')),
          2000,
        );
        channel.port1.onmessage = (event: MessageEvent) => {
          const m = event.data as { id: number; value?: CensusResponse; error?: string };
          if (m.id === -1) {
            this.ended?.();
            return;
          }
          if (m.id === 0) {
            clearTimeout(timer);
            if (m.error) reject(new CensusStopped(m.error));
            else resolve();
            return;
          }
          const request = this.pending.get(m.id);
          this.pending.delete(m.id);
          if (m.error) {
            const error = new CensusStopped(m.error);
            request?.reject(error);
            this.fail(error);
          } else if (m.value) request?.resolve(m.value);
        };
        window.postMessage(CHANNEL, location.origin, [channel.port2]);
      });
      const result = await work();
      this.signal.throwIfAborted();
      return result;
    } finally {
      this.localFetch = undefined;
      clearTimeout(deadline);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 2000);
        this.ended = () => {
          clearTimeout(timer);
          resolve();
        };
        this.port!.postMessage({ type: 'end' });
      });
      this.ended = undefined;
      this.port.close();
      this.fail(new CensusStopped('A tarefa do censo terminou'));
      this.port = undefined;
      this.controller = undefined;
    }
  }
  async request(url: string | URL, method = 'GET', body?: string): Promise<CensusResponse> {
    this.signal.throwIfAborted();
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
      this.port!.postMessage({ body, id, method, type: 'request', url: String(url) });
    });
  }
  async sendResults(url: string, body: string): Promise<void> {
    const target = new URL(url);
    if (
      !['http:', 'https:'].includes(target.protocol) ||
      !['localhost', '127.0.0.1'].includes(target.hostname)
    )
      throw new Error('O receptor de resultados precisa ser local');
    if (!this.localFetch) throw new CensusStopped('Receptor fora de uma tarefa protegida');
    const response = await this.localFetch(target, {
      body,
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.any([this.signal, AbortSignal.timeout(20_000)]),
    });
    if (!response.ok) throw new Error(`O receptor respondeu HTTP ${response.status}`);
  }
  wait(ms: number): Promise<void> {
    const signal = this.signal;
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abort);
        resolve();
      }, ms);
      signal.addEventListener('abort', abort, { once: true });
    });
  }
}
const page = globalThis as unknown as { __lattesCensusTraffic?: CensusTraffic };
export const censusTraffic = (page.__lattesCensusTraffic ??= new CensusTraffic());
