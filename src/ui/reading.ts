// Modo de leitura (protótipo, ?leitura no `pnpm dev`): a seção aparece como
// texto composto, sem bordas de campo nem rótulos que repetem o título, e os
// campos voltam só quando a pessoa pede para editar um bloco. Aqui fica a
// lógica sem React: o que aparece na leitura, como cada valor se escreve e
// quando uma tecla abre ou fecha a edição. A composição está em
// ReadingView.tsx e as medidas tipográficas em styles.css (".reading").

import { attributeLabelIn, enumLabel } from '../labels/labels.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { codeValueLabel, isBooleanAttr, isSystemAttr } from './field-kind.ts';
import { displayLattesDate, isLattesDateAttr, isRedundantDateFormat } from './lattes-date.ts';
import { isSensitiveAttr } from './privacy.ts';

/** Seções do protótipo; as outras continuam com os campos de sempre. */
export const READING_SECTIONS = new Set(['dados-gerais', 'formacao', 'producoes']);

/**
 * O modo de leitura foi pedido na URL (?leitura, ?leitura=1). Só vale no
 * `pnpm dev`: o padrão continua o editor de hoje até a proposta ser aprovada.
 * ?leitura=0 desliga, para comparar na mesma aba.
 */
export function readingRequested(search: string, dev: boolean): boolean {
  if (!dev) return false;
  const value = new URLSearchParams(search).get('leitura');
  return value !== null && value !== '0';
}

export function isReadingSection(sectionId: string, reading: boolean): boolean {
  return reading && READING_SECTIONS.has(sectionId);
}

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
 * Clique que abre a edição: não quando a pessoa seleciona texto (a leitura
 * deixa copiar) nem quando o clique foi num link ou botão de dentro.
 */
export function clickOpensEditor(selection: string, onControl: boolean): boolean {
  return selection.trim() === '' && !onControl;
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

export interface ReadingField {
  attr: string;
  /** Rótulo do formulário (o mesmo do campo em edição). */
  label: string;
  /** Escondido pelo modo de privacidade: o valor não vai para a tela. */
  masked: boolean;
  /** Valor por extenso: enum, data, sim/não e códigos conhecidos traduzidos. */
  text: string;
  /** Endereço que vira link (página, ORCID). */
  url?: string;
}

export interface ReadingOptions {
  /** Atributos que outro trecho da leitura já mostra. */
  except?: Set<string>;
  hideSensitive: boolean;
  /** "Mostrar códigos do Lattes" ligado. */
  showCodes: boolean;
}

const URL_ATTRS = /^(HOME-PAGE|ORCID-ID)/;

/** Valor de um atributo como se lê: "Feminino", "03/05/1986", "Sim". */
export function displayValue(el: XElement, attr: string, value: string): string {
  const spec = lattesSchema.elements[el.name]?.attributes.find((a) => a.name === attr);
  if (isBooleanAttr(attr, spec, value))
    return value === 'SIM' ? 'Sim' : value === 'NAO' ? 'Não' : value;
  if (
    isLattesDateAttr(
      el.name,
      attr,
      el.attrs.map((a) => a.name),
    )
  )
    return displayLattesDate(value);
  if (spec?.enum?.includes(value)) return enumLabel(value);
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

/**
 * Os campos de um elemento que a leitura mostra: só os preenchidos, sem
 * números de sequência, sem o formato de data que só repete DDMMAAAA e sem os
 * códigos do Lattes (a menos que a pessoa peça para vê-los). Os sensíveis
 * saem mascarados quando o modo de privacidade está ligado.
 */
export function readingFields(el: XElement, opts: ReadingOptions): ReadingField[] {
  return el.attrs
    .filter((a) => a.value.trim() !== '')
    .filter((a) => !opts.except?.has(a.name))
    .filter((a) => !a.name.startsWith('SEQUENCIA-'))
    .filter((a) => !isRedundantDateFormat(a.name, a.value))
    .filter((a) => opts.showCodes || !isSystemAttr(el.name, a.name))
    .map((a) => {
      const masked = opts.hideSensitive && isSensitiveAttr(el.name, a.name);
      const value = a.value.trim();
      return {
        attr: a.name,
        label: attributeLabelIn(el.name, a.name),
        masked,
        text: masked ? '' : displayValue(el, a.name, value),
        url: !masked && URL_ATTRS.test(a.name) && /^https?:\/\//.test(value) ? value : undefined,
      };
    });
}

/** O elemento tem algum dado: um atributo preenchido aqui ou em qualquer descendente. */
export function hasData(el: XElement): boolean {
  return (
    el.attrs.some((a) => a.value.trim() !== '') ||
    el.children.some((c) => c.kind === 'element' && hasData(c))
  );
}

/** A partir daqui um valor é texto corrido, como na área de texto dos formulários. */
const PROSE_MIN = 90;

/** Campo que se lê como parágrafo: texto longo, não mascarado, sem link. */
export function isProse(field: ReadingField): boolean {
  return !field.masked && !field.url && field.text.length > PROSE_MIN;
}

/** A linha que substitui os dados escondidos pelo modo de privacidade. */
export function hiddenNote(count: number): string {
  return count === 1
    ? '1 dado pessoal oculto pelo modo de privacidade.'
    : `${count} dados pessoais ocultos pelo modo de privacidade.`;
}

/** Campos que o endereço composto em linhas já mostra (o resto vira lista de rótulos). */
export const ADDRESS_LINE_ATTRS = new Set([
  'NOME-INSTITUICAO-EMPRESA',
  'NOME-ORGAO',
  'NOME-UNIDADE',
  'LOGRADOURO-COMPLEMENTO',
  'LOGRADOURO',
  'BAIRRO',
  'CIDADE',
  'UF',
  'CEP',
  'PAIS',
]);

/** "91501-970" quando o CEP tem os oito dígitos; outro valor fica como veio. */
export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length === 8 && /^[\d.\s-]+$/.test(value)
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : value;
}

/**
 * Endereço (profissional ou residencial) em linhas, como num envelope:
 * instituição e unidade, logradouro e bairro, cidade e UF, CEP e país.
 */
export function addressLines(el: XElement): string[] {
  const v = (n: string) => getAttr(el, n)?.trim() || undefined;
  const cep = v('CEP');
  return [
    [v('NOME-INSTITUICAO-EMPRESA'), v('NOME-ORGAO'), v('NOME-UNIDADE')],
    [v('LOGRADOURO-COMPLEMENTO') ?? v('LOGRADOURO'), v('BAIRRO')],
    [[v('CIDADE'), v('UF')].filter(Boolean).join(' – ') || undefined],
    [cep && formatCep(cep), v('PAIS')],
  ]
    .map((parts) => parts.filter(Boolean).join(', '))
    .filter(Boolean);
}

export interface FormationEntry {
  /** "Mestrado em Genética e Biologia Molecular". */
  degree: string;
  institution?: string;
  /** Linhas de apoio em cor secundária: orientação, bolsa. */
  notes: string[];
  /** Título da tese, dissertação ou trabalho de conclusão. */
  work?: string;
}

const WORK_TITLE =
  /^TITULO-(DA-DISSERTACAO-TESE|DO-TRABALHO-DE-CONCLUSAO-DE-CURSO|DA-MONOGRAFIA|DO-TRABALHO)/;

/**
 * Uma formação como se lê num currículo: nível e curso na primeira linha,
 * instituição, o título do trabalho e, em cor secundária, orientação e bolsa.
 */
export function formationEntry(el: XElement, levelLabel: string): FormationEntry {
  const v = (n: string) => getAttr(el, n)?.trim() || undefined;
  const course = v('NOME-CURSO');
  const degree = course ? `${levelLabel} em ${course}` : levelLabel;
  const workAttr = el.attrs.find(
    (a) => WORK_TITLE.test(a.name) && !a.name.endsWith('INGLES') && a.value.trim(),
  );
  const advisor = v('NOME-COMPLETO-DO-ORIENTADOR') ?? v('NOME-DO-ORIENTADOR');
  const coAdvisor = v('NOME-DO-CO-ORIENTADOR');
  const agency = v('NOME-AGENCIA');
  const notes = [
    advisor && `Orientação: ${advisor}${coAdvisor ? `; coorientação: ${coAdvisor}` : ''}`,
    agency && (getAttr(el, 'FLAG-BOLSA') !== 'NAO' ? `Bolsa: ${agency}` : `Agência: ${agency}`),
  ].filter((n): n is string => Boolean(n));
  return {
    degree,
    institution: v('NOME-INSTITUICAO') ?? v('NOME-DA-INSTITUICAO'),
    notes,
    work: workAttr && curlyQuotes(workAttr.value.trim()),
  };
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
