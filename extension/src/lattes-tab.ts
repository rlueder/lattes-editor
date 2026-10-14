// A aba do menu do Lattes: achar, injetar o núcleo do conector (lattes-runner.ts)
// e as leituras que o editor pede, com o motivo quando não dá.

import type { ContractReport } from '../../src/bridge/contract.ts';
import type { LattesStatus } from '../../src/bridge/lattes-status.ts';
import type { BridgeMessage } from '../../src/bridge/protocol.ts';
import { hasConsent } from './consent.ts';
import { LATTES_MENU } from './state.ts';

export async function lattesTab(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ url: LATTES_MENU });
  return tab?.id;
}

export async function injectRunner(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({ files: ['lattes-runner.js'], target: { tabId } });
}

/** Roda uma função do núcleo do conector na aba; undefined se a aba não respondeu. */
async function runInTab<T>(
  tabId: number,
  name: 'espelho' | 'exportar' | 'foto',
  ...args: string[]
): Promise<T | undefined> {
  await injectRunner(tabId);
  const [res] = await chrome.scripting.executeScript({
    args: [name, args] as [string, string[]],
    func: (fn: string, fnArgs: string[]) =>
      (
        globalThis as unknown as {
          __conector: Record<string, (...a: string[]) => Promise<unknown>>;
        }
      ).__conector[fn]!(...fnArgs),
    target: { tabId },
  });
  return res?.result as T | undefined;
}

type Reply<K extends BridgeMessage['type']> = Omit<Extract<BridgeMessage, { type: K }>, 'type'>;

/**
 * Abrir do Lattes: o ZIP do Exportar do currículo da sessão (lattes-runner.ts,
 * exportar), ou o motivo de não ter vindo.
 */
export async function readCurriculo(): Promise<Reply<'curriculo'>> {
  if (!(await hasConsent())) return { reason: 'consentimento' };
  const tabId = await lattesTab();
  if (tabId === undefined) return { reason: 'sem-aba' };
  const failed: Reply<'curriculo'> = { detail: 'A aba do Lattes não respondeu.', reason: 'erro' };
  try {
    return (await runInTab<Reply<'curriculo'>>(tabId, 'exportar')) ?? failed;
  } catch {
    return failed;
  }
}

/**
 * Troca a foto do currículo (lattes-runner.ts, foto): só com o "ok" do aviso,
 * e o núcleo na aba confere que a sessão é do currículo do editor.
 */
export async function sendPhoto(
  jpeg: string,
  lattesId?: string,
): Promise<Omit<Reply<'foto'>, 'id'>> {
  if (!(await hasConsent())) return { ok: false, reason: 'consentimento' };
  const tabId = await lattesTab();
  if (tabId === undefined) return { ok: false, reason: 'sem-aba' };
  const failed = { detail: 'A aba do Lattes não respondeu.', ok: false, reason: 'erro' } as const;
  try {
    return (
      (await runInTab<Omit<Reply<'foto'>, 'id'>>(tabId, 'foto', jpeg, lattesId ?? '')) ?? failed
    );
  } catch {
    return failed;
  }
}

/** A versão atual do Lattes, para o diagnóstico do editor; só lê, e só com o "ok" do aviso. */
export async function readEspelho(): Promise<Reply<'espelho'>> {
  if (!(await hasConsent())) return { error: 'Aceite o aviso da extensão antes de ler o Lattes.' };
  const tabId = await lattesTab();
  if (tabId === undefined) {
    return { error: 'Abra o currículo no Lattes (a página do menu) numa aba.' };
  }
  const failed = { error: 'A aba do Lattes não respondeu.' };
  try {
    return (await runInTab<Reply<'espelho'>>(tabId, 'espelho')) ?? failed;
  } catch {
    return failed;
  }
}

/** Relatório de conferência que não chegou a ler o Lattes. */
export const failedReport = (detail: string): ContractReport => ({
  checkedAt: new Date().toISOString(),
  detail,
  forms: [],
  menu: [],
  status: 'erro',
});

/** Confere o Lattes contra o contrato do conector, só lendo, na aba do menu. */
export async function verifyOn(tabId: number): Promise<ContractReport> {
  try {
    await injectRunner(tabId);
    const [res] = await chrome.scripting.executeScript({
      func: () =>
        (
          globalThis as unknown as { __conector: { verificar(): Promise<ContractReport> } }
        ).__conector.verificar(),
      target: { tabId },
    });
    return res?.result ?? failedReport('A aba do Lattes não respondeu');
  } catch (err) {
    return failedReport(err instanceof Error ? err.message : 'Falha inesperada');
  }
}

export interface Identity {
  code?: string;
  lattesId?: string;
  status?: LattesStatus;
}

/** Quem é o currículo aberto na sessão do Lattes: código interno e identificador público. */
export async function sessionIdentity(tabId: number, fresh = false): Promise<Identity> {
  await injectRunner(tabId);
  const [res] = await chrome.scripting.executeScript({
    args: [fresh],
    func: (f: boolean) =>
      (
        globalThis as unknown as { __conector: { identity(fresh: boolean): Promise<Identity> } }
      ).__conector.identity(f),
    target: { tabId },
  });
  return res?.result ?? {};
}
