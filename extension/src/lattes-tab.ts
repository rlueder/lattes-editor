// A aba do menu do Lattes: achar, injetar o núcleo da ponte (lattes-runner.ts)
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

/** Roda uma função do núcleo da ponte na aba; undefined se a aba não respondeu. */
async function runInTab<T>(tabId: number, name: 'espelho'): Promise<T | undefined> {
  await injectRunner(tabId);
  const [res] = await chrome.scripting.executeScript({
    args: [name] as [string],
    func: (fn: string) =>
      (globalThis as unknown as { __ponte: Record<string, () => Promise<unknown>> }).__ponte[fn]!(),
    target: { tabId },
  });
  return res?.result as T | undefined;
}

type Reply<K extends BridgeMessage['type']> = Omit<Extract<BridgeMessage, { type: K }>, 'type'>;

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
