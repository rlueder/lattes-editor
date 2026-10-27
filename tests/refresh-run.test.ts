// "Atualizar do Lattes" no service worker (extension/src/refresh-run.ts): a
// chave, o aviso aceito, a aba, a ocupação e a resposta com o id do pedido.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
  consent: true,
  reply: undefined as unknown,
  tab: 7 as number | undefined,
  thrown: false,
}));

vi.mock('../extension/src/consent.ts', () => ({ hasConsent: async () => env.consent }));
vi.mock('../extension/src/editor-run.ts', () => ({ BUSY_TEXT: 'ocupado agora' }));
vi.mock('../extension/src/lattes-tab.ts', () => ({
  lattesTab: async () => env.tab,
  runInTab: async () => {
    if (env.thrown) throw new Error('aba fechou');
    return env.reply;
  },
}));

import { answerRefresh, readLattesPart } from '../extension/src/refresh-run.ts';

const part = { lists: {}, queue: [], step: 'listas' as const, unread: [] };

beforeEach(() => {
  env.consent = true;
  env.reply = { lattesId: '1', part };
  env.tab = 7;
  env.thrown = false;
});

describe('uma parte de "Atualizar do Lattes" na extensão', () => {
  it('lê na aba e devolve a parte com o currículo da sessão', async () => {
    expect(await readLattesPart({ step: 'listas' })).toEqual({ lattesId: '1', part });
  });

  it('chave desligada, sem o aviso aceito ou sem aba: nada é pedido', async () => {
    expect(await readLattesPart({ step: 'listas' }, false)).toMatchObject({ reason: 'erro' });
    env.consent = false;
    expect(await readLattesPart({ step: 'listas' })).toEqual({ reason: 'consentimento' });
    env.consent = true;
    env.tab = undefined;
    expect(await readLattesPart({ step: 'listas' })).toEqual({ reason: 'sem-aba' });
  });

  it('a aba que não responde, que falha ou que devolve erro vira motivo erro', async () => {
    env.reply = undefined;
    expect(await readLattesPart({ step: 'listas' })).toMatchObject({ reason: 'erro' });
    env.thrown = true;
    expect(await readLattesPart({ step: 'listas' })).toMatchObject({ reason: 'erro' });
    env.thrown = false;
    env.reply = { error: 'sem código', lattesId: '1' };
    expect(await readLattesPart({ step: 'listas' })).toEqual({
      error: 'sem código',
      lattesId: '1',
      reason: 'erro',
    });
  });

  it('responde com o id do pedido; ocupada, nem toca na aba', async () => {
    const sent: unknown[] = [];
    const send = async (m: unknown) => void sent.push(m);
    const msg = { id: 'p1', request: { step: 'listas' as const }, type: 'ler-lattes' as const };
    await answerRefresh(msg, async () => false, send);
    await answerRefresh(msg, async () => true, send);
    expect(sent).toEqual([
      { id: 'p1', lattesId: '1', part, type: 'leitura-lattes' },
      { error: 'ocupado agora', id: 'p1', reason: 'ocupado', type: 'leitura-lattes' },
    ]);
  });
});
