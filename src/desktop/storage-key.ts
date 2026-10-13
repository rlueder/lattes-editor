// Busca a chave dos dados locais antes do primeiro render e abre o banco com
// ela (src/model/store.ts).
//
// No app de desktop, a chave mora no chaveiro do sistema
// (src-tauri/src/chave.rs). No primeiro uso não há chave: o editor gera uma
// com o WebCrypto e pede ao app para guardá-la. Se o chaveiro não responde, o
// editor segue sem gravar nada, em vez de gravar o currículo em claro.
//
// No `pnpm dev` no navegador, sem chaveiro, vale a chave fixa de
// desenvolvimento. Fora dos dois casos (um build aberto num navegador
// qualquer), não há chave e nada é gravado.

import {
  decodeKey,
  DEVELOPMENT_KEY,
  encodeKey,
  importStorageKey,
  randomKeyBytes,
} from '../model/seal.ts';
import { markStorageUnavailable, openStorage, type StorageStatus } from '../model/store.ts';
import { isDesktop } from './native.ts';

/**
 * Quanto esperar pelo chaveiro antes de abrir sem gravar. Dá tempo de digitar
 * a senha que o Secret Service pede no Linux, e o app nunca fica em branco.
 */
export const KEYCHAIN_TIMEOUT_MS = 60_000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('O chaveiro do sistema não respondeu a tempo.')),
      ms,
    );
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function keyFromKeychain(): Promise<Uint8Array> {
  const { invoke } = await import('@tauri-apps/api/core');
  const stored = await invoke<string | null>('storage_key_get');
  if (stored) return decodeKey(stored);
  const fresh = randomKeyBytes();
  await invoke('storage_key_set', { key: encodeKey(fresh) });
  return fresh;
}

export async function initStorage({
  desktop = isDesktop(),
  dev = import.meta.env.DEV,
} = {}): Promise<StorageStatus> {
  try {
    const raw = desktop
      ? await withTimeout(keyFromKeychain(), KEYCHAIN_TIMEOUT_MS)
      : dev
        ? DEVELOPMENT_KEY
        : undefined;
    if (!raw) return markStorageUnavailable('Fora do app de desktop não há chaveiro.');
    return await openStorage(await importStorageKey(raw));
  } catch (err) {
    // A mensagem do app nunca traz a chave; a do WebCrypto também não.
    const reason = err instanceof Error ? err.message : String(err);
    console.error('Chave dos dados locais indisponível:', reason);
    return markStorageUnavailable(reason);
  }
}
