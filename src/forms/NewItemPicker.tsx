// Escolha do tipo de item novo. Um campo só: filtra os tipos ou, se o texto
// for um DOI, oferece começar por ele (o tipo vem do Crossref). Na abertura
// aparecem só os mais usados; os outros tipos ficam recolhidos por módulo.

import { useId, useMemo, useState } from 'react';

import { elementLabel, fold } from '../labels/labels.ts';
import {
  type CrossrefWork,
  DoiError,
  fetchCrossref,
  itemNameFor,
  normalizeDoi,
} from '../lookups/crossref.ts';
import { importableTypes, type ProductionType } from '../model/production.ts';
import { lattesSchema as schema } from '../schema/lattes.ts';
import { ChevronIcon, SearchIcon } from '../ui/icons.tsx';
import { Modal } from '../ui/Modal.tsx';
import { FORM_SPECS } from './specs.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (type: ProductionType, work?: CrossrefWork) => void;
}

type DoiState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string };

export function NewItemPicker({ onClose, onPick, open }: Props) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [doiState, setDoiState] = useState<DoiState>({ kind: 'idle' });
  const inputId = useId();
  const types = useMemo(() => importableTypes(schema), []);
  const labelOf = (t: ProductionType) =>
    FORM_SPECS.find((s) => s.itemName === t.itemName)?.title ?? elementLabel(t.itemName);

  const doi = normalizeDoi(query);
  const q = fold(query.trim());
  const searching = q !== '' && !doi;
  const matches = (t: ProductionType) =>
    !searching || fold(`${labelOf(t)} ${t.module.label}`).includes(q);

  const commonNames = new Set(FORM_SPECS.map((s) => s.itemName));
  const common = FORM_SPECS.map((s) => types.find((t) => t.itemName === s.itemName)!).filter(
    (t) => t && matches(t),
  );
  // Os mais usados não se repetem nos módulos; módulo que esvazia some.
  const byModule = new Map<string, ProductionType[]>();
  for (const t of types) {
    if (commonNames.has(t.itemName) || !matches(t)) continue;
    byModule.set(t.module.label, [...(byModule.get(t.module.label) ?? []), t]);
  }
  const othersCount = [...byModule.values()].reduce((n, l) => n + l.length, 0);

  const reset = () => {
    setQuery('');
    setShowAll(false);
    setDoiState({ kind: 'idle' });
  };

  const pick = (t: ProductionType, work?: CrossrefWork) => {
    reset();
    onPick(t, work);
  };

  const startFromDoi = async () => {
    if (!doi) return;
    setDoiState({ kind: 'loading' });
    try {
      const work = await fetchCrossref(doi);
      const itemName = itemNameFor(work);
      const type = itemName && types.find((t) => t.itemName === itemName);
      if (!type) {
        setDoiState({
          kind: 'error',
          message: `O Crossref classifica esse DOI como "${work.type}", sem tipo correspondente no Lattes. Apague o DOI e escolha o tipo.`,
        });
        return;
      }
      pick(type, work);
    } catch (err) {
      setDoiState({
        kind: 'error',
        message: err instanceof DoiError ? err.message : 'Não foi possível buscar o DOI.',
      });
    }
  };

  const item = (t: ProductionType) => (
    <li key={`${t.module.id}-${t.itemName}`}>
      <button className="picker-item" title={labelOf(t)} type="button" onClick={() => pick(t)}>
        {labelOf(t)}
      </button>
    </li>
  );

  return (
    <Modal
      focusFirstField
      className="picker"
      label="Novo item de produção"
      open={open}
      title="Novo item de produção"
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <div className="picker-filter">
        <SearchIcon />
        <label className="sr-only" htmlFor={inputId}>
          Filtrar tipos ou colar um DOI
        </label>
        <input
          id={inputId}
          placeholder="Filtrar tipos ou colar um DOI"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setDoiState({ kind: 'idle' });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && doi) {
              e.preventDefault();
              void startFromDoi();
            }
          }}
        />
      </div>

      {doi && (
        <div className="picker-doi-row">
          <button
            className="primary"
            disabled={doiState.kind === 'loading'}
            type="button"
            onClick={() => void startFromDoi()}
          >
            {doiState.kind === 'loading' ? 'Buscando…' : 'Começar pelo DOI'}
          </button>
          <span className="muted picker-doi-value">{doi}</span>
          {doiState.kind === 'error' && <p className="field-error">{doiState.message}</p>}
        </div>
      )}

      {!doi && (
        <>
          {common.length > 0 && (
            <section className="picker-section">
              <h3>Mais usados</h3>
              <ul className="picker-grid">{common.map(item)}</ul>
            </section>
          )}

          {othersCount > 0 &&
            (searching ? (
              [...byModule].map(([module, list]) => (
                <section key={module} className="picker-section">
                  <h3>{module}</h3>
                  <ul className="picker-grid">{list.map(item)}</ul>
                </section>
              ))
            ) : (
              <section className="picker-section">
                <button
                  aria-expanded={showAll}
                  className="picker-more"
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                >
                  <ChevronIcon />
                  Todos os tipos <span className="count">{othersCount}</span>
                </button>
                {showAll &&
                  [...byModule].map(([module, list]) => (
                    <div key={module} className="picker-module">
                      <h4>{module}</h4>
                      <ul className="picker-grid">{list.map(item)}</ul>
                    </div>
                  ))}
              </section>
            ))}

          {searching && common.length === 0 && othersCount === 0 && (
            <p className="empty">Nenhum tipo encontrado para &quot;{query}&quot;.</p>
          )}
        </>
      )}
    </Modal>
  );
}
