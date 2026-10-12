// Diálogo de impressão: modelos como ponto de partida, seções agrupadas como
// no menu lateral, opções de estilo e uma pré-visualização ao lado que muda a
// cada escolha. O PDF sai da impressão do navegador ("Salvar como PDF"):
// nada do currículo sai da máquina.

import './print.css';

import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { firstChild, getAttr, type XDocument } from '../model/xml.ts';
import { Modal } from '../ui/Modal.tsx';
import { Switch } from '../ui/primitives/Switch.tsx';
import type { Profile } from '../ui/profile.ts';
import type { Section } from '../ui/sections.ts';
import {
  matchTemplate,
  type PrintOptions,
  printOutline,
  selectedCount,
  type Template,
  TEMPLATES,
  templateSelection,
  toggleGroups,
} from './print-model.ts';
import { PrintDocument } from './PrintDocument.tsx';
import type { PrintControl } from './use-print.ts';

interface Props {
  control: PrintControl;
  doc: XDocument;
  profile: Profile;
  sections: Section[];
}

/** Caixa de marcação que mostra o estado "parcial" de um grupo. */
function GroupCheckbox({
  checked,
  label,
  mixed,
  onChange,
}: {
  checked: boolean;
  label: string;
  mixed?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <input
      ref={(el) => {
        if (el) el.indeterminate = !!mixed;
      }}
      aria-label={label}
      checked={checked}
      type="checkbox"
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

function OptionSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="print-switch">
      <Switch aria-labelledby={id} checked={checked} onChange={onChange} />
      <span id={id}>{label}</span>
    </div>
  );
}

export function PrintDialog({ control, doc, profile, sections }: Props) {
  const { hide: onClose, open } = control;
  const outline = useMemo(() => printOutline(sections), [sections]);
  const [template, setTemplate] = useState<Template>('resumido');
  const [options, setOptions] = useState<PrintOptions>(() => ({
    english: false,
    etAl: false,
    qr: true,
    selected: templateSelection(outline, 'resumido'),
  }));
  const dg = firstChild(doc.root, 'DADOS-GERAIS');
  const citationNames = dg && getAttr(dg, 'NOME-EM-CITACOES-BIBLIOGRAFICAS')?.trim();

  // Arquivo recarregado: os ids dos grupos mudam; refaz a seleção pelo modelo.
  useEffect(() => {
    setOptions((o) => ({ ...o, selected: templateSelection(outline, template, o.selected) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outline]);

  const select = (selected: Set<string>) => {
    setOptions((o) => ({ ...o, selected }));
    setTemplate(matchTemplate(outline, selected));
  };
  const items = selectedCount(outline, options.selected);

  const page = (
    <PrintDocument
      citationNames={citationNames || undefined}
      options={options}
      outline={outline}
      profile={profile}
    />
  );

  return (
    <>
      <Modal
        className="print-modal"
        footer={
          <>
            <span className="muted print-hint">
              Na janela de impressão, escolha &quot;Salvar como PDF&quot; para ter o arquivo.
            </span>
            <button className="ghost" type="button" onClick={onClose}>
              Fechar
            </button>
            <button
              className="primary"
              disabled={items === 0}
              type="button"
              onClick={() => window.print()}
            >
              Imprimir ou salvar PDF
            </button>
          </>
        }
        label="Imprimir currículo"
        open={open}
        subtitle={`${items} ${items === 1 ? 'item' : 'itens'} nas seções marcadas`}
        title="Imprimir currículo"
        onClose={onClose}
      >
        <div className="print-layout">
          <div className="print-options">
            <fieldset className="print-fieldset">
              <legend>Modelo</legend>
              <div aria-label="Modelo" className="print-segment" role="radiogroup">
                {TEMPLATES.map((t) => (
                  <label key={t.value} className={template === t.value ? 'active' : undefined}>
                    <input
                      checked={template === t.value}
                      name="print-template"
                      type="radio"
                      value={t.value}
                      onChange={() => {
                        setTemplate(t.value);
                        setOptions((o) => ({
                          ...o,
                          selected: templateSelection(outline, t.value, o.selected),
                        }));
                      }}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="print-fieldset">
              <legend>Seções</legend>
              <ul className="print-sections">
                {outline.map((s) => {
                  const ids = s.groups.map((g) => g.id);
                  const on = ids.filter((id) => options.selected.has(id)).length;
                  const total = s.groups.reduce((n, g) => n + g.items.length, 0);
                  return (
                    <li key={s.id}>
                      <label className="print-row print-section-row">
                        <GroupCheckbox
                          checked={on === ids.length}
                          label={s.label}
                          mixed={on > 0 && on < ids.length}
                          onChange={(v) => select(toggleGroups(options.selected, ids, v))}
                        />
                        <span className="print-row-label">{s.label}</span>
                        <span className="count">{total}</span>
                      </label>
                      {s.groups.length > 1 && (
                        <ul>
                          {s.groups.map((g) => (
                            <li key={g.id}>
                              <label className="print-row">
                                <GroupCheckbox
                                  checked={options.selected.has(g.id)}
                                  label={g.label}
                                  onChange={(v) =>
                                    select(toggleGroups(options.selected, [g.id], v))
                                  }
                                />
                                <span className="print-row-label">{g.label}</span>
                                {g.items.length > 1 && (
                                  <span className="count">{g.items.length}</span>
                                )}
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </fieldset>

            <fieldset className="print-fieldset">
              <legend>Estilo</legend>
              <OptionSwitch
                checked={options.qr}
                label="Código QR do currículo no cabeçalho"
                onChange={(qr) => setOptions((o) => ({ ...o, qr }))}
              />
              <OptionSwitch
                checked={options.english}
                label="Títulos em inglês"
                onChange={(english) => setOptions((o) => ({ ...o, english }))}
              />
              <OptionSwitch
                checked={options.etAl}
                label="Quatro autores ou mais: só o primeiro, com et al."
                onChange={(etAl) => setOptions((o) => ({ ...o, etAl }))}
              />
              <p className="muted print-note">
                Referências da produção no formato da ABNT NBR 6023; margens da NBR 14724.
              </p>
            </fieldset>
          </div>

          <div aria-label="Pré-visualização" className="print-preview" role="region">
            <div className="print-sheet">{page}</div>
          </div>
        </div>
      </Modal>
      {/* A página que vai para a impressora: fora do diálogo, só visível em @media print. */}
      {open && createPortal(<div id="print-root">{page}</div>, document.body)}
    </>
  );
}
