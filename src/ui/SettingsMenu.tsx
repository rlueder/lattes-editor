// Menu de configurações (⚙): opções de exibição e ações de arquivo menos
// usadas, com a versão no fim. Padrão de menu do ARIA APG: setas navegam,
// Esc fecha e devolve o foco ao botão, clique fora fecha.

import { type ReactNode, useEffect, useRef, useState } from 'react';

import {
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  EyeIcon,
  HistoryIcon,
  RefreshIcon,
  SettingsIcon,
} from './icons.tsx';
import type { ThemePref } from './theme.ts';

interface Props {
  modified: boolean;
  showEmpty: boolean;
  theme: ThemePref;
  onClose: () => void;
  onHistory: () => void;
  onReload: () => void;
  onSave: () => void;
  onShowEmpty: (show: boolean) => void;
  onTheme: (theme: ThemePref) => void;
}

const THEMES: { label: string; value: ThemePref }[] = [
  { label: 'Sistema', value: 'sistema' },
  { label: 'Claro', value: 'claro' },
  { label: 'Escuro', value: 'escuro' },
];

export function SettingsMenu({
  modified,
  onClose,
  onHistory,
  onReload,
  onSave,
  onShowEmpty,
  onTheme,
  showEmpty,
  theme,
}: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const items = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      list[(n + list.length) % list.length]?.focus();
    };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(list.length - 1);
    else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') close(false);
  };

  /** Ação que fecha o menu depois de rodar. */
  const run = (fn: () => void) => () => {
    close(false);
    fn();
  };

  const item = (icon: ReactNode, label: ReactNode, onClick: () => void, extra?: ReactNode) => (
    <button className="menu-item" role="menuitem" tabIndex={-1} type="button" onClick={onClick}>
      <span className="menu-icon">{icon}</span>
      <span className="menu-label">{label}</span>
      {extra}
    </button>
  );

  return (
    <div className="settings">
      <button
        ref={buttonRef}
        aria-controls="menu-configuracoes"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Configurações e arquivo"
        className="ghost icon-btn"
        data-tip={open ? undefined : 'Configurações e arquivo'}
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        <SettingsIcon />
        {modified && <span aria-hidden="true" className="dot badge-dot" />}
      </button>

      {open && (
        <div
          ref={menuRef}
          aria-label="Configurações e arquivo"
          className="menu"
          id="menu-configuracoes"
          role="menu"
          tabIndex={-1}
          onKeyDown={onKeyDown}
        >
          <div className="menu-heading" role="presentation">
            Tema
          </div>
          <div aria-label="Tema" className="menu-segment" role="group">
            {THEMES.map((t) => (
              <button
                key={t.value}
                aria-checked={theme === t.value}
                className={theme === t.value ? 'menu-seg active' : 'menu-seg'}
                role="menuitemradio"
                tabIndex={-1}
                type="button"
                onClick={() => onTheme(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            aria-checked={showEmpty}
            className="menu-item"
            role="menuitemcheckbox"
            tabIndex={-1}
            type="button"
            onClick={() => onShowEmpty(!showEmpty)}
          >
            <span className="menu-icon">
              <EyeIcon />
            </span>
            <span className="menu-label">Mostrar campos vazios</span>
            <span aria-hidden="true" className="menu-check">
              {showEmpty && <CheckIcon />}
            </span>
          </button>

          <div className="menu-sep" role="separator" />

          {item(
            <DownloadIcon />,
            'Salvar arquivo (.xml)',
            run(onSave),
            modified && <span className="menu-hint">alterado</span>,
          )}
          {item(<RefreshIcon />, 'Recarregar do Lattes…', run(onReload))}
          {item(<HistoryIcon />, 'Histórico de alterações', run(onHistory))}

          <div className="menu-sep" role="separator" />

          {item(<CloseIcon />, 'Fechar o currículo', run(onClose))}

          <div className="menu-sep" role="separator" />
          <div className="menu-version" role="presentation">
            Editor do Currículo Lattes · versão {__APP_VERSION__}
          </div>
        </div>
      )}
    </div>
  );
}
