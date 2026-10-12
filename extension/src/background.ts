// Service worker da ponte: guarda a fila que o editor mandou, roda cada
// operação na aba do Lattes (uma por vez, conferindo) e devolve o resultado
// ao editor. O envio só começa por um clique no painel da extensão.
//
// O editor é o app de desktop, alcançado por mensagens nativas (o host é o
// próprio app, ver src-tauri/src/ponte.rs). Em desenvolvimento, o editor
// também roda numa aba em localhost e fala pelo script de conteúdo.

import type { OpResult } from '../../src/bridge/apply.ts';
import {
  blocksKind,
  type ContractReport,
  driftText,
  lacksSample,
} from '../../src/bridge/contract.ts';
import { sameCv } from '../../src/bridge/lattes-html.ts';
import type { BridgeOp } from '../../src/bridge/plan.ts';
import {
  type BridgeMessage,
  bridgeMessage,
  type EditorMessage,
  isEditorMessage,
} from '../../src/bridge/protocol.ts';
import { hasConsent } from './consent.ts';
import {
  type EditorEndpoint,
  LATTES_MENU,
  type PanelCommand,
  readState,
  writeState,
} from './state.ts';
import {
  DEFAULT_TOOLBAR_THEME,
  isToolbarThemeMessage,
  toolbarIconPaths,
  type ToolbarTheme,
} from './toolbar-icon.ts';

/** Nome do host nativo registrado pelo app (ponte::HOST_NAME). */
const NATIVE_HOST = 'lattes_editor.ponte';

let stopRequested = false;
let appPort: chrome.runtime.Port | undefined;

/**
 * Liga ao app de desktop. O host fica de pé enquanto a porta existir e espera
 * o app abrir; sem app instalado, a conexão cai na hora e tenta de novo no
 * próximo alarme.
 */
function connectApp(): void {
  if (appPort) return;
  try {
    appPort = chrome.runtime.connectNative(NATIVE_HOST);
  } catch {
    return;
  }
  appPort.onMessage.addListener((data) => {
    if (isEditorMessage(data)) void onEditor(data, 'app');
  });
  appPort.onDisconnect.addListener(() => {
    // Ler lastError evita o aviso de erro não tratado no console.
    void chrome.runtime.lastError;
    appPort = undefined;
  });
}

async function toEditor(editor: EditorEndpoint | undefined, msg: BridgeMessage): Promise<void> {
  if (editor === undefined) return;
  if (editor === 'app') {
    appPort?.postMessage(bridgeMessage(msg));
    return;
  }
  try {
    await chrome.tabs.sendMessage(editor, { msg, to: 'editor' });
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

interface Identity {
  code?: string;
  lattesId?: string;
}

/** Quem é o currículo aberto na sessão do Lattes: código interno e identificador público. */
async function sessionIdentity(tabId: number): Promise<Identity> {
  await injectRunner(tabId);
  const [res] = await chrome.scripting.executeScript({
    func: () => (globalThis as unknown as { __ponte: { identity(): Identity } }).__ponte.identity(),
    target: { tabId },
  });
  return res?.result ?? {};
}

/** O código de 10 caracteres do currículo, para a foto, junto com de quem ele é. */
async function sendCvCode(editor: EditorEndpoint): Promise<void> {
  if (!(await hasConsent())) return;
  const tabId = await lattesTab();
  if (tabId === undefined) return;
  try {
    const id = await sessionIdentity(tabId);
    if (id.code) {
      await toEditor(editor, { code: id.code, lattesId: id.lattesId, type: 'codigo-cv' });
    }
  } catch {
    // Sem permissão na aba ou aba recarregando: sem foto, sem erro.
  }
}

async function onEditor(msg: EditorMessage, editor: EditorEndpoint): Promise<void> {
  if (msg.type === 'ola') {
    await toEditor(editor, { type: 'ola', version: chrome.runtime.getManifest().version });
    await sendCvCode(editor);
    return;
  }
  if (msg.type === 'parar') {
    stopRequested = true;
    return;
  }
  const state = await readState();
  if (state.running) return;
  await writeState({
    editor,
    lattesId: msg.lattesId,
    ops: msg.ops,
    results: {},
    running: false,
  });
  await chrome.action.setBadgeText({ text: msg.ops.length ? String(msg.ops.length) : '' });
}

const failedReport = (detail: string): ContractReport => ({
  checkedAt: new Date().toISOString(),
  detail,
  forms: [],
  menu: [],
  status: 'erro',
});

/** Confere o Lattes contra o contrato da ponte, só lendo, na aba do menu. */
async function verifyOn(tabId: number): Promise<ContractReport> {
  try {
    await injectRunner(tabId);
    const [res] = await chrome.scripting.executeScript({
      func: () =>
        (
          globalThis as unknown as { __ponte: { verificar(): Promise<ContractReport> } }
        ).__ponte.verificar(),
      target: { tabId },
    });
    return res?.result ?? failedReport('A aba do Lattes não respondeu');
  } catch (err) {
    return failedReport(err instanceof Error ? err.message : 'Falha inesperada');
  }
}

/** "Verificar o Lattes" no painel: guarda o relatório no estado, sem tocar na fila. */
async function verify(): Promise<void> {
  // Sem o "ok" do aviso, nada é lido do Lattes; o painel mostra o aviso no lugar do botão.
  if (!(await hasConsent())) return;
  const state = await readState();
  if (state.running || state.verificando) return;
  await writeState({ ...state, verificando: true });
  // O "verificando" fica gravado; se algo estourar aqui, precisa ser desfeito
  // mesmo assim, senão o botão do painel fica preso.
  let report = failedReport('Falha inesperada');
  try {
    const tabId = await lattesTab();
    report =
      tabId === undefined
        ? failedReport('Abra o currículo no Lattes (a página do menu) numa aba e tente de novo')
        : await verifyOn(tabId);
  } catch (err) {
    if (err instanceof Error) report = failedReport(err.message);
  } finally {
    await writeState({ ...(await readState()), verificacao: report, verificando: false });
  }
}

async function run(keys?: string[]): Promise<void> {
  if (!(await hasConsent())) return;
  const state = await readState();
  if (state.running || state.verificando) return;
  const queue = state.ops.filter(
    (op) => state.results[op.key]?.status !== 'conferido' && (!keys || keys.includes(op.key)),
  );
  stopRequested = false;
  await writeState({ ...state, running: true });
  const results = { ...state.results };
  const record = async (r: OpResult) => {
    results[r.key] = r;
    await writeState({ ...(await readState()), results, running: true });
    await toEditor(state.editor, { result: r, type: 'resultado' });
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
    // Trava: só grava se a sessão do Lattes for do mesmo currículo aberto no editor.
    const session = await sessionIdentity(tabId).catch((): Identity => ({}));
    const first = queue[0];
    if (!sameCv(state.lattesId, session.lattesId)) {
      if (first) {
        await record({
          detail: session.lattesId
            ? `O Lattes aberto é de outro currículo (${session.lattesId}); nada foi enviado`
            : 'Não deu para saber de quem é o currículo aberto no Lattes; nada foi enviado',
          key: first.key,
          status: 'erro',
        });
      }
      queue.length = 0;
    }
    // Trava: antes de gravar, o Lattes precisa estar como a ponte espera. Uma
    // mudança do CNPq num formulário da fila para tudo, com o campo apontado.
    // Se nem deu para conferir, também para: sem leitura, não há garantia.
    if (queue.length > 0) {
      const report = await verifyOn(tabId);
      await writeState({ ...(await readState()), verificacao: report });
      const kinds = [...new Set(queue.map((op) => op.kind))];
      const blocking = kinds.flatMap((kind) => blocksKind(report, kind));
      const unsampled = kinds.map((kind) => lacksSample(report, kind)).find(Boolean);
      const stop =
        report.status === 'sessao'
          ? {
              detail: report.detail ?? 'A sessão do Lattes caiu; entre de novo',
              status: 'sessao' as const,
            }
          : report.status === 'erro'
            ? {
                detail: `Não deu para conferir o Lattes (${report.detail ?? 'sem detalhe'}); nada foi enviado`,
                status: 'erro' as const,
              }
            : blocking.length > 0
              ? {
                  detail: `O Lattes mudou (${blocking.map(driftText).join('; ')}); nada foi enviado. Veja a verificação no painel`,
                  status: 'erro' as const,
                }
              : unsampled
                ? {
                    detail: `Não achei no Lattes um exemplar de ${unsampled.form} para conferir (${unsampled.detail ?? 'sem amostra'}); nada foi enviado`,
                    status: 'erro' as const,
                  }
                : undefined;
      if (stop && first) {
        await record({ ...stop, key: first.key });
        queue.length = 0;
      }
    }
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
  await toEditor(state.editor, { type: 'fim' });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  const m = message as { from?: string; msg?: EditorMessage } & Partial<PanelCommand>;
  if (isToolbarThemeMessage(message)) {
    void setToolbarTheme(message.toolbar);
    return;
  }
  if (m.from === 'editor' && m.msg && sender.tab?.id !== undefined) {
    void onEditor(m.msg, sender.tab.id);
    return;
  }
  if (m.cmd === 'aplicar') void run(m.keys);
  if (m.cmd === 'parar') stopRequested = true;
  if (m.cmd === 'verificar') void verify();
  if (m.cmd === 'limpar') {
    void readState().then((s) =>
      writeState({ ...s, ops: [], results: {}, running: false, verificando: false }),
    );
    void chrome.action.setBadgeText({ text: '' });
  }
});

const TOOLBAR_KEY = 'temaDaBarra';

/** Troca o ícone da barra pela variante do tema e guarda a escolha. */
async function setToolbarTheme(theme: ToolbarTheme): Promise<void> {
  await chrome.action.setIcon({ path: toolbarIconPaths(theme) });
  await chrome.storage.local.set({ [TOOLBAR_KEY]: theme });
}

// Ao acordar, volta ao último tema conhecido e abre o documento fora da tela,
// que lê o tema atual e avisa a cada troca. O painel e a página do editor
// também avisam, caso o documento não abra.
void chrome.storage.local.get(TOOLBAR_KEY).then((stored) => {
  const theme = stored[TOOLBAR_KEY] as ToolbarTheme | undefined;
  if (theme && theme !== DEFAULT_TOOLBAR_THEME) {
    void chrome.action.setIcon({ path: toolbarIconPaths(theme) });
  }
});
void watchToolbarTheme();

async function watchToolbarTheme(): Promise<void> {
  try {
    if (await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({
      justification: 'Ler o tema do navegador para escolher o ícone da barra.',
      reasons: ['MATCH_MEDIA'],
      url: 'offscreen.html',
    });
  } catch {
    // Sem a API (ou com o documento já aberto por outra chamada): fica o painel.
  }
}

// O service worker acorda por vários motivos; em todos, tenta ligar ao app.
connectApp();
// Se o worker morreu no meio de uma verificação, o "verificando" ficou gravado
// e travaria o botão do painel para sempre. Ao acordar, nada está verificando.
void readState().then((s) => {
  if (s.verificando) void writeState({ ...s, verificando: false });
});
void chrome.alarms.create('ponte', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(() => connectApp());
chrome.runtime.onStartup.addListener(() => connectApp());

chrome.runtime.onInstalled.addListener((details) => {
  // O aviso de uso abre numa aba (o painel lateral só abre com um clique) na
  // instalação e na atualização de quem ainda não aceitou esta versão dele.
  void (async () => {
    const pending =
      details.reason === 'install' || (details.reason === 'update' && !(await hasConsent()));
    if (pending) await chrome.tabs.create({ url: chrome.runtime.getURL('panel.html') });
  })();
  // Painel lateral onde existir (Chrome, Brave recente); senão o clique abre o painel numa aba.
  if (chrome.sidePanel?.setPanelBehavior) {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

chrome.action.onClicked.addListener(() => {
  if (!chrome.sidePanel?.setPanelBehavior)
    void chrome.tabs.create({ url: chrome.runtime.getURL('panel.html') });
});
