// De onde o App tira o currículo do Lattes. A abertura na tela inicial
// (use-lattes-open.ts) é sempre pela exportação: o arquivo completo, em
// segundos, e o que vira o ponto zero. Dali em diante a cópia de trabalho
// segue o Lattes pelo conector, e o "Recarregar do Lattes"
// (use-lattes-reload.ts) lê pelos formulários, com a extensão que sabe
// (use-lattes-load.ts), sem esperar a exportação acompanhar o envio.

import type { Session } from '../forms/use-production.ts';
import { getAttr } from '../model/xml.ts';
import type { BridgeState } from './use-bridge.ts';
import { useLattesLoad } from './use-lattes-load.ts';
import { useLattesOpen } from './use-lattes-open.ts';
import { useLattesReload } from './use-lattes-reload.ts';

export function useLattesSource(
  bridge: BridgeState,
  session: Session | null,
  booting: boolean,
  handlers: { onOpen: (file: File) => unknown; onReload: (file: File) => void },
) {
  const load = useLattesLoad(bridge);
  const exported = { curriculo: bridge.curriculo, link: bridge.link, requestCv: bridge.requestCv };
  const open = useLattesOpen(Boolean(session), booting, exported, handlers.onOpen);
  const lattesId = session ? getAttr(session.doc.root, 'NUMERO-IDENTIFICADOR') : undefined;
  const reload = useLattesReload(load.source, lattesId, handlers.onReload);
  return { load, open, reload };
}
