// Escolha do nível de uma formação nova: no Lattes, o "Incluir novo item" da
// formação pede o nível antes de abrir o formulário, e cada nível é um
// elemento próprio no XML. As outras seções têm um tipo só e abrem o
// formulário direto.

import type { GeneralType } from '../model/general-items.ts';
import { Modal } from '../ui/Modal.tsx';
import { GeneralItemForm } from './GeneralItemForm.tsx';
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

/** O seletor de nível e o formulário do item novo, como o App os mostra. */
export function GeneralItemDialogs({
  general,
  sectionLabel,
}: {
  general: ReturnType<typeof useGeneralItem>;
  sectionLabel: string;
}) {
  return (
    <>
      {general.draft && (
        <GeneralItemForm
          atuacoes={general.atuacoes}
          item={general.draft.item}
          knownAuthors={general.authors}
          sectionLabel={sectionLabel}
          type={general.draft.type}
          onCancel={general.cancel}
          onSave={general.save}
        />
      )}
      <GeneralItemPicker
        open={general.pickerTypes.length > 0}
        title="Nova formação acadêmica"
        types={general.pickerTypes}
        onClose={general.closePicker}
        onPick={general.start}
      />
    </>
  );
}
