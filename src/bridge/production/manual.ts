// Os tipos de produção que ficam à mão de propósito, com o motivo para a
// pessoa ler no lugar do "Formulário não suportado ainda".

import type { XElement } from '../../model/xml.ts';

/**
 * Os tipos de produção artística do XSD fora de artes cênicas, música, artes
 * visuais e outra produção artística: o censo de 15/10/2026 não achou
 * formulário do Lattes para eles. O catálogo de menus do reconhecimento cita
 * uma lista prc_arte_lista, que não foi aberta.
 */
const LEGACY_ART =
  'O censo dos formulários não achou no Lattes o formulário deste tipo de produção artística; altere no Lattes';

const REASONS: Record<string, string> = {
  'APRESENTACAO-DE-OBRA-ARTISTICA': LEGACY_ART,
  'APRESENTACAO-EM-RADIO-OU-TV': LEGACY_ART,
  'ARRANJO-MUSICAL': LEGACY_ART,
  'COMPOSICAO-MUSICAL': LEGACY_ART,
  'CURSO-DE-CURTA-DURACAO': LEGACY_ART,
  'OBRA-DE-ARTES-VISUAIS': LEGACY_ART,
  SONOPLASTIA: LEGACY_ART,
};

/** O motivo de uma mudança num desses tipos ficar à mão, ou undefined. */
export function manualReason(chain: readonly XElement[]): string | undefined {
  for (let i = chain.length - 1; i >= 0; i--) {
    const reason = REASONS[chain[i]!.name];
    if (reason) return reason;
  }
  return undefined;
}
