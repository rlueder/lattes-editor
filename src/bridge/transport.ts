// Política local de tráfego. Estes limites são escolhas do editor, não limites
// publicados pelo CNPq. Um erro HTTP nunca provoca repetição automática de POST.

export const REQUEST_SPACING_MS = 750;
export const REQUEST_TIMEOUT_MS = 20_000;
export const REQUESTS_PER_TASK = 100;
export const REQUESTS_PER_MINUTE = 80;
export const HTTP_COOLDOWN_MS = 60_000;

export class TransportStop extends Error {}

export function retryAfterMs(value: string | null, now: number): number {
  if (!value) return 0;
  if (/^\d+$/.test(value.trim())) {
    const ms = Number(value) * 1000;
    return Number.isFinite(ms) ? ms : 0;
  }
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

export interface TrafficPolicy {
  budget?: number;
  fetch?: typeof fetch;
  loadCooldown?: () => number;
  now?: () => number;
  perMinute?: number;
  saveCooldown?: (until: number) => Promise<void> | void;
  spacingMs?: number;
  wait?: (ms: number) => Promise<void>;
}

/** Uma tarefa por sessão, com pausa entre pedidos e teto também nas leituras. */
export class LattesTransport {
  private active = false;
  private controller?: AbortController;
  private failure?: TransportStop;
  private count = 0;
  private posted = false;
  private lastRequest = Number.NEGATIVE_INFINITY;
  private requests: number[] = [];
  private cooldownUntil = 0;
  private policy: Required<TrafficPolicy>;

  constructor(policy: TrafficPolicy = {}) {
    this.policy = {
      budget: policy.budget ?? REQUESTS_PER_TASK,
      fetch: policy.fetch ?? ((...args) => fetch(...args)),
      loadCooldown: policy.loadCooldown ?? (() => 0),
      now: policy.now ?? Date.now,
      perMinute: policy.perMinute ?? REQUESTS_PER_MINUTE,
      saveCooldown: policy.saveCooldown ?? (() => undefined),
      spacingMs: policy.spacingMs ?? REQUEST_SPACING_MS,
      wait: policy.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    };
    this.cooldownUntil = this.policy.loadCooldown();
  }

  async run<T>(
    work: () => Promise<T>,
    onFailure?: (error: TransportStop, posted: boolean) => T,
  ): Promise<T> {
    if (this.active)
      throw new TransportStop('O conector está ocupado com outra leitura ou gravação no Lattes');
    this.checkCooldown();
    this.active = true;
    this.count = 0;
    this.posted = false;
    this.failure = undefined;
    this.controller = new AbortController();
    const deadline = setTimeout(() => this.cancel(), 150_000);
    try {
      const result = await work();
      // Um núcleo que captura uma falha de rede não pode dar a tarefa por conferida.
      if (this.failure) throw this.failure;
      return result;
    } catch (error) {
      if (error instanceof TransportStop && onFailure) return onFailure(error, this.posted);
      throw error;
    } finally {
      clearTimeout(deadline);
      this.active = false;
      this.controller = undefined;
    }
  }

  cancel(): void {
    if (!this.active) return;
    this.failure = new TransportStop(
      'A operação no Lattes foi interrompida; confira qualquer gravação em andamento',
    );
    this.controller?.abort();
  }

  respectPause(until: number): void {
    if (Number.isFinite(until)) this.cooldownUntil = Math.max(this.cooldownUntil, until);
  }

  private async pause(until: number): Promise<void> {
    this.respectPause(until);
    await this.policy.saveCooldown(this.cooldownUntil);
  }

  async bytes(response: Response): Promise<Uint8Array> {
    try {
      return new Uint8Array(await response.arrayBuffer());
    } catch {
      this.failure ??= new TransportStop(
        'A resposta do Lattes foi interrompida; confira qualquer gravação antes de tentar de novo',
      );
      throw this.failure;
    }
  }

  private checkCooldown(): void {
    const left = this.cooldownUntil - this.policy.now();
    if (left > 0)
      throw new TransportStop(
        `O Lattes pediu uma pausa; aguarde ${Math.ceil(left / 1000)} segundos antes de tentar de novo`,
      );
  }

  async request(input: string | URL, init: RequestInit = {}): Promise<Response> {
    if (!this.active) throw new TransportStop('Pedido ao Lattes fora de uma tarefa');
    if (this.failure) throw this.failure;
    this.checkCooldown();
    const { budget, now, perMinute, spacingMs, wait } = this.policy;
    const delay = Math.max(0, this.lastRequest + spacingMs - now());
    if (delay) await wait(delay);
    if (this.failure) throw this.failure;
    this.requests = this.requests.filter((at) => now() - at < 60_000);
    if (this.count >= budget || this.requests.length >= perMinute) {
      await this.pause(now() + HTTP_COOLDOWN_MS);
      this.failure = new TransportStop(
        'O conector atingiu o limite de pedidos desta etapa; nada mais será enviado agora. Aguarde um minuto e confira no Lattes antes de continuar',
      );
      throw this.failure;
    }
    this.count++;
    this.lastRequest = now();
    this.requests.push(this.lastRequest);
    let response: Response;
    if ((init.method ?? 'GET').toUpperCase() === 'POST') this.posted = true;
    try {
      response = await this.policy.fetch(input, {
        ...init,
        signal: AbortSignal.any([
          this.controller!.signal,
          AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          ...(init.signal ? [init.signal] : []),
        ]),
      });
    } catch {
      this.failure ??= new TransportStop(
        'A rede do Lattes não respondeu; a tarefa parou. Confira qualquer gravação antes de tentar de novo',
      );
      throw this.failure;
    }
    if (!response.ok) {
      const cooldown = [403, 429, 503].includes(response.status);
      if (cooldown)
        await this.pause(
          now() +
            Math.max(HTTP_COOLDOWN_MS, retryAfterMs(response.headers.get('Retry-After'), now())),
        );
      this.failure = new TransportStop(
        `O Lattes respondeu HTTP ${response.status}; a tarefa parou${cooldown ? ' e o conector vai respeitar uma pausa antes de novos pedidos' : ''}`,
      );
      // Libera a resposta recusada sem carregar um corpo potencialmente grande.
      await response.body?.cancel();
      throw this.failure;
    }
    return response;
  }
}
