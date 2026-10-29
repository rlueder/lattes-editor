// De onde o App tira o currículo do Lattes: os formulários, com a extensão que
// sabe (use-lattes-load.ts), ou a exportação; e os dois usos dessa fonte, a
// abertura na tela inicial (use-lattes-open.ts) e o "Recarregar do Lattes"
// (use-lattes-reload.ts).

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
  const open = useLattesOpen(Boolean(session), booting, load.source, handlers.onOpen);
  const lattesId = session ? getAttr(session.doc.root, 'NUMERO-IDENTIFICADOR') : undefined;
  const reload = useLattesReload(load.source, lattesId, handlers.onReload);
  return { load, open, reload };
}
