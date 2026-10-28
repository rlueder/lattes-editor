// O efeito de "Carregar do Lattes" (lattes-load.ts): com a extensão que sabe
// ('carregar-do-lattes'), o pedido do currículo ao abrir e ao recarregar
// monta o XML pelas listas e pelos formulários, e a resposta chega no mesmo
// formato da do Exportar. Sem a capacidade, segue a exportação.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { bridgeLoadPort, type LoadAnswer } from '../bridge/load/bridge-port.ts';
import { loadCvFromLattes } from '../bridge/load/loader.ts';
import type { BridgeMessage } from '../bridge/protocol.ts';
import { LATTES_LOAD_ENABLED } from '../bridge/refresh/enabled.ts';
import type { RefreshRequest } from '../bridge/refresh/read.ts';
import type { CurriculoReading } from './bridge-readings.ts';
import { LOAD_FEATURE, loadNotice, loadReply, progressText } from './lattes-load.ts';
import type { CvSource } from './lattes-open.ts';
import type { Notice } from './notifications.ts';
import { toasts } from './toasts.ts';
import { type BridgeState, listenReplies, post } from './use-bridge.ts';

/** Uma parte leva até o prazo da tarefa na aba (150 s, transport.ts), mais a espera da vez. */
const REPLY_TIMEOUT_MS = 200_000;

type Reply = Extract<BridgeMessage, { type: 'leitura-lattes' }>;

let counter = 0;

/** A leitura toda: as partes têm o próprio prazo (REPLY_TIMEOUT_MS), e uma parte parada encerra a leitura. */
const LOAD_TIMEOUT_MS = 60 * 60_000;

export interface LattesLoad {
  /** O que não veio na última leitura, para o sino. */
  notice?: Notice;
  /** A fonte do currículo para abrir e recarregar: os formulários, ou a exportação. */
  source: CvSource;
}

export function useLattesLoad(bridge: CvSource & Pick<BridgeState, 'features'>): LattesLoad {
  const available = LATTES_LOAD_ENABLED && bridge.features.includes(LOAD_FEATURE);
  const [curriculo, setCurriculo] = useState<CurriculoReading | undefined>();
  const [notice, setNotice] = useState<Notice | undefined>();
  const waiting = useRef(new Map<string, (msg: Reply) => void>());
  const running = useRef(false);

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
      new Promise<LoadAnswer>((resolve) => {
        const id = `carregar-lattes-${Date.now()}-${++counter}`;
        const timer = setTimeout(() => {
          waiting.current.delete(id);
          resolve({ error: 'A extensão não respondeu.', reason: 'sem-resposta' });
        }, REPLY_TIMEOUT_MS);
        waiting.current.set(id, ({ error, lattesId, part, reason }) => {
          clearTimeout(timer);
          resolve({ error, lattesId, part, reason });
        });
        post({ id, request, type: 'ler-lattes' });
      }),
    [],
  );

  const requestCv = useCallback(
    (id: string) => {
      if (running.current) return;
      running.current = true;
      const toast = toasts.add({
        description: 'Lendo o menu do currículo.',
        timeout: 0,
        title: 'Carregando do Lattes',
      });
      const port = bridgeLoadPort(ask);
      void loadCvFromLattes(port, {
        onProgress: (p) => toasts.update(toast, { description: progressText(p) }),
      })
        .then((result) => {
          setNotice(result.doc && !result.stopped ? loadNotice(result.gaps) : undefined);
          setCurriculo(loadReply(id, result, port.failure(), Date.now()));
        })
        .catch((err: unknown) => {
          setCurriculo({
            at: Date.now(),
            detail: err instanceof Error ? err.message : undefined,
            id,
            reason: 'erro',
          });
        })
        .finally(() => {
          running.current = false;
          toasts.close(toast);
        });
    },
    [ask],
  );

  const source = useMemo<CvSource>(
    () =>
      available
        ? {
            curriculo,
            // Abrir e recarregar pedem a capacidade do Exportar (lattes-open.ts).
            link: {
              ...bridge.link,
              features: [...new Set([...(bridge.link.features ?? []), 'curriculo'])],
            },
            ownProgress: true,
            requestCv,
            timeoutMs: LOAD_TIMEOUT_MS,
          }
        : { curriculo: bridge.curriculo, link: bridge.link, requestCv: bridge.requestCv },
    [available, bridge.curriculo, bridge.link, bridge.requestCv, curriculo, requestCv],
  );

  return { notice: available ? notice : undefined, source };
}
