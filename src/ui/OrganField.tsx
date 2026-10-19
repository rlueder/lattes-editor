// Órgão e unidade da participação em projeto, escolhidos na janela de órgãos
// do Lattes pelo conector (src/bridge/production/organ.ts). A lista é a da
// instituição da atuação, e só é lida quando a pessoa pede, como a de cursos.
// A unidade é uma das do órgão escolhido.

import { useEffect, useRef, useState } from 'react';

import type { Organ } from '../bridge/lattes-lists.ts';
import { ORGAN_PARTS } from '../bridge/production/organ.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import { useEditor } from './editor-context.ts';
import type { LattesLists } from './lattes-lists-context.ts';
import { applyOrgan, applyUnit, findOrgan, institutionOf } from './live-lists.ts';
import { ComboSelect } from './primitives/ComboSelect.tsx';

/** Valor das opções "como está salvo": escolhê-las não muda nada. */
const SAVED = '\u0000salvo';

type State =
  | { kind: 'carregando' }
  | { detail: string; kind: 'erro' }
  | { kind: 'parado' }
  | { kind: 'pronto'; organs: Organ[] };

interface Props {
  common: { 'aria-describedby'?: string; 'aria-invalid'?: boolean; id?: string };
  el: XElement;
  kind: 'orgao' | 'unidade';
  lists: LattesLists;
  onChanged: () => void;
}

export function OrganControl({ common, el, kind, lists, onChanged }: Props) {
  const { root } = useEditor();
  const institution = institutionOf(root, el);
  const { organ, unit } = ORGAN_PARTS;
  const parent = kind === 'unidade' ? (getAttr(el, organ.code) ?? '') : '';
  const pair = kind === 'orgao' ? organ : unit;
  const code = getAttr(el, pair.code) ?? '';
  const value = getAttr(el, pair.name) ?? '';
  const [state, setState] = useState<State>({ kind: 'parado' });
  // Uma leitura que ficou para trás (outro órgão, campo fechado) não vale.
  const latest = useRef(0);
  useEffect(() => {
    latest.current++;
    setState({ kind: 'parado' });
  }, [institution, parent]);
  useEffect(
    () => () => {
      latest.current++;
    },
    [],
  );

  const load = () => {
    const n = ++latest.current;
    setState({ kind: 'carregando' });
    lists
      .loadOrgans(institution, parent)
      .then((organs) => n === latest.current && setState({ kind: 'pronto', organs }))
      .catch(
        (err: unknown) =>
          n === latest.current &&
          setState({
            detail: err instanceof Error ? err.message : 'falha inesperada',
            kind: 'erro',
          }),
      );
  };

  if (!institution) {
    return (
      <span className="live-list-pending">
        <span className="readonly-value" id={common.id}>
          {value || '(vazio)'}
        </span>
        <span className="field-note">A atuação do projeto não tem instituição escolhida</span>
      </span>
    );
  }

  if (state.kind !== 'pronto') {
    return (
      <span className="live-list-pending">
        <span className="readonly-value" id={common.id}>
          {value || '(vazio)'}
        </span>
        {state.kind === 'carregando' ? (
          <span className="muted" role="status">
            {kind === 'orgao' ? 'Lendo os órgãos no Lattes…' : 'Lendo as unidades no Lattes…'}
          </span>
        ) : (
          <button className="link-btn" type="button" onClick={load}>
            {state.kind === 'erro' ? 'Tentar de novo' : 'Escolher na lista do Lattes'}
          </button>
        )}
        {state.kind === 'erro' && (
          <span className="field-note" role="status">
            Não deu para ler a lista: {state.detail}
          </span>
        )}
      </span>
    );
  }

  const match = findOrgan(state.organs, code, value);
  const saved = !match && value !== '';
  return (
    <ComboSelect
      {...common}
      options={[
        { label: kind === 'orgao' ? '(escolha o órgão)' : '(sem unidade)', value: '' },
        ...(saved ? [{ label: `${value} (como está salvo)`, value: SAVED }] : []),
        ...state.organs.map((o) => ({ label: o.name, value: o.code })),
      ]}
      value={match?.code ?? (saved ? SAVED : '')}
      onChange={(next) => {
        if (next === SAVED) return;
        const picked = state.organs.find((o) => o.code === next);
        // O órgão não fica vazio pelo conector (organ.ts): "(escolha o órgão)" não apaga.
        if (kind === 'orgao' && !picked) return;
        if (kind === 'orgao' ? applyOrgan(el, picked) : applyUnit(el, picked)) onChanged();
      }}
    />
  );
}
