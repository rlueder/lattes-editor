// Bloco do modo de leitura (protótipo, ?leitura): o texto composto e, quando a
// pessoa pede, o formulário de hoje no mesmo lugar.

import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';

import { PencilIcon } from './icons.tsx';
import { clickOpensEditor, readingKeyAction } from './reading.ts';

/** Tecla G recente: o E seguinte é o atalho de seção (G E, Educação), não "editar". */
const GO_WINDOW_MS = 1500;
let goPressedAt = 0;

interface BlockProps {
  /** Pede a edição já com os campos vazios (o "Adicionar…"). */
  addLabel?: string;
  /** Conteúdo de leitura. */
  children: ReactNode;
  className?: string;
  /** O formulário de hoje; `showAll` pede também os campos vazios. */
  edit: (showAll: boolean) => ReactNode;
  /** Ação extra no topo do painel de edição (Editar no formulário). */
  editExtra?: ReactNode;
  /** Nome do bloco, para o botão e para leitores de tela. */
  label: string;
}

/**
 * Um bloco que se lê como texto e se edita no lugar. O ponto de foco (Tab) é
 * o botão "Editar", à vista no foco, no passar do mouse e sempre em telas de
 * toque; com ele focado, E também abre. O clique no texto abre a edição para
 * quem usa mouse ou toque, menos quando a pessoa está selecionando texto.
 * Esc ou "Concluir" voltam à leitura e devolvem o foco ao botão.
 */
export function EditableBlock({
  addLabel,
  children,
  className,
  edit,
  editExtra,
  label,
}: BlockProps) {
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);

  const open = (all = false) => {
    setShowAll(all);
    setEditing(true);
  };
  const close = () => {
    // Os campos gravam ao perder o foco: tirar o foco antes de fechar grava o
    // que estava sendo digitado.
    const active = document.activeElement;
    if (active instanceof HTMLElement && panelRef.current?.contains(active)) active.blur();
    restoreFocus.current = true;
    setEditing(false);
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  // Esc no painel volta à leitura. Ouvinte nativo de propósito: o Esc de um
  // menu aberto (em portal, fora do painel) não chega aqui.
  useEffect(() => {
    const panel = panelRef.current;
    if (!editing || !panel) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const action = readingKeyAction(e.key, {
        afterGo: false,
        editing: true,
        handled: e.defaultPrevented,
        modifier: e.metaKey || e.ctrlKey || e.altKey,
        onBlock: false,
      });
      if (action === 'close') {
        e.preventDefault();
        closeRef.current();
      }
    };
    panel.addEventListener('keydown', onKey);
    return () => panel.removeEventListener('keydown', onKey);
  }, [editing]);

  useEffect(() => {
    if (editing) {
      const first = panelRef.current?.querySelector<HTMLElement>(
        '.reading-edit-body input:not([type=hidden]), .reading-edit-body textarea, .reading-edit-body [role=combobox]',
      );
      first?.focus();
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      editRef.current?.focus();
    }
  }, [editing]);

  if (editing) {
    return (
      <div ref={panelRef} aria-label={`Editando: ${label}`} className="reading-edit" role="group">
        <div className="reading-edit-bar">
          <span className="reading-edit-title">{label}</span>
          {editExtra}
          <button className="text-btn" type="button" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Esconder campos vazios' : 'Mostrar campos vazios'}
          </button>
          <button className="primary" type="button" onClick={close}>
            Concluir
          </button>
        </div>
        <div className="reading-edit-body">{edit(showAll)}</div>
      </div>
    );
  }

  // E no botão "Editar" (o ponto de foco do bloco) também abre; Enter e espaço
  // já valem por ser botão.
  const onEditKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'g' || e.key === 'G') goPressedAt = Date.now();
    const action = readingKeyAction(e.key, {
      afterGo: Date.now() - goPressedAt < GO_WINDOW_MS && e.key.toLowerCase() === 'e',
      editing: false,
      handled: e.defaultPrevented,
      modifier: e.metaKey || e.ctrlKey || e.altKey,
      onBlock: true,
    });
    if (action === 'edit' && e.key !== 'Enter') {
      e.preventDefault();
      open();
    }
  };

  return (
    // O clique no texto é um atalho para quem usa mouse ou toque; pelo teclado,
    // o mesmo caminho é o botão "Editar", que é o ponto de foco do bloco.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className={`reading-block${className ? ` ${className}` : ''}`}
      onClick={(e) => {
        const onControl = (e.target as Element).closest('a, button') !== null;
        if (clickOpensEditor(window.getSelection()?.toString() ?? '', onControl)) open();
      }}
    >
      {children}
      <span className="reading-actions">
        {addLabel && (
          <button className="reading-add" type="button" onClick={() => open(true)}>
            {addLabel}
          </button>
        )}
        <button
          ref={editRef}
          aria-keyshortcuts="E"
          aria-label={`Editar ${label}`}
          className="reading-edit-btn"
          type="button"
          onClick={() => open()}
          onKeyDown={onEditKey}
        >
          <PencilIcon /> Editar
        </button>
      </span>
    </div>
  );
}
