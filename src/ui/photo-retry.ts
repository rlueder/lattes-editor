// A foto do perfil vem do CNPq, pela rede, sem garantia de chegar na primeira
// tentativa (app aberto antes da rede, servidor lento). Sem nova tentativa, o
// avatar ficava vazio até reabrir o app. Aqui, as esperas entre tentativas e o
// endereço de cada uma (com um parâmetro a mais, para não reaproveitar a
// resposta que falhou).

/** Espera antes de cada nova tentativa; depois da última, só ao voltar a rede ou a janela. */
const RETRY_DELAYS_MS = [3_000, 15_000, 60_000];

/** Sem resposta em tanto tempo, a tentativa conta como falha. */
export const PHOTO_TIMEOUT_MS = 20_000;

/** Quanto esperar antes da tentativa seguinte a `failures` falhas; undefined: parar. */
export function retryDelay(failures: number): number | undefined {
  return RETRY_DELAYS_MS[failures - 1];
}

/** O endereço da tentativa: a primeira é o endereço puro; as outras levam `t`. */
export function attemptUrl(src: string, attempt: number): string {
  if (attempt === 0 || src.startsWith('data:') || src.startsWith('blob:')) return src;
  return `${src}${src.includes('?') ? '&' : '?'}t=${attempt}`;
}

// Estado das tentativas, como função pura para dar para testar sem React.
// Cada evento diz de qual foto (`base`) e de qual tentativa (`attempt`) veio;
// evento de outra foto ou de uma tentativa já tratada é ignorado. Assim, um
// tempo esgotado que chega depois do erro da mesma tentativa não conta duas
// vezes, e uma espera da foto anterior não avança a foto nova.
// Os relógios ficam no hook (use-photo.ts); aqui só as transições.

/**
 * `loading`: esperando a resposta da tentativa. `waiting`: a tentativa falhou
 * e a próxima está marcada. `gave-up`: falharam todas; só tenta de novo quando
 * a rede ou a janela voltam.
 */
export type PhotoStatus = 'gave-up' | 'loaded' | 'loading' | 'waiting';

export interface PhotoState {
  attempt: number;
  base?: string;
  failures: number;
  status: PhotoStatus;
}

export type PhotoEvent =
  | { attempt: number; base?: string; type: 'fail' | 'load' | 'retry' }
  | { base?: string; type: 'reset' }
  | { base?: string; type: 'wake' };

export function initialPhotoState(base: string | undefined): PhotoState {
  return { attempt: 0, base, failures: 0, status: 'loading' };
}

export function photoReducer(state: PhotoState, event: PhotoEvent): PhotoState {
  // Outra foto (outro currículo, ou a mesma trocada): começa do zero.
  if (event.type === 'reset') return initialPhotoState(event.base);
  if (event.base !== state.base) return state;
  if (event.type === 'wake') {
    return state.status === 'gave-up'
      ? { ...state, attempt: state.attempt + 1, failures: 0, status: 'loading' }
      : state;
  }
  if (event.attempt !== state.attempt) return state;
  switch (event.type) {
    case 'fail': {
      if (state.status !== 'loading') return state;
      const failures = state.failures + 1;
      return {
        ...state,
        failures,
        status: retryDelay(failures) === undefined ? 'gave-up' : 'waiting',
      };
    }
    case 'load':
      // Uma resposta atrasada que chega durante a espera também vale.
      return state.status === 'loading' || state.status === 'waiting'
        ? { ...state, status: 'loaded' }
        : state;
    case 'retry':
      return state.status === 'waiting'
        ? { ...state, attempt: state.attempt + 1, status: 'loading' }
        : state;
  }
}
