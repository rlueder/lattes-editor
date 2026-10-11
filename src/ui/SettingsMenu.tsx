// Menu de configurações (⚙) sobre o Menu do Base UI: opções de exibição e
// ações de arquivo menos usadas, com a versão no fim.

import { Menu } from '@base-ui/react/menu';
import type { ReactNode } from 'react';

import { PrinterIcon } from '../print/PrinterIcon.tsx';
import {
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  EyeIcon,
  HistoryIcon,
  MonitorIcon,
  MoonIcon,
  RefreshIcon,
  SettingsIcon,
  SunIcon,
} from './icons.tsx';
import { Tip } from './primitives/Tip.tsx';
import type { ThemePref } from './theme.ts';

interface Props {
  modified: boolean;
  showEmpty: boolean;
  theme: ThemePref;
  onClose: () => void;
  onHistory: () => void;
  onPrint: () => void;
  onReload: () => void;
  onSave: () => void;
  onShowEmpty: (show: boolean) => void;
  onTheme: (theme: ThemePref) => void;
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const THEMES: { icon: ReactNode; label: string; value: ThemePref }[] = [
  { icon: <MonitorIcon />, label: 'Sistema', value: 'sistema' },
  { icon: <SunIcon />, label: 'Claro', value: 'claro' },
  { icon: <MoonIcon />, label: 'Escuro', value: 'escuro' },
];

export function SettingsMenu({
  modified,
  onClose,
  onHistory,
  onPrint,
  onReload,
  onSave,
  onShowEmpty,
  onTheme,
  showEmpty,
  theme,
}: Props) {
  return (
    <Menu.Root>
      <Tip label="Configurações e arquivo">
        <Menu.Trigger aria-label="Configurações e arquivo" className="ghost icon-btn">
          <SettingsIcon />
          {modified && <span aria-hidden="true" className="dot badge-dot" />}
        </Menu.Trigger>
      </Tip>
      <Menu.Portal>
        <Menu.Positioner align="end" className="popup-positioner" sideOffset={6}>
          <Menu.Popup className="menu">
            <Menu.Group>
              <Menu.GroupLabel className="menu-heading">Tema</Menu.GroupLabel>
              <Menu.RadioGroup
                className="menu-segment"
                value={theme}
                onValueChange={(v) => onTheme(v as ThemePref)}
              >
                {THEMES.map((t) => (
                  <Menu.RadioItem
                    key={t.value}
                    className="menu-seg"
                    closeOnClick={false}
                    value={t.value}
                  >
                    {t.icon}
                    {t.label}
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Group>

            <Menu.CheckboxItem
              checked={showEmpty}
              className="menu-item"
              closeOnClick={false}
              onCheckedChange={onShowEmpty}
            >
              <span className="menu-icon">
                <EyeIcon />
              </span>
              <span className="menu-label">Mostrar campos vazios</span>
              <Menu.CheckboxItemIndicator className="menu-check">
                <CheckIcon />
              </Menu.CheckboxItemIndicator>
            </Menu.CheckboxItem>

            <Menu.Separator className="menu-sep" />

            <Menu.Item className="menu-item" onClick={onSave}>
              <span className="menu-icon">
                <DownloadIcon />
              </span>
              <span className="menu-label">Salvar arquivo (.xml)</span>
              {modified && <span className="menu-hint">alterado</span>}
            </Menu.Item>
            <Menu.Item className="menu-item" onClick={onPrint}>
              <span className="menu-icon">
                <PrinterIcon />
              </span>
              <span className="menu-label">Imprimir ou salvar PDF…</span>
              <span className="menu-hint">{IS_MAC ? '⌘P' : 'Ctrl+P'}</span>
            </Menu.Item>
            <Menu.Item className="menu-item" onClick={onReload}>
              <span className="menu-icon">
                <RefreshIcon />
              </span>
              <span className="menu-label">Recarregar do Lattes…</span>
            </Menu.Item>
            <Menu.Item className="menu-item" onClick={onHistory}>
              <span className="menu-icon">
                <HistoryIcon />
              </span>
              <span className="menu-label">Histórico de alterações</span>
            </Menu.Item>

            <Menu.Separator className="menu-sep" />

            <Menu.Item className="menu-item" onClick={onClose}>
              <span className="menu-icon">
                <CloseIcon />
              </span>
              <span className="menu-label">Fechar o currículo</span>
            </Menu.Item>

            <Menu.Separator className="menu-sep" />
            <div className="menu-version">
              Editor do Currículo Lattes · versão {__APP_VERSION__}
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
