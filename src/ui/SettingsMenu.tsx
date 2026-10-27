// Menu de configurações (⚙) sobre o Menu do Base UI: opções de exibição e
// ações de arquivo menos usadas, com a versão no fim. No app de desktop, logo
// acima da versão, "Verificar atualizações" confere na hora se saiu versão nova.

import { Menu } from '@base-ui/react/menu';
import type { CSSProperties, ReactNode } from 'react';

import { PrinterIcon } from '../print/PrinterIcon.tsx';
import { FIELD_ORDERS, type FieldOrder, setFieldOrder, useFieldOrder } from './field-order.ts';
import {
  CheckIcon,
  CloseIcon,
  DiagnosisIcon,
  DownloadIcon,
  FocusIcon,
  HashIcon,
  HistoryIcon,
  MonitorIcon,
  MoonIcon,
  RefreshIcon,
  SettingsIcon,
  SpinnerIcon,
  SunIcon,
  UpdateIcon,
  UploadIcon,
  VersionsIcon,
} from './icons.tsx';
import { Tip } from './primitives/Tip.tsx';
import { setShowCodes, useShowCodes } from './show-codes.ts';
import type { ThemePref } from './theme.ts';
import { checkUpdatesNow, useManualUpdateCheck } from './use-updates.ts';

/** Ações que pedem um currículo aberto; sem elas, aparecem desabilitadas. */
interface FileActions {
  modified: boolean;
  onClose: () => void;
  /** Diagnóstico do currículo: comparação com o Lattes e revisão de consistência. */
  onDiagnosis: () => void;
  onHistory: () => void;
  /** Trazer produções de outro XML, com o pré-diff contra o currículo (LAT-45). */
  onIncoming: () => void;
  onPrint: () => void;
  /** "Atualizar do Lattes" pelos formulários; ausente sem a extensão que sabe. */
  onRefresh?: () => void;
  onReload: () => void;
  onSave: () => void;
  /** Versões do Lattes: o que mudou entre as exportações guardadas. */
  onVersions: () => void;
}

interface Props {
  file?: FileActions;
  /** Modo foco (com ?leitura): estado, atalho e troca. */
  focus?: { label: string; on: boolean; toggle: () => void };
  theme: ThemePref;
  onTheme: (theme: ThemePref) => void;
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const THEMES: { icon: ReactNode; label: string; value: ThemePref }[] = [
  { icon: <MonitorIcon />, label: 'Sistema', value: 'sistema' },
  { icon: <SunIcon />, label: 'Claro', value: 'claro' },
  { icon: <MoonIcon />, label: 'Escuro', value: 'escuro' },
];

export function SettingsMenu({ file, focus, onTheme, theme }: Props) {
  const showCodes = useShowCodes();
  const update = useManualUpdateCheck();
  const fieldOrder = useFieldOrder();
  return (
    <Menu.Root>
      <Tip label="Configurações e arquivo">
        <Menu.Trigger aria-label="Configurações e arquivo" className="ghost icon-btn">
          <SettingsIcon />
        </Menu.Trigger>
      </Tip>
      <Menu.Portal>
        <Menu.Positioner align="end" className="popup-positioner" sideOffset={6}>
          <Menu.Popup className="menu">
            <Menu.Group>
              <Menu.GroupLabel className="menu-heading">Tema</Menu.GroupLabel>
              <Menu.RadioGroup
                className="menu-segment"
                // A posição do destaque, que desliza até a opção escolhida.
                style={
                  {
                    '--seg-count': THEMES.length,
                    '--seg-index': Math.max(
                      0,
                      THEMES.findIndex((t) => t.value === theme),
                    ),
                  } as CSSProperties
                }
                value={theme}
                onValueChange={(v) => onTheme(v as ThemePref)}
              >
                <span aria-hidden="true" className="menu-seg-indicator" />
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
              <Menu.GroupLabel className="menu-heading">Ordem dos campos</Menu.GroupLabel>
              <Menu.RadioGroup
                className="menu-segment"
                style={
                  {
                    '--seg-count': FIELD_ORDERS.length,
                    '--seg-index': FIELD_ORDERS.findIndex((o) => o.value === fieldOrder),
                  } as CSSProperties
                }
                value={fieldOrder}
                onValueChange={(v) => setFieldOrder(v as FieldOrder)}
              >
                <span aria-hidden="true" className="menu-seg-indicator" />
                {FIELD_ORDERS.map((o) => (
                  <Menu.RadioItem
                    key={o.value}
                    className="menu-seg"
                    closeOnClick={false}
                    value={o.value}
                  >
                    {o.label}
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Group>

            <Menu.Separator className="menu-sep" />

            <Menu.Group>
              <Menu.GroupLabel className="menu-heading">Exibição</Menu.GroupLabel>

              {focus && (
                <Menu.CheckboxItem
                  checked={focus.on}
                  className="menu-item"
                  closeOnClick={true}
                  title={`Modo foco: só o conteúdo e o índice da seção (${focus.label})`}
                  onCheckedChange={() => focus.toggle()}
                >
                  <span className="menu-icon">
                    <FocusIcon />
                  </span>
                  <span className="menu-label">Modo foco</span>
                  <kbd className="menu-kbd">{focus.label}</kbd>
                  <Menu.CheckboxItemIndicator className="menu-check">
                    <CheckIcon />
                  </Menu.CheckboxItemIndicator>
                </Menu.CheckboxItem>
              )}
              <Menu.CheckboxItem
                checked={showCodes}
                className="menu-item"
                closeOnClick={false}
                disabled={!file}
                onCheckedChange={setShowCodes}
              >
                <span className="menu-icon">
                  <HashIcon />
                </span>
                <span className="menu-label">Mostrar códigos do Lattes</span>
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
              <Menu.Item className="menu-item" disabled={!file} onClick={() => file?.onIncoming()}>
                <span className="menu-icon">
                  <UploadIcon />
                </span>
                <span className="menu-label">Trazer itens de outro XML…</span>
              </Menu.Item>
            </Menu.Group>

            <Menu.Separator className="menu-sep" />

            <Menu.Group>
              <Menu.GroupLabel className="menu-heading">Versões</Menu.GroupLabel>
              <Menu.Item className="menu-item" disabled={!file} onClick={() => file?.onReload()}>
                <span className="menu-icon">
                  <RefreshIcon />
                </span>
                <span className="menu-label">Recarregar do Lattes…</span>
              </Menu.Item>
              {file?.onRefresh && (
                <Menu.Item className="menu-item" onClick={() => file.onRefresh?.()}>
                  <span className="menu-icon">
                    <DownloadIcon />
                  </span>
                  <span className="menu-label">Atualizar do Lattes</span>
                </Menu.Item>
              )}
              <Menu.Item className="menu-item" disabled={!file} onClick={() => file?.onHistory()}>
                <span className="menu-icon">
                  <HistoryIcon />
                </span>
                <span className="menu-label">Histórico de alterações</span>
              </Menu.Item>
              <Menu.Item className="menu-item" disabled={!file} onClick={() => file?.onVersions()}>
                <span className="menu-icon">
                  <VersionsIcon />
                </span>
                <span className="menu-label">Versões do Lattes</span>
              </Menu.Item>
              <Menu.Item className="menu-item" disabled={!file} onClick={() => file?.onDiagnosis()}>
                <span className="menu-icon">
                  <DiagnosisIcon />
                </span>
                <span className="menu-label">Diagnóstico do currículo</span>
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
            {update.available && (
              // Fica aberto: o "Verificando…" aparece aqui, e o resultado, no canto da tela.
              <Menu.Item
                className="menu-item"
                closeOnClick={false}
                disabled={update.checking}
                onClick={() => void checkUpdatesNow()}
              >
                <span className="menu-icon">
                  {update.checking ? <SpinnerIcon /> : <UpdateIcon />}
                </span>
                <span className="menu-label">
                  {update.checking ? 'Verificando…' : 'Verificar atualizações'}
                </span>
              </Menu.Item>
            )}
            <div className="menu-version">v{__APP_VERSION__}</div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
