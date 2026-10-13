// Cifra do que o editor guarda no IndexedDB: AES-GCM pelo WebCrypto, com uma
// chave de 256 bits que no app de desktop mora no chaveiro do sistema
// (src-tauri/src/chave.rs). A chave entra uma vez, como CryptoKey não
// exportável; daqui em diante nem o próprio editor consegue lê-la de volta.

/** Um valor cifrado: o vetor de inicialização e o texto cifrado (com a etiqueta do GCM). */
export interface Sealed {
  data: ArrayBuffer;
  iv: Uint8Array;
}

const KEY_BYTES = 32;
const IV_BYTES = 12;

/**
 * Chave fixa para `pnpm dev` no navegador, onde não há chaveiro. Só serve para
 * o currículo de exemplo e para testes: qualquer pessoa com o código-fonte a
 * conhece. O build de produção nunca a usa (src/desktop/storage-key.ts).
 */
export const DEVELOPMENT_KEY = new TextEncoder().encode(
  'lattes-editor-chave-desenvolvimento'.slice(0, KEY_BYTES),
);

export function randomKeyBytes(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(KEY_BYTES));
}

export function encodeKey(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

export function decodeKey(text: string): Uint8Array {
  const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  if (bytes.length !== KEY_BYTES) throw new Error('Chave com tamanho inesperado');
  return bytes;
}

export function importStorageKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== KEY_BYTES) throw new Error('Chave com tamanho inesperado');
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const data = await crypto.subtle.encrypt({ iv, name: 'AES-GCM' }, key, plain);
  return { data, iv };
}

/** Decifra; rejeita se a chave não for a que cifrou (ou se o dado foi alterado). */
export async function unseal<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    { iv: sealed.iv as BufferSource, name: 'AES-GCM' },
    key,
    sealed.data,
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

export function isSealed(value: unknown): value is Sealed {
  if (!value || typeof value !== 'object') return false;
  const { data, iv } = value as Partial<Sealed>;
  return data instanceof ArrayBuffer && iv instanceof Uint8Array;
}
