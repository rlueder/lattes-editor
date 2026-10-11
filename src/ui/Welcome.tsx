// Tela inicial: o próprio editor, sem currículo. Cabeçalho e menu lateral
// aparecem desabilitados, para quem chega já ver onde vai trabalhar; o painel
// principal é o passo de abrir o arquivo. Soltar o arquivo vale na janela toda.

import { type DragEvent, useRef, useState } from 'react';

import { isDesktop, pickFileNative } from '../desktop/native.ts';
import { parseXml } from '../model/xml.ts';
import { HistoryIcon, PlusIcon, SearchIcon, UploadIcon } from './icons.tsx';
import { buildSections } from './sections.ts';
import { SettingsMenu } from './SettingsMenu.tsx';
import { Sidebar } from './Sidebar.tsx';
import type { ThemePref } from './theme.ts';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** As seções de um currículo vazio: os nomes do menu, sem contagens. */
const EMPTY_SECTIONS = buildSections(parseXml('<CURRICULO-VITAE/>').root);

const ACCEPT = '.zip,.xml,application/zip,application/xml,text/xml';

/** Arquivo subindo para uma bandeja, em traço, como os outros estados vazios. */
function OpenArt() {
  return (
    <svg
      aria-hidden="true"
      className="empty-art"
      fill="none"
      height="96"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.25"
      viewBox="0 0 96 96"
      width="96"
    >
      <path d="M18 60v16h60V60" />
      <path d="M18 60h16l4 6h20l4-6h16" />
      <path d="M36 16h18l8 8v30H36V16Z" />
      <path d="M54 16v8h8" />
      <path d="M49 46V30M43 36l6-6 6 6" />
    </svg>
  );
}

interface Props {
  error?: string | null;
  theme: ThemePref;
  onFile: (file: File) => void;
  onTheme: (theme: ThemePref) => void;
}

export function Welcome({ error, onFile, onTheme, theme }: Props) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const pick = () => {
    // No app de desktop, o diálogo nativo; no navegador, o input de arquivo.
    if (isDesktop()) void pickFileNative().then((file) => file && onFile(file));
    else input.current?.click();
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      className={over ? 'shell welcome-shell over' : 'shell welcome-shell'}
      onDragLeave={(e) => {
        // Só sai quando o cursor deixa a janela, não ao passar de um filho a outro.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDrop={onDrop}
    >
      <header data-tauri-drag-region className="topbar">
        <div data-tauri-drag-region className="topbar-identity">
          <span aria-label="LattesEditor" className="brand">
            Lattes<span className="brand-accent">Editor</span>
          </span>
        </div>
        <div data-tauri-drag-region className="topbar-center">
          <button disabled className="ghost search-btn" type="button">
            <SearchIcon />
            <span>Ir para</span>
            <kbd>{IS_MAC ? '⌘' : 'Ctrl'}</kbd>
            <kbd>K</kbd>
          </button>
        </div>
        <div data-tauri-drag-region className="topbar-actions">
          <span aria-hidden="true" className="topbar-divider" />
          <button disabled aria-label="Novo item" className="ghost icon-btn" type="button">
            <PlusIcon />
          </button>
          <button disabled aria-label="Levar ao Lattes" className="ghost icon-btn" type="button">
            <UploadIcon />
          </button>
          <button
            disabled
            aria-label="Histórico de alterações"
            className="ghost icon-btn"
            type="button"
          >
            <HistoryIcon />
          </button>
          <span aria-hidden="true" className="topbar-divider" />
          <SettingsMenu theme={theme} onTheme={onTheme} />
        </div>
      </header>

      <Sidebar disabled pendingIn={() => 0} sections={EMPTY_SECTIONS} onSelect={() => {}} />

      <main className="content">
        <div className="section-main section-main-empty">
          <div className="empty-section welcome-step">
            <OpenArt />
            <h1 className="empty-title">Abra seu currículo</h1>
            <p className="empty-text">
              No Lattes, exporte o currículo em Ferramentas › Exportar e solte aqui o arquivo{' '}
              <code>CV_&lt;id&gt;.zip</code> ou o <code>.xml</code>.
            </p>
            <div className="empty-actions">
              <button className="primary" type="button" onClick={pick}>
                Escolher arquivo
              </button>
            </div>
            {error && <p className="error">{error}</p>}
            <p className="empty-caption">O arquivo não sai do seu computador.</p>
          </div>
        </div>
        <input
          ref={input}
          hidden
          accept={ACCEPT}
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';
          }}
        />
      </main>
    </div>
  );
}
