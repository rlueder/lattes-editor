// Formulário longo em partes: o grupo principal e os que pedem atenção abertos,
// os outros fechados numa linha com o título, quantos campos têm valor e um
// resumo deles. Vale no formulário de item novo e na edição de um bloco.
//
// Um grupo abre sozinho quando tem campo obrigatório, campo com erro ou o
// campo para onde a pessoa pulou (clique num trecho da prévia). Na edição de
// um item com poucos valores, os grupos que têm valor também abrem: fechados,
// esconderiam quase tudo o que o item tem. Formulário curto fica inteiro à
// vista, sem grupos fechados.

import { getAttr, type XElement } from '../model/xml.ts';
import { isScreenAttr } from '../schema/screen-fields.ts';
import { formSwitches } from './form-order.ts';

/** Até este número de campos o formulário fica inteiro aberto. */
export const FLAT_FORM_MAX = 8;

/** Na edição, com até este número de campos preenchidos, os grupos com valor abrem. */
export const FEW_FILLED_MAX = 6;

export interface GroupFacts {
  /** Algum campo do grupo tem erro mostrado. */
  error: boolean;
  /** Campos do grupo com valor. */
  filled: number;
  label: string;
  /** Algum campo do grupo é obrigatório. */
  required: boolean;
  /** O campo para onde a pessoa pulou está no grupo. */
  target: boolean;
}

export interface FormFacts {
  /** Edição de um item que já existe (e não um item novo). */
  editing: boolean;
  /** Campos do formulário inteiro. */
  fields: number;
}

/**
 * Como cada grupo começa: `collapsible` falso no formulário curto e no
 * primeiro grupo, que ficam sempre abertos; `open` é o estado inicial dos
 * outros. O que a pessoa abriu ou fechou nesta sessão vale para o grupo de
 * mesmo nome, menos quando o grupo precisa abrir (obrigatório, erro, pulo).
 */
export function initialGroups(
  groups: GroupFacts[],
  form: FormFacts,
  remembered: (label: string) => boolean | undefined = rememberedGroup,
): { collapsible: boolean; open: boolean }[] {
  const long = form.fields > FLAT_FORM_MAX && groups.length > 1;
  const filledTotal = groups.reduce((n, g) => n + g.filled, 0);
  const fewFilled = form.editing && filledTotal <= FEW_FILLED_MAX;
  return groups.map((g, i) => {
    if (!long || i === 0) return { collapsible: false, open: true };
    if (mustOpen(g) || (fewFilled && g.filled > 0)) return { collapsible: true, open: true };
    return { collapsible: true, open: remembered(g.label) ?? false };
  });
}

/** Grupo que abre de qualquer jeito: tem o que a pessoa precisa ver agora. */
export function mustOpen(g: Pick<GroupFacts, 'error' | 'required' | 'target'>): boolean {
  return g.required || g.error || g.target;
}

/** "3 preenchidos" na linha do grupo fechado; nada quando está vazio. */
export function filledLabel(filled: number): string {
  if (filled === 0) return '';
  return filled === 1 ? '1 preenchido' : `${filled} preenchidos`;
}

/** Valores que o resumo mostra, no máximo; a linha corta com reticências. */
export const SUMMARY_MAX = 3;

/** Acima disto o valor é texto corrido (descrição, resumo) e fica fora do resumo. */
const SUMMARY_VALUE_MAX = 60;

/** Campos de texto longo: não entram no resumo, mesmo quando curtos. */
const LONG_TEXT = /(DESCRICAO|OUTRAS-INFORMACOES|INFORMACOES-ADICIONAIS|RESUMO|TEXTO)/;

/**
 * Alguns valores curtos do grupo, na ordem dos campos, separados por vírgula:
 * "Pesquisa, Em andamento, 2020". Descrições e textos longos ficam de fora.
 */
export function groupSummary(fields: { attr: string; value: string }[]): string {
  return fields
    .filter((f) => !LONG_TEXT.test(f.attr))
    .map((f) => f.value.replace(/\s+/g, ' ').trim())
    .filter((v) => v !== '' && v.length <= SUMMARY_VALUE_MAX)
    .slice(0, SUMMARY_MAX)
    .join(', ');
}

/** A linha do grupo fechado depois do título: "7 preenchidos · Pesquisa, Em andamento". */
export function closedLine(filled: number, summary: string): string {
  return [filledLabel(filled), summary].filter(Boolean).join(' · ');
}

// Aberto ou fechado por nome de grupo, nesta sessão. O sessionStorage pode
// faltar (janela privada, prévia): aí vale só a memória da página.
const STORAGE_KEY = 'lattes-editor:grupos-abertos';
let memory: Record<string, boolean> | null = null;

function load(): Record<string, boolean> {
  if (memory) return memory;
  memory = {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) if (typeof v === 'boolean') memory[k] = v;
    }
  } catch {
    // Sem armazenamento da sessão: segue só com a memória.
  }
  return memory;
}

export function rememberedGroup(label: string): boolean | undefined {
  return load()[label];
}

export function rememberGroup(label: string, open: boolean): void {
  const all = load();
  all[label] = open;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Sem armazenamento da sessão: fica na memória da página.
  }
}

/** Só para testes: esquece o que foi aberto e fechado. */
export function resetRememberedGroups(): void {
  memory = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada a limpar.
  }
}

/**
 * O campo está escondido porque o campo que o abre (formSwitches) ainda não o
 * escolheu: o sanduíche e a cotutela só aparecem depois que o tipo de
 * mestrado ou doutorado deixa de ser normal. Campo com valor aparece sempre;
 * elemento sem nenhum dos campos que decidem não esconde nada.
 */
export function switchedOff(el: XElement, attr: string): boolean {
  if ((getAttr(el, attr) ?? '') !== '') return false;
  const controllers = formSwitches(el.name)
    .filter(([, opened]) => opened.includes(attr))
    // O campo só de tela que a cópia não tem conta como vazio (screen-fields.ts).
    .map(([controller]) => getAttr(el, controller) ?? (isScreenAttr(controller) ? '' : undefined))
    .filter((v): v is string => v !== undefined);
  if (controllers.length === 0) return false;
  return controllers.every((v) => v.trim() === '' || v === 'N');
}
