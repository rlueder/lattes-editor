// A formação complementar grava em dois passos (observado em 27/10/2026, no
// Lattes real, pela própria página: docs/lattes_internals.md, seção 16). O
// POST de PKG_FORMACAO_COMPL.FORM2 com o f_ctr vazio do formulário de edição
// não grava nada: responde com outro GN_FORMACAO2, com f_ctr U, que traz os
// valores do primeiro passo em ocultos e os campos do segundo (anos, bolsa,
// agência, monografia, orientador, visibilidade e as grades). Só o POST
// desse segundo formulário grava, e a resposta diz "A operação foi realizada
// com sucesso". A releitura dos campos do segundo passo refaz o primeiro
// passo e lê o segundo sem enviá-lo.

import type { Change } from '../model/changes.ts';
import { mismatches } from './apply-pairs.ts';
import { jsCalls, sameCode } from './create-shared.ts';
import type { Step2 } from './edit-lists.ts';
import { encodeLatin1Form, type Pairs, pairValue, setPairs, successfulPairs } from './form.ts';
import { isLogonPage } from './lattes-html.ts';
import type { FieldValues } from './plan.ts';

/** A resposta da gravação no segundo passo (observada em 27/10/2026). */
const SAVED = /realizada com sucesso/i;

/** Os atributos da agência da formação complementar, que saem da busca de agências. */
export const AGENCY_CODE = 'CODIGO-AGENCIA-FINANCIADORA';
export const AGENCY_NAME = 'NOME-AGENCIA';

const FORM = 'GN_FORMACAO2';
const ACTION = 'PKG_FORMACAO_COMPL.FORM2';

interface StepPort {
  get(path: string): Promise<string>;
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
  op: { kind: string; step2?: Step2 },
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
  const agency = step2.agency ? await agencyValues(port, pairs, step2.agency) : { set: {} };
  if (!('set' in agency)) return agency;
  // A bolsa da própria mudança vale sobre a que a busca de agências marca.
  const set = { ...agency.set, ...step2.set };
  const response = await port.post(ACTION, encodeLatin1Form(setPairs(pairs, set)));
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
 * Os ocultos que o atribuir() da busca de agências escreve (f_agencia, e a
 * bolsa marcada, como agencia() faz), conferindo antes que o Lattes tem a
 * agência que o editor tinha. f_nme_agencia vem desabilitado e não vai.
 */
async function agencyValues(
  port: StepPort,
  pairs: Pairs,
  want: NonNullable<Step2['agency']>,
): Promise<{ set: FieldValues } | Exclude<StepResult, { ok: true }>> {
  const now = pairValue(pairs, 'f_agencia') ?? '';
  if (want.before ? !sameCode(now, want.before) : now !== '') {
    return {
      detail: 'O Lattes não está como o editor espera: Agência financiadora; nada foi gravado',
      status: 'divergente',
    };
  }
  if (!want.code) return { set: { f_agencia: '' } };
  const cv = pairValue(pairs, 'f_cod') ?? '';
  const html = await port.get(`prc_agencia?f_cod=${cv}`);
  if (isLogonPage(html)) {
    return { detail: 'A sessão do Lattes expirou; entre de novo', status: 'sessao' };
  }
  const found = jsCalls(html, 'atribuir').filter((args) => sameCode(args[0], want.code));
  if (found.length !== 1) {
    return {
      detail: `Agência não encontrada na lista do Lattes (${found.length} achadas); nada foi gravado`,
      status: 'erro',
    };
  }
  return { set: { f_agencia: found[0]![0]!, F_BOLSA: 'S' } };
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
  step2: Pick<Step2, 'agency' | 'set'> | undefined,
): Promise<string[]> {
  if (!step2) return [];
  const second = await readSecondStep(port, editPairs);
  const agency = step2.agency ? ['f_agencia'] : [];
  if (!second) return [...Object.keys(step2.set), ...agency];
  const now = pairValue(second, 'f_agencia') ?? '';
  const agencyOk = !step2.agency || (step2.agency.code ? sameCode(now, step2.agency.code) : !now);
  return [...mismatches(second, step2.set), ...(agencyOk ? [] : agency)];
}

/**
 * A agência da formação complementar (só o MBA a tem no XSD): sai da busca de
 * agências do segundo passo (agencia(), que abre prc_agencia?f_cod=<código do
 * currículo>, lida em 27/10/2026), a mesma das orientações e bancas. O nome
 * trocado sem o código não tem como ir.
 */
export function planAgency(change: Change): { before: string; code: string } | string | undefined {
  const code = change.fields.find((f) => f.attr === AGENCY_CODE);
  const name = change.fields.find((f) => f.attr === AGENCY_NAME);
  if (!code && !name) return undefined;
  if (!code) {
    return name!.after
      ? `${name!.label}: escolha a agência pela lista do Lattes, que grava o código junto`
      : `${name!.label}: para tirar a agência, tire também o código dela`;
  }
  return { before: code.before, code: code.after };
}
