// Renderização genérica de qualquer elemento a partir do schema: atributos como
// campos, filhos como blocos recolhíveis. Serve a cauda longa de seções; as
// mais usadas ganham formulários próprios no marco 2.

import { useId, useState } from 'react';

import { attributeLabel, elementLabel, enumLabel } from '../labels/labels.ts';
import { childElements, getAttr, setAttr, type XElement, type XText } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import type { AttributeSpec } from '../schema/types.ts';
import { isListItem } from './item-meta.ts';
import { ItemList } from './ItemList.tsx';
import { summarize } from './summary.ts';

export type EditFn = (note: string) => void;

interface ViewProps {
  el: XElement;
  showEmpty: boolean;
  onEdit: EditFn;
}

function AttributeField({
  el,
  name,
  onEdit,
  spec,
}: {
  el: XElement;
  spec?: AttributeSpec;
  name: string;
  onEdit: EditFn;
}) {
  const value = getAttr(el, name) ?? '';
  const [draft, setDraft] = useState(value);
  const label = attributeLabel(name);
  const commit = (next: string) => {
    if (next === (getAttr(el, name) ?? '')) return;
    setAttr(el, name, next);
    onEdit(`${elementLabel(el.name)} · ${label}`);
  };
  const id = useId();

  let control;
  if (spec?.enum) {
    const options = spec.enum.includes(value) || value === '' ? spec.enum : [value, ...spec.enum];
    control = (
      <select id={id} value={value} onChange={(e) => commit(e.target.value)}>
        <option value="">(vazio)</option>
        {options.map((v) => (
          <option key={v} value={v}>
            {enumLabel(v)}
          </option>
        ))}
      </select>
    );
  } else if (value.length > 90) {
    control = (
      <textarea
        id={id}
        rows={4}
        value={draft}
        onBlur={() => commit(draft)}
        onChange={(e) => setDraft(e.target.value)}
      />
    );
  } else {
    control = (
      <input
        id={id}
        type="text"
        value={draft}
        onBlur={() => commit(draft)}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    );
  }

  return (
    <div className="field">
      <label htmlFor={id} title={spec?.patched ? `${name} (fora do XSD publicado)` : name}>
        {label}
        {spec?.required && (
          <span aria-label="obrigatório" className="required">
            {' '}
            *
          </span>
        )}
      </label>
      {control}
    </div>
  );
}

export function Attributes({ el, onEdit, showEmpty }: ViewProps) {
  const spec = lattesSchema.elements[el.name];
  const known = new Map(spec?.attributes.map((a) => [a.name, a]));
  // Ordem do arquivo; atributos desconhecidos também aparecem.
  const names = el.attrs
    .map((a) => a.name)
    .filter((n) => showEmpty || (getAttr(el, n) ?? '') !== '');
  const text = el.children.find((c): c is XText => c.kind === 'text' && c.value.trim() !== '');
  if (names.length === 0 && !spec?.mixed) return null;
  return (
    <div className="fields">
      {names.map((n) => (
        <AttributeField key={n} el={el} name={n} spec={known.get(n)} onEdit={onEdit} />
      ))}
      {spec?.mixed && <TextField el={el} node={text} onEdit={onEdit} />}
    </div>
  );
}

function TextField({ el, node, onEdit }: { el: XElement; node?: XText; onEdit: EditFn }) {
  const [draft, setDraft] = useState(node?.value ?? '');
  const id = useId();
  return (
    <div className="field field-wide">
      <label htmlFor={id}>Texto</label>
      <textarea
        id={id}
        rows={3}
        value={draft}
        onBlur={() => {
          if (draft === (node?.value ?? '')) return;
          if (node) node.value = draft;
          else {
            el.children.push({ kind: 'text', value: draft });
            el.selfClosing = false;
          }
          onEdit(`${elementLabel(el.name)} · texto`);
        }}
        onChange={(e) => setDraft(e.target.value)}
      />
    </div>
  );
}

/**
 * Elemento com atributos e filhos. Um contêiner puro (sem atributos) cujos
 * filhos são itens vira linha do tempo; o resto vira blocos recolhíveis.
 */
export function ElementView({ depth = 0, el, onEdit, showEmpty }: ViewProps & { depth?: number }) {
  const children = childElements(el).filter((c) => c.attrs.length > 0 || c.children.length > 0);
  if (el.attrs.length === 0 && children.length > 0 && children.every(isListItem)) {
    return <ItemList depth={depth} items={children} showEmpty={showEmpty} onEdit={onEdit} />;
  }
  return (
    <div className={`element depth-${Math.min(depth, 3)}`}>
      <Attributes el={el} showEmpty={showEmpty} onEdit={onEdit} />
      {children.map((child, i) => {
        const summary = summarize(child);
        const repeated = children.filter((c) => c.name === child.name).length > 1 || summary !== '';
        return (
          <details key={i} className={repeated ? 'item' : 'sub'} open={!repeated && depth < 1}>
            <summary>
              <span className="item-kind">{elementLabel(child.name)}</span>
              {summary && <span className="item-summary">{summary}</span>}
            </summary>
            <ElementView depth={depth + 1} el={child} showEmpty={showEmpty} onEdit={onEdit} />
          </details>
        );
      })}
    </div>
  );
}
