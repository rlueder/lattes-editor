// O tempo do envio ao CNPq (publish.ts): os prazos e o passo da tarefa, e uma
// porta que anota quanto levou cada pedido, pelo procedimento, e as esperas
// entre as conferências do menu, para o painel dizer onde o tempo foi.

import type { PublishPort } from './publish.ts';

/**
 * O prazo do GET de envio: ele levou 18 s em 14/10/2026 e mais de um minuto em
 * 28/10/2026, acima dos 20 s de um pedido comum (transport.ts). Cortado no
 * meio, o envio podia ter entrado e o editor não conferia o menu.
 */
export const SEND_TIMEOUT_MS = 180_000;

/**
 * A tarefa do envio na aba: sem a espera entre pedidos (são uns dez, um de
 * cada vez) e com prazo para o envio lento e a conferência depois dele.
 */
export const PUBLISH_PACE = { deadlineMs: 240_000, spacingMs: 0 };

export interface PublishStep {
  ms: number;
  step: 'conferencia' | 'emails' | 'envio' | 'espera' | 'menu' | 'raca-cor' | 'tela';
}

/** O passo de cada pedido, pelo procedimento. */
function stepOf(path: string, sentAlready: boolean): PublishStep['step'] {
  if (/^pkg_publicar\.enviar/i.test(path)) return 'envio';
  if (/^pkg_publicar\.mostrar_cv/i.test(path)) return 'tela';
  if (/racapreenchida/i.test(path)) return 'raca-cor';
  if (/existe_email/i.test(path)) return 'emails';
  return sentAlready ? 'conferencia' : 'menu';
}

/** A porta que anota o tempo de cada pedido (e das esperas) em steps. */
export function timed(
  port: PublishPort,
  wait: (ms: number) => Promise<void>,
  now: () => number,
  steps: PublishStep[],
): { port: PublishPort; wait: (ms: number) => Promise<void> } {
  let sent = false;
  const add = (step: PublishStep['step'], ms: number) => {
    const last = steps.at(-1);
    // Pedidos seguidos do mesmo passo (os dois e-mails, as releituras) somam.
    if (last?.step === step) last.ms += ms;
    else steps.push({ ms, step });
  };
  const time = async <T>(step: PublishStep['step'], work: () => Promise<T>): Promise<T> => {
    const start = now();
    try {
      return await work();
    } finally {
      add(step, now() - start);
      if (step === 'envio') sent = true;
    }
  };
  return {
    port: {
      get: (path, options) => time(stepOf(path, sent), () => port.get(path, options)),
      post: (path, body) => time(stepOf(path, sent), () => port.post(path, body)),
    },
    wait: (ms) => time('espera', () => wait(ms)),
  };
}
