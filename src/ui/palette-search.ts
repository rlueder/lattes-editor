// Busca do ⌘K: ignora acentos e caixa, e ordena por qualidade do casamento.

import { FORM_SPECS } from '../forms/specs.ts';
import { fold } from '../labels/labels.ts';
import { countItems, type Section } from './sections.ts';

export interface PaletteEntry {
  /** Ação em vez de navegação (novo item, gerar importação). */
  action?: string;
  /** Âncora do grupo dentro da seção; undefined leva ao topo da seção. */
  anchorId?: string;
  /** Seção a que o grupo pertence; vazio para a própria seção. */
  context: string;
  count?: number;
  importable: Section['importable'];
  key: string;
  label: string;
  sectionId: string;
}

export function paletteEntries(sections: Section[]): PaletteEntry[] {
  return sections.flatMap((s) => [
    { context: '', importable: s.importable, key: s.id, label: s.label, sectionId: s.id },
    ...s.groups.map((g) => ({
      anchorId: g.id,
      context: s.label,
      count: countItems(g),
      importable: s.importable,
      key: g.id,
      label: g.label,
      sectionId: s.id,
    })),
  ]);
}

/** Pontua o casamento de `query` em `text` (já dobrados); 0 = não casa. */
function score(text: string, query: string): number {
  if (text.startsWith(query)) return 100 - text.length / 100;
  const words = text.split(/[^a-z0-9&]+/);
  if (words.some((w) => w.startsWith(query))) return 80 - text.length / 100;
  if (text.includes(query)) return 60 - text.indexOf(query) / 10;
  // Iniciais de cada palavra ("pat r" ou "pr" para "Patentes e Registros").
  const parts = query.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => words.some((w) => w.startsWith(p)))) return 50;
  // Subsequência: as letras da busca aparecem em ordem.
  let i = 0;
  for (const ch of text) if (ch === query[i]) i++;
  return i === query.length ? 20 : 0;
}

export function searchPalette(entries: PaletteEntry[], query: string): PaletteEntry[] {
  const q = fold(query.trim());
  if (!q) return entries;
  return entries
    .map((e, index) => {
      const own = score(fold(e.label), q);
      const withContext = e.context ? score(fold(`${e.context} ${e.label}`), q) * 0.9 : 0;
      return { e, index, s: Math.max(own, withContext) };
    })
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map((r) => r.e);
}

const action = (id: string, label: string, context: string): PaletteEntry => ({
  action: id,
  context,
  importable: true,
  key: `acao-${id}`,
  label,
  sectionId: '',
});

/** Ações do ⌘K: criar itens dos tipos mais usados e gerar a importação. */
export function paletteActions(): PaletteEntry[] {
  return [
    ...FORM_SPECS.map((f) => action(`novo:${f.itemName}`, f.title, 'Novo')),
    action('novo', 'Outro tipo de item…', 'Novo'),
    action('exportar', 'Importar no Lattes (gerar o XML)', ''),
  ];
}
