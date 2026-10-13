// Diagnóstico do currículo, para quem volta ao Lattes depois de muito tempo
// (docs/fluxos_de_uso.md): o que o Lattes diz (publicação e pendência), o que
// mudou lá desde a exportação e o que vale conferir no currículo inteiro.
// Só leitura: cada achado leva ao item no editor.

import { useMemo } from 'react';

import type { LattesStatus } from '../bridge/lattes-status.ts';
import type { XElement } from '../model/xml.ts';
import type { HashRoute } from '../ui/hash-route.ts';
import { Modal } from '../ui/Modal.tsx';
import type { Section } from '../ui/sections.ts';
import { dateLabel } from '../ui/status-strip.ts';
import type { EspelhoReading } from '../ui/use-bridge.ts';
import { type Finding, reviewCv } from './consistency.ts';
import { diffEspelho } from './espelho-diff.ts';
import { locate, type Place } from './locate.ts';

interface Props {
  /** A extensão está conectada (sem ela não há leitura do Lattes). */
  available: boolean;
  espelho?: EspelhoReading;
  lattes?: LattesStatus;
  open: boolean;
  root: XElement;
  sections: Section[];
  /** Muda a cada edição; o documento é mutado no lugar. */
  version: number;
  onClose: () => void;
  onGo: (route: HashRoute) => void;
  onRequestEspelho: () => void;
}

interface Located<T> {
  entry: T;
  place?: Place;
}

/** Agrupa por seção, na ordem em que as seções aparecem no menu. */
function bySection<T>(sections: Section[], entries: Located<T>[]) {
  const order = new Map(sections.map((s, i) => [s.id, i]));
  const groups = new Map<string, { label: string; rows: Located<T>[] }>();
  for (const e of entries) {
    const id = e.place?.sectionId ?? '';
    if (!groups.has(id)) groups.set(id, { label: e.place?.sectionLabel ?? 'Outros', rows: [] });
    groups.get(id)!.rows.push(e);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
    .map(([, g]) => g);
}

function LattesSummary({ available, lattes }: { available: boolean; lattes?: LattesStatus }) {
  if (!lattes) {
    return (
      <p className="muted">
        {available
          ? 'Abra o seu currículo no Lattes, numa aba deste navegador, para o editor ler a data da última publicação e se há algo pendente.'
          : 'Sem a extensão, o editor não lê o Lattes: o diagnóstico abaixo vale só para o arquivo aberto.'}
      </p>
    );
  }
  return (
    <ul className="diagnosis-facts">
      <li>
        Última publicação:{' '}
        <strong>{lattes.lastPublished ? dateLabel(lattes.lastPublished) : 'não informada'}</strong>
      </li>
      <li>
        {lattes.pending
          ? 'O Lattes tem alterações ainda não enviadas ao CNPq. O Lattes não descarta essas alterações; para publicá-las, use "Enviar" no canto superior direito do Lattes.'
          : 'Nada pendente no Lattes: o que está lá já foi publicado.'}
      </li>
    </ul>
  );
}

export function DiagnosisPanel(props: Props) {
  const { available, espelho, lattes, open, root, sections, version } = props;

  const findings = useMemo(
    () =>
      open
        ? reviewCv(root).map((f): Located<Finding> => ({
            entry: f,
            place: locate(sections, f.item),
          }))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, root, sections, version],
  );
  const diff = useMemo(
    () => (open && espelho?.items ? diffEspelho(espelho.items, root) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, espelho, root, version],
  );

  const go = (place?: Place) => {
    if (!place) return;
    props.onClose();
    props.onGo({ anchor: place.anchor, sectionId: place.sectionId });
  };

  return (
    <Modal
      className="export diagnosis"
      footer={
        <button className="ghost" type="button" onClick={props.onClose}>
          Fechar
        </button>
      }
      label="Diagnóstico do currículo"
      open={open}
      subtitle="O que o Lattes diz, o que mudou lá e o que vale conferir. Nada aqui altera o currículo."
      title="Diagnóstico do currículo"
      onClose={props.onClose}
    >
      <section className="panel-section">
        <h3 className="panel-section-head">No Lattes</h3>
        <LattesSummary available={available} lattes={lattes} />
      </section>

      <section className="panel-section">
        <h3 className="panel-section-head">O que mudou no Lattes desde a sua exportação</h3>
        <p className="muted">
          Compara os títulos das produções e dos eventos com a versão atual do Lattes, inclusive o
          que ainda não foi enviado ao CNPq. Mudanças em outros campos (ano, autores) não aparecem.
        </p>
        <div className="diagnosis-actions">
          <button
            disabled={!available}
            title={available ? undefined : 'Precisa da extensão e do Lattes aberto'}
            type="button"
            onClick={props.onRequestEspelho}
          >
            {espelho ? 'Comparar de novo' : 'Comparar com o Lattes'}
          </button>
        </div>
        {espelho?.error && <p className="export-blocked">{espelho.error}</p>}
        {diff && <EspelhoResult diff={diff} sections={sections} onGo={go} />}
      </section>

      <section className="panel-section">
        <h3 className="panel-section-head">
          Vale conferir
          {findings.length > 0 && <span className="count">{findings.length}</span>}
        </h3>
        {findings.length === 0 ? (
          <p className="empty">Nada chamou atenção no currículo.</p>
        ) : (
          bySection(sections, findings).map((g) => (
            <div key={g.label} className="diagnosis-group">
              <h4 className="sent-day-head">{g.label}</h4>
              <ul className="pending-list">
                {g.rows.map(({ entry, place }, i) => (
                  <li key={`${entry.check}-${i}`}>
                    <button
                      className="ghost pending-item diagnosis-item"
                      disabled={!place}
                      type="button"
                      onClick={() => go(place)}
                    >
                      <span className="pending-title">{entry.title}</span>
                      <span className={`tag${entry.severity === 'aviso' ? ' warn' : ''}`}>
                        {entry.severity === 'aviso' ? 'corrigir?' : 'conferir'}
                      </span>
                      <span className="diagnosis-message">{entry.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </Modal>
  );
}

function EspelhoResult({
  diff,
  onGo,
  sections,
}: {
  diff: ReturnType<typeof diffEspelho>;
  sections: Section[];
  onGo: (place?: Place) => void;
}) {
  if (diff.onlyInLattes.length === 0 && diff.onlyInExport.length === 0) {
    return (
      <p className="empty">
        Os títulos batem: nenhuma produção ou evento incluído ou tirado no Lattes desde a
        exportação.
      </p>
    );
  }
  return (
    <>
      {diff.onlyInLattes.length > 0 && (
        <div className="diagnosis-group">
          <h4 className="sent-day-head">Só no Lattes (incluído depois da exportação)</h4>
          <ul className="diagnosis-lines">
            {diff.onlyInLattes.map((item, i) => (
              <li key={i}>
                <span className="muted">{item.group ?? item.section}</span> {item.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {diff.onlyInExport.length > 0 && (
        <div className="diagnosis-group">
          <h4 className="sent-day-head">Só na exportação (tirado ou renomeado no Lattes)</h4>
          <ul className="pending-list">
            {diff.onlyInExport.map(({ item, title }, i) => {
              const place = locate(sections, item);
              return (
                <li key={i}>
                  <button
                    className="ghost pending-item"
                    disabled={!place}
                    type="button"
                    onClick={() => onGo(place)}
                  >
                    <span className="item-kind">{place?.groupLabel}</span>
                    <span className="pending-title">{title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {diff.skipped > 0 && (
        <p className="muted">
          {diff.skipped === 1
            ? '1 item tem título curto demais para comparar.'
            : `${diff.skipped} itens têm título curto demais para comparar.`}
        </p>
      )}
    </>
  );
}
