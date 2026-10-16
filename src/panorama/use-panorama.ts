// Em que modo o app está (Currículo ou Panorama) e qual gráfico está aberto,
// em sincronia com a URL: cada troca vira uma entrada do histórico, para o
// voltar do navegador funcionar.

import { useCallback, useEffect, useRef, useState } from 'react';

import { pushHash, replaceHash } from '../ui/history-nav.ts';
import { DEFAULT_CHART } from './catalog.ts';
import { panoramaHash, parsePanoramaHash } from './route.ts';

export interface PanoramaMode {
  active: boolean;
  chartId: string;
  /** Volta ao currículo, para o hash dado ("#producoes"). */
  exit: (hash: string) => void;
  open: (chartId: string) => void;
}

export function usePanorama(): PanoramaMode {
  const [chart, setChart] = useState(() => parsePanoramaHash(location.hash));
  const last = useRef(chart ?? DEFAULT_CHART);
  if (chart) last.current = chart;

  useEffect(() => {
    const sync = () => {
      const id = parsePanoramaHash(location.hash);
      // Endereço antigo ou desconhecido: a URL passa a dizer o gráfico aberto.
      if (id && location.hash !== panoramaHash(id)) replaceHash(panoramaHash(id));
      setChart(id);
    };
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const open = useCallback((id: string) => {
    const hash = panoramaHash(id);
    if (location.hash !== hash) pushHash(hash);
    setChart(parsePanoramaHash(hash));
    window.scrollTo({ top: 0 });
  }, []);

  const exit = useCallback((hash: string) => {
    if (location.hash !== hash) pushHash(hash);
    setChart(undefined);
  }, []);

  return { active: chart !== undefined, chartId: chart ?? last.current, exit, open };
}
