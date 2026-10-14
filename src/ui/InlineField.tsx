// Um pedaço do texto de leitura que vira campo no mesmo lugar: sem borda até
// o passar do mouse ou o foco, na mesma fonte e no mesmo corpo do texto, para
// a pessoa ver que é aquele texto que está editando. Grava ao sair do campo,
// como os outros campos do editor.

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { attributeLabelIn, elementLabel } from '../labels/labels.ts';
import { getAttr, setAttr } from '../model/xml.ts';
import { AttributeField, type EditFn } from './AttributeField.tsx';
import { DateField } from './DateField.tsx';
import { useLattesListsContext } from './lattes-lists-context.ts';
import { inlineKind, selectOptions } from './reading-field.ts';
import { type Part, partText } from './reading-layout.ts';
import { YearField } from './YearField.tsx';

interface Props {
  /** Campo que cabe na frase (endereço, período, idioma); senão ocupa a linha. */
  inline?: boolean;
  part: Part;
  /** Avisa o campo ativo (foco ou mouse), para acender o trecho na referência. */
  onActive?: (key: string | null) => void;
  /** Cada tecla, antes de gravar: a referência viva acompanha. */
  onDraft?: (key: string, value: string) => void;
  onEdit: EditFn;
}

export function InlineField({ inline = false, onActive, onDraft, onEdit, part }: Props) {
  const lists = useLattesListsContext();
  const { attr, el, key } = part;
  const value = getAttr(el, attr) ?? '';
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const id = useId();
  const label = attributeLabelIn(el.name, attr);
  const kind = inlineKind(el, attr, lists);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // Área de texto do tamanho do texto, sem barra de rolagem.
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;
  }, [draft]);

  const commit = (next: string) => {
    onDraft?.(key, next);
    if (next === (getAttr(el, attr) ?? '')) return;
    setAttr(el, attr, next);
    onEdit(`${elementLabel(el.name)} · ${label}`);
  };
  const activity = {
    onBlur: () => onActive?.(null),
    onFocus: () => onActive?.(key),
    onMouseEnter: () => onActive?.(key),
    onMouseLeave: () => onActive?.(null),
  };
  const common = { 'aria-label': label, 'data-field': key, id };

  if (kind === 'locked') {
    return (
      <span
        className="inline-locked"
        data-field={key}
        tabIndex={-1}
        title="Vem de uma lista do Lattes ou do próprio Lattes; não se edita aqui"
      >
        {partText(part)}
      </span>
    );
  }
  if (kind === 'live') {
    return (
      <span className="inline-live">
        <AttributeField el={el} name={attr} onEdit={onEdit} />
      </span>
    );
  }
  if (kind === 'select') {
    return (
      <select
        {...common}
        {...activity}
        className={inline ? 'inline-select is-inline' : 'inline-select'}
        value={value}
        onChange={(e) => commit(e.target.value)}
      >
        {selectOptions(el, attr, part.format).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (kind === 'year' || kind === 'date') {
    const Field = kind === 'year' ? YearField : DateField;
    return (
      <span className={`inline-picker inline-${kind}`} {...activity}>
        <Field common={common} label={label} value={value} onCommit={commit} />
      </span>
    );
  }
  if (inline) {
    return (
      <input
        {...common}
        {...activity}
        className="inline-input is-inline"
        size={Math.max(draft.length, 3)}
        type="text"
        value={draft}
        onBlur={() => {
          onActive?.(null);
          commit(draft);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          onDraft?.(key, e.target.value);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    );
  }
  return (
    <textarea
      {...common}
      {...activity}
      ref={areaRef}
      className={kind === 'long' ? 'inline-input is-long' : 'inline-input'}
      rows={1}
      value={draft}
      onBlur={() => {
        onActive?.(null);
        commit(draft);
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        onDraft?.(key, e.target.value);
      }}
      onKeyDown={(e) => {
        // Só o texto longo tem parágrafo; nos outros, Enter confirma.
        if (e.key === 'Enter' && kind !== 'long') {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
    />
  );
}
