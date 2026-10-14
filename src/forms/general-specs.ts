// Campos dos formulários de item novo fora da produção (formação, atuação,
// projeto, patente). Cada parte lista os campos principais na ordem de quem
// preenche; o resto dos atributos do schema fica em "Mais campos". Um campo
// listado que o elemento não tem (cada nível de formação tem os seus) não
// aparece: a lista é uma preferência, o schema é que decide.
//
// Instituição, curso, agência e área ficam como texto, pelo AttributeField:
// quando as listas do Lattes chegarem aos campos tipados (LAT-48), estes
// formulários passam a usá-las sem mudança aqui.

import type { GeneralKind } from '../model/general-items.ts';
import { childElements, firstChild, type XElement } from '../model/xml.ts';
import type { LattesSchema } from '../schema/types.ts';
import type { FieldSpec } from './specs.ts';

export interface GeneralPart {
  fields: FieldSpec[];
  legend: string;
  /** A parte do item que os campos editam (o próprio item ou um filho). */
  part: (item: XElement) => XElement | undefined;
}

const f = (attr: string, extra: Omit<FieldSpec, 'attr'> = {}): FieldSpec => ({ attr, ...extra });
const required = (attr: string) => f(attr, { required: true });
const wide = (attr: string) => f(attr, { wide: true });
const self = (item: XElement) => item;

/** Os títulos de cada nível de formação: o primeiro que o elemento tiver vira o título. */
const FORMATION_TITLES = [
  'TITULO-DA-DISSERTACAO-TESE',
  'TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO',
  'TITULO-DA-MONOGRAFIA',
  'TITULO-DA-RESIDENCIA-MEDICA',
  'TITULO-DO-TRABALHO',
];

const FORMATION: GeneralPart[] = [
  {
    fields: [
      f('NOME-INSTITUICAO', { required: true, wide: true }),
      wide('NOME-CURSO'),
      f('STATUS-DO-CURSO'),
      required('ANO-DE-INICIO'),
      f('ANO-DE-CONCLUSAO'),
      f('ANO-DE-OBTENCAO-DO-TITULO'),
      f('CARGA-HORARIA'),
      f('TIPO-MESTRADO'),
      f('TIPO-DOUTORADO'),
      f('NUMERO-DO-REGISTRO'),
    ],
    legend: 'Curso',
    part: self,
  },
  {
    fields: [
      ...FORMATION_TITLES.map(wide),
      wide('NOME-COMPLETO-DO-ORIENTADOR'),
      wide('NOME-DO-ORIENTADOR'),
      wide('NOME-DO-CO-ORIENTADOR'),
    ],
    legend: 'Trabalho e orientação',
    part: self,
  },
  {
    fields: [f('FLAG-BOLSA'), wide('NOME-AGENCIA')],
    legend: 'Bolsa',
    part: self,
  },
];

const ATUACAO: GeneralPart[] = [
  {
    fields: [f('NOME-INSTITUICAO', { required: true, wide: true })],
    legend: 'Instituição',
    part: self,
  },
  {
    fields: [
      f('TIPO-DE-VINCULO'),
      f('OUTRO-VINCULO-INFORMADO'),
      f('ENQUADRAMENTO-FUNCIONAL'),
      f('OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO'),
      f('CARGA-HORARIA-SEMANAL'),
      f('FLAG-DEDICACAO-EXCLUSIVA'),
      f('FLAG-VINCULO-EMPREGATICIO'),
      f('MES-INICIO'),
      required('ANO-INICIO'),
      f('MES-FIM'),
      f('ANO-FIM'),
      f('OUTRAS-INFORMACOES', { multiline: true, wide: true }),
    ],
    legend: 'Vínculo',
    part: (item) => childElements(item, 'VINCULOS')[0],
  },
];

const PROJETO: GeneralPart[] = [
  {
    fields: [
      f('NOME-DO-PROJETO', { required: true, wide: true }),
      f('NATUREZA'),
      f('SITUACAO'),
      required('ANO-INICIO'),
      f('ANO-FIM'),
      f('DESCRICAO-DO-PROJETO', { multiline: true, wide: true }),
      f('FLAG-POTENCIAL-INOVACAO'),
    ],
    legend: 'Projeto',
    part: self,
  },
  {
    fields: [
      f('NUMERO-GRADUACAO'),
      f('NUMERO-ESPECIALIZACAO'),
      f('NUMERO-MESTRADO-ACADEMICO'),
      f('NUMERO-MESTRADO-PROF'),
      f('NUMERO-DOUTORADO'),
    ],
    legend: 'Alunos envolvidos',
    part: self,
  },
];

const PATENTE: GeneralPart[] = [
  {
    fields: [
      f('TITULO', { required: true, wide: true }),
      required('ANO-DESENVOLVIMENTO'),
      f('PAIS'),
      wide('HOME-PAGE'),
      f('FLAG-POTENCIAL-INOVACAO'),
    ],
    legend: 'Patente',
    part: (item) => firstChild(item, 'DADOS-BASICOS-DA-PATENTE'),
  },
  {
    fields: [
      f('TIPO-PATENTE'),
      required('CODIGO-DO-REGISTRO-OU-PATENTE'),
      wide('INSTITUICAO-DEPOSITO-REGISTRO'),
      f('DATA-PEDIDO-DE-DEPOSITO'),
      wide('NOME-DO-TITULAR'),
      wide('NOME-DO-DEPOSITANTE'),
    ],
    legend: 'Registro',
    part: (item) => {
      const detail = firstChild(item, 'DETALHAMENTO-DA-PATENTE');
      return detail && firstChild(detail, 'REGISTRO-OU-PATENTE');
    },
  },
  {
    fields: [wide('FINALIDADE'), wide('INSTITUICAO-FINANCIADORA')],
    legend: 'Detalhamento',
    part: (item) => firstChild(item, 'DETALHAMENTO-DA-PATENTE'),
  },
];

const PARTS: Record<GeneralKind, GeneralPart[]> = {
  atuacao: ATUACAO,
  formacao: FORMATION,
  patente: PATENTE,
  projeto: PROJETO,
};

export interface ShownPart {
  el: XElement;
  fields: FieldSpec[];
  legend: string;
}

/**
 * As partes do formulário para este item: só os campos que o schema dá ao
 * elemento, e só as partes que sobram com algum campo.
 */
export function generalParts(schema: LattesSchema, kind: GeneralKind, item: XElement): ShownPart[] {
  return PARTS[kind].flatMap((p) => {
    const el = p.part(item);
    if (!el) return [];
    const known = new Set(schema.elements[el.name]?.attributes.map((a) => a.name));
    const fields = p.fields.filter((field) => known.has(field.attr));
    return fields.length > 0 ? [{ el, fields, legend: p.legend }] : [];
  });
}

/** Campos obrigatórios do formulário que estão vazios. */
export function missingGeneral(parts: ShownPart[]): { attr: string; element: string }[] {
  return parts.flatMap((p) =>
    p.fields
      .filter((field) => field.required)
      .filter((field) => !(p.el.attrs.find((a) => a.name === field.attr)?.value ?? '').trim())
      .map((field) => ({ attr: field.attr, element: p.el.name })),
  );
}
