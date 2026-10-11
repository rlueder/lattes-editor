// Campo "Buscar por DOI". Só o DOI sai do computador (ver crossref.ts).

import { useId, useState } from 'react';

import { type CrossrefWork, fetchCrossref } from './crossref.ts';

interface Props {
  /** Texto do botão. */
  action?: string;
  hint?: string;
  onFound: (work: CrossrefWork) => string | void;
}

export function DoiLookup({ action = 'Buscar', hint, onFound }: Props) {
  const [doi, setDoi] = useState('');
  const [state, setState] = useState<
    { kind: 'idle' } | { kind: 'loading' } | { kind: 'error' | 'done'; message: string }
  >({ kind: 'idle' });
  const id = useId();

  const search = async () => {
    if (!doi.trim()) return;
    setState({ kind: 'loading' });
    try {
      const work = await fetchCrossref(doi);
      const message = onFound(work);
      setState({ kind: 'done', message: message || 'Encontrado.' });
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message });
    }
  };

  return (
    <div className="doi-lookup">
      <label htmlFor={id}>Buscar por DOI</label>
      <div className="doi-row">
        <input
          id={id}
          placeholder="10.xxxx/… ou https://doi.org/…"
          spellCheck={false}
          value={doi}
          onChange={(e) => setDoi(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
          }}
        />
        <button
          className="ghost"
          disabled={!doi.trim() || state.kind === 'loading'}
          type="button"
          onClick={() => void search()}
        >
          {state.kind === 'loading' ? 'Buscando…' : action}
        </button>
      </div>
      {state.kind === 'error' && <p className="field-error">{state.message}</p>}
      {state.kind === 'done' && <p className="doi-done">{state.message}</p>}
      {state.kind === 'idle' && hint && <p className="muted doi-hint">{hint}</p>}
    </div>
  );
}
