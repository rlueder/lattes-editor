// Que tipo de controle um atributo merece na tela.

import type { AttributeSpec } from '../schema/types.ts';

/**
 * Campos que o Lattes gera e que não se editam à mão: números de sequência,
 * códigos de instituição, curso, área e CAPES, nível da formação (código),
 * identificadores e formatos. Mudar um deles quebra referências (a tabela de
 * instituições, por exemplo) ou o casamento com a exportação.
 */
const SYSTEM =
  /^(SEQUENCIA-|CODIGO-|COD-|ID-|NUMERO-IDENTIFICADOR$|NRO-ID-CNPQ$|FORMATO-|STATUS-OASISBR$)/;

/** Elementos de formação em que NIVEL é o código do nível (3 = mestrado…), dado pelo tipo. */
const LEVEL_CODED =
  /^(GRADUACAO|ESPECIALIZACAO|MESTRADO|DOUTORADO|POS-DOUTORADO|LIVRE-DOCENCIA|CURSO-TECNICO-PROFISSIONALIZANTE|MESTRADO-PROFISSIONALIZANTE|ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU|ENSINO-MEDIO-SEGUNDO-GRAU|RESIDENCIA-MEDICA|APERFEICOAMENTO)$/;

export function isSystemAttr(element: string, attr: string): boolean {
  return SYSTEM.test(attr) || (attr === 'NIVEL' && LEVEL_CODED.test(element));
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
  const order = [...GROUPS.map((g) => g.label), 'Marcações', 'Outros', 'Códigos do Lattes'];
  for (const entry of entries) {
    const label = isSystemAttr(entry.element, entry.attr)
      ? 'Códigos do Lattes'
      : isBoolean(entry)
        ? 'Marcações'
        : (GROUPS.find((g) => g.test.test(entry.attr))?.label ?? 'Outros');
    buckets.set(label, [...(buckets.get(label) ?? []), entry]);
  }
  return order
    .filter((label) => buckets.has(label))
    .map((label) => ({
      entries: buckets
        .get(label)!
        .sort(
          (a, b) =>
            (label === 'Período' ? periodRank(a.attr) - periodRank(b.attr) : 0) ||
            labelOf(a.attr).localeCompare(labelOf(b.attr), 'pt-BR'),
        ),
      label,
      system: label === 'Códigos do Lattes',
    }));
}
