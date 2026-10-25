// Envia o ZIP de um lançamento já publicado à API v2 da Chrome Web Store.
// As credenciais vêm só do ambiente; respostas e tokens não vão ao log.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

export const STORE_ITEM_ID = 'kdebkpkdhgaeaaobcbgbckinocnlfbgg';

type Json = Record<string, unknown>;
type Options = {
  publisherId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  version: string;
  zip: Uint8Array;
};
type Transport = {
  fetch: typeof fetch;
  pause: (milliseconds: number) => Promise<unknown>;
};

function object(value: unknown): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('A API devolveu uma resposta inválida. Confira o painel da loja.');
  }
  return value as Json;
}

export function validateStorePackage(manifest: unknown, tag: string, nativeHost: string): string {
  const data = object(manifest);
  if (tag.trim() !== tag || !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) {
    throw new Error('Informe a tag de um lançamento estável, como v1.0.0.');
  }
  const version = tag.slice(1);
  if (version.split('.').some((n) => Number(n) > 65535) || version === '0.0.0') {
    throw new Error('A versão não cabe no manifest do Chrome.');
  }
  if (
    data.version !== version ||
    data.manifest_version !== 3 ||
    data.name !== 'LattesEditor: Conector' ||
    Object.hasOwn(data, 'key')
  ) {
    throw new Error('O ZIP precisa ser o pacote da loja, sem key e com a versão da tag.');
  }
  const stableIds = /const EXTENSION_IDS[^;]*?else\s*\{\s*&\[([^\]]*)\]/s.exec(nativeHost)?.[1];
  if (!stableIds?.includes(`"${STORE_ITEM_ID}"`)) {
    throw new Error('O app deste lançamento ainda não autoriza o ID da extensão da loja.');
  }
  return version;
}

/** Não repete POSTs: depois de uma falha de rede, confira a loja antes de tentar de novo. */
export async function submitStorePackage(
  options: Options,
  transport: Transport = { fetch, pause: setTimeout },
): Promise<string> {
  if (options.publisherId.trim() !== options.publisherId || !/^[\w-]+$/.test(options.publisherId)) {
    throw new Error('Publisher ID inválido.');
  }
  if (!options.clientId || !options.clientSecret || !options.refreshToken) {
    throw new Error('Faltam os segredos CWS_CLIENT_ID, CWS_CLIENT_SECRET ou CWS_REFRESH_TOKEN.');
  }
  async function request(url: string, init?: RequestInit): Promise<Json> {
    let response: Response;
    try {
      response = await transport.fetch(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error('Falha de rede na API da loja. Confira o painel antes de repetir o envio.');
    }
    if (!response.ok) {
      throw new Error(
        `A API da loja recusou o pedido (HTTP ${response.status}). Confira o painel e as credenciais.`,
      );
    }
    try {
      return object(await response.json());
    } catch {
      throw new Error('A API devolveu uma resposta inválida. Confira o painel da loja.');
    }
  }
  const token = await request('https://oauth2.googleapis.com/token', {
    body: new URLSearchParams({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: options.refreshToken,
    }),
    method: 'POST',
  });
  if (typeof token.access_token !== 'string' || !token.access_token) {
    throw new Error('A autorização não devolveu um token de acesso.');
  }
  const name = `publishers/${options.publisherId}/items/${STORE_ITEM_ID}`;
  const endpoint = `https://chromewebstore.googleapis.com/v2/${name}`;
  const headers = { Authorization: `Bearer ${token.access_token}` };
  function checkItem(data: Json): void {
    if (data.name !== name || data.itemId !== STORE_ITEM_ID) {
      throw new Error('A resposta da loja não corresponde à extensão esperada.');
    }
  }
  const status = await request(`${endpoint}:fetchStatus`, { headers });
  checkItem(status);
  if (status.takenDown || status.warned) throw new Error('Há uma pendência de política na loja.');
  if (status.lastAsyncUploadState === 'IN_PROGRESS') {
    throw new Error('Já há um upload em andamento. Espere antes de enviar outro.');
  }
  if (status.submittedItemRevisionStatus) {
    const state = object(status.submittedItemRevisionStatus).state;
    if (state === 'PENDING_REVIEW' || state === 'STAGED') {
      throw new Error('Já há uma versão em revisão ou aprovada aguardando publicação.');
    }
  }
  let upload = await request(`https://chromewebstore.googleapis.com/upload/v2/${name}:upload`, {
    body: new Blob([new Uint8Array(options.zip)]),
    headers: { ...headers, 'Content-Type': 'application/zip' },
    method: 'POST',
  });
  checkItem(upload);
  if (upload.uploadState === 'SUCCEEDED' && upload.crxVersion !== options.version) {
    throw new Error('A versão recebida pela loja difere da versão do lançamento.');
  }
  let state = upload.uploadState;
  for (let attempt = 0; state === 'IN_PROGRESS' && attempt < 24; attempt++) {
    await transport.pause(5000);
    upload = await request(`${endpoint}:fetchStatus`, { headers });
    checkItem(upload);
    state = upload.lastAsyncUploadState;
  }
  if (state !== 'SUCCEEDED') {
    throw new Error(
      'O upload não terminou com sucesso. Nada foi enviado à revisão. Confira a loja.',
    );
  }
  const submitted = await request(`${endpoint}:publish`, {
    body: JSON.stringify({
      blockOnWarnings: true,
      publishType: 'DEFAULT_PUBLISH',
      skipReview: false,
    }),
    headers: { ...headers, 'Content-Type': 'application/json' },
    method: 'POST',
  });
  checkItem(submitted);
  if (!['PENDING_REVIEW', 'PUBLISHED', 'PUBLISHED_TO_TESTERS'].includes(String(submitted.state))) {
    throw new Error('A loja não confirmou o envio à revisão. Confira o painel antes de repetir.');
  }
  return String(submitted.state);
}

async function main(): Promise<void> {
  const tag = process.env.CWS_RELEASE_TAG ?? '';
  const zipPath = process.env.CWS_ZIP_PATH ?? '';
  const nativeHostPath = process.env.CWS_NATIVE_HOST_PATH ?? '';
  if (!zipPath || !nativeHostPath) throw new Error('Faltam os caminhos do ZIP e do host nativo.');
  // Não extrai o arquivo: só lê o manifest na raiz e recusa entradas duplicadas.
  const entries = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).split('\n');
  if (entries.filter((entry) => entry === 'manifest.json').length !== 1) {
    throw new Error('O ZIP precisa conter um único manifest.json na raiz.');
  }
  const manifest: unknown = JSON.parse(
    execFileSync('unzip', ['-p', zipPath, 'manifest.json'], { encoding: 'utf8', maxBuffer: 65536 }),
  );
  const version = validateStorePackage(manifest, tag, readFileSync(nativeHostPath, 'utf8'));
  const state = await submitStorePackage({
    clientId: process.env.CWS_CLIENT_ID ?? '',
    clientSecret: process.env.CWS_CLIENT_SECRET ?? '',
    publisherId: process.env.CWS_PUBLISHER_ID ?? '',
    refreshToken: process.env.CWS_REFRESH_TOKEN ?? '',
    version,
    zip: readFileSync(zipPath),
  });
  const message = `Extensão ${version}: ${state}. A publicação segue a aprovação da loja e a visibilidade já configurada.`;
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Falha ao enviar a extensão.');
    process.exitCode = 1;
  });
}
