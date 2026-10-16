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

export interface ProductionTarget {
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
   * Atributos que o formulário tem, mas que ficam à mão, com o motivo
   * ("FILHO@ATRIBUTO" → motivo): o campo existe e não se sabe gravá-lo.
   */
  manual?: Record<string, string>;
  /** Título e ano do item, para achar a linha da lista; os campos do formulário são f_titulo e f_ano se não disser. */
  title: { attr: string; child: string; field?: string };
  year: { attr: string; child: string; field?: string };
}
