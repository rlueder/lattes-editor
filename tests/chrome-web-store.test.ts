import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import {
  STORE_ITEM_ID,
  submitStorePackage,
  validateStorePackage,
} from '../scripts/publicar-extensao.ts';

const nativeHost = readFileSync(new URL('../src-tauri/src/conector.rs', import.meta.url), 'utf8');
const manifest = { manifest_version: 3, name: 'LattesEditor: Conector', version: '1.2.3' };
const options = {
  clientId: 'cliente-teste',
  clientSecret: 'segredo-teste',
  publisherId: 'publicador-teste',
  refreshToken: 'refresh-teste',
  version: '1.2.3',
  zip: new Uint8Array([80, 75]),
};
const name = `publishers/${options.publisherId}/items/${STORE_ITEM_ID}`;
const item = { itemId: STORE_ITEM_ID, name };
const success = { ...item, crxVersion: options.version, uploadState: 'SUCCEEDED' };
const pending = { ...item, state: 'PENDING_REVIEW' };

function setup(responses: unknown[]) {
  const request = vi.fn<typeof fetch>();
  for (const response of responses) {
    request.mockResolvedValueOnce(new Response(JSON.stringify(response)));
  }
  const pause = vi.fn(async (_milliseconds: number) => {});
  return { fetch: request, pause };
}

describe('pacote da Chrome Web Store', () => {
  it('confere a versão e o ID autorizado pelo host estável', () => {
    expect(validateStorePackage(manifest, 'v1.2.3', nativeHost)).toBe('1.2.3');
    expect(nativeHost).toContain(`"${STORE_ITEM_ID}"`);
  });

  it.each(['main', 'v1.2.3-dev.1', 'v01.2.3', 'v1.2', 'v1.2.3\n'])('recusa a tag %j', (tag) => {
    expect(() => validateStorePackage(manifest, tag, nativeHost)).toThrow(
      'tag de um lançamento estável',
    );
  });

  it.each(['v65536.0.0', 'v0.0.0'])('recusa uma versão incompatível com o Chrome: %s', (tag) => {
    expect(() => validateStorePackage(manifest, tag, nativeHost)).toThrow('não cabe');
  });

  it.each([
    { ...manifest, key: '' },
    { ...manifest, key: 'chave-de-desenvolvimento' },
    { ...manifest, version: '1.2.2' },
    { ...manifest, manifest_version: 2 },
    { ...manifest, name: 'LattesEditor Dev: Conector' },
  ])('recusa o manifest errado: %j', (data) => {
    expect(() => validateStorePackage(data, 'v1.2.3', nativeHost)).toThrow('pacote da loja');
  });

  it.each([null, [], 'manifest'])('recusa um manifest que não é objeto: %j', (data) => {
    expect(() => validateStorePackage(data, 'v1.2.3', nativeHost)).toThrow('inválida');
  });

  it('não aceita um ID autorizado só no canal Dev ou num comentário', () => {
    const host = `// "${STORE_ITEM_ID}"
const EXTENSION_IDS: &[&str] = if DEV { &["${STORE_ITEM_ID}"] } else { &["outro-id"] };`;
    expect(() => validateStorePackage(manifest, 'v1.2.3', host)).toThrow('não autoriza');
    expect(() => validateStorePackage(manifest, 'v1.2.3', '')).toThrow('não autoriza');
  });
});

describe('envio à API v2 da loja', () => {
  it('autoriza, confere o item, envia o ZIP e pede revisão sem ignorar avisos', async () => {
    const transport = setup([{ access_token: 'acesso-teste' }, item, success, pending]);
    await expect(submitStorePackage(options, transport)).resolves.toBe('PENDING_REVIEW');
    const calls = transport.fetch.mock.calls;
    expect(calls[0]?.[0]).toBe('https://oauth2.googleapis.com/token');
    expect(String(calls[0]?.[1]?.body)).toContain('grant_type=refresh_token');
    expect(calls[1]?.[0]).toBe(`https://chromewebstore.googleapis.com/v2/${name}:fetchStatus`);
    expect(calls[2]?.[0]).toBe(`https://chromewebstore.googleapis.com/upload/v2/${name}:upload`);
    expect(calls[2]?.[1]?.body).toBeInstanceOf(Blob);
    expect(JSON.parse(String(calls[3]?.[1]?.body))).toEqual({
      blockOnWarnings: true,
      publishType: 'DEFAULT_PUBLISH',
      skipReview: false,
    });
    for (const [, init] of calls) {
      expect(init?.redirect).toBe('error');
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(transport.pause).not.toHaveBeenCalled();
  });

  it('espera o processamento assíncrono antes de pedir revisão', async () => {
    const transport = setup([
      { access_token: 'acesso' },
      item,
      { ...item, uploadState: 'IN_PROGRESS' },
      { ...item, lastAsyncUploadState: 'IN_PROGRESS' },
      { ...item, lastAsyncUploadState: 'SUCCEEDED' },
      pending,
    ]);
    await expect(submitStorePackage(options, transport)).resolves.toBe('PENDING_REVIEW');
    expect(transport.pause).toHaveBeenCalledTimes(2);
    expect(transport.pause).toHaveBeenCalledWith(5000);
    expect(transport.fetch).toHaveBeenCalledTimes(6);
  });

  it('não usa a revisão anterior como confirmação da versão do upload assíncrono', async () => {
    const previousRevision = {
      distributionChannels: [{ crxVersion: '1.2.2' }],
      state: 'REJECTED',
    };
    const transport = setup([
      { access_token: 'acesso' },
      { ...item, submittedItemRevisionStatus: previousRevision },
      { ...item, crxVersion: options.version, uploadState: 'IN_PROGRESS' },
      {
        ...item,
        lastAsyncUploadState: 'SUCCEEDED',
        submittedItemRevisionStatus: previousRevision,
      },
      pending,
    ]);
    await expect(submitStorePackage(options, transport)).resolves.toBe('PENDING_REVIEW');
    expect(transport.fetch).toHaveBeenCalledTimes(5);
  });

  it.each([
    { ...item, warned: true },
    { ...item, takenDown: true },
    { ...item, lastAsyncUploadState: 'IN_PROGRESS' },
    { ...item, submittedItemRevisionStatus: { state: 'PENDING_REVIEW' } },
    { ...item, submittedItemRevisionStatus: { state: 'STAGED' } },
    { ...item, name: 'publishers/outro/items/outro' },
    { ...item, itemId: 'outro' },
  ])('não sobrescreve uma pendência ou outro item: %j', async (status) => {
    const transport = setup([{ access_token: 'acesso' }, status]);
    await expect(submitStorePackage(options, transport)).rejects.toThrow();
    expect(transport.fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    { ...success, uploadState: 'FAILED' },
    { ...success, uploadState: 'NOT_FOUND' },
    { ...success, uploadState: 'desconhecido' },
    { ...success, crxVersion: '1.2.2' },
    { ...success, crxVersion: undefined },
    { ...item, crxVersion: '1.2.2', uploadState: 'IN_PROGRESS' },
    { ...success, itemId: 'outro' },
  ])('não pede revisão depois de upload incorreto: %j', async (upload) => {
    const transport = setup([{ access_token: 'acesso' }, item, upload]);
    await expect(submitStorePackage(options, transport)).rejects.toThrow();
    expect(transport.fetch).toHaveBeenCalledTimes(3);
  });

  it('encerra a espera sem publicar quando o upload não termina', async () => {
    const transport = setup([
      { access_token: 'acesso' },
      item,
      { ...item, uploadState: 'IN_PROGRESS' },
      ...Array.from({ length: 24 }, () => ({ ...item, lastAsyncUploadState: 'IN_PROGRESS' })),
    ]);
    await expect(submitStorePackage(options, transport)).rejects.toThrow('não terminou');
    expect(transport.pause).toHaveBeenCalledTimes(24);
    expect(transport.fetch).toHaveBeenCalledTimes(27);
  });

  it.each(['REJECTED', 'CANCELLED', 'STAGED', undefined])(
    'não anuncia sucesso no estado %s',
    async (state) => {
      const transport = setup([{ access_token: 'acesso' }, item, success, { ...item, state }]);
      await expect(submitStorePackage(options, transport)).rejects.toThrow('não confirmou');
    },
  );

  it('recusa credenciais ausentes e Publisher ID inválido antes de chamar a rede', async () => {
    const transport = setup([]);
    await expect(submitStorePackage({ ...options, refreshToken: '' }, transport)).rejects.toThrow(
      'segredos',
    );
    await expect(
      submitStorePackage({ ...options, publisherId: '../outro' }, transport),
    ).rejects.toThrow('Publisher ID');
    expect(transport.fetch).not.toHaveBeenCalled();
  });

  it('não expõe respostas de erro ou credenciais no diagnóstico', async () => {
    const transport = setup([]);
    transport.fetch.mockResolvedValue(
      new Response('segredo-que-nao-pode-aparecer', { status: 401 }),
    );
    await expect(submitStorePackage(options, transport)).rejects.toThrow('HTTP 401');
    await expect(submitStorePackage(options, transport)).rejects.not.toThrow(
      'segredo-que-nao-pode-aparecer',
    );
    transport.fetch.mockRejectedValue(new Error('segredo-que-nao-pode-aparecer'));
    await expect(submitStorePackage(options, transport)).rejects.toThrow('Falha de rede');
    expect(transport.fetch).toHaveBeenCalledTimes(3);
  });

  it.each([{}, { access_token: '' }, { access_token: 42 }])(
    'recusa autorização sem token: %j',
    async (token) => {
      await expect(submitStorePackage(options, setup([token]))).rejects.toThrow('token de acesso');
    },
  );

  it('recusa resposta malformada', async () => {
    const transport = setup([]);
    transport.fetch.mockResolvedValue(new Response('não é JSON'));
    await expect(submitStorePackage(options, transport)).rejects.toThrow('inválida');
  });
});

it('mantém o workflow manual, restrito à main e ao ZIP do lançamento publicado', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/extensao-loja.yml', import.meta.url),
    'utf8',
  );
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).not.toMatch(/^ {2}(push|pull_request|release|workflow_run|schedule):/m);
  expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
  expect(workflow).toContain('environment: chrome-web-store');
  expect(workflow).toContain('contents: read');
  expect(workflow).toContain('cancel-in-progress: false');
  expect(workflow).toContain('CONFIRMAR: ${{ inputs.confirmar }}');
  expect(workflow).toContain(
    'CWS_PUBLISHER_ID: ${{ vars.CWS_PUBLISHER_ID || secrets.CWS_PUBLISHER_ID }}',
  );
  expect(workflow).toContain('.isDraft == false and .isPrerelease == false');
  expect(workflow).toContain('--pattern lattes-editor-extensao-loja.zip');
  expect(workflow).toContain('sha256sum --check');
  expect(workflow).not.toContain('pnpm build:extension');
});
