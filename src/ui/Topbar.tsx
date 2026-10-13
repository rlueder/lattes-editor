// Cabeçalho, na ordem do ciclo de uso: à esquerda o estado da cópia de
// trabalho; à direita encontrar, editar, levar ao Lattes e, no menu
// de configurações, o que se usa menos.

import { type Ref, useRef, useState } from 'react';

import { isDesktop, pickFileNative } from '../desktop/native.ts';
import { CloseConfirm } from './dialogs.tsx';
import { AlertIcon, PlusIcon, SearchIcon, UploadIcon } from './icons.tsx';
import { Tip } from './primitives/Tip.tsx';
import { SettingsMenu } from './SettingsMenu.tsx';
import type { StripState } from './status-strip.ts';
import { StatusStrip, type StripOpenKind } from './StatusStrip.tsx';
import type { ThemePref } from './theme.ts';

export type SaveState = 'salvo' | 'salvando' | 'erro';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

interface Props {
  modified: boolean;
  /** Itens novos mais alterações ainda não feitas no Lattes. */
  pendingCount: number;
  ref: Ref<HTMLElement>;
  saveState: SaveState;
  showEmpty: boolean;
  /** Faixa de estados: original, alterações, no Lattes, publicado. */
  strip: StripState;
  theme: ThemePref;
  onClose: () => void;
  onExport: () => void;
  onHistory: () => void;
  onNewItem: () => void;
  onPalette: () => void;
  onPrint: () => void;
  onReload: (file: File) => void;
  onSave: () => void;
  onShowEmpty: (show: boolean) => void;
  onStripOpen: (kind: StripOpenKind) => void;
  onTheme: (theme: ThemePref) => void;
}

const SAVE_TIP: Record<SaveState, string> = {
  erro: 'Erro ao salvar no navegador',
  salvando: 'Salvando no navegador',
  salvo: 'Salvo no navegador',
};

const SAVE_LABEL: Record<SaveState, string> = {
  erro: 'erro ao salvar',
  salvando: 'salvando',
  salvo: 'salvo',
};

export function Topbar({
  modified,
  onClose,
  onExport,
  onHistory,
  onNewItem,
  onPalette,
  onPrint,
  onReload,
  onSave,
  onShowEmpty,
  onStripOpen,
  onTheme,
  pendingCount,
  ref,
  saveState,
  showEmpty,
  strip,
  theme,
}: Props) {
  const reloadInput = useRef<HTMLInputElement>(null);
  const [closing, setClosing] = useState(false);
  return (
    <header ref={ref} data-tauri-drag-region className="topbar">
      {/* A marca e quem é o currículo ficam no menu lateral; aqui, a faixa de
          estados (e, no app de macOS, os botões da janela). */}
      <div data-tauri-drag-region className="topbar-identity">
        <StatusStrip state={strip} onOpen={onStripOpen} />
      </div>

      {/* Encontrar: centralizado na página. */}
      <div data-tauri-drag-region className="topbar-center">
        <button className="ghost search-btn" type="button" onClick={onPalette}>
          <SearchIcon />
          <span>Ir para</span>
          <kbd>{IS_MAC ? '⌘' : 'Ctrl'}</kbd>
          <kbd>K</kbd>
        </button>
      </div>

      <div data-tauri-drag-region className="topbar-actions">
        {/* O histórico fica no menu de configurações; aqui só aparece o aviso
            quando a cópia no navegador não salvou. */}
        {saveState === 'erro' && (
          <Tip label={`${SAVE_TIP.erro}. Histórico de alterações`}>
            <button
              aria-label={`${SAVE_LABEL.erro}. Abrir histórico de alterações`}
              className="ghost icon-btn save-state erro"
              type="button"
              onClick={onHistory}
            >
              <AlertIcon />
            </button>
          </Tip>
        )}

        {/* Criar e levar ao Lattes: só ícones, com dica, junto das configurações. */}
        <Tip label="Novo item">
          <button
            aria-label="Novo item"
            className="ghost icon-btn"
            type="button"
            onClick={onNewItem}
          >
            <PlusIcon />
          </button>
        </Tip>

        {/* Levar ao Lattes: só o ícone; o selo no canto conta o que falta levar. */}
        <Tip
          label={
            pendingCount > 0 ? `Levar ao Lattes (${pendingCount} pendências)` : 'Levar ao Lattes'
          }
        >
          <button
            aria-label={
              pendingCount > 0 ? `Levar ao Lattes, ${pendingCount} pendências` : 'Levar ao Lattes'
            }
            className="ghost icon-btn has-badge"
            type="button"
            onClick={onExport}
          >
            <UploadIcon />
            {pendingCount > 0 && (
              <span aria-hidden="true" className="icon-badge">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </button>
        </Tip>

        {/* Exibição e arquivo: o que se usa menos fica no menu. */}
        <SettingsMenu
          file={{
            modified,
            onClose: () => setClosing(true),
            onHistory,
            onPrint,
            onReload: () => {
              if (isDesktop()) void pickFileNative().then((file) => file && onReload(file));
              else reloadInput.current?.click();
            },
            onSave,
            onShowEmpty,
            showEmpty,
          }}
          theme={theme}
          onTheme={onTheme}
        />
        <CloseConfirm
          open={closing}
          pending={pendingCount}
          onCancel={() => setClosing(false)}
          onConfirm={() => {
            setClosing(false);
            onClose();
          }}
          onSave={onSave}
        />
        <input
          ref={reloadInput}
          hidden
          accept=".zip,.xml,application/zip,application/xml,text/xml"
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onReload(file);
            e.target.value = '';
          }}
        />
      </div>
    </header>
  );
}
