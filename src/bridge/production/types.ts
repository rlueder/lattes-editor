// Alterar no lugar um item de produção, orientação ou banca que já está no
// Lattes (LAT-58), por um motor só: a especificação de cada tipo diz onde
// está a lista, qual é o formulário e que campo do formulário guarda cada
// atributo do XML. As especificações ficam em targets/, uma família por
// arquivo.

import type { Change } from '../../model/changes.ts';
import type { XElement } from '../../model/xml.ts';
import type { DoiSpec } from './doi.ts';
import type { LookupSpec } from './lookups.ts';

/** Um campo do formulário que guarda um atributo do XML. */
export interface FieldMap {
  field: string;
  /**
   * O valor do XML como o formulário o guarda (SIM → S, um idioma → o código
   * dele). undefined: o valor não tem correspondência no formulário, e a
   * alteração fica à mão. Sem a função, o valor vai como está. `side` diz se
   * é o valor de depois (o que vai) ou o de antes (o que se confere).
   */
  toForm?: (value: string, side?: 'after' | 'before') => string | undefined;
  /** O motivo de ir à mão quando toForm não dá valor; sem ele, o motivo genérico. */
  unmapped?: string;
}

/** As grades que o check() de cada página serializa nos ocultos. */
export type GridField =
  | 'f_area_l'
  | 'f_autores_l'
  | 'f_depositante_inst_l'
  | 'f_depositante_pessoa_l'
  | 'f_plv_l'
  | 'f_setor_l';

/**
 * O elemento do XML que a grade f_autores_l guarda (AUTORES na produção,
 * PARTICIPANTE-BANCA nas bancas, INTEGRANTES-DO-PROJETO na equipe do
 * projeto) e os atributos de cada linha.
 */
export interface AuthorPart {
  citation: string;
  cnpq: string;
  /**
   * O elemento que junta as pessoas, filho do item, quando elas não são
   * filhas diretas dele (EQUIPE-DO-PROJETO). Com ele, a grade vai por
   * members.ts, que lida também com a marca de responsável.
   */
  container?: string;
  element: string;
  /** Como a grade se chama no painel. */
  label: string;
  /** O atributo SIM/NAO de quem é o responsável, quando a grade tem a marca (tit). */
  lead?: string;
  name: string;
  order: string;
  /**
   * Os atributos que a grade leva de volta ao Lattes. Trocar outro (a
   * citação, o CPF) fica à mão; sem a lista, qualquer troca vira envio.
   */
  sent?: string[];
}

/**
 * Uma grade da página que o conector não monta (opaque.ts). Com `serialize`,
 * o envio a leva como a página a trouxe, como o check() a serializaria; sem,
 * o envio só vai quando o Lattes e o editor a têm vazia, e o oculto vai vazio.
 */
export interface OpaqueGrid {
  /** O elemento do XML que guarda o conteúdo dela, filho do item. */
  element: string;
  /** O oculto que o check() preenche com ela. */
  field: string;
  label: string;
  /**
   * Como o check() serializa cada linha: o innerHTML do primeiro <span> de
   * cada uma das `cells` primeiras células (as que têm tagValor 'span' no
   * criarGrid), unidos por "|", e `end` no fim da linha.
   */
  serialize?: { cells: number; end: string };
  /**
   * O id da tabela da grade na página: o servidor escreve as linhas no
   * corpo dela, e o check() as lê de lá (criarGrid, valores).
   */
  table: string;
}

export interface ProductionTarget {
  /**
   * Atributo cujo valor pede um texto que o XML não guarda (o potencial de
   * inovação do projeto): com o valor `when`, o envio leva `flag` e o texto que
   * a pessoa escreveu no editor (PlanOptions.extras); sem o texto, `reason`.
   */
  asks?: Record<
    string,
    { field: string; flag: [string, string]; maxLength: number; reason: string; when: string }
  >;
  /** O elemento da grade de autores, quando não é AUTORES (grids.ts). */
  authors?: AuthorPart;
  /**
   * Campos que o check() da página monta antes do envio a partir de vetores
   * dela (o f_instituicoes do projeto): o conector os monta igual, da página
   * lida; undefined quando a página não traz o vetor, e nada vai.
   */
  built?: (html: string, set: Record<string, string>) => Record<string, string> | undefined;
  /** Partes do item que ficam à mão, com o motivo (elemento → motivo). */
  byHand?: Record<string, string>;
  /**
   * Campos que a página limpa junto quando outro recebe um valor: "campo=valor"
   * → os campos e o que eles levam (o potencial de inovação do projeto, que o
   * Não apaga).
   */
  clears?: Record<string, Record<string, string>>;
  /** As conferências do DOI que o check() da página faz antes do envio (doi.ts). */
  doi?: DoiSpec;
  /** O elemento do item no XML (ARTIGO-PUBLICADO, TRABALHO-TECNICO…). */
  element: string;
  /**
   * Atributo do XML → campo do formulário, com a chave "FILHO@ATRIBUTO"
   * (DADOS-BASICOS-DO-ARTIGO@TITULO-DO-ARTIGO).
   */
  fields: Record<string, FieldMap | string>;
  /** O formulário: o nome do <form> e o procedimento do POST. */
  form: { action: string; name: string };
  /** As chaves que o check() serializa, quando não são as de GRID_SPECS (grids.ts). */
  gridKeys?: Partial<Record<GridField, readonly string[]>>;
  /** As grades que o formulário tem, e que o envio refaz. */
  grids: GridField[];
  /**
   * O atributo do XML que guarda os depositantes ou titulares pessoas da
   * grade f_depositante_pessoa_l (NOME-DO-DEPOSITANTE, observado na
   * exportação da patente de teste em 20/10/2026). A exportação copia essas
   * pessoas também nos autores (AUTORES), e a grade de autores da página não
   * as tem: a mudança de autores as deixa de fora.
   */
  holders?: { attr: string; child: string };
  /** Identificador do tipo (o mesmo do censo, docs/lattes-formularios/). */
  id: string;
  /** A lista do menu (com os parâmetros que a distinguem) e o procedimento do formulário de cada linha. */
  list: {
    formProc: string;
    /** O link de uma linha da lista (e não o de inclusão); sem a função, o que tem f_seq. */
    isRow?: (params: Record<string, string>) => boolean;
    params?: Record<string, string>;
    /**
     * Um parâmetro da lista que sai de um atributo do item (a natureza do
     * projeto escolhe a lista): o valor de antes, pela tabela.
     */
    paramsBy?: {
      attr: string;
      child: string;
      param: string;
      /** A tabela do valor ao parâmetro, ou a função (o software com ou sem registro). */
      values: Record<string, string> | ((value: string) => string | undefined);
    };
    proc: string;
  };
  /** Instituição, curso e agência escolhidos pelas buscas do Lattes (lookups.ts). */
  lookups?: LookupSpec;
  /**
   * Atributos que o formulário tem mas o envio não troca, com o motivo
   * (a instituição que sai de uma busca), na mesma chave de fields.
   */
  manual?: Record<string, string>;
  /**
   * O campo da natureza e os valores dela que são deste tipo, quando a mesma
   * lista tem vários tipos: a linha cuja natureza é de outro tipo não conta
   * (a banca de mestrado e a qualificação com o mesmo título e ano).
   */
  nature?: { field: string; values: string[] };
  /**
   * A natureza que se troca no lugar, num elemento que tem mais de uma (as
   * outras orientações concluídas): o atributo, na chave de fields, que a
   * liga ao rádio de `nature.field`. A troca limpa os ocultos `clears` e
   * escolhe de novo a instituição e o curso com o nível da natureza nova,
   * como o testa_nivel() da página pede (nature.ts). De ou para um código de
   * `byHand`, a troca fica à mão com o motivo dele.
   */
  natureSwap?: { byHand: Record<string, string>; clears: string[]; key: string };
  /** As grades da página que o conector não monta: reenviadas como vieram, ou só vazias. */
  opaqueGrids?: OpaqueGrid[];
  /**
   * O órgão e a unidade, que o XML guarda no pai do item (a participação em
   * projeto) e o formulário do item escolhe pela janela de órgãos (organ.ts).
   * periodReason: por que o resto do pai fica à mão.
   */
  organ?: { periodReason: string };
  /**
   * Partes do item cujo campo do formulário depende do conteúdo da própria
   * parte (a linha do histórico de situações da patente, cuja descrição diz
   * que data ela é): elemento → os campos de cada atributo da mudança, com a
   * chave só do atributo, ou o motivo de ir à mão. Um mapa vazio deixa os
   * campos de `fields`, e o gancho só confere (a data do registro da patente
   * contra a do histórico).
   */
  partFields?: Record<
    string,
    (
      change: Change,
      el: XElement,
      item: XElement,
    ) =>
      | {
          /** Campos do formulário que mudam sem atributo próprio na mudança. */
          also?: { after: string; before: string; field: string; label: string }[];
          fields: Record<string, FieldMap | string>;
        }
      | { reason: string }
  >;
  /**
   * O orientando: com o nome trocado, o envio refaz a validação que o Salvar
   * da página faz (student.ts). idAttr: onde o XML guarda o identificador.
   */
  student?: { child: string; idAttr: string };
  /**
   * Título e ano do item, para achar a linha da lista; os campos do
   * formulário são f_titulo e f_ano se não disser. `child` pode ser o
   * próprio elemento do item, quando o atributo é dele.
   */
  title: {
    attr: string;
    child: string;
    field?: string;
    /** O valor do XML como a página o mostra, quando difere (o tipo da licença: M). */
    toForm?: (value: string) => string;
  };
  /**
   * Campos que não são controles da página, mas linhas de um vetor dela (as
   * datas da patente, na grade de situações): o nome em `fields` tem ":" e a
   * especificação diz como ler o valor de cada um na página e como montar os
   * campos reais com os valores novos.
   */
  virtual?: {
    /** Os campos reais montados com os virtuais trocados; undefined sem o vetor. */
    build: (html: string, set: Record<string, string>) => Record<string, string> | undefined;
    /** O valor de cada campo virtual na página; undefined sem o vetor. */
    read: (html: string) => Record<string, string> | undefined;
  };
  year: {
    attr: string;
    child: string;
    /**
     * O campo de data (dd/mm/aaaa) de onde tirar o ano quando o do ano vem
     * vazio: no desenho industrial e no programa de computador com registro,
     * f_ano chega vazio e o check() o tira de f_dta_dep.
     */
    fallback?: string;
    field?: string;
    /** O valor do XML como a página o mostra (a data da licença: dd/mm/aaaa). */
    toForm?: (value: string) => string;
  };
}
