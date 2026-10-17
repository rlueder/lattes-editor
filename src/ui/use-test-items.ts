// Os itens de teste da passada completa, pedidos à extensão (só no canal Dev,
// docs/lattes-formularios/itens-de-teste.md). A pessoa clica; a extensão roda
// na aba do Lattes e devolve o resumo, que fica aqui e em
// window.__lattesTestItems para quem acompanha pelo navegador.

import { useEffect, useState } from 'react';

import type { TestItemsAction } from '../bridge/protocol.ts';
import { listenReplies, post } from './use-bridge.ts';

export interface TestItemsSummary {
  criados?: number;
  falharam?: { msgs: string[]; tag: string }[];
  faltam?: number | null;
  lote?: string[];
  removidos?: number;
  total?: number | null;
}

export interface TestItemsLogLine {
  acao: TestItemsAction;
  at: number;
  error?: string;
  result?: unknown;
}

export interface TestItemsState {
  log: TestItemsLogLine[];
  /** A ação pedida que ainda não voltou. */
  pending?: TestItemsAction;
  summary?: TestItemsSummary;
}

/** O resumo dentro de uma resposta: o andamento, ou o de um lote (que traz o andamento junto). */
export function summaryOf(result: unknown): TestItemsSummary | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const r = result as Record<string, unknown>;
  return 'criados' in r || 'removidos' in r ? (r as TestItemsSummary) : undefined;
}

export function useTestItems() {
  const [state, setState] = useState<TestItemsState>({ log: [] });
  const [waiting, setWaiting] = useState<{ acao: TestItemsAction; id: string } | undefined>();

  useEffect(
    () =>
      listenReplies((msg) => {
        if (msg.type !== 'itens-teste' || msg.id !== waiting?.id) return;
        setWaiting(undefined);
        setState((s) => ({
          log: [
            { acao: waiting.acao, at: Date.now(), error: msg.error, result: msg.result },
            ...s.log,
          ].slice(0, 20),
          summary: summaryOf(msg.result) ?? s.summary,
        }));
      }),
    [waiting],
  );

  // Para acompanhar de fora (a automação do navegador lê daqui).
  useEffect(() => {
    (window as unknown as { __lattesTestItems?: unknown }).__lattesTestItems = {
      ...state,
      pending: waiting?.acao,
    };
  }, [state, waiting]);

  const ask = (acao: TestItemsAction, extra: { batch?: number; retryFailed?: boolean } = {}) => {
    if (waiting) return;
    const id = `itens-teste-${Date.now()}`;
    setWaiting({ acao, id });
    post({ acao, id, type: 'itens-teste', ...extra });
  };

  return { ask, pending: waiting?.acao, state };
}
