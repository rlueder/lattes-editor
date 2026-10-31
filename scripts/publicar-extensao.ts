// Envia o ZIP de um lançamento já publicado à API v2 da Chrome Web Store.
// Com --consulta, só lê a versão e as pendências do item, sem enviar nada.
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

/** Preserva strings e quebras de linha; comentários de bloco Rust podem ser aninhados. */
function withoutRustComments(source: string): string {
  let result = '';
  let depth = 0;
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    const pair = source.slice(i, i + 2);
    if (depth) {
      if (pair === '/*') {
        depth++;
        i++;
      } else if (pair === '*/') {
        depth--;
        i++;
      } else if (char === '\n') result += '\n';
    } else if (quoted) {
      result += char;
      if (char === '\\' && i + 1 < source.length) result += source[++i];
      else if (char === '"') quoted = false;
    } else if (pair === '//') {
      while (i + 1 < source.length && source[i + 1] !== '\n') i++;
      result += ' ';
    } else if (pair === '/*') {
      depth = 1;
      result += ' ';
      i++;
    } else {
      result += char;
      if (char === '"') quoted = true;
    }
  }
  if (depth || quoted) throw new Error('Não foi possível conferir o código do host nativo.');
  return result;
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
  const source = withoutRustComments(nativeHost);
  const stableIds = /^\s*const EXTENSION_IDS[^;]*?else\s*\{\s*&\[([^\]]*)\]/ms.exec(source)?.[1];
  // Só aceita a lista literal usada pelo host. Uma expressão Rust pede conferência manual.
  const literalList = /^\s*(?:"[a-p]{32}"\s*,\s*)*(?:"[a-p]{32}"\s*,?\s*)?$/;
  if (
    !stableIds ||
    !literalList.test(stableIds) ||
    ![...stableIds.matchAll(/"([a-p]{32})"/g)].some((match) => match[1] === STORE_ITEM_ID)
  ) {
    throw new Error('O app deste lançamento ainda não autoriza o ID da extensão da loja.');
  }
  return version;
}

type Credentials = Pick<Options, 'clientId' | 'clientSecret' | 'publisherId' | 'refreshToken'>;
type Store = {
  endpoint: string;
  headers: Record<string, string>;
  name: string;
  request: (url: string, init?: RequestInit) => Promise<Json>;
  status: Json;
};

/** Pede o token e o fetchStatus do item; os dois modos partem daqui. */
async function openStore(credentials: Credentials, transport: Transport): Promise<Store> {
  const { clientId, clientSecret, publisherId, refreshToken } = credentials;
  if (publisherId.trim() !== publisherId || !/^[\w-]+$/.test(publisherId)) {
    throw new Error('Publisher ID inválido.');
  }
  if (!clientId || !clientSecret || !refreshToken) {
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
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    method: 'POST',
  });
  if (typeof token.access_token !== 'string' || !token.access_token) {
    throw new Error('A autorização não devolveu um token de acesso.');
  }
  const name = `publishers/${publisherId}/items/${STORE_ITEM_ID}`;
  const endpoint = `https://chromewebstore.googleapis.com/v2/${name}`;
  const headers = { Authorization: `Bearer ${token.access_token}` };
  const status = await request(`${endpoint}:fetchStatus`, { headers });
  checkItem(status, name);
  return { endpoint, headers, name, request, status };
}

function checkItem(data: Json, name: string): void {
  if (data.name !== name || data.itemId !== STORE_ITEM_ID) {
    throw new Error('A resposta da loja não corresponde à extensão esperada.');
  }
}

const VERSION = /^\d{1,5}(\.\d{1,5}){0,3}$/;

/** Ordena versões do Chrome (até quatro números); negativo se a vem antes de b. */
export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 4; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

/** A maior versão entre os canais de uma revisão; vazio quando a loja não informa. */
function revisionVersion(revision: unknown): string {
  if (!revision || typeof revision !== 'object') return '';
  const channels = (revision as Json).distributionChannels;
  if (!Array.isArray(channels)) return '';
  let best = '';
  for (const channel of channels) {
    const version = (channel as Json | null)?.crxVersion;
    if (typeof version === 'string' && VERSION.test(version)) {
      if (!best || compareVersions(version, best) > 0) best = version;
    }
  }
  return best;
}

export type StoreState = {
  /** Versão que a loja tem: a submetida, se em revisão ou aprovada, senão a publicada. */
  version: string;
  /** Revisão pendente ou aprovada aguardando publicação, ou upload em andamento. */
  pending: boolean;
  /** Item removido ou advertido pela loja. */
  policy: boolean;
  /** Estado da revisão submetida, como a loja devolve. */
  submittedState: string;
};

/** Só lê: token e fetchStatus. Nunca envia pacote nem pede revisão. */
export async function queryStore(
  credentials: Credentials,
  transport: Transport = { fetch, pause: setTimeout },
): Promise<StoreState> {
  const { status } = await openStore(credentials, transport);
  const submitted =
    status.submittedItemRevisionStatus && typeof status.submittedItemRevisionStatus === 'object'
      ? (status.submittedItemRevisionStatus as Json)
      : undefined;
  const submittedState = typeof submitted?.state === 'string' ? submitted.state : '';
  const inReview = submittedState === 'PENDING_REVIEW' || submittedState === 'STAGED';
  return {
    pending: inReview || status.lastAsyncUploadState === 'IN_PROGRESS',
    policy: Boolean(status.takenDown || status.warned),
    submittedState: /^[A-Z_]{1,40}$/.test(submittedState) ? submittedState : '',
    version: inReview
      ? revisionVersion(submitted)
      : revisionVersion(status.publishedItemRevisionStatus),
  };
}

/** Não repete POSTs: depois de uma falha de rede, confira a loja antes de tentar de novo. */
export async function submitStorePackage(
  options: Options,
  transport: Transport = { fetch, pause: setTimeout },
): Promise<string> {
  const { endpoint, headers, name, request, status } = await openStore(options, transport);
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
  checkItem(upload, name);
  if (
    (upload.uploadState === 'SUCCEEDED' || Object.hasOwn(upload, 'crxVersion')) &&
    upload.crxVersion !== options.version
  ) {
    throw new Error('A versão recebida pela loja difere da versão do lançamento.');
  }
  // No processamento assíncrono, fetchStatus não expõe a versão do rascunho.
  // As revisões publicada/submetida podem ser antigas e não provam essa versão.
  // A versão vem do manifest validado antes da rede; não faça uploads pelo painel
  // durante este envio. A concorrência do workflow só serializa seus próprios runs.
  let state = upload.uploadState;
  let observedInProgress = false;
  for (let attempt = 0; state === 'IN_PROGRESS' && attempt < 24; attempt++) {
    await transport.pause(5000);
    upload = await request(`${endpoint}:fetchStatus`, { headers });
    checkItem(upload, name);
    const next = upload.lastAsyncUploadState;
    if (next === 'IN_PROGRESS') observedInProgress = true;
    // SUCCEEDED pode ainda ser do upload anterior. Exige uma transição observada
    // pelo fetchStatus; o IN_PROGRESS da resposta do POST não basta.
    if (next !== 'SUCCEEDED' || observedInProgress) state = next;
  }
  if (state !== 'SUCCEEDED') {
    throw new Error(
      'O upload não terminou com sucesso confirmado. Nada foi enviado à revisão. Confira a loja; no caso assíncrono, é preciso observar IN_PROGRESS antes de SUCCEEDED.',
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
  checkItem(submitted, name);
  if (!['PENDING_REVIEW', 'PUBLISHED', 'PUBLISHED_TO_TESTERS'].includes(String(submitted.state))) {
    throw new Error('A loja não confirmou o envio à revisão. Confira o painel antes de repetir.');
  }
  return String(submitted.state);
}

/** Linhas para o $GITHUB_OUTPUT da consulta; os valores já vêm conferidos, sem quebra de linha. */
export function storeOutputs(state: StoreState): string {
  return [
    `versao=${state.version}`,
    `pendente=${state.pending}`,
    `politica=${state.policy}`,
    `estado=${state.submittedState}`,
  ]
    .map((line) => `${line}\n`)
    .join('');
}

function credentialsFromEnv(): Credentials {
  return {
    clientId: process.env.CWS_CLIENT_ID ?? '',
    clientSecret: process.env.CWS_CLIENT_SECRET ?? '',
    publisherId: process.env.CWS_PUBLISHER_ID ?? '',
    refreshToken: process.env.CWS_REFRESH_TOKEN ?? '',
  };
}

/** --consulta: só lê o estado da loja e o grava no $GITHUB_OUTPUT. */
async function query(): Promise<void> {
  const state = await queryStore(credentialsFromEnv());
  const outputs = storeOutputs(state);
  console.log(outputs.trimEnd());
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, outputs);
}

async function main(): Promise<void> {
  if (process.argv.includes('--consulta')) return query();
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
    ...credentialsFromEnv(),
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
    console.error(error instanceof Error ? error.message : 'Falha na API da loja.');
    process.exitCode = 1;
  });
}
