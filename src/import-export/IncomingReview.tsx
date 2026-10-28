// Revisão dos itens que vêm de outro XML (LAT-45): cada um com o item do
// currículo com que se parece, a pontuação e o motivo. Só o que a pessoa
// marcar entra, como item novo; nada é mesclado nem descartado sozinho. Os
// que não se parecem com nada vêm marcados.

import { useState } from 'react';

import { elementLabel } from '../labels/labels.ts';
import { candidateLine, type IncomingItem, reasons } from '../review/dedup.ts';
import { itemMeta } from '../ui/item-meta.ts';
import { Modal } from '../ui/Modal.tsx';
import { diffSummary, initialChoice } from './incoming.ts';

interface Props {
  /** O pré-diff da leva; undefined fecha o painel. */
  diff?: IncomingItem[];
  fileName?: string;
  onCancel: () => void;
  onInclude: (chosen: IncomingItem[]) => void;
}

export function IncomingReview(props: Props) {
  // Cada leva começa com a escolha inicial dela.
  return <IncomingReviewBody key={props.diff ? props.fileName : 'fechado'} {...props} />;
}

function IncomingReviewBody({ diff, fileName, onCancel, onInclude }: Props) {
  const [chosen, setChosen] = useState(() => (diff ? initialChoice(diff) : []));
  const count = chosen.filter(Boolean).length;
  const toggle = (i: number) => setChosen((c) => c.map((v, j) => (j === i ? !v : v)));

  return (
    <Modal
      className="export incoming"
      footer={
        <>
          <button className="ghost" type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="primary"
            disabled={count === 0}
            type="button"
            onClick={() => diff && onInclude(diff.filter((_, i) => chosen[i]))}
          >
            {count === 1 ? 'Incluir 1 item' : `Incluir ${count} itens`}
          </button>
        </>
      }
      label="Itens de outro arquivo"
      open={diff !== undefined}
      subtitle="Cada item comparado com o seu currículo por título, DOI, autores, ano, tipo e veículo. Entram só os itens que você marcar."
      title="Itens de outro arquivo"
      onClose={onCancel}
    >
      {diff && (
        <>
          <p className="incoming-summary">
            <strong>{diffSummary(diff)}</strong>
            {fileName && <span className="muted"> em {fileName}</span>}
          </p>
          <ul className="incoming-list">
            {diff.map((d, i) => {
              const meta = itemMeta(d.item);
              return (
                <li key={i}>
                  <label className={`incoming-row ${d.status}`}>
                    <input
                      checked={chosen[i] ?? false}
                      type="checkbox"
                      onChange={() => toggle(i)}
                    />
                    <span className="incoming-body">
                      <span className="incoming-head">
                        <span className="pending-title">{meta.title || '(sem título)'}</span>
                        <span className="incoming-meta">
                          {[elementLabel(d.item.name), meta.year].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {d.best ? (
                        <>
                          <span className="incoming-match">{candidateLine(d.best)}</span>
                          <span className="incoming-reasons">{reasons(d.best).join(' · ')}</span>
                        </>
                      ) : (
                        <span className="incoming-reasons">Nada parecido no currículo.</span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}
