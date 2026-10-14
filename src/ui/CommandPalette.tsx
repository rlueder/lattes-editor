// ⌘K (Ctrl+K fora do Mac): pular para qualquer seção ou grupo.

import { useEffect, useMemo, useRef, useState } from 'react';

import { Modal } from './Modal.tsx';
import { type PaletteEntry, searchPalette } from './palette-search.ts';
import { ClearButton } from './primitives/ClearButton.tsx';
import { effectiveQuery } from './query.ts';

interface Props {
  entries: PaletteEntry[];
  open: boolean;
  onClose: () => void;
  onSelect: (entry: PaletteEntry) => void;
}

export function CommandPalette({ entries, onClose, onSelect, open }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const results = useMemo(() => searchPalette(entries, query), [entries, query]);
  const searching = effectiveQuery(query) !== '';

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    // O foco espera o diálogo montar.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (entry: PaletteEntry | undefined) => {
    if (!entry) return;
    onSelect(entry);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => (results.length ? (i + 1) % results.length : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
        break;
      case 'Enter':
        e.preventDefault();
        choose(results[active]);
        break;
    }
  };

  return (
    <Modal bare className="palette" label="Ir para seção" open={open} onClose={onClose}>
      <input
        ref={inputRef}
        aria-activedescendant={results[active] ? `palette-${results[active].key}` : undefined}
        aria-controls="palette-results"
        aria-expanded="true"
        autoComplete="off"
        className="palette-input"
        placeholder="Ir para… (Formação, Artigos, Bancas)"
        role="combobox"
        spellCheck={false}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <ClearButton input={inputRef} value={query} onClear={() => setQuery('')} />
      <ul ref={listRef} className="palette-results" id="palette-results" role="listbox">
        {results.length === 0 && <li className="palette-empty">Nenhuma seção encontrada.</li>}
        {results.map((entry, i) => (
          // O teclado é tratado no combobox (padrão ARIA APG); o clique é atalho de mouse.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <li
            key={entry.key}
            aria-selected={i === active}
            className={[
              'palette-item',
              entry.context ? 'child' : 'section',
              i === active ? 'active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-index={i}
            id={`palette-${entry.key}`}
            role="option"
            onClick={() => choose(entry)}
            onMouseMove={() => setActive(i)}
          >
            <span className="palette-label">
              {/* Sem busca, a lista já está agrupada por seção; o contexto só aparece filtrando. */}
              {entry.context && searching && (
                <span className="palette-context">{entry.context} › </span>
              )}
              {entry.label}
            </span>
            {entry.count !== undefined && entry.count > 1 && (
              <span className="palette-count">{entry.count}</span>
            )}
          </li>
        ))}
      </ul>
      <div className="palette-footer">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> navegar
        </span>
        <span>
          <kbd>↵</kbd> abrir
        </span>
        <span>
          <kbd>esc</kbd> fechar
        </span>
      </div>
    </Modal>
  );
}
