// A chave de "Atualizar do Lattes" (src/bridge/refresh/), num arquivo à
// parte para o service worker da extensão (compat.ts) não levar junto as
// especificações de todos os tipos.

/**
 * Chave da leitura pelos formulários. A capacidade 'atualizar-do-lattes'
 * (compat.ts) entra e sai junto com ela: uma extensão sem a capacidade nunca
 * recebe o pedido, e a extensão com ela desligada recusa o pedido.
 */
export const LATTES_REFRESH_ENABLED = true;
