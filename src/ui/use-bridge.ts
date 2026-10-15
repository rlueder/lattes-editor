// Ligação do editor com a extensão do conector: descobre se ela está instalada
// (aperto de mão), planeja as alterações que ela sabe levar, manda a fila e
// acompanha os resultados. Também recebe o código do currículo, que a
// extensão lê no Lattes, para a foto do perfil.
//
// No app de desktop, as mensagens vão e voltam por mensagens nativas (eventos
// e comando do próprio app, ver src-tauri/src/conector.rs). No navegador, em
// desenvolvimento, por postMessage com o script de conteúdo.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { OpResult } from '../bridge/apply.ts';
import { BRIDGE_FEATURES } from '../bridge/compat.ts';
import { sameCv } from '../bridge/lattes-html.ts';
import type { LattesStatus } from '../bridge/lattes-status.ts';
import { INITIAL_LINK, type Link, nextLink } from '../bridge/link.ts';
import { type BridgeOp, planChanges, planOptionsFor } from '../bridge/plan.ts';
import {
  type BridgeMessage,
  type EditorMessage,
  editorMessage,
  fromSamePage,
  isBridgeMessage,
  isIncompatibleHello,
} from '../bridge/protocol.ts';
import { type SentEntry, sentEntry, undoOp } from '../bridge/sent-log.ts';
import { isDesktop } from '../desktop/native.ts';
import type { Session } from '../forms/use-production.ts';
import { importMessage } from '../import-export/import-request.ts';
import type { Change } from '../model/changes.ts';
import { setIncludeCapability, syncIncludeCapability } from '../model/direct-inclusion.ts';
import { addHistoryPoint, addSent, clearSent, listSent } from '../model/store.ts';
import { getAttr } from '../model/xml.ts';
import type {
  CurriculoReading,
  EspelhoReading,
  ImportReading,
  PhotoUploadReading,
} from './bridge-readings.ts';
import type { ChangeGroup } from './changes-view.ts';
import { writeCvCode } from './profile.ts';
import { type RestoreState, useRestorePoint } from './use-restore-point.ts';

// As leituras das respostas da extensão moram em bridge-readings.ts; quem já
// importava daqui segue igual.
export type {
  CurriculoReading,
  EspelhoReading,
  ImportReading,
  PhotoUploadReading,
} from './bridge-readings.ts';

/** Evento da janela avisando que um novo código do currículo foi guardado. */
export const CV_CODE_EVENT = 'lattes-editor:codigo-cv';

/** Quanto esperar a resposta da extensão antes de dizer que ela não está ligada. */
export const HELLO_TIMEOUT_MS = 3000;

/** O aperto de mão leva a versão e as capacidades do app (src/bridge/compat.ts). */
const HELLO: EditorMessage = {
  features: [...BRIDGE_FEATURES],
  type: 'ola',
  version: __APP_VERSION__,
};

export const post = (msg: EditorMessage): void => {
  if (isDesktop()) {
    void import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke('conector_send', { msg: JSON.stringify(editorMessage(msg)) }))
      // Extensão não conectada: o editor fica sem o conector, como no navegador sem extensão.
      .catch(() => undefined);
    return;
  }
  window.postMessage(editorMessage(msg), location.origin);
};

/**
 * Escuta a extensão. No desktop, os eventos do app; "conector-ligado" pede o
 * aperto de mão de novo (a extensão pode ter chegado depois do editor) e
 * "conector-desligado" desliga o envio.
 */
function listen(
  onMessage: (msg: BridgeMessage) => void,
  onLost: () => void,
  onIncompatible: () => void,
): () => void {
  const receive = (data: unknown) => {
    if (isBridgeMessage(data)) onMessage(data);
    else if (isIncompatibleHello(data)) onIncompatible();
  };
  if (isDesktop()) {
    let alive = true;
    const offs: (() => void)[] = [];
    void import('@tauri-apps/api/event').then(async ({ listen: on }) => {
      const subs = await Promise.all([
        on<string>('conector', (e) => {
          try {
            receive(JSON.parse(e.payload));
          } catch {
            // Linha que não é JSON: ignorada.
          }
        }),
        on('conector-ligado', () => post(HELLO)),
        on('conector-desligado', onLost),
      ]);
      if (alive) offs.push(...subs);
      else subs.forEach((off) => off());
    });
    return () => {
      alive = false;
      offs.forEach((off) => off());
    };
  }
  const onWindow = (event: MessageEvent) => {
    if (!fromSamePage(event, { origin: location.origin, window })) return;
    receive(event.data);
  };
  window.addEventListener('message', onWindow);
  return () => window.removeEventListener('message', onWindow);
}

/**
 * Só as mensagens da extensão, sem o aperto de mão nem a queda da ligação
 * (que ficam com listen): para quem pede uma leitura e espera a resposta,
 * como as listas do Lattes (use-lattes-lists.ts).
 */
export function listenReplies(onMessage: (msg: BridgeMessage) => void): () => void {
  const receive = (data: unknown) => {
    if (isBridgeMessage(data)) onMessage(data);
  };
  if (isDesktop()) {
    let alive = true;
    let off: (() => void) | undefined;
    void import('@tauri-apps/api/event').then(async ({ listen: on }) => {
      const sub = await on<string>('conector', (e) => {
        try {
          receive(JSON.parse(e.payload));
        } catch {
          // Linha que não é JSON: ignorada.
        }
      });
      if (alive) off = sub;
      else sub();
    });
    return () => {
      alive = false;
      off?.();
    };
  }
  const onWindow = (event: MessageEvent) => {
    if (!fromSamePage(event, { origin: location.origin, window })) return;
    receive(event.data);
  };
  window.addEventListener('message', onWindow);
  return () => window.removeEventListener('message', onWindow);
}

export interface BridgeState {
  /**
   * A resposta da pessoa quando não houve ponto de restauração: true segue
   * sem ele ("Continuar sem ponto de restauração"), false cancela.
   */
  answerRestore: (go: boolean) => void;
  available: boolean;
  /** Apaga o registro do enviado deste currículo (nada muda no Lattes). */
  clearSent: () => Promise<void>;
  /** Quantas alterações foram gravadas e conferidas desde o último envio. */
  confirmed: number;
  /** O ZIP do Exportar que a extensão trouxe do Lattes, ou o motivo de não ter vindo. */
  curriculo?: CurriculoReading;
  /**
   * A versão atual do Lattes, lida da página de conferência a pedido do
   * diagnóstico: os itens, ou o motivo de não ter lido.
   */
  espelho?: EspelhoReading;
  /** O que a extensão ligada sabe fazer (src/bridge/compat.ts); vazio sem extensão. */
  features: readonly string[];
  /** A resposta do último Importar pelo conector (src/bridge/importar.ts). */
  importResult?: ImportReading;
  /**
   * O que a extensão leu do menu do Lattes (última publicação e pendência),
   * só quando a sessão é deste currículo; undefined sem extensão ou sem leitura.
   */
  lattes?: LattesStatus;
  /** Em que pé está a ligação com o Lattes, para o cabeçalho explicar a falta de leitura. */
  link: Link;
  /** A resposta do último pedido de troca da foto. */
  photoUpload?: PhotoUploadReading;
  /** Alterações que a extensão sabe levar e as que ela ainda não leva. */
  plan: ReturnType<typeof planChanges>;
  /** Recarrega a aba do Lattes pela extensão (sessão vencida leva ao login). */
  reloadLattes: () => void;
  /** Pede o ZIP do Exportar à extensão (Abrir do Lattes); a resposta chega em curriculo, com o mesmo id. */
  requestCv: (id: string) => void;
  /** Pede a versão atual do Lattes à extensão; a resposta chega em espelho. */
  requestEspelho: () => void;
  /** O ponto de restauração da última rodada de escrita (LAT-59). */
  restore?: RestoreState;
  results: Record<string, OpResult>;
  running: boolean;
  /**
   * Antes de mandar, exporta o Lattes e guarda um ponto de restauração; sem
   * ele, só segue com a confirmação da pessoa (answerRestore). Também guarda
   * sozinho um ponto no histórico com o currículo como está no Lattes.
   * undo: em vez da fila planejada, manda só a operação que desfaz essa
   * entrada do registro.
   */
  send: (options?: { undo?: SentEntry }) => Promise<void>;
  /**
   * Pede à extensão o Importar dos itens novos, num arquivo só com eles.
   * Devolve o id do pedido, que volta em importResult; undefined quando nada
   * foi pedido (IMPORT_ENABLED desligado ou sem item novo).
   */
  sendImport: () => string | undefined;
  /**
   * Pede à extensão para trocar a foto no Lattes (jpeg em base64, já com até
   * 70 kB); devolve o id do pedido, que volta em photoUpload.
   */
  sendPhoto: (jpeg: string) => string;
  /** O que o conector gravou e conferiu no Lattes para este currículo, do mais recente. */
  sent: SentEntry[];
  stop: () => void;
}

/** O que foi mandado em cada chave da fila, para registrar quando voltar conferido. */
interface Outgoing {
  change?: Change;
  op: BridgeOp;
  undoOf?: number;
}

export function useBridge(
  session: Session | null,
  groups: ChangeGroup[],
  onConfirmed: (key: string, assigned?: Record<string, string>) => void,
  onUndone: (change: Change) => void,
): BridgeState {
  const confirmedRef = useRef(onConfirmed);
  confirmedRef.current = onConfirmed;
  const undoneRef = useRef(onUndone);
  undoneRef.current = onUndone;
  const outgoing = useRef(new Map<string, Outgoing>());
  const [confirmed, setConfirmed] = useState(0);
  const [available, setAvailable] = useState(false);
  const [features, setFeatures] = useState<readonly string[]>([]);
  const [results, setResults] = useState<Record<string, OpResult>>({});
  const [running, setRunning] = useState(false);
  const lattesId = session ? getAttr(session.doc.root, 'NUMERO-IDENTIFICADOR') : undefined;
  const [sent, setSent] = useState<SentEntry[]>([]);
  const [lattes, setLattes] = useState<LattesStatus | undefined>();
  const [espelho, setEspelho] = useState<EspelhoReading | undefined>();
  const [link, setLink] = useState<Link>(INITIAL_LINK);
  const [curriculo, setCurriculo] = useState<CurriculoReading | undefined>();
  const [photoUpload, setPhotoUpload] = useState<PhotoUploadReading | undefined>();
  const [importResult, setImportResult] = useState<ImportReading | undefined>();
  const restorePoint = useRestorePoint(features, post);
  const { dropAll: dropRestoreRequests, takeReply: takeRestoreReply } = restorePoint;

  const reloadSent = useCallback(() => {
    if (!lattesId) {
      setSent([]);
      return;
    }
    listSent(lattesId)
      .then(setSent)
      .catch(() => setSent([]));
  }, [lattesId]);
  useEffect(reloadSent, [reloadSent]);

  /**
   * Toda resposta da fila entra no registro: a conferida, a criada no Lattes
   * com problema na conferência e a que não gravou, cada uma com o resultado
   * (LAT-47). Só a conferida desfeita reabre a alteração no editor.
   */
  const recordResult = useCallback(
    (result: OpResult) => {
      const item = outgoing.current.get(result.key);
      if (!item || !lattesId) return;
      outgoing.current.delete(result.key);
      const { detail, status } = result;
      const ok = status === 'conferido';
      const entry = sentEntry(item.op, lattesId, Date.now(), {
        change: item.change,
        outcome: status === 'conferido' ? undefined : { detail, status },
        undoOf: item.undoOf,
      });
      void addSent(entry)
        .then(reloadSent)
        .catch(() => undefined);
      if (ok && item.undoOf !== undefined && item.change) undoneRef.current(item.change);
    },
    [lattesId, reloadSent],
  );
  const recordRef = useRef(recordResult);
  recordRef.current = recordResult;

  useEffect(() => {
    const onMessage = (msg: BridgeMessage) => {
      setLink((l) => nextLink(l, msg, lattesId));
      if (msg.type === 'ola') {
        setAvailable(true);
        setFeatures(msg.features ?? []);
      }
      if (msg.type === 'resultado') {
        setResults((r) => ({ ...r, [msg.result.key]: msg.result }));
        recordRef.current(msg.result);
        if (msg.result.status === 'conferido') {
          setConfirmed((n) => n + 1);
          confirmedRef.current(msg.result.key, msg.result.assigned);
        }
      }
      if (msg.type === 'fim') setRunning(false);
      // Só guarda o código se ele for deste currículo (a sessão do Lattes pode ser de outro).
      if (msg.type === 'codigo-cv' && lattesId && sameCv(lattesId, msg.lattesId)) {
        writeCvCode(lattesId, msg.code);
        window.dispatchEvent(new Event(CV_CODE_EVENT));
      }
      if (msg.type === 'estado-lattes' && lattesId && sameCv(lattesId, msg.lattesId)) {
        setLattes({ ...msg.status, readAt: Date.now() });
      }
      // O ZIP do ponto de restauração não é uma abertura de arquivo.
      if (msg.type === 'curriculo' && !takeRestoreReply(msg)) {
        setCurriculo({
          at: Date.now(),
          detail: msg.detail,
          fileName: msg.fileName,
          id: msg.id,
          lattesId: msg.lattesId,
          reason: msg.reason,
          zip: msg.zip,
        });
      }
      if (msg.type === 'foto') {
        setPhotoUpload({
          at: Date.now(),
          detail: msg.detail,
          id: msg.id,
          ok: msg.ok,
          reason: msg.reason,
        });
      }
      if (msg.type === 'importacao') {
        setImportResult({
          at: Date.now(),
          detail: msg.detail,
          id: msg.id,
          page: msg.page,
          reason: msg.reason,
          request: msg.request,
        });
      }
      if (msg.type === 'espelho') {
        // Itens de outro currículo nunca entram na comparação.
        const other = msg.items && !(lattesId && sameCv(lattesId, msg.lattesId));
        setEspelho({
          at: Date.now(),
          error: other ? 'A sessão aberta no Lattes é de outro currículo.' : msg.error,
          items: other ? undefined : msg.items,
        });
      }
    };
    setLattes(undefined);
    setEspelho(undefined);
    setLink(INITIAL_LINK);
    const stopListening = listen(
      onMessage,
      () => {
        dropRestoreRequests();
        setAvailable(false);
        setFeatures([]);
        setRunning(false);
        setLattes(undefined);
        setLink({ state: { kind: 'sem-extensao' } });
      },
      () => setLink({ state: { kind: 'incompativel' } }),
    );
    const timer = setTimeout(
      () =>
        setLink((l) => (l.state.kind === 'procurando' ? { state: { kind: 'sem-extensao' } } : l)),
      HELLO_TIMEOUT_MS,
    );
    post(HELLO);
    return () => {
      clearTimeout(timer);
      stopListening();
    };
  }, [lattesId, takeRestoreReply, dropRestoreRequests]);

  // Os eventos saem do Importar só com a extensão que anuncia 'incluir-itens'
  // (direct-inclusion.ts). Segue as capacidades: sem extensão (features
  // vazias) ou com uma mais antiga, volta a desligar; ao sair, também.
  useEffect(() => syncIncludeCapability(features), [features]);
  useEffect(() => () => setIncludeCapability(false), []);

  const plan = useMemo(
    () =>
      session
        ? planChanges(
            groups.flatMap((g) => g.entries),
            session.doc.root,
            planOptionsFor(features),
          )
        : { ops: [], unsupported: [] },
    [session, groups, features],
  );

  return {
    ...restorePoint.fields,
    available,
    clearSent: async () => {
      if (!lattesId) return;
      await clearSent(lattesId);
      setSent([]);
    },
    confirmed,
    curriculo,
    espelho,
    features,
    importResult,
    lattes,
    link,
    photoUpload,
    plan,
    reloadLattes: () => post({ type: 'recarregar-lattes' }),
    requestCv: (id) => post({ id, type: 'pedir-curriculo' }),
    requestEspelho: () => post({ type: 'pedir-espelho' }),
    results,
    running,
    send: async ({ undo } = {}) => {
      const reverse = undo && undoOp(undo);
      if (undo && !reverse) return;
      const ops = reverse ? [reverse] : plan.ops;
      // O ponto de restauração vem antes de qualquer gravação (LAT-59).
      if (!(await restorePoint.begin(lattesId, ops))) return;
      if (session) {
        // O currículo como o Lattes está antes deste envio (a exportação com o
        // que já foi conferido). Restaurar esse ponto põe as alterações de
        // volta na lista, para desfazê-las pelo caminho de sempre. Se o ponto
        // não grava, o envio segue: o registro do enviado guarda o antes de
        // cada campo de qualquer jeito.
        await addHistoryPoint({
          keep: true,
          note: reverse ? 'Lattes antes de desfazer' : 'Lattes antes do envio',
          savedAt: Date.now(),
          xml: session.meta.originalXml,
        }).catch((err: unknown) => console.error('Ponto de histórico não gravou:', err));
      }
      const changes = new Map(
        groups.flatMap((g) => g.entries).map((e) => [e.change.key, e.change]),
      );
      outgoing.current = new Map(
        ops.map((op) => [
          op.key,
          reverse
            ? { change: undo?.change, op, undoOf: undo?.id }
            : { change: changes.get(op.key), op },
        ]),
      );
      setResults({});
      setConfirmed(0);
      setRunning(true);
      post({ lattesId, ops, type: 'enviar' });
    },
    sendImport: () => {
      if (!session) return undefined;
      const msg = importMessage(
        session.doc,
        session.meta.encoding,
        session.meta.loadedMaxSequencia,
        { id: `importar-${Date.now()}`, lattesId },
      );
      if (!msg) return undefined;
      post(msg);
      return msg.id;
    },
    sendPhoto: (jpeg) => {
      const id = `foto-${Date.now()}`;
      post({ id, jpeg, lattesId, type: 'enviar-foto' });
      return id;
    },
    sent,
    stop: () => post({ type: 'parar' }),
  };
}
