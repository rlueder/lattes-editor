// As regras do painel "Enviar ao CNPq" (LAT-54), sem React: o formulário que
// começa com o que o Lattes tem, o que dizer enquanto o envio roda e depois,
// e o resumo da conferência do currículo antes de publicar. O painel está em
// PublishPanel.tsx; o envio, em src/bridge/publish.ts.

import {
  PUBLISH_ENABLED,
  publishMessage,
  type PublishOutcome,
  type PublishRequest,
  type PublishResult,
  type SendScreen,
} from '../bridge/publish.ts';
import type { PublishReading, SendScreenReading } from '../ui/use-publish.ts';

/** O que a pessoa pode mudar antes de enviar; a declaração fica de fora, de propósito. */
export type PublishForm = Omit<PublishRequest, 'declarationAccepted' | 'declarationText'>;

/**
 * O formulário começa com o que a tela de envio do Lattes tem. Sem o
 * controle na tela, nada é presumido: o campo fica vazio ou desmarcado, e o
 * envio é recusado (missingControls, em src/bridge/publish.ts).
 */
export function initialForm(screen?: SendScreen): PublishForm {
  return {
    emailAlternative: screen?.emailAlternative ?? '',
    emailContact: screen?.emailContact ?? '',
    english: screen?.english?.checked ?? false,
    language: screen?.language?.selected ?? '',
  };
}

/**
 * O pedido que vai à extensão. declared vem da caixa que a pessoa marcou
 * neste painel, agora; nada mais a põe em true. declarationText é o texto
 * que ela leu ao marcar, conferido de novo com a tela no envio.
 */
export function publishRequest(
  form: PublishForm,
  declared: boolean,
  declarationText: string,
): PublishRequest {
  return { ...form, declarationAccepted: declared, declarationText };
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
  /**
   * O botão não volta neste painel: o envio terminou, ou pode ter saído sem
   * confirmação. Para tentar de novo, fecha e abre o painel, que relê o menu
   * e a tela; e o envio confere de novo a pendência antes de sair.
   */
  locked: boolean;
  text?: string;
}

/** Resultados em que, com certeza, nada saiu para o Lattes: dá para corrigir e enviar de novo. */
const BEFORE_SENDING = new Set<PublishOutcome>([
  'consentimento',
  'declaracao',
  'desligado',
  'email',
  'mudou',
  'nada-a-publicar',
  'outro-cv',
  'raca-cor',
  'sem-aba',
]);

/** O resultado deixa o envio em aberto (ou já publicou): o botão trava até reabrir. */
export function locksSending(result: PublishResult): boolean {
  return result.sent === true || !BEFORE_SENDING.has(result.outcome);
}

const REOPEN = ' Para tentar de novo, feche e abra este painel.';

/** Em que pé está o envio pedido, pela resposta com o mesmo id ou pelo prazo. */
export function publishStatus(
  attempt: PublishAttempt | undefined,
  reading: PublishReading | undefined,
  now: number,
): PublishStatus {
  if (!attempt) return { busy: false, done: false, locked: false };
  if (reading?.id === attempt.id) {
    const done = reading.result.outcome === 'publicado';
    const locked = locksSending(reading.result);
    return {
      busy: false,
      done,
      locked,
      text: publishMessage(reading.result) + (locked && !done ? REOPEN : ''),
    };
  }
  if (now - attempt.at >= PUBLISH_REPLY_TIMEOUT_MS) {
    return {
      busy: false,
      done: false,
      locked: true,
      text: `A extensão não respondeu. Confira a "Última publicação" no menu do Lattes.${REOPEN}`,
    };
  }
  return {
    busy: true,
    done: false,
    locked: true,
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
      return `${reading.detail ?? 'A tela de envio do Lattes não está como o editor espera.'} Envie pelo Lattes.`;
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

/** Quanto esperar a tela de envio: é um GET só. */
export const SCREEN_TIMEOUT_MS = 30_000;

/** A extensão ligada sabe ler a tela de envio (capacidade enviar-cnpq). */
export const canReadSendScreen = (features: readonly string[]): boolean =>
  features.includes('enviar-cnpq');

/**
 * Em que pé está a leitura da tela de envio: esperando, ou o que dizer.
 * Sem a capacidade, o pedido nem sai; sem resposta no prazo, não fica
 * esperando para sempre.
 */
export function sendScreenStatus({
  features,
  now,
  reading,
  requestedAt,
}: {
  features: readonly string[];
  now: number;
  reading?: Pick<SendScreenReading, 'detail' | 'reason'>;
  requestedAt?: number;
}): { problem?: string; waiting: boolean } {
  if (!canReadSendScreen(features)) {
    return {
      problem:
        'A extensão ligada não lê a tela de envio do CNPq. Atualize a extensão, ou envie pelo Lattes.',
      waiting: false,
    };
  }
  if (reading) return { problem: sendScreenProblem(reading), waiting: false };
  if (requestedAt !== undefined && now - requestedAt >= SCREEN_TIMEOUT_MS) {
    return {
      problem: 'A extensão não respondeu ao pedido da tela de envio. Feche e abra este painel.',
      waiting: false,
    };
  }
  return { waiting: requestedAt !== undefined };
}
