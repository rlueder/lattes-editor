// Tela inicial: o próprio editor, sem currículo. Cabeçalho e menu lateral
// aparecem desabilitados, para quem chega já ver onde vai trabalhar; o painel
// principal é o passo de abrir o arquivo. Soltar o arquivo vale na janela toda.

import { type DragEvent, useRef, useState } from 'react';

import type { Link } from '../bridge/link.ts';
import { isDesktop, pickFileNative } from '../desktop/native.ts';
import { onboardingPreview } from '../dev/onboarding-preview.ts';
import { parseXml } from '../model/xml.ts';
import { CheckIcon, PlusIcon, SearchIcon, SpinnerIcon, UploadIcon } from './icons.tsx';
import { onboardingSteps, type Step } from './onboarding.ts';
import { buildSections } from './sections.ts';
import { SettingsMenu } from './SettingsMenu.tsx';
import { Sidebar } from './Sidebar.tsx';
import type { ThemePref } from './theme.ts';
import type { LattesOpen } from './use-lattes-open.ts';

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
  /** Abrir do Lattes pela extensão (use-lattes-open.ts). */
  lattes: LattesOpen;
  /** A ligação com a extensão, que marca os passos do primeiro uso. */
  link: Link;
  theme: ThemePref;
  onFile: (file: File) => void;
  onTheme: (theme: ThemePref) => void;
}

/** O botão do passo: um link para fora (abre no navegador) ou pedir o currículo de novo. */
function StepAction({
  action,
  onRetry,
}: {
  action: NonNullable<Step['action']>;
  onRetry: () => void;
}) {
  if (action.kind === 'link') {
    return (
      <a
        className="button primary onboarding-action"
        href={action.href}
        rel="noreferrer"
        target="_blank"
      >
        {action.label}
      </a>
    );
  }
  return (
    <button className="primary onboarding-action" type="button" onClick={onRetry}>
      {action.label}
    </button>
  );
}

export function Welcome({ error, lattes, link, onFile, onTheme, theme }: Props) {
  // No `pnpm dev`, ?primeiro-uso=<estado> mostra um estado fixo para revisar.
  const preview = import.meta.env.DEV ? onboardingPreview(location.search) : undefined;
  const steps = onboardingSteps(preview?.link ?? link, preview?.open ?? lattes.state);
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
        <div data-tauri-drag-region className="topbar-identity" />
        <div data-tauri-drag-region className="topbar-center">
          <button disabled className="ghost search-btn" type="button">
            <SearchIcon />
            <span>Ir para</span>
            <kbd>{IS_MAC ? '⌘' : 'Ctrl'}</kbd>
            <kbd>K</kbd>
          </button>
        </div>
        <div data-tauri-drag-region className="topbar-actions">
          <button disabled aria-label="Novo item" className="ghost icon-btn" type="button">
            <PlusIcon />
          </button>
          <button disabled aria-label="Levar ao Lattes" className="ghost icon-btn" type="button">
            <UploadIcon />
          </button>
          <SettingsMenu theme={theme} onTheme={onTheme} />
        </div>
      </header>

      <Sidebar disabled pendingIn={() => 0} sections={EMPTY_SECTIONS} onSelect={() => {}} />

      <main className="content">
        <div className="section-main section-main-empty">
          <div className="welcome-step onboarding-layout">
            <div className="onboarding-intro">
              <OpenArt />
              <h1 className="empty-title">Abra seu currículo do Lattes</h1>
              <p className="onboarding-lead">
                Depois de três passos na primeira vez, o editor abre o currículo sozinho.
              </p>
            </div>
            <ol className="onboarding">
              {steps.map((step, i) => (
                <li
                  key={step.title}
                  aria-current={step.status === 'agora' ? 'step' : undefined}
                  className={`onboarding-step ${step.status}`}
                >
                  <span aria-hidden="true" className="onboarding-mark">
                    {step.status === 'feito' ? <CheckIcon /> : step.busy ? <SpinnerIcon /> : i + 1}
                  </span>
                  <div className="onboarding-body">
                    <h2 className="onboarding-title">{step.title}</h2>
                    <p className="onboarding-text">{step.text}</p>
                    {step.status === 'agora' && step.action && (
                      <StepAction action={step.action} onRetry={lattes.open} />
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div className="onboarding-file">
              <button className="link-button" type="button" onClick={pick}>
                Prefiro abrir o arquivo exportado
              </button>
              <p className="onboarding-manual">
                No Lattes, em <span className="pill">Ferramentas › Exportar</span>; depois, solte
                aqui o <span className="pill mono">CV_&lt;id&gt;.zip</span>. O arquivo não sai do
                seu computador.
              </p>
              {error && <p className="error">{error}</p>}
            </div>
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
