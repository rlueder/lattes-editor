// Lista "Alterações a enviar ao Lattes": o que mudou nas seções e nos itens
// que já estão no Lattes, agrupado por seção, com antes e depois e o
// descartar por campo. No desenho do ⌘K: títulos de grupo, linhas sem caixa,
// fios entre os itens; o caminho (extensão, não enviado) fica uma vez, no
// título da parte do painel, e não em cada item.

import { elementLabel } from '../labels/labels.ts';
import type { ChangeEntry, ChangeGroup } from './changes-view.ts';
import { displayValue } from './display.ts';
import { FieldChange } from './FieldChange.tsx';
import { TrashIcon } from './icons.tsx';
import { Tip } from './primitives/Tip.tsx';

const KIND_LABEL = { alterado: 'alterado', novo: 'incluir', removido: 'excluir' } as const;

interface Props {
  groups: ChangeGroup[];
  onDiscard: (entry: ChangeEntry) => void;
  onDiscardField: (entry: ChangeEntry, attr: string) => void;
}

export function ChangesList({ groups, onDiscard, onDiscardField }: Props) {
  if (groups.length === 0) {
    return (
      <p className="empty">
        Nenhuma alteração. Mudanças em Dados gerais, Formação, Atuação e em itens que já estão no
        Lattes aparecem aqui.
      </p>
    );
  }
  return (
    <div className="changes">
      {groups.map((g) => (
        <section key={g.label} className="changes-group">
          <h3>{g.label}</h3>
          <ul>
            {g.entries.map((entry) => {
              const { change } = entry;
              const context = [entry.itemTitle, change.form].filter(Boolean);
              return (
                <li key={change.key} className="change">
                  <div className="change-head">
                    <span className="change-where">
                      {context.length ? context.join(' › ') : elementLabel(change.element)}
                    </span>
                    <span className={`change-kind kind-${change.kind}`}>
                      {KIND_LABEL[change.kind]}
                    </span>
                    {change.kind !== 'alterado' && (
                      <span className="change-actions">
                        <DiscardButton
                          label={
                            change.kind === 'novo' ? 'Descartar inclusão' : 'Descartar exclusão'
                          }
                          onClick={() => onDiscard(entry)}
                        />
                      </span>
                    )}
                  </div>
                  <div className="change-fields">
                    {change.fields.map((f, i) => {
                      // Código de enum aparece (e é copiado) como o rótulo do formulário do Lattes.
                      const show = (v: string) => displayValue(change.element, f.attr, v);
                      const after = change.kind === 'removido' ? show(f.before) : show(f.after);
                      return (
                        <FieldChange
                          key={f.attr}
                          actions={
                            change.kind === 'alterado' && (
                              <DiscardButton
                                label={`Descartar ${f.label}`}
                                onClick={() => onDiscardField(entry, f.attr)}
                              />
                            )
                          }
                          after={after}
                          before={change.kind === 'alterado' ? show(f.before) : undefined}
                          captions={i === 0}
                          label={f.label}
                        />
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Lixeira só de ícone, com dica do Base UI. */
function DiscardButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tip label={label}>
      <button
        aria-label={label}
        className="ghost icon-btn discard-btn"
        type="button"
        onClick={onClick}
      >
        <TrashIcon />
      </button>
    </Tip>
  );
}
