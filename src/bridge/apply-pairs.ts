// Ler um formulário do Lattes como pares nome-valor e comparar dois envios:
// o que apply.ts usa para conferir o antes e a releitura.

import type { LattesPort, ResultStatus } from './apply.ts';
import {
  type FormControl,
  normalizeNewlines,
  type Pairs,
  pairValue,
  successfulPairs,
  withCheckRules,
  withScriptValues,
} from './form.ts';
import { isLogonPage } from './lattes-html.ts';
import type { FieldValues } from './plan.ts';

/** Uma parada da operação, com o estado que ela devolve. */
export class Stop extends Error {
  status: ResultStatus;
  constructor(status: ResultStatus, detail: string) {
    super(detail);
    this.status = status;
  }
}

export async function getChecked(port: LattesPort, path: string): Promise<string> {
  const html = await port.get(path);
  if (isLogonPage(html, path))
    throw new Stop('sessao', 'A sessão do Lattes expirou; entre de novo');
  return html;
}

export async function readPairs(
  port: LattesPort,
  path: string,
  form: string,
): Promise<{ controls: FormControl[]; html: string; pairs: Pairs }> {
  const html = await getChecked(port, path);
  const controls = withScriptValues(html, port.readForm(html, form));
  if (!controls) {
    throw isLogonPage(html)
      ? new Stop('sessao', 'A sessão do Lattes expirou; entre de novo')
      : new Stop('erro', `Formulário ${form} não encontrado`);
  }
  return { controls, html, pairs: withCheckRules(form, controls, successfulPairs(controls)) };
}

export const same = (a: string | null, b: string | null) =>
  a === b || (a !== null && b !== null && normalizeNewlines(a) === normalizeNewlines(b));

export function mismatches(pairs: Pairs, values: FieldValues): string[] {
  return Object.entries(values)
    .filter(([name, v]) => !same(pairValue(pairs, name), v))
    .map(([name]) => name);
}

/** Campos que mudaram entre dois envios (por nome). */
export function changedNames(a: Pairs, b: Pairs): string[] {
  const names = new Set([...a, ...b].map(([k]) => k));
  return [...names].filter((n) => !same(pairValue(a, n), pairValue(b, n)));
}
