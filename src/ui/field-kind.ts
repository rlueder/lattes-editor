// Que tipo de controle um atributo merece na tela.

import { elementLabel } from '../labels/labels.ts';
import type { AttributeSpec } from '../schema/types.ts';
import { formLayout, formSlot, IN_ENGLISH, isEnglishAttr, OTHER_DATA } from './form-order.ts';

/**
 * Campos que o Lattes gera e que não se editam à mão: números de sequência,
 * códigos de instituição, curso, área e CAPES, nível da formação (código),
 * identificadores e formatos. Mudar um deles quebra referências (a tabela de
 * instituições, por exemplo) ou o casamento com a exportação.
 *
 * Também os derivados de outra escolha: a sigla do país sai do país
 * escolhido, a sigla e a UF da instituição saem da tabela de instituições, a
 * data e a hora de atualização são carimbadas pelo Lattes ao salvar, e o
 * ORCID entra pela vinculação com o próprio ORCID, não digitado. O número
 * Lattes do orientador (ou do orientado) é o que o formulário acha ao
 * "verificar o nome do orientador na base Lattes", não digitado.
 */
const SYSTEM =
  /^(SEQUENCIA-|NUMERO-ID-ORIENT|CODIGO-|COD-|ID-|NUMERO-IDENTIFICADOR$|NRO-ID-CNPQ$|FORMATO-|STATUS-OASISBR$|SIGLA-PAIS-|SIGLA-INSTITUICAO$|SIGLA-UF-INSTITUICAO$|DATA-ATUALIZACAO$|HORA-ATUALIZACAO$|ORCID-ID$)/;

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

/**
 * Começam por CODIGO- mas quem preenche é a pessoa: o número do registro ou da
 * patente é o campo de texto f_cod_reg do formulário de patente
 * (docs/lattes_internals.md, seção 17).
 */
const TYPED_CODES = new Set(['CODIGO-DO-REGISTRO-OU-PATENTE']);

export function isSystemAttr(element: string, attr: string): boolean {
  if (TYPED_CODES.has(attr)) return false;
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

/**
 * Grupos por assunto para os elementos cuja ordem no Lattes não é conhecida
 * (form-order.ts tem os que são). O nome e a cidade do evento são do evento,
 * não da publicação; o título dos anais e o do periódico são da publicação.
 */
const GROUPS: { label: string; test: RegExp }[] = [
  {
    label: 'Principal',
    // O título dos anais, do periódico ou do livro é de onde saiu, não do item.
    test: /^(TITULO(?!-(DOS?|DA)-(ANAIS|PERIODICO|LIVRO|JORNAL))|NOME-CURSO|NOME-DO-PROJETO|DESCRICAO|NATUREZA|TIPO|NIVEL|STATUS|SITUACAO|FORMA-|ENQUADRAMENTO|OUTRO-ENQUADRAMENTO)/,
  },
  { label: 'Instituição', test: /(INSTITUICAO|ORGAO|UNIDADE|EMPRESA)/ },
  {
    label: 'Evento',
    test: /^(NOME-DO-EVENTO|CIDADE-DO-EVENTO|LOCAL-DO-EVENTO|ANO-DE-REALIZACAO|CLASSIFICACAO-DO-EVENTO)/,
  },
  { label: 'Período', test: /^(ANO|MES|DATA|CARGA|DURACAO)|PERIODO/ },
  { label: 'Pessoas', test: /(ORIENTADOR|ORIENTADO|AUTOR|PARTICIPANTE|COORIENTADOR|INTEGRANTE)/ },
  { label: 'Local e idioma', test: /^(PAIS|CIDADE|UF|LOCAL|IDIOMA|SIGLA-UF|SIGLA-PAIS)/ },
  {
    label: 'Publicação',
    test: /(PERIODICO|ANAIS|EDITORA|VOLUME|FASCICULO|SERIE|PAGINA|ISSN|ISBN|^DOI$|HOME-PAGE|MEIO-DE-DIVULGACAO)/,
  },
  { label: 'Bolsa e fomento', test: /(BOLSA|AGENCIA|FINANCIADOR)/ },
  { label: 'Palavras-chave e setores', test: /^(PALAVRA-CHAVE|SETOR-DE-ATIVIDADE)/ },
];

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
 * Ordena os campos de um bloco. Nos elementos com formulário conhecido no
 * Lattes (form-order.ts), na ordem do Lattes, em grupos que são trechos dele,
 * e os campos que o Lattes não tem em "Em inglês" (as versões em inglês) ou
 * em "Outros dados". Nos outros, por assunto,
 * depois pelo rótulo. Sim/não juntos em "Marcações" e os códigos do Lattes no
 * fim. Com `isEmpty`, os vazios vão para o fim de cada grupo. O bloco pode
 * juntar campos de várias partes do item (dados básicos, detalhamento,
 * palavras-chave), que aparecem como um só formulário.
 */
export function groupFields(
  entries: FieldEntry[],
  labelOf: (attr: string) => string,
  isBoolean: (entry: FieldEntry) => boolean,
  isEmpty: (entry: FieldEntry) => boolean = () => false,
): FieldGroup[] {
  const buckets = new Map<string, FieldEntry[]>();
  const mapped = (e: FieldEntry) => formLayout(e.element) !== undefined;
  const formLabels = [
    ...new Set(entries.flatMap((e) => formLayout(e.element)?.map((g) => g.label) ?? [])),
  ];
  // Rótulo repetido (Instituição existe nos dois) aparece uma vez só, na posição do formulário.
  const order = [
    ...new Set([
      ...formLabels,
      IN_ENGLISH,
      OTHER_DATA,
      ...GROUPS.map((g) => g.label),
      'Marcações',
      'Outros',
      'Códigos do Lattes',
    ]),
  ];
  const rankOf = (e: FieldEntry) => formSlot(e.element, e.attr)?.rank;
  // Código com o nome dele no bloco vai logo depois do nome, lado a lado.
  const pairedCodes = new Map<string, FieldEntry>();
  for (const entry of entries) {
    const code = codeAttrFor(entry.element, entry.attr);
    const codeEntry = code && entries.find((e) => e.attr === code && e.element === entry.element);
    if (codeEntry && !formSlot(codeEntry.element, codeEntry.attr)) {
      pairedCodes.set(entry.key, codeEntry);
    }
  }
  const paired = new Set([...pairedCodes.values()].map((e) => e.key));
  for (const entry of entries) {
    if (paired.has(entry.key)) continue;
    const label =
      formSlot(entry.element, entry.attr)?.label ??
      (isSystemAttr(entry.element, entry.attr)
        ? 'Códigos do Lattes'
        : mapped(entry)
          ? isEnglishAttr(entry.attr)
            ? IN_ENGLISH
            : OTHER_DATA
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
            Number(isEmpty(a)) - Number(isEmpty(b)) ||
            (rankOf(a) ?? 999) - (rankOf(b) ?? 999) ||
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
