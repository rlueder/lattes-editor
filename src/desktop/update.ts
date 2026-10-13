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

/** Entre conferências, com o app aberto. Lançamentos saem poucas vezes por dia. */
export const CHECK_EVERY_MS = 60 * 60_000;

/** Se já passou tempo bastante desde a última conferência para fazer outra. */
export function shouldCheck(lastCheckedAt: number | undefined, now: number): boolean {
  return lastCheckedAt === undefined || now - lastCheckedAt >= CHECK_EVERY_MS;
}

/** Percentual baixado (0 a 100), ou undefined sem o tamanho total. */
export function percent(received: number, total: number | undefined): number | undefined {
  if (!total || total <= 0) return undefined;
  return Math.min(100, Math.floor((received / total) * 100));
}

let deps: UpdateDeps | undefined;
let state: UpdateState = { status: 'nenhuma' };
let pending: PendingUpdate | undefined;
let lastCheckedAt: number | undefined;
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

/**
 * Confere se há versão nova. Falha de rede ou de leitura passa em silêncio: a
 * próxima conferência tenta de novo. Uma atualização já em download não é
 * substituída.
 */
export async function checkForUpdate(now = Date.now()): Promise<UpdateState> {
  if (!deps || installing()) return state;
  lastCheckedAt = now;
  try {
    const update = await deps.check();
    // Um download começou enquanto a conferência esperava: ela não mexe nele.
    if (!update || installing()) return state;
    pending = update;
    setState({ status: 'disponivel', version: update.version });
  } catch (err) {
    console.warn('Conferência de atualização falhou:', err);
  }
  return state;
}

/** Hora de conferir de novo (ao voltar para a janela, por exemplo). */
export function dueForCheck(now = Date.now()): boolean {
  return shouldCheck(lastCheckedAt, now);
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
  lastCheckedAt = undefined;
  deps = undefined;
  listeners.clear();
}
