// Modo de leitura: a seção aparece como texto composto, sem bordas de campo
// nem rótulos que repetem o título, e os campos voltam só quando a pessoa
// pede para editar um bloco. Aqui fica a
// lógica sem React: o que aparece na leitura, como cada valor se escreve e
// quando uma tecla abre ou fecha a edição. A composição está em
// ReadingView.tsx e as medidas tipográficas em styles.css (".reading").

import { enumLabel } from '../labels/labels.ts';
import { formatIssn } from '../model/standard-numbers.ts';
import type { XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { codeValueLabel, flagLabel, isBooleanAttr } from './field-kind.ts';
import { displayLattesDate, isLattesDateAttr } from './lattes-date.ts';

export type ReadingKeyAction = 'edit' | 'close';

export interface ReadingKeyContext {
  /** Veio logo depois de um G: é o atalho de seção (G E, Educação), não "editar". */
  afterGo: boolean;
  /** O bloco está em edição (com os campos à mostra). */
  editing: boolean;
  /** Outro componente já tratou a tecla (o Esc que fecha uma lista de opções). */
  handled: boolean;
  /** Ctrl, Alt ou ⌘ junto: atalho de outra coisa (⌘E, por exemplo). */
  modifier: boolean;
  /** A tecla saiu do ponto de foco do bloco (o botão "Editar"), não de um campo. */
  onBlock: boolean;
}

/**
 * O que uma tecla faz num bloco de leitura: E ou Enter no bloco focado abre a
 * edição; Esc em qualquer ponto do bloco em edição volta à leitura.
 */
export function readingKeyAction(key: string, ctx: ReadingKeyContext): ReadingKeyAction | null {
  if (ctx.handled || ctx.modifier) return null;
  if (ctx.editing) return key === 'Escape' ? 'close' : null;
  if (!ctx.onBlock || ctx.afterGo) return null;
  return key === 'e' || key === 'E' || key === 'Enter' ? 'edit' : null;
}

/**
 * Clique que abre a edição: um clique simples, sem texto selecionado (a
 * leitura deixa copiar) e fora de link ou botão. O segundo e o terceiro
 * clique (`detail` 2 e 3) selecionam palavra e parágrafo e não abrem.
 */
export function clickOpensEditor(selection: string, onControl: boolean, detail = 1): boolean {
  return detail <= 1 && selection.trim() === '' && !onControl;
}

/** Antes de uma aspa de abertura: início, espaço, parêntese, travessão ou outra abertura. */
const OPENS_AFTER = /[\s([{\u2014\u2013\u201c\u2018-]/;

/**
 * Aspas e apóstrofos retos viram curvos, só na tela; o dado fica como está.
 * Da esquerda para a direita, para que uma aspa logo depois de outra que
 * abriu também abra (“‘x’”).
 */
export function curlyQuotes(text: string): string {
  let out = '';
  for (const ch of text) {
    const prev = out.at(-1);
    const opening = prev === undefined || OPENS_AFTER.test(prev);
    if (ch === '"') out += opening ? '\u201c' : '\u201d';
    else if (ch === "'") out += opening ? '\u2018' : '\u2019';
    else out += ch;
  }
  return out;
}

/** Parágrafos de um texto longo: uma quebra de linha já separa parágrafo. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * O schema não enumera alguns atributos que outros elementos enumeram com o
 * mesmo nome (o STATUS-DO-CURSO do pós-doutorado é texto livre, mas vem
 * "CONCLUIDO" como nos outros níveis): o valor que é de um desses enumerados
 * se lê pelo mesmo rótulo.
 */
function enumElsewhere(attr: string, value: string): boolean {
  return Object.values(lattesSchema.elements).some((e) =>
    e.attributes.some((a) => a.name === attr && a.enum?.includes(value)),
  );
}

/** Valor de um atributo como se lê: "Feminino", "03/05/1986", "Sim". */
export function displayValue(el: XElement, attr: string, value: string): string {
  const spec = lattesSchema.elements[el.name]?.attributes.find((a) => a.name === attr);
  if (isBooleanAttr(attr, spec, value)) return flagLabel(el.name, attr, value);
  if (
    isLattesDateAttr(
      el.name,
      attr,
      el.attrs.map((a) => a.name),
    )
  )
    return displayLattesDate(value);
  if (spec?.enum?.includes(value) || enumElsewhere(attr, value)) return enumLabel(value);
  // ISSN guardado com ou sem hífen; na leitura, sempre NNNN-NNNN.
  if (attr === 'ISSN') return formatIssn(value);
  if (attr === 'NOME-EM-CITACOES-BIBLIOGRAFICAS') {
    return value
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .join('; ');
  }
  const coded = codeValueLabel(el.name, attr, value);
  return coded === value ? curlyQuotes(value) : coded;
}

/** A linha que substitui os dados escondidos pelo modo de privacidade. */
export function hiddenNote(count: number): string {
  return count === 1
    ? '1 dado pessoal oculto pelo modo de privacidade.'
    : `${count} dados pessoais ocultos pelo modo de privacidade.`;
}

/** "91501-970" quando o CEP tem os oito dígitos; outro valor fica como veio. */
export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length === 8 && /^[\d.\s-]+$/.test(value)
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : value;
}

export interface YearCell {
  /** Ano ou período mostrado na coluna; vazio quando repete o da linha de cima. */
  shown: string;
  /** O valor inteiro, para leitores de tela quando a coluna fica vazia. */
  value: string;
}

/**
 * Coluna de anos de uma lista de registros: o ano aparece na primeira linha
 * de cada sequência e fica em branco nas seguintes, como num índice impresso.
 */
export function yearColumn(values: string[]): YearCell[] {
  return values.map((value, i) => ({
    shown: i > 0 && value !== '' && values[i - 1] === value ? '' : value,
    value,
  }));
}

/**
 * Largura da coluna da esquerda de uma lista, em ch: o texto mais longo dela
 * ("2016 – 2018", "Espanhol"), no mínimo a de um ano. A coluna usa corpo
 * menor que o texto, então a medida em ch do corpo já deixa uma folga.
 */
export function tabWidth(values: string[]): number {
  return Math.max(4, ...values.map((v) => v.length));
}

/**
 * Quantas colunas da grade de rótulos um valor ocupa: até 24 caracteres
 * cabe numa; até 48, em duas; mais que isso (as formas de citação, um título
 * em inglês, um endereço na web), na linha inteira.
 */
export function cellSpan(text: string): 1 | 2 | 3 {
  if (text.length > 48) return 3;
  return text.length > 24 ? 2 : 1;
}
