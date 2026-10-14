// Bloco do modo de leitura (protótipo, ?leitura): o texto composto e, quando a
// pessoa pede, o formulário de hoje no mesmo lugar.

import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';

import { PencilIcon } from './icons.tsx';
import { clickOpensEditor, readingKeyAction } from './reading.ts';

/** Tecla G recente: o E seguinte é o atalho de seção (G E, Educação), não "editar". */
const GO_WINDOW_MS = 1500;
let goPressedAt = 0;

/** Espera de um clique antes de abrir a edição, para o segundo clique de um duplo clique chegar. */
const CLICK_DELAY_MS = 250;

interface BlockProps {
  /** Ação discreta que também abre a edição ("Adicionar resumo em inglês"). */
  addLabel?: string;
  /** Conteúdo de leitura. */
  children: ReactNode;
  className?: string;
  /** O formulário de hoje, com todos os campos, inclusive os vazios. */
  edit: () => ReactNode;
  /** Ação extra no topo do painel de edição (Editar no formulário). */
  editExtra?: ReactNode;
  /** Nome do bloco, para o botão e para leitores de tela. */
  label: string;
}

/**
 * Um bloco que se lê como texto e se edita no lugar. O ponto de foco (Tab) é
 * o botão "Editar", à vista no foco, no passar do mouse e sempre em telas de
 * toque; com ele focado, E também abre. O clique no texto abre a edição para
 * quem usa mouse ou toque, menos quando a pessoa está selecionando texto
 * (arrastando, ou com dois ou três cliques). Esc ou "Concluir" voltam à
 * leitura e devolvem o foco ao botão. A leitura esconde os campos vazios; a
 * edição mostra todos, para preencher o que falta.
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
  const editRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const clickTimer = useRef(0);

  useEffect(() => () => clearTimeout(clickTimer.current), []);

  const open = () => {
    clearTimeout(clickTimer.current);
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

  // Esc no painel volta à leitura. O ouvinte fica no documento, na fase de
  // subida: roda depois dos manipuladores do React (presos na raiz), então um
  // campo que já usou o Esc (fechando a própria lista) deixa defaultPrevented.
  // Teclas de um menu em portal, fora do painel, e de um controle ainda
  // aberto (aria-expanded) também não fecham a edição.
  useEffect(() => {
    const panel = panelRef.current;
    if (!editing || !panel) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const inside = target !== null && panel.contains(target);
      const expanded = target?.closest('[aria-expanded="true"]') !== null;
      const action = readingKeyAction(e.key, {
        afterGo: false,
        editing: true,
        handled: e.defaultPrevented || !inside || expanded,
        modifier: e.metaKey || e.ctrlKey || e.altKey,
        onBlock: false,
      });
      if (action === 'close') {
        e.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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
          <button className="primary" type="button" onClick={close}>
            Concluir
          </button>
        </div>
        <div className="reading-edit-body">{edit()}</div>
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
        // Espera o intervalo de um duplo clique: dois ou três cliques selecionam
        // palavra ou parágrafo e não abrem a edição.
        clearTimeout(clickTimer.current);
        const onControl = (e.target as Element).closest('a, button') !== null;
        if (!clickOpensEditor(window.getSelection()?.toString() ?? '', onControl, e.detail)) return;
        clickTimer.current = window.setTimeout(() => {
          if (clickOpensEditor(window.getSelection()?.toString() ?? '', false, 1)) open();
        }, CLICK_DELAY_MS);
      }}
    >
      {children}
      <span className="reading-actions">
        {addLabel && (
          <button className="reading-add" type="button" onClick={open}>
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
