import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import {
  compareVersions,
  queryStore,
  STORE_ITEM_ID,
  storeOutputs,
  submitStorePackage,
  validateStorePackage,
} from '../scripts/publicar-extensao.ts';

type Step = { 'continue-on-error'?: unknown; id?: string; if?: string; run?: string };

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

  it.each([
    `// "${STORE_ITEM_ID}",`,
    `/* "${STORE_ITEM_ID}", */`,
    `/* início /* "${STORE_ITEM_ID}" */ fim */`,
    `"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", // TODO: "${STORE_ITEM_ID}"`,
    `concat!("${STORE_ITEM_ID}")`,
  ])('recusa comentários e expressões dentro da lista estável: %s', (entries) => {
    const host = `const EXTENSION_IDS: &[&str] = if DEV { &[] } else { &[${entries}\n] };`;
    expect(() => validateStorePackage(manifest, 'v1.2.3', host)).toThrow('não autoriza');
  });

  it('aceita uma entrada literal ativa entre comentários', () => {
    const host = `const EXTENSION_IDS: &[&str] = if DEV { &[] } else { &[
      // "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", /* outro ID */
      "${STORE_ITEM_ID}", // loja
    ] };`;
    expect(validateStorePackage(manifest, 'v1.2.3', host)).toBe('1.2.3');
  });

  it('ignora uma declaração inteira dentro de comentário de bloco aninhado', () => {
    const host = `/* comentário /* interno */
const EXTENSION_IDS: &[&str] = if DEV { &[] } else { &["${STORE_ITEM_ID}"] };
*/
const EXTENSION_IDS: &[&str] = if DEV { &[] } else { &[] };`;
    expect(() => validateStorePackage(manifest, 'v1.2.3', host)).toThrow('não autoriza');
  });

  it.each(['/* comentário aberto', '"string aberta'])('recusa fonte incompleta: %s', (source) => {
    expect(() => validateStorePackage(manifest, 'v1.2.3', source)).toThrow('conferir');
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
      { ...item, lastAsyncUploadState: 'IN_PROGRESS' },
      {
        ...item,
        lastAsyncUploadState: 'SUCCEEDED',
        submittedItemRevisionStatus: previousRevision,
      },
      pending,
    ]);
    await expect(submitStorePackage(options, transport)).resolves.toBe('PENDING_REVIEW');
    expect(transport.fetch).toHaveBeenCalledTimes(6);
  });

  it('ignora o sucesso antigo até observar o upload novo em andamento', async () => {
    const transport = setup([
      { access_token: 'acesso' },
      { ...item, lastAsyncUploadState: 'SUCCEEDED' },
      { ...item, uploadState: 'IN_PROGRESS' },
      { ...item, lastAsyncUploadState: 'SUCCEEDED' },
      { ...item, lastAsyncUploadState: 'IN_PROGRESS' },
      { ...item, lastAsyncUploadState: 'SUCCEEDED' },
      pending,
    ]);
    await expect(submitStorePackage(options, transport)).resolves.toBe('PENDING_REVIEW');
    expect(transport.pause).toHaveBeenCalledTimes(3);
    expect(transport.fetch).toHaveBeenCalledTimes(7);
    expect(String(transport.fetch.mock.calls[6]?.[0])).toMatch(/:publish$/);
  });

  it('não publica se só observar sucesso sem uma transição de upload em andamento', async () => {
    const transport = setup([
      { access_token: 'acesso' },
      { ...item, lastAsyncUploadState: 'SUCCEEDED' },
      { ...item, uploadState: 'IN_PROGRESS' },
      ...Array.from({ length: 24 }, () => ({ ...item, lastAsyncUploadState: 'SUCCEEDED' })),
    ]);
    await expect(submitStorePackage(options, transport)).rejects.toThrow('sucesso confirmado');
    expect(transport.pause).toHaveBeenCalledTimes(24);
    expect(transport.fetch).toHaveBeenCalledTimes(27);
    expect(transport.fetch.mock.calls.some(([url]) => String(url).endsWith(':publish'))).toBe(
      false,
    );
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

describe('consulta à loja, sem envio', () => {
  const published = (crxVersion: unknown) => ({
    distributionChannels: [{ crxVersion, deployPercentage: 100 }],
    state: 'PUBLISHED',
  });

  it('só pede o token e o fetchStatus, e devolve a versão publicada', async () => {
    const transport = setup([
      { access_token: 'acesso' },
      { ...item, publishedItemRevisionStatus: published('1.0.0') },
    ]);
    await expect(queryStore(options, transport)).resolves.toEqual({
      pending: false,
      policy: false,
      submittedState: '',
      version: '1.0.0',
    });
    const calls = transport.fetch.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[0]).toBe('https://oauth2.googleapis.com/token');
    expect(calls[1]?.[0]).toBe(`https://chromewebstore.googleapis.com/v2/${name}:fetchStatus`);
    expect(calls[1]?.[1]?.method).toBeUndefined();
    expect(calls[1]?.[1]?.redirect).toBe('error');
  });

  it.each(['PENDING_REVIEW', 'STAGED'])(
    'com revisão %s, devolve a versão submetida e marca pendência',
    async (state) => {
      const transport = setup([
        { access_token: 'acesso' },
        {
          ...item,
          publishedItemRevisionStatus: published('1.0.0'),
          submittedItemRevisionStatus: { distributionChannels: [{ crxVersion: '1.1.0' }], state },
        },
      ]);
      await expect(queryStore(options, transport)).resolves.toEqual({
        pending: true,
        policy: false,
        submittedState: state,
        version: '1.1.0',
      });
    },
  );

  it('com revisão rejeitada, vale a versão publicada', async () => {
    const transport = setup([
      { access_token: 'acesso' },
      {
        ...item,
        publishedItemRevisionStatus: published('1.0.0'),
        submittedItemRevisionStatus: {
          distributionChannels: [{ crxVersion: '1.1.0' }],
          state: 'REJECTED',
        },
      },
    ]);
    await expect(queryStore(options, transport)).resolves.toMatchObject({
      pending: false,
      submittedState: 'REJECTED',
      version: '1.0.0',
    });
  });

  it('num lançamento gradual, fica com a maior versão dos canais', async () => {
    const transport = setup([
      { access_token: 'acesso' },
      {
        ...item,
        publishedItemRevisionStatus: {
          distributionChannels: [
            { crxVersion: '1.10.0', deployPercentage: 10 },
            { crxVersion: '1.9.0', deployPercentage: 100 },
            { crxVersion: 'x' },
            null,
          ],
        },
      },
    ]);
    await expect(queryStore(options, transport)).resolves.toMatchObject({ version: '1.10.0' });
  });

  it.each([
    [{ ...item, warned: true }, { policy: true }],
    [{ ...item, takenDown: true }, { policy: true }],
    [{ ...item, lastAsyncUploadState: 'IN_PROGRESS' }, { pending: true }],
    [{ ...item, publishedItemRevisionStatus: { distributionChannels: 'x' } }, { version: '' }],
    [{ ...item, publishedItemRevisionStatus: published('1.0.0\nmudou=false') }, { version: '' }],
    [
      { ...item, submittedItemRevisionStatus: { state: 'estado\ninjetado' } },
      { submittedState: '' },
    ],
    [item, { pending: false, policy: false, version: '' }],
  ])('lê pendências e descarta valores fora do formato: %j', async (status, expected) => {
    await expect(
      queryStore(options, setup([{ access_token: 'acesso' }, status])),
    ).resolves.toMatchObject(expected);
  });

  it('recusa a resposta de outro item e credenciais ausentes', async () => {
    await expect(
      queryStore(options, setup([{ access_token: 'acesso' }, { ...item, itemId: 'outro' }])),
    ).rejects.toThrow('extensão esperada');
    const transport = setup([]);
    await expect(queryStore({ ...options, clientSecret: '' }, transport)).rejects.toThrow(
      'segredos',
    );
    expect(transport.fetch).not.toHaveBeenCalled();
  });

  it('grava as saídas do GitHub uma por linha', () => {
    expect(
      storeOutputs({ pending: true, policy: false, submittedState: 'STAGED', version: '1.1.0' }),
    ).toBe('versao=1.1.0\npendente=true\npolitica=false\nestado=STAGED\n');
  });

  it('ordena versões numericamente', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.0.1')).toBeLessThan(0);
  });
});

it('mantém o workflow restrito à main e ao ZIP do lançamento publicado', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/extensao-loja.yml', import.meta.url),
    'utf8',
  );
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).toContain('workflow_call:');
  expect(workflow).not.toMatch(/^ {2}(push|pull_request|release|workflow_run|schedule):/m);
  expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
  expect(workflow).toContain('environment: chrome-web-store');
  expect(workflow).toContain('contents: read');
  expect(workflow).toContain('cancel-in-progress: false');
  expect(workflow).toContain('CONFIRMAR: ${{ inputs.confirmar }}');
  expect(workflow).toContain('[ "$AUTOMATICO" != true ] && [ "$CONFIRMAR" != true ]');
  expect(workflow).toContain(
    'CWS_PUBLISHER_ID: ${{ vars.CWS_PUBLISHER_ID || secrets.CWS_PUBLISHER_ID }}',
  );
  expect(workflow).toContain('.isDraft == false and .isPrerelease == false');
  expect(workflow).toContain('--pattern lattes-editor-extensao-loja.zip');
  expect(workflow).toContain('sha256sum --check');
  expect(workflow).not.toContain('pnpm build:extension');
  // Só o modo automático tolera falhas; o manual continua falhando alto.
  expect(workflow).toContain('node scripts/publicar-extensao.ts --consulta');
  expect(workflow).toContain('node scripts/extensao-mudou.ts');
  const steps = (parse(workflow) as { jobs: { enviar: { steps: Step[] } } }).jobs.enviar.steps;
  for (const id of ['conferir', 'enviar']) {
    expect(steps.find((step) => step.id === id)?.['continue-on-error']).toBe(
      '${{ inputs.automatico == true }}',
    );
  }
  expect(steps.find((step) => step.id === 'enviar')?.run).toBe('node scripts/publicar-extensao.ts');
  expect(steps.at(-1)?.if).toMatch(/^inputs\.automatico && /);
  expect(steps.at(-1)?.run).toContain('::warning');
});

it('o PROD 2 chama o envio automático depois de publicar, só com leitura', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/publicar.yml', import.meta.url),
    'utf8',
  );
  expect(workflow).toContain('uses: ./.github/workflows/extensao-loja.yml');
  expect(workflow).toContain('needs: publicar');
  expect(workflow).toContain('tag: ${{ needs.publicar.outputs.tag }}');
  expect(workflow).toContain('automatico: true');
  expect(workflow).toContain('secrets: inherit');
  const jobs = (parse(workflow) as { jobs: Record<string, { permissions?: unknown }> }).jobs;
  expect(jobs.extensao?.permissions).toEqual({ contents: 'read' });
  expect(jobs.publicar?.permissions).toEqual({ contents: 'write' });
});
