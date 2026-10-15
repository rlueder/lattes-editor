// A tela de envio ao CNPq e o envio (LAT-54, src/bridge/publish.ts), pedidos
// à extensão e respondidos com o mesmo id. Fica fora de use-bridge.ts: só o
// painel "Enviar ao CNPq" usa, e só enquanto está aberto.

import { useEffect, useState } from 'react';

import { sameCv } from '../bridge/lattes-html.ts';
import type { SendScreenFailure } from '../bridge/protocol.ts';
import {
  localDay,
  type PublishRequest,
  type PublishResult,
  type SendScreen,
} from '../bridge/publish.ts';
import { listenReplies, post } from './use-bridge.ts';

export interface SendScreenReading {
  /** Quando a resposta chegou (ms). */
  at: number;
  detail?: string;
  /** O id do pedido que a resposta atende. */
  id: string;
  /** Os endereços da página de conferência em português e em inglês. */
  previews?: { en: string; pt: string };
  reason?: SendScreenFailure | 'outro-cv';
  screen?: SendScreen;
}

export interface PublishReading {
  /** Quando a resposta chegou (ms). */
  at: number;
  /** O id do pedido que a resposta atende. */
  id: string;
  result: PublishResult;
}

export interface PublishBridge {
  /**
   * Pede o envio ao CNPq, com o que a pessoa confirmou no painel, inclusive a
   * declaração que só ela marca. Devolve o id do pedido, que volta em result.
   */
  publish: (request: PublishRequest) => string;
  /** Pede a tela de envio (só leitura); devolve o id, que volta em screen. */
  requestScreen: () => string;
  /** A resposta do último envio. */
  result?: PublishReading;
  /** A tela de envio lida pela extensão, ou o motivo de não ter lido. */
  screen?: SendScreenReading;
}

/** lattesId: o currículo aberto no editor; a tela e o envio só valem para ele. */
export function usePublish(lattesId: string | undefined): PublishBridge {
  const [screen, setScreen] = useState<SendScreenReading | undefined>();
  const [result, setResult] = useState<PublishReading | undefined>();

  useEffect(
    () =>
      listenReplies((msg) => {
        if (msg.type === 'tela-envio') {
          // A tela de outro currículo não serve: a declaração e os e-mails são de outra pessoa.
          const other = msg.screen && !(lattesId && sameCv(lattesId, msg.lattesId));
          setScreen({
            at: Date.now(),
            detail: other ? 'A sessão aberta no Lattes é de outro currículo.' : msg.detail,
            id: msg.id,
            previews: other ? undefined : msg.previews,
            reason: other ? 'outro-cv' : msg.reason,
            screen: other ? undefined : msg.screen,
          });
        }
        if (msg.type === 'publicacao')
          setResult({ at: Date.now(), id: msg.id, result: msg.result });
      }),
    [lattesId],
  );

  return {
    publish: (request) => {
      const id = `publicar-${Date.now()}`;
      post({ id, lattesId, request, today: localDay(new Date()), type: 'publicar' });
      return id;
    },
    requestScreen: () => {
      const id = `tela-envio-${Date.now()}`;
      post({ id, type: 'ler-envio' });
      return id;
    },
    result,
    screen,
  };
}
