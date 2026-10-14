// Atualização automática do app de desktop (LAT-19). O plugin updater do Tauri
// confere o latest.json do último lançamento, baixa o pacote assinado com a
// chave de atualização e o instala; o plugin process reinicia o app.
//
// Quando há versão nova, um aviso no canto da tela oferece "Atualizar" (como no
// app da Precisa) e o sino guarda a mesma oferta, caso o aviso seja fechado.
// Nada se instala sem o clique.

/** O que o app sabe da atualização agora. */
export type UpdateState =
  | { status: 'baixando'; progress?: number; version: string }
  | { status: 'disponivel'; version: string }
  | { status: 'falhou'; version: string }
  | { status: 'nenhuma' }
  /** Instalada, mas o app não conseguiu reiniciar sozinho. */
  | { status: 'reiniciar'; version: string };

/** O pedaço do plugin updater que o app usa (injetável nos testes). */
export interface PendingUpdate {
  downloadAndInstall(onEvent: (e: DownloadEvent) => void): Promise<void>;
  version: string;
}

export type DownloadEvent =
  | { data: { chunkLength: number }; event: 'Progress' }
  | { data: { contentLength?: number }; event: 'Started' }
  | { event: 'Finished' };

export interface UpdateDeps {
  check: () => Promise<PendingUpdate | null>;
  relaunch: () => Promise<void>;
}

/** Primeira conferência depois de abrir: não compete com a abertura do app. */
export const FIRST_CHECK_DELAY_MS = 10_000;

/**
 * Entre conferências, com o app aberto. É um GET pequeno ao GitHub; com uma
 * hora, quem conferia logo depois de um lançamento ficava uma hora sem saber.
 */
export const CHECK_EVERY_MS = 15 * 60_000;

/**
 * Depois de uma conferência que falhou. O lançamento aparece no GitHub uns
 * minutos antes do latest.json (que sobe no fim dos builds), e nesse intervalo
 * a conferência dá 404: tentar de novo logo, não só na próxima rodada.
 */
export const RETRY_AFTER_FAILURE_MS = 2 * 60_000;

/**
 * Espera depois da enésima falha seguida: 2, 4 e 8 min, e daí em diante o
 * intervalo normal. Sem rede, ou com o GitHub bloqueado, o app não fica
 * batendo no GitHub de 2 em 2 minutos enquanto estiver aberto.
 */
export function retryDelay(failures: number): number {
  const doubled = RETRY_AFTER_FAILURE_MS * 2 ** Math.max(0, failures - 1);
  return Math.min(doubled, CHECK_EVERY_MS);
}

/** Se já chegou a hora marcada para a próxima conferência. */
export function shouldCheck(nextCheckAt: number | undefined, now: number): boolean {
  return nextCheckAt === undefined || now >= nextCheckAt;
}

/** Percentual baixado (0 a 100), ou undefined sem o tamanho total. */
export function percent(received: number, total: number | undefined): number | undefined {
  if (!total || total <= 0) return undefined;
  return Math.min(100, Math.floor((received / total) * 100));
}

let deps: UpdateDeps | undefined;
let state: UpdateState = { status: 'nenhuma' };
let pending: PendingUpdate | undefined;
let nextCheckAt: number | undefined;
let failures = 0;
const listeners = new Set<() => void>();

function setState(next: UpdateState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function updateState(): UpdateState {
  return state;
}

export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** O plugin de verdade, carregado só no app de desktop. */
export const tauriDeps: UpdateDeps = {
  async check() {
    const { check } = await import('@tauri-apps/plugin-updater');
    return check();
  },
  async relaunch() {
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  },
};

/** Quem confere e instala: o plugin no app, um simulado no `pnpm dev` e nos testes. */
export function setUpdateDeps(next: UpdateDeps): void {
  deps = next;
}

/** Baixando ou já instalada: nenhuma conferência mexe mais no estado. */
function installing(): boolean {
  return state.status === 'baixando' || state.status === 'reiniciar';
}

/** O resultado de uma conferência: o estado depois dela e se o pedido falhou. */
export interface CheckOutcome {
  failed: boolean;
  state: UpdateState;
}

let inFlight: Promise<CheckOutcome> | undefined;
let manualCheck = false;
const checkingListeners = new Set<() => void>();

async function runCheck(clock: () => number): Promise<CheckOutcome> {
  if (!deps || installing()) return { failed: false, state };
  nextCheckAt = clock() + CHECK_EVERY_MS;
  try {
    const update = await deps.check();
    failures = 0;
    // Um download começou enquanto a conferência esperava: ela não mexe nele.
    if (!update || installing()) return { failed: false, state };
    pending = update;
    setState({ status: 'disponivel', version: update.version });
  } catch (err) {
    failures++;
    // Conta a partir da falha, não do início: um pedido que demorou até o
    // tempo esgotar não deixa a nova tentativa já vencida.
    nextCheckAt = clock() + retryDelay(failures);
    console.warn('Conferência de atualização falhou:', err);
    return { failed: true, state };
  }
  return { failed: false, state };
}

/** Uma conferência por vez: quem pede durante outra recebe o resultado dela. */
function sharedCheck(clock: () => number): Promise<CheckOutcome> {
  inFlight ??= runCheck(clock).finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}

/**
 * Confere se há versão nova. Falha de rede ou de leitura passa em silêncio: a
 * próxima conferência tenta de novo, cada vez mais espaçada (retryDelay). Uma
 * atualização já em download não é substituída. `clock` é o relógio, trocado
 * nos testes.
 */
export async function checkForUpdate(clock: () => number = Date.now): Promise<UpdateState> {
  return (await sharedCheck(clock)).state;
}

function setManualCheck(running: boolean): void {
  manualCheck = running;
  for (const listener of checkingListeners) listener();
}

/** Se a conferência pedida no menu (⚙) ainda está em andamento. */
export function manualCheckRunning(): boolean {
  return manualCheck;
}

export function subscribeManualCheck(listener: () => void): () => void {
  checkingListeners.add(listener);
  return () => checkingListeners.delete(listener);
}

/**
 * A conferência pedida pela pessoa ("Verificar atualizações", no menu ⚙). É a
 * mesma das conferências automáticas, que remarca a próxima para daqui a
 * CHECK_EVERY_MS. Diferente delas, a falha volta para quem pediu, que avisa.
 * Um segundo clique durante a conferência não faz nada (undefined).
 */
export async function checkUpdateNow(
  clock: () => number = Date.now,
): Promise<CheckOutcome | undefined> {
  if (manualCheck) return undefined;
  if (!deps) return { failed: true, state };
  setManualCheck(true);
  try {
    return await sharedCheck(clock);
  } finally {
    setManualCheck(false);
  }
}

/**
 * Onde a atualização liga: no app de desktop publicado e, no `pnpm dev`, só
 * com ?simular-atualizacao. No navegador e no `tauri dev`, não há o que
 * conferir.
 */
export function updatesEnabled(env: { desktop: boolean; dev: boolean; search: string }): boolean {
  return env.dev ? new URLSearchParams(env.search).has('simular-atualizacao') : env.desktop;
}

/** Hora de conferir de novo (ao voltar para a janela, por exemplo). */
export function dueForCheck(now = Date.now()): boolean {
  return shouldCheck(nextCheckAt, now);
}

/** Baixa, instala e reinicia. Com falha, o estado vira "falhou" e o aviso oferece o download. */
export async function installUpdate(): Promise<void> {
  const update = pending;
  if (!deps || !update || state.status === 'baixando') return;
  const version = update.version;
  let total: number | undefined;
  let received = 0;
  setState({ status: 'baixando', version });
  try {
    await update.downloadAndInstall((e) => {
      if (e.event === 'Started') total = e.data.contentLength;
      if (e.event === 'Progress') {
        received += e.data.chunkLength;
        // Um pacote grande chega em milhares de pedaços: só avisa quando o percentual muda.
        const progress = percent(received, total);
        if (state.status === 'baixando' && state.progress === progress) return;
        setState({ progress, status: 'baixando', version });
      }
    });
  } catch (err) {
    console.error('Atualização falhou:', err);
    setState({ status: 'falhou', version });
    return;
  }
  // Já instalada: se o reinício falhar, basta fechar e abrir o app.
  try {
    await deps?.relaunch();
  } catch (err) {
    console.error('Reinício depois da atualização falhou:', err);
    setState({ status: 'reiniciar', version });
  }
}

/** Só para os testes: volta ao estado de quem acabou de abrir o app. */
export function resetUpdateForTests(): void {
  state = { status: 'nenhuma' };
  pending = undefined;
  nextCheckAt = undefined;
  failures = 0;
  deps = undefined;
  inFlight = undefined;
  manualCheck = false;
  listeners.clear();
  checkingListeners.clear();
}
