// Lista "Alterações a levar ao Lattes": o que mudou e o Importar não leva,
// agrupado por seção do Lattes, com antes e depois, botão de copiar por campo
// e marcação de feito.

import { elementLabel } from '../labels/labels.ts';
import type { ChangeEntry, ChangeGroup } from './changes-view.ts';
import { CopyButton } from './CopyButton.tsx';
import { displayValue } from './display.ts';
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
        Nada a copiar à mão. Mudanças em Dados gerais, Formação, Atuação e em itens que já estão no
        Lattes aparecem aqui.
      </p>
    );
  }
  return (
    <div className="changes">
      {groups.map((g) => (
        <section key={g.label} className="changes-group">
          <h3>
            {g.label}
            {g.importable && (
              <span className="muted changes-note">
                {' '}
                · o Importar não altera itens que já estão no Lattes
              </span>
            )}
          </h3>
          <ul>
            {g.entries.map((entry) => {
              const { change } = entry;
              const context = [entry.itemTitle, change.form].filter(Boolean);
              return (
                <li key={change.key} className="change">
                  <div className="change-head">
                    <span className={`tag kind-${change.kind}`}>{KIND_LABEL[change.kind]}</span>
                    <span className="change-where">
                      {context.length ? context.join(' › ') : elementLabel(change.element)}
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
                  {
                    <table className="change-fields">
                      <tbody>
                        {change.fields.map((f) => {
                          // Código de enum aparece (e é copiado) como o rótulo do formulário do Lattes.
                          const show = (v: string) => displayValue(change.element, f.attr, v);
                          return (
                            <tr key={f.attr}>
                              <th scope="row">{f.label}</th>
                              {change.kind === 'alterado' && (
                                <td className="before">
                                  {show(f.before) || <span className="muted">(vazio)</span>}
                                </td>
                              )}
                              <td className="after">
                                {/* Copiar fica dentro do valor, à direita; em texto longo, no alto. */}
                                <span className="after-value">
                                  <span className="after-text">
                                    {change.kind === 'removido'
                                      ? show(f.before)
                                      : show(f.after) || <span className="muted">(vazio)</span>}
                                  </span>
                                  {change.kind !== 'removido' && show(f.after) && (
                                    <CopyButton label={f.label} value={show(f.after)} />
                                  )}
                                </span>
                              </td>
                              <td className="copy">
                                <span className="field-actions">
                                  {change.kind === 'alterado' && (
                                    <DiscardButton
                                      label={`Descartar ${f.label}`}
                                      onClick={() => onDiscardField(entry, f.attr)}
                                    />
                                  )}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  }
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
