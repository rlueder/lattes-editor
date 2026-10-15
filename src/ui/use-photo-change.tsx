// Trocar a foto do currículo no Lattes: quando o lápis aparece, o diálogo e a
// versão da foto, que muda depois de uma troca para o avatar buscar a nova.
//
// No `pnpm dev`, ?simular-foto mostra o lápis sem extensão e responde ao envio
// sozinho, para revisar o diálogo sem tocar no Lattes (?simular-foto=falha
// responde com erro).

import { useState } from 'react';

import { PhotoDialog } from './PhotoDialog.tsx';
import type { PhotoUploadReading } from './use-bridge.ts';
import type { BridgeState } from './use-bridge.ts';

function simulated(): 'falha' | 'ok' | undefined {
  if (!import.meta.env.DEV) return undefined;
  const value = new URLSearchParams(location.search).get('simular-foto');
  return value === null ? undefined : value === 'falha' ? 'falha' : 'ok';
}

export function usePhotoChange(bridge: BridgeState) {
  const [open, setOpen] = useState(false);
  /** A foto que o currículo tem agora, mostrada no diálogo antes da troca. */
  const [current, setCurrent] = useState<string>();
  const [version, setVersion] = useState(0);
  const [fakeReading, setFakeReading] = useState<PhotoUploadReading | undefined>();
  const fake = simulated();
  // Só com a extensão que sabe trocar a foto e lendo a sessão deste currículo.
  const canChange =
    fake !== undefined ||
    (Boolean(bridge.link.features?.includes('foto')) && bridge.link.state.kind === 'lido');
  const send = fake
    ? () => {
        const id = `simulada-${Date.now()}`;
        setTimeout(
          () =>
            setFakeReading(
              fake === 'ok'
                ? { at: Date.now(), id, ok: true }
                : { at: Date.now(), detail: 'Falha simulada.', id, ok: false, reason: 'erro' },
            ),
          1500,
        );
        return id;
      }
    : bridge.sendPhoto;
  return {
    dialog: (
      <PhotoDialog
        current={current}
        open={open}
        reading={fake ? fakeReading : bridge.photoUpload}
        send={send}
        onClose={() => setOpen(false)}
        onSent={() => setVersion((v) => v + 1)}
      />
    ),
    open: canChange
      ? (photo?: string) => {
          setCurrent(photo);
          setOpen(true);
        }
      : undefined,
    version,
  };
}
