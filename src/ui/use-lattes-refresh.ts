// "Atualizar do Lattes" pela ponte: as passadas de leitura (src/bridge/refresh/)
// pedidas à extensão uma a uma, e cada parte de formulários levada à cópia de
// trabalho assim que chega. As regras e os textos estão em lattes-refresh.ts.
// Uma extensão sem a capacidade 'atualizar-do-lattes' não recebe pedido.

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { BridgeMessage } from '../bridge/protocol.ts';
import { LATTES_REFRESH_ENABLED } from '../bridge/refresh/enabled.ts';
import type { RefreshRequest } from '../bridge/refresh/read.ts';
import type { Session } from '../forms/use-production.ts';
import { mergeMarks } from '../model/form-read.ts';
import { getAttr, parseXml, serializeXml } from '../model/xml.ts';
import {
  type PartAnswer,
  refreshNote,
  refreshNotice,
  type RefreshOutcome,
  refreshToast,
  runRefresh,
  stageText,
} from './lattes-refresh.ts';
import type { Notice } from './notifications.ts';
import { toasts } from './toasts.ts';
import { listenReplies, post } from './use-bridge.ts';

export const REFRESH_FEATURE = 'atualizar-do-lattes';

/** Uma parte leva até o prazo da tarefa na aba (150 s, transport.ts), mais a espera da vez. */
const REPLY_TIMEOUT_MS = 200_000;

type Reply = Extract<BridgeMessage, { type: 'leitura-lattes' }>;

let counter = 0;

export interface LattesRefresh {
  /** A extensão ligada sabe ler pelos formulários. */
  available: boolean;
  /** Uma leitura em andamento, para a barra do cabeçalho. */
  busy: boolean;
  /** O resultado que fica no sino: a parada, ou o que não foi lido. */
  notice?: Notice;
  start: () => void;
}

export function useLattesRefresh(
  features: readonly string[],
  session: Session | null,
  setSession: Dispatch<SetStateAction<Session | null>>,
  onEdit: (note: string) => void,
): LattesRefresh {
  const available = LATTES_REFRESH_ENABLED && features.includes(REFRESH_FEATURE);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<RefreshOutcome>();
  const running = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const editRef = useRef(onEdit);
  editRef.current = onEdit;
  const waiting = useRef(new Map<string, (msg: Reply) => void>());

  useEffect(
    () =>
      listenReplies((msg) => {
        if (msg.type !== 'leitura-lattes') return;
        const resolve = waiting.current.get(msg.id);
        if (!resolve) return;
        waiting.current.delete(msg.id);
        resolve(msg);
      }),
    [],
  );

  const ask = useCallback(
    (request: RefreshRequest) =>
      new Promise<PartAnswer>((resolve) => {
        const id = `ler-lattes-${Date.now()}-${++counter}`;
        const timer = setTimeout(() => {
          waiting.current.delete(id);
          resolve({ reason: 'sem-resposta' });
        }, REPLY_TIMEOUT_MS);
        waiting.current.set(id, ({ error, lattesId, part, reason }) => {
          clearTimeout(timer);
          resolve({ error, lattesId, part, reason });
        });
        post({ id, request, type: 'ler-lattes' });
      }),
    [],
  );

  const start = useCallback(() => {
    const first = sessionRef.current;
    if (running.current || !first) return;
    running.current = true;
    setBusy(true);
    setOutcome(undefined);
    const lattesId = getAttr(first.doc.root, 'NUMERO-IDENTIFICADOR');
    const toast = toasts.add({
      description: 'Lendo as listas do Lattes.',
      timeout: 0,
      title: 'Atualizando do Lattes',
    });
    void runRefresh({
      ask,
      commit: (base, merged) => {
        const s = sessionRef.current;
        if (!s) return;
        const next: Session = {
          doc: s.doc,
          meta: {
            ...s.meta,
            lattesForms: mergeMarks(s.meta.lattesForms, merged.marks),
            nextSequencia: Math.max(s.meta.nextSequencia, merged.counter),
            originalXml: serializeXml(base),
          },
        };
        // A parte seguinte já parte da exportação com esta.
        sessionRef.current = next;
        setSession(next);
        editRef.current(refreshNote(merged));
      },
      current: () => {
        const s = sessionRef.current;
        if (!s || getAttr(s.doc.root, 'NUMERO-IDENTIFICADOR') !== lattesId) return undefined;
        return {
          base: parseXml(s.meta.originalXml),
          counter: s.meta.nextSequencia,
          working: s.doc.root,
        };
      },
      lattesId,
      onStage: (stage) => toasts.update(toast, { description: stageText(stage) }),
    })
      .then((out) => {
        setOutcome(out);
        toasts.close(toast);
        toasts.add(refreshToast(out));
      })
      .finally(() => {
        running.current = false;
        setBusy(false);
      });
  }, [ask, setSession]);

  const notice = useMemo(() => refreshNotice(outcome), [outcome]);
  return { available, busy, notice, start };
}
