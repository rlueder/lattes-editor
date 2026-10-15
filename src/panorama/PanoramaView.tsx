// A página de um gráfico do Panorama, com a mesma estrutura de uma seção do
// currículo: título e nota, a coluna do gráfico e o painel à direita com os
// filtros e a seleção feita no gráfico.

import { memo, useCallback, useMemo, useState } from 'react';

import { saveBytes } from '../desktop/native.ts';
import type { XElement } from '../model/xml.ts';
import { DownloadIcon } from '../ui/icons.tsx';
import { usePrivacyMode } from '../ui/privacy.ts';
import type { Section } from '../ui/sections.ts';
import { countRows, countsCsv, csvFileName, windows } from './aggregate.ts';
import { chartById } from './catalog.ts';
import { Authorship } from './charts/Authorship.tsx';
import { Health } from './charts/Health.tsx';
import { People } from './charts/People.tsx';
import { Productions } from './charts/Productions.tsx';
import { Quadrennia } from './charts/Quadrennia.tsx';
import { Summary } from './charts/Summary.tsx';
import { Timeline } from './charts/Timeline.tsx';
import { Topics } from './charts/Topics.tsx';
import { Venues } from './charts/Venues.tsx';
import { type OpenTarget, type Selection, selectionGroups } from './drill.ts';
import { chartPeriod, defaultFilters, type Filters } from './filters.ts';
import { FiltersPanel } from './FiltersPanel.tsx';
import { readCv } from './model.ts';
import { type CvData, PRODUCTION_GROUPS } from './model.ts';
import { SelectionPanel } from './SelectionPanel.tsx';
import { ChartContext, createTipStore, type TipStore, useTip } from './use-chart.ts';

interface Props {
  chartId: string;
  root: XElement;
  sections: Section[];
  /** Muda a cada edição do documento (que é mutado no lugar). */
  version: number;
  onOpen: (target: OpenTarget) => void;
}

/** O ano corrente, lido na hora: um app aberto na virada do ano não fica no ano anterior. */
const thisYear = () => new Date().getFullYear();

/** A tabela de quadriênios em CSV: o diálogo de salvar no app, download no navegador. */
async function exportQuadrennia(cv: CvData, lastYears: number, hidden: boolean) {
  const csv = countsCsv(countRows(cv), windows(cv, thisYear(), lastYears));
  const name = csvFileName(cv, hidden, new Date());
  await saveBytes(new TextEncoder().encode(csv), name, 'text/csv;charset=utf-8');
}

interface ChartBodyProps {
  chartId: string;
  cv: CvData;
  f: Filters;
  setF: (f: Filters) => void;
}

function ChartBodyView({ chartId, cv, f, setF }: ChartBodyProps) {
  const period = chartPeriod(cv, f);
  const whole = period.all === true;
  const groups = f.group ? [f.group] : PRODUCTION_GROUPS.map((g) => g.key);
  switch (chartId) {
    case 'saude-do-curriculo':
      return <Health cv={cv} group={f.group || undefined} period={period} whole={whole} />;
    case 'producoes-por-ano':
      return <Productions cv={cv} groups={groups} now={thisYear()} period={period} />;
    case 'quadrienios':
      return <Quadrennia cv={cv} lastYears={f.lastYears} now={thisYear()} />;
    case 'linha-do-tempo':
      return <Timeline cv={cv} now={thisYear()} period={period} whole={whole} />;
    case 'pessoas':
      return (
        <People
          cv={cv}
          level={f.level || undefined}
          period={period}
          tie={f.tie || undefined}
          view={f.view}
          onView={(view) => setF({ ...f, view })}
        />
      );
    case 'posicao-de-autoria':
      return <Authorship cv={cv} groups={groups} period={period} />;
    case 'onde-publica':
      return <Venues cv={cv} period={period} whole={whole} />;
    case 'temas':
      return <Topics cv={cv} period={period} onlyRepeated={f.repeated} />;
    default:
      return <Summary cv={cv} now={thisYear()} period={period} whole={whole} />;
  }
}

/** Memorizado: a página redesenha sem refazer as contas do gráfico quando nada dele mudou. */
const ChartBody = memo(ChartBodyView);

/** A dica do passar do mouse, num componente próprio: só ele redesenha quando o ponteiro anda. */
function TipLayer({ store }: { store: TipStore }) {
  const tip = useTip(store);
  if (!tip) return null;
  return (
    <div className="pano-tip" role="tooltip" style={{ left: tip.x + 14, top: tip.y - 10 }}>
      {tip.content}
    </div>
  );
}

export function PanoramaView({ chartId, onOpen, root, sections, version }: Props) {
  const chart = chartById(chartId);
  // O documento muda no lugar; `version` avisa que é preciso ler de novo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cv = useMemo(() => readCv(root, thisYear()), [root, version]);
  const [filters, setFilters] = useState<Filters>(() => defaultFilters(cv));
  const [selection, setSelection] = useState<{ chart: string; s: Selection } | null>(null);
  const [tips] = useState(createTipStore);
  // Com a privacidade ligada, o nome não vai no nome do arquivo exportado.
  const [hidden] = usePrivacyMode();
  const current = selection?.chart === chart.id ? selection.s : null;
  const closeSelection = useCallback(() => setSelection(null), []);

  const api = useMemo(
    () => ({
      pick: (s: Selection) => {
        tips.set(null);
        // Quando o filtro da seção mostra exatamente os itens, abre direto;
        // uma pessoa, ou itens que nenhum filtro reproduz, vão para a seleção.
        const groups = selectionGroups(sections, s, thisYear());
        const only = groups.length === 1 ? groups[0] : undefined;
        if (only?.exact && !s.person) onOpen(only.target);
        else setSelection({ chart: chart.id, s });
      },
      setTip: tips.set,
    }),
    [chart.id, onOpen, sections, tips],
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
            <ChartBody chartId={chart.id} cv={cv} f={filters} setF={setFilters} />
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
                now={thisYear()}
                onChange={setFilters}
              />
            </div>
          )}
          {chart.id === 'quadrienios' && (
            <div className="panel-block">
              <button
                className="pano-open"
                type="button"
                onClick={() => void exportQuadrennia(cv, filters.lastYears, hidden)}
              >
                <DownloadIcon /> Exportar como planilha
              </button>
            </div>
          )}
          {current && (
            <SelectionPanel
              now={thisYear()}
              sections={sections}
              selection={current}
              onClose={closeSelection}
              onOpen={onOpen}
            />
          )}
        </aside>
      </div>
      <TipLayer store={tips} />
    </ChartContext.Provider>
  );
}
