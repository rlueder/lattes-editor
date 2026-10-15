// Trocar a foto do currículo no Lattes pelo editor: escolher a imagem, ver
// como ela vai (recortada no centro, reduzida para até 70 kB, photo-image.ts)
// e confirmar. Quem envia é a extensão, na sessão do Lattes (src/bridge/photo.ts),
// e ela confere a foto depois de enviar.

import { useEffect, useRef, useState } from 'react';

import { toBase64 } from '../bridge/export.ts';
import { photoFailureMessage } from '../bridge/photo.ts';
import { Modal } from './Modal.tsx';
import { preparePhoto } from './photo-image.ts';
import type { PhotoUploadReading } from './use-bridge.ts';

/** Sem resposta da extensão em tanto tempo, o envio conta como falho. */
const SEND_TIMEOUT_MS = 60_000;

type Step =
  | { kind: 'escolher'; problem?: string }
  | { kind: 'preparando' }
  | { bytes: Uint8Array; kind: 'pronta'; side: number }
  | { bytes: Uint8Array; id: string; kind: 'enviando'; side: number }
  | { kind: 'enviada' }
  | { bytes: Uint8Array; kind: 'falhou'; message: string; side: number };

const kb = (n: number) => `${Math.round(n / 1000)} kB`;

export function PhotoDialog({
  current,
  onClose,
  onSent,
  open,
  reading,
  send,
}: {
  /** A foto de agora, no círculo até a pessoa escolher outra. */
  current?: string;
  open: boolean;
  /** A resposta mais recente da extensão a um pedido de troca. */
  reading?: PhotoUploadReading;
  /** Manda o JPEG (base64) para a extensão; devolve o id do pedido. */
  send: (jpeg: string) => string;
  onClose: () => void;
  /** A foto foi trocada e conferida: o avatar recarrega. */
  onSent: () => void;
}) {
  const [step, setStep] = useState<Step>({ kind: 'escolher' });
  const input = useRef<HTMLInputElement>(null);
  // A prévia é uma URL de blob criada e revogada no mesmo efeito, presa aos
  // bytes: os passos que carregam a mesma foto reaproveitam a URL, e o
  // StrictMode (montar, desmontar, montar) não deixa URL órfã nem revogada.
  const bytes = 'bytes' in step ? step.bytes : undefined;
  const [preview, setPreview] = useState<string>();
  useEffect(() => {
    if (!bytes) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' }));
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [bytes]);
  // onSent muda a cada render de quem chama; a resposta só é tratada uma vez.
  const sentRef = useRef(onSent);
  sentRef.current = onSent;

  // Cada abertura começa da escolha.
  useEffect(() => {
    if (open) setStep({ kind: 'escolher' });
  }, [open]);

  // A resposta do pedido em andamento.
  useEffect(() => {
    if (step.kind !== 'enviando' || reading?.id !== step.id) return;
    if (reading.ok) {
      setStep({ kind: 'enviada' });
      sentRef.current();
    } else {
      setStep({
        bytes: step.bytes,
        kind: 'falhou',
        message: photoFailureMessage(reading.reason, reading.detail),
        side: step.side,
      });
    }
  }, [reading, step]);

  // A extensão que não responde não deixa o diálogo preso em "Enviando".
  useEffect(() => {
    if (step.kind !== 'enviando') return;
    const t = setTimeout(
      () =>
        setStep({
          bytes: step.bytes,
          kind: 'falhou',
          message: 'A extensão não respondeu. Confira se ela está ligada e tente de novo.',
          side: step.side,
        }),
      SEND_TIMEOUT_MS,
    );
    return () => clearTimeout(t);
  }, [step]);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setStep({ kind: 'preparando' });
    const prepared = await preparePhoto(file);
    setStep(
      prepared.ok
        ? { bytes: prepared.bytes, kind: 'pronta', side: prepared.side }
        : { kind: 'escolher', problem: prepared.reason },
    );
  };

  const sending = step.kind === 'enviando';
  const footer =
    step.kind === 'enviada' ? (
      <button className="primary" type="button" onClick={onClose}>
        Fechar
      </button>
    ) : (
      <>
        {(step.kind === 'pronta' || step.kind === 'falhou' || sending) && (
          <button
            className="primary"
            disabled={sending}
            type="button"
            onClick={() => {
              if (step.kind === 'enviando' || !('bytes' in step)) return;
              const id = send(toBase64(step.bytes));
              setStep({ bytes: step.bytes, id, kind: 'enviando', side: step.side });
            }}
          >
            {sending ? 'Enviando…' : 'Enviar ao Lattes'}
          </button>
        )}
        <button className="ghost" disabled={sending} type="button" onClick={onClose}>
          Cancelar
        </button>
      </>
    );

  return (
    <Modal
      className="photo-dialog"
      footer={footer}
      label="Trocar a foto"
      open={open}
      subtitle="A foto vai para o currículo no Lattes pela extensão, na sua sessão."
      title="Trocar a foto"
      onClose={sending ? () => undefined : onClose}
    >
      <input
        ref={input}
        hidden
        accept="image/jpeg,image/png,image/webp,image/heic"
        type="file"
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="photo-body">
        <div aria-hidden="true" className="photo-preview">
          {preview ? (
            <img alt="" src={preview} />
          ) : (
            current && step.kind !== 'enviada' && <img alt="" src={current} />
          )}
        </div>
        <div className="photo-text">
          {step.kind === 'enviada' ? (
            <p>Foto trocada no Lattes e conferida.</p>
          ) : step.kind === 'preparando' ? (
            <p className="muted">Preparando a imagem…</p>
          ) : 'bytes' in step ? (
            <p className="muted">
              Recortada no centro, {step.side} × {step.side}, {kb(step.bytes.length)} em JPEG.
            </p>
          ) : (
            <p className="muted">
              O editor recorta a imagem no centro e a reduz para até 70 kB em JPEG, como o Lattes
              pede.
            </p>
          )}
          {step.kind === 'escolher' && step.problem && <p className="error">{step.problem}</p>}
          {step.kind === 'falhou' && <p className="error">{step.message}</p>}
          {step.kind !== 'enviada' && (
            <button
              className="ghost"
              disabled={sending || step.kind === 'preparando'}
              type="button"
              onClick={() => input.current?.click()}
            >
              {'bytes' in step ? 'Escolher outra imagem' : 'Escolher imagem'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
