import type { BridgeMessage, NoReadingReason } from '../../src/bridge/protocol.ts';
import { hasConsent } from './consent.ts';
import { lattesTab, sessionIdentity } from './lattes-tab.ts';

/**
 * O que o editor sabe da sessão do Lattes: o código de 10 caracteres do
 * currículo, para a foto, e o estado do menu (última publicação e
 * pendência), sempre junto com de quem ele é.
 */
export async function readSession(
  send: (message: BridgeMessage) => Promise<void>,
  fresh = false,
): Promise<void> {
  // Sem leitura, o editor recebe o porquê, para o cabeçalho explicar.
  const none = (reason: NoReadingReason, lattesId?: string) =>
    send({ lattesId, reason, type: 'sem-leitura' });
  if (!(await hasConsent())) return none('consentimento');
  const tabId = await lattesTab();
  if (tabId === undefined) return none('sem-aba');
  try {
    const id = await sessionIdentity(tabId, fresh);
    if (id.code) {
      await send({ code: id.code, lattesId: id.lattesId, type: 'codigo-cv' });
    }
    if (id.status) {
      await send({ lattesId: id.lattesId, status: id.status, type: 'estado-lattes' });
    } else {
      await none('sem-data', id.lattesId);
    }
  } catch {
    // Sem permissão na aba ou aba recarregando: sem foto nem estado.
    await none('erro');
  }
}
