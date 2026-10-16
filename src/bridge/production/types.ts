// Alterar no lugar um item de produção, orientação ou banca que já está no
// Lattes (LAT-58), por um motor só: a especificação de cada tipo diz onde
// está a lista, qual é o formulário e que campo do formulário guarda cada
// atributo do XML. As especificações ficam em targets/, uma família por
// arquivo.

/** Um campo do formulário que guarda um atributo do XML. */
export interface FieldMap {
  field: string;
  /**
   * O valor do XML como o formulário o guarda (SIM → S, um idioma → o código
   * dele). undefined: o valor não tem correspondência no formulário, e a
   * alteração fica à mão. Sem a função, o valor vai como está.
   */
  toForm?: (value: string) => string | undefined;
}

/** As grades que o check() de cada página serializa nos ocultos. */
export type GridField = 'f_area_l' | 'f_autores_l' | 'f_plv_l' | 'f_setor_l';

/**
 * O elemento do XML que a grade f_autores_l guarda (AUTORES na produção,
 * PARTICIPANTE-BANCA nas bancas) e os atributos de cada linha.
 */
export interface AuthorPart {
  citation: string;
  cnpq: string;
  element: string;
  /** Como a grade se chama no painel. */
  label: string;
  name: string;
  order: string;
  /**
   * Os atributos que a grade leva de volta ao Lattes. Trocar outro (a
   * citação, o CPF) fica à mão; sem a lista, qualquer troca vira envio.
   */
  sent?: string[];
}

export interface ProductionTarget {
  /** O elemento da grade de autores, quando não é AUTORES (grids.ts). */
  authors?: AuthorPart;
  /** O elemento do item no XML (ARTIGO-PUBLICADO, TRABALHO-TECNICO…). */
  element: string;
  /**
   * Atributo do XML → campo do formulário, com a chave "FILHO@ATRIBUTO"
   * (DADOS-BASICOS-DO-ARTIGO@TITULO-DO-ARTIGO).
   */
  fields: Record<string, FieldMap | string>;
  /** O formulário: o nome do <form> e o procedimento do POST. */
  form: { action: string; name: string };
  /** As grades que o formulário tem, e que o envio refaz. */
  grids: GridField[];
  /** Identificador do tipo (o mesmo do censo, docs/lattes-formularios/). */
  id: string;
  /** A lista do menu (com os parâmetros que a distinguem) e o procedimento do formulário de cada linha. */
  list: { formProc: string; params?: Record<string, string>; proc: string };
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
  /** Título e ano do item, para achar a linha da lista; os campos do formulário são f_titulo e f_ano se não disser. */
  title: { attr: string; child: string; field?: string };
  year: { attr: string; child: string; field?: string };
}
