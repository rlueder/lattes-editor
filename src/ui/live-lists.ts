// O lado do editor das listas que o conector lê no Lattes (LAT-48,
// src/bridge/lattes-lists.ts): que campo vira qual lista, como a escolha se
// escreve no XML e quando a cópia guardada precisa de leitura nova. Sem cópia
// e sem conector, os campos ficam como eram, texto livre.
//
// O que é observado e o que é inferido no formato do XML está em
// docs/campos_tipados.md ("Listas lidas pelo conector").

import { COMPL_LEVELS, isComplementaryItem } from '../bridge/edit-lists.ts';
import type { Agency, AreaNode, Course, Institution, Organ } from '../bridge/lattes-lists.ts';
import { ACTIVITY_ORGAN_ELEMENTS } from '../bridge/organ-windows.ts';
import { ORGAN_PARTS } from '../bridge/production/organ.ts';
import { PRODUCTION_TARGETS } from '../bridge/production/targets/index.ts';
import { foldText } from '../model/fold-text.ts';
import type { KnowledgeArea } from '../model/production.ts';
import { getAttr, setAttr, walk, type XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';

/** Uma leitura por dia basta: as listas do Lattes mudam raramente. */
export const LISTS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Sem cópia, ou cópia de mais de um dia: pedir de novo ao conector. */
export function needsRefresh(readAt: number | undefined, now: number): boolean {
  return readAt === undefined || now - readAt > LISTS_MAX_AGE_MS || now < readAt;
}

const hasAttr = (el: XElement, attr: string) =>
  getAttr(el, attr) !== undefined ||
  Boolean(lattesSchema.elements[el.name]?.attributes.some((a) => a.name === attr));

/** Grava só o que mudou; devolve se algo mudou. */
function write(el: XElement, values: Record<string, string>): boolean {
  let changed = false;
  for (const [attr, value] of Object.entries(values)) {
    if (!hasAttr(el, attr) || (getAttr(el, attr) ?? '') === value) continue;
    setAttr(el, attr, value);
    changed = true;
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Áreas do conhecimento

export const AREA_ATTRS = {
  area: 'NOME-DA-AREA-DO-CONHECIMENTO',
  bigArea: 'NOME-GRANDE-AREA-DO-CONHECIMENTO',
  specialty: 'NOME-DA-ESPECIALIDADE',
  subArea: 'NOME-DA-SUB-AREA-DO-CONHECIMENTO',
} as const satisfies Record<keyof KnowledgeArea, string>;

/** Os elementos que guardam uma área: os das produções e as áreas de atuação. */
const AREA_ELEMENT = /^(AREA-DO-CONHECIMENTO-\d|AREA-DE-ATUACAO)$/;

const BIG_AREAS =
  lattesSchema.elements['AREA-DO-CONHECIMENTO-1']?.attributes.find(
    (a) => a.name === AREA_ATTRS.bigArea,
  )?.enum ?? [];

/**
 * O valor do XSD para a grande área do Lattes, pelo nome: "Ciências Exatas e
 * da Terra" é CIENCIAS_EXATAS_E_DA_TERRA (a forma das exportações). "Outra" é
 * OUTROS, o único que não sai do nome. Grande área que não casa com o XSD
 * fica de fora da lista: o editor não grava o que o XML não aceita.
 */
export function bigAreaValue(label: string): string | undefined {
  const folded = foldText(label)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const value = folded === 'OUTRA' ? 'OUTROS' : folded;
  return BIG_AREAS.includes(value) ? value : undefined;
}

export interface AreaOption {
  area: KnowledgeArea;
  /** "Matemática › Álgebra › Álgebra Comutativa": da área para baixo. */
  label: string;
  /** O código do nó no Lattes. */
  value: string;
}

const areaKey = (a: KnowledgeArea) =>
  [a.bigArea, foldText(a.area), foldText(a.subArea), foldText(a.specialty)].join('|');

interface AreaIndex {
  byKey: Map<string, AreaOption>;
  options: AreaOption[];
}

const indexes = new WeakMap<readonly AreaNode[], AreaIndex>();

function areaIndex(tree: readonly AreaNode[]): AreaIndex {
  const cached = indexes.get(tree);
  if (cached) return cached;
  const options: AreaOption[] = [];
  for (const big of tree) {
    const bigArea = bigAreaValue(big.l);
    if (!bigArea) continue;
    const visit = (node: AreaNode, names: string[]) => {
      const path = [...names, node.l];
      const [area = '', subArea = '', specialty = ''] = path;
      options.push({
        area: { area, bigArea, specialty, subArea },
        label: path.join(' › '),
        value: node.c,
      });
      for (const child of node.b ?? []) visit(child, path);
    };
    // A grande área sozinha não se escolhe no Lattes.
    for (const child of big.b ?? []) visit(child, []);
  }
  const byKey = new Map<string, AreaOption>();
  for (const o of options) if (!byKey.has(areaKey(o.area))) byKey.set(areaKey(o.area), o);
  const index = { byKey, options };
  indexes.set(tree, index);
  return index;
}

/** Todas as áreas que se escolhem (área, subárea, especialidade), na ordem da árvore. */
export function areaOptions(tree: readonly AreaNode[]): AreaOption[] {
  return areaIndex(tree).options;
}

/**
 * A opção da árvore que corresponde aos quatro nomes guardados, sem diferença
 * de acento e caixa nos nomes; undefined se a combinação não está na árvore.
 */
export function findArea(tree: readonly AreaNode[], a: KnowledgeArea): AreaOption | undefined {
  return areaIndex(tree).byKey.get(areaKey(a));
}

export function isAreaElement(element: string): boolean {
  return AREA_ELEMENT.test(element);
}

export function readArea(el: XElement): KnowledgeArea {
  return {
    area: getAttr(el, AREA_ATTRS.area) ?? '',
    bigArea: getAttr(el, AREA_ATTRS.bigArea) ?? '',
    specialty: getAttr(el, AREA_ATTRS.specialty) ?? '',
    subArea: getAttr(el, AREA_ATTRS.subArea) ?? '',
  };
}

const isEmptyArea = (a: KnowledgeArea) => !a.bigArea && !a.area && !a.subArea && !a.specialty;

/** Os quatro nomes de uma vez, sempre coerentes entre si; devolve se mudou. */
export function writeArea(el: XElement, a: KnowledgeArea): boolean {
  return write(el, {
    [AREA_ATTRS.area]: a.area,
    [AREA_ATTRS.bigArea]: a.bigArea,
    [AREA_ATTRS.specialty]: a.specialty,
    [AREA_ATTRS.subArea]: a.subArea,
  });
}

export const EMPTY_AREA: KnowledgeArea = { area: '', bigArea: '', specialty: '', subArea: '' };

// ---------------------------------------------------------------------------
// Formação: nível, instituição, curso e agência

/**
 * O f_nivel de cada formação, como no combo do Lattes (seção 4.2 do
 * reconhecimento); o XML guarda o mesmo código em NIVEL.
 */
const FORMATION_LEVELS: Record<string, string> = {
  APERFEICOAMENTO: 'X',
  'CURSO-TECNICO-PROFISSIONALIZANTE': '7',
  DOUTORADO: '4',
  'ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU': 'B',
  'ENSINO-MEDIO-SEGUNDO-GRAU': 'C',
  ESPECIALIZACAO: '2',
  GRADUACAO: '1',
  MESTRADO: '3',
  'MESTRADO-PROFISSIONALIZANTE': '9',
  'RESIDENCIA-MEDICA': 'D',
};

/** Residência médica e os ensinos médio e fundamental não têm curso no Lattes. */
const NO_COURSE = new Set(['B', 'C', 'D']);

export function formationLevel(element: string): string | undefined {
  return FORMATION_LEVELS[element];
}

/**
 * O código da busca com a letra na frente (V007900000004) vira o do XML, sem a
 * letra: a exportação traz CODIGO-INSTITUICAO="001000000998" onde o link do
 * Lattes traz D001000000998 (docs/lattes_internals.md, seção 3). O mesmo vale
 * para o curso (f_cod_curso sem a letra).
 */
export function withoutLetter(code: string): string {
  return code.trim().replace(/^[A-Za-z](?=[0-9A-Za-z]{8,}$)/, '');
}

/** O código da busca é o mesmo que o XML guarda (com ou sem a letra)? */
export function sameCode(fromSearch: string, fromXml: string): boolean {
  return fromXml !== '' && (fromSearch === fromXml || withoutLetter(fromSearch) === fromXml);
}

// ---------------------------------------------------------------------------
// Onde cada elemento guarda a escolha: formação, orientações e bancas

/** O código e o nome de uma escolha, nos atributos do XML. */
export interface CodeNameAttrs {
  code: string;
  name: string;
}

/**
 * Os atributos das escolhas de um elemento e os parâmetros das listas: a
 * formação (seção 17 do mapa) e as orientações e bancas, pela especificação
 * do conector (src/bridge/production/targets/orientacoes-bancas.ts, lookups).
 */
export interface LivePairs {
  agency?: CodeNameAttrs & { flag?: string };
  course?: CodeNameAttrs & {
    /**
     * Num tipo com mais de uma natureza, o nível e o f_sta_area pela NATUREZA
     * do XML (sem acento nem caixa); level e staArea ficam vazios.
     */
    byNature?: Record<string, { level: string; staArea: '' | 'N' }>;
    /** O código CAPES, que só a formação guarda à parte. */
    capes?: string;
    level: string;
    program: 'FORM' | 'TESE';
    staArea: '' | 'N';
  };
  institution: CodeNameAttrs;
  /**
   * As outras instituições que também se escolhem pela busca: a do doutorado
   * sanduíche e a da cotutela, na formação (formacao-edit.ts, slot dout).
   */
  otherInstitutions?: CodeNameAttrs[];
  /** As buscas de orientação e banca pedem a capacidade buscas-producao do conector. */
  production: boolean;
  /** O f_nivel da busca de instituição. */
  searchLevel?: string;
}

/** Sanduíche e cotutela (doutorado) e a instituição da graduação no exterior, quando o nível os tem. */
const DOUT_INSTITUTIONS: CodeNameAttrs[] = [
  { code: 'CODIGO-INSTITUICAO-DOUT', name: 'NOME-INSTITUICAO-DOUT' },
  { code: 'CODIGO-INSTITUICAO-GRAD', name: 'NOME-INSTITUICAO-GRAD' },
];

const FORMATION_PAIRS = (level: string): LivePairs => ({
  agency: { code: 'CODIGO-AGENCIA-FINANCIADORA', flag: 'FLAG-BOLSA', name: 'NOME-AGENCIA' },
  ...(NO_COURSE.has(level)
    ? {}
    : {
        course: {
          capes: 'CODIGO-CURSO-CAPES',
          code: 'CODIGO-CURSO',
          level,
          name: 'NOME-CURSO',
          program: 'FORM' as const,
          staArea: '' as const,
        },
      }),
  institution: { code: 'CODIGO-INSTITUICAO', name: 'NOME-INSTITUICAO' },
  production: false,
  searchLevel: level,
});

const hasInSchema = (element: string, attr: string) =>
  Boolean(lattesSchema.elements[element]?.attributes.some((a) => a.name === attr));

/**
 * Orientação e banca: a especificação do conector. O nível do curso vem da
 * natureza do tipo; num tipo com várias naturezas (outras orientações
 * concluídas, a banca de qualificação), da NATUREZA do item (byNature). O
 * mestrado profissional usa a lista do acadêmico aqui; na hora de gravar, o
 * conector refaz a busca pelo nível da página e recusa curso de outra lista.
 */
function productionPairs(element: string): LivePairs | undefined {
  const target = PRODUCTION_TARGETS.find((t) => t.lookups?.child === element);
  const spec = target?.lookups;
  if (!spec) return undefined;
  const natures = target.nature?.values ?? [];
  const nature = natures.length === 1 ? natures[0]! : undefined;
  const level = nature ? spec.course?.level[nature] : undefined;
  const c = spec.course;
  const byNature =
    c?.natures && natures.length > 1
      ? Object.fromEntries(
          Object.entries(c.natures).flatMap(([xml, code]) =>
            c.level[code]
              ? [
                  [
                    foldText(xml),
                    { level: c.level[code], staArea: c.noArea.includes(code) ? 'N' : '' } as const,
                  ],
                ]
              : [],
          ),
        )
      : undefined;
  return {
    ...(spec.agency
      ? {
          agency: {
            ...spec.agency,
            ...(hasInSchema(element, 'FLAG-BOLSA') ? { flag: 'FLAG-BOLSA' } : {}),
          },
        }
      : {}),
    ...(spec.course && nature && level
      ? {
          course: {
            code: spec.course.code,
            level,
            name: spec.course.name,
            program: 'TESE' as const,
            staArea: spec.course.noArea.includes(nature) ? ('N' as const) : ('' as const),
          },
        }
      : {}),
    ...(c && byNature
      ? {
          course: {
            byNature,
            code: c.code,
            level: '',
            name: c.name,
            program: 'TESE' as const,
            staArea: '' as const,
          },
        }
      : {}),
    institution: spec.institution,
    production: true,
    searchLevel: (nature && spec.institutionLevel?.[nature]) ?? '',
  };
}

/** O código e o nome da instituição do elemento (os da formação, quando ele não diz). */
export const institutionAttrs = (el: XElement): CodeNameAttrs =>
  livePairs(el.name)?.institution ?? { code: 'CODIGO-INSTITUICAO', name: 'NOME-INSTITUICAO' };

/**
 * O endereço profissional: só a instituição, pela busca. O conector a refaz
 * na busca da página de endereço (PRC_INST_ATIV) na hora de gravar.
 */
const ADDRESS_PAIRS: LivePairs = {
  institution: { code: 'CODIGO-INSTITUICAO-EMPRESA', name: 'NOME-INSTITUICAO-EMPRESA' },
  production: false,
};

/** Os atributos das escolhas do elemento, ou undefined quando ele não tem escolha pela lista. */
export function livePairs(element: string): LivePairs | undefined {
  if (element === 'ENDERECO-PROFISSIONAL') return ADDRESS_PAIRS;
  // A formação complementar abre as mesmas buscas de instituição e curso da
  // acadêmica (observado em 20/10/2026), com o f_nivel dela (edit-lists.ts).
  const level = formationLevel(element) ?? COMPL_LEVELS[element];
  if (!level) return productionPairs(element);
  const others = DOUT_INSTITUTIONS.filter(
    (p) => hasInSchema(element, p.code) && hasInSchema(element, p.name),
  );
  return { ...FORMATION_PAIRS(level), ...(others.length ? { otherInstitutions: others } : {}) };
}

/** A instituição que o campo `attr` escolhe: a principal ou a do sanduíche e da cotutela. */
export function institutionPair(el: XElement, attr?: string): CodeNameAttrs {
  const pairs = livePairs(el.name);
  const other = pairs?.otherInstitutions?.find((p) => p.name === attr);
  return other ?? institutionAttrs(el);
}

/** A agência fora de formação e orientação (outros itens com NOME-AGENCIA). */
const PLAIN_AGENCY = {
  code: 'CODIGO-AGENCIA-FINANCIADORA',
  flag: 'FLAG-BOLSA',
  name: 'NOME-AGENCIA',
};
export const agencyAttrs = (el: XElement) => livePairs(el.name)?.agency ?? PLAIN_AGENCY;

/**
 * Instituição escolhida na busca: código (sem a letra) e nome juntos. Trocar
 * por outra instituição limpa o curso, como o seleciona() do Lattes faz.
 */
export function applyInstitution(el: XElement, inst: Institution, attr?: string): boolean {
  const pairs = livePairs(el.name) ?? FORMATION_PAIRS('');
  const pair = institutionPair(el, attr);
  const main = pair.code === pairs.institution.code;
  const before = getAttr(el, pair.code) ?? '';
  const code = withoutLetter(inst.code);
  // Só a instituição principal leva o curso junto.
  const other = main && before !== '' && before !== code;
  const c = pairs.course;
  const course =
    other && c
      ? Object.fromEntries([c.code, c.name, ...(c.capes ? [c.capes] : [])].map((a) => [a, '']))
      : {};
  return write(el, { [pair.code]: code, [pair.name]: inst.name, ...course });
}

/** "Administração(33003025005P3)": o nome do curso e o código CAPES do programa. */
export function splitCourse(label: string): { capes: string; name: string } {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(label);
  return m && m[1] ? { capes: m[2]!.trim(), name: m[1].trim() } : { capes: '', name: label.trim() };
}

export const courseAttrs = (el: XElement) =>
  livePairs(el.name)?.course ?? { code: 'CODIGO-CURSO', name: 'NOME-CURSO' };

/** O curso da lista que é o do item: pelo código, ou pelo nome quando não há código. */
export function findCourse(courses: readonly Course[], el: XElement): Course | undefined {
  const attrs = courseAttrs(el);
  const code = getAttr(el, attrs.code) ?? '';
  if (code) return courses.find((c) => sameCode(c.value, code));
  const name = foldText(getAttr(el, attrs.name) ?? '');
  return name ? courses.find((c) => foldText(splitCourse(c.label).name) === name) : undefined;
}

/** Curso escolhido na lista: código sem a letra, nome sem o código CAPES, e o CAPES. */
export function applyCourse(el: XElement, course: Course | undefined): boolean {
  const attrs = courseAttrs(el);
  const capes = 'capes' in attrs ? attrs.capes : undefined;
  if (!course) {
    return write(
      el,
      Object.fromEntries([attrs.code, attrs.name, ...(capes ? [capes] : [])].map((a) => [a, ''])),
    );
  }
  const split = splitCourse(course.label);
  return write(el, {
    [attrs.code]: withoutLetter(course.value),
    ...(capes ? { [capes]: split.capes } : {}),
    [attrs.name]: split.name,
  });
}

/** A agência da lista que é a do item: pelo código, ou pelo nome quando não há código. */
export function findAgency(agencies: readonly Agency[], el: XElement): Agency | undefined {
  const attrs = agencyAttrs(el);
  const code = getAttr(el, attrs.code) ?? '';
  if (code) return agencies.find((a) => a.code === code);
  const name = foldText(getAttr(el, attrs.name) ?? '');
  return name ? agencies.find((a) => foldText(a.name) === name) : undefined;
}

/**
 * Agência escolhida na lista: código e nome juntos. Escolher uma marca a
 * bolsa, como o agencia() do formulário do Lattes faz com F_BOLSA.
 */
export function applyAgency(el: XElement, agency: Agency | undefined): boolean {
  const attrs = agencyAttrs(el);
  if (!agency) return write(el, { [attrs.code]: '', [attrs.name]: '' });
  return write(el, {
    [attrs.code]: agency.code,
    ...(attrs.flag ? { [attrs.flag]: 'SIM' } : {}),
    [attrs.name]: agency.name,
  });
}

// ---------------------------------------------------------------------------
// O lugar do campo no currículo

/** Os elementos acima de `el` na cópia, da raiz ao pai; vazio quando não está nela. */
export function ancestorsOf(root: XElement | undefined, el: XElement): readonly XElement[] {
  let found: readonly XElement[] = [];
  if (root) walk(root, (node, ancestors) => node === el && (found = [...ancestors]));
  return found;
}

/** O código da instituição da atuação que contém o elemento, como o XML o guarda. */
export function institutionOf(root: XElement | undefined, el: XElement): string {
  const atuacao = ancestorsOf(root, el).find((a) => a.name === 'ATUACAO-PROFISSIONAL');
  return (atuacao && getAttr(atuacao, 'CODIGO-INSTITUICAO')) ?? '';
}

/** A NATUREZA do item a que o detalhe pertence (no DADOS-BASICOS irmão). */
export function itemNature(root: XElement | undefined, el: XElement): string {
  const item = ancestorsOf(root, el).at(-1);
  const basics = item?.children.find(
    (c): c is XElement => c.kind === 'element' && c.name.startsWith('DADOS-BASICOS'),
  );
  return (basics && getAttr(basics, 'NATUREZA')) ?? '';
}

// ---------------------------------------------------------------------------
// Órgão e unidade do projeto (production/organ.ts)

/**
 * Órgão escolhido na janela de órgãos: código e nome juntos, e a unidade
 * sai, porque a de antes era de outro órgão. Sem órgão, os quatro ficam vazios.
 */
export function applyOrgan(el: XElement, organ: Organ | undefined): boolean {
  const { organ: o, unit: u } = ORGAN_PARTS;
  return write(el, {
    [o.code]: organ?.code ?? '',
    [o.name]: organ?.name ?? '',
    [u.code]: '',
    [u.name]: '',
  });
}

/** Unidade escolhida entre as do órgão do item; sem ela, só o órgão fica. */
export function applyUnit(el: XElement, unit: Organ | undefined): boolean {
  const { unit: u } = ORGAN_PARTS;
  return write(el, { [u.code]: unit?.code ?? '', [u.name]: unit?.name ?? '' });
}

/** A escolha da lista que é a do item: pelo código, ou pelo nome quando não há código. */
export function findOrgan(organs: readonly Organ[], code: string, name: string): Organ | undefined {
  if (code) return organs.find((o) => o.code === code);
  const folded = foldText(name);
  return folded ? organs.find((o) => foldText(o.name) === folded) : undefined;
}

// ---------------------------------------------------------------------------
// Que campo vira qual lista

export type LiveKind =
  'agencia' | 'area' | 'area-derivada' | 'curso' | 'instituicao' | 'orgao' | 'unidade';

/** O que o editor tem em mãos agora: as cópias guardadas e o que o conector sabe fazer. */
export interface LiveAvailability {
  /** O conector lê a janela de órgãos da atividade ('orgao-atividades'). */
  activityOrgans?: boolean;
  agencies?: readonly Agency[];
  areas?: readonly AreaNode[];
  /** O conector lê cursos (extensão com a capacidade 'listas-lattes'). */
  courses: boolean;
  /** O conector lê a janela de órgãos do projeto ('orgao-projeto'). */
  organs?: boolean;
  /**
   * O nome do pai do elemento do campo, pedido só quando o nome sozinho não
   * basta (OUTROS e MBA, que só são formação complementar dentro dela).
   */
  parentOf?: () => string | undefined;
  /** O conector faz as buscas de orientação e banca ('buscas-producao'). */
  production?: boolean;
  /** O conector busca instituição. */
  search: boolean;
}

/**
 * A lista que o campo usa, ou undefined para o campo de sempre. Instituição,
 * curso e agência valem na formação acadêmica (seção 17 do mapa) e, com a
 * capacidade buscas-producao do conector, nas orientações e bancas. O curso
 * precisa da instituição escolhida antes, como no Lattes.
 */
export function liveKind(el: XElement, attr: string, live: LiveAvailability): LiveKind | undefined {
  if (isAreaElement(el.name) && live.areas?.length) {
    if (attr === AREA_ATTRS.area) return 'area';
    const derived = [AREA_ATTRS.bigArea, AREA_ATTRS.subArea, AREA_ATTRS.specialty] as string[];
    if (!derived.includes(attr)) return undefined;
    // Só segue a área quando a combinação está na árvore (ou vazia); senão, à mão.
    const current = readArea(el);
    return isEmptyArea(current) || findArea(live.areas, current) ? 'area-derivada' : undefined;
  }
  if (el.name === ORGAN_PARTS.holder || ACTIVITY_ORGAN_ELEMENTS.has(el.name)) {
    if (!(el.name === ORGAN_PARTS.holder ? live.organs : live.activityOrgans)) return undefined;
    if (attr === ORGAN_PARTS.organ.name) return 'orgao';
    // A unidade é de um órgão: sem ele escolhido, não há lista.
    if (attr === ORGAN_PARTS.unit.name && getAttr(el, ORGAN_PARTS.organ.code)) return 'unidade';
    return undefined;
  }
  // OUTROS e MBA só são formação complementar dentro de FORMACAO-COMPLEMENTAR.
  const misplaced = el.name in COMPL_LEVELS && !isComplementaryItem(el.name, live.parentOf?.());
  const pairs = misplaced ? undefined : livePairs(el.name);
  if (pairs?.production && !live.production) return undefined;
  const agency = pairs?.agency ?? PLAIN_AGENCY;
  if (attr === agency.name && live.agencies?.length && hasAttr(el, agency.code)) {
    return 'agencia';
  }
  if (!pairs) return undefined;
  const institutions = [pairs.institution, ...(pairs.otherInstitutions ?? [])];
  const inst = institutions.find((p) => p.name === attr);
  if (inst && live.search && hasAttr(el, inst.code)) return 'instituicao';
  const course = pairs.course;
  if (
    course &&
    attr === course.name &&
    live.courses &&
    hasAttr(el, course.code) &&
    (getAttr(el, pairs.institution.code) ?? '') !== ''
  ) {
    return 'curso';
  }
  return undefined;
}
