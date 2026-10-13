// Em que pé está a ligação do editor com o Lattes, para o cabeçalho dizer por
// que não há leitura em vez de ficar em branco: extensão ausente ou de outra
// versão, aviso não aceito, Lattes fechado, sessão de outro currículo.

import { BRIDGE_FEATURES, compareFeatures } from './compat.ts';
import { sameCv } from './lattes-html.ts';
import type { BridgeMessage, NoReadingReason } from './protocol.ts';

export type LinkState =
  /** Logo ao abrir, esperando a extensão responder. */
  | { kind: 'procurando' }
  | { kind: 'sem-extensao' }
  /** A extensão fala outra versão do protocolo; nada dela é aceito. */
  | { kind: 'incompativel' }
  /** Extensão ligada; o estado do Lattes ainda não chegou. */
  | { kind: 'lendo'; version: string }
  | { kind: 'lido'; version: string }
  | { kind: 'sem-leitura'; reason: NoReadingReason; version: string }
  | { kind: 'outro-cv'; version: string };

export interface Link {
  /**
   * Comparação das capacidades (src/bridge/compat.ts): a extensão mais antiga
   * que o app, ou o contrário. Vale junto com qualquer estado da leitura.
   */
  outdated?: { side: 'app' | 'extensao'; version: string };
  state: LinkState;
}

export const INITIAL_LINK: Link = { state: { kind: 'procurando' } };

function versionOf(link: Link): string {
  return 'version' in link.state ? link.state.version : '';
}

/** O próximo estado da ligação depois de uma mensagem da extensão. */
export function nextLink(link: Link, msg: BridgeMessage, lattesId: string | undefined): Link {
  switch (msg.type) {
    case 'ola': {
      const compat = compareFeatures(BRIDGE_FEATURES, msg.features);
      const outdated =
        compat.kind === 'outro-antigo'
          ? { side: 'extensao' as const, version: msg.version }
          : compat.kind === 'este-antigo'
            ? { side: 'app' as const, version: msg.version }
            : undefined;
      // Um "ola" repetido (reconexão) não apaga uma leitura que já chegou.
      const { kind } = link.state;
      return {
        outdated,
        state:
          kind === 'lido' || kind === 'outro-cv'
            ? { kind, version: msg.version }
            : { kind: 'lendo', version: msg.version },
      };
    }
    case 'estado-lattes':
      return {
        ...link,
        state:
          lattesId && sameCv(lattesId, msg.lattesId)
            ? { kind: 'lido', version: versionOf(link) }
            : { kind: 'outro-cv', version: versionOf(link) },
      };
    case 'sem-leitura':
      // Uma leitura que já chegou continua valendo: o menu relido depois de
      // uma fila pode falhar sem que a data de antes deixe de ser verdade.
      if (link.state.kind === 'lido') return link;
      return {
        ...link,
        state: { kind: 'sem-leitura', reason: msg.reason, version: versionOf(link) },
      };
    default:
      return link;
  }
}
