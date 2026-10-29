// A faixa do cabeçalho e o sino do app (App.tsx), fora dele para o arquivo
// caber no limite de tamanho.

import type { LattesStatus } from '../bridge/lattes-status.ts';
import type { Link } from '../bridge/link.ts';
import type { SentEntry } from '../bridge/sent-log.ts';
import type { UpdateState } from '../desktop/update.ts';
import { storageStatus } from '../model/store.ts';
import { type ReloadFailure, reloadNotice } from './lattes-reload.ts';
import { connectionOf, type Notice, noticesFor, staleExportNotice } from './notifications.ts';
import { statusStrip } from './status-strip.ts';

/** A faixa do cabeçalho: alterações do editor, mais o que o conector sabe do Lattes. */
export function stripFor(
  editorChanges: number,
  bridge: { lattes?: LattesStatus; sent: SentEntry[] },
) {
  return statusStrip({ editorChanges, lattes: bridge.lattes, sent: bridge.sent });
}

/** O sino: por que o Lattes não foi lido, um lado desatualizado, armazenamento sem chave. */
export function noticesOf(
  bridge: { lattes?: LattesStatus; link: Link; sent: SentEntry[] },
  update: UpdateState,
  devExtensionFolder?: string,
  reloadFailure?: ReloadFailure,
  exported?: string,
  /** "Atualizar do Lattes": se a extensão sabe, e o resultado que fica no sino. */
  refresh?: { available: boolean; notice?: Notice },
  /** O que não veio dos formulários na última leitura (lattes-load.ts). */
  load?: Notice,
  /** O dia do último envio ao CNPq pelo editor com a cópia em dia (WorkingCopy.syncedOn). */
  syncedOn?: string,
) {
  return noticesFor({
    appVersion: __APP_VERSION__,
    connection: connectionOf(bridge.link, Boolean(bridge.lattes)),
    devExtensionFolder,
    load,
    refresh: refresh?.notice,
    reload: reloadFailure && reloadNotice(reloadFailure),
    stale: staleExportNotice(exported, bridge.lattes?.lastPublished, refresh?.available, syncedOn),
    storage: storageStatus().status,
    unknownPending: stripFor(0, bridge).segments.some((x) => x.kind === 'pendencia-desconhecida'),
    update,
  });
}
