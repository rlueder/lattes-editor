// Cabeçalho, na ordem do ciclo de uso: à esquerda o estado da cópia de
// trabalho; à direita encontrar, editar, levar ao Lattes e, no menu
// de configurações, o que se usa menos.

import { type Ref, useRef, useState } from 'react';

import { CloseConfirm } from './dialogs.tsx';
import { AlertIcon, HistoryIcon, PlusIcon, SearchIcon, SpinnerIcon, UploadIcon } from './icons.tsx';
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
  onPrint: () => void;
  onReload: (file: File) => void;
  onSave: () => void;
  onShowEmpty: (show: boolean) => void;
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
  onTheme,
  pendingCount,
  ref,
  saveState,
  showEmpty,
  theme,
}: Props) {
  const reloadInput = useRef<HTMLInputElement>(null);
  const [closing, setClosing] = useState(false);
  return (
    <header ref={ref} className="topbar">
      {/* Marca; quem é o currículo fica no menu lateral. */}
      <div className="topbar-identity">
        {/* Marca provisória, até existir um logo. */}
        <span aria-label="LattesEditor" className="brand">
          Lattes<span className="brand-accent">Editor</span>
        </span>
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
        {/* Editar, levar ao Lattes e o estado da cópia: só ícones, com dica. */}
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

        {/* Levar ao Lattes: vira o botão principal quando há algo pendente. */}
        <Tip
          label={
            pendingCount > 0 ? `Levar ao Lattes (${pendingCount} pendências)` : 'Levar ao Lattes'
          }
        >
          <button
            aria-label={
              pendingCount > 0 ? `Levar ao Lattes, ${pendingCount} pendências` : 'Levar ao Lattes'
            }
            className={`icon-btn ${pendingCount > 0 ? 'primary' : 'ghost'}`}
            type="button"
            onClick={onExport}
          >
            <UploadIcon />
            {pendingCount > 0 && (
              <span aria-hidden="true" className="tag count-tag">
                {pendingCount}
              </span>
            )}
          </button>
        </Tip>

        <Tip label={`${SAVE_TIP[saveState]}. Histórico de alterações`}>
          <button
            aria-label={`${SAVE_LABEL[saveState]}. Abrir histórico de alterações`}
            className={`ghost icon-btn save-state ${saveState}`}
            type="button"
            onClick={onHistory}
          >
            {saveState === 'salvando' ? (
              <SpinnerIcon />
            ) : saveState === 'erro' ? (
              <AlertIcon />
            ) : (
              <HistoryIcon />
            )}
          </button>
        </Tip>

        <span aria-hidden="true" className="topbar-divider" />

        {/* Exibição e arquivo: o que se usa menos fica no menu. */}
        <SettingsMenu
          modified={modified}
          showEmpty={showEmpty}
          theme={theme}
          onClose={() => setClosing(true)}
          onHistory={onHistory}
          onPrint={onPrint}
          onReload={() => reloadInput.current?.click()}
          onSave={onSave}
          onShowEmpty={onShowEmpty}
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
