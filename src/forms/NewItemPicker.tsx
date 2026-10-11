// Escolha do tipo de item novo: os tipos com formulário próprio primeiro,
// depois todos os tipos importáveis, agrupados pelo módulo do Passo 2.

import { useId, useMemo, useState } from 'react';

import { elementLabel, fold } from '../labels/labels.ts';
import { type CrossrefWork, itemNameFor } from '../lookups/crossref.ts';
import { DoiLookup } from '../lookups/DoiLookup.tsx';
import { importableTypes, type ProductionType } from '../model/production.ts';
import { lattesSchema as schema } from '../schema/lattes.ts';
import { Modal } from '../ui/Modal.tsx';
import { FORM_SPECS } from './specs.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (type: ProductionType, work?: CrossrefWork) => void;
}

export function NewItemPicker({ onClose, onPick, open }: Props) {
  const [query, setQuery] = useState('');
  const inputId = useId();
  const types = useMemo(() => importableTypes(schema), []);
  const labelOf = (t: ProductionType) =>
    FORM_SPECS.find((s) => s.itemName === t.itemName)?.title ?? elementLabel(t.itemName);

  const q = fold(query.trim());
  const matches = (t: ProductionType) => !q || fold(`${labelOf(t)} ${t.module.label}`).includes(q);

  const common = FORM_SPECS.map((s) => types.find((t) => t.itemName === s.itemName)!).filter(
    (t) => t && matches(t),
  );
  const byModule = new Map<string, ProductionType[]>();
  for (const t of types) {
    if (!matches(t)) continue;
    byModule.set(t.module.label, [...(byModule.get(t.module.label) ?? []), t]);
  }

  const pick = (t: ProductionType) => {
    setQuery('');
    onPick(t);
  };

  const button = (t: ProductionType) => (
    <li key={`${t.module.id}-${t.itemName}`}>
      <button className="picker-item" type="button" onClick={() => pick(t)}>
        {labelOf(t)}
      </button>
    </li>
  );

  return (
    <Modal focusFirstField className="picker" label="Novo item" open={open} onClose={onClose}>
      <h2 className="picker-title">Novo item de produção</h2>
      <label className="sr-only" htmlFor={inputId}>
        Filtrar tipos
      </label>
      <input
        className="palette-input"
        id={inputId}
        placeholder="Filtrar (artigo, evento, banca…)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="picker-doi">
        <DoiLookup
          action="Começar"
          hint="Começar por um DOI escolhe o tipo e preenche o formulário."
          onFound={(work) => {
            const itemName = itemNameFor(work);
            const type = itemName && types.find((t) => t.itemName === itemName);
            if (!type)
              return `O Crossref classifica esse DOI como "${work.type}", que não tem tipo correspondente no Lattes. Escolha o tipo abaixo.`;
            setQuery('');
            onPick(type, work);
            return undefined;
          }}
        />
      </div>
      <div className="picker-body">
        {common.length > 0 && (
          <section>
            <h3>Mais usados</h3>
            <ul>{common.map(button)}</ul>
          </section>
        )}
        {[...byModule].map(([module, list]) => (
          <section key={module}>
            <h3>{module}</h3>
            <ul>{list.map(button)}</ul>
          </section>
        ))}
        {common.length === 0 && byModule.size === 0 && (
          <p className="muted">Nenhum tipo encontrado.</p>
        )}
      </div>
    </Modal>
  );
}
