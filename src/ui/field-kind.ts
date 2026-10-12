// Que tipo de controle um atributo merece na tela.

import { elementLabel } from '../labels/labels.ts';
import type { AttributeSpec } from '../schema/types.ts';

/**
 * Campos que o Lattes gera e que não se editam à mão: números de sequência,
 * códigos de instituição, curso, área e CAPES, nível da formação (código),
 * identificadores e formatos. Mudar um deles quebra referências (a tabela de
 * instituições, por exemplo) ou o casamento com a exportação.
 *
 * Também os derivados de outra escolha: a sigla do país sai do país
 * escolhido, a sigla e a UF da instituição saem da tabela de instituições, a
 * data e a hora de atualização são carimbadas pelo Lattes ao salvar, e o
 * ORCID entra pela vinculação com o próprio ORCID, não digitado.
 */
const SYSTEM =
  /^(SEQUENCIA-|CODIGO-|COD-|ID-|NUMERO-IDENTIFICADOR$|NRO-ID-CNPQ$|FORMATO-|STATUS-OASISBR$|SIGLA-PAIS-|SIGLA-INSTITUICAO$|SIGLA-UF-INSTITUICAO$|DATA-ATUALIZACAO$|HORA-ATUALIZACAO$|ORCID-ID$)/;

/** CPF do dono do currículo vem do cadastro; o CPF de autor é digitado. */
const OWNER_ONLY: Record<string, string> = {
  CPF: 'DADOS-GERAIS',
  IDIOMA: 'IDIOMA',
  // B ou E, posto pelo próprio formulário do Lattes conforme o país de nacionalidade.
  NACIONALIDADE: 'DADOS-GERAIS',
};

/**
 * Códigos que o Lattes grava e mostra por extenso, lidos nos formulários dele.
 * NACIONALIDADE: o formulário de identificação põe "B" (exige CPF e RG) ou
 * "E" (estrangeira), visto no JavaScript de prc_ident. TIPO-MESTRADO: o rádio
 * "normal / sanduíche" do formulário de mestrado (f_tpo_doutorado). NIVEL da
 * formação complementar: a lista f_nivel do pkg_formacao_compl. Todos vistos
 * em 11/10/2026.
 */
const CODE_VALUES: Record<string, Record<string, string>> = {
  'DADOS-GERAIS NACIONALIDADE': { B: 'Brasileira', E: 'Estrangeira' },
  'MESTRADO TIPO-MESTRADO': { N: 'Normal', S: 'Sanduíche' },
};

const COMPLEMENTARY_LEVELS: Record<string, string> = {
  '8': 'Extensão universitária',
  E: 'MBA',
  F: 'Curso de curta duração',
  Y: 'Outros',
};

export function codeValueLabel(element: string, attr: string, value: string): string {
  if (attr === 'NIVEL' && COMPLEMENTARY_LEVELS[value]) return COMPLEMENTARY_LEVELS[value];
  // O nível da formação acadêmica é o próprio tipo do item (3 em MESTRADO).
  if (attr === 'NIVEL' && LEVEL_FROM_TYPE.test(element)) return elementLabel(element);
  return CODE_VALUES[`${element} ${attr}`]?.[value] ?? value;
}

/** Opções de um código que a pessoa escolhe (rádio ou lista no Lattes), com o nome de cada uma. */
export function codeChoices(
  element: string,
  attr: string,
): { label: string; value: string }[] | undefined {
  const table = CODE_VALUES[`${element} ${attr}`];
  if (!table || isSystemAttr(element, attr)) return undefined;
  return Object.entries(table).map(([value, label]) => ({ label, value }));
}

/**
 * Nome que acompanha um código escolhido numa lista do Lattes (instituição,
 * órgão, curso, agência, idioma, país). Com o código preenchido, o nome não
 * se edita aqui: mudar só o nome deixaria os dois discordando ("Inglês" com
 * código ES). Devolve o atributo do código, ou undefined se o campo é livre.
 */
export function codeAttrFor(element: string, attr: string): string | undefined {
  if (element === 'IDIOMA' && attr === 'DESCRICAO-DO-IDIOMA') return 'IDIOMA';
  if (element === 'DADOS-GERAIS' && attr === 'PAIS-DE-NACIONALIDADE') {
    return 'SIGLA-PAIS-NACIONALIDADE';
  }
  if (attr === 'NOME-AGENCIA') return 'CODIGO-AGENCIA-FINANCIADORA';
  const m = /^NOME-(?:DA-|DO-)?(INSTITUICAO|ORGAO|UNIDADE|CURSO)(-.+)?$/.exec(attr);
  if (!m || attr.endsWith('-INGLES')) return undefined;
  return `CODIGO-${m[1]}${m[2] ?? ''}`;
}

/**
 * Nível que o Lattes põe conforme o tipo de formação escolhido (NIVEL 3 em
 * MESTRADO, F e Y na formação complementar) e o nível do curso na tabela de
 * cursos (NIVEL-CURSO). Ficam entre os códigos do Lattes, sem edição.
 */
const LEVEL_CODES = /^(NIVEL|NIVEL-CURSO)$/;

/** Formação acadêmica: um elemento por nível, então o nome do elemento diz o nível. */
const LEVEL_FROM_TYPE =
  /^(GRADUACAO|ESPECIALIZACAO|MESTRADO|DOUTORADO|POS-DOUTORADO|LIVRE-DOCENCIA|CURSO-TECNICO-PROFISSIONALIZANTE|MESTRADO-PROFISSIONALIZANTE|ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU|ENSINO-MEDIO-SEGUNDO-GRAU|RESIDENCIA-MEDICA|APERFEICOAMENTO|MBA)$/;

export function isSystemAttr(element: string, attr: string): boolean {
  return SYSTEM.test(attr) || OWNER_ONLY[attr] === element || LEVEL_CODES.test(attr);
}

/**
 * Sim/não: enum que só tem SIM e NAO, ou FLAG-* em texto livre que guarda
 * SIM/NAO (FLAG-BOLSA, por exemplo). FLAG-* com outros valores (FLAG-PERIODO:
 * ANTERIOR/ATUAL) continua lista.
 */
export function isBooleanAttr(
  attr: string,
  spec: AttributeSpec | undefined,
  value: string,
): boolean {
  if (spec?.enum) {
    return spec.enum.length === 2 && spec.enum.includes('SIM') && spec.enum.includes('NAO');
  }
  return attr.startsWith('FLAG-') && (value === '' || value === 'SIM' || value === 'NAO');
}

/** Grupos de campos por assunto, na ordem em que aparecem num bloco. */
const GROUPS: { label: string; test: RegExp }[] = [
  {
    label: 'Principal',
    test: /^(TITULO|NOME-CURSO|NOME-DO-PROJETO|DESCRICAO|NATUREZA|TIPO|NIVEL|STATUS|SITUACAO|FORMA-|ENQUADRAMENTO|OUTRO-ENQUADRAMENTO)/,
  },
  { label: 'Instituição', test: /(INSTITUICAO|ORGAO|UNIDADE|EMPRESA)/ },
  { label: 'Período', test: /^(ANO|MES|DATA|CARGA|DURACAO)|PERIODO/ },
  { label: 'Pessoas', test: /(ORIENTADOR|ORIENTADO|AUTOR|PARTICIPANTE|COORIENTADOR|INTEGRANTE)/ },
  { label: 'Local e idioma', test: /^(PAIS|CIDADE|UF|LOCAL|IDIOMA|SIGLA-UF|SIGLA-PAIS)/ },
  {
    label: 'Publicação',
    test: /(PERIODICO|EVENTO|ANAIS|EDITORA|VOLUME|FASCICULO|SERIE|PAGINA|ISSN|ISBN|^DOI$|HOME-PAGE|MEIO-DE-DIVULGACAO)/,
  },
  { label: 'Bolsa e fomento', test: /(BOLSA|AGENCIA|FINANCIADOR)/ },
  { label: 'Palavras-chave e setores', test: /^(PALAVRA-CHAVE|SETOR-DE-ATIVIDADE)/ },
];

/**
 * Blocos com ordem fixa, na ordem em que se preenche um endereço: quem, onde,
 * como falar. DDD fica antes do telefone, na mesma linha.
 */
const ADDRESS_LAYOUT: { attrs: string[]; label: string }[] = [
  { attrs: ['NOME-INSTITUICAO-EMPRESA', 'NOME-ORGAO', 'NOME-UNIDADE'], label: 'Instituição' },
  {
    attrs: [
      'LOGRADOURO-COMPLEMENTO',
      'LOGRADOURO',
      'BAIRRO',
      'CEP',
      'CIDADE',
      'UF',
      'PAIS',
      'CAIXA-POSTAL',
    ],
    label: 'Localização',
  },
  { attrs: ['DDD', 'TELEFONE', 'RAMAL', 'FAX', 'E-MAIL', 'HOME-PAGE'], label: 'Contato' },
];

const FIXED_LAYOUT: Record<string, { attrs: string[]; label: string }[]> = {
  ENDERECO: [
    { attrs: ['FLAG-DE-PREFERENCIA'], label: 'Preferência' },
    { attrs: ['ELETRONICO', 'REDE-SOCIAL', 'OUTRA-FORMA-DE-CONTATO'], label: 'Contatos' },
  ],
  'ENDERECO-PROFISSIONAL': ADDRESS_LAYOUT,
  'ENDERECO-RESIDENCIAL': ADDRESS_LAYOUT,
  IDIOMA: [
    { attrs: ['DESCRICAO-DO-IDIOMA', 'IDIOMA'], label: 'Idioma' },
    {
      attrs: [
        'PROFICIENCIA-DE-LEITURA',
        'PROFICIENCIA-DE-FALA',
        'PROFICIENCIA-DE-ESCRITA',
        'PROFICIENCIA-DE-COMPREENSAO',
      ],
      label: 'Proficiência',
    },
  ],
};

/** Grupo e posição de um campo num bloco de ordem fixa. */
function fixedSlot(element: string, attr: string): { label: string; rank: number } | undefined {
  const layout = FIXED_LAYOUT[element];
  if (!layout) return undefined;
  for (const group of layout) {
    const rank = group.attrs.indexOf(attr);
    if (rank >= 0) return { label: group.label, rank };
  }
  return undefined;
}

/** Um campo de um bloco: o atributo e o elemento onde ele mora. */
export interface FieldEntry {
  attr: string;
  element: string;
  /** Chave única no bloco (o mesmo atributo pode existir em duas partes). */
  key: string;
}

export interface FieldGroup {
  entries: FieldEntry[];
  label: string;
  /** Campos só de leitura (códigos do Lattes). */
  system: boolean;
}

/** Início antes de fim dentro do período; o resto em ordem alfabética do rótulo. */
function periodRank(attr: string): number {
  if (/INICIO/.test(attr)) return 0;
  if (/(FIM|CONCLUSAO|OBTENCAO)/.test(attr)) return 2;
  return 1;
}

/**
 * Ordena os campos de um bloco por assunto (relação primeiro), depois pelo
 * rótulo; sim/não juntos em "Marcações" e os códigos do Lattes no fim. O
 * bloco pode juntar campos de várias partes do item (dados básicos,
 * detalhamento, palavras-chave), que aparecem como um só formulário.
 */
export function groupFields(
  entries: FieldEntry[],
  labelOf: (attr: string) => string,
  isBoolean: (entry: FieldEntry) => boolean,
): FieldGroup[] {
  const buckets = new Map<string, FieldEntry[]>();
  const fixedLabels = [
    ...new Set(entries.flatMap((e) => FIXED_LAYOUT[e.element]?.map((g) => g.label) ?? [])),
  ];
  // Rótulo repetido (Instituição existe nos dois) aparece uma vez só, na posição fixa.
  const order = [
    ...new Set([
      ...fixedLabels,
      ...GROUPS.map((g) => g.label),
      'Marcações',
      'Outros',
      'Códigos do Lattes',
    ]),
  ];
  const rankOf = (e: FieldEntry) => fixedSlot(e.element, e.attr)?.rank;
  // Código com o nome dele no bloco vai logo depois do nome, lado a lado.
  const pairedCodes = new Map<string, FieldEntry>();
  for (const entry of entries) {
    const code = codeAttrFor(entry.element, entry.attr);
    const codeEntry = code && entries.find((e) => e.attr === code && e.element === entry.element);
    if (codeEntry && !fixedSlot(codeEntry.element, codeEntry.attr)) {
      pairedCodes.set(entry.key, codeEntry);
    }
  }
  const paired = new Set([...pairedCodes.values()].map((e) => e.key));
  for (const entry of entries) {
    if (paired.has(entry.key)) continue;
    const fixed = fixedSlot(entry.element, entry.attr)?.label;
    const label =
      fixed ??
      (isSystemAttr(entry.element, entry.attr)
        ? 'Códigos do Lattes'
        : isBoolean(entry)
          ? 'Marcações'
          : (GROUPS.find((g) => g.test.test(entry.attr))?.label ?? 'Outros'));
    buckets.set(label, [...(buckets.get(label) ?? []), entry]);
  }
  return order
    .filter((label) => buckets.has(label))
    .map((label) => ({
      entries: buckets
        .get(label)!
        .sort(
          (a, b) =>
            (rankOf(a) ?? 99) - (rankOf(b) ?? 99) ||
            (label === 'Período' ? periodRank(a.attr) - periodRank(b.attr) : 0) ||
            labelOf(a.attr).localeCompare(labelOf(b.attr), 'pt-BR'),
        )
        .flatMap((e) => {
          const code = pairedCodes.get(e.key);
          return code ? [e, code] : [e];
        }),
      label,
      system: label === 'Códigos do Lattes',
    }));
}
