import { useState } from 'react';

import { copyText } from './clipboard.ts';
import { CheckIcon, CopyIcon } from './icons.tsx';

/** Botão "copiar" de um valor, para colar no formulário do Lattes. */
export function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      aria-label={copied ? `${label} copiado` : `Copiar ${label}`}
      className="ghost icon-btn copy-btn"
      data-tip={copied ? 'Copiado' : 'Copiar'}
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
  );
}
