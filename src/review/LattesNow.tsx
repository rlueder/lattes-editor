// "No Lattes agora", no alto do Histórico: a data da última publicação, se
// há algo pendente no Lattes e o que mudou lá desde a exportação aberta,
// para quem volta ao Lattes depois de muito tempo (docs/fluxos_de_uso.md).
// Só leitura: cada item que ainda está no editor leva a ele.

import { useMemo, useRef } from 'react';

import type { LattesStatus } from '../bridge/lattes-status.ts';
import { parseXml, type XElement } from '../model/xml.ts';
import type { HashRoute } from '../ui/hash-route.ts';
import type { Section } from '../ui/sections.ts';
import { dateLabel } from '../ui/status-strip.ts';
import type { EspelhoReading } from '../ui/use-bridge.ts';
import type { EspelhoDiff } from './espelho-diff.ts';
import { compareWithLattes } from './lists-diff.ts';
import { bySequencia, type Place, placeIndex, sequenciaKey } from './locate.ts';

interface Props {
  /** O Histórico está aberto: só então a exportação é lida e comparada. */
  active: boolean;
  /** A extensão está conectada (sem ela não há leitura do Lattes). */
  available: boolean;
  espelho?: EspelhoReading;
  lattes?: LattesStatus;
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
  onGo: (route: HashRoute) => void;
  onRequestEspelho: () => void;
}

function LattesSummary({ available, lattes }: { available: boolean; lattes?: LattesStatus }) {
  if (!lattes) {
    return (
      <p className="muted">
        {available
          ? 'Abra o seu currículo no Lattes, numa aba deste navegador, para o editor ler a data da última publicação e se há algo pendente.'
          : 'Sem a extensão, o editor não lê o Lattes.'}
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

export function LattesNow(props: Props) {
  const { active, available, espelho, lattes, originalXml, root, sections, version } = props;

  const places = useMemo(
    () => (active ? placeIndex(sections) : new Map<XElement, Place>()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, sections, version],
  );
  // O componente fica montado: a exportação só é lida com o Histórico
  // aberto, e fica guardada (por arquivo) para as próximas aberturas.
  const parsed = useRef<{ root: XElement; xml: string } | undefined>(undefined);
  const original = useMemo(() => {
    if (!active) return undefined;
    if (parsed.current?.xml !== originalXml) {
      parsed.current = { root: parseXml(originalXml).root, xml: originalXml };
    }
    return parsed.current.root;
  }, [active, originalXml]);
  const diff = useMemo(
    () => (active && original && espelho ? compareWithLattes(espelho, original) : undefined),
    [active, espelho, original],
  );
  // Os itens da exportação original levam ao mesmo item no documento aberto.
  const current = useMemo(
    () => (active ? bySequencia(root) : new Map<string, XElement>()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, root, version],
  );
  const placeOf = (item: XElement) => {
    const key = sequenciaKey(item);
    return places.get((key && current.get(key)) || item);
  };
  const go = (place?: Place) => {
    if (place) props.onGo({ anchor: place.anchor, sectionId: place.sectionId });
  };

  return (
    <section aria-labelledby="lattes-now-title" className="panel-section lattes-now">
      <h3 className="panel-section-head" id="lattes-now-title">
        No Lattes agora
      </h3>
      <LattesSummary available={available} lattes={lattes} />
      <p className="muted">
        Comparar procura os itens de todas as seções no Lattes como ele está agora, inclusive o que
        ainda não foi enviado ao CNPq, pelo nome e pelo ano. Mudanças em outros campos (autores,
        descrição) não aparecem.
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
  );
}

function EspelhoResult({
  diff,
  onGo,
  placeOf,
}: {
  diff: EspelhoDiff;
  placeOf: (item: XElement) => Place | undefined;
  onGo: (place?: Place) => void;
}) {
  if (diff.unreadable) {
    return (
      <p className="empty">
        {diff.scope === 'listas'
          ? 'Não deu para ler as listas do Lattes: nenhum item da exportação apareceu nelas. O formato das listas pode ter mudado, então nada foi comparado.'
          : 'Não deu para ler a página de conferência do Lattes: nenhuma produção da exportação apareceu nela. O formato da página pode ter mudado, então nada foi comparado.'}
      </p>
    );
  }
  const scope = <ScopeNote diff={diff} />;
  if (diff.onlyInLattes.length === 0 && diff.onlyInExport.length === 0) {
    return (
      <>
        <p className="empty">
          {diff.scope === 'listas'
            ? 'Tudo bate: nenhum item incluído ou tirado no Lattes desde a exportação.'
            : 'Os títulos batem: nenhuma produção ou evento incluído ou tirado no Lattes desde a exportação.'}
        </p>
        {scope}
      </>
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
      {scope}
    </>
  );
}

/** O que ficou de fora: seções cuja lista não foi lida, ou a extensão antiga que só lê a página de conferência. */
function ScopeNote({ diff }: { diff: EspelhoDiff }) {
  if (diff.scope === 'pagina') {
    return (
      <p className="muted">
        Só produções e eventos foram comparados: esta versão da extensão não lê as outras listas.
        Atualize a extensão para comparar todas as seções.
      </p>
    );
  }
  if (!diff.notCompared?.length) return null;
  return (
    <p className="muted">
      Não comparado (a lista não abriu no Lattes): {diff.notCompared.join(', ')}. Confira essas
      seções no Lattes.
    </p>
  );
}
