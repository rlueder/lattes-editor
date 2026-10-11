// Campo de um atributo: texto, área de texto ou lista de opções (enum).
// Grava no elemento ao sair do campo; usado na visão genérica e nos formulários.

import { useEffect, useId, useState } from 'react';

import { attributeLabel, elementLabel, enumLabel } from '../labels/labels.ts';
import { getAttr, setAttr, type XElement } from '../model/xml.ts';
import type { AttributeSpec } from '../schema/types.ts';
import { CopyButton } from './CopyButton.tsx';

export type EditFn = (note: string) => void;

interface Props {
  /** Mostra o botão "copiar" do valor, para colar no formulário do Lattes. */
  copyable?: boolean;
  el: XElement;
  /** Mensagem de validação mostrada sob o campo. */
  error?: string;
  /** Rótulo no lugar do gerado a partir do nome XML. */
  label?: string;
  /** Texto longo: força área de texto. */
  multiline?: boolean;
  name: string;
  /** Marca de obrigatório além da que o schema já declara. */
  required?: boolean;
  spec?: AttributeSpec;
  wide?: boolean;
  onEdit: EditFn;
}

export function AttributeField({
  copyable,
  el,
  error,
  label,
  multiline,
  name,
  onEdit,
  required,
  spec,
  wide,
}: Props) {
  const value = getAttr(el, name) ?? '';
  const [draft, setDraft] = useState(value);
  // Valor mudou por fora (busca por DOI, restauração do histórico).
  useEffect(() => setDraft(value), [value]);
  const text = label ?? attributeLabel(name);
  const commit = (next: string) => {
    if (next === (getAttr(el, name) ?? '')) return;
    setAttr(el, name, next);
    onEdit(`${elementLabel(el.name)} · ${text}`);
  };
  const id = useId();
  const errorId = `${id}-erro`;
  const common = {
    'aria-describedby': error ? errorId : undefined,
    'aria-invalid': error ? true : undefined,
    id,
  };

  let control;
  if (spec?.enum) {
    const options = spec.enum.includes(value) || value === '' ? spec.enum : [value, ...spec.enum];
    control = (
      <select {...common} value={value} onChange={(e) => commit(e.target.value)}>
        <option value="">(escolha)</option>
        {options.map((v) => (
          <option key={v} value={v}>
            {enumLabel(v)}
          </option>
        ))}
      </select>
    );
  } else if (multiline || value.length > 90) {
    control = (
      <textarea
        {...common}
        rows={multiline ? 3 : 4}
        value={draft}
        onBlur={() => commit(draft)}
        onChange={(e) => setDraft(e.target.value)}
      />
    );
  } else {
    control = (
      <input
        {...common}
        type="text"
        value={draft}
        onBlur={() => commit(draft)}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    );
  }

  return (
    <div className={`field${wide ? ' field-wide' : ''}${error ? ' has-error' : ''}`}>
      <label htmlFor={id} title={spec?.patched ? `${name} (fora do XSD publicado)` : name}>
        {text}
        {(spec?.required || required) && (
          <span aria-label="obrigatório" className="required">
            {' '}
            *
          </span>
        )}
      </label>
      {copyable ? (
        <span className="field-copy-row">
          {control}
          <CopyButton label={text} value={value} />
        </span>
      ) : (
        control
      )}
      {error && (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}
