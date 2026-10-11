// Ligação do editor com a extensão da ponte: descobre se ela está instalada
// (aperto de mão por postMessage), planeja as alterações que ela sabe levar,
// manda a fila e acompanha os resultados. Também recebe o código do
// currículo, que a extensão lê no Lattes, para a foto do perfil.

import { useEffect, useMemo, useRef, useState } from 'react';

import type { OpResult } from '../bridge/apply.ts';
import { sameCv } from '../bridge/lattes-html.ts';
import { planChanges } from '../bridge/plan.ts';
import {
  type EditorMessage,
  editorMessage,
  fromSamePage,
  isBridgeMessage,
} from '../bridge/protocol.ts';
import type { Session } from '../forms/use-production.ts';
import { encodeCv } from '../model/document.ts';
import { getAttr, parseXml } from '../model/xml.ts';
import { backupFileName, downloadBytes } from './backup.ts';
import type { ChangeGroup } from './changes-view.ts';
import { writeCvCode } from './profile.ts';

/** Evento da janela avisando que um novo código do currículo foi guardado. */
export const CV_CODE_EVENT = 'lattes-editor:codigo-cv';

const post = (msg: EditorMessage) => window.postMessage(editorMessage(msg), location.origin);

export interface BridgeState {
  available: boolean;
  /** Quantas alterações foram gravadas e conferidas desde o último envio. */
  confirmed: number;
  /** Alterações que a extensão sabe levar e as que ficam para copiar à mão. */
  plan: ReturnType<typeof planChanges>;
  results: Record<string, OpResult>;
  running: boolean;
  /** backup: baixa antes uma cópia do currículo como está no Lattes. */
  send: (options?: { backup?: boolean }) => void;
  stop: () => void;
}

export function useBridge(
  session: Session | null,
  groups: ChangeGroup[],
  onConfirmed: (key: string) => void,
): BridgeState {
  const confirmedRef = useRef(onConfirmed);
  confirmedRef.current = onConfirmed;
  const [confirmed, setConfirmed] = useState(0);
  const [available, setAvailable] = useState(false);
  const [results, setResults] = useState<Record<string, OpResult>>({});
  const [running, setRunning] = useState(false);
  const lattesId = session ? getAttr(session.doc.root, 'NUMERO-IDENTIFICADOR') : undefined;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!fromSamePage(event, { origin: location.origin, window })) return;
      if (!isBridgeMessage(event.data)) return;
      const msg = event.data;
      if (msg.type === 'ola') setAvailable(true);
      if (msg.type === 'resultado') {
        setResults((r) => ({ ...r, [msg.result.key]: msg.result }));
        if (msg.result.status === 'conferido') {
          setConfirmed((n) => n + 1);
          confirmedRef.current(msg.result.key);
        }
      }
      if (msg.type === 'fim') setRunning(false);
      // Só guarda o código se ele for deste currículo (a sessão do Lattes pode ser de outro).
      if (msg.type === 'codigo-cv' && lattesId && sameCv(lattesId, msg.lattesId)) {
        writeCvCode(lattesId, msg.code);
        window.dispatchEvent(new Event(CV_CODE_EVENT));
      }
    };
    window.addEventListener('message', onMessage);
    post({ type: 'ola' });
    return () => window.removeEventListener('message', onMessage);
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
    confirmed,
    plan,
    results,
    running,
    send: ({ backup = false } = {}) => {
      if (backup && session) {
        const original = parseXml(session.meta.originalXml);
        downloadBytes(
          encodeCv(original, session.meta.encoding),
          backupFileName(session.meta.fileName, new Date()),
        );
      }
      setResults({});
      setConfirmed(0);
      setRunning(true);
      post({ lattesId, ops: plan.ops, type: 'enviar' });
    },
    stop: () => post({ type: 'parar' }),
  };
}
