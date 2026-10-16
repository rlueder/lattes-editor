import { describe, expect, it } from 'vitest';

import type { OpResult } from '../src/bridge/apply.ts';
import type { ContractReport } from '../src/bridge/contract.ts';
import type { LattesStatus } from '../src/bridge/lattes-status.ts';
import type { BridgeOp } from '../src/bridge/plan.ts';
import { type SentEntry, sentEntry, sentLogText } from '../src/bridge/sent-log.ts';
import {
  checkedResult,
  contractStop,
  openDivergences,
  pauseText,
  publishBlockText,
  runRound,
  unexpectedResult,
  WRITES_PER_ROUND,
} from '../src/bridge/write-brake.ts';
import { publishBlockers } from '../src/import-export/publish-view.ts';

const op = (key: string): BridgeOp => ({
  expect: { F_TEXTO: 'antes' },
  key,
  kind: 'resumo',
  label: `Resumo ${key}`,
  set: { F_TEXTO: key },
});

const ok = (key: string): OpResult => ({ detail: 'Gravado e conferido', key, status: 'conferido' });

describe('freio de escrita: a resposta da aba', () => {
  it('aceita o resultado da própria operação', () => {
    const r = { assigned: { SEQ: '3' }, detail: 'x', key: 'a', status: 'erro' };
    expect(checkedResult(r, 'a')).toEqual(r);
  });

  it('sem resposta, ou com outra coisa, fica divergente: não dá para saber se gravou', () => {
    for (const raw of [undefined, null]) {
      expect(checkedResult(raw, 'a')).toMatchObject({ key: 'a', status: 'divergente' });
      expect(checkedResult(raw, 'a').detail).toContain('não respondeu');
    }
    for (const raw of [
      'texto',
      { detail: 'x', key: 'b', status: 'conferido' },
      { detail: 'x', key: 'a', status: 'talvez' },
      { key: 'a', status: 'conferido' },
    ]) {
      const r = checkedResult(raw, 'a');
      expect(r).toMatchObject({ key: 'a', status: 'divergente' });
      expect(r.detail).toContain('resposta inesperada');
    }
  });

  it('a falha que estoura vira divergência com o motivo', () => {
    expect(unexpectedResult('a', new Error('Frame was removed.'))).toEqual({
      detail:
        'Falha inesperada na aba do Lattes (Frame was removed); não dá para saber se gravou. Confira esta alteração no Lattes antes de mandar de novo',
      key: 'a',
      status: 'divergente',
    });
    expect(unexpectedResult('a', 'sem aba').detail).toContain('(sem aba)');
  });
});

describe('freio de escrita: a rodada', () => {
  it('grava tudo quando cabe no teto', async () => {
    const seen: string[] = [];
    const end = await runRound([op('a'), op('b')], {
      apply: async (o) => ok(o.key),
      onResult: (r) => void seen.push(r.key),
    });
    expect(end).toEqual({ kind: 'fim' });
    expect(seen).toEqual(['a', 'b']);
  });

  it('pausa no teto, com quantas gravou e quantas faltam', async () => {
    const queue = Array.from({ length: WRITES_PER_ROUND + 3 }, (_, i) => op(`k${i}`));
    const applied: string[] = [];
    const end = await runRound(queue, {
      apply: async (o) => {
        applied.push(o.key);
        return ok(o.key);
      },
      onResult: () => undefined,
    });
    expect(end).toEqual({ done: WRITES_PER_ROUND, kind: 'pausa', left: 3 });
    expect(applied).toHaveLength(WRITES_PER_ROUND);
    // O "Continuar" roda o resto, que cabe.
    const rest = await runRound(queue.slice(WRITES_PER_ROUND), {
      apply: async (o) => ok(o.key),
      onResult: () => undefined,
    });
    expect(rest).toEqual({ kind: 'fim' });
  });

  it('a fila exatamente do tamanho do teto não pausa', async () => {
    const end = await runRound([op('a'), op('b')], {
      apply: async (o) => ok(o.key),
      cap: 2,
      onResult: () => undefined,
    });
    expect(end).toEqual({ kind: 'fim' });
  });

  it('para na primeira divergência, depois de registrá-la', async () => {
    const seen: OpResult[] = [];
    const applied: string[] = [];
    const end = await runRound([op('a'), op('b'), op('c')], {
      apply: async (o) => {
        applied.push(o.key);
        return o.key === 'b' ? { detail: 'diferente', key: 'b', status: 'divergente' } : ok(o.key);
      },
      onResult: async (r) => void seen.push(r),
    });
    expect(applied).toEqual(['a', 'b']);
    expect(seen.map((r) => r.status)).toEqual(['conferido', 'divergente']);
    expect(end).toEqual({ kind: 'problema', result: seen[1] });
  });

  it('a falha inesperada da aba também para a fila', async () => {
    const seen: OpResult[] = [];
    const end = await runRound([op('a'), op('b')], {
      apply: async () => {
        throw new Error('Tab closed');
      },
      onResult: (r) => void seen.push(r),
    });
    expect(seen).toHaveLength(1);
    expect(end).toMatchObject({ kind: 'problema', result: { key: 'a', status: 'divergente' } });
  });

  it('para quando pedem, antes da próxima operação', async () => {
    let stop = false;
    const applied: string[] = [];
    const end = await runRound([op('a'), op('b')], {
      apply: async (o) => {
        applied.push(o.key);
        stop = true;
        return ok(o.key);
      },
      onResult: () => undefined,
      shouldStop: () => stop,
    });
    expect(end).toEqual({ kind: 'parado' });
    expect(applied).toEqual(['a']);
  });

  it('o aviso da pausa diz onde continuar', () => {
    expect(pauseText({ done: 20, left: 12 }, 'aqui')).toBe(
      'Pausa depois de 20 gravações nesta rodada. Confira no Lattes o que já foi gravado e clique em "Continuar" para gravar as 12 que faltam.',
    );
    expect(pauseText({ done: 1, left: 1 }, 'no-editor')).toBe(
      'Pausa depois de 1 gravação nesta rodada. Confira no Lattes o que já foi gravado e clique em "Continuar" no editor para gravar a que falta.',
    );
  });
});

describe('freio de escrita: a conferência do contrato antes da rodada', () => {
  const report = (patch: Partial<ContractReport>): ContractReport => ({
    checkedAt: '2026-10-15T12:00:00.000Z',
    forms: [],
    menu: [],
    status: 'ok',
    ...patch,
  });
  const queue = [{ kind: 'resumo' as const }, { kind: 'resumo' as const }];

  it('segue com o Lattes como o esperado', () => {
    expect(contractStop(report({}), queue)).toBeUndefined();
  });

  it('para com a sessão caída ou sem leitura', () => {
    expect(contractStop(report({ status: 'sessao' }), queue)).toEqual({
      detail: 'A sessão do Lattes caiu; entre de novo',
      status: 'sessao',
    });
    expect(contractStop(report({ detail: 'x', status: 'sessao' }), queue)?.detail).toBe('x');
    expect(contractStop(report({ status: 'erro' }), queue)).toEqual({
      detail: 'Não deu para conferir o Lattes (sem detalhe); nada foi enviado',
      status: 'erro',
    });
    expect(contractStop(report({ detail: 'rede', status: 'erro' }), queue)?.detail).toContain(
      '(rede)',
    );
  });

  it('para com mudança que quebra um formulário da fila, ou sem exemplar dele', () => {
    const changed = report({
      forms: [
        {
          drifts: [{ field: 'F_TEXTO', form: 'RES', kind: 'campo-sumiu' }],
          form: 'RES',
          kind: 'resumo',
          status: 'mudou',
        },
      ],
      status: 'mudou',
    });
    expect(contractStop(changed, queue)?.detail).toBe(
      'O Lattes mudou (RES: campo F_TEXTO sumiu); nada foi enviado. Veja a verificação no painel',
    );
    const unsampled = report({
      forms: [{ drifts: [], form: 'RES', kind: 'resumo', status: 'sem-amostra' }],
    });
    expect(contractStop(unsampled, queue)?.detail).toBe(
      'Não achei no Lattes um exemplar de RES para conferir (sem amostra); nada foi enviado',
    );
    expect(
      contractStop(
        report({
          forms: [
            { detail: 'vazio', drifts: [], form: 'RES', kind: 'resumo', status: 'sem-amostra' },
          ],
        }),
        queue,
      )?.detail,
    ).toContain('(vazio)');
  });
});

describe('freio de escrita: o bloqueio do envio ao CNPq', () => {
  const lattesId = '0000000000000001';
  const entry = (
    id: number,
    key: string,
    sentAt: number,
    status?: 'divergente' | 'erro',
    checkedAt?: number,
  ): SentEntry => ({
    ...sentEntry(op(key), lattesId, sentAt, {
      outcome: status ? { detail: `motivo ${key}`, status } : undefined,
    }),
    checkedAt,
    id,
  });

  it('a divergência sem conferência bloqueia; erro e sessão não', () => {
    const sent = [entry(1, 'a', 100, 'divergente'), entry(2, 'b', 200, 'erro'), entry(3, 'c', 300)];
    expect(openDivergences(sent).map((e) => e.id)).toEqual([1]);
  });

  it('se resolve com "Já conferi no Lattes" ou com a mesma alteração conferida depois', () => {
    expect(openDivergences([entry(1, 'a', 100, 'divergente', 150)])).toEqual([]);
    expect(openDivergences([entry(1, 'a', 100, 'divergente'), entry(2, 'a', 200)])).toEqual([]);
    // Conferida antes da divergência, ou outra alteração conferida, não resolve.
    expect(
      openDivergences([
        entry(1, 'a', 50),
        entry(2, 'a', 100, 'divergente'),
        entry(3, 'b', 200),
        entry(4, 'a', 300, 'divergente'),
      ]).map((e) => e.id),
    ).toEqual([2, 4]);
  });

  it('o aviso conta as gravações', () => {
    expect(publishBlockText(1)).toMatch(/^1 gravação do editor não foi conferida no Lattes\./);
    expect(publishBlockText(3)).toMatch(/^3 gravações do editor não foram conferidas/);
  });

  it('só conta o que ainda não foi publicado; sem a leitura do menu, conta tudo', () => {
    const old = entry(1, 'a', new Date(2026, 7, 1, 12).getTime(), 'divergente');
    const recent = entry(2, 'b', new Date(2026, 9, 15, 12).getTime(), 'divergente');
    const lattes: LattesStatus = { lastPublished: '2026-10-01', pending: true };
    expect(publishBlockers([old, recent], lattes).map((e) => e.id)).toEqual([2]);
    expect(publishBlockers([old, recent], undefined).map((e) => e.id)).toEqual([1, 2]);
    // Nada pendente no Lattes: nada a publicar, nada bloqueia.
    expect(publishBlockers([recent], { pending: false, readAt: Date.now() })).toEqual([]);
  });

  it('o registro em texto diz quando a pessoa conferiu', () => {
    const checked = entry(1, 'a', 100, 'divergente', new Date(2026, 9, 15, 9, 5).getTime());
    expect(sentLogText([checked], { appVersion: '0.22.0', lattesId, now: 200 })).toContain(
      '(não conferido: motivo a; conferido no Lattes pela pessoa em 15/10/2026 às 09:05)',
    );
  });
});
