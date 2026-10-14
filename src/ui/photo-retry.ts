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
