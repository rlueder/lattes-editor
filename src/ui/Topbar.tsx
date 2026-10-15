// Cabeçalho, na ordem do ciclo de uso: à esquerda o símbolo e o nome do app;
// à direita encontrar, editar, enviar ao Lattes e, no menu de configurações,
// o que se usa menos. O estado do currículo (no Lattes, publicado) fica no
// "Enviar ao Lattes"; a contagem de alterações, no selo do botão de enviar e
// no aviso de pendências.

import { type Ref, useRef, useState } from 'react';

import { isDesktop, pickFileNative } from '../desktop/native.ts';
import { Brand } from './Brand.tsx';
import { CloseConfirm } from './dialogs.tsx';
import { AlertIcon, PlusIcon, SearchIcon, UploadIcon } from './icons.tsx';
import type { Notice } from './notifications.ts';
import { NotificationsMenu } from './NotificationsMenu.tsx';
import { Tip } from './primitives/Tip.tsx';
import { SettingsMenu } from './SettingsMenu.tsx';
import type { ThemePref } from './theme.ts';

export type SaveState = 'salvo' | 'salvando' | 'erro';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

interface Props {
  /** Modo foco (com ?leitura): estado, atalho e troca, para o ⚙. */
  focus?: { label: string; on: boolean; toggle: () => void };
  modified: boolean;
  /** Notificações do sino: ligação com o Lattes e armazenamento. */
  notices: Notice[];
  /** Itens novos mais alterações ainda não feitas no Lattes. */
  pendingCount: number;
  ref: Ref<HTMLElement>;
  saveState: SaveState;
  theme: ThemePref;
  onClose: () => void;
  /** O sino avisa de alterações no Lattes que não passaram por aqui: abre o diagnóstico. */
  onDiagnosis: () => void;
  onExport: () => void;
  onHistory: () => void;
  /** Um XML de outro programa (ou exportação antiga), para trazer produções dele (LAT-45). */
  onIncoming: (file: File) => void;
  onNewItem: () => void;
  onPalette: () => void;
  onPrint: () => void;
  onReload: (file: File) => void;
  onSave: () => void;
  onTheme: (theme: ThemePref) => void;
  /** ⚙ › Versões do Lattes: o que mudou entre as exportações. */
  onVersions: () => void;
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
  focus,
  modified,
  notices,
  onClose,
  onDiagnosis,
  onExport,
  onHistory,
  onIncoming,
  onNewItem,
  onPalette,
  onPrint,
  onReload,
  onSave,
  onTheme,
  onVersions,
  pendingCount,
  ref,
  saveState,
  theme,
}: Props) {
  const reloadInput = useRef<HTMLInputElement>(null);
  const incomingInput = useRef<HTMLInputElement>(null);
  const [closing, setClosing] = useState(false);
  return (
    <header ref={ref} data-tauri-drag-region className="topbar">
      {/* O símbolo e o nome do app (no app de macOS, depois dos botões da janela). */}
      <div data-tauri-drag-region className="topbar-identity">
        <Brand />
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

        {/* Criar e enviar ao Lattes: só ícones, com dica, junto das configurações. */}
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

        {/* Enviar ao Lattes: só o ícone; o selo no canto conta o que falta levar. */}
        <Tip
          label={
            pendingCount > 0 ? `Enviar ao Lattes (${pendingCount} pendências)` : 'Enviar ao Lattes'
          }
        >
          <button
            aria-label={
              pendingCount > 0 ? `Enviar ao Lattes, ${pendingCount} pendências` : 'Enviar ao Lattes'
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

        <NotificationsMenu notices={notices} onDiagnosis={onDiagnosis} />

        {/* Exibição e arquivo: o que se usa menos fica no menu. */}
        <SettingsMenu
          file={{
            modified,
            onClose: () => setClosing(true),
            onDiagnosis,
            onHistory,
            onIncoming: () => {
              if (isDesktop()) void pickFileNative().then((file) => file && onIncoming(file));
              else incomingInput.current?.click();
            },
            onPrint,
            onReload: () => {
              if (isDesktop()) void pickFileNative().then((file) => file && onReload(file));
              else reloadInput.current?.click();
            },
            onSave,
            onVersions,
          }}
          focus={focus}
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
          ref={incomingInput}
          hidden
          accept=".zip,.xml,application/zip,application/xml,text/xml"
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onIncoming(file);
            e.target.value = '';
          }}
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
