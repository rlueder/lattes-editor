// O número no selo do menu lateral (navCount, src/ui/sections.ts): os
// registros que a página mostra, a partir de um; Dados gerais sem selo.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { walk, type XElement } from '../src/model/xml.ts';
import { buildSections, navCount } from '../src/ui/sections.ts';

async function demo(): Promise<XElement> {
  const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, '../fixtures/demo.xml')));
  return (await loadCv(bytes, 'demo.xml')).doc.root;
}

const counts = (root: XElement) =>
  Object.fromEntries(buildSections(root).map((s) => [s.id, navCount(s)]));

describe('selo do menu lateral', () => {
  it('conta os registros de cada seção, inclusive um só (Projetos)', async () => {
    const c = counts(await demo());
    expect(c.projetos).toBe(1);
    expect(c.formacao).toBe(4);
    expect(c.atuacao).toBe(2);
    expect(c.producoes).toBe(10);
    expect(c['dados-gerais']).toBe(0);
    expect(c.inovacao).toBe(0);
  });

  it('acompanha o documento: sem o projeto, Projetos volta a zero', async () => {
    const root = await demo();
    walk(root, (el) => {
      el.children = el.children.filter(
        (c) => c.kind !== 'element' || c.name !== 'PROJETO-DE-PESQUISA',
      );
    });
    expect(counts(root).projetos).toBe(0);
  });
});
