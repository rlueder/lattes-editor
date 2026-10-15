// Bloco do modo de leitura (protótipo, ?leitura). Lido, é texto composto. Em
// edição, o mesmo texto fica no topo como prévia, na tipografia de leitura,
// e acompanha o que se digita; abaixo vêm os campos do formulário, na sans,
// na ordem do formulário do Lattes quando ela é conhecida (form-order.ts).

import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { XElement } from '../model/xml.ts';
import { DraftContext, PartKeyContext, TargetPartContext } from './draft-context.ts';
import { type OpenEditor, openOnly, registerOpen, unregister } from './edit-session.ts';
import { PencilIcon } from './icons.tsx';
import { FocusPartContext, NestedScopeContext } from './nested-collapse.ts';
import { clickOpensEditor, readingKeyAction } from './reading.ts';
import { partKeys } from './reading-layout.ts';
import { addDraft, type Drafts, withDrafts } from './reading-preview.ts';

/** Tecla G recente: o E seguinte é o atalho de seção (G E, Educação), não "editar". */
const GO_WINDOW_MS = 1500;
let goPressedAt = 0;

/** Espera de um clique antes de abrir a edição, para o segundo clique de um duplo clique chegar. */
const CLICK_DELAY_MS = 250;

interface BlockProps {
  /** Ação discreta que também abre a edição ("Adicionar resumo em inglês"). */
  addLabel?: string;
  className?: string;
  /** Ação extra ao lado de "Concluir" (Editar no formulário). */
  editExtra?: ReactNode;
  /** Os campos do formulário, com todos os campos, inclusive os vazios. */
  form: () => ReactNode;
  /** Nome do bloco, para o botão e para leitores de tela. */
  label: string;
  /** O texto lido de um elemento; na edição, do elemento com os rascunhos. */
  read: (el: XElement, editing: boolean) => ReactNode;
  /** O elemento que o bloco mostra e edita. */
  root: XElement;
}

/**
 * Um bloco que se lê como texto e se edita com o formulário logo abaixo da
 * prévia. O ponto de foco (Tab) é o botão "Editar", à vista no foco, no
 * passar do mouse e sempre em telas de toque; com ele focado, E também abre.
 * O clique no texto abre a edição, menos quando a pessoa está selecionando
 * texto (arrastando, ou com dois ou três cliques). Ao abrir, a prévia fica
 * exatamente onde estava o texto clicado. Esc ou "Concluir" voltam à leitura
 * e devolvem o foco ao botão.
 *
 * Em edição, a prévia (com "Concluir") gruda no alto da tela enquanto os
 * campos rolam por baixo, e o trecho do campo em foco acende nela.
 */
export function EditableBlock({
  addLabel,
  className,
  editExtra,
  form,
  label,
  read,
  root,
}: BlockProps) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Drafts>(new Map());
  const blockRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const clickTimer = useRef(0);
  /** O campo em foco, pela chave do pedaço dele na prévia. */
  const [focusPart, setFocusPart] = useState<string | null>(null);
  /** O trecho da prévia clicado para abrir: o campo dele recebe o foco. */
  const [targetPart, setTargetPart] = useState<string | null>(null);
  const keyOf = useMemo(() => partKeys(root), [root]);
  /** Altura do bloco na tela antes da troca, para mantê-lo no mesmo lugar. */
  const anchor = useRef<number | null>(null);

  useEffect(() => () => clearTimeout(clickTimer.current), []);

  const onDraft = useCallback(
    (el: XElement, attr: string, value: string) => setDrafts((d) => addDraft(d, el, attr, value)),
    [],
  );

  const doOpen = (target: string | null = null) => {
    clearTimeout(clickTimer.current);
    setTargetPart(target);
    anchor.current = blockRef.current?.getBoundingClientRect().top ?? null;
    setDrafts(new Map());
    setEditing(true);
    registerOpen(handle.current);
  };
  /** Abrir: um bloco de cada vez; o que estava aberto fecha antes (edit-session.ts). */
  const open = (target: string | null = null) => {
    clearTimeout(clickTimer.current);
    openOnly(() => doOpen(target), handle.current);
  };
  /**
   * Fechar. `own` é falso quando outro bloco abre: aí este não devolve o foco
   * ao botão dele nem segura a altura da tela; quem manda é o que abre.
   */
  const close = (own = true) => {
    // Os campos gravam ao perder o foco: tirar o foco antes de fechar grava o
    // que estava sendo digitado.
    const active = document.activeElement;
    if (active instanceof HTMLElement && blockRef.current?.contains(active)) active.blur();
    anchor.current = own ? (blockRef.current?.getBoundingClientRect().top ?? null) : null;
    restoreFocus.current = own;
    setFocusPart(null);
    setEditing(false);
    unregister(handle.current);
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  // O bloco visto de fora: fechar, quando outro bloco abre.
  const handle = useRef<OpenEditor>({ close: () => closeRef.current(false) });
  // Bloco que some aberto (troca de seção) deixa de ser o aberto.
  useEffect(() => () => unregister(handle.current), []);

  // Esc no bloco volta à leitura. O ouvinte fica no documento, na fase de
  // subida: roda depois dos manipuladores do React (presos na raiz), então um
  // campo que já usou o Esc (fechando a própria lista) deixa defaultPrevented.
  // Teclas de um menu em portal, fora do bloco, e de um controle ainda aberto
  // (aria-expanded) também não fecham a edição.
  useEffect(() => {
    const block = blockRef.current;
    if (!editing || !block) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const inside = target !== null && block.contains(target);
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

  // Depois da troca: o bloco volta à altura em que estava (a prévia fica onde
  // estava o texto) e o foco vai ao primeiro campo, ou de volta ao botão.
  useLayoutEffect(() => {
    const block = blockRef.current;
    const before = anchor.current;
    anchor.current = null;
    if (!block || before === null) return;
    window.scrollBy(0, block.getBoundingClientRect().top - before);
    if (editing) {
      // O campo do trecho clicado, quando há; senão o primeiro.
      const fields = 'input:not([type=hidden]), textarea, [role=combobox], button[role=switch]';
      const target = targetPart
        ? block.querySelector(`.reading-form [data-part="${CSS.escape(targetPart)}"]`)
        : null;
      (
        target?.querySelector<HTMLElement>(fields) ??
        block.querySelector<HTMLElement>(
          '.reading-form input:not([type=hidden]), .reading-form textarea, .reading-form [role=combobox]',
        )
      )?.focus({ preventScroll: true });
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      editRef.current?.focus({ preventScroll: true });
    }
    // O alvo muda junto com a abertura (doOpen); sozinho, sem a âncora, sai cedo.
  }, [editing, targetPart]);

  // O trecho do campo em foco acende na prévia. A prévia se refaz a cada
  // tecla, então a marca é reaplicada depois de toda renderização.
  useEffect(() => {
    const content = blockRef.current?.querySelector('.reading-content');
    if (!content) return;
    let lit: HTMLElement | null = null;
    for (const node of content.querySelectorAll<HTMLElement>('[data-part]')) {
      const on = node.getAttribute('data-part') === focusPart;
      node.classList.toggle('is-focus-part', on);
      if (on) lit ??= node;
    }
    // Na prévia longa, que rola dentro de si, o trecho aceso vem para a vista.
    if (lit && content.scrollHeight > content.clientHeight) {
      const box = content.getBoundingClientRect();
      const at = lit.getBoundingClientRect();
      if (at.top < box.top || at.bottom > box.bottom) {
        content.scrollTop += at.top - box.top - 8;
      }
    }
  });

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

  const classes = ['reading-block', className, editing ? 'is-editing' : '']
    .filter(Boolean)
    .join(' ');

  return (
    // O clique no texto é um atalho para quem usa mouse ou toque; pelo teclado,
    // o mesmo caminho é o botão "Editar", que é o ponto de foco do bloco.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      ref={blockRef}
      aria-label={editing ? `Editando: ${label}` : undefined}
      className={classes}
      role={editing ? 'group' : undefined}
      onClick={(e) => {
        if (editing) return;
        // Espera o intervalo de um duplo clique: dois ou três cliques selecionam
        // palavra ou parágrafo e não abrem a edição.
        clearTimeout(clickTimer.current);
        const onControl = (e.target as Element).closest('a, button') !== null;
        if (!clickOpensEditor(window.getSelection()?.toString() ?? '', onControl, e.detail)) return;
        const part = (e.target as Element).closest('[data-part]')?.getAttribute('data-part');
        clickTimer.current = window.setTimeout(() => {
          if (clickOpensEditor(window.getSelection()?.toString() ?? '', false, 1)) open(part);
        }, CLICK_DELAY_MS);
      }}
    >
      <div className="reading-head">
        <div className="reading-content">
          {/* As listas fechadas lembram o estado pelo item (o mesmo na leitura
              e na prévia da edição) e abrem para o campo em foco. */}
          <NestedScopeContext.Provider value={root}>
            <FocusPartContext.Provider value={editing ? focusPart : null}>
              {read(editing ? withDrafts(root, drafts) : root, editing)}
            </FocusPartContext.Provider>
          </NestedScopeContext.Provider>
        </div>
        <span className="reading-actions">
          {editing ? (
            <>
              {editExtra}
              <button className="primary reading-done" type="button" onClick={() => close()}>
                Concluir
              </button>
            </>
          ) : (
            <>
              {addLabel && (
                <button className="ghost reading-add" type="button" onClick={() => open()}>
                  {addLabel}
                </button>
              )}
              <button
                ref={editRef}
                aria-keyshortcuts="E"
                aria-label={`Editar ${label}`}
                className="ghost reading-edit-btn"
                type="button"
                onClick={() => open()}
                onKeyDown={onEditKey}
              >
                <PencilIcon /> Editar
              </button>
            </>
          )}
        </span>
      </div>
      {editing && (
        <DraftContext.Provider value={onDraft}>
          <PartKeyContext.Provider value={keyOf}>
            <TargetPartContext.Provider value={targetPart}>
              <div
                className="reading-form"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setFocusPart(null);
                }}
                onFocus={(e) => {
                  setFocusPart(e.target.closest('[data-part]')?.getAttribute('data-part') ?? null);
                }}
              >
                {form()}
              </div>
            </TargetPartContext.Provider>
          </PartKeyContext.Provider>
        </DraftContext.Provider>
      )}
    </div>
  );
}
