// Áreas do conhecimento de um item (até 3). As áreas que o currículo já usa
// aparecem como atalhos de um clique, para manter a mesma grafia entre itens.

import { useId } from 'react';

import { enumLabel } from '../labels/labels.ts';
import { type KnowledgeArea, MAX_AREAS } from '../model/production.ts';
import { lattesSchema as schema } from '../schema/lattes.ts';
import { ComboSelect } from '../ui/primitives/ComboSelect.tsx';
import { areaPath } from './area-path.ts';

interface Props {
  areas: KnowledgeArea[];
  known: KnowledgeArea[];
  onChange: (areas: KnowledgeArea[]) => void;
}

const EMPTY: KnowledgeArea = { area: '', bigArea: '', specialty: '', subArea: '' };
const BIG_AREAS =
  schema.elements['AREA-DO-CONHECIMENTO-1']?.attributes.find(
    (a) => a.name === 'NOME-GRANDE-AREA-DO-CONHECIMENTO',
  )?.enum ?? [];

const same = (a: KnowledgeArea, b: KnowledgeArea) =>
  a.bigArea === b.bigArea &&
  a.area === b.area &&
  a.subArea === b.subArea &&
  a.specialty === b.specialty;

export function AreasEditor({ areas, known, onChange }: Props) {
  const listId = useId();
  const full = areas.length >= MAX_AREAS;
  const suggestions = known.filter((k) => !areas.some((a) => same(a, k)));
  const update = (i: number, patch: Partial<KnowledgeArea>) =>
    onChange(areas.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  return (
    <fieldset className="form-fieldset areas">
      <legend>Áreas do conhecimento (até {MAX_AREAS})</legend>

      {suggestions.length > 0 && !full && (
        <div aria-label="Áreas já usadas no currículo" className="area-suggestions" role="group">
          {suggestions.slice(0, 6).map((k, i) => (
            <button
              key={i}
              className="ghost area-chip"
              title={`${enumLabel(k.bigArea)} › ${areaPath(k)}`}
              type="button"
              onClick={() => onChange([...areas, k])}
            >
              + {areaPath(k)}
            </button>
          ))}
        </div>
      )}

      <datalist id={listId}>
        {[...new Set(known.map((k) => k.area).filter(Boolean))].map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>

      {areas.map((a, i) => (
        <div key={i} className="area-row">
          <span aria-hidden="true" className="author-order">
            {i + 1}
          </span>
          <ComboSelect
            aria-label={`Grande área ${i + 1}`}
            options={[
              { label: '(grande área)', value: '' },
              ...BIG_AREAS.map((v) => ({ label: enumLabel(v), value: v })),
            ]}
            value={a.bigArea}
            onChange={(v) => update(i, { bigArea: v })}
          />
          <input
            aria-label={`Área ${i + 1}`}
            list={listId}
            placeholder="Área"
            value={a.area}
            onChange={(e) => update(i, { area: e.target.value })}
          />
          <input
            aria-label={`Subárea ${i + 1}`}
            placeholder="Subárea"
            value={a.subArea}
            onChange={(e) => update(i, { subArea: e.target.value })}
          />
          <input
            aria-label={`Especialidade ${i + 1}`}
            placeholder="Especialidade"
            value={a.specialty}
            onChange={(e) => update(i, { specialty: e.target.value })}
          />
          <button
            aria-label={`Remover área ${i + 1}`}
            className="ghost icon"
            type="button"
            onClick={() => onChange(areas.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}

      {!full && (
        <button
          className="ghost area-add"
          type="button"
          onClick={() => onChange([...areas, EMPTY])}
        >
          + Outra área
        </button>
      )}
    </fieldset>
  );
}
