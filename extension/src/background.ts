// Service worker da ponte: guarda a fila que o editor mandou, roda cada
// operação na aba do Lattes (uma por vez, conferindo) e devolve o resultado
// ao editor. O envio só começa por um clique no painel da extensão.

import type { OpResult } from '../../src/bridge/apply.ts';
import type { BridgeOp } from '../../src/bridge/plan.ts';
import type { BridgeMessage, EditorMessage } from '../../src/bridge/protocol.ts';
import { LATTES_MENU, type PanelCommand, readState, writeState } from './state.ts';

let stopRequested = false;

async function toEditor(tabId: number | undefined, msg: BridgeMessage): Promise<void> {
  if (tabId === undefined) return;
  try {
    await chrome.tabs.sendMessage(tabId, { msg, to: 'editor' });
  } catch {
    // A aba do editor foi fechada; o painel continua com o resultado.
  }
}

async function lattesTab(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ url: LATTES_MENU });
  return tab?.id;
}

async function injectRunner(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({ files: ['lattes-runner.js'], target: { tabId } });
}

/** O código de 10 caracteres do currículo, lido na aba do Lattes, para a foto. */
async function sendCvCode(editorTabId: number): Promise<void> {
  const tabId = await lattesTab();
  if (tabId === undefined) return;
  try {
    await injectRunner(tabId);
    const [res] = await chrome.scripting.executeScript({
      func: () =>
        (globalThis as unknown as { __ponte: { cvCode(): string | undefined } }).__ponte.cvCode(),
      target: { tabId },
    });
    if (res?.result) await toEditor(editorTabId, { code: res.result, type: 'codigo-cv' });
  } catch {
    // Sem permissão na aba ou aba recarregando: sem foto, sem erro.
  }
}

async function onEditor(msg: EditorMessage, tabId: number): Promise<void> {
  if (msg.type === 'ola') {
    await toEditor(tabId, { type: 'ola', version: chrome.runtime.getManifest().version });
    await sendCvCode(tabId);
    return;
  }
  if (msg.type === 'parar') {
    stopRequested = true;
    return;
  }
  const state = await readState();
  if (state.running) return;
  await writeState({ editorTabId: tabId, ops: msg.ops, results: {}, running: false });
  await chrome.action.setBadgeText({ text: msg.ops.length ? String(msg.ops.length) : '' });
}

async function run(keys?: string[]): Promise<void> {
  const state = await readState();
  if (state.running) return;
  const queue = state.ops.filter(
    (op) => state.results[op.key]?.status !== 'conferido' && (!keys || keys.includes(op.key)),
  );
  stopRequested = false;
  await writeState({ ...state, running: true });
  const results = { ...state.results };
  const record = async (r: OpResult) => {
    results[r.key] = r;
    await writeState({ ...(await readState()), results, running: true });
    await toEditor(state.editorTabId, { result: r, type: 'resultado' });
  };

  const tabId = await lattesTab();
  if (tabId === undefined) {
    const first = queue[0];
    if (first) {
      await record({
        detail: 'Abra o currículo no Lattes (a página do menu) numa aba e tente de novo',
        key: first.key,
        status: 'erro',
      });
    }
  } else {
    await injectRunner(tabId);
    for (const op of queue) {
      if (stopRequested) break;
      const [res] = await chrome.scripting.executeScript({
        args: [op] as [BridgeOp],
        func: (o: BridgeOp) =>
          (
            globalThis as unknown as { __ponte: { apply(op: BridgeOp): Promise<OpResult> } }
          ).__ponte.apply(o),
        target: { tabId },
      });
      const r = res?.result ?? {
        detail: 'A aba do Lattes não respondeu',
        key: op.key,
        status: 'erro',
      };
      await record(r);
      if (r.status !== 'conferido') break;
    }
  }
  await writeState({ ...(await readState()), results, running: false });
  const left = state.ops.filter((op) => results[op.key]?.status !== 'conferido').length;
  await chrome.action.setBadgeText({ text: left ? String(left) : '' });
  await toEditor(state.editorTabId, { type: 'fim' });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  const m = message as { from?: string; msg?: EditorMessage } & Partial<PanelCommand>;
  if (m.from === 'editor' && m.msg && sender.tab?.id !== undefined) {
    void onEditor(m.msg, sender.tab.id);
    return;
  }
  if (m.cmd === 'aplicar') void run(m.keys);
  if (m.cmd === 'parar') stopRequested = true;
  if (m.cmd === 'limpar') {
    void writeState({ ops: [], results: {}, running: false });
    void chrome.action.setBadgeText({ text: '' });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  // Painel lateral onde existir (Chrome, Brave recente); senão o clique abre o painel numa aba.
  if (chrome.sidePanel?.setPanelBehavior) {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

chrome.action.onClicked.addListener(() => {
  if (!chrome.sidePanel?.setPanelBehavior)
    void chrome.tabs.create({ url: chrome.runtime.getURL('panel.html') });
});
