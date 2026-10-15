// Composição do modo de leitura, sem React: cada bloco (um registro, a
// identificação, o endereço, o resumo) vira seções com linhas de texto e
// linhas de rótulo e valor. Todo campo preenchido aparece; os vazios, não.
// A mesma composição é a prévia no topo do bloco em edição.

import { elementLabel, enumLabel } from '../labels/labels.ts';
import { childElements, getAttr, type XElement } from '../model/xml.ts';
import { formatPhone } from './contacts.ts';
import { isSystemAttr } from './field-kind.ts';
import { isRedundantDateFormat } from './lattes-date.ts';
import { isSensitiveAttr } from './privacy.ts';
import { displayValue, formatCep } from './reading.ts';

export type PartFormat = 'cep' | 'ddd' | 'level' | 'month' | 'number' | 'phone';

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

/** Uma lista dentro de um registro (vínculos, integrantes, participantes). */
export interface NestedGroup {
  /**
   * A posição do primeiro elemento da lista no bloco (a mesma conta das
   * chaves dos campos): igual na leitura e na prévia com rascunhos, para a
   * lista lembrar se estava aberta (nested-collapse.ts).
   */
  id?: string;
  items: Section[];
  label: string;
  /** Pessoas (equipe, integrantes, participantes) ou itens, para a contagem. */
  people?: boolean;
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
  /** Listas de elementos filhos, cada item como um registro pequeno. */
  nested: NestedGroup[];
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

/** A chave de um campo no bloco, a mesma que a prévia dá ao pedaço dele. */
export function partKeys(root: XElement): (el: XElement, attr: string) => string | undefined {
  const index = new Map(flatten(root).map((el, i) => [el, i]));
  return (el, attr) => {
    const i = index.get(el);
    return i === undefined ? undefined : `${i}:${attr}`;
  };
}

export class Keys {
  private readonly index = new Map<XElement, number>();
  constructor(root: XElement) {
    flatten(root).forEach((el, i) => this.index.set(el, i));
  }
  /** A posição do elemento no bloco, em ordem de documento. */
  indexOf(el: XElement): number {
    return this.index.get(el) ?? 0;
  }
  part(el: XElement, attr: string, extra: Partial<Part> = {}): Part {
    return { attr, el, key: `${this.index.get(el) ?? 0}:${attr}`, ...extra };
  }
}

export const value = (el: XElement, attr: string) => getAttr(el, attr)?.trim() ?? '';
export const isFilled = (p: Part) => value(p.el, p.attr) !== '';
export const has = (el: XElement, attr: string) => getAttr(el, attr) !== undefined;

/** Atributo que a pessoa vê e edita: sem sequência, formato de data repetido nem código do Lattes. */
export function isUsable(el: XElement, attr: string, opts: LayoutOptions): boolean {
  // A ordem dos autores, integrantes e participantes é a posição na lista.
  if (
    attr.startsWith('SEQUENCIA-') ||
    /^ORDEM-(DE-AUTORIA|DE-INTEGRACAO|PARTICIPANTE)$/.test(attr)
  ) {
    return false;
  }
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
export function finish(
  keys: Keys,
  els: XElement[],
  base: Omit<Section, 'hidden' | 'masked' | 'minor' | 'nested' | 'quietRows' | 'rows'> &
    Partial<Pick<Section, 'hidden' | 'minor' | 'nested' | 'quietRows'>>,
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
    nested: base.nested ?? [],
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
  // Telefone: o DDD entre parênteses e o número com hífen ("(51) 3308-1234");
  // o fax leva o DDD do mesmo endereço no próprio texto.
  if (p.format === 'month') return MONTH_NAMES[Number(v) - 1] ?? v;
  if (p.format === 'ddd') return `(${v.replace(/\D/g, '')})`;
  if (p.format === 'number') return formatPhone('', v);
  if (p.format === 'phone') return formatPhone(value(p.el, 'DDD'), v);
  return displayValue(p.el, p.attr, v);
}

/** Mês por extenso curto, como no período da atuação (item-meta.ts). */
const MONTH_NAMES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

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
      before = before.replace(/^\s*[,;›–·]?\s*/, '');
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
      { kind: 'text', parts: [p('CAIXA-POSTAL', { before: 'Caixa postal ' })] },
      // Um telefone só, com o DDD junto ("Telefone (51) 3308-1234"), o ramal e
      // o fax; a edição continua nos campos separados. Sem telefone, o DDD
      // fica na grade.
      {
        kind: 'text',
        parts: [
          ...(value(part, 'TELEFONE') !== ''
            ? [
                p('DDD', { before: 'Telefone ', format: 'ddd' }),
                p('TELEFONE', { before: ' ', format: 'number' }),
              ]
            : []),
          p('RAMAL', { before: ', ramal ' }),
          p('FAX', { before: ' · Fax ', format: 'phone' }),
        ],
      },
      { kind: 'text', parts: [p('E-MAIL')] },
      { kind: 'text', parts: [p('HOME-PAGE')] },
    ];
    const hidden = opts.hideSensitive && isSensitiveAttr(part.name, '');
    return finish(keys, [part], { heading: elementLabel(part.name), hidden, lines }, opts);
  });
  const own = finish(keys, [endereco], { heading: 'Contatos e preferência', lines: [] }, opts);
  return own.rows.length > 0 ? [...sections, own] : sections;
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
    for (const k of shownKeys(s.nested.flatMap((g) => g.items))) keys.add(k);
  }
  return keys;
}
