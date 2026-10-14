// Atualização simulada para revisar os avisos no `pnpm dev`
// (?simular-atualizacao): uma versão nova que "baixa" em dois segundos e
// recarrega a página no lugar de reiniciar o app. Com =nenhuma, a conferência
// não acha versão nova; com =falha, ela falha. Cada conferência leva um
// segundo, para dar tempo de ver o "Verificando…" do menu ⚙.

import type { DownloadEvent, UpdateDeps } from '../desktop/update.ts';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** O que a conferência simulada devolve, pelo valor de ?simular-atualizacao. */
export function fakeUpdateDeps(mode: string | null = null): UpdateDeps {
  return {
    async check() {
      await wait(1000);
      if (mode === 'falha') throw new Error('conferência simulada falhou');
      if (mode === 'nenhuma') return null;
      return {
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
      };
    },
    relaunch: () => {
      location.reload();
      return Promise.resolve();
    },
  };
}
