// Os gráficos no ⌘K enquanto o Panorama está aberto.

import type { PaletteEntry } from '../ui/palette-search.ts';
import { CHARTS } from './catalog.ts';

export const PANORAMA_ACTION = 'panorama:';

export function panoramaPaletteEntries(): PaletteEntry[] {
  return CHARTS.map((c) => ({
    action: `${PANORAMA_ACTION}${c.id}`,
    context: 'Panorama',
    importable: false,
    key: `panorama-${c.id}`,
    label: c.label,
    sectionId: '',
  }));
}

/** O gráfico pedido por uma ação do ⌘K, ou undefined se a ação é de outra coisa. */
export function chartOfAction(action: string | undefined): string | undefined {
  return action?.startsWith(PANORAMA_ACTION) ? action.slice(PANORAMA_ACTION.length) : undefined;
}
