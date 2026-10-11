// Cabeçalho: quem é o currículo à esquerda; à direita, ações em grupos
// separados por divisórias (navegar, produção, exibição, arquivo).

import { type Ref, useRef } from 'react';

import { formatLattesDate } from './format.ts';
import {
  AlertIcon,
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  HistoryIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  SpinnerIcon,
  UploadIcon,
} from './icons.tsx';

export type SaveState = 'salvo' | 'salvando' | 'erro';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

interface Props {
  /** DATA-ATUALIZACAO da exportação (DDMMAAAA), quando houver. */
  exportedOn?: string;
  fileName: string;
  modified: boolean;
  ownerName: string;
  pendingCount: number;
  ref: Ref<HTMLElement>;
  saveState: SaveState;
  showEmpty: boolean;
  onClose: () => void;
  onExport: () => void;
  onHistory: () => void;
  onNewItem: () => void;
  onPalette: () => void;
  onReload: (file: File) => void;
  onSave: () => void;
  onShowEmpty: (show: boolean) => void;
}

const SAVE_LABEL: Record<SaveState, string> = {
  erro: 'erro ao salvar no navegador',
  salvando: 'salvando',
  salvo: 'salvo no navegador',
};

export function Topbar({
  exportedOn,
  fileName,
  modified,
  onClose,
  onExport,
  onHistory,
  onNewItem,
  onPalette,
  onReload,
  onSave,
  onShowEmpty,
  ownerName,
  pendingCount,
  ref,
  saveState,
  showEmpty,
}: Props) {
  const reloadInput = useRef<HTMLInputElement>(null);
  const date = formatLattesDate(exportedOn);
  return (
    <header ref={ref} className="topbar">
      <div className="topbar-title" title={`Arquivo: ${fileName}`}>
        <strong>{ownerName}</strong>
        <span className="topbar-sub">Currículo Lattes{date ? ` · exportado em ${date}` : ''}</span>
      </div>

      <div className="topbar-actions">
        <button className="ghost search-btn" type="button" onClick={onPalette}>
          <SearchIcon />
          <span>Ir para</span>
          <kbd>{IS_MAC ? '⌘' : 'Ctrl'}</kbd>
          <kbd>K</kbd>
        </button>

        <span aria-hidden="true" className="topbar-divider" />

        <button className="ghost" type="button" onClick={onNewItem}>
          <PlusIcon />
          <span>Novo item</span>
        </button>
        <button className="ghost" type="button" onClick={onExport}>
          <UploadIcon />
          <span>Importação</span>
          {pendingCount > 0 && (
            <span aria-label={`${pendingCount} itens novos`} className="tag new">
              {pendingCount}
            </span>
          )}
        </button>

        <span aria-hidden="true" className="topbar-divider" />

        <button
          aria-label={showEmpty ? 'Esconder campos vazios' : 'Mostrar campos vazios'}
          aria-pressed={showEmpty}
          className="ghost icon-btn"
          data-tip={showEmpty ? 'Esconder campos vazios' : 'Mostrar campos vazios'}
          type="button"
          onClick={() => onShowEmpty(!showEmpty)}
        >
          {showEmpty ? <EyeIcon /> : <EyeOffIcon />}
        </button>

        <span aria-hidden="true" className="topbar-divider" />

        <span className={`save-state ${saveState}`} role="status">
          {saveState === 'salvando' ? (
            <SpinnerIcon />
          ) : saveState === 'erro' ? (
            <AlertIcon />
          ) : (
            <CheckIcon />
          )}
          <span>{SAVE_LABEL[saveState]}</span>
        </span>
        <button
          aria-label="Histórico de alterações"
          className="ghost icon-btn"
          data-tip="Histórico de alterações"
          type="button"
          onClick={onHistory}
        >
          <HistoryIcon />
        </button>
        <button
          aria-label="Recarregar do Lattes (nova exportação)"
          className="ghost icon-btn"
          data-tip="Recarregar do Lattes"
          type="button"
          onClick={() => reloadInput.current?.click()}
        >
          <RefreshIcon />
        </button>
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
        <button
          aria-label="Fechar o currículo"
          className="ghost icon-btn"
          data-tip="Fechar o currículo"
          type="button"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
        <button
          className="primary"
          title={`Baixa ${fileName} com as alterações`}
          type="button"
          onClick={onSave}
        >
          <DownloadIcon />
          <span>Salvar</span>
          {modified && <span aria-label="com alterações" className="dot" />}
        </button>
      </div>
    </header>
  );
}
