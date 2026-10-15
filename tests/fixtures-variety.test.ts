import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { childElements, getAttr, walk, type XElement } from '../src/model/xml.ts';
import { buildFacets } from '../src/ui/facets.ts';
import { groupByYear, isListItem } from '../src/ui/item-meta.ts';
import { buildSections, type SectionGroup } from '../src/ui/sections.ts';

// A fixture completa serve também de currículo de exemplo no editor (?exemplo).
// Estes testes garantem que ela continua exercitando a barra de anos e os
// filtros, que só aparecem quando a lista se divide em dois ou mais valores.

const root = async () => {
  const name = 'synthetic_full.xml';
  const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, '../fixtures', name)));
  return (await loadCv(bytes, name)).doc.root;
};

/** Os itens de lista de um grupo, como a SectionView os monta. */
function listItems(g: SectionGroup): XElement[] {
  if (g.elements.length > 1) return g.elements;
  const el = g.elements[0];
  if (!el || el.attrs.length > 0) return [];
  const children = childElements(el).filter((c) => c.attrs.length > 0 || c.children.length > 0);
  return children.length > 0 && children.every(isListItem) ? children : [];
}

/** Data DDMMAAAA de calendário, como número AAAAMMDD para comparar. */
function calendarDate(value: string): number | undefined {
  const m = /^(\d{2})(\d{2})(\d{4})$/.exec(value);
  if (!m) return undefined;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  const real =
    d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
  return real ? year * 10_000 + month * 100 + day : undefined;
}

describe('fixture completa: anos e filtros variados', () => {
  it('grupos com vários itens caem em dois ou mais anos', async () => {
    const sections = buildSections(await root());
    const groups = new Map<string, number>();
    for (const s of sections) {
      for (const g of s.groups) {
        const items = listItems(g);
        if (items.length > 1) groups.set(g.id, groupByYear(items).length);
      }
    }
    for (const id of [
      'formacao/formacao-academica-titulacao',
      'formacao/formacao-complementar',
      'producoes/outras-producoes-bibliograficas',
      'producoes/demais-tipos-de-producao-tecnica',
      'producoes/producao-artistica-cultural',
      'inovacao/producao-com-potencial-de-inovacao',
      'educacao/producao-de-divulgacao-cientifica',
      'eventos/participacao-em-eventos-congressos-exposicoes-e-feiras',
      'orientacoes/orientacoes-em-andamento',
      'orientacoes/orientacoes-concluidas',
      'bancas/participacao-em-bancas-de-trabalhos-de-conclusao',
      'bancas/participacao-em-bancas-julgadoras',
    ]) {
      expect(groups.get(id), id).toBeGreaterThanOrEqual(2);
    }
    // Nenhum grupo de vários itens fica com um ano só.
    for (const [id, years] of groups) expect(years, id).toBeGreaterThanOrEqual(2);
  });

  it('seções de lista ganham filtros além do tipo', async () => {
    const sections = buildSections(await root());
    const facets = (id: string) => {
      const section = sections.find((s) => s.id === id)!;
      // "Faltando" (campos vazios) tem teste próprio em panorama-filters.test.ts.
      return buildFacets(section.groups.flatMap(listItems))
        .filter((f) => f.id !== 'tipo' && f.id !== 'faltando')
        .map((f) => f.label);
    };
    expect(facets('formacao')).toEqual(['Situação', 'Status do curso']);
    expect(facets('producoes')).toEqual(['Meio de divulgação', 'País']);
    expect(facets('eventos')).toEqual(['País', 'Meio de divulgação', 'Tipo de participação']);
    expect(facets('educacao')).toEqual(['Natureza', 'Meio de divulgação', 'País']);
    expect(facets('orientacoes')).toEqual(['Natureza', 'País']);
    expect(facets('bancas')).toEqual(['País']);
  });

  it('datas são de calendário e períodos começam antes de terminar', async () => {
    const problems: string[] = [];
    walk(await root(), (el) => {
      const dates = el.attrs.filter(
        (a) => /(^|-)DATA(-|$)/.test(a.name) && !/^FORMATO/.test(a.name),
      );
      let previous = 0;
      for (const a of dates) {
        const value = calendarDate(a.value);
        if (value === undefined) problems.push(`${el.name}@${a.name}=${a.value}`);
        // Datas do mesmo elemento vêm em ordem (pedido antes da concessão, início antes do fim).
        else if (value < previous) problems.push(`${el.name}@${a.name} antes da data anterior`);
        else previous = value;
      }
      for (const [from, to] of [
        ['ANO-INICIO', 'ANO-FIM'],
        ['ANO-DE-INICIO', 'ANO-DE-CONCLUSAO'],
      ] as const) {
        const start = Number(getAttr(el, from));
        const end = Number(getAttr(el, to));
        if (getAttr(el, from) && getAttr(el, to) && !(start < end))
          problems.push(`${el.name}: ${from}=${start} ${to}=${end}`);
      }
      for (const a of el.attrs.filter((x) => /^MES-/.test(x.name))) {
        const month = Number(a.value);
        if (!(month >= 1 && month <= 12)) problems.push(`${el.name}@${a.name}=${a.value}`);
      }
    });
    expect(problems).toEqual([]);
  });
});
