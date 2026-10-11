// Renderização genérica de qualquer elemento a partir do schema: atributos como
// campos, filhos como blocos recolhíveis. Serve a cauda longa de seções; as
// mais usadas ganham formulários próprios no marco 2.

import { useId, useState } from 'react';

import { elementLabel } from '../labels/labels.ts';
import { childElements, getAttr, type XElement, type XText } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { AttributeField, type EditFn } from './AttributeField.tsx';
import { isListItem } from './item-meta.ts';
import { ItemList } from './ItemList.tsx';
import { useReferenceIndex } from './reference-context.ts';
import { viewForContainer } from './reference-tables.ts';
import { summarize } from './summary.ts';

export type { EditFn } from './AttributeField.tsx';

interface ViewProps {
  el: XElement;
  showEmpty: boolean;
  onEdit: EditFn;
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
        <AttributeField key={n} copyable el={el} name={n} spec={known.get(n)} onEdit={onEdit} />
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
  const index = useReferenceIndex();
  if (el.attrs.length === 0 && children.length > 0 && children.every(isListItem)) {
    return (
      <ItemList
        depth={depth}
        items={children}
        showEmpty={showEmpty}
        view={viewForContainer(el.name, index)}
        onEdit={onEdit}
      />
    );
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
