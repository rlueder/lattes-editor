// Preenchimento executado dentro do quadro de origem opaca, sem acessar o menu.
import {
  consistencyFixes,
  pickOption,
  type TestJob,
  textValue,
} from '../../src/census/test-plan.ts';
import type { FrameWindow } from './censo-frame-protocol.ts';
import { context, PLACELESS, setFields } from './censo-test-donors.ts';
import { pageValues } from './censo-test-pages.ts';

/** A sua linha na grade de autores (o check() exige), copiada do autorDP do menu. */
export function addOwner(w: FrameWindow, owner?: Record<string, string>): void {
  const grid = w.autorGrid?.getProvider();
  if (!owner || !grid) return;
  // Na equipe de um projeto, a coluna tit marca o coordenador (s).
  const team = !!w.document.forms.namedItem('GN_PROJETO');
  const row = Object.fromEntries([
    ['l', owner.l],
    ['c', ''],
    ['t', owner.t],
    ...(team ? [['tit', 's']] : []),
    ['editable', false],
    ['deletable', true],
  ]);
  if (grid.length && Object.keys(grid[0]!).length === 0) grid.splice(0, 0, row);
  else grid.unshift(row);
}

type Field = HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement;

/** Campo com nome e habilitado. O quadro é de outro documento: nada de instanceof. */
const editable = (el: Element): el is Field => !!(el as Field).name && !(el as Field).disabled;
const isInput = (el: Field, ...types: string[]) =>
  el.tagName === 'INPUT' && types.includes(el.type);

/** Rádios primeiro (eles trocam opções e habilitam campos), depois escolhas e textos. */
export function fill(w: FrameWindow, form: HTMLFormElement, job: TestJob): Record<string, string> {
  const values: Record<string, string> = {};
  const fields = () => [...form.elements].filter(editable);
  const groups = new Map<string, Field[]>();
  for (const el of fields()) {
    if (isInput(el, 'radio')) groups.set(el.name, [...(groups.get(el.name) ?? []), el]);
  }
  for (const [name, group] of groups) {
    const chosen = group[job.variant % group.length]!;
    chosen.click();
    values[name] = chosen.value;
  }
  for (const el of fields()) {
    if (el.name === 'f_tipo_privacidade') continue;
    if (isInput(el, 'checkbox')) {
      // Num grupo de caixas, a primeira sempre marcada (o check() pede uma).
      const group = fields().filter((x) => isInput(x, 'checkbox') && x.name === el.name);
      const first = group.length > 1 && group[0] === el;
      if (!el.checked && (first || job.variant % 2 === 0)) el.click();
      values[el.name] = el.checked ? el.value || 'on' : '';
    } else if (el.tagName === 'SELECT' && el.type === 'select-one') {
      const opts = [...el.options].map((o) => ({ text: o.text, value: o.value }));
      // O vínculo da atuação sai da janela da página (pageValues).
      if (el.name === 'f_stavinc') continue;
      const pick = pickOption(el.name, opts, job.variant);
      if (!pick) continue;
      el.value = pick.value;
      el.dispatchEvent(new (w as unknown as typeof globalThis).Event('change', { bubbles: true }));
      values[el.name] = pick.value;
    }
  }
  for (const el of fields()) {
    const text = el.tagName === 'TEXTAREA' || isInput(el, '', 'text', 'email', 'url', 'number');
    // A privacidade vira um campo de texto do ms-dropdown com o mesmo nome.
    if (!text || el.readOnly || el.name === 'f_tipo_privacidade') continue;
    el.value = textValue(el.name, el.maxLength, job.variant, job.tag);
    values[el.name] = el.value;
  }
  const own = context.donors[job.form];
  const donor = own && !PLACELESS.test(job.path) ? own : anyDonor();
  setFields(form, {
    ...context.lookups,
    ...donor,
    ...consistencyFixes(values, context.agency),
  });
  const page = pageValues(w, form, job);
  // A instituição e o curso como foram enviados: vêm de cópias e trocas, e
  // um erro de chave no Lattes só se explica por eles.
  const sent: Record<string, string> = {};
  for (const name of ['f_cod_inst', 'f_cod_inst2', 'f_inst', 'f_cod_curso', 'f_cod_curso2']) {
    const el = form.elements.namedItem(name) as HTMLInputElement | null;
    if (el?.value) sent[`enviado:${name}`] = el.value;
  }
  return { ...values, ...page, ...sent };
}

/**
 * Sem item seu do mesmo formulário (a atuação nova), os campos de busca de
 * qualquer outro. Nunca os de lugar (f_seq_*, f_codinst): numa inclusão, eles
 * fariam a página alterar um item que já existe.
 */
function anyDonor(): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const donor of Object.values(context.donors)) {
    for (const [name, value] of Object.entries(donor)) {
      if (/^f_(seq_|codinst$)/i.test(name) || name in merged) continue;
      merged[name] = value;
    }
  }
  return merged;
}

/** Os nomes dos campos de um formulário: o mesmo passo de novo tem os mesmos. */
export const signature = (form: HTMLFormElement) =>
  [...new Set([...form.elements].map((el) => (el as HTMLInputElement).name).filter(Boolean))]
    .sort()
    .join(',');

/** O "Salvar" da página, como a pessoa clicaria. */
export function saveButton(doc: Document): HTMLElement | undefined {
  return [...doc.querySelectorAll<HTMLElement>('input[type=button], button, a')].find((b) =>
    /^\s*salvar\s*$/i.test((b as HTMLInputElement).value || b.textContent || ''),
  );
}
