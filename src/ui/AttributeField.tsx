// Campo de um atributo: texto, área de texto ou lista de opções (enum).
// Grava no elemento ao sair do campo; usado na visão genérica e nos formulários.

import { useEffect, useId, useState } from 'react';

import { attributeLabel, elementLabel, enumLabel } from '../labels/labels.ts';
import { repairMojibake } from '../model/mojibake.ts';
import { getAttr, setAttr, type XElement } from '../model/xml.ts';
import type { AttributeSpec } from '../schema/types.ts';
import { CopyButton } from './CopyButton.tsx';
import { isBooleanAttr, isSystemAttr } from './field-kind.ts';
import { Select } from './primitives/Select.tsx';
import { Switch } from './primitives/Switch.tsx';

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
  /** Título do item: campo grande e sem borda no topo do formulário, rótulo só para leitores de tela. */
  prominent?: boolean;
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
  prominent,
  required,
  spec,
  wide,
}: Props) {
  const value = getAttr(el, name) ?? '';
  const [draft, setDraft] = useState(value);
  // Valor mudou por fora (busca por DOI, restauração do histórico).
  useEffect(() => setDraft(value), [value]);
  const text = label ?? attributeLabel(name);
  // Só sugere; o valor fica como veio até a pessoa clicar em "Corrigir".
  const repaired = repairMojibake(value);
  const commit = (next: string) => {
    if (next === (getAttr(el, name) ?? '')) return;
    setAttr(el, name, next);
    onEdit(`${elementLabel(el.name)} · ${text}`);
  };
  const id = useId();
  const errorId = `${id}-erro`;
  const labelId = `${id}-rotulo`;
  const common = {
    'aria-describedby': error ? errorId : undefined,
    'aria-invalid': error ? true : undefined,
    id,
  };

  if (isSystemAttr(el.name, name)) {
    // Código ou sequência gerado pelo Lattes: texto, não campo.
    return (
      <div className="field field-readonly" title="Gerado pelo Lattes; não se edita aqui">
        <span className="field-label">{text}</span>
        <span className="field-copy-row">
          <span className="readonly-value">{value || '(vazio)'}</span>
          {copyable && <CopyButton label={text} value={value} />}
        </span>
      </div>
    );
  }

  const boolean = isBooleanAttr(name, spec, value);
  let control;
  if (boolean) {
    control = (
      <span className="switch-row">
        <Switch
          aria-describedby={common['aria-describedby']}
          aria-labelledby={labelId}
          checked={value === 'SIM'}
          id={id}
          onChange={(on) => commit(on ? 'SIM' : 'NAO')}
        />
        <span aria-hidden="true" className="switch-text">
          {value === 'SIM' ? 'Sim' : value === 'NAO' ? 'Não' : 'Não informado'}
        </span>
      </span>
    );
  } else if (spec?.enum) {
    // Valor fora da lista (exportação mais nova que o XSD) continua visível.
    const values = spec.enum.includes(value) || value === '' ? spec.enum : [value, ...spec.enum];
    control = (
      <Select
        {...common}
        options={[
          { label: '(escolha)', value: '' },
          ...values.map((v) => ({ label: enumLabel(v), value: v })),
        ]}
        value={value}
        onChange={commit}
      />
    );
  } else if (prominent) {
    control = (
      <textarea
        {...common}
        className="title-input"
        placeholder={text}
        rows={1}
        value={draft}
        onBlur={() => commit(draft)}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // Título é uma linha só: Enter confirma em vez de quebrar.
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
      />
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
    <div
      className={`field${wide || prominent ? ' field-wide' : ''}${prominent ? ' field-prominent' : ''}${error ? ' has-error' : ''}`}
    >
      <label
        className={prominent ? 'sr-only' : undefined}
        htmlFor={id}
        id={labelId}
        title={spec?.patched ? `${name} (fora do XSD publicado)` : name}
      >
        {text}
        {(spec?.required || required) && (
          <span aria-label="obrigatório" className="required">
            {' '}
            *
          </span>
        )}
      </label>
      {copyable && !boolean ? (
        <span className="field-copy-row">
          {control}
          <CopyButton label={text} value={value} />
        </span>
      ) : (
        control
      )}
      {repaired !== undefined && (
        <span className="field-note">
          Texto estragado no próprio Lattes (acentos ou &quot;aspas&quot;).{' '}
          <button
            className="link-btn"
            title={repaired}
            type="button"
            onClick={() => commit(repaired)}
          >
            Corrigir
          </button>
        </span>
      )}
      {error && (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}
