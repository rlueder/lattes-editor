// O texto do potencial de inovação de um projeto ou registro, que o Lattes
// pede ao marcar Sim e a exportação não traz (src/bridge/production/targets/
// projetos.ts, asks, e a inclusão em create-shared.ts). Vai só no envio ao
// Lattes, guardado no editor pela chave do elemento.

import { useId } from 'react';

import { setSendExtra, useSendExtras } from './send-extras.ts';

/** O limite do campo f_txt_potencial no formulário do projeto. */
const MAX = 400;

export function InnovationText({ changeKey }: { changeKey: string }) {
  const id = useId();
  const value = useSendExtras()[changeKey]?.f_txt_potencial ?? '';
  return (
    <span className="field-follow-up">
      <label htmlFor={id}>Qual o potencial de inovação?</label>
      <textarea
        id={id}
        maxLength={MAX}
        rows={3}
        value={value}
        onChange={(e) => setSendExtra(changeKey, 'f_txt_potencial', e.target.value)}
      />
      <span className="muted field-note">
        Vai só no envio ao Lattes: o currículo exportado não guarda esse texto. {value.length}/{MAX}
      </span>
    </span>
  );
}
