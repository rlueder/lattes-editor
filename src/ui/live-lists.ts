// O lado do editor das listas que o conector lê no Lattes (LAT-48,
// src/bridge/lattes-lists.ts): que campo vira qual lista, como a escolha se
// escreve no XML e quando a cópia guardada precisa de leitura nova. Sem cópia
// e sem conector, os campos ficam como eram, texto livre.
//
// O que é observado e o que é inferido no formato do XML está em
// docs/campos_tipados.md ("Listas lidas pelo conector").

import type { Agency, AreaNode, Course, Institution } from '../bridge/lattes-lists.ts';
import { foldText } from '../model/fold-text.ts';
import type { KnowledgeArea } from '../model/production.ts';
import { getAttr, setAttr, type XElement } from '../model/xml.ts';
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

/** Os atributos de curso que mudam juntos; o Lattes limpa o curso quando a instituição muda. */
const COURSE_ATTRS = ['CODIGO-CURSO', 'NOME-CURSO', 'CODIGO-CURSO-CAPES'];

/**
 * Instituição escolhida na busca: código (sem a letra) e nome juntos. Trocar
 * por outra instituição limpa o curso, como o seleciona() do Lattes faz.
 */
export function applyInstitution(el: XElement, inst: Institution): boolean {
  const before = getAttr(el, 'CODIGO-INSTITUICAO') ?? '';
  const code = withoutLetter(inst.code);
  const other = before !== '' && before !== code;
  const course = other ? Object.fromEntries(COURSE_ATTRS.map((a) => [a, ''])) : {};
  return write(el, { 'CODIGO-INSTITUICAO': code, 'NOME-INSTITUICAO': inst.name, ...course });
}

/** "Administração(33003025005P3)": o nome do curso e o código CAPES do programa. */
export function splitCourse(label: string): { capes: string; name: string } {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(label);
  return m && m[1] ? { capes: m[2]!.trim(), name: m[1].trim() } : { capes: '', name: label.trim() };
}

/** O curso da lista que é o do item: pelo código, ou pelo nome quando não há código. */
export function findCourse(courses: readonly Course[], el: XElement): Course | undefined {
  const code = getAttr(el, 'CODIGO-CURSO') ?? '';
  if (code) return courses.find((c) => sameCode(c.value, code));
  const name = foldText(getAttr(el, 'NOME-CURSO') ?? '');
  return name ? courses.find((c) => foldText(splitCourse(c.label).name) === name) : undefined;
}

/** Curso escolhido na lista: código sem a letra, nome sem o código CAPES, e o CAPES. */
export function applyCourse(el: XElement, course: Course | undefined): boolean {
  if (!course) return write(el, Object.fromEntries(COURSE_ATTRS.map((a) => [a, ''])));
  const { capes, name } = splitCourse(course.label);
  return write(el, {
    'CODIGO-CURSO': withoutLetter(course.value),
    'CODIGO-CURSO-CAPES': capes,
    'NOME-CURSO': name,
  });
}

/** A agência da lista que é a do item: pelo código, ou pelo nome quando não há código. */
export function findAgency(agencies: readonly Agency[], el: XElement): Agency | undefined {
  const code = getAttr(el, 'CODIGO-AGENCIA-FINANCIADORA') ?? '';
  if (code) return agencies.find((a) => a.code === code);
  const name = foldText(getAttr(el, 'NOME-AGENCIA') ?? '');
  return name ? agencies.find((a) => foldText(a.name) === name) : undefined;
}

/**
 * Agência escolhida na lista: código e nome juntos. Escolher uma marca a
 * bolsa, como o agencia() do formulário do Lattes faz com F_BOLSA.
 */
export function applyAgency(el: XElement, agency: Agency | undefined): boolean {
  if (!agency) return write(el, { 'CODIGO-AGENCIA-FINANCIADORA': '', 'NOME-AGENCIA': '' });
  return write(el, {
    'CODIGO-AGENCIA-FINANCIADORA': agency.code,
    'FLAG-BOLSA': 'SIM',
    'NOME-AGENCIA': agency.name,
  });
}

// ---------------------------------------------------------------------------
// Que campo vira qual lista

export type LiveKind = 'agencia' | 'area' | 'area-derivada' | 'curso' | 'instituicao';

/** O que o editor tem em mãos agora: as cópias guardadas e o que o conector sabe fazer. */
export interface LiveAvailability {
  agencies?: readonly Agency[];
  areas?: readonly AreaNode[];
  /** O conector lê cursos (extensão com a capacidade 'listas-lattes'). */
  courses: boolean;
  /** O conector busca instituição. */
  search: boolean;
}

/**
 * A lista que o campo usa, ou undefined para o campo de sempre. Instituição,
 * curso e agência valem só na formação acadêmica, onde o formulário do Lattes
 * usa essas janelas (seção 17 do mapa); nas outras telas o campo fica como era.
 * O curso precisa da instituição escolhida antes, como no Lattes.
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
  if (
    attr === 'NOME-AGENCIA' &&
    live.agencies?.length &&
    hasAttr(el, 'CODIGO-AGENCIA-FINANCIADORA')
  ) {
    return 'agencia';
  }
  const level = formationLevel(el.name);
  if (!level) return undefined;
  if (attr === 'NOME-INSTITUICAO' && live.search && hasAttr(el, 'CODIGO-INSTITUICAO')) {
    return 'instituicao';
  }
  if (
    attr === 'NOME-CURSO' &&
    live.courses &&
    !NO_COURSE.has(level) &&
    hasAttr(el, 'CODIGO-CURSO') &&
    (getAttr(el, 'CODIGO-INSTITUICAO') ?? '') !== ''
  ) {
    return 'curso';
  }
  return undefined;
}
