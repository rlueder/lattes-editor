// Item novo que é só um nome: a disciplina de uma atividade de ensino e o
// treinamento de uma atividade de treinamento. No XML, o nome é o texto do
// elemento (DISCIPLINA e TREINAMENTO não têm outro atributo além do número).
// Como os outros itens novos, nada entra no documento até "Salvar".

import { useId, useState } from 'react';

import type { GeneralType } from '../model/general-items.ts';
import type { XElement } from '../model/xml.ts';
import { Modal } from '../ui/Modal.tsx';
import { itemText, setItemText } from './use-general-item.ts';

interface Props {
  /** Onde o item entra, para a pessoa conferir ("Universidade X · Curso"). */
  hostLabel?: string;
  item: XElement;
  type: GeneralType;
  onCancel: () => void;
  onSave: (item: XElement) => void;
}

export function TextItemForm({ hostLabel, item, onCancel, onSave, type }: Props) {
  const [text, setText] = useState(() => itemText(item));
  const [attempted, setAttempted] = useState(false);
  const id = useId();
  const empty = !text.trim();

  return (
    <Modal focusFirstField open className="form-modal" label={type.label} onClose={onCancel}>
      <form
        className="production-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (empty) {
            setAttempted(true);
            return;
          }
          setItemText(item, text.trim());
          onSave(item);
        }}
      >
        <div className="modal-body">
          {hostLabel && <p className="muted">Em {hostLabel}</p>}
          <div className="field field-wide">
            <label htmlFor={id}>Nome</label>
            <input
              aria-invalid={attempted && empty ? true : undefined}
              id={id}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {attempted && empty && <span className="field-error">Obrigatório</span>}
          </div>
        </div>
        <footer className="modal-foot form-foot">
          <span className="form-ok">
            Vai ao Lattes pela lista de alterações, não pelo Importar.
          </span>
          <span className="form-actions">
            <button className="primary" type="submit">
              Salvar
            </button>
          </span>
        </footer>
      </form>
    </Modal>
  );
}
