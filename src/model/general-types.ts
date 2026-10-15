// Os tipos de item novo fora da produção que cada seção do editor cria
// (LAT-52, LAT-57): o elemento do XML, onde ele entra, o rótulo e o número de
// sequência. A montagem e a inserção ficam em general-items.ts.

import type { LattesSchema } from '../schema/types.ts';
import { SEQ_ATTR } from './production.ts';

/**
 * `patente` cobre a patente e os outros registros, que têm a mesma forma;
 * `atividade`, as nove atividades de uma atuação; `texto`, os itens que são só
 * um nome (disciplina e treinamento); `parte-projeto`, o que fica dentro de um
 * projeto (financiador, produção, orientação).
 */
export type GeneralKind =
  | 'area'
  | 'atividade'
  | 'atuacao'
  | 'formacao'
  | 'idioma'
  | 'licenca'
  | 'linha'
  | 'parte-projeto'
  | 'patente'
  | 'premio'
  | 'projeto'
  | 'texto'
  | 'vinculo';

export interface GeneralType {
  /**
   * Contêineres da raiz até o pai do item; com `host`, a partir do item que
   * recebe este. O projeto entra dentro de uma atuação.
   */
  containerPath: string[];
  /**
   * O item que recebe este (ATUACAO-PROFISSIONAL para o vínculo e as
   * atividades, ENSINO para a disciplina, PROJETO-DE-PESQUISA para o
   * financiador…): escolhido antes do formulário.
   */
  host?: string;
  itemName: string;
  kind: GeneralKind;
  /** Rótulo no singular, como o Lattes chama o item. */
  label: string;
  /** Atributo de sequência do próprio item; vazio nos itens sem número (idioma, prêmio). */
  seqAttr: string;
  /** O item é só um texto (DISCIPLINA, TREINAMENTO): o nome fica no conteúdo do elemento. */
  text?: boolean;
}

/**
 * Os níveis do "Incluir novo item" da formação acadêmica, com o texto do combo
 * do Lattes (reconhecimento de 10/10/2026, seção 4.2). Pós-doutorado e
 * livre-docência não estão nesse combo; ficam no fim, com o rótulo gerado.
 */
const FORMATION_LABELS: Record<string, string> = {
  APERFEICOAMENTO: 'Aperfeiçoamento',
  'CURSO-TECNICO-PROFISSIONALIZANTE': 'Ensino Profissional de nível técnico',
  DOUTORADO: 'Doutorado',
  'ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU': 'Ensino Fundamental',
  'ENSINO-MEDIO-SEGUNDO-GRAU': 'Ensino Médio',
  ESPECIALIZACAO: 'Especialização',
  GRADUACAO: 'Graduação',
  MESTRADO: 'Mestrado',
  'MESTRADO-PROFISSIONALIZANTE': 'Mestrado Profissional',
  'RESIDENCIA-MEDICA': 'Especialização - Residência médica',
};

/** Ordem do combo do Lattes: doutorado, mestrado, mestrado profissional… */
const FORMATION_ORDER = [
  'DOUTORADO',
  'MESTRADO',
  'MESTRADO-PROFISSIONALIZANTE',
  'ESPECIALIZACAO',
  'RESIDENCIA-MEDICA',
  'GRADUACAO',
  'CURSO-TECNICO-PROFISSIONALIZANTE',
  'ENSINO-MEDIO-SEGUNDO-GRAU',
  'ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU',
  'APERFEICOAMENTO',
];

/**
 * A patente e os registros da seção "Patentes e Registros", na ordem e com os
 * nomes das listas do Lattes (docs/lattes_internals.md, seção 17; censo de
 * 15/10/2026, src/census/targets-production.ts). Todos são inclusões de
 * PKG_PATENTE_REGISTRO e têm a mesma forma no XML: dados básicos,
 * detalhamento com um REGISTRO-OU-PATENTE e autores. O programa de computador
 * fica em Produções (SOFTWARE, pelo Importar).
 */
const REGISTRIES: [string, string][] = [
  ['PATENTE', 'Patente'],
  ['CULTIVAR-PROTEGIDA', 'Cultivar protegida'],
  ['CULTIVAR-REGISTRADA', 'Cultivar registrada'],
  ['DESENHO-INDUSTRIAL', 'Desenho industrial'],
  ['MARCA', 'Marca'],
  ['TOPOGRAFIA-DE-CIRCUITO-INTEGRADO', 'Topografia de circuito integrado'],
];

const FORMATION_PATH = ['DADOS-GERAIS', 'FORMACAO-ACADEMICA-TITULACAO'];
const ATUACAO_PATH = ['DADOS-GERAIS', 'ATUACOES-PROFISSIONAIS'];

/**
 * Formação complementar, com os níveis da lista f_nivel do formulário do
 * Lattes (PKG_FORMACAO_COMPL.form, captura de 13/10/2026 e censo).
 */
const COMPLEMENTARY: GeneralType[] = (
  [
    ['FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO', 'Curso de curta duração'],
    ['FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA', 'Extensão universitária'],
    ['MBA', 'MBA'],
    ['OUTROS', 'Outros (formação complementar)'],
  ] as const
).map(([itemName, label]) => ({
  containerPath: ['DADOS-COMPLEMENTARES', 'FORMACAO-COMPLEMENTAR'],
  itemName,
  kind: 'formacao',
  label,
  seqAttr: 'SEQUENCIA-FORMACAO',
}));

/** Idiomas, prêmios, licenças e áreas de atuação: as listas dos dados gerais. */
const GENERAL_DATA: GeneralType[] = [
  {
    containerPath: ['DADOS-GERAIS', 'IDIOMAS'],
    itemName: 'IDIOMA',
    kind: 'idioma',
    label: 'Idioma',
    seqAttr: '',
  },
  {
    containerPath: ['DADOS-GERAIS', 'PREMIOS-TITULOS'],
    itemName: 'PREMIO-TITULO',
    kind: 'premio',
    label: 'Prêmio ou título',
    seqAttr: '',
  },
  {
    containerPath: ['DADOS-GERAIS', 'LICENCAS'],
    itemName: 'LICENCA',
    kind: 'licenca',
    label: 'Licença',
    seqAttr: '',
  },
  {
    containerPath: ['DADOS-GERAIS', 'AREAS-DE-ATUACAO'],
    itemName: 'AREA-DE-ATUACAO',
    kind: 'area',
    label: 'Área de atuação',
    seqAttr: 'SEQUENCIA-AREA-DE-ATUACAO',
  },
];

/**
 * As atividades de uma atuação, na ordem de selecionarNatureza() do Lattes
 * (docs/lattes_internals.md, seção 17), com o rótulo de cada natureza.
 */
const ACTIVITIES: [string, string, string][] = [
  ['DIRECAO-E-ADMINISTRACAO', 'ATIVIDADES-DE-DIRECAO-E-ADMINISTRACAO', 'Direção e administração'],
  [
    'PESQUISA-E-DESENVOLVIMENTO',
    'ATIVIDADES-DE-PESQUISA-E-DESENVOLVIMENTO',
    'Pesquisa e desenvolvimento',
  ],
  ['ENSINO', 'ATIVIDADES-DE-ENSINO', 'Ensino'],
  ['ESTAGIO', 'ATIVIDADES-DE-ESTAGIO', 'Estágio'],
  [
    'SERVICO-TECNICO-ESPECIALIZADO',
    'ATIVIDADES-DE-SERVICO-TECNICO-ESPECIALIZADO',
    'Serviço técnico especializado',
  ],
  ['EXTENSAO-UNIVERSITARIA', 'ATIVIDADES-DE-EXTENSAO-UNIVERSITARIA', 'Extensão universitária'],
  ['TREINAMENTO-MINISTRADO', 'ATIVIDADES-DE-TREINAMENTO-MINISTRADO', 'Treinamento'],
  [
    'OUTRA-ATIVIDADE-TECNICO-CIENTIFICA',
    'OUTRAS-ATIVIDADES-TECNICO-CIENTIFICA',
    'Outra atividade técnico-científica',
  ],
  [
    'CONSELHO-COMISSAO-E-CONSULTORIA',
    'ATIVIDADES-DE-CONSELHO-COMISSAO-E-CONSULTORIA',
    'Conselhos, comissões e consultoria',
  ],
];

/** O que entra numa atuação que já existe: vínculo, atividades e o que fica dentro delas. */
const ATUACAO_PARTS: GeneralType[] = [
  {
    containerPath: [],
    host: 'ATUACAO-PROFISSIONAL',
    itemName: 'VINCULOS',
    kind: 'vinculo',
    label: 'Vínculo numa atuação',
    seqAttr: 'SEQUENCIA-HISTORICO',
  },
  ...ACTIVITIES.map(([itemName, container, label]): GeneralType => ({
    containerPath: [container],
    host: 'ATUACAO-PROFISSIONAL',
    itemName,
    kind: 'atividade',
    label: `Atividade: ${label.toLowerCase()}`,
    seqAttr: 'SEQUENCIA-FUNCAO-ATIVIDADE',
  })),
  {
    containerPath: [],
    host: 'ENSINO',
    itemName: 'DISCIPLINA',
    kind: 'texto',
    label: 'Disciplina',
    seqAttr: 'SEQUENCIA-ESPECIFICACAO',
    text: true,
  },
  {
    containerPath: [],
    host: 'TREINAMENTO-MINISTRADO',
    itemName: 'TREINAMENTO',
    kind: 'texto',
    label: 'Treinamento ministrado',
    seqAttr: 'SEQUENCIA-ESPECIFICACAO',
    text: true,
  },
  {
    containerPath: [],
    host: 'PESQUISA-E-DESENVOLVIMENTO',
    itemName: 'LINHA-DE-PESQUISA',
    kind: 'linha',
    label: 'Linha de pesquisa',
    seqAttr: 'SEQUENCIA-LINHA',
  },
];

/** O que entra num projeto que já existe. */
const PROJECT_PARTS: GeneralType[] = (
  [
    [
      'FINANCIADOR-DO-PROJETO',
      'FINANCIADORES-DO-PROJETO',
      'Financiador do projeto',
      'SEQUENCIA-FINANCIADOR',
    ],
    [
      'PRODUCAO-CT-DO-PROJETO',
      'PRODUCOES-CT-DO-PROJETO',
      'Produção do projeto',
      'SEQUENCIA-PRODUCAO-CT',
    ],
    ['ORIENTACAO', 'ORIENTACOES', 'Orientação do projeto', 'SEQUENCIA-ORIENTACAO'],
  ] as const
).map(([itemName, container, label, seqAttr]) => ({
  containerPath: [container],
  host: 'PROJETO-DE-PESQUISA',
  itemName,
  kind: 'parte-projeto',
  label,
  seqAttr,
}));

/**
 * Elementos que o editor cria junto com outro, sem botão próprio: a
 * participação em projeto nasce com o projeto (insertGeneralItem).
 */
export const CREATED_WITH: Record<string, string> = {
  'PARTICIPACAO-EM-PROJETO': 'PROJETO-DE-PESQUISA',
};

/**
 * Os tipos que cada seção cria, a partir do schema: todo filho de
 * FORMACAO-ACADEMICA-TITULACAO é um nível. `labelOf` dá o rótulo dos níveis
 * que não estão no combo do Lattes.
 */
export function generalTypes(
  schema: LattesSchema,
  sectionId: string,
  labelOf: (itemName: string) => string,
): GeneralType[] {
  if (sectionId === 'formacao') {
    const levels = (schema.elements['FORMACAO-ACADEMICA-TITULACAO']?.children ?? []).map(
      (c) => c.name,
    );
    const rank = (n: string) => {
      const i = FORMATION_ORDER.indexOf(n);
      return i < 0 ? FORMATION_ORDER.length : i;
    };
    return [...levels]
      .sort((a, b) => rank(a) - rank(b))
      .map((itemName): GeneralType => ({
        containerPath: FORMATION_PATH,
        itemName,
        kind: 'formacao',
        label: FORMATION_LABELS[itemName] ?? labelOf(itemName),
        seqAttr: 'SEQUENCIA-FORMACAO',
      }))
      .concat(COMPLEMENTARY);
  }
  if (sectionId === 'atuacao') {
    return [
      {
        containerPath: ATUACAO_PATH,
        itemName: 'ATUACAO-PROFISSIONAL',
        kind: 'atuacao',
        label: 'Atuação profissional',
        seqAttr: 'SEQUENCIA-ATIVIDADE',
      },
      ...ATUACAO_PARTS,
    ];
  }
  if (sectionId === 'projetos') {
    return [
      {
        containerPath: [...ATUACAO_PATH, 'ATUACAO-PROFISSIONAL'],
        itemName: 'PROJETO-DE-PESQUISA',
        kind: 'projeto',
        label: 'Projeto',
        seqAttr: 'SEQUENCIA-PROJETO',
      },
      ...PROJECT_PARTS,
    ];
  }
  if (sectionId === 'dados-gerais') return GENERAL_DATA;
  if (sectionId === 'patentes') {
    return REGISTRIES.filter(([itemName]) => schema.elements[itemName]).map(
      ([itemName, label]) => ({
        containerPath: ['PRODUCAO-TECNICA'],
        itemName,
        kind: 'patente' as const,
        label,
        seqAttr: SEQ_ATTR,
      }),
    );
  }
  return [];
}
