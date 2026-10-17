// O que as especificações das produções bibliográficas têm em comum: as
// quatro grades, que todo formulário bibliográfico do censo de 15/10/2026 traz
// nos ocultos, e dois atalhos para escrever os campos de uma parte do item.

import { media } from '../mappers.ts';
import type { FieldMap, GridField } from '../types.ts';

export const ALL_GRIDS: GridField[] = ['f_autores_l', 'f_plv_l', 'f_setor_l', 'f_area_l'];

/** Os campos de uma parte do item, com a chave "FILHO@ATRIBUTO" montada aqui. */
export const under = <T extends FieldMap | string>(
  child: string,
  fields: Record<string, T>,
): Record<string, T> =>
  Object.fromEntries(Object.entries(fields).map(([attr, m]) => [`${child}@${attr}`, m]));

/**
 * f_meio de um formulário que só oferece algumas opções (o artigo publicado
 * tem I, D e V): um meio fora delas fica à mão.
 */
export const mediaAmong =
  (codes: readonly string[]) =>
  (v: string): string | undefined => {
    const code = media(v);
    return code === undefined || code === '' || codes.includes(code) ? code : undefined;
  };

/** O DOI fica à mão em todos os tipos que têm o campo (ver bibliografica-artigos.ts). */
export const DOI_MANUAL =
  'o campo do DOI no Lattes serve para recuperar os dados da produção pelo botão ao lado, e gravar só o texto não foi observado';
