// Compartilhar o currículo: o QR do endereço público e o link, com download
// do QR em SVG ou PNG para pôr em pôster, slide ou crachá.

import { CopyButton } from './CopyButton.tsx';
import { Modal } from './Modal.tsx';
import { qrSvg } from './qr.ts';
import { QrCode } from './QrCode.tsx';

function download(name: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function downloadPng(name: string, svg: string, px = 1024) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, px, px);
    canvas.toBlob((blob) => blob && download(name, blob), 'image/png');
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function ShareDialog({
  onClose,
  open,
  url,
}: {
  open: boolean;
  url: string;
  onClose: () => void;
}) {
  const svg = qrSvg(url);
  const base = `curriculo-lattes-${url.split('/').pop() ?? 'qr'}`;
  return (
    <Modal
      className="share-dialog"
      label="Compartilhar o currículo"
      open={open}
      title="Compartilhar o currículo"
      onClose={onClose}
    >
      <div className="share-body">
        <QrCode className="share-qr" label={`Código QR de ${url}`} text={url} />
        <span className="field-copy-row share-link">
          <span className="share-url">{url.replace(/^https?:\/\//, '')}</span>
          <CopyButton label="endereço do currículo" value={url} />
        </span>
        <div className="share-actions">
          <button
            type="button"
            onClick={() => download(`${base}.svg`, new Blob([svg], { type: 'image/svg+xml' }))}
          >
            Baixar SVG
          </button>
          <button type="button" onClick={() => downloadPng(`${base}.png`, svg)}>
            Baixar PNG
          </button>
        </div>
        <p className="empty-caption">
          O código leva ao seu currículo público no Lattes. É gerado aqui, sem enviar nada.
        </p>
      </div>
    </Modal>
  );
}
