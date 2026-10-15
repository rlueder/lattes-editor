// A página de um gráfico do Panorama, com a mesma estrutura de uma seção do
// currículo: título e nota, a coluna do gráfico e o painel à direita com os
// filtros e a seleção feita no gráfico.

import { useMemo, useState } from 'react';

import type { XElement } from '../model/xml.ts';
import type { Section } from '../ui/sections.ts';
import { chartById } from './catalog.ts';
import { Authorship } from './charts/Authorship.tsx';
import { Health } from './charts/Health.tsx';
import { People } from './charts/People.tsx';
import { Productions } from './charts/Productions.tsx';
import { Quadrennia } from './charts/Quadrennia.tsx';
import { Summary } from './charts/Summary.tsx';
import { Supervision } from './charts/Supervision.tsx';
import { Timeline } from './charts/Timeline.tsx';
import { Topics } from './charts/Topics.tsx';
import { Venues } from './charts/Venues.tsx';
import {
  itemTarget,
  listTarget,
  type OpenTarget,
  personTarget,
  type Selection,
  spansSections,
} from './drill.ts';
import { defaultFilters, type Filters, isWhole } from './filters.ts';
import { FiltersPanel } from './FiltersPanel.tsx';
import { readCv } from './model.ts';
import { type CvData, PRODUCTION_GROUPS } from './model.ts';
import { SelectionPanel } from './SelectionPanel.tsx';
import { ChartContext, type TipState } from './use-chart.ts';

interface Props {
  chartId: string;
  root: XElement;
  sections: Section[];
  /** Muda a cada edição do documento (que é mutado no lugar). */
  version: number;
  onOpen: (target: OpenTarget) => void;
}

const NOW = new Date().getFullYear();

function ChartBody({ chartId, cv, f }: { chartId: string; cv: CvData; f: Filters }) {
  const period = { from: f.from, to: f.to };
  const whole = isWhole(cv, period);
  const groups = f.group ? [f.group] : PRODUCTION_GROUPS.map((g) => g.key);
  switch (chartId) {
    case 'saude-do-curriculo':
      return <Health cv={cv} group={f.group || undefined} period={period} />;
    case 'producoes-por-ano':
      return <Productions cv={cv} groups={groups} now={NOW} period={period} />;
    case 'quadrienios':
      return <Quadrennia cv={cv} lastYears={f.lastYears} now={NOW} />;
    case 'linha-do-tempo':
      return <Timeline cv={cv} now={NOW} period={period} />;
    case 'pessoas':
      return <People cv={cv} period={period} tie={f.tie || undefined} view={f.view} />;
    case 'posicao-de-autoria':
      return <Authorship cv={cv} groups={groups} period={period} />;
    case 'orientacoes-e-bancas':
      return <Supervision cv={cv} level={f.level || undefined} now={NOW} period={period} />;
    case 'onde-publica':
      return <Venues cv={cv} period={period} whole={whole} />;
    case 'temas':
      return <Topics cv={cv} period={period} onlyRepeated={f.repeated} />;
    default:
      return <Summary cv={cv} now={NOW} period={period} whole={whole} />;
  }
}

export function PanoramaView({ chartId, onOpen, root, sections, version }: Props) {
  const chart = chartById(chartId);
  // O documento muda no lugar; `version` avisa que é preciso ler de novo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cv = useMemo(() => readCv(root, NOW), [root, version]);
  const [filters, setFilters] = useState<Filters>(() => defaultFilters(cv));
  const [selection, setSelection] = useState<{ chart: string; s: Selection } | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const current = selection?.chart === chart.id ? selection.s : null;

  const api = useMemo(
    () => ({
      pick: (s: Selection) => {
        setTip(null);
        // Um item só: o título acha exatamente ele, sem recorte nenhum.
        if (s.items.length === 1 && !s.person) {
          onOpen(itemTarget(sections, s.items[0]!));
          return;
        }
        // Sem recorte que falte ao editor e numa seção só: abre direto.
        const target = s.person
          ? personTarget(sections, s.person, s.items)
          : listTarget(sections, s.items);
        if (target && !s.soon && !spansSections(sections, s.items)) onOpen(target);
        else setSelection({ chart: chart.id, s });
      },
      setTip,
    }),
    [chart.id, onOpen, sections],
  );

  return (
    <ChartContext.Provider value={api}>
      <div className="section-layout reading panorama">
        <div className="section-title">
          <div className="section-head">
            <h1 tabIndex={-1}>{chart.label}</h1>
          </div>
          <p className="muted section-note pano-question">{chart.question}</p>
        </div>
        <div className="section-main">
          <div className="section-body pano-body">
            <ChartBody chartId={chart.id} cv={cv} f={filters} />
            <dl className="pano-sources">
              <dt>De onde vem</dt>
              <dd>{chart.sources}</dd>
              <dt>O que não aparece</dt>
              <dd>{chart.gaps}</dd>
            </dl>
          </div>
        </div>
        <aside aria-label="Filtros do gráfico" className="section-panel">
          {chart.filters.length > 0 && (
            <div className="panel-block">
              <h2 className="panel-heading">Filtros</h2>
              <FiltersPanel
                cv={cv}
                filters={filters}
                kinds={chart.filters}
                now={NOW}
                onChange={setFilters}
              />
            </div>
          )}
          {current && (
            <SelectionPanel
              sections={sections}
              selection={current}
              onClose={() => setSelection(null)}
              onOpen={onOpen}
            />
          )}
        </aside>
      </div>
      {tip && (
        <div className="pano-tip" role="tooltip" style={{ left: tip.x + 14, top: tip.y - 10 }}>
          {tip.content}
        </div>
      )}
    </ChartContext.Provider>
  );
}
