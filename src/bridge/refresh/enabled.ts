// A chave de "Atualizar do Lattes" (src/bridge/refresh/), num arquivo à
// parte para o service worker da extensão (compat.ts) não levar junto as
// especificações de todos os tipos.

/**
 * Chave da leitura pelos formulários. A capacidade 'atualizar-do-lattes'
 * (compat.ts) entra e sai junto com ela: uma extensão sem a capacidade nunca
 * recebe o pedido, e a extensão com ela desligada recusa o pedido.
 */
export const LATTES_REFRESH_ENABLED = true;

/**
 * Chave de "Carregar do Lattes" (src/bridge/load/): o currículo montado pelas
 * listas e pelos formulários, no lugar da exportação, ao abrir e ao recarregar
 * pela extensão. A capacidade 'carregar-do-lattes' (compat.ts) entra e sai com
 * ela; sem ela, o editor pede a exportação como antes.
 */
export const LATTES_LOAD_ENABLED = true;
