// A data de nascimento ou adoção de uma licença nova, que o Lattes exige na
// inclusão e a exportação não traz (src/bridge/create-licenca.ts). Vai só no
// envio ao Lattes, guardada no editor pela chave do elemento, como o texto do
// potencial de inovação (InnovationText.tsx).

import { useId } from 'react';

import { BIRTH_FIELD } from '../bridge/create-licenca.ts';
import { setSendExtra, useSendExtras } from './send-extras.ts';

export function LicenseBirthDate({ changeKey }: { changeKey: string }) {
  const id = useId();
  const value = useSendExtras()[changeKey]?.[BIRTH_FIELD] ?? '';
  return (
    <span className="field-follow-up">
      <label htmlFor={id}>Data de nascimento ou adoção</label>
      <input
        id={id}
        inputMode="numeric"
        maxLength={10}
        placeholder="dd/mm/aaaa"
        type="text"
        value={value}
        onChange={(e) => setSendExtra(changeKey, BIRTH_FIELD, e.target.value)}
      />
      <span className="muted field-note">
        Vai só no envio ao Lattes: o currículo exportado não guarda essa data.
      </span>
    </span>
  );
}
