// Lista "Alterações a levar ao Lattes": o que mudou e o Importar não leva,
// agrupado por seção do Lattes, com antes e depois, botão de copiar por campo
// e marcação de feito.

import { elementLabel } from '../labels/labels.ts';
import type { ChangeEntry, ChangeGroup } from './changes-view.ts';
import { CopyButton } from './CopyButton.tsx';

const KIND_LABEL = { alterado: 'alterado', novo: 'incluir', removido: 'excluir' } as const;

interface Props {
  groups: ChangeGroup[];
  onToggleDone: (entry: ChangeEntry) => void;
}

export function ChangesList({ groups, onToggleDone }: Props) {
  if (groups.length === 0) {
    return (
      <p className="muted">
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
                <li key={change.key} className={entry.done ? 'change done' : 'change'}>
                  <div className="change-head">
                    <label className="change-done">
                      <input
                        checked={entry.done}
                        type="checkbox"
                        onChange={() => onToggleDone(entry)}
                      />
                      <span className="sr-only">Feito no Lattes</span>
                    </label>
                    <span className={`tag kind-${change.kind}`}>{KIND_LABEL[change.kind]}</span>
                    <span className="change-where">
                      {context.length ? context.join(' › ') : elementLabel(change.element)}
                    </span>
                  </div>
                  {!entry.done && (
                    <table className="change-fields">
                      <tbody>
                        {change.fields.map((f) => (
                          <tr key={f.attr}>
                            <th scope="row">{f.label}</th>
                            {change.kind === 'alterado' && (
                              <td className="before">
                                {f.before || <span className="muted">(vazio)</span>}
                              </td>
                            )}
                            <td className="after">
                              {change.kind === 'removido'
                                ? f.before
                                : f.after || <span className="muted">(vazio)</span>}
                            </td>
                            <td className="copy">
                              {change.kind !== 'removido' && (
                                <CopyButton label={f.label} value={f.after} />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
