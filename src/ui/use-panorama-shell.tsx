// A ligação entre o editor e o Panorama: o controle de modo e o menu dos
// gráficos na barra lateral, o gráfico no lugar da seção, os gráficos no ⌘K
// e o clique que volta ao currículo com a seção filtrada. Tudo do Panorama
// entra por src/panorama/index.ts.

import { type ReactNode, useCallback, useMemo, useState } from 'react';

import type { Session } from '../forms/use-production.ts';
import {
  chartOfAction,
  ModeSwitch,
  type OpenTarget,
  PanoramaNav,
  panoramaPaletteEntries,
  PanoramaView,
  usePanorama,
} from '../panorama/index.ts';
import type { FilterState } from './facets.ts';
import type { HashRoute } from './hash-route.ts';
import { allEntries, type PaletteEntry } from './palette-search.ts';
import type { Section } from './sections.ts';

interface Args {
  navigate: (route: HashRoute, write?: boolean) => void;
  sectionId: string;
  sections: Section[];
  session: Session | null;
  version: number;
}

export interface PanoramaShell {
  entries: PaletteEntry[];
  /** Navegação pedida pela pessoa: sai do Panorama e abre a seção sem filtro herdado. */
  go: (route: HashRoute, write?: boolean) => void;
  /** Trata a ação do ⌘K se ela for um gráfico; devolve se tratou. */
  jumpChart: (entry: PaletteEntry) => boolean;
  modeSwitch: ReactNode;
  nav?: ReactNode;
  /** Filtro com que a seção abre; a chave zera a seção a cada pedido. */
  sectionFilter: { filter?: FilterState; key: number };
  /** O gráfico aberto, no lugar da seção; null no modo Currículo. */
  view: ReactNode;
}

export function usePanoramaShell({
  navigate,
  sectionId,
  sections,
  session,
  version,
}: Args): PanoramaShell {
  const panorama = usePanorama();
  const [sectionFilter, setSectionFilter] = useState<{ filter?: FilterState; key: number }>({
    key: 0,
  });
  const { active, exit, open } = panorama;

  const go = useCallback(
    (route: HashRoute, write = true) => {
      if (active) exit(`#${route.anchor ?? route.sectionId}`);
      setSectionFilter((f) => ({ key: f.key + 1 }));
      navigate(route, write);
    },
    [active, exit, navigate],
  );

  const openFromPanorama = useCallback(
    (target: OpenTarget) => {
      exit(`#${target.anchor ?? target.sectionId}`);
      setSectionFilter((f) => ({ filter: target.filter, key: f.key + 1 }));
      navigate({ anchor: target.anchor, sectionId: target.sectionId }, false);
    },
    [exit, navigate],
  );

  const editorEntries = useMemo(() => allEntries(sections), [sections]);
  const entries = useMemo(
    () => (active ? [...panoramaPaletteEntries(), ...editorEntries] : editorEntries),
    [active, editorEntries],
  );

  const jumpChart = (entry: PaletteEntry) => {
    const chart = chartOfAction(entry.action);
    if (chart) open(chart);
    return chart !== undefined;
  };

  return {
    entries,
    go,
    jumpChart,
    modeSwitch: (
      <ModeSwitch
        mode={active ? 'panorama' : 'curriculo'}
        onChange={(mode) => (mode === 'panorama' ? open(panorama.chartId) : go({ sectionId }))}
      />
    ),
    nav: active ? <PanoramaNav activeId={panorama.chartId} onSelect={open} /> : undefined,
    sectionFilter,
    view:
      active && session ? (
        <PanoramaView
          key={session.meta.fileName}
          chartId={panorama.chartId}
          root={session.doc.root}
          sections={sections}
          version={version}
          onOpen={openFromPanorama}
        />
      ) : null,
  };
}
