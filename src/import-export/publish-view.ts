// As regras do painel "Enviar ao CNPq" (LAT-54), sem React: o formulário que
// começa com o que o Lattes tem, o que dizer enquanto o envio roda e depois,
// e o resumo da conferência do currículo antes de publicar. O painel está em
// PublishPanel.tsx; o envio, em src/bridge/publish.ts.

import {
  OBSERVED_LANGUAGE,
  PUBLISH_ENABLED,
  publishMessage,
  type PublishRequest,
  type SendScreen,
} from '../bridge/publish.ts';
import type { PublishReading, SendScreenReading } from '../ui/use-publish.ts';

/** O que a pessoa pode mudar antes de enviar; a declaração fica de fora, de propósito. */
export type PublishForm = Omit<PublishRequest, 'declarationAccepted'>;

/**
 * O formulário começa com o que a tela de envio do Lattes tem. Sem o
 * controle na tela, vale o que foi observado no envio de 14/10/2026
 * (português, versão em inglês autorizada); sem e-mail, o campo fica vazio.
 */
export function initialForm(screen?: SendScreen): PublishForm {
  return {
    emailAlternative: screen?.emailAlternative ?? '',
    emailContact: screen?.emailContact ?? '',
    english: screen?.english?.checked ?? true,
    language: screen?.language ? (screen.language.selected ?? '') : OBSERVED_LANGUAGE,
  };
}

/**
 * O pedido que vai à extensão. declared vem da caixa que a pessoa marcou
 * neste painel, agora; nada mais a põe em true.
 */
export function publishRequest(form: PublishForm, declared: boolean): PublishRequest {
  return { ...form, declarationAccepted: declared };
}

/** Quanto esperar a resposta do envio: o Lattes levou uns 18 s, e o menu é relido depois. */
export const PUBLISH_REPLY_TIMEOUT_MS = 120_000;

export interface PublishAttempt {
  at: number;
  id: string;
}

export interface PublishStatus {
  busy: boolean;
  /** Publicado e conferido no menu. */
  done: boolean;
  text?: string;
}

/** Em que pé está o envio pedido, pela resposta com o mesmo id ou pelo prazo. */
export function publishStatus(
  attempt: PublishAttempt | undefined,
  reading: PublishReading | undefined,
  now: number,
): PublishStatus {
  if (!attempt) return { busy: false, done: false };
  if (reading?.id === attempt.id) {
    return {
      busy: false,
      done: reading.result.outcome === 'publicado',
      text: publishMessage(reading.result),
    };
  }
  if (now - attempt.at >= PUBLISH_REPLY_TIMEOUT_MS) {
    return {
      busy: false,
      done: false,
      text: 'A extensão não respondeu. Confira a "Última publicação" no menu do Lattes antes de tentar de novo.',
    };
  }
  return {
    busy: true,
    done: false,
    text: 'Enviando ao CNPq. O Lattes leva uns 20 segundos para responder; depois, o editor confere no menu.',
  };
}

/** O que dizer quando a tela de envio não veio. */
export function sendScreenProblem(
  reading: Pick<SendScreenReading, 'detail' | 'reason'> | undefined,
): string | undefined {
  if (!reading?.reason) return undefined;
  switch (reading.reason) {
    case 'consentimento':
      return 'Aceite o aviso da extensão para o editor ler a tela de envio do Lattes.';
    case 'sem-aba':
      return 'Abra o seu currículo no Lattes numa aba deste navegador.';
    case 'sessao':
      return 'A sessão do Lattes caiu. Entre de novo e reabra este painel.';
    case 'ocupado':
      return 'A extensão está gravando no Lattes. Reabra este painel quando terminar.';
    case 'mudou':
      return 'A tela de envio do Lattes não está como o editor espera. Envie pelo Lattes.';
    default:
      return reading.detail ?? 'O editor não conseguiu ler a tela de envio do Lattes.';
  }
}

/**
 * O envio pelo editor está ligado. Em desenvolvimento, ?publicar na URL mostra
 * a caixa e o botão para ver o painel; a extensão continua recusando enquanto
 * PUBLISH_ENABLED for false.
 */
export function publishUiEnabled(search: string, dev: boolean): boolean {
  return PUBLISH_ENABLED || (dev && new URLSearchParams(search).has('publicar'));
}

/** A linha dos achados do diagnóstico do currículo antes de publicar. */
export function checksLine(count: number): string {
  if (count === 0) return 'O diagnóstico do currículo não achou nada a conferir.';
  return count === 1
    ? 'O diagnóstico do currículo achou 1 ponto que vale ver antes de publicar.'
    : `O diagnóstico do currículo achou ${count} pontos que valem ver antes de publicar.`;
}
