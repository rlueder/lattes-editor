// Mensagens entre o editor (página) e a extensão do conector, por
// window.postMessage na própria página do editor. Versionadas: um lado que
// não conhece a versão do outro ignora a mensagem.

import type { OpResult } from './apply.ts';
import type { EspelhoItem } from './espelho.ts';
import type { ExportFailure } from './export.ts';
import type { ImportStop, PageShape } from './importar.ts';
import type { Agency, AreaNode, Course, Institution } from './lattes-lists.ts';
import type { LattesStatus } from './lattes-status.ts';
import type { PhotoFailure } from './photo.ts';
import type { BridgeOp } from './plan.ts';
import type { PublishRequest, PublishResult, SendScreen } from './publish.ts';

export const PROTOCOL_VERSION = 1;
export const EDITOR_SOURCE = 'lattes-editor';
export const BRIDGE_SOURCE = 'lattes-conector';

export type EditorMessage =
  /** lattesId: o currículo aberto no editor; o conector só grava se a sessão do Lattes for dele. */
  | { lattesId?: string; ops: BridgeOp[]; type: 'enviar' }
  /** version e features: do app (src/bridge/compat.ts); versões antigas mandam só o tipo. */
  | { features?: string[]; type: 'ola'; version?: string }
  | { type: 'parar' }
  /**
   * Pede o ZIP do Exportar do currículo da sessão (Abrir do Lattes); id volta
   * na resposta, para uma resposta atrasada não valer pelo pedido seguinte.
   */
  | { id: string; type: 'pedir-curriculo' }
  /** Pede a versão atual do Lattes (página de conferência), só leitura. */
  | { type: 'pedir-espelho' }
  /**
   * Recarrega a aba do Lattes. Com a sessão vencida, a aba continua mostrando
   * o currículo; recarregada, ela leva ao login.
   */
  | { type: 'recarregar-lattes' }
  /**
   * Troca a foto do currículo no Lattes (src/bridge/photo.ts), depois de a
   * pessoa confirmar no editor. jpeg em base64, já reduzido a até 70 kB;
   * lattesId: o currículo aberto no editor, e a extensão só envia se a sessão
   * do Lattes for dele. id volta na resposta.
   */
  | { id: string; jpeg: string; lattesId?: string; type: 'enviar-foto' }
  /**
   * Listas do Lattes lidas ao vivo (src/bridge/lattes-lists.ts), só leitura:
   * a tabela de áreas e as agências de fomento. id volta na resposta.
   */
  | { id: string; type: 'pedir-listas' }
  /** Busca de instituição no diretório do Lattes, só leitura; level é o f_nivel da formação. */
  | { id: string; level?: string; query: string; type: 'buscar-instituicao' }
  /** Os cursos de uma instituição (código com a letra) num nível da formação, só leitura. */
  | { id: string; institution: string; level: string; type: 'pedir-cursos' }
  /**
   * Importa os itens novos pelo Importar do Lattes (src/bridge/importar.ts),
   * só com IMPORT_ENABLED. file: o arquivo mínimo (opção 1) em base64;
   * modules: os valores f_chkp do passo 2; oldestYear: o ano do item novo
   * mais antigo. lattesId: o currículo aberto no editor, e a extensão só
   * envia se a sessão do Lattes for dele. id volta na resposta.
   */
  | {
      file: string;
      fileName: string;
      id: string;
      lattesId?: string;
      modules: number[];
      oldestYear?: number;
      type: 'importar';
    }
  /**
   * Lê a tela de envio ao CNPq (pkg_publicar.mostrar_cv), só GET: a
   * declaração, o Termo de Uso, o idioma, a versão em inglês e os e-mails.
   * id volta na resposta.
   */
  | { id: string; type: 'ler-envio' }
  /**
   * Envia ao CNPq (src/bridge/publish.ts), só com PUBLISH_ENABLED e depois de
   * a pessoa marcar a declaração no editor (request.declarationAccepted).
   * lattesId: o currículo aberto no editor, e a extensão só envia se a sessão
   * do Lattes for dele. today: AAAA-MM-DD da pessoa, para conferir a
   * publicação no menu. id volta na resposta.
   */
  | { id: string; lattesId?: string; request: PublishRequest; today: string; type: 'publicar' };

export type BridgeMessage =
  /** lattesId: de qual currículo é o código, para o editor não guardar o de outro. */
  | { code: string; lattesId?: string; type: 'codigo-cv' }
  /** O que o menu do Lattes mostra: data da última publicação e pendência. */
  | { lattesId?: string; status: LattesStatus; type: 'estado-lattes' }
  | { result: OpResult; type: 'resultado' }
  /**
   * Os itens da página de conferência do Lattes, ou o motivo de não ter
   * lido; lattesId diz de qual currículo é a sessão.
   */
  | { error?: string; items?: EspelhoItem[]; lattesId?: string; type: 'espelho' }
  /**
   * O ZIP do Exportar em base64, ou o motivo de não ter vindo; lattesId diz
   * de qual currículo é a sessão.
   */
  | {
      detail?: string;
      fileName?: string;
      /** O id do pedido que esta resposta atende. */
      id?: string;
      lattesId?: string;
      reason?: ExportFailure;
      type: 'curriculo';
      zip?: string;
    }
  | { type: 'fim' }
  /** O resultado da troca da foto pedida com o mesmo id. */
  | { detail?: string; id: string; ok: boolean; reason?: PhotoFailure; type: 'foto' }
  /**
   * Onde o Importar pedido com o mesmo id parou. Enquanto o passo 3 não for
   * mapeado, o fim esperado é reason "passo-3", com a forma da página em
   * page e a solicitação pendente em request.
   */
  | {
      detail?: string;
      id: string;
      page?: PageShape;
      reason: ImportStop;
      request?: string;
      type: 'importacao';
    }
  /** features: o que esta extensão sabe fazer (src/bridge/compat.ts); ausente nas versões de antes do aperto de mão com capacidades. */
  | { features?: string[]; type: 'ola'; version: string }
  /** A extensão tentou ler o menu do Lattes e não conseguiu; reason diz por quê. */
  | { lattesId?: string; reason: NoReadingReason; type: 'sem-leitura' }
  /** As listas pedidas com o mesmo id; a que não veio fica de fora, e error diz por quê. */
  | { agencies?: Agency[]; areas?: AreaNode[]; error?: string; id: string; type: 'listas' }
  /** Os resultados da busca de instituição pedida com o mesmo id. */
  | { error?: string; id: string; results?: Institution[]; type: 'instituicoes' }
  /** Os cursos pedidos com o mesmo id. */
  | { courses?: Course[]; error?: string; id: string; type: 'cursos' }
  /**
   * A tela de envio ao CNPq pedida com o mesmo id, ou o motivo de não ter
   * lido; previews: os endereços da página de conferência em português e em
   * inglês, na base do Lattes da aba. lattesId diz de qual currículo é a sessão.
   */
  | {
      detail?: string;
      id: string;
      lattesId?: string;
      previews?: { en: string; pt: string };
      reason?: SendScreenFailure;
      screen?: SendScreen;
      type: 'tela-envio';
    }
  /** O resultado do envio ao CNPq pedido com o mesmo id. */
  | { id: string; result: PublishResult; type: 'publicacao' };

/** Por que a tela de envio não foi lida. */
export type SendScreenFailure =
  'consentimento' | 'erro' | 'mudou' | 'ocupado' | 'sem-aba' | 'sessao';

/**
 * Por que não há leitura do Lattes: sem o "ok" do aviso da extensão, sem aba
 * do Lattes aberta, aba fora do menu (ou sessão caída) e falha ao ler a aba.
 */
export type NoReadingReason = 'consentimento' | 'erro' | 'sem-aba' | 'sem-data';

type Envelope<T> = T & { source: string; v: number };

function hasEnvelope(data: unknown, source: string): data is Envelope<{ type: string }> {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.source === source && d.v === PROTOCOL_VERSION && typeof d.type === 'string';
}

export function isEditorMessage(data: unknown): data is Envelope<EditorMessage> {
  return hasEnvelope(data, EDITOR_SOURCE);
}

/**
 * O aperto de mão de uma extensão com outra versão do protocolo: o resto das
 * mensagens dela é ignorado, mas o editor consegue dizer por quê.
 */
export function isIncompatibleHello(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.source === BRIDGE_SOURCE && d.type === 'ola' && d.v !== PROTOCOL_VERSION;
}

export function isBridgeMessage(data: unknown): data is Envelope<BridgeMessage> {
  return hasEnvelope(data, BRIDGE_SOURCE);
}

export function editorMessage(msg: EditorMessage): Envelope<EditorMessage> {
  return { ...msg, source: EDITOR_SOURCE, v: PROTOCOL_VERSION };
}

export function bridgeMessage(msg: BridgeMessage): Envelope<BridgeMessage> {
  return { ...msg, source: BRIDGE_SOURCE, v: PROTOCOL_VERSION };
}

/**
 * Mensagem da própria página: mesma janela e mesma origem. Outra aba, iframe
 * ou site não conversa com o conector.
 */
export function fromSamePage(
  event: { origin: string; source: unknown },
  page: { origin: string; window: unknown },
): boolean {
  return event.source === page.window && event.origin === page.origin;
}
