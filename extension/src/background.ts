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
  retryAutoVerify,
  reusableVerification,
  shouldAutoVerify,
} from '../../src/bridge/contract-schedule.ts';
import { sameCv } from '../../src/bridge/lattes-html.ts';
import { photoBusy } from '../../src/bridge/photo.ts';
import { type BridgeMessage, type EditorMessage } from '../../src/bridge/protocol.ts';
import { contractStop, type RoundPause, runRound } from '../../src/bridge/write-brake.ts';
import { AppPort } from './app-port.ts';
import { CONSENT_KEY, hasConsent, isConsentCurrent } from './consent.ts';
import { handleDevFrameGuard } from './dev-frame-guard.ts';
import { ownVersion, reloadForApp } from './dev-reload.ts';
import {
  BUSY_TEXT,
  endDeadRound,
  handleSend,
  NO_CONSENT_TEXT,
  refuseRun,
  replayResults,
  waitWhile,
} from './editor-run.ts';
import { importRunning, runImport } from './import-run.ts';
import { isLattesMenu, isRealLattesMenu } from './lattes-hosts.ts';
import {
  answerListRequest,
  applyInTab,
  cancelInTab,
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
import { answerPublishRequest, publishRunning } from './publish-run.ts';
import { readSession } from './session-reading.ts';
import { sessionTaskRunning } from './session-task.ts';
import {
  APP_KEY,
  type EditorEndpoint,
  type PanelCommand,
  type QueueState,
  readState,
  writeState,
} from './state.ts';
import { answerTestItems, testItemsRunning } from './test-items-run.ts';
import { isToolbarThemeMessage } from './toolbar-icon.ts';
import { restoreToolbarTheme, setToolbarTheme } from './toolbar-theme.ts';
import { handleTrafficPause } from './traffic-pause.ts';

/**
 * Nome do host nativo registrado pelo app (conector::HOST_NAME): o do
 * LattesEditor ou o do LattesEditor Dev, escolhido na montagem
 * (scripts/build-extension.ts).
 */

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
/** A fila passou da trava e vai gravar: marcado antes de qualquer await, para o Importar ver. */
let queueActive = false;
/** A foto, o Importar, o envio ao CNPq ou os itens de teste estão usando a aba do Lattes. */
const tabInUse = () => photoInFlight || importRunning() || publishRunning() || testItemsRunning();
const appConnection = new AppPort(__NATIVE_HOST__, (msg) => {
  void onEditor(msg, 'app');
});
const connectApp = () => appConnection.connect();

async function toEditor(editor: EditorEndpoint | undefined, msg: BridgeMessage): Promise<void> {
  if (editor === undefined) return;
  if (editor === 'app') {
    appConnection.send(msg);
    return;
  }
  try {
    await chrome.tabs.sendMessage(editor, { msg, to: 'editor' });
  } catch {
    // A aba do editor foi fechada; o painel continua com o resultado.
  }
}

const sendSession = (editor: EditorEndpoint, fresh = false) =>
  readSession((msg) => toEditor(editor, msg), fresh);

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
    await replayResults(await readState(), (m) => toEditor(editor, m));
    await sendSession(editor);
    return;
  }
  // Parar a rodada, ou seguir com o resto depois da pausa (editor-run.ts).
  if (msg.type === 'parar' || msg.type === 'continuar') {
    if (msg.type === 'parar') {
      stopRequested = true;
      void cancelInTab();
    } else void run(undefined, true);
    return;
  }
  if (msg.type === 'recarregar-lattes') {
    await reloadLattesTab();
    return;
  }
  const busy = async () =>
    (await readState()).running ||
    queueActive ||
    verifyInFlight ||
    sessionTaskRunning() ||
    tabInUse();
  if (msg.type === 'pedir-espelho') {
    if (await busy()) return toEditor(editor, { error: BUSY_TEXT, type: 'espelho' });
    await toEditor(editor, { ...(await readEspelho()), type: 'espelho' });
    return;
  }
  // Listas do Lattes: só leituras, e nunca durante uma gravação (lattes-tab.ts).
  const listReply = await answerListRequest(msg, busy);
  if (listReply) return toEditor(editor, listReply);
  if (msg.type === 'pedir-curriculo') {
    if (await busy())
      return toEditor(editor, { detail: BUSY_TEXT, id: msg.id, reason: 'erro', type: 'curriculo' });
    await toEditor(editor, { ...(await readCurriculo()), id: msg.id, type: 'curriculo' });
    return;
  }
  // A tela de envio ao CNPq e o envio (publish-run.ts).
  const publishLocks = {
    importing: importRunning(),
    photo: photoInFlight,
    queue: queueActive,
    verifying: verifyInFlight,
  };
  const publishReply = { busy, send: (m: BridgeMessage) => toEditor(editor, m) };
  if (await answerPublishRequest(msg, publishLocks, publishReply)) {
    if (msg.type === 'publicar') await sendSession(editor, true);
    return;
  }
  if (msg.type === 'enviar-foto') {
    const busy = photoBusy(
      (await readState()).running || queueActive,
      tabInUse() || verifyInFlight || sessionTaskRunning(),
    );
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
  if (msg.type === 'importar') {
    // Desligado (IMPORT_ENABLED), o pedido volta recusado sem tocar no Lattes.
    // Sem await entre ler a trava e runImport marcar o Importar em andamento;
    // a fila marca queueActive do mesmo jeito.
    const busy = {
      photo: photoInFlight || publishRunning(),
      queue: queueActive,
      verifying: verifyInFlight,
    };
    if (await runImport(msg, busy, (m) => toEditor(editor, m))) await sendSession(editor, true);
    return;
  }
  if (msg.type === 'itens-teste')
    await answerTestItems(msg, await busy(), (m) => toEditor(editor, m));
  if (msg.type === 'enviar') await handleSend(msg, editor, run, (m) => toEditor(editor, m));
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
  if (state.running || state.verificando || queueActive || sessionTaskRunning() || tabInUse())
    return;
  if (auto) {
    if (!shouldAutoVerify(state.verificacao, Date.now())) return;
    if ((await lattesTab()) === undefined) return;
  }
  // Lido de novo: a fila pode ter mudado durante as esperas acima.
  await writeState({ ...(await readState()), verificando: true });
  // O "verificando" fica gravado; se algo estourar aqui, precisa ser desfeito
  // mesmo assim, senão o botão do painel fica preso.
  let report = failedReport('Falha inesperada');
  let verifiedCv: string | undefined;
  try {
    const tabId = await lattesTab();
    const identity = tabId === undefined ? undefined : await sessionIdentity(tabId);
    verifiedCv = identity?.lattesId;
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
    await writeState({
      ...(await readState()),
      verificacao: report,
      verificacaoCv: verifiedCv,
      verificando: false,
    });
  }
}

async function run(keys?: string[], fromEditor = false): Promise<void> {
  const refuse = async (s: QueueState, detail: string) =>
    fromEditor ? refuseRun(s, detail, writeState, (m) => toEditor(s.editor, m)) : undefined;
  if (!(await hasConsent())) return refuse(await readState(), NO_CONSENT_TEXT);
  if (fromEditor) {
    await waitWhile(async () => verifyInFlight || Boolean((await readState()).verificando));
  }
  const state = await readState();
  if (state.running || queueActive) return; // queueActive: sem await até ele virar true
  if (state.verificando || verifyInFlight || sessionTaskRunning() || tabInUse()) {
    return refuse(state, BUSY_TEXT);
  }
  queueActive = true;
  const queue = state.ops.filter(
    (op) => state.results[op.key]?.status !== 'conferido' && (!keys || keys.includes(op.key)),
  );
  const results = { ...state.results };
  let pause: RoundPause | undefined;
  let recorded = false;
  const record = async (r: OpResult) => {
    recorded = true;
    results[r.key] = r;
    await writeState({ ...(await readState()), results, running: true });
    await toEditor(state.editor, { result: r, type: 'resultado' });
  };
  // A trava solta mesmo se algo estourar no meio, senão o Importar ficaria
  // recusado até o service worker reiniciar.
  try {
    stopRequested = false;
    await writeState({ ...state, pausa: undefined, running: true });

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
        const kinds = queue.map((op) => op.kind);
        const report =
          sameCv(state.verificacaoCv, session.lattesId) &&
          reusableVerification(state.verificacao, kinds, Date.now())
            ? state.verificacao!
            : await verifyOn(tabId, kinds);
        await writeState({
          ...(await readState()),
          verificacao: report,
          verificacaoCv: session.lattesId,
        });
        const stop = contractStop(report, queue);
        if (stop && first) {
          await record({ ...stop, key: first.key });
          queue.length = 0;
        }
      }
      // Freio de escrita (LAT-59): no máximo WRITES_PER_ROUND por clique, e a
      // fila para no primeiro resultado não conferido ou falha da aba.
      if (queue.length > 0) {
        const end = await runRound(queue, {
          apply: (op) => applyInTab(tabId, op),
          onResult: record,
          shouldStop: () => stopRequested,
        });
        if (end.kind === 'pausa') pause = { done: end.done, left: end.left };
      }
    }
  } catch (err) {
    // Falha antes de qualquer resposta (a conferência ou a leitura da sessão
    // estourou), então nada foi gravado: a primeira da fila leva o motivo,
    // que aparece no painel e no editor.
    const first = queue[0];
    if (!recorded && first) {
      await record({
        detail: `Falha inesperada no conector (${err instanceof Error ? err.message : String(err)}); nada foi enviado`,
        key: first.key,
        status: 'erro',
      }).catch(() => undefined);
    }
  } finally {
    // Mesmo com algo estourando no meio, a fila deixa de correr, o painel
    // destrava e o editor sabe que a rodada acabou.
    try {
      await writeState({ ...(await readState()), pausa: pause, results, running: false });
      const left = state.ops.filter((op) => results[op.key]?.status !== 'conferido').length;
      await chrome.action.setBadgeText({ text: left ? String(left) : '' });
      await toEditor(state.editor, { pause, type: 'fim' });
      // Menu relido: a aba aberta ainda mostra o estado de antes das gravações.
      if (state.editor !== undefined) await sendSession(state.editor, true);
    } finally {
      queueActive = false;
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (handleDevFrameGuard(message, sender, sendResponse)) return true;
  if (handleTrafficPause(message, sender, sendResponse)) return true;
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
  if (m.cmd === 'parar') {
    stopRequested = true;
    void cancelInTab();
  }
  if (m.cmd === 'verificar') void verify(m.auto);
  if (m.cmd === 'limpar') {
    void readState().then(async (s) => {
      await writeState({
        ...s,
        ops: [],
        pausa: undefined,
        results: {},
        running: false,
        verificando: false,
      });
      // A fila em pausa saiu: o editor deixa de mandar continuar no painel.
      if (s.pausa) await toEditor(s.editor, { type: 'fim' });
    });
    void chrome.action.setBadgeText({ text: '' });
  }
  return false;
});

// Ao acordar, volta ao último tema da barra e passa a acompanhar as trocas.
void restoreToolbarTheme();

// Com o "ok" dado agora, o app já ligado recebe o código do currículo que
// ficou retido, sem esperar a próxima reconexão.
chrome.storage.onChanged.addListener((changes, area) => {
  const change = (changes as Record<string, { newValue?: unknown }>)[CONSENT_KEY];
  if (area === 'local' && change && isConsentCurrent(change.newValue) && appConnection.connected) {
    void sendSession('app');
  }
});

// O menu do Lattes acabou de carregar (aberto depois do app, sessão nova,
// volta ao menu): o app ligado recebe a leitura sem precisar reabrir nada.
// A verificação de fundo também roda aqui.
chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (info.status !== 'complete') return;
  const menu = __CANAL_DEV__ ? isLattesMenu(tab.url, true) : isRealLattesMenu(tab.url);
  if (!menu) return;
  void verify(true);
  if (appConnection.connected) void sendSession('app');
});

// O service worker acorda por vários motivos; em todos, tenta ligar ao app.
connectApp();
// Se o worker morreu no meio de uma verificação, o "verificando" ficou gravado
// e travaria o botão do painel para sempre. Ao acordar, nada está verificando.
// Morto no meio de uma rodada, o "correndo" também ficou: a rodada termina
// aqui, e a primeira que faltava vira divergente, porque não dá para saber se
// ela gravou. O editor recebe o resultado e o fim, e sai do "gravando".
void readState().then(async (s) => {
  if (s.verificando) await writeState({ ...s, verificando: false });
  if (s.running) await endDeadRound(await readState(), writeState, (m) => toEditor(s.editor, m));
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
