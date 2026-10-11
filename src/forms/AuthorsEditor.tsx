// Autores de um item: ordem, edição e reaproveitamento dos coautores que já
// aparecem no currículo (guia, marco 2). O dono do currículo entra como
// autor 1 nos itens novos.

import { useId, useState } from 'react';

import type { Author } from '../model/production.ts';
import { suggestCitation } from './citation.ts';

interface Props {
  authors: Author[];
  known: Author[];
  /** Rótulo da lista: "Autores" ou "Participantes". */
  label: string;
  onChange: (authors: Author[]) => void;
}

const EMPTY: Author = { citation: '', lattesId: '', name: '' };

export function AuthorsEditor({ authors, known, label, onChange }: Props) {
  const [query, setQuery] = useState('');
  const listId = useId();
  const inputId = useId();
  const used = new Set(authors.map((a) => a.lattesId || a.name.trim().toLowerCase()));
  const suggestions = known.filter((a) => !used.has(a.lattesId || a.name.trim().toLowerCase()));

  const update = (i: number, patch: Partial<Author>) =>
    onChange(authors.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const move = (i: number, delta: number) => {
    const next = [...authors];
    const [moved] = next.splice(i, 1);
    next.splice(i + delta, 0, moved!);
    onChange(next);
  };
  const add = () => {
    const name = query.trim();
    if (!name) return;
    const match = known.find((a) => a.name.trim().toLowerCase() === name.toLowerCase());
    onChange([...authors, match ?? { ...EMPTY, citation: suggestCitation(name), name }]);
    setQuery('');
  };

  return (
    <fieldset className="form-fieldset authors">
      <legend>{label}</legend>
      {authors.length === 0 && <p className="muted">Nenhum ainda.</p>}
      <ol className="author-list">
        {authors.map((a, i) => (
          <li key={i} className="author-row">
            <span aria-hidden="true" className="author-order">
              {i + 1}
            </span>
            <input
              aria-label={`Nome completo do autor ${i + 1}`}
              placeholder="Nome completo"
              value={a.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <input
              aria-label={`Nome para citação do autor ${i + 1}`}
              placeholder="Citação"
              value={a.citation}
              onChange={(e) => update(i, { citation: e.target.value })}
            />
            <input
              aria-label={`ID Lattes do autor ${i + 1}`}
              inputMode="numeric"
              placeholder="ID Lattes (opcional)"
              value={a.lattesId}
              onChange={(e) => update(i, { lattesId: e.target.value.replace(/\D/g, '') })}
            />
            <span className="author-actions">
              <button
                aria-label={`Subir autor ${i + 1}`}
                className="ghost icon"
                disabled={i === 0}
                type="button"
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                aria-label={`Descer autor ${i + 1}`}
                className="ghost icon"
                disabled={i === authors.length - 1}
                type="button"
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                aria-label={`Remover autor ${i + 1}`}
                className="ghost icon"
                type="button"
                onClick={() => onChange(authors.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ol>
      <div className="author-add">
        <label className="sr-only" htmlFor={inputId}>
          Adicionar autor
        </label>
        <input
          id={inputId}
          list={listId}
          placeholder="Adicionar: digite um nome (coautores do currículo aparecem na lista)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <datalist id={listId}>
          {suggestions.map((a, i) => (
            <option key={i} value={a.name}>
              {a.citation}
            </option>
          ))}
        </datalist>
        <button className="ghost" disabled={!query.trim()} type="button" onClick={add}>
          Adicionar
        </button>
      </div>
    </fieldset>
  );
}
