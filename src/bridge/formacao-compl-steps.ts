// A formação complementar grava em dois passos (observado em 27/10/2026, no
// Lattes real, pela própria página: docs/lattes_internals.md, seção 16). O
// POST de PKG_FORMACAO_COMPL.FORM2 com o f_ctr vazio do formulário de edição
// não grava nada: responde com outro GN_FORMACAO2, com f_ctr U, que traz os
// valores do primeiro passo em ocultos e os campos do segundo (anos, bolsa,
// agência, monografia, orientador, visibilidade e as grades). Só o POST
// desse segundo formulário grava, e a resposta diz "A operação foi realizada
// com sucesso". A releitura dos campos do segundo passo refaz o primeiro
// passo e lê o segundo sem enviá-lo.

import { mismatches } from './apply-pairs.ts';
import { encodeLatin1Form, type Pairs, pairValue, setPairs, successfulPairs } from './form.ts';
import { isLogonPage } from './lattes-html.ts';
import type { FieldValues } from './plan.ts';

/** A resposta da gravação no segundo passo (observada em 27/10/2026). */
const SAVED = /realizada com sucesso/i;

const FORM = 'GN_FORMACAO2';
const ACTION = 'PKG_FORMACAO_COMPL.FORM2';

interface StepPort {
  post(path: string, body: string): Promise<string>;
  readForm(html: string, formName: string): Parameters<typeof successfulPairs>[0] | undefined;
}

/** O que o primeiro passo devolveu: os pares do segundo, como a página os mandaria. */
export function secondStep(port: StepPort, html: string): Pairs | undefined {
  const controls = port.readForm(html, FORM);
  if (!controls) return undefined;
  const pairs = successfulPairs(controls);
  return pairValue(pairs, 'f_ctr') === 'U' ? pairs : undefined;
}

export type StepResult =
  { ok: true } | { detail: string; status: 'divergente' | 'erro' | 'sessao' };

/**
 * Termina a gravação: confere o "antes" dos campos do segundo passo, troca o
 * que mudou e envia. O primeiro passo já foi; ele sozinho não grava nada
 * (observado em 20/10/2026, num MBA de teste, sem o segundo passo).
 */
export async function finishSecondStep(
  port: StepPort,
  firstResponse: string,
  op: { kind: string; step2?: { expect: FieldValues; set: FieldValues } },
): Promise<StepResult> {
  // Os outros formulários gravam no primeiro POST.
  if (op.kind !== 'formacao-complementar') return { ok: true };
  const step2 = op.step2 ?? { expect: {}, set: {} };
  if (isLogonPage(firstResponse)) {
    return { detail: 'A sessão do Lattes expirou; entre de novo', status: 'sessao' };
  }
  const pairs = secondStep(port, firstResponse);
  if (!pairs) {
    return {
      detail:
        'O Lattes não mostrou o segundo passo da formação complementar; nada foi gravado. Confira no Lattes',
      status: 'divergente',
    };
  }
  const wrong = mismatches(pairs, step2.expect);
  if (wrong.length > 0) {
    return {
      detail: `O Lattes não está como o editor espera: ${wrong.join(', ')}; nada foi gravado`,
      status: 'divergente',
    };
  }
  const response = await port.post(ACTION, encodeLatin1Form(setPairs(pairs, step2.set)));
  if (isLogonPage(response)) {
    return {
      detail: 'A sessão do Lattes expirou no meio da gravação; confira no Lattes',
      status: 'sessao',
    };
  }
  if (!SAVED.test(response)) {
    return {
      detail: 'O Lattes não confirmou a gravação da formação complementar; confira no Lattes',
      status: 'divergente',
    };
  }
  return { ok: true };
}

/**
 * A releitura do segundo passo: o primeiro passo de novo, com o formulário de
 * edição como está agora, e o segundo lido sem enviar.
 */
export async function readSecondStep(port: StepPort, editPairs: Pairs): Promise<Pairs | undefined> {
  return secondStep(port, await port.post(ACTION, encodeLatin1Form(editPairs)));
}

/** Os campos do segundo passo que a releitura não achou com o valor enviado. */
export async function secondStepMisses(
  port: StepPort,
  editPairs: Pairs,
  step2: { set: FieldValues } | undefined,
): Promise<string[]> {
  if (!step2) return [];
  const second = await readSecondStep(port, editPairs);
  return second ? mismatches(second, step2.set) : Object.keys(step2.set);
}
