// O censo versionado contra o editor (LAT-55). Reprova quando uma captura em
// docs/lattes-formularios/ mostra uma divergência nova (lista do Lattes que o
// editor não oferece, lista com opções diferentes, ordem diferente de
// form-order.ts) ou quando o relatório não foi refeito depois de uma captura.
// Sem captura, nada reprova: o relatório só lista as lacunas.

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  buildReport,
  loadAccepted,
  loadCensusFiles,
  loadFormSlot,
  REPORT_PATH,
} from '../scripts/censo-relatorio.ts';
import { compareWithAccepted, coverage } from '../src/census/report.ts';
import { buildPath, isSafeGet } from '../src/census/run.ts';
import { CENSUS_TARGETS } from '../src/census/targets-production.ts';
import { lattesSchema } from '../src/schema/lattes.ts';

const files = loadCensusFiles();

describe('censo: as entradas', () => {
  it('ids únicos, elementos do schema e caminhos que só leem', () => {
    const ids = CENSUS_TARGETS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of CENSUS_TARGETS) {
      for (const e of t.elements) expect(lattesSchema.elements[e], `${t.id}: ${e}`).toBeDefined();
      if (t.locate.kind === 'fixed') {
        expect(isSafeGet(buildPath('K000000000', t.locate)), t.id).toBe(true);
        expect(Object.keys(t.locate.params).map((k) => k.toLowerCase())).not.toContain('f_cod');
      }
      if (t.locate.kind !== 'fixed' && t.locate.kind !== 'menu') {
        expect(t.provenance === 'inferido' || t.id === 'vinculo', t.id).toBe(true);
      }
    }
  });
});

describe('censo versionado (docs/lattes-formularios/)', () => {
  it('as capturas não trazem código de currículo, identificador nem e-mail', () => {
    for (const file of files) {
      const text = JSON.stringify(file);
      expect(file.format).toBe(1);
      expect(text).not.toMatch(/f_cod=[A-Z][0-9A-Z]{9}(?![0-9A-Z])/);
      expect(text).not.toMatch(/\d{16}/);
      expect(text).not.toMatch(/[\w.-]+@[\w-]+\.[\w.]+/);
      for (const e of file.entries)
        expect(
          CENSUS_TARGETS.some((t) => t.id === e.id),
          e.id,
        ).toBe(true);
    }
  });

  it('nenhuma divergência nova entre o Lattes capturado e o editor', async () => {
    const cov = coverage({ files, formSlot: await loadFormSlot(), targets: CENSUS_TARGETS });
    const { fresh, resolved } = compareWithAccepted(
      cov.disagreements,
      loadAccepted().map((a) => a.key),
    );
    const missing = CENSUS_TARGETS.filter((t) => !cov.captured.has(t.id)).length;
    if (missing) {
      console.info(
        `censo: ${missing} de ${CENSUS_TARGETS.length} formulários sem captura (lacunas em docs/lattes-formularios/relatorio.md)`,
      );
    }
    expect(
      fresh.map((d) => d.detail),
      'divergências novas: corrigir o editor, ou aceitar com pnpm censo:relatorio --aceitar',
    ).toEqual([]);
    expect(
      resolved,
      'resolvidas: tirar de pendencias.json (pnpm censo:relatorio --aceitar)',
    ).toEqual([]);
  });

  it('cada divergência aceita diz por quê', () => {
    for (const a of loadAccepted()) expect(a.reason, a.key).not.toMatch(/^(a escrever)?$/);
  });

  it('o relatório está em dia com as capturas', async () => {
    const { text } = await buildReport();
    expect(readFileSync(REPORT_PATH, 'utf8'), 'refazer com pnpm censo:relatorio').toBe(text);
  });
});
