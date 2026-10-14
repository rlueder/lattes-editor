// "x" dentro de um campo de busca, que aparece depois de digitar algo e limpa
// o campo, devolvendo o foco a ele.

import type { RefObject } from 'react';

import { CloseIcon } from '../icons.tsx';

export function ClearButton({
  input,
  onClear,
  value,
}: {
  /** O campo que ele limpa: o foco volta para ele (o botão some ao limpar). */
  input: RefObject<HTMLInputElement | null>;
  value: string;
  onClear: () => void;
}) {
  if (!value) return null;
  return (
    <button
      aria-label="Limpar a busca"
      className="ghost icon-btn input-clear"
      type="button"
      onClick={() => {
        onClear();
        input.current?.focus();
      }}
    >
      <CloseIcon />
    </button>
  );
}
