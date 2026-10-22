// Campos dos formulários de item novo fora da produção (formação, atuação,
// projeto, patente e registros). Cada parte lista os campos principais na
// ordem de quem preenche; o resto dos atributos do schema fica em "Mais
// campos". Um campo listado que o elemento não tem (cada nível de formação tem
// os seus) não aparece: a lista é uma preferência, o schema é que decide.
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

/** A parte do item cujo nome começa assim (DADOS-BASICOS-DA-MARCA, DETALHAMENTO-DA-CULTIVAR…). */
const partNamed = (prefix: string) => (item: XElement) =>
  childElements(item).find((c) => c.name.startsWith(prefix));

/**
 * Campos que o formulário de inclusão do Lattes não tem para o tipo (censo de
 * 15/10/2026): ficam fora da lista principal, em "Mais campos". O tipo do
 * registro só se escolhe na patente e na marca; o desenho industrial e a
 * patente não têm ano visível; a cultivar e a marca não têm finalidade.
 */
const NOT_IN_FORM: Record<string, string[]> = {
  'CULTIVAR-PROTEGIDA': ['TIPO-PATENTE', 'FINALIDADE', 'INSTITUICAO-FINANCIADORA'],
  'CULTIVAR-REGISTRADA': ['TIPO-PATENTE', 'FINALIDADE', 'INSTITUICAO-FINANCIADORA'],
  'DESENHO-INDUSTRIAL': ['TIPO-PATENTE', 'ANO-DESENVOLVIMENTO'],
  MARCA: ['FINALIDADE'],
  PATENTE: ['ANO-DESENVOLVIMENTO'],
  'TOPOGRAFIA-DE-CIRCUITO-INTEGRADO': ['TIPO-PATENTE'],
};

/**
 * Patente e registros: os campos de cada um saem do schema (a cultivar tem
 * denominação e ano de solicitação no lugar de título e ano de
 * desenvolvimento; a marca tem natureza).
 */
const PATENTE: GeneralPart[] = [
  {
    fields: [
      f('TITULO', { required: true, wide: true }),
      f('DENOMINACAO', { required: true, wide: true }),
      required('ANO-DESENVOLVIMENTO'),
      required('ANO-SOLICITACAO'),
      f('PAIS'),
      wide('HOME-PAGE'),
      f('FLAG-POTENCIAL-INOVACAO'),
    ],
    legend: 'Registro',
    part: partNamed('DADOS-BASICOS-'),
  },
  {
    fields: [
      f('TIPO-PATENTE'),
      required('CODIGO-DO-REGISTRO-OU-PATENTE'),
      wide('INSTITUICAO-DEPOSITO-REGISTRO'),
      f('DATA-PEDIDO-DE-DEPOSITO'),
      f('DATA-DE-CONCESSAO'),
      wide('NOME-DO-TITULAR'),
      wide('NOME-DO-DEPOSITANTE'),
    ],
    legend: 'Número e depósito',
    part: (item) => {
      const detail = partNamed('DETALHAMENTO-')(item);
      return detail && firstChild(detail, 'REGISTRO-OU-PATENTE');
    },
  },
  {
    fields: [f('NATUREZA'), wide('FINALIDADE'), wide('INSTITUICAO-FINANCIADORA')],
    legend: 'Detalhamento',
    part: partNamed('DETALHAMENTO-'),
  },
];

/** Um vínculo novo numa atuação que já existe: os campos do vínculo da atuação. */
const VINCULO: GeneralPart[] = [{ ...ATUACAO[1]!, part: self }];

/**
 * Os dados gerais, na ordem dos formulários do Lattes (seções 5 e 16; censo de
 * 15/10/2026). O prêmio exige nome e ano (check(), seção 16).
 */
// O idioma é escolhido pelo nome, na lista do formulário do Lattes; o código
// (IDIOMA) vai junto (linked-attrs.ts) e fica entre os códigos do Lattes.
const IDIOMA: GeneralPart[] = [
  {
    fields: [
      f('DESCRICAO-DO-IDIOMA', { required: true, wide: true }),
      f('PROFICIENCIA-DE-LEITURA'),
      f('PROFICIENCIA-DE-FALA'),
      f('PROFICIENCIA-DE-ESCRITA'),
      f('PROFICIENCIA-DE-COMPREENSAO'),
    ],
    legend: 'Idioma',
    part: self,
  },
];

const PREMIO: GeneralPart[] = [
  {
    fields: [
      f('NOME-DO-PREMIO-OU-TITULO', { required: true, wide: true }),
      wide('NOME-DA-ENTIDADE-PROMOTORA'),
      required('ANO-DA-PREMIACAO'),
      wide('NOME-DO-PREMIO-OU-TITULO-INGLES'),
    ],
    legend: 'Prêmio ou título',
    part: self,
  },
];

const LICENCA: GeneralPart[] = [
  {
    fields: [required('TIPO-LICENCA'), required('DATA-INICIO-LICENCA'), f('DATA-FIM-LICENCA')],
    legend: 'Licença',
    part: self,
  },
];

const AREA: GeneralPart[] = [
  {
    fields: [
      required('NOME-GRANDE-AREA-DO-CONHECIMENTO'),
      wide('NOME-DA-AREA-DO-CONHECIMENTO'),
      wide('NOME-DA-SUB-AREA-DO-CONHECIMENTO'),
      wide('NOME-DA-ESPECIALIDADE'),
    ],
    legend: 'Área',
    part: self,
  },
];

/** As atividades de uma atuação: o período, e o que cada natureza tem a mais. */
const ATIVIDADE: GeneralPart[] = [
  {
    fields: [
      f('TIPO-ENSINO'),
      wide('NOME-CURSO'),
      f('FORMATO-CARGO-OU-FUNCAO'),
      wide('CARGO-OU-FUNCAO'),
      wide('NOME-ORGAO'),
      wide('NOME-UNIDADE'),
      wide('ESPECIFICACAO'),
    ],
    legend: 'Atividade',
    part: self,
  },
  {
    fields: [f('MES-INICIO'), required('ANO-INICIO'), f('MES-FIM'), f('ANO-FIM')],
    legend: 'Período',
    part: self,
  },
];

const LINHA: GeneralPart[] = [
  {
    fields: [
      f('TITULO-DA-LINHA-DE-PESQUISA', { required: true, wide: true }),
      f('FLAG-LINHA-DE-PESQUISA-ATIVA'),
      f('OBJETIVOS-LINHA-DE-PESQUISA', { multiline: true, wide: true }),
    ],
    legend: 'Linha de pesquisa',
    part: self,
  },
];

/** Financiador, produção e orientação de um projeto: cada um tem os seus. */
const PARTE_PROJETO: GeneralPart[] = [
  {
    fields: [
      f('NOME-INSTITUICAO', { required: true, wide: true }),
      f('NATUREZA'),
      f('TITULO-DA-PRODUCAO-CT', { required: true, wide: true }),
      f('TIPO-PRODUCAO-CT'),
      f('TITULO-ORIENTACAO', { required: true, wide: true }),
      f('TIPO-ORIENTACAO'),
    ],
    legend: 'No projeto',
    part: self,
  },
];

const PARTS: Record<GeneralKind, GeneralPart[]> = {
  area: AREA,
  atividade: ATIVIDADE,
  atuacao: ATUACAO,
  formacao: FORMATION,
  idioma: IDIOMA,
  licenca: LICENCA,
  linha: LINHA,
  'parte-projeto': PARTE_PROJETO,
  patente: PATENTE,
  premio: PREMIO,
  projeto: PROJETO,
  // Disciplina e treinamento são só um nome: o formulário próprio é TextItemForm.
  texto: [],
  vinculo: VINCULO,
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
    if (kind === 'patente') for (const attr of NOT_IN_FORM[item.name] ?? []) known.delete(attr);
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
