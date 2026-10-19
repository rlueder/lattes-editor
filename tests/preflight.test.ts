import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { preflight } from '../src/ui/preflight.ts';
import { buildSections } from '../src/ui/sections.ts';

describe('conferência antes de publicar (LAT-54)', () => {
  it('conta os achados do diagnóstico, e só com o painel aberto', async () => {
    const bytes = new Uint8Array(readFileSync(new URL('../fixtures/demo.xml', import.meta.url)));
    const { doc } = await loadCv(bytes, 'demo.xml');
    const sections = buildSections(doc.root);
    const onOpen = vi.fn();
    expect(preflight(false, sections, onOpen)).toBeUndefined();
    const checks = preflight(doc.root, sections, onOpen);
    // Os três eventos da demonstração sem participantes.
    expect(checks?.count).toBe(3);
    checks?.onOpen();
    expect(onOpen).toHaveBeenCalled();
  });
});
