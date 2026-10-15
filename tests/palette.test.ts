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

describe('Outros dados', () => {
  it('só recolhe o que nenhuma seção mostra', async () => {
    const sections = buildSections(await fixture('synthetic_full.xml'));
    const outros = sections.find((s) => s.id === 'outros')!;
    expect(outros.groups.map((g) => g.elements[0]!.name)).toEqual([
      'INFORMACOES-ADICIONAIS-INSTITUICOES',
      'INFORMACOES-ADICIONAIS-CURSOS',
    ]);
    const producoes = sections.find((s) => s.id === 'producoes')!;
    expect(producoes.groups.map((g) => g.label)).toContain('Capítulos de livros publicados');
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

describe('⌘K: ações de novo item', () => {
  it('ficam sob o título "Novo item", em ordem alfabética', async () => {
    const { paletteActions } = await import('../src/ui/palette-search.ts');
    const actions = paletteActions();
    const header = actions.findIndex((a) => a.action === 'novo');
    const types = actions.filter((a) => a.context === 'Novo item').map((a) => a.label);
    expect(actions[header]).toMatchObject({ context: '', label: 'Novo item' });
    expect(actions.slice(header + 1, header + 1 + types.length).map((a) => a.label)).toEqual(types);
    expect(types).toEqual([...types].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    expect(types.length).toBeGreaterThan(1);
  });

  it('só criar item: enviar, diagnóstico, versões e modo foco ficam no cabeçalho e no ⚙', async () => {
    const { paletteActions } = await import('../src/ui/palette-search.ts');
    const ids = paletteActions().map((a) => a.action);
    expect(ids.every((id) => id === 'novo' || id?.startsWith('novo:'))).toBe(true);
  });
});
