// Os itens de teste da passada completa, pedidos à extensão (só no canal Dev,
// docs/lattes-formularios/itens-de-teste.md). A pessoa clica; a extensão roda
// na aba do Lattes e devolve o resumo, que fica aqui e em
// window.__lattesTestItems para quem acompanha pelo navegador.

import { useEffect, useState } from 'react';

import type { TestItemsAction } from '../bridge/protocol.ts';
import { listenReplies, post } from './use-bridge.ts';

/** O que a extensão está fazendo agora (extension/src/censo-test-items.ts, LiveProgress). */
export interface TestItemsLive {
  at: number;
  done: number;
  last?: string;
  phase: 'criando' | 'lendo' | 'parado' | 'removendo';
  total?: number;
}

export interface TestItemsSummary {
  agora?: TestItemsLive;
  /** Quando a base das listas foi tirada (Fase 0); null sem base. */
  base?: string | null;
  criados?: number;
  /** No ensaio da remoção: as linhas que sairiam. */
  ensaio?: string[];
  falharam?: { msgs: string[]; tag: string }[];
  faltam?: number | null;
  /** Linhas da base que sumiram: não pode acontecer. */
  faltandoDaBase?: string[];
  lote?: string[];
  /** Linhas a mais que a base cuja página não se leu: não saem, nem conferidas. */
  naoLidas?: string[];
  receptorError?: string;
  /** Linhas que as listas têm a mais que a base: o que o teste acrescentou. */
  registrados?: number;
  removidos?: number;
  /** Linhas a mais que a base cuja página não tem a marca: ficaram, para conferir. */
  semMarca?: string[];
  /** O link de cada linha de semMarca, na mesma ordem: o que a conferência devolve. */
  semMarcaLinks?: string[];
  total?: number | null;
}

export interface TestItemsLogLine {
  acao: TestItemsAction;
  at: number;
  error?: string;
  result?: unknown;
}

export interface TestItemsState {
  /** O andamento lido enquanto uma ação corre (de 5 em 5 s). */
  live?: TestItemsLive;
  log: TestItemsLogLine[];
  /** A ação pedida que ainda não voltou. */
  pending?: TestItemsAction;
  summary?: TestItemsSummary;
}

const POLL_MS = 5000;
const POLL_PREFIX = 'itens-teste-andamento-';

/** "12 de 50 · último: tec-2A-v3 ok · há 4 s", do andamento lido. */
export function liveLine(live: TestItemsLive | undefined, now = Date.now()): string {
  if (!live || live.phase === 'parado') return 'Esperando a extensão começar.';
  const count =
    live.phase === 'lendo' ? `${live.done} páginas lidas` : `${live.done} de ${live.total ?? '?'}`;
  const last = live.last ? ` · último: ${live.last}` : '';
  return `${count}${last} · há ${Math.max(0, Math.round((now - live.at) / 1000))} s`;
}

/** O resumo dentro de uma resposta: o andamento, ou o de um lote (que traz o andamento junto). */
export function summaryOf(result: unknown): TestItemsSummary | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const r = result as Record<string, unknown>;
  return 'criados' in r || 'removidos' in r || 'agora' in r ? (r as TestItemsSummary) : undefined;
}

export function useTestItems() {
  const [state, setState] = useState<TestItemsState>({ log: [] });
  const [waiting, setWaiting] = useState<{ acao: TestItemsAction; id: string } | undefined>();

  useEffect(
    () =>
      listenReplies((msg) => {
        if (msg.type !== 'itens-teste') return;
        // A leitura de andamento durante uma ação: só o "agora".
        if (msg.id.startsWith(POLL_PREFIX)) {
          const live = summaryOf(msg.result)?.agora;
          if (live) setState((s) => ({ ...s, live }));
          return;
        }
        if (msg.id !== waiting?.id) return;
        setWaiting(undefined);
        setState((s) => ({
          log: [
            { acao: waiting.acao, at: Date.now(), error: msg.error, result: msg.result },
            ...s.log,
          ].slice(0, 20),
          // A remoção não traz os contadores da criação: junta com o resumo de antes.
          summary: { ...s.summary, ensaio: undefined, ...summaryOf(msg.result) },
        }));
      }),
    [waiting],
  );

  // Enquanto uma ação corre, o andamento de 5 em 5 s.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(
      () => post({ acao: 'andamento', id: `${POLL_PREFIX}${Date.now()}`, type: 'itens-teste' }),
      POLL_MS,
    );
    return () => clearInterval(timer);
  }, [waiting]);

  // Para acompanhar de fora (a automação do navegador lê daqui).
  useEffect(() => {
    (window as unknown as { __lattesTestItems?: unknown }).__lattesTestItems = {
      ...state,
      pending: waiting?.acao,
    };
  }, [state, waiting]);

  const ask = (
    acao: TestItemsAction,
    extra: { batch?: number; dryRun?: boolean; retryFailed?: boolean; unmarked?: string[] } = {},
  ) => {
    if (waiting) return;
    const id = `itens-teste-${Date.now()}`;
    setWaiting({ acao, id });
    post({ acao, id, type: 'itens-teste', ...extra });
  };

  return { ask, pending: waiting?.acao, state, stop: () => post({ type: 'parar' }) };
}
