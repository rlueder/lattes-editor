// Que tipo de controle um atributo merece na tela.

import { elementLabel } from '../labels/labels.ts';
import type { AttributeSpec } from '../schema/types.ts';
import { controllersFirst } from './field-dependencies.ts';
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
  /*
   * TIPO-DOUTORADO: o rádio f_tpo_doutorado do formulário de doutorado (censo
   * LAT-55, opções "normal", "sanduíche", "co-tutela", "co-tutela/sanduíche"),
   * e o XML guarda o código da opção. N e S observados em exportações reais
   * publicadas no GitHub (arquivos LATTES_OFFLINE): N em
   * RafaelQSantos-RQS/LattesHub database/data/lattes/3633682231940138.xml,
   * NARizzardi/UFPR 1002/lattes/lattes-cvs/algoritmos/kohayakawa.xml e
   * LiaCasatiRamaldes/vira-lattes-db cv/mock_jean.xml (talvez simulado); S em
   * RafaelQSantos-RQS/LattesHub database/data/lattes/5601958689947032.xml. C e
   * CS não apareceram em nenhuma exportação: inferidos pelas opções do
   * formulário. Valor fora da lista continua à mostra, como veio.
   */
  'DOUTORADO TIPO-DOUTORADO': {
    // Como no formulário do Lattes (o censo compara os rótulos).
    C: 'Co-tutela',
    CS: 'Co-tutela/sanduíche',
    N: 'Normal',
    S: 'Sanduíche',
  },
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
 * Marcas sim/não que a exportação do Lattes grava ao contrário do que a tela
 * do Lattes mostra. FLAG-VINCULO-EMPREGATICIO dos VINCULOS: a tela diz
 * "Possui vínculo empregatício: Sim" onde a exportação traz NAO, e vice-versa
 * (8 de 8 vínculos no censo LAT-55, conferido na tela em 15/10/2026). A
 * FLAG-DEDICACAO-EXCLUSIVA do mesmo vínculo não troca. Que o Importar leia o
 * arquivo com a mesma convenção é inferido, não testado.
 */
const INVERTED_FLAGS = new Set(['VINCULOS FLAG-VINCULO-EMPREGATICIO']);

export function isInvertedFlag(element: string, attr: string): boolean {
  return INVERTED_FLAGS.has(`${element} ${attr}`);
}

/**
 * O valor de uma marca sim/não no sentido da tela do Lattes. Nas marcas
 * invertidas, SIM e NAO trocam; o resto passa igual. A troca é a própria
 * volta: aplicada ao valor da tela, devolve o do XML (flagToXml).
 */
export function flagAsShown(element: string, attr: string, value: string): string {
  if (!isInvertedFlag(element, attr)) return value;
  return value === 'SIM' ? 'NAO' : value === 'NAO' ? 'SIM' : value;
}

/** O valor a gravar no XML para uma escolha feita no sentido da tela. */
export const flagToXml = flagAsShown;

/**
 * Uma marca sim/não como se lê, "Sim" ou "Não", no sentido da tela do Lattes
 * (flagAsShown). Outro valor passa igual. Serve a todo atributo que
 * isBooleanAttr reconhece, com ou sem enum no schema (FLAG-BOLSA não tem).
 */
export function flagLabel(element: string, attr: string, value: string): string {
  const shown = flagAsShown(element, attr, value);
  return shown === 'SIM' ? 'Sim' : shown === 'NAO' ? 'Não' : shown;
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
  previewSlot?: (entry: FieldEntry) => FieldSlot | undefined,
): FieldGroup[] {
  // Campo que decide as opções de outros vem antes deles (field-dependencies.ts).
  if (previewSlot)
    return controllersFirst(groupByPreview(entries, labelOf, previewSlot), codeAttrFor);
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
  const slotOf = (e: FieldEntry) => formSlot(e.element, e.attr);
  const { paired, pairedCodes } = pairCodes(entries, slotOf);
  for (const entry of entries) {
    if (paired.has(entry.key)) continue;
    const label =
      slotOf(entry)?.label ??
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
  const groups = order
    .filter((label) => buckets.has(label))
    .map((label) => ({
      entries: withCodes(
        buckets
          .get(label)!
          .sort(
            (a, b) =>
              Number(isEmpty(a)) - Number(isEmpty(b)) ||
              (slotOf(a)?.rank ?? 999) - (slotOf(b)?.rank ?? 999) ||
              (label === 'Período' ? periodRank(a.attr) - periodRank(b.attr) : 0) ||
              labelOf(a.attr).localeCompare(labelOf(b.attr), 'pt-BR'),
          ),
        pairedCodes,
      ),
      label,
      system: label === 'Códigos do Lattes',
    }));
  return controllersFirst(groups, codeAttrFor);
}

/** Grupo e posição de um campo: no formulário do Lattes ou na prévia. */
export interface FieldSlot {
  label: string;
  rank: number;
}

/** Código com o nome dele no bloco vai logo depois do nome, lado a lado. */
function pairCodes(entries: FieldEntry[], slotOf: (e: FieldEntry) => FieldSlot | undefined) {
  const pairedCodes = new Map<string, FieldEntry>();
  for (const entry of entries) {
    const code = codeAttrFor(entry.element, entry.attr);
    const codeEntry = code && entries.find((e) => e.attr === code && e.element === entry.element);
    if (codeEntry && !slotOf(codeEntry)) pairedCodes.set(entry.key, codeEntry);
  }
  return { paired: new Set([...pairedCodes.values()].map((e) => e.key)), pairedCodes };
}

function withCodes(entries: FieldEntry[], pairedCodes: Map<string, FieldEntry>): FieldEntry[] {
  return entries.flatMap((e) => {
    const code = pairedCodes.get(e.key);
    return code ? [e, code] : [e];
  });
}

/**
 * Na ordem da prévia (modo de leitura): cada campo no lugar em que aparece
 * ou apareceria, preenchido, no texto acima dele, com os grupos dos blocos
 * da prévia. Vazio não vai para o fim: preenchê-lo não o muda de lugar. O que
 * a prévia nunca mostra fica em "Outros dados" e os códigos no fim.
 */
function groupByPreview(
  entries: FieldEntry[],
  labelOf: (attr: string) => string,
  previewSlot: (entry: FieldEntry) => FieldSlot | undefined,
): FieldGroup[] {
  const { paired, pairedCodes } = pairCodes(entries, previewSlot);
  const buckets = new Map<string, FieldEntry[]>();
  for (const entry of entries) {
    if (paired.has(entry.key)) continue;
    const label =
      previewSlot(entry)?.label ??
      (isSystemAttr(entry.element, entry.attr) ? 'Códigos do Lattes' : OTHER_DATA);
    buckets.set(label, [...(buckets.get(label) ?? []), entry]);
  }
  const first = (label: string) =>
    Math.min(...buckets.get(label)!.map((e) => previewSlot(e)?.rank ?? Infinity));
  const order = [...buckets.keys()]
    .filter((l) => l !== OTHER_DATA && l !== 'Códigos do Lattes')
    .sort((a, b) => first(a) - first(b));
  return [...order, OTHER_DATA, 'Códigos do Lattes']
    .filter((label) => buckets.has(label))
    .map((label) => ({
      entries: withCodes(
        buckets
          .get(label)!
          .sort(
            (a, b) =>
              (previewSlot(a)?.rank ?? 999) - (previewSlot(b)?.rank ?? 999) ||
              labelOf(a.attr).localeCompare(labelOf(b.attr), 'pt-BR'),
          ),
        pairedCodes,
      ),
      label,
      system: label === 'Códigos do Lattes',
    }));
}
