// Lista "Alterações a enviar ao Lattes": o que mudou nas seções e nos itens
// que já estão no Lattes, agrupado por seção, com antes e depois e o
// descartar por campo. No desenho do ⌘K: títulos de grupo, linhas sem caixa,
// fios entre os itens; o caminho (extensão, não enviado) fica uma vez, no
// título da parte do painel, e não em cada item. Os campos de cada item vão
// numa grade de duas ou três colunas (FieldChange.tsx), sem os códigos que o
// Lattes gera (visibleFields). Descartar pergunta antes: não há desfazer.

import { useState } from 'react';

import { elementLabel } from '../labels/labels.ts';
import { visibleFields } from './change-fields.ts';
import type { ChangeEntry, ChangeGroup } from './changes-view.ts';
import { RemoveConfirm } from './dialogs.tsx';
import { displayValue } from './display.ts';
import { FieldChange } from './FieldChange.tsx';
import { TrashIcon } from './icons.tsx';
import { Tip } from './primitives/Tip.tsx';
import { useShowCodes } from './show-codes.ts';

/** Selo só para as exceções: a lista inteira é de alterações, e a alteração de um item não tem selo. */
const KIND_BADGE = { alterado: undefined, novo: 'novo', removido: 'removido' } as const;

interface Props {
  groups: ChangeGroup[];
  onDiscard: (entry: ChangeEntry) => void;
  onDiscardField: (entry: ChangeEntry, attr: string) => void;
}

/** O que a pessoa pediu para descartar, à espera da confirmação. */
interface Discarding {
  entry: ChangeEntry;
  /** Um campo só de uma alteração; sem ele, a inclusão ou a exclusão inteira. */
  field?: { attr: string; label: string };
}

export function ChangesList({ groups, onDiscard, onDiscardField }: Props) {
  const showCodes = useShowCodes();
  // O pedido fica guardado ao fechar, para o texto não trocar durante a saída do diálogo.
  const [discarding, setDiscarding] = useState<Discarding | undefined>();
  const [asking, setAsking] = useState(false);
  const ask = (d: Discarding) => {
    setDiscarding(d);
    setAsking(true);
  };
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
                    {KIND_BADGE[change.kind] && (
                      <span className={`change-kind kind-${change.kind}`}>
                        {KIND_BADGE[change.kind]}
                      </span>
                    )}
                    {change.kind !== 'alterado' && (
                      <span className="change-actions">
                        <DiscardButton
                          label={
                            change.kind === 'novo' ? 'Descartar inclusão' : 'Descartar exclusão'
                          }
                          onClick={() => ask({ entry })}
                        />
                      </span>
                    )}
                  </div>
                  <div className="change-fields">
                    {visibleFields(change, showCodes).map((f) => {
                      // Código de enum aparece (e é copiado) como o rótulo do formulário do Lattes.
                      const show = (v: string) => displayValue(change.element, f.attr, v);
                      const after = change.kind === 'removido' ? show(f.before) : show(f.after);
                      return (
                        <FieldChange
                          key={f.attr}
                          captions
                          actions={
                            change.kind === 'alterado' && (
                              <DiscardButton
                                label={`Descartar ${f.label}`}
                                onClick={() =>
                                  ask({ entry, field: { attr: f.attr, label: f.label } })
                                }
                              />
                            )
                          }
                          after={after}
                          before={change.kind === 'alterado' ? show(f.before) : undefined}
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
      <DiscardChangeConfirm
        discarding={discarding}
        open={asking}
        onCancel={() => setAsking(false)}
        onConfirm={(d) => {
          setAsking(false);
          if (d.field) onDiscardField(d.entry, d.field.attr);
          else onDiscard(d.entry);
        }}
      />
    </div>
  );
}

/**
 * A pergunta antes de descartar. O título do item vai em destaque, para a
 * pessoa conferir que é o certo. A cópia de trabalho não tem desfazer: o
 * descarte só volta restaurando um estado do Histórico de alterações.
 */
function DiscardChangeConfirm({
  discarding,
  onCancel,
  onConfirm,
  open,
}: {
  discarding: Discarding | undefined;
  open: boolean;
  onCancel: () => void;
  onConfirm: (d: Discarding) => void;
}) {
  const change = discarding?.entry.change;
  const name = discarding
    ? discarding.entry.itemTitle || discarding.entry.change.form || elementLabel(change!.element)
    : '';
  const field = discarding?.field;
  const copy = field
    ? {
        body: (
          <p>
            <strong>{field.label}</strong>, em <strong>{name}</strong>, volta ao valor que está no
            Lattes. O que foi escrito aqui se perde.
          </p>
        ),
        confirm: 'Descartar',
        title: 'Descartar a alteração do campo?',
      }
    : change?.kind === 'removido'
      ? {
          body: (
            <p>
              <strong>{name}</strong> volta à cópia de trabalho como está no Lattes, e a exclusão
              sai desta lista.
            </p>
          ),
          confirm: 'Descartar exclusão',
          title: 'Descartar a exclusão?',
        }
      : {
          body: (
            <p>
              <strong>{name}</strong> sai da cópia de trabalho e não vai ao Lattes. O que foi
              preenchido nele se perde.
            </p>
          ),
          confirm: 'Descartar inclusão',
          title: 'Descartar a inclusão?',
        };
  return (
    <RemoveConfirm
      confirmLabel={copy.confirm}
      open={open && discarding !== undefined}
      title={copy.title}
      onCancel={onCancel}
      onConfirm={() => discarding && onConfirm(discarding)}
    >
      {copy.body}
    </RemoveConfirm>
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
