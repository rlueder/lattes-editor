// O motivo de verdade quando uma chamada à aba do Lattes falha, no lugar de
// um "não respondeu" para tudo, e os últimos dez erros guardados na
// extensão, para saber depois o que houve (o painel os mostra). Só o
// motivo, a hora e a operação: nada do currículo, nem o endereço da aba.

import { TAB_BUSY, TAB_CLOSED, TAB_SILENT, TAB_TIMEOUT_MS } from './tab-guard.ts';

export const TAB_RELOADED = 'A aba do Lattes recarregou no meio da leitura';

export const ERRORS_KEY = 'errosConector';
export const MAX_ERRORS = 10;

export interface TabErrorEntry {
  /** ISO 8601. */
  at: string;
  message: string;
  /** A operação do núcleo do conector (exportar, telaEnvio, listas…). */
  op: string;
}

/** O que o chrome diz traz o endereço da aba, com o código do currículo: sai. */
export const scrub = (text: string): string =>
  text
    .replace(/(?:https?|chrome-extension):\/\/[^\s"']+/g, '(endereço)')
    .replace(/f_cod=\w+/gi, 'f_cod=…')
    .slice(0, 300);

/**
 * A página saiu do lugar no meio do executeScript: o frame sumiu ou o
 * documento foi descarregado. As mensagens de porta fechada ficam de fora,
 * porque também aparecem quando a extensão recarrega.
 */
const NAVIGATED = /frame (?:with id \d+ )?was removed|no frame with id|document (?:was )?unloaded/i;

/** O texto do chrome, sem endereço e sem o ponto final. */
const plain = (raw: string): string => scrub(raw).replace(/\.$/, '');

/** O motivo da falha, para quem lê: `err` é o que a chamada lançou, ou nada (sem resposta). */
export function explainTabError(err: unknown, reloaded: boolean): string {
  const raw = err instanceof Error ? err.message : err === undefined ? '' : String(err);
  if (raw.startsWith(TAB_CLOSED)) return `${TAB_CLOSED}.`;
  if (raw.startsWith(TAB_BUSY)) return TAB_BUSY.endsWith('.') ? TAB_BUSY : `${TAB_BUSY}.`;
  if (/ocupado com outra/.test(raw)) return `${plain(raw)}.`;
  if (reloaded || NAVIGATED.test(raw)) return `${TAB_RELOADED}.`;
  if (raw.startsWith(TAB_SILENT)) {
    return `${TAB_SILENT} em ${TAB_TIMEOUT_MS / 60_000} minutos.`;
  }
  return raw ? `${TAB_SILENT} (${plain(raw)}).` : `${TAB_SILENT}.`;
}

/** Vale tentar de novo: a página recarregou, e a leitura pode repetir sem risco. */
export const worthRetry = (detail: string): boolean => detail.startsWith(TAB_RELOADED);

/**
 * As gravações da lista, uma de cada vez: duas ao mesmo tempo perderiam uma
 * entrada. A fila vale num contexto só, e basta: quem guarda erros é o
 * callTab de lattes-tab.ts, que só roda no service worker (o painel só lê).
 */
let saving: Promise<void> = Promise.resolve();

/** Guarda o erro entre os dez últimos; guardar nunca derruba a chamada. */
export function recordTabError(op: string, message: string): Promise<void> {
  saving = saving.then(() => saveTabError(op, message));
  return saving;
}

async function saveTabError(op: string, message: string): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(ERRORS_KEY);
    const list = (stored[ERRORS_KEY] as TabErrorEntry[] | undefined) ?? [];
    const entry = { at: new Date().toISOString(), message: scrub(message), op };
    await chrome.storage.local.set({ [ERRORS_KEY]: [entry, ...list].slice(0, MAX_ERRORS) });
  } catch {
    // Sem armazenamento (o teste, ou a extensão sendo atualizada): só não guarda.
  }
}

export async function readTabErrors(): Promise<TabErrorEntry[]> {
  try {
    const stored = await chrome.storage.local.get(ERRORS_KEY);
    return (stored[ERRORS_KEY] as TabErrorEntry[] | undefined) ?? [];
  } catch {
    return [];
  }
}
