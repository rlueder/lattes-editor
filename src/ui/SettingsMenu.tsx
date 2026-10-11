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
  EyeOffIcon,
  HistoryIcon,
  MonitorIcon,
  MoonIcon,
  RefreshIcon,
  SettingsIcon,
  SunIcon,
} from './icons.tsx';
import { Tip } from './primitives/Tip.tsx';
import { usePrivacyMode } from './privacy.ts';
import type { ThemePref } from './theme.ts';

/** Ações que pedem um currículo aberto; sem elas, aparecem desabilitadas. */
interface FileActions {
  modified: boolean;
  showEmpty: boolean;
  onClose: () => void;
  onHistory: () => void;
  onPrint: () => void;
  onReload: () => void;
  onSave: () => void;
  onShowEmpty: (show: boolean) => void;
}

interface Props {
  file?: FileActions;
  theme: ThemePref;
  onTheme: (theme: ThemePref) => void;
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const THEMES: { icon: ReactNode; label: string; value: ThemePref }[] = [
  { icon: <MonitorIcon />, label: 'Sistema', value: 'sistema' },
  { icon: <SunIcon />, label: 'Claro', value: 'claro' },
  { icon: <MoonIcon />, label: 'Escuro', value: 'escuro' },
];

export function SettingsMenu({ file, onTheme, theme }: Props) {
  // Esconde dados pessoais em Dados gerais e põe a foto em mosaico.
  const [hidePersonal, setHidePersonal] = usePrivacyMode();
  return (
    <Menu.Root>
      <Tip label="Configurações e arquivo">
        <Menu.Trigger aria-label="Configurações e arquivo" className="ghost icon-btn">
          <SettingsIcon />
          {file?.modified && <span aria-hidden="true" className="dot badge-dot" />}
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

            <Menu.Separator className="menu-sep" />

            <Menu.Group>
              <Menu.GroupLabel className="menu-heading">Exibição</Menu.GroupLabel>
              <Menu.CheckboxItem
                checked={hidePersonal}
                className="menu-item"
                closeOnClick={false}
                disabled={!file}
                onCheckedChange={setHidePersonal}
              >
                <span className="menu-icon">
                  <EyeOffIcon />
                </span>
                <span className="menu-label">Modo de privacidade</span>
                <Menu.CheckboxItemIndicator className="menu-check">
                  <CheckIcon />
                </Menu.CheckboxItemIndicator>
              </Menu.CheckboxItem>

              <Menu.CheckboxItem
                checked={file?.showEmpty ?? false}
                className="menu-item"
                closeOnClick={false}
                disabled={!file}
                onCheckedChange={(show) => file?.onShowEmpty(show)}
              >
                <span className="menu-icon">
                  <EyeIcon />
                </span>
                <span className="menu-label">Mostrar campos vazios</span>
                <Menu.CheckboxItemIndicator className="menu-check">
                  <CheckIcon />
                </Menu.CheckboxItemIndicator>
              </Menu.CheckboxItem>
            </Menu.Group>

            <Menu.Separator className="menu-sep" />

            <Menu.Group>
              <Menu.GroupLabel className="menu-heading">Arquivo</Menu.GroupLabel>

              <Menu.Item className="menu-item" disabled={!file} onClick={() => file?.onSave()}>
                <span className="menu-icon">
                  <DownloadIcon />
                </span>
                <span className="menu-label">Salvar arquivo (.xml)</span>
                {file?.modified && <span className="menu-hint">alterado</span>}
              </Menu.Item>
              <Menu.Item className="menu-item" disabled={!file} onClick={() => file?.onPrint()}>
                <span className="menu-icon">
                  <PrinterIcon />
                </span>
                <span className="menu-label">Imprimir ou salvar PDF…</span>
                <span className="menu-hint">{IS_MAC ? '⌘P' : 'Ctrl+P'}</span>
              </Menu.Item>
              <Menu.Item className="menu-item" disabled={!file} onClick={() => file?.onReload()}>
                <span className="menu-icon">
                  <RefreshIcon />
                </span>
                <span className="menu-label">Recarregar do Lattes…</span>
              </Menu.Item>
              <Menu.Item className="menu-item" disabled={!file} onClick={() => file?.onHistory()}>
                <span className="menu-icon">
                  <HistoryIcon />
                </span>
                <span className="menu-label">Histórico de alterações</span>
              </Menu.Item>
            </Menu.Group>

            <Menu.Separator className="menu-sep" />

            <Menu.Item className="menu-item" disabled={!file} onClick={() => file?.onClose()}>
              <span className="menu-icon">
                <CloseIcon />
              </span>
              <span className="menu-label">Fechar o currículo</span>
            </Menu.Item>

            <Menu.Separator className="menu-sep" />
            <div className="menu-version">v{__APP_VERSION__}</div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
