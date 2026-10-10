import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { walk, type XElement } from '../src/model/xml.ts';
import { paletteEntries, searchPalette } from '../src/ui/palette-search.ts';
import { buildSections } from '../src/ui/sections.ts';

const fixture = async (name: string) => {
  const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, '../fixtures', name)));
  return (await loadCv(bytes, name)).doc.root;
};

describe('seções', () => {
  it('todo elemento do arquivo aparece em alguma seção', async () => {
    const root = await fixture('synthetic_full.xml');
    const shown = new Set<XElement>();
    for (const s of buildSections(root)) {
      for (const g of s.groups) for (const el of g.elements) walk(el, (n) => shown.add(n));
    }
    const missing: string[] = [];
    walk(root, (el, ancestors) => {
      // Contêineres puramente estruturais (raiz, DADOS-GERAIS etc.) não precisam aparecer sozinhos.
      if (el.attrs.length === 0 && el.children.some((c) => c.kind === 'element')) return;
      if (ancestors.length === 0 || el.name === 'DADOS-GERAIS') return;
      if (!shown.has(el) && !ancestors.some((a) => shown.has(a))) missing.push(el.name);
    });
    expect(missing).toEqual([]);
  });
});

describe('⌘K', () => {
  it('lista seções e grupos, e acha sem acento', async () => {
    const entries = paletteEntries(buildSections(await fixture('synthetic_minimal.xml')));
    expect(searchPalette(entries, 'formacao')[0]?.label).toBe('Formação');
    expect(searchPalette(entries, 'orientacoes')[0]?.sectionId).toBe('orientacoes');
    expect(searchPalette(entries, 'artigos')[0]?.label).toBe('Artigos completos publicados');
  });

  it('casa por iniciais e por subsequência', async () => {
    const entries = paletteEntries(buildSections(await fixture('synthetic_minimal.xml')));
    expect(searchPalette(entries, 'pat reg')[0]?.label).toBe('Patentes e Registros');
    expect(searchPalette(entries, 'bnc').map((e) => e.sectionId)).toContain('bancas');
    expect(searchPalette(entries, 'xyzzy')).toEqual([]);
  });

  it('busca vazia devolve tudo, na ordem do menu', async () => {
    const entries = paletteEntries(buildSections(await fixture('synthetic_minimal.xml')));
    expect(searchPalette(entries, '  ')).toEqual(entries);
    expect(entries[0]?.label).toBe('Dados gerais');
  });
});
