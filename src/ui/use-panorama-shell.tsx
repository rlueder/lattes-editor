// A ligação entre o editor e o Panorama: o controle de modo e o menu dos
// gráficos na barra lateral, o gráfico no lugar da seção, os gráficos no ⌘K
// e o clique que volta ao currículo com a seção filtrada. Tudo do Panorama
// entra por src/panorama/index.ts.

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

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
import { type HashRoute, parseHash } from './hash-route.ts';
import { allEntries, type PaletteEntry } from './palette-search.ts';
import {
  afterHashChange,
  clearFilter,
  initialFilterFor,
  NO_REQUEST,
  requestFilter,
  type SectionFilterRequest,
} from './section-filter.ts';
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
  /** Filtro com que a seção abre (só a do clique no Panorama); undefined nas outras. */
  initialFilter: (sectionId: string | undefined) => FilterState | undefined;
  /** Trata a ação do ⌘K se ela for um gráfico; devolve se tratou. */
  jumpChart: (entry: PaletteEntry) => boolean;
  modeSwitch: ReactNode;
  nav?: ReactNode;
  /** Muda a cada navegação, para a seção remontar com o filtro certo. */
  sectionKey: number;
  /** O gráfico aberto, no lugar da seção; null no modo Currículo. */
  view: ReactNode;
}

// Uma chave por documento carregado: um novo arquivo, uma nova exportação do
// Lattes ou uma volta no histórico trocam a raiz, e o Panorama recomeça os
// filtros e a seleção, que apontavam para os elementos da raiz anterior.
const docKeys = new WeakMap<object, string>();
let nextDocKey = 0;
function docKey(root: object): string {
  let key = docKeys.get(root);
  if (!key) {
    key = `doc-${++nextDocKey}`;
    docKeys.set(root, key);
  }
  return key;
}

export function usePanoramaShell({
  navigate,
  sectionId,
  sections,
  session,
  version,
}: Args): PanoramaShell {
  const panorama = usePanorama();
  const [sectionFilter, setSectionFilter] = useState<SectionFilterRequest>(NO_REQUEST);

  // Voltar, avançar ou um endereço digitado levam a outra seção sem o filtro do clique.
  useEffect(() => {
    const onHash = () =>
      setSectionFilter((r) => afterHashChange(r, parseHash(location.hash)?.sectionId));
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onHash);
    };
  }, []);
  const { active, exit, open } = panorama;

  const go = useCallback(
    (route: HashRoute, write = true) => {
      if (active) exit(`#${route.anchor ?? route.sectionId}`);
      setSectionFilter(clearFilter);
      navigate(route, write);
    },
    [active, exit, navigate],
  );

  const openFromPanorama = useCallback(
    (target: OpenTarget) => {
      exit(`#${target.anchor ?? target.sectionId}`);
      setSectionFilter((r) => requestFilter(r, target.sectionId, target.filter));
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
    initialFilter: (id) => initialFilterFor(sectionFilter, id),
    jumpChart,
    modeSwitch: (
      <ModeSwitch
        mode={active ? 'panorama' : 'curriculo'}
        onChange={(mode) => (mode === 'panorama' ? open(panorama.chartId) : go({ sectionId }))}
      />
    ),
    nav: active ? <PanoramaNav activeId={panorama.chartId} onSelect={open} /> : undefined,
    sectionKey: sectionFilter.key,
    view:
      active && session ? (
        <PanoramaView
          key={docKey(session.doc.root)}
          chartId={panorama.chartId}
          root={session.doc.root}
          sections={sections}
          version={version}
          onOpen={openFromPanorama}
        />
      ) : null,
  };
}
