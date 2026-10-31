// As regras do painel "Enviar ao CNPq" (LAT-54), sem React: o formulário que
// começa com o que o Lattes tem, o que dizer enquanto o envio roda e depois,
// e o resumo da conferência do currículo antes de publicar. O painel está em
// PublishPanel.tsx; o envio, em src/bridge/publish.ts.

import type { LattesStatus } from '../bridge/lattes-status.ts';
import {
  PUBLISH_ENABLED,
  publishMessage,
  type PublishOutcome,
  type PublishRequest,
  type PublishResult,
  type PublishStep,
  type SendScreen,
} from '../bridge/publish.ts';
import type { SentEntry } from '../bridge/sent-log.ts';
import { openDivergences } from '../bridge/write-brake.ts';
import { unpublishedEntries } from '../ui/status-strip.ts';
import type { PublishReading, SendScreenReading } from '../ui/use-publish.ts';

/** O que a pessoa pode mudar antes de enviar; a declaração fica de fora, de propósito. */
export type PublishForm = Omit<PublishRequest, 'declarationAccepted' | 'declarationText'>;

/**
 * O formulário começa com o que a tela de envio do Lattes tem e com as
 * escolhas da última vez (publish-memory.ts): o idioma e a versão em inglês
 * da última vez valem quando a tela tem o controle (o idioma, se ainda for
 * uma das opções); os e-mails são os do Lattes, e os da última vez só entram
 * no campo que o Lattes trouxe vazio. Sem o controle na tela, nada é
 * presumido: o campo fica vazio ou desmarcado, e o envio é recusado
 * (missingControls, em src/bridge/publish.ts). A declaração não está aqui.
 */
export function initialForm(screen?: SendScreen, last: Partial<PublishForm> = {}): PublishForm {
  const options = screen?.language?.options ?? [];
  const lastLanguage = options.some((o) => o.value === last.language) ? last.language : undefined;
  return {
    emailAlternative: screen?.emailAlternative || (screen ? (last.emailAlternative ?? '') : ''),
    emailContact: screen?.emailContact || (screen ? (last.emailContact ?? '') : ''),
    english: screen?.english ? (last.english ?? screen.english.checked) : false,
    language: lastLanguage ?? screen?.language?.selected ?? '',
  };
}

/**
 * Os campos que começaram com a escolha da última vez, e não com o que o
 * Lattes trouxe, para o painel dizer de onde vieram.
 */
export function restoredFields(screen: SendScreen | undefined, form: PublishForm): string[] {
  const fromLattes = initialForm(screen);
  const names: [keyof PublishForm, string][] = [
    ['language', 'idioma principal'],
    ['english', 'versão em inglês'],
    ['emailContact', 'e-mail de contato'],
    ['emailAlternative', 'e-mail alternativo'],
  ];
  return names.filter(([k]) => form[k] !== fromLattes[k]).map(([, label]) => label);
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
// Acima do prazo da tarefa de envio na aba (PUBLISH_PACE, publish.ts).
export const PUBLISH_REPLY_TIMEOUT_MS = 270_000;

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

const REOPEN = ' Para tentar de novo, reabra este painel.';

const STEP_LABELS: Record<PublishStep['step'], string> = {
  conferencia: 'conferência no menu',
  emails: 'e-mails',
  envio: 'envio',
  espera: 'espera entre as conferências',
  menu: 'menu',
  'raca-cor': 'raça ou cor',
  tela: 'tela de envio',
};

const seconds = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

/** Onde o tempo do envio foi, passo a passo; vazio sem os tempos. */
export function stepsText(steps: readonly PublishStep[] | undefined): string {
  if (!steps?.length) return '';
  const total = steps.reduce((sum, s) => sum + s.ms, 0);
  const parts = steps.map((s) => `${STEP_LABELS[s.step]} ${seconds(s.ms)}`);
  return ` Tempo no Lattes: ${seconds(total)} (${parts.join(', ')}).`;
}

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
      text:
        publishMessage(reading.result) +
        (locked && !done ? REOPEN : '') +
        stepsText(reading.result.steps),
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
    // O envio observado levou 18 s em 14/10/2026 e mais de um minuto em
    // 28/10/2026: o tempo corrido mostra que ainda se espera o Lattes.
    text: `Esperando o Lattes responder (${Math.max(0, Math.round((now - attempt.at) / 1000))} s). Pode passar de um minuto; o editor confirma a publicação quando a resposta chegar.`,
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
      return 'A extensão continuou ocupada com outra tarefa no Lattes. Feche e abra este painel daqui a pouco.';
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

/** A linha dos achados da revisão do currículo antes de publicar. */
export function checksLine(count: number): string {
  if (count === 0) return 'A revisão do currículo não achou nada a conferir.';
  return count === 1
    ? 'A revisão do currículo achou 1 ponto que vale ver antes de publicar.'
    : `A revisão do currículo achou ${count} pontos que valem ver antes de publicar.`;
}

/** Quanto esperar a tela de envio: é um GET só. */
export const SCREEN_TIMEOUT_MS = 30_000;

/** A extensão ligada sabe ler a tela de envio (capacidade enviar-cnpq). */
export const canReadSendScreen = (features: readonly string[]): boolean =>
  features.includes('enviar-cnpq');

/** Extensões antigas anunciam a leitura, mas ainda recusam publicar. */
export const canSendCv = (features: readonly string[]): boolean =>
  features.includes('publicar-cnpq');

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

/**
 * As gravações divergentes que bloqueiam o envio ao CNPq (LAT-59): as que
 * ainda não foram publicadas e que ninguém resolveu (openDivergences, em
 * src/bridge/write-brake.ts). Sem a leitura do menu do Lattes, não dá para
 * saber o que já foi publicado, e todo o registro conta.
 */
export function publishBlockers(sent: SentEntry[], lattes: LattesStatus | undefined): SentEntry[] {
  return openDivergences(lattes ? unpublishedEntries(sent, lattes) : sent);
}
