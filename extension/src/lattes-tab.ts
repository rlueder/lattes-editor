// A aba do menu do Lattes: achar, injetar o núcleo do conector (lattes-runner.ts)
// e as leituras que o editor pede, com o motivo quando não dá.

import type { OpResult } from '../../src/bridge/apply.ts';
import type { ContractReport } from '../../src/bridge/contract.ts';
import type { ImportResult } from '../../src/bridge/importar.ts';
import type { LattesStatus } from '../../src/bridge/lattes-status.ts';
import type { BridgeOp } from '../../src/bridge/plan.ts';
import type { BridgeMessage, EditorMessage } from '../../src/bridge/protocol.ts';
import type { PublishRequest, PublishResult } from '../../src/bridge/publish.ts';
import { hasConsent } from './consent.ts';
import { LATTES_MENU, lattesMenus } from './lattes-hosts.ts';
import { tabReloaded, untilTabCloses } from './tab-guard.ts';

export async function lattesTab(): Promise<number | undefined> {
  // Escolha na montagem: na extensão publicada, o simulado não entra no código.
  const [tab] = await chrome.tabs.query({ url: __CANAL_DEV__ ? lattesMenus(true) : [LATTES_MENU] });
  return tab?.id;
}

/** Uma chamada à aba que desiste se ela fechar ou não responder (tab-guard.ts). */
let watchingReloads = false;
const guarded = <T>(tabId: number, start: () => Promise<T>) => {
  // A página que recarrega solta a aba travada por uma chamada que passou do
  // prazo (tab-guard.ts). Registrado na primeira chamada, com o chrome à mão.
  if (!watchingReloads) {
    watchingReloads = true;
    chrome.tabs.onUpdated?.addListener((id, info) => {
      if (info.status === 'loading') tabReloaded(id);
    });
  }
  return untilTabCloses(tabId, start, chrome.tabs.onRemoved);
};
export async function injectRunner(tabId: number): Promise<void> {
  await guarded(tabId, () =>
    chrome.scripting.executeScript({ files: ['lattes-runner.js'], target: { tabId } }),
  );
}

/** Roda uma função do núcleo do conector na aba; undefined se a aba não respondeu. */
async function runInTab<T>(
  tabId: number,
  name:
    | 'cursos'
    | 'espelho'
    | 'exportar'
    | 'foto'
    | 'importar'
    | 'instituicoes'
    | 'listas'
    | 'publicar'
    | 'telaEnvio',
  ...args: string[]
): Promise<T | undefined> {
  await injectRunner(tabId);
  const [res] = await guarded(tabId, () =>
    chrome.scripting.executeScript({
      args: [name, args] as [string, string[]],
      func: (fn: string, fnArgs: string[]) =>
        (
          globalThis as unknown as {
            __conector: Record<string, (...a: string[]) => Promise<unknown>>;
          }
        ).__conector[fn]!(...fnArgs),
      target: { tabId },
    }),
  );
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

/**
 * Importar dos itens novos (lattes-runner.ts, importar): só com o "ok" do
 * aviso, e o núcleo na aba confere que a sessão é do currículo do editor.
 */
export async function sendImport(
  req: { file: string; fileName: string; modules: number[]; oldestYear?: number },
  lattesId?: string,
): Promise<ImportResult> {
  // Gravar no currículo errado é pior que ler: sem saber de qual currículo é
  // o editor, nada vai (o sameCv do núcleo também recusaria um id vazio).
  if (!lattesId) {
    return {
      detail: 'O editor não sabe de qual currículo é o arquivo; nada foi enviado.',
      reason: 'outro-cv',
    };
  }
  if (!(await hasConsent())) return { reason: 'consentimento' };
  const tabId = await lattesTab();
  if (tabId === undefined) return { reason: 'sem-aba' };
  const failed: ImportResult = {
    detail:
      'A aba do Lattes não respondeu. Se o arquivo chegou a ser enviado, a solicitação ficou pendente no Importar; confirme ou descarte por lá.',
    reason: 'erro',
  };
  try {
    const args = JSON.stringify({
      file: req.file,
      fileName: req.fileName,
      modules: req.modules,
      oldestYear: req.oldestYear,
    });
    return (await runInTab<ImportResult>(tabId, 'importar', args, lattesId)) ?? failed;
  } catch {
    return failed;
  }
}

/** A tela de envio ao CNPq (lattes-runner.ts, telaEnvio): só lê, e só com o "ok" do aviso. */
export async function readSendScreenReply(): Promise<Omit<Reply<'tela-envio'>, 'id'>> {
  if (!(await hasConsent())) return { reason: 'consentimento' };
  const tabId = await lattesTab();
  if (tabId === undefined) return { reason: 'sem-aba' };
  const failed = { detail: 'A aba do Lattes não respondeu.', reason: 'erro' } as const;
  try {
    return (await runInTab<Omit<Reply<'tela-envio'>, 'id'>>(tabId, 'telaEnvio')) ?? failed;
  } catch {
    return failed;
  }
}

/**
 * Envia ao CNPq (lattes-runner.ts, publicar): só com o "ok" do aviso, e o
 * núcleo na aba confere que a sessão é do currículo do editor.
 */
export async function sendPublish(
  req: { request: PublishRequest; today: string },
  lattesId?: string,
): Promise<PublishResult> {
  if (!lattesId) {
    return {
      detail: 'O editor não sabe de qual currículo é o envio; nada foi enviado.',
      outcome: 'outro-cv',
    };
  }
  if (!(await hasConsent())) return { outcome: 'consentimento' };
  const tabId = await lattesTab();
  if (tabId === undefined) return { outcome: 'sem-aba' };
  const failed: PublishResult = {
    detail:
      'A aba do Lattes não respondeu. Confira a "Última publicação" no menu do Lattes antes de tentar de novo.',
    outcome: 'erro',
  };
  try {
    return (
      (await runInTab<PublishResult>(tabId, 'publicar', JSON.stringify(req), lattesId)) ?? failed
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

/**
 * Uma leitura das listas do Lattes (src/bridge/lattes-lists.ts), só GET, com o
 * "ok" do aviso e na aba do menu; o motivo em error quando não dá.
 */
async function readListReply<T extends { error?: string }>(
  name: 'cursos' | 'instituicoes' | 'listas',
  ...args: string[]
): Promise<T> {
  if (!(await hasConsent())) {
    return { error: 'Aceite o aviso da extensão antes de ler o Lattes.' } as T;
  }
  const tabId = await lattesTab();
  if (tabId === undefined) {
    return { error: 'Abra o currículo no Lattes (a página do menu) numa aba.' } as T;
  }
  const failed = { error: 'A aba do Lattes não respondeu.' } as T;
  try {
    return (await runInTab<T>(tabId, name, ...args)) ?? failed;
  } catch {
    return failed;
  }
}

/**
 * Responde aos pedidos de lista do editor (src/bridge/lattes-lists.ts): a
 * tabela de áreas e as agências, a busca de instituição e os cursos. Outra
 * mensagem: undefined, e o service worker segue com ela.
 */
export async function answerListRequest(
  msg: EditorMessage,
  busy: () => Promise<boolean>,
): Promise<BridgeMessage | undefined> {
  const isList = ['pedir-listas', 'buscar-instituicao', 'pedir-cursos'].includes(msg.type);
  // Nada de leitura no meio de uma gravação: os formulários do Lattes seguem
  // a sessão, e um GET intercalado poderia atrapalhar a operação em curso.
  if (isList && (await busy())) {
    const error = 'O conector está gravando no Lattes; tente de novo quando terminar.';
    const id = (msg as { id: string }).id;
    if (msg.type === 'pedir-listas') return { error, id, type: 'listas' };
    return { error, id, type: msg.type === 'pedir-cursos' ? 'cursos' : 'instituicoes' };
  }
  if (msg.type === 'pedir-listas') {
    return { ...(await readListReply<Reply<'listas'>>('listas')), id: msg.id, type: 'listas' };
  }
  if (msg.type === 'buscar-instituicao') {
    const reply = await readListReply<Reply<'instituicoes'>>(
      'instituicoes',
      msg.query,
      msg.level ?? '',
    );
    return { ...reply, id: msg.id, type: 'instituicoes' };
  }
  if (msg.type === 'pedir-cursos') {
    const reply = await readListReply<Reply<'cursos'>>('cursos', msg.institution, msg.level);
    return { ...reply, id: msg.id, type: 'cursos' };
  }
  return undefined;
}

/**
 * Uma operação da fila na aba do Lattes, pelo núcleo do conector injetado
 * (lattes-runner.ts). A resposta volta crua: quem chama confere
 * (checkedResult, em src/bridge/write-brake.ts).
 */
export async function applyInTab(tabId: number, op: BridgeOp): Promise<unknown> {
  const [res] = await guarded(tabId, () =>
    chrome.scripting.executeScript({
      args: [op] as [BridgeOp],
      func: (o: BridgeOp) =>
        (
          globalThis as unknown as { __conector: { apply(op: BridgeOp): Promise<OpResult> } }
        ).__conector.apply(o),
      target: { tabId },
    }),
  );
  return res?.result;
}

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
    const [res] = await guarded(tabId, () =>
      chrome.scripting.executeScript({
        func: () =>
          (
            globalThis as unknown as { __conector: { verificar(): Promise<ContractReport> } }
          ).__conector.verificar(),
        target: { tabId },
      }),
    );
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
  const [res] = await guarded(tabId, () =>
    chrome.scripting.executeScript({
      args: [fresh],
      func: (f: boolean) =>
        (
          globalThis as unknown as { __conector: { identity(fresh: boolean): Promise<Identity> } }
        ).__conector.identity(f),
      target: { tabId },
    }),
  );
  return res?.result ?? {};
}

/**
 * Recarrega a aba do Lattes. Com a sessão vencida, a aba segue mostrando o
 * currículo; recarregada, o Lattes leva ao login, e depois dele ao menu, que a
 * extensão lê de novo sozinha. Devolve se recarregou: false sem aba, ou se ela
 * fechou no meio do caminho (nunca rejeita, quem chama não precisa de catch).
 */
export async function reloadLattesTab(): Promise<boolean> {
  try {
    const tabId = await lattesTab();
    if (tabId === undefined) return false;
    await chrome.tabs.reload(tabId);
    return true;
  } catch {
    return false;
  }
}

/** A aba do Lattes de verdade, mesmo no canal Dev: os itens de teste não vão ao simulado. */
export async function realLattesTab(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ url: [LATTES_MENU] });
  return tab?.id;
}

/** Prazo dos itens de teste: a leitura dos formulários leva alguns minutos. */
const TEST_ITEMS_TIMEOUT_MS = 10 * 60_000;

type CensusAction = 'andamento' | 'criar' | 'preparar' | 'remover';

/**
 * Os itens de teste no mundo da página (test-items-run.ts, só no canal Dev):
 * injeta o censo uma vez por carregamento do menu e roda a ação pedida.
 */
export async function runCensusInPage(
  tabId: number,
  action: CensusAction,
  options: { batch?: number; retryFailed?: boolean },
): Promise<{ error?: string; result?: unknown }> {
  const long = <T>(start: () => Promise<T>) =>
    untilTabCloses(tabId, start, chrome.tabs.onRemoved, TEST_ITEMS_TIMEOUT_MS);
  const [loaded] = await long(() =>
    chrome.scripting.executeScript({
      func: () =>
        typeof (globalThis as { __lattesCensus?: { prepareTestItems?: unknown } }).__lattesCensus
          ?.prepareTestItems === 'function',
      target: { tabId },
      world: 'MAIN',
    }),
  );
  if (!loaded?.result) {
    await long(() =>
      chrome.scripting.executeScript({
        files: ['censo-lattes.js'],
        target: { tabId },
        world: 'MAIN',
      }),
    );
  }
  const [res] = await long(() =>
    chrome.scripting.executeScript({
      args: [action, options] as [CensusAction, typeof options],
      func: async (acao: CensusAction, opts: typeof options) => {
        type Fn = (o?: unknown) => unknown;
        const c = (globalThis as unknown as { __lattesCensus: Record<string, Fn> }).__lattesCensus;
        try {
          const run =
            acao === 'preparar'
              ? c.prepareTestItems!()
              : acao === 'criar'
                ? c.testItems!(opts)
                : acao === 'remover'
                  ? c.removeTestItems!(opts)
                  : c.testProgress!();
          return { result: JSON.parse(JSON.stringify(await run)) as unknown };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
      target: { tabId },
      world: 'MAIN',
    }),
  );
  return res?.result ?? { error: 'A aba do Lattes não respondeu' };
}
