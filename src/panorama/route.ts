// O Panorama na URL: "#panorama" abre o primeiro gráfico, "#panorama/temas"
// abre um gráfico. Recarregar e voltar no navegador caem no mesmo lugar.

import { chartById } from './catalog.ts';

export const PANORAMA_ROUTE = 'panorama';

/** Gráficos que viraram parte de outro: o endereço antigo leva ao novo. */
const MOVED: Record<string, string> = { 'orientacoes-e-bancas': 'pessoas' };

/** O id do gráfico se o hash aponta o Panorama; undefined para as seções do currículo. */
export function parsePanoramaHash(hash: string): string | undefined {
  let path = hash.replace(/^#/, '');
  try {
    path = decodeURIComponent(path);
  } catch {
    return undefined;
  }
  const [head, chart] = path.split('/').filter(Boolean);
  if (head !== PANORAMA_ROUTE) return undefined;
  return chartById(chart && (MOVED[chart] ?? chart)).id;
}

export function panoramaHash(chartId: string): string {
  return `#${PANORAMA_ROUTE}/${chartById(chartId).id}`;
}
