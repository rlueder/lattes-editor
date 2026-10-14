// Service worker do conector: guarda a fila que o editor mandou, roda cada
// operação na aba do Lattes (uma por vez, conferindo) e devolve o resultado
// ao editor. O envio só começa por um clique no painel da extensão.
//
// O editor é o app de desktop, alcançado por mensagens nativas (o host é o
// próprio app, ver src-tauri/src/conector.rs). Em desenvolvimento, o editor
// também roda numa aba em localhost e fala pelo script de conteúdo.

import type { OpResult } from '../../src/bridge/apply.ts';
import { BRIDGE_FEATURES } from '../../src/bridge/compat.ts';
import {
  AUTO_VERIFY_DELAY_MS,
  AUTO_VERIFY_RETRY_DELAY_MS,
  blocksKind,
  driftText,
  lacksSample,
  retryAutoVerify,
  shouldAutoVerify,
} from '../../src/bridge/contract.ts';
import { sameCv } from '../../src/bridge/lattes-html.ts';
import { photoBusy } from '../../src/bridge/photo.ts';
import type { BridgeOp } from '../../src/bridge/plan.ts';
import {
  type BridgeMessage,
  bridgeMessage,
  type EditorMessage,
  isEditorMessage,
  type NoReadingReason,
} from '../../src/bridge/protocol.ts';
import { CONSENT_KEY, hasConsent, isConsentCurrent } from './consent.ts';
import { ownVersion, reloadForApp } from './dev-reload.ts';
import {
  answerListRequest,
  failedReport,
  type Identity,
  lattesTab,
  readCurriculo,
  readEspelho,
  reloadLattesTab,
  sendPhoto,
  sessionIdentity,
  verifyOn,
} from './lattes-tab.ts';
import {
  APP_KEY,
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

/**
 * Nome do host nativo registrado pelo app (conector::HOST_NAME): o do
 * LattesEditor ou o do LattesEditor Dev, escolhido na montagem
 * (scripts/build-extension.ts).
 */
const NATIVE_HOST = __NATIVE_HOST__;

let stopRequested = false;
/**
 * Uma verificação por vez no service worker. Painel aberto e menu do Lattes
 * carregado podem chegar juntos; o "verificando" do estado é gravado depois
 * de esperas, e dois pedidos o leriam falso.
 */
let verifyInFlight = false;
/** Uma automática esperando a aba assentar (antes de pegar a trava). */
let autoPending = false;
/** "Verificar de novo" clicado durante outra verificação: roda logo depois dela. */
let manualQueued = false;
/** Uma troca de foto em andamento: nem a fila nem outra troca começam junto. */
let photoInFlight = false;
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
    // Sem app ligado, o painel não compara versões com um app que já fechou.
    void chrome.storage.session.remove(APP_KEY).catch(() => undefined);
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

/**
 * O que o editor sabe da sessão do Lattes: o código de 10 caracteres do
 * currículo, para a foto, e o estado do menu (última publicação e
 * pendência), sempre junto com de quem ele é.
 */
async function sendSession(editor: EditorEndpoint, fresh = false): Promise<void> {
  // Sem leitura, o editor recebe o porquê, para o cabeçalho explicar.
  const none = (reason: NoReadingReason, lattesId?: string) =>
    toEditor(editor, { lattesId, reason, type: 'sem-leitura' });
  if (!(await hasConsent())) return none('consentimento');
  const tabId = await lattesTab();
  if (tabId === undefined) return none('sem-aba');
  try {
    const id = await sessionIdentity(tabId, fresh);
    if (id.code) {
      await toEditor(editor, { code: id.code, lattesId: id.lattesId, type: 'codigo-cv' });
    }
    if (id.status) {
      await toEditor(editor, { lattesId: id.lattesId, status: id.status, type: 'estado-lattes' });
    } else {
      await none('sem-data', id.lattesId);
    }
  } catch {
    // Sem permissão na aba ou aba recarregando: sem foto nem estado.
    await none('erro');
  }
}

/** Abrir do Lattes: o ZIP do Exportar (lattes-tab.ts). */
async function sendCurriculo(editor: EditorEndpoint, id: string): Promise<void> {
  await toEditor(editor, { ...(await readCurriculo()), id, type: 'curriculo' });
}

/** A versão atual do Lattes, para o diagnóstico (lattes-tab.ts). */
async function sendEspelho(editor: EditorEndpoint): Promise<void> {
  await toEditor(editor, { ...(await readEspelho()), type: 'espelho' });
}

async function onEditor(msg: EditorMessage, editor: EditorEndpoint): Promise<void> {
  if (msg.type === 'ola') {
    if (editor === 'app' && (await reloadForApp(msg.version))) return;
    // O que o app de desktop anunciou fica para o painel comparar com a
    // extensão, e sai quando a porta dele fecha. Uma aba de editor em
    // localhost (desenvolvimento) não entra. É secundário: se não gravar, o
    // aperto de mão segue.
    if (editor === 'app') {
      await chrome.storage.session
        .set({ [APP_KEY]: { features: msg.features, version: msg.version } })
        .catch(() => undefined);
    }
    await toEditor(editor, {
      features: [...BRIDGE_FEATURES],
      type: 'ola',
      version: ownVersion(),
    });
    await sendSession(editor);
    return;
  }
  if (msg.type === 'parar') {
    stopRequested = true;
    return;
  }
  if (msg.type === 'recarregar-lattes') {
    await reloadLattesTab();
    return;
  }
  if (msg.type === 'pedir-espelho') {
    await sendEspelho(editor);
    return;
  }
  // Listas do Lattes: só leituras, e nunca durante uma gravação (lattes-tab.ts).
  const busy = async () => (await readState()).running || photoInFlight;
  const listReply = await answerListRequest(msg, busy);
  if (listReply) return toEditor(editor, listReply);
  if (msg.type === 'pedir-curriculo') {
    await sendCurriculo(editor, msg.id);
    return;
  }
  if (msg.type === 'enviar-foto') {
    const busy = photoBusy((await readState()).running, photoInFlight);
    if (busy) return toEditor(editor, { ...busy, id: msg.id, type: 'foto' });
    // A pessoa já viu a foto e confirmou no editor; depois, o menu relido
    // mostra se o Lattes ficou com alteração a enviar ao CNPq.
    photoInFlight = true;
    try {
      const reply = await sendPhoto(msg.jpeg, msg.lattesId);
      await toEditor(editor, { ...reply, id: msg.id, type: 'foto' });
      await sendSession(editor, true);
    } finally {
      photoInFlight = false;
    }
    return;
  }
  if (msg.type !== 'enviar') return;
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

/**
 * Confere o Lattes e guarda o relatório no estado, sem tocar na fila. Roda
 * sozinha (auto) ao abrir o painel e quando o menu do Lattes carrega, só com
 * o Lattes aberto e de tempos em tempos (shouldAutoVerify); o painel só mostra
 * o resultado quando há problema. O "Verificar de novo" do painel força.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function verify(auto = false): Promise<void> {
  if (auto) {
    // A automática espera a aba assentar, fora da trava; outra automática no
    // meio da espera é a mesma e fica de fora.
    if (autoPending) return;
    autoPending = true;
    await sleep(AUTO_VERIFY_DELAY_MS);
    autoPending = false;
  }
  if (verifyInFlight) {
    // O clique da pessoa nunca se perde: roda quando a atual terminar.
    if (!auto) manualQueued = true;
    return;
  }
  verifyInFlight = true;
  try {
    await verifyOnce(auto);
  } finally {
    verifyInFlight = false;
  }
  if (manualQueued) {
    manualQueued = false;
    await verify(false);
  }
}

async function verifyOnce(auto: boolean): Promise<void> {
  // Sem o "ok" do aviso, nada é lido do Lattes; o painel mostra o aviso no lugar do botão.
  if (!(await hasConsent())) return;
  const state = await readState();
  if (state.running || state.verificando) return;
  if (auto) {
    if (!shouldAutoVerify(state.verificacao, Date.now())) return;
    if ((await lattesTab()) === undefined) return;
  }
  // Lido de novo: a fila pode ter mudado durante as esperas acima.
  await writeState({ ...(await readState()), verificando: true });
  // O "verificando" fica gravado; se algo estourar aqui, precisa ser desfeito
  // mesmo assim, senão o botão do painel fica preso.
  let report = failedReport('Falha inesperada');
  try {
    const tabId = await lattesTab();
    report =
      tabId === undefined
        ? failedReport('Abra o currículo no Lattes (a página do menu) numa aba e tente de novo')
        : await verifyOn(tabId);
    if (auto && tabId !== undefined && retryAutoVerify(report)) {
      await sleep(AUTO_VERIFY_RETRY_DELAY_MS);
      report = await verifyOn(tabId);
    }
  } catch (err) {
    if (err instanceof Error) report = failedReport(err.message);
  } finally {
    await writeState({ ...(await readState()), verificacao: report, verificando: false });
  }
}

async function run(keys?: string[]): Promise<void> {
  if (!(await hasConsent())) return;
  const state = await readState();
  if (state.running || state.verificando || photoInFlight) return;
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
    // Trava: antes de gravar, o Lattes precisa estar como o conector espera. Uma
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
            globalThis as unknown as { __conector: { apply(op: BridgeOp): Promise<OpResult> } }
          ).__conector.apply(o),
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
  // Menu relido: a aba aberta ainda mostra o estado de antes das gravações.
  if (state.editor !== undefined) await sendSession(state.editor, true);
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
  if (m.cmd === 'verificar') void verify(m.auto);
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

// Com o "ok" dado agora, o app já ligado recebe o código do currículo que
// ficou retido, sem esperar a próxima reconexão.
chrome.storage.onChanged.addListener((changes, area) => {
  const change = (changes as Record<string, { newValue?: unknown }>)[CONSENT_KEY];
  if (area === 'local' && change && isConsentCurrent(change.newValue) && appPort) {
    void sendSession('app');
  }
});

// O menu do Lattes acabou de carregar (aberto depois do app, sessão nova,
// volta ao menu): o app ligado recebe a leitura sem precisar reabrir nada.
// A verificação de fundo também roda aqui.
chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (info.status !== 'complete') return;
  if (!tab.url?.startsWith(LATTES_MENU.replace(/\*$/, ''))) return;
  void verify(true);
  if (appPort) void sendSession('app');
});

// O service worker acorda por vários motivos; em todos, tenta ligar ao app.
connectApp();
// Se o worker morreu no meio de uma verificação, o "verificando" ficou gravado
// e travaria o botão do painel para sempre. Ao acordar, nada está verificando.
void readState().then((s) => {
  if (s.verificando) void writeState({ ...s, verificando: false });
});
void chrome.alarms.create('conector', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(() => connectApp());
chrome.runtime.onStartup.addListener(() => connectApp());

chrome.runtime.onInstalled.addListener((details) => {
  // O aviso de uso abre numa aba (o painel lateral só abre com um clique) na
  // instalação e na atualização de quem ainda não aceitou esta versão dele.
  // Falha aqui não pode impedir o painel lateral, configurado logo abaixo.
  void (async () => {
    try {
      const pending =
        details.reason === 'install' || (details.reason === 'update' && !(await hasConsent()));
      if (pending) await chrome.tabs.create({ url: chrome.runtime.getURL('panel.html') });
    } catch {
      // Sem a aba, o aviso aparece quando o painel for aberto.
    }
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
