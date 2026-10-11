import { type Ref, useRef } from 'react';

export type SaveState = 'salvo' | 'salvando' | 'erro';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

interface Props {
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

export function Topbar({
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
  return (
    <header ref={ref} className="topbar">
      <div className="topbar-title">
        <strong>{ownerName}</strong>
        <span className="file-name">{fileName}</span>
        <span className={`save-state ${saveState}`} role="status">
          {saveState === 'salvando'
            ? 'salvando…'
            : saveState === 'erro'
              ? 'erro ao salvar no navegador'
              : 'salvo'}
        </span>
      </div>
      <div className="topbar-actions">
        <button className="ghost kbd-hint" type="button" onClick={onPalette}>
          Ir para… <kbd>{IS_MAC ? '⌘' : 'Ctrl'}</kbd>
          <kbd>K</kbd>
        </button>
        <button className="ghost" type="button" onClick={onNewItem}>
          + Novo item
        </button>
        <button className="ghost" type="button" onClick={onExport}>
          Importação
          {pendingCount > 0 && <span className="tag new">{pendingCount}</span>}
        </button>
        <label className="toggle">
          <input
            checked={showEmpty}
            type="checkbox"
            onChange={(e) => onShowEmpty(e.target.checked)}
          />
          campos vazios
        </label>
        <button className="ghost" type="button" onClick={onHistory}>
          Histórico
        </button>
        <button className="ghost" type="button" onClick={() => reloadInput.current?.click()}>
          Recarregar do Lattes
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
        <button className="ghost" type="button" onClick={onClose}>
          Fechar
        </button>
        <button className="primary" type="button" onClick={onSave}>
          Salvar arquivo{modified ? ' •' : ''}
        </button>
      </div>
    </header>
  );
}
