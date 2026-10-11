// Marcar itens de produção para uma seção-filtro (Inovação, Educação): uma
// lista com um interruptor por item, que liga ou desliga a marca no próprio
// item. A mudança entra na lista de alterações, como qualquer edição.

import { childElements, getAttr, setAttr, type XElement } from '../model/xml.ts';
import type { EditFn } from './AttributeField.tsx';
import { itemMeta } from './item-meta.ts';
import { Modal } from './Modal.tsx';
import { Switch } from './primitives/Switch.tsx';

interface Props {
  attr: string;
  items: XElement[];
  label: string;
  open: boolean;
  onClose: () => void;
  onEdit: EditFn;
}

/** Onde a marca mora: no item ou nos DADOS-BASICOS-* dele. */
function holder(el: XElement, attr: string): XElement {
  if (getAttr(el, attr) !== undefined) return el;
  return (
    childElements(el).find(
      (c) => c.name.startsWith('DADOS-BASICOS') && getAttr(c, attr) !== undefined,
    ) ?? el
  );
}

export function MarkDialog({ attr, items, label, onClose, onEdit, open }: Props) {
  const sorted = [...items].sort((a, b) => (itemMeta(b).year ?? 0) - (itemMeta(a).year ?? 0));
  return (
    <Modal
      className="mark-dialog"
      footer={
        <button className="primary" type="button" onClick={onClose}>
          Pronto
        </button>
      }
      label={`Marcar: ${label}`}
      open={open}
      subtitle={`Ligue "${label}" nos itens que fazem parte desta seção.`}
      title={`Marcar: ${label}`}
      onClose={onClose}
    >
      <ul className="mark-list">
        {sorted.map((el, i) => {
          const meta = itemMeta(el);
          const target = holder(el, attr);
          const on = getAttr(target, attr) === 'SIM';
          return (
            <li key={i} className="mark-row">
              <span className="mark-text">
                <span className="mark-title" id={`marca-${i}`}>
                  {meta.title || el.name}
                </span>
                {meta.year && <span className="muted mark-year">{meta.year}</span>}
              </span>
              <Switch
                aria-labelledby={`marca-${i}`}
                checked={on}
                onChange={(next) => {
                  setAttr(target, attr, next ? 'SIM' : 'NAO');
                  onEdit(`${label}: ${meta.title || el.name}`);
                }}
              />
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
