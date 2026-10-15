// Composição do modo de leitura, sem React: cada bloco (um registro, a
// identificação, o endereço, o resumo) vira seções com linhas de texto e
// linhas de rótulo e valor. Todo campo preenchido aparece; os vazios, não.
// A mesma composição é a prévia no topo do bloco em edição.

import { elementLabel, enumLabel } from '../labels/labels.ts';
import { childElements, getAttr, type XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { isSystemAttr } from './field-kind.ts';
import { END_ATTRS, itemMeta, POINT_ATTRS, START_ATTRS, TITLE_ORDER } from './item-meta.ts';
import { isRedundantDateFormat } from './lattes-date.ts';
import { isSensitiveAttr } from './privacy.ts';
import { displayValue, formatCep } from './reading.ts';

export type PartFormat = 'cep' | 'level';

/** Um pedaço editável: um atributo de um elemento do bloco. */
export interface Part {
  attr: string;
  /** Texto antes do valor quando ele aparece (", fala ", " em "). */
  before?: string;
  el: XElement;
  format?: PartFormat;
  /** Chave estável no bloco: posição do elemento e nome do atributo. */
  key: string;
}

export type LineKind = 'lead' | 'meta' | 'para' | 'text' | 'translation' | 'when' | 'work';

export interface Line {
  /** Aparece mesmo sem nenhum pedaço preenchido (o grau sem curso). */
  always?: boolean;
  kind: LineKind;
  /** Rótulo curto antes do texto ("Em inglês"). */
  label?: string;
  parts: Part[];
  /** Texto fixo no começo da linha ("Mestrado"). */
  prefix?: string;
  /** Texto fixo no fim da linha ("." ou " – atual"). */
  suffix?: string;
}

export interface Section {
  heading?: string;
  /** Seção inteira escondida pelo modo de privacidade (endereço residencial). */
  hidden: boolean;
  lines: Line[];
  /** Campos preenchidos escondidos pelo modo de privacidade. */
  masked: number;
  /** Título de terceiro nível em diante: rótulo, não título. */
  minor: boolean;
  /** Linhas de rótulo e valor em corpo menor (detalhes de um registro). */
  quietRows: boolean;
  /** Campos preenchidos fora das linhas de texto, como rótulo e valor. */
  rows: Part[];
  when?: Line;
}

export interface LayoutOptions {
  hideSensitive: boolean;
  showCodes: boolean;
}

/** Elementos do bloco em ordem de documento; a posição entra na chave dos campos. */
export function flatten(root: XElement): XElement[] {
  const out: XElement[] = [root];
  for (const c of childElements(root)) out.push(...flatten(c));
  return out;
}

class Keys {
  private readonly index = new Map<XElement, number>();
  constructor(root: XElement) {
    flatten(root).forEach((el, i) => this.index.set(el, i));
  }
  part(el: XElement, attr: string, extra: Partial<Part> = {}): Part {
    return { attr, el, key: `${this.index.get(el) ?? 0}:${attr}`, ...extra };
  }
}

const value = (el: XElement, attr: string) => getAttr(el, attr)?.trim() ?? '';
export const isFilled = (p: Part) => value(p.el, p.attr) !== '';
const has = (el: XElement, attr: string) => getAttr(el, attr) !== undefined;

/** Atributo que a pessoa vê e edita: sem sequência, formato de data repetido nem código do Lattes. */
export function isUsable(el: XElement, attr: string, opts: LayoutOptions): boolean {
  // A ordem dos autores é a posição deles na lista, não um número para editar.
  if (attr.startsWith('SEQUENCIA-') || attr === 'ORDEM-DE-AUTORIA') return false;
  if (isRedundantDateFormat(attr, getAttr(el, attr) ?? '')) return false;
  return opts.showCodes || !isSystemAttr(el.name, attr);
}

/** Ordem de leitura dos rótulos na identificação: nome, origem, documentos, filiação. */
const IDENTIFICATION_ORDER = [
  'NOME-COMPLETO',
  'NOME-EM-CITACOES-BIBLIOGRAFICAS',
  'NACIONALIDADE',
  'PAIS-DE-NACIONALIDADE',
  'SIGLA-PAIS-NACIONALIDADE',
  'DATA-NASCIMENTO',
  'CIDADE-NASCIMENTO',
  'UF-NASCIMENTO',
  'PAIS-DE-NASCIMENTO',
  'SEXO',
  'RACA-OU-COR',
  'PCD',
  'NUMERO-IDENTIDADE',
  'ORGAO-EMISSOR',
  'UF-ORGAO-EMISSOR',
  'DATA-DE-EMISSAO',
  'CPF',
  'NUMERO-DO-PASSAPORTE',
  'NOME-DO-PAI',
  'NOME-DA-MAE',
  'ORCID-ID',
  'PERMISSAO-DE-DIVULGACAO',
  'DATA-FALECIMENTO',
];

/**
 * Ordem dos rótulos fora das linhas de texto: nomes e títulos, descrições,
 * lugares, datas e anos, marcas de sim/não, o resto. Não é a ordem do XSD.
 */
export function rowRank(attr: string): number {
  const id = IDENTIFICATION_ORDER.indexOf(attr);
  if (id >= 0) return id;
  const groups: RegExp[] = [
    /^(NOME|TITULO)/,
    /^(DESCRICAO|NATUREZA|TIPO|FORMA|MEIO|STATUS)/,
    /(PAIS|CIDADE|LOCAL|UF|IDIOMA)/,
    /^(ANO|MES|DATA|DIA)/,
    /^FLAG-/,
  ];
  const g = groups.findIndex((re) => re.test(attr));
  return 100 + (g < 0 ? groups.length : g);
}

function byRank(a: Part, b: Part): number {
  return rowRank(a.attr) - rowRank(b.attr);
}

/**
 * Fecha uma seção: as linhas guardam só pedaços de atributos que existem; os
 * preenchidos que sobram viram rótulo e valor.
 */
function finish(
  keys: Keys,
  els: XElement[],
  base: Omit<Section, 'hidden' | 'masked' | 'minor' | 'quietRows' | 'rows'> &
    Partial<Pick<Section, 'hidden' | 'minor' | 'quietRows'>>,
  opts: LayoutOptions,
  except: Set<string> = new Set(),
): Section {
  const exists = (p: Part) => has(p.el, p.attr) && isUsable(p.el, p.attr, opts);
  const clean = (l: Line): Line => ({ ...l, parts: l.parts.filter(exists) });
  const when = base.when && clean(base.when);
  const lines = base.lines.map(clean);
  const inLines = [...(when ? [when] : []), ...lines].flatMap((l) => l.parts);
  const used = new Set(inLines.map((p) => p.key));
  const loose = els.flatMap((el) =>
    el.attrs
      .map((a) => keys.part(el, a.name))
      .filter((p) => !used.has(p.key) && !except.has(p.attr) && isUsable(p.el, p.attr, opts)),
  );
  const sensitive = (p: Part) => opts.hideSensitive && isSensitiveAttr(p.el.name, p.attr);
  const filledLoose = loose.filter(isFilled);
  const rows = filledLoose.filter((p) => !sensitive(p)).sort(byRank);
  const masked = filledLoose.filter(sensitive).length;
  return {
    ...base,
    hidden: base.hidden ?? false,
    lines,
    masked,
    minor: base.minor ?? false,
    quietRows: base.quietRows ?? false,
    rows,
    when,
  };
}

/** Texto de um pedaço: valor por extenso, nível de idioma em minúsculas, CEP formatado. */
export function partText(p: Part): string {
  const v = value(p.el, p.attr);
  if (p.format === 'level') return LEVELS[v] ?? enumLabel(v).toLocaleLowerCase('pt-BR');
  if (p.format === 'cep') return formatCep(v);
  return displayValue(p.el, p.attr, v);
}

const LEVELS: Record<string, string> = {
  BEM: 'bem',
  POUCO: 'pouco',
  RAZOAVELMENTE: 'razoavelmente',
};

export interface ShownPart {
  /** Texto antes do valor, já ajustado à posição (sem vírgula no começo da linha). */
  before: string;
  part: Part;
  text: string;
}

/**
 * Os pedaços preenchidos de uma linha, com o texto de ligação certo: o
 * primeiro, quando nada vem antes, perde a vírgula e ganha maiúscula.
 */
export function shownParts(line: Line): ShownPart[] {
  const out: ShownPart[] = [];
  for (const part of line.parts) {
    if (!isFilled(part)) continue;
    let before = part.before ?? '';
    if (out.length === 0 && !line.prefix) {
      before = before.replace(/^\s*[,;›–]\s*/, '');
      before = before.charAt(0).toLocaleUpperCase('pt-BR') + before.slice(1);
    }
    out.push({ before, part, text: partText(part) });
  }
  return out;
}

export function lineVisible(line: Line): boolean {
  return Boolean(line.always) || line.parts.some(isFilled);
}

/** Texto corrido de uma linha, como a leitura mostra. */
export function lineText(line: Line): string {
  if (!lineVisible(line)) return '';
  const body = shownParts(line)
    .map((s) => s.before + s.text)
    .join('');
  return `${line.prefix ?? ''}${body}${line.suffix ?? ''}`;
}

// Blocos de campos ----------------------------------------------------------

/** Atributos de DADOS-GERAIS que são de outro grupo (Resumo, Outras informações). */
const IDENTIFICATION_ELSEWHERE = new Set(['TEXTO-RESUMO-CV-RH', 'OUTRAS-INFORMACOES-RELEVANTES']);

/** A partir daqui um valor é texto corrido, como na área de texto dos formulários. */
export const PROSE_MIN = 90;

/** Bloco de campos genérico (identificação, outras informações) e os filhos dele. */
export function fieldsLayout(root: XElement, opts: LayoutOptions): Section[] {
  const keys = new Keys(root);
  const walk = (el: XElement, depth: number): Section[] => {
    const except = el.name === 'DADOS-GERAIS' ? IDENTIFICATION_ELSEWHERE : new Set<string>();
    const usable = el.attrs.filter((a) => !except.has(a.name) && isUsable(el, a.name, opts));
    const filled = usable.filter((a) => a.value.trim() !== '');
    const kids = childElements(el);
    // Um texto longo sozinho é parágrafo, sem rótulo que repita o título.
    const prose =
      filled.length === 1 && filled[0]!.value.trim().length > PROSE_MIN && kids.length === 0;
    const lines: Line[] = prose ? [{ kind: 'para', parts: [keys.part(el, filled[0]!.name)] }] : [];
    const heading = depth === 0 ? undefined : elementLabel(el.name);
    const own = finish(keys, [el], { heading, lines, minor: depth > 1 }, opts, except);
    return [own, ...kids.flatMap((k) => walk(k, depth + 1))];
  };
  return walk(root, 0);
}

/** Resumo: o texto em português e, com um rótulo curto, o em inglês. */
export function resumoLayout(el: XElement, opts: LayoutOptions): Section[] {
  const keys = new Keys(el);
  const lines: Line[] = [
    { kind: 'para', parts: [keys.part(el, 'TEXTO-RESUMO-CV-RH')] },
    { kind: 'translation', label: 'Em inglês', parts: [keys.part(el, 'TEXTO-RESUMO-CV-RH-EN')] },
  ];
  return [finish(keys, [el], { lines }, opts)];
}

/** Endereço em linhas, como num envelope; contatos e preferência no fim. */
export function addressLayout(endereco: XElement, opts: LayoutOptions): Section[] {
  const keys = new Keys(endereco);
  const sections = childElements(endereco).map((part) => {
    const p = (attr: string, extra: Partial<Part> = {}) => keys.part(part, attr, extra);
    const street = has(part, 'LOGRADOURO-COMPLEMENTO') ? 'LOGRADOURO-COMPLEMENTO' : 'LOGRADOURO';
    const lines: Line[] = [
      {
        kind: 'text',
        parts: [
          p('NOME-INSTITUICAO-EMPRESA'),
          p('NOME-ORGAO', { before: ', ' }),
          p('NOME-UNIDADE', { before: ', ' }),
        ],
      },
      { kind: 'text', parts: [p(street), p('BAIRRO', { before: ', ' })] },
      { kind: 'text', parts: [p('CIDADE'), p('UF', { before: ' – ' })] },
      { kind: 'text', parts: [p('CEP', { format: 'cep' }), p('PAIS', { before: ', ' })] },
    ];
    const hidden = opts.hideSensitive && isSensitiveAttr(part.name, '');
    return finish(keys, [part], { heading: elementLabel(part.name), hidden, lines }, opts);
  });
  const own = finish(keys, [endereco], { heading: 'Contatos e preferência', lines: [] }, opts);
  return own.rows.length > 0 ? [...sections, own] : sections;
}

// Registros -------------------------------------------------------------------

function whenLine(keys: Keys, el: XElement): Line {
  const start = START_ATTRS.find((a) => has(el, a));
  const end = END_ATTRS.find((a) => has(el, a));
  // Com início, vale o período (formação: 2011 – 2015); senão, o ano do item.
  if (!start) {
    const point = POINT_ATTRS.find((a) => has(el, a));
    return { kind: 'when', parts: point ? [keys.part(el, point)] : [] };
  }
  const parts = [keys.part(el, start), ...(end ? [keys.part(el, end, { before: ' – ' })] : [])];
  const current = itemMeta(el).current && value(el, start) !== '';
  const ended = end !== undefined && value(el, end) !== '';
  return { kind: 'when', parts, suffix: current && !ended ? ' – atual' : undefined };
}

/** Atributo que dá o título do registro, como no cartão (item-meta.ts). */
function titleAttr(el: XElement): string | undefined {
  const spec = lattesSchema.elements[el.name]?.attributes;
  const isEnum = (n: string) => Boolean(spec?.find((a) => a.name === n)?.enum);
  for (const test of TITLE_ORDER) {
    const hit = el.attrs.find((a) => test(a.name) && a.value.trim() !== '' && !isEnum(a.name));
    if (hit) return hit.name;
  }
  return undefined;
}

/** Linha de apoio dos registros: quem promove, onde, de quem. */
const SECONDARY_ATTRS = [
  'NOME-DA-ENTIDADE-PROMOTORA',
  'NOME-INSTITUICAO',
  'NOME-DA-INSTITUICAO',
  'NOME-ORGAO',
  'NOME-DO-EVENTO',
  'NOME-DA-EDITORA',
];

function genericRecord(keys: Keys, el: XElement, opts: LayoutOptions): Section {
  const title = titleAttr(el);
  const lead: Line = title
    ? { kind: 'lead', parts: [keys.part(el, title)] }
    : { always: true, kind: 'lead', parts: [], prefix: elementLabel(el.name) };
  const secondary = SECONDARY_ATTRS.filter((a) => a !== title && has(el, a)).map((a, i) =>
    keys.part(el, a, i > 0 ? { before: ', ' } : {}),
  );
  const lines: Line[] = [lead, { kind: 'text', parts: secondary }];
  return finish(keys, [el], { lines, quietRows: true, when: whenLine(keys, el) }, opts);
}

const WORK_TITLE =
  /^TITULO-(DA-DISSERTACAO-TESE|DO-TRABALHO-DE-CONCLUSAO-DE-CURSO|DA-MONOGRAFIA|DO-TRABALHO)/;

/** Formação acadêmica: grau e curso, instituição, trabalho, orientação e bolsa. */
function formationRecord(keys: Keys, el: XElement, opts: LayoutOptions): Section {
  const p = (attr: string, extra: Partial<Part> = {}) => keys.part(el, attr, extra);
  const work = el.attrs.find((a) => WORK_TITLE.test(a.name) && !a.name.endsWith('INGLES'));
  const advisor = has(el, 'NOME-COMPLETO-DO-ORIENTADOR')
    ? 'NOME-COMPLETO-DO-ORIENTADOR'
    : 'NOME-DO-ORIENTADOR';
  const institution = has(el, 'NOME-INSTITUICAO') ? 'NOME-INSTITUICAO' : 'NOME-DA-INSTITUICAO';
  const grant = getAttr(el, 'FLAG-BOLSA') === 'NAO' ? 'Agência: ' : 'Bolsa: ';
  const lines: Line[] = [
    {
      always: true,
      kind: 'lead',
      parts: [p('NOME-CURSO', { before: ' em ' })],
      prefix: elementLabel(el.name),
    },
    { kind: 'text', parts: [p(institution)] },
    { kind: 'work', parts: work ? [p(work.name)] : [] },
    { kind: 'meta', parts: [p(advisor, { before: 'Orientação: ' })] },
    { kind: 'meta', parts: [p('NOME-DO-CO-ORIENTADOR', { before: 'Coorientação: ' })] },
    { kind: 'meta', parts: [p('NOME-AGENCIA', { before: grant })] },
  ];
  return finish(keys, [el], { lines, quietRows: true, when: whenLine(keys, el) }, opts);
}

/** Idioma: "Compreende bem, fala bem, lê bem, escreve bem." */
function languageRecord(keys: Keys, el: XElement, opts: LayoutOptions): Section {
  const p = (attr: string, before: string) => keys.part(el, attr, { before, format: 'level' });
  const lines: Line[] = [
    {
      kind: 'text',
      parts: [
        p('PROFICIENCIA-DE-COMPREENSAO', 'compreende '),
        p('PROFICIENCIA-DE-FALA', ', fala '),
        p('PROFICIENCIA-DE-LEITURA', ', lê '),
        p('PROFICIENCIA-DE-ESCRITA', ', escreve '),
      ],
      suffix: '.',
    },
  ];
  const when: Line = { kind: 'when', parts: [keys.part(el, 'DESCRICAO-DO-IDIOMA')] };
  return finish(keys, [el], { lines, quietRows: true, when }, opts);
}

/** Área de atuação: área › subárea › especialidade, e a grande área. */
function areaRecord(keys: Keys, el: XElement, opts: LayoutOptions): Section {
  const p = (attr: string, before?: string) => keys.part(el, attr, before ? { before } : {});
  const lines: Line[] = [
    {
      kind: 'lead',
      parts: [
        p('NOME-DA-AREA-DO-CONHECIMENTO'),
        p('NOME-DA-SUB-AREA-DO-CONHECIMENTO', ' › '),
        p('NOME-DA-ESPECIALIDADE', ' › '),
      ],
    },
    { kind: 'meta', parts: [p('NOME-GRANDE-AREA-DO-CONHECIMENTO')] },
  ];
  return finish(keys, [el], { lines, quietRows: true }, opts);
}

export type RecordKind = 'area' | 'formation' | 'generic' | 'language';

export function recordKind(el: XElement, academic: boolean): RecordKind {
  if (el.name === 'IDIOMA') return 'language';
  if (academic) return 'formation';
  if (has(el, 'NOME-GRANDE-AREA-DO-CONHECIMENTO')) return 'area';
  return 'generic';
}

/** Um registro de lista (sem referência bibliográfica) como uma seção. */
export function recordLayout(el: XElement, academic: boolean, opts: LayoutOptions): Section {
  const keys = new Keys(el);
  switch (recordKind(el, academic)) {
    case 'language':
      return languageRecord(keys, el, opts);
    case 'formation':
      return formationRecord(keys, el, opts);
    case 'area':
      return areaRecord(keys, el, opts);
    default:
      return genericRecord(keys, el, opts);
  }
}

/** Todo campo preenchido que a leitura mostra, para conferir que nada fica de fora. */
export function shownKeys(sections: Section[]): Set<string> {
  const keys = new Set<string>();
  for (const s of sections) {
    if (s.hidden) continue;
    for (const l of [...(s.when ? [s.when] : []), ...s.lines]) {
      for (const sp of shownParts(l)) keys.add(sp.part.key);
    }
    for (const r of s.rows) keys.add(r.key);
  }
  return keys;
}
