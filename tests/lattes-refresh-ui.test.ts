// "Atualizar do Lattes" no editor (src/ui/lattes-refresh.ts): as passadas
// contra o Lattes simulado, as paradas, e os textos do canto e do sino.

import { afterEach, describe, expect, it } from 'vitest';

import type { MergeResult } from '../src/bridge/refresh/merge.ts';
import { readRefreshPart, type RefreshRequest } from '../src/bridge/refresh/read.ts';
import { mergeMarks } from '../src/model/form-read.ts';
import { newItem } from '../src/model/production.ts';
import { insertInSchemaOrder } from '../src/model/schema-order.ts';
import {
  childElements,
  parseXml,
  serializeXml,
  setAttr,
  type XDocument,
} from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import {
  formReadNote,
  gapsText,
  type PartAnswer,
  refreshFailureText,
  refreshNote,
  refreshNotice,
  type RefreshOutcome,
  type RefreshStop,
  type RefreshSummary,
  refreshToast,
  runRefresh,
  stageText,
  summaryText,
} from '../src/ui/lattes-refresh.ts';
import { noticesFor, staleExportNotice } from '../src/ui/notifications.ts';
import {
  faults,
  type LattesSimuladoNoTeste,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

let lattes: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await lattes?.close();
  lattes = undefined;
});

const ID = '3871592046158372';

/** O editor de mentira: a exportação como base e a cópia de trabalho, com o que cada parte trouxe. */
function editor(published: string) {
  let base = parseXml(published);
  const working = parseXml(published);
  let counter = 1000;
  const commits: MergeResult[] = [];
  return {
    commit: (doc: XDocument, merged: MergeResult) => {
      base = doc;
      counter = merged.counter;
      commits.push(merged);
    },
    commits,
    current: () => ({ base: parseXml(serializeXml(base)), counter, working: working.root }),
    working,
  };
}

function addArticle(sim: LattesSimuladoNoTeste, title: string) {
  const item = newItem(lattesSchema, 'ARTIGO-PUBLICADO', ++sim.state.nextProduction);
  const basics = childElements(item)[0]!;
  setAttr(basics, 'TITULO-DO-ARTIGO', title);
  setAttr(basics, 'ANO-DO-ARTIGO', '2026');
  const container = sim.state.ensurePath(['PRODUCAO-BIBLIOGRAFICA', 'ARTIGOS-PUBLICADOS']);
  insertInSchemaOrder(lattesSchema, container, item);
}

async function asker(sim: LattesSimuladoNoTeste, lattesId = ID) {
  const menu = await sim.port.menuHtml();
  return async (request: RefreshRequest): Promise<PartAnswer> => ({
    lattesId,
    part: await readRefreshPart(
      { get: sim.port.get, readForm: sim.port.readForm },
      menu,
      sim.state.code,
      request,
    ),
  });
}

describe('as passadas contra o Lattes simulado', () => {
  it('lê as listas, os formulários e leva cada parte ao editor', async () => {
    lattes = await withLattesSimulado();
    const ed = editor(serializeXml(lattes.state.published));
    addArticle(lattes, 'Artigo publicado depois da exportação');
    const stages: string[] = [];
    const out = await runRefresh({
      ask: await asker(lattes),
      commit: ed.commit,
      current: ed.current,
      lattesId: ID,
      now: () => 5,
      onStage: (s) => stages.push(stageText(s)),
    });
    expect(out).toMatchObject({ ok: true, summary: { added: [expect.any(String)], left: 0 } });
    expect(stages).toEqual([
      'Lendo as listas do Lattes (parte 1).',
      'Lendo os formulários das linhas novas (0 de 1).',
    ]);
    expect(ed.commits).toHaveLength(1);
    expect(ed.commits[0]?.counter).toBe(1001);
    expect(refreshNote(ed.commits[0]!)).toBe('Atualizado do Lattes: 1 novo');
  });

  it('para quando a sessão é de outro currículo, sem tocar no editor', async () => {
    lattes = await withLattesSimulado();
    const ed = editor(serializeXml(lattes.state.published));
    const out = await runRefresh({
      ask: await asker(lattes, '0000000000000009'),
      commit: ed.commit,
      current: ed.current,
      lattesId: ID,
    });
    expect(out).toMatchObject({ ok: false, reason: 'outro-cv' });
    expect(ed.commits).toEqual([]);
  });

  it('a sessão que cai nos formulários deixa o que já entrou e conta o que faltou', async () => {
    lattes = await withLattesSimulado();
    const published = serializeXml(lattes.state.published);
    addArticle(lattes, 'Primeiro artigo novo');
    // Cada lista é um GET; o formulário vem depois de todas elas.
    const lists = (await asker(lattes))({ step: 'listas' });
    const count = Object.keys(((await lists).part as { lists: object }).lists).length;
    await lattes.close();
    lattes = await withLattesSimulado({ intercept: faults.logonAtGet(count + 1) });
    addArticle(lattes, 'Primeiro artigo novo');
    const ed = editor(published);
    const out = await runRefresh({
      ask: await asker(lattes),
      commit: ed.commit,
      current: ed.current,
      lattesId: ID,
    });
    expect(out).toMatchObject({ ok: false, reason: 'sessao', summary: { left: 1 } });
    expect(refreshNotice(out)?.text).toMatch(/expirou.*Clique para atualizar de novo/);
  });

  it('para sem resposta da extensão, com o currículo fechado, ou sem nenhuma lista', async () => {
    const base = {
      commit: () => undefined,
      current: () => undefined,
      lattesId: ID,
    };
    expect(await runRefresh({ ...base, ask: async () => ({ reason: 'sem-resposta' }) })).toEqual({
      detail: undefined,
      ok: false,
      reason: 'sem-resposta',
      summary: undefined,
    });
    const lists = (unread: string[]): PartAnswer => ({
      lattesId: ID,
      part: { lists: {}, queue: [], step: 'listas', unread },
    });
    expect(await runRefresh({ ...base, ask: async () => lists([]) })).toMatchObject({
      reason: 'fechado',
    });
    expect(await runRefresh({ ...base, ask: async () => lists(['*']) })).toMatchObject({
      detail: 'Nenhuma lista do Lattes foi lida',
      reason: 'erro',
    });
    const endless: PartAnswer = {
      lattesId: ID,
      part: { lists: {}, queue: ['x'], step: 'listas', unread: [] },
    };
    expect(await runRefresh({ ...base, ask: async () => endless })).toMatchObject({
      reason: 'erro',
    });
    const wrong: PartAnswer = { lattesId: ID, part: { forms: [], rest: [], step: 'formularios' } };
    expect(await runRefresh({ ...base, ask: async () => wrong })).toMatchObject({
      reason: 'erro',
    });
    const lost: PartAnswer = {
      lattesId: ID,
      part: { lists: {}, queue: [], reason: 'sessao', step: 'listas', unread: [] },
    };
    expect(await runRefresh({ ...base, ask: async () => lost })).toMatchObject({
      reason: 'sessao',
    });
    const thrown = await runRefresh({
      ...base,
      ask: async () => {
        throw new Error('quebrou');
      },
    });
    expect(thrown).toMatchObject({ detail: 'quebrou', reason: 'erro' });
  });
});

const summary = (over: Partial<RefreshSummary> = {}): RefreshSummary => ({
  added: [],
  changed: [],
  left: 0,
  notCompared: [],
  notRead: [],
  reads: 0,
  same: 0,
  skipped: [],
  ...over,
});

describe('os textos', () => {
  it('o resumo diz o que veio, ou que nada mudou', () => {
    expect(summaryText(summary({ added: ['a'], changed: ['b', 'c'] }))).toBe(
      'Lidos do Lattes: 1 item novo e 2 itens alterados.',
    );
    expect(summaryText(summary({ reads: 2 }))).toBe('Os formulários lidos não trouxeram mudança.');
    expect(summaryText(summary())).toBe(
      'As listas de produção do Lattes batem com o currículo aberto.',
    );
  });

  it('o que ficou de fora vai junto, e nada quando não falta nada', () => {
    expect(gapsText(summary())).toBeUndefined();
    expect(
      gapsText(
        summary({
          left: 3,
          notCompared: ['Artigo publicado'],
          notRead: [{ label: 'Eventos', reason: 'x', rows: 2 }],
          skipped: [
            { reason: 'o formulário não abriu', text: 'Linha A' },
            { reason: 'y', text: 'Linha B' },
          ],
        }),
      ),
    ).toBe(
      'Não lido: Eventos (2 linhas). Não comparado: Artigo publicado. Ficaram de fora 2 linhas: "Linha A" (o formulário não abriu) e outras. Faltou ler 3 formulários; atualize de novo para continuar.',
    );
    expect(gapsText(summary({ skipped: [{ reason: 'z', text: 'L' }] }))).toBe(
      'Ficou de fora 1 linha: "L" (z).',
    );
  });

  it('cada parada tem o seu texto', () => {
    const reasons: RefreshStop[] = [
      'consentimento',
      'erro',
      'fechado',
      'ocupado',
      'outro-cv',
      'sem-aba',
      'sem-resposta',
      'sessao',
    ];
    for (const r of reasons) expect(refreshFailureText(r)).toMatch(/\.$/);
    expect(refreshFailureText('erro', 'A aba caiu.')).toBe(
      'Não deu para ler o Lattes (A aba caiu). Tente de novo.',
    );
  });

  it('o canto e o sino: a parada, com o que já entrou, ou só o que não foi lido', () => {
    const stopped: RefreshOutcome = {
      ok: false,
      reason: 'sem-aba',
      summary: summary({ added: ['a'] }),
    };
    expect(refreshToast(stopped).title).toBe('A atualização do Lattes parou');
    expect(refreshNotice(stopped)).toMatchObject({
      action: 'atualizar-lattes',
      level: 'aviso',
      text: expect.stringContaining('Lidos do Lattes: 1 item novo.'),
    });
    expect(refreshNotice({ ok: false, reason: 'erro' })?.text).not.toMatch(/Lidos/);
    const done: RefreshOutcome = { ok: true, summary: summary({ changed: ['b'] }) };
    expect(refreshToast(done)).toEqual({
      description: 'Lidos do Lattes: 1 item alterado.',
      title: 'Atualizado do Lattes',
    });
    expect(refreshNotice(done)).toBeUndefined();
    expect(refreshNotice(undefined)).toBeUndefined();
    const gaps: RefreshOutcome = {
      ok: true,
      summary: summary({ notRead: [{ label: 'Prêmios e títulos', reason: '', rows: 1 }] }),
    };
    expect(refreshNotice(gaps)).toMatchObject({ level: 'info', title: 'Atualizado do Lattes' });
  });

  it('a nota do histórico e a etiqueta do item', () => {
    const merged: MergeResult = {
      added: [],
      changed: ['a', 'b'],
      counter: 1,
      marks: [],
      same: 0,
      skipped: [],
    };
    expect(refreshNote(merged)).toBe('Atualizado do Lattes: 2 alterados');
    const mark = {
      kind: 'novo' as const,
      readAt: new Date(2026, 9, 27).getTime(),
      seq: '1',
      target: 'x',
    };
    expect(formReadNote(mark)).toMatch(/^Lido dos formulários do Lattes em 27\/10\/2026/);
    expect(mergeMarks([], [mark])).toEqual([mark]);
  });

  it('o aviso da exportação atrasada oferece a leitura quando a extensão sabe', () => {
    const plain = staleExportNotice('22102026', '2026-10-27');
    expect(plain?.action).toBeUndefined();
    const offer = staleExportNotice('22102026', '2026-10-27', true);
    expect(offer).toMatchObject({ action: 'atualizar-lattes', id: 'exportacao-atrasada' });
    expect(offer?.text).toMatch(/Clique para ler agora, pelos formulários do Lattes/);
    const refresh = refreshNotice({ ok: false, reason: 'sessao' });
    const all = noticesFor({ appVersion: '1', refresh, stale: offer, storage: 'cifrado' });
    expect(all.map((n) => n.id)).toEqual(['exportacao-atrasada', 'atualizar-lattes']);
  });
});
