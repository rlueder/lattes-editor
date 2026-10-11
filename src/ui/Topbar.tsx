// Cabeçalho, na ordem do ciclo de uso: à esquerda o estado da cópia de
// trabalho; à direita encontrar, editar, levar ao Lattes e, no menu
// de configurações, o que se usa menos.

import { type Ref, useRef } from 'react';

import {
  AlertIcon,
  CheckIcon,
  HistoryIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  UploadIcon,
} from './icons.tsx';
import { Tip } from './primitives/Tip.tsx';
import { SettingsMenu } from './SettingsMenu.tsx';
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
  theme: ThemePref;
  onClose: () => void;
  onExport: () => void;
  onHistory: () => void;
  onNewItem: () => void;
  onPalette: () => void;
  onReload: (file: File) => void;
  onSave: () => void;
  onShowEmpty: (show: boolean) => void;
  onTheme: (theme: ThemePref) => void;
}

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
  onReload,
  onSave,
  onShowEmpty,
  onTheme,
  pendingCount,
  ref,
  saveState,
  showEmpty,
  theme,
}: Props) {
  const reloadInput = useRef<HTMLInputElement>(null);
  return (
    <header ref={ref} className="topbar">
      {/* Estado da cópia de trabalho (abre o histórico); quem é o currículo fica no menu lateral. */}
      <div className="topbar-identity">
        <Tip label="Histórico de alterações">
          <button
            aria-label={`${SAVE_LABEL[saveState]}. Abrir histórico de alterações`}
            className={`ghost save-state ${saveState}`}
            type="button"
            onClick={onHistory}
          >
            {saveState === 'salvando' ? (
              <SpinnerIcon />
            ) : saveState === 'erro' ? (
              <AlertIcon />
            ) : (
              <CheckIcon />
            )}
            <span>{SAVE_LABEL[saveState]}</span>
            <HistoryIcon />
          </button>
        </Tip>
        <span aria-hidden="true" className="topbar-divider" />
      </div>

      {/* Encontrar: centralizado na página */}
      <div className="topbar-center">
        <button className="ghost search-btn" type="button" onClick={onPalette}>
          <SearchIcon />
          <span>Ir para</span>
          <kbd>{IS_MAC ? '⌘' : 'Ctrl'}</kbd>
          <kbd>K</kbd>
        </button>
      </div>

      <div className="topbar-actions">
        <span aria-hidden="true" className="topbar-divider" />
        {/* Editar */}
        <button className="ghost" type="button" onClick={onNewItem}>
          <PlusIcon />
          <span>Novo item</span>
        </button>

        {/* Levar ao Lattes: vira o botão principal quando há algo pendente. */}
        <button className={pendingCount > 0 ? 'primary' : 'ghost'} type="button" onClick={onExport}>
          <UploadIcon />
          <span>Levar ao Lattes</span>
          {pendingCount > 0 && (
            <span aria-label={`${pendingCount} pendências`} className="tag count-tag">
              {pendingCount}
            </span>
          )}
        </button>

        <span aria-hidden="true" className="topbar-divider" />

        {/* Exibição e arquivo: o que se usa menos fica no menu. */}
        <SettingsMenu
          modified={modified}
          showEmpty={showEmpty}
          theme={theme}
          onClose={onClose}
          onHistory={onHistory}
          onReload={() => reloadInput.current?.click()}
          onSave={onSave}
          onShowEmpty={onShowEmpty}
          onTheme={onTheme}
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
