// Registros do modo de leitura, sem React: cada item de lista (formação,
// idioma, área, prêmio, atuação, projeto, orientação, banca, evento…) como uma
// seção de reading-layout.ts, com período, título, linhas de apoio, os outros
// campos em grade e as listas de filhos.

import { attributeLabelIn, elementLabel } from '../labels/labels.ts';
import { childElements, getAttr, type XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { END_ATTRS, itemMeta, POINT_ATTRS, START_ATTRS, TITLE_ORDER } from './item-meta.ts';
import {
  finish,
  flatten,
  has,
  Keys,
  type LayoutOptions,
  type Line,
  type NestedGroup,
  type Part,
  partText,
  type Section,
  value,
} from './reading-layout.ts';

function whenLine(keys: Keys, el: XElement): Line {
  const start = START_ATTRS.find((a) => has(el, a));
  const end = END_ATTRS.find((a) => has(el, a));
  // Com início, vale o período (formação: 2011 – 2015); senão, o ano do item.
  if (!start) {
    const point = POINT_ATTRS.find((a) => has(el, a));
    return { kind: 'when', parts: point ? [keys.part(el, point)] : [] };
  }
  // Com o mês ao lado do ano (vínculo: MES-INICIO), o período diz o mês, como
  // na coluna da atuação ("jan 2026 – atual"), e o mês sai da grade.
  const month = (attr: string) => (has(el, attr) ? [keys.part(el, attr, { format: 'month' })] : []);
  const endMonth = end && has(el, 'MES-FIM') && value(el, 'MES-FIM') !== '';
  const parts = [
    ...month('MES-INICIO'),
    keys.part(el, start, { before: ' ' }),
    ...(end
      ? [
          // O mês do fim só com o ano do fim: senão sobraria "jan 2026 – mar".
          ...(endMonth && value(el, end) !== ''
            ? [keys.part(el, 'MES-FIM', { before: ' – ', format: 'month' })]
            : []),
          keys.part(el, end, { before: endMonth && value(el, end) !== '' ? ' ' : ' – ' }),
        ]
      : []),
  ];
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

/** Partes de um item lidas como dele mesmo (DADOS-BASICOS-*, DETALHAMENTO-*). */
const MERGED_PART = /^(DADOS-BASICOS|DETALHAMENTO)/;

/** Elementos que o schema deixa repetir dentro do pai (VINCULOS, INTEGRANTES, AUTORES). */
const REPEATABLE = new Set(
  Object.values(lattesSchema.elements).flatMap((spec) =>
    spec.children.filter((c) => c.max !== 1).map((c) => c.name),
  ),
);

/**
 * Filho sem identidade própria, lido junto com o item: palavras-chave,
 * setores, informações adicionais, as áreas do conhecimento. Não se repete
 * no pai; um contêiner só de filhos assim também é saco.
 */
function isBag(el: XElement): boolean {
  if (REPEATABLE.has(el.name)) return false;
  const kids = childElements(el);
  if (kids.length > 0) return el.attrs.length === 0 && kids.every(isBag);
  return !el.attrs.some((a) => a.name.startsWith('SEQUENCIA-'));
}

/** Os elementos cujos atributos o registro mostra como dele: o item, as partes e os sacos. */
function recordSources(el: XElement): XElement[] {
  const out = [el];
  for (const c of childElements(el)) {
    if (MERGED_PART.test(c.name)) out.push(c);
    else if (isBag(c)) out.push(...(childElements(c).length ? flatten(c).slice(1) : [c]));
  }
  return out;
}

/** Quem o item envolve: orientado, candidato, aluno ("Orientado: Luísa"). */
const PEOPLE = /^NOME-(DO|DA)-(ORIENTADO|ORIENTANDO|CANDIDATO|ALUNO)$/;

/** Forma e tipo de participação, ao lado do evento ("· Convidado"); o tipo do vínculo. */
const KIND_ATTRS = [
  'FORMA-PARTICIPACAO',
  'TIPO-PARTICIPACAO',
  'TIPO-DE-VINCULO',
  // O enquadramento do vínculo ("Professor adjunto") vem logo depois do tipo.
  'ENQUADRAMENTO-FUNCIONAL',
];

/** O título do registro entre as partes: TITULO-*, o nome do evento, ou como no cartão. */
function recordTitle(sources: XElement[]): { attr: string; el: XElement } | undefined {
  const filled = (el: XElement, attr: string) => value(el, attr) !== '';
  for (const test of [
    (n: string) => /^TITULO/.test(n) && !/(INGLES|ANAIS|PERIODICO|LIVRO|JORNAL)/.test(n),
    (n: string) => n === 'NOME-DO-EVENTO',
    // O vínculo de uma atuação lê pelo cargo escrito à parte ("Fundador,
    // CPO/CTO"; "Professora adjunta"), e só sem ele pelo outro vínculo.
    (n: string) => n === 'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO',
    (n: string) => n === 'OUTRO-VINCULO-INFORMADO',
  ]) {
    for (const el of sources) {
      const a = el.attrs.find((x) => test(x.name) && filled(el, x.name));
      if (a) return { attr: a.name, el };
    }
  }
  for (const el of sources) {
    const attr = titleAttr(el);
    if (attr) return { attr, el };
  }
  return undefined;
}

/**
 * Um registro qualquer (prêmio, atuação, projeto, orientação, banca, evento,
 * patente sem autores…): período ou ano, título, uma linha de apoio (onde,
 * de quem, de que forma), quem o item envolve, os outros campos em grade e as
 * listas de filhos (vínculos, atividades, integrantes, participantes).
 */
function genericRecord(keys: Keys, el: XElement, opts: LayoutOptions, depth = 0): Section {
  const sources = recordSources(el);
  const title = recordTitle(sources);
  // Sem título: o nome do tipo, menos dentro de uma lista, que já tem o nome dela.
  const lead: Line = title
    ? { kind: 'lead', parts: [keys.part(title.el, title.attr)] }
    : depth === 0
      ? { always: true, kind: 'lead', parts: [], prefix: elementLabel(el.name) }
      : { kind: 'lead', parts: [] };
  const isTitle = (s: XElement, a: string) => title?.el === s && title.attr === a;
  const pick = (names: string[]) =>
    names.flatMap((a) => sources.filter((s) => has(s, a) && !isTitle(s, a)).map((s) => ({ a, s })));
  const secondary = pick(SECONDARY_ATTRS).map(({ a, s }, i) =>
    keys.part(s, a, i > 0 ? { before: ', ' } : {}),
  );
  // O mesmo texto duas vezes (tipo "Livre" e enquadramento "Livre") aparece uma
  // só, na linha; o repetido sai também da grade.
  const kindParts = pick(KIND_ATTRS).map(({ a, s }) => keys.part(s, a, { before: ' · ' }));
  const repeated = new Set<string>();
  // "Outro" no tipo ou no enquadramento só diz que o texto livre vale: com o
  // texto preenchido (o título ou a linha), o "Outro" sai.
  const replacedBy: Record<string, string> = {
    'ENQUADRAMENTO-FUNCIONAL': 'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO',
    'TIPO-DE-VINCULO': 'OUTRO-VINCULO-INFORMADO',
  };
  const kinds = kindParts.filter((part, i) => {
    const text = partText(part).trim();
    const free = replacedBy[part.attr];
    const other = value(part.el, part.attr) === 'OUTRO' && free && value(part.el, free) !== '';
    const dup = text !== '' && kindParts.slice(0, i).some((p) => partText(p).trim() === text);
    if (dup || other) repeated.add(part.attr);
    return !dup && !other;
  });
  const people = sources.flatMap((s) =>
    s.attrs
      .filter((a) => PEOPLE.test(a.name))
      .map((a) => {
        const who = attributeLabelIn(s.name, a.name).replace(/^Nome d[oa] /, '');
        return {
          kind: 'meta' as const,
          parts: [keys.part(s, a.name, { before: `${capital(who)}: ` })],
        };
      }),
  );
  const when = [el, ...sources.slice(1)].map((s) => whenLine(keys, s)).find((w) => w.parts.length);
  const lines: Line[] = [lead, { kind: 'text', parts: [...secondary, ...kinds] }, ...people];
  return finish(
    keys,
    sources,
    { lines, nested: nestedGroups(keys, el, sources, opts, depth), quietRows: true, when },
    opts,
    repeated,
  );
}

const capital = (t: string) => t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1);

/** Listas de pessoas: a linha da lista fechada conta "4 pessoas", não "4 itens". */
const PEOPLE_LIST = /(EQUIPE|INTEGRANTE|PARTICIPANTE|AUTOR|MEMBRO)/;

/** Até onde os filhos de filhos viram listas; mais fundo, tudo vira grade. */
const MAX_DEPTH = 3;

/**
 * Os filhos de um registro que não são partes dele, em listas com o nome do
 * elemento ("Vínculos", "Integrantes do projeto"). Um contêiner sem
 * atributos (EQUIPE-DO-PROJETO) vale pelos filhos dele.
 */
function nestedGroups(
  keys: Keys,
  el: XElement,
  sources: XElement[],
  opts: LayoutOptions,
  depth: number,
): NestedGroup[] {
  const groups: NestedGroup[] = [];
  for (const c of childElements(el)) {
    if (sources.includes(c) || (isBag(c) && childElements(c).length > 0)) continue;
    const container = c.attrs.length === 0 && childElements(c).length > 0;
    const items = container ? childElements(c) : [c];
    const label = elementLabel(c.name);
    const sections = items.map((item) =>
      depth + 1 >= MAX_DEPTH
        ? finish(keys, flatten(item), { lines: [], quietRows: true }, opts)
        : genericRecord(keys, item, opts, depth + 1),
    );
    const last = groups.at(-1);
    if (last && last.label === label) last.items.push(...sections);
    else {
      groups.push({
        id: String(keys.indexOf(c)),
        items: sections,
        label,
        people: PEOPLE_LIST.test(c.name),
      });
    }
  }
  return groups;
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
  // Palavras-chave, setores e áreas da formação entram na grade; filhos, em listas.
  const sources = recordSources(el);
  return finish(
    keys,
    sources,
    {
      lines,
      nested: nestedGroups(keys, el, sources, opts, 0),
      quietRows: true,
      when: whenLine(keys, el),
    },
    opts,
  );
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

/**
 * A coluna da esquerda de um registro como linha, com a chave de cada ano
 * (para o ano em foco acender na prévia). Na produção, o ano dos dados
 * básicos; nos outros, o período ou o ano do próprio registro.
 */
export function recordWhen(el: XElement, academic: boolean, opts: LayoutOptions): Line | undefined {
  const basics = childElements(el).find((c) => c.name.startsWith('DADOS-BASICOS'));
  if (basics) {
    const line = whenLine(new Keys(el), basics);
    return line.parts.length > 0 ? line : undefined;
  }
  return recordLayout(el, academic, opts).when;
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
