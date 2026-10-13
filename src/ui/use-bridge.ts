// Ligação do editor com a extensão da ponte: descobre se ela está instalada
// (aperto de mão), planeja as alterações que ela sabe levar, manda a fila e
// acompanha os resultados. Também recebe o código do currículo, que a
// extensão lê no Lattes, para a foto do perfil.
//
// No app de desktop, as mensagens vão e voltam por mensagens nativas (eventos
// e comando do próprio app, ver src-tauri/src/ponte.rs). No navegador, em
// desenvolvimento, por postMessage com o script de conteúdo.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { OpResult } from '../bridge/apply.ts';
import type { EspelhoItem } from '../bridge/espelho.ts';
import { sameCv } from '../bridge/lattes-html.ts';
import type { LattesStatus } from '../bridge/lattes-status.ts';
import { type BridgeOp, planChanges } from '../bridge/plan.ts';
import {
  type BridgeMessage,
  type EditorMessage,
  editorMessage,
  fromSamePage,
  isBridgeMessage,
} from '../bridge/protocol.ts';
import { type SentEntry, sentEntry, undoOp } from '../bridge/sent-log.ts';
import { isDesktop } from '../desktop/native.ts';
import type { Session } from '../forms/use-production.ts';
import type { Change } from '../model/changes.ts';
import { addHistoryPoint, addSent, clearSent, listSent } from '../model/store.ts';
import { getAttr } from '../model/xml.ts';
import type { ChangeGroup } from './changes-view.ts';
import { writeCvCode } from './profile.ts';

/** Evento da janela avisando que um novo código do currículo foi guardado. */
export const CV_CODE_EVENT = 'lattes-editor:codigo-cv';

const post = (msg: EditorMessage): void => {
  if (isDesktop()) {
    void import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke('ponte_send', { msg: JSON.stringify(editorMessage(msg)) }))
      // Extensão não conectada: o editor fica sem a ponte, como no navegador sem extensão.
      .catch(() => undefined);
    return;
  }
  window.postMessage(editorMessage(msg), location.origin);
};

/**
 * Escuta a extensão. No desktop, os eventos do app; "ponte-conectada" pede o
 * aperto de mão de novo (a extensão pode ter chegado depois do editor) e
 * "ponte-desconectada" desliga o envio.
 */
function listen(onMessage: (msg: BridgeMessage) => void, onLost: () => void): () => void {
  if (isDesktop()) {
    let alive = true;
    const offs: (() => void)[] = [];
    void import('@tauri-apps/api/event').then(async ({ listen: on }) => {
      const subs = await Promise.all([
        on<string>('ponte', (e) => {
          try {
            const data: unknown = JSON.parse(e.payload);
            if (isBridgeMessage(data)) onMessage(data);
          } catch {
            // Linha que não é JSON: ignorada.
          }
        }),
        on('ponte-conectada', () => post({ type: 'ola' })),
        on('ponte-desconectada', onLost),
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
    if (isBridgeMessage(event.data)) onMessage(event.data);
  };
  window.addEventListener('message', onWindow);
  return () => window.removeEventListener('message', onWindow);
}

export interface BridgeState {
  available: boolean;
  /** Apaga o registro do enviado deste currículo (nada muda no Lattes). */
  clearSent: () => Promise<void>;
  /** Quantas alterações foram gravadas e conferidas desde o último envio. */
  confirmed: number;
  /**
   * A versão atual do Lattes, lida da página de conferência a pedido do
   * diagnóstico: os itens, ou o motivo de não ter lido.
   */
  espelho?: EspelhoReading;
  /**
   * O que a extensão leu do menu do Lattes (última publicação e pendência),
   * só quando a sessão é deste currículo; undefined sem extensão ou sem leitura.
   */
  lattes?: LattesStatus;
  /** Alterações que a extensão sabe levar e as que ficam para copiar à mão. */
  plan: ReturnType<typeof planChanges>;
  /** Pede a versão atual do Lattes à extensão; a resposta chega em espelho. */
  requestEspelho: () => void;
  results: Record<string, OpResult>;
  running: boolean;
  /**
   * Antes de mandar, guarda sozinho um ponto no histórico com o currículo
   * como está no Lattes, sem perguntar nada.
   * undo: em vez da fila planejada, manda só a operação que desfaz essa
   * entrada do registro.
   */
  send: (options?: { undo?: SentEntry }) => Promise<void>;
  /** O que a ponte gravou e conferiu no Lattes para este currículo, do mais recente. */
  sent: SentEntry[];
  stop: () => void;
}

export interface EspelhoReading {
  /** Quando a resposta chegou (ms). */
  at: number;
  error?: string;
  items?: EspelhoItem[];
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
  onConfirmed: (key: string) => void,
  onUndone: (change: Change) => void,
): BridgeState {
  const confirmedRef = useRef(onConfirmed);
  confirmedRef.current = onConfirmed;
  const undoneRef = useRef(onUndone);
  undoneRef.current = onUndone;
  const outgoing = useRef(new Map<string, Outgoing>());
  const [confirmed, setConfirmed] = useState(0);
  const [available, setAvailable] = useState(false);
  const [results, setResults] = useState<Record<string, OpResult>>({});
  const [running, setRunning] = useState(false);
  const lattesId = session ? getAttr(session.doc.root, 'NUMERO-IDENTIFICADOR') : undefined;
  const [sent, setSent] = useState<SentEntry[]>([]);
  const [lattes, setLattes] = useState<LattesStatus | undefined>();
  const [espelho, setEspelho] = useState<EspelhoReading | undefined>();

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
   * Entra no registro o que voltou conferido e o que foi criado no Lattes
   * mesmo com problema na conferência; as outras falhas não gravaram nada.
   */
  const recordConfirmed = useCallback(
    (key: string) => {
      const item = outgoing.current.get(key);
      if (!item || !lattesId) return;
      outgoing.current.delete(key);
      const entry = sentEntry(item.op, lattesId, Date.now(), {
        change: item.change,
        undoOf: item.undoOf,
      });
      void addSent(entry)
        .then(reloadSent)
        .catch(() => undefined);
      if (item.undoOf !== undefined && item.change) undoneRef.current(item.change);
    },
    [lattesId, reloadSent],
  );
  const recordRef = useRef(recordConfirmed);
  recordRef.current = recordConfirmed;

  useEffect(() => {
    const onMessage = (msg: BridgeMessage) => {
      if (msg.type === 'ola') setAvailable(true);
      if (msg.type === 'resultado') {
        setResults((r) => ({ ...r, [msg.result.key]: msg.result }));
        if (msg.result.status === 'conferido') {
          setConfirmed((n) => n + 1);
          recordRef.current(msg.result.key);
          confirmedRef.current(msg.result.key);
        } else if (msg.result.assigned) {
          // Criado no Lattes, mas a conferência achou problema: entra no
          // registro (o item existe lá), e a alteração continua no editor.
          recordRef.current(msg.result.key);
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
    const stopListening = listen(onMessage, () => {
      setAvailable(false);
      setRunning(false);
      setLattes(undefined);
    });
    post({ type: 'ola' });
    return stopListening;
  }, [lattesId]);

  const plan = useMemo(
    () =>
      session
        ? planChanges(
            groups.flatMap((g) => g.entries),
            session.doc.root,
          )
        : { ops: [], unsupported: [] },
    [session, groups],
  );

  return {
    available,
    clearSent: async () => {
      if (!lattesId) return;
      await clearSent(lattesId);
      setSent([]);
    },
    confirmed,
    espelho,
    lattes,
    plan,
    requestEspelho: () => post({ type: 'pedir-espelho' }),
    results,
    running,
    send: async ({ undo } = {}) => {
      const reverse = undo && undoOp(undo);
      if (undo && !reverse) return;
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
      const ops = reverse ? [reverse] : plan.ops;
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
    sent,
    stop: () => post({ type: 'parar' }),
  };
}
