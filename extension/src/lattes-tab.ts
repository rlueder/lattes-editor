// A aba do menu do Lattes: achar, injetar o núcleo do conector (lattes-runner.ts)
// e as leituras que o editor pede, com o motivo quando não dá.

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
async function runInTab<T>(tabId: number, name: 'espelho' | 'exportar'): Promise<T | undefined> {
  await injectRunner(tabId);
  const [res] = await chrome.scripting.executeScript({
    args: [name] as [string],
    func: (fn: string) =>
      (globalThis as unknown as { __conector: Record<string, () => Promise<unknown>> }).__conector[
        fn
      ]!(),
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
