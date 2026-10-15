// Diagnóstico do currículo, para quem volta ao Lattes depois de muito tempo
// (docs/fluxos_de_uso.md): o que o Lattes diz (publicação e pendência), o que
// mudou lá desde a exportação e um resumo do que vale conferir no currículo
// inteiro, cujo detalhe fica na validação do currículo (ValidationPanel.tsx).
// Só leitura: cada achado leva ao item no editor.

import { useMemo, useRef } from 'react';

import type { LattesStatus } from '../bridge/lattes-status.ts';
import { parseXml, type XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import type { HashRoute } from '../ui/hash-route.ts';
import { Modal } from '../ui/Modal.tsx';
import type { Section } from '../ui/sections.ts';
import { dateLabel } from '../ui/status-strip.ts';
import type { EspelhoReading } from '../ui/use-bridge.ts';
import { diffEspelho } from './espelho-diff.ts';
import { bySequencia, type Place, placeIndex, sequenciaKey } from './locate.ts';
import { summaryLine, validateCv } from './validation.ts';

interface Props {
  /** A extensão está conectada (sem ela não há leitura do Lattes). */
  available: boolean;
  espelho?: EspelhoReading;
  lattes?: LattesStatus;
  open: boolean;
  /**
   * A exportação como foi carregada: a comparação com o Lattes usa ela, não
   * o documento editado, para que o que mudou no editor não pareça mudança
   * feita no Lattes.
   */
  originalXml: string;
  root: XElement;
  sections: Section[];
  /** Muda a cada edição; o documento é mutado no lugar. */
  version: number;
  onClose: () => void;
  onGo: (route: HashRoute) => void;
  onRequestEspelho: () => void;
  /** Abre a validação do currículo, com o detalhe do que vale conferir. */
  onValidation: () => void;
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
  const { available, espelho, lattes, open, originalXml, root, sections, version } = props;

  const places = useMemo(
    () => (open ? placeIndex(sections) : new Map<XElement, Place>()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, sections, version],
  );
  const validation = useMemo(
    () => (open ? validateCv(lattesSchema, root, sections) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, root, sections, version],
  );
  // O painel fica montado o tempo todo: a exportação só é lida com ele
  // aberto, e fica guardada (por arquivo) para as próximas aberturas.
  const parsed = useRef<{ root: XElement; xml: string } | undefined>(undefined);
  const original = useMemo(() => {
    if (!open) return undefined;
    if (parsed.current?.xml !== originalXml) {
      parsed.current = { root: parseXml(originalXml).root, xml: originalXml };
    }
    return parsed.current.root;
  }, [open, originalXml]);
  const diff = useMemo(
    () => (open && original && espelho?.items ? diffEspelho(espelho.items, original) : undefined),
    [open, espelho, original],
  );
  // Os itens da exportação original levam ao mesmo item no documento aberto.
  const current = useMemo(
    () => (open ? bySequencia(root) : new Map<string, XElement>()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, root, version],
  );
  const placeOf = (item: XElement) => {
    const key = sequenciaKey(item);
    return places.get((key && current.get(key)) || item);
  };

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
        {diff && <EspelhoResult diff={diff} placeOf={placeOf} onGo={go} />}
      </section>

      <section className="panel-section">
        <h3 className="panel-section-head">Vale conferir</h3>
        {validation && validation.items.length === 0 ? (
          <p className="empty">Nada chamou atenção no currículo.</p>
        ) : (
          <>
            <p className="muted">
              {validation ? summaryLine(validation) : ''} no currículo inteiro. A validação mostra
              cada um, item por item.
            </p>
            <div className="diagnosis-actions">
              <button type="button" onClick={props.onValidation}>
                Abrir a validação
              </button>
            </div>
          </>
        )}
      </section>
    </Modal>
  );
}

function EspelhoResult({
  diff,
  onGo,
  placeOf,
}: {
  diff: ReturnType<typeof diffEspelho>;
  placeOf: (item: XElement) => Place | undefined;
  onGo: (place?: Place) => void;
}) {
  if (diff.unreadable) {
    return (
      <p className="empty">
        Não deu para ler a página de conferência do Lattes: nenhuma produção da exportação apareceu
        nela. O formato da página pode ter mudado, então nada foi comparado.
      </p>
    );
  }
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
              const place = placeOf(item);
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
