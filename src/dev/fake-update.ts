// Atualização simulada para revisar o aviso no `pnpm dev`
// (?simular-atualizacao): uma versão nova que "baixa" em dois segundos e
// recarrega a página no lugar de reiniciar o app.

import type { DownloadEvent, UpdateDeps } from '../desktop/update.ts';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fakeUpdateDeps: UpdateDeps = {
  check: () =>
    Promise.resolve({
      async downloadAndInstall(onEvent: (e: DownloadEvent) => void) {
        const total = 10_000_000;
        onEvent({ data: { contentLength: total }, event: 'Started' });
        for (let i = 0; i < 10; i++) {
          await wait(200);
          onEvent({ data: { chunkLength: total / 10 }, event: 'Progress' });
        }
        onEvent({ event: 'Finished' });
      },
      version: '99.0.0',
    }),
  relaunch: () => {
    location.reload();
    return Promise.resolve();
  },
};
