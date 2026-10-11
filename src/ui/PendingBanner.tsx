// Faixa no topo do conteúdo enquanto há algo que ainda não está no Lattes:
// alterações a levar e itens novos a importar. Dá para esconder durante a
// sessão; volta quando o número muda.

import { useState } from 'react';

import { CloseIcon, UploadIcon } from './icons.tsx';
import { pendingMessage } from './pending.ts';
import { Tip } from './primitives/Tip.tsx';

export function PendingBanner({
  changes,
  news,
  onOpen,
}: {
  changes: number;
  /** Itens novos, ainda não importados. */
  news: number;
  onOpen: () => void;
}) {
  // Guarda a contagem que foi escondida; outra contagem traz a faixa de volta.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const key = `${changes}:${news}`;
  if (changes + news === 0 || dismissed === key) return null;
  return (
    <div className="pending-banner" role="status">
      <span className="pending-text">{pendingMessage(changes, news)}</span>
      <button className="pending-open" type="button" onClick={onOpen}>
        <UploadIcon /> Levar ao Lattes
      </button>
      <Tip label="Esconder até mudar">
        <button
          aria-label="Esconder aviso"
          className="ghost icon-btn pending-close"
          type="button"
          onClick={() => setDismissed(key)}
        >
          <CloseIcon />
        </button>
      </Tip>
    </div>
  );
}
