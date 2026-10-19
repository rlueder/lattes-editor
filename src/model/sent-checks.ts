// "Já conferi no Lattes" numa gravação divergente do registro do enviado
// (LAT-59, src/bridge/write-brake.ts). Fica na linha do registro, em claro
// como a hora do envio, e o bloqueio do envio ao CNPq continua resolvido
// depois de reabrir o app.

import { db } from './store.ts';

/** Marca a entrada como conferida pela pessoa; devolve se a entrada existia. */
export async function markSentChecked(id: number, checkedAt: number): Promise<boolean> {
  return (await db.sent.update(id, { checkedAt })) > 0;
}
