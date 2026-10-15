import { useState } from 'react';

import { copyText } from './clipboard.ts';
import { CheckIcon, CopyIcon } from './icons.tsx';
import { Tip } from './primitives/Tip.tsx';

/** Botão "copiar" do endereço do currículo, no compartilhar. */
export function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Tip label={copied ? 'Copiado' : 'Copiar'}>
      <button
        aria-label={copied ? `${label} copiado` : `Copiar ${label}`}
        className="ghost icon-btn copy-btn"
        disabled={!value}
        type="button"
        onClick={async () => {
          if (await copyText(value)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </Tip>
  );
}
