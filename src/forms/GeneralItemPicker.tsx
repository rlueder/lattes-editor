// Escolha do tipo de um item novo: no Lattes, o "Incluir novo item" da
// formação pede o nível antes de abrir o formulário, e cada nível é um
// elemento próprio no XML; em "Patentes e Registros", cada registro tem a sua
// lista. As outras seções têm um tipo só e abrem o formulário direto.

import type { GeneralType } from '../model/general-items.ts';
import { Modal } from '../ui/Modal.tsx';
import { GeneralItemForm } from './GeneralItemForm.tsx';
import { TextItemForm } from './TextItemForm.tsx';
import type { useGeneralItem } from './use-general-item.ts';

interface Props {
  open: boolean;
  title: string;
  types: GeneralType[];
  onClose: () => void;
  onPick: (type: GeneralType) => void;
}

export function GeneralItemPicker({ onClose, onPick, open, title, types }: Props) {
  return (
    <Modal className="picker" label={title} open={open} title={title} onClose={onClose}>
      <section className="picker-section">
        <ul className="picker-grid">
          {types.map((t) => (
            <li key={t.itemName}>
              <button className="picker-item" type="button" onClick={() => onPick(t)}>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </Modal>
  );
}

/** A escolha de onde o item entra: a atuação, a atividade ou o projeto. */
function HostPicker({
  hostPicker,
  onClose,
}: {
  hostPicker: NonNullable<ReturnType<typeof useGeneralItem>['hostPicker']>;
  onClose: () => void;
}) {
  const title = `${hostPicker.title}: onde entra`;
  return (
    <Modal open className="picker" label={title} title={title} onClose={onClose}>
      <section className="picker-section">
        {hostPicker.choices.length === 0 ? (
          <p className="muted">{hostPicker.empty}</p>
        ) : (
          <ul className="picker-grid">
            {hostPicker.choices.map((c) => (
              <li key={c.key}>
                <button className="picker-item" type="button" onClick={() => hostPicker.pick(c)}>
                  {c.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Modal>
  );
}

/** O seletor de tipo, o de lugar e o formulário do item novo, como o App os mostra. */
export function GeneralItemDialogs({
  general,
  sectionLabel,
}: {
  general: ReturnType<typeof useGeneralItem>;
  sectionLabel: string;
}) {
  const draft = general.draft;
  return (
    <>
      {draft && draft.type.text && (
        <TextItemForm
          hostLabel={draft.hostLabel}
          item={draft.item}
          type={draft.type}
          onCancel={general.cancel}
          onSave={(item) => general.save(item)}
        />
      )}
      {draft && !draft.type.text && (
        <GeneralItemForm
          atuacoes={general.atuacoes}
          item={draft.item}
          knownAuthors={general.authors}
          sectionLabel={sectionLabel}
          type={draft.type}
          onCancel={general.cancel}
          onSave={general.save}
        />
      )}
      <GeneralItemPicker
        open={general.pickerTypes.length > 0}
        title={general.pickerTitle}
        types={general.pickerTypes}
        onClose={general.closePicker}
        onPick={general.start}
      />
      {general.hostPicker && (
        <HostPicker hostPicker={general.hostPicker} onClose={general.closePicker} />
      )}
    </>
  );
}
