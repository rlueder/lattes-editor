// O inventário da inclusão (LAT-57) contra o código: docs/inclusao_por_tipo.md
// lista cada tipo de item de lista com o caminho de hoje, e este teste reprova
// quando o documento e o código (ou a captura mais recente do censo) discordam.

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadCensusFiles } from '../scripts/censo-relatorio.ts';
import {
  createRoute,
  editorCreates,
  inventoryRow,
  listItemElements,
  partOf,
} from '../src/bridge/create-inventory.ts';
import { CONNECTOR_CREATES } from '../src/bridge/create-items.ts';
import { isOp, planChange } from '../src/bridge/plan.ts';
import type { Change } from '../src/model/changes.ts';
import { element, type XElement } from '../src/model/xml.ts';
import { lattesSchema as schema } from '../src/schema/lattes.ts';

const DOC = readFileSync(new URL('../docs/inclusao_por_tipo.md', import.meta.url), 'utf8');
const census = loadCensusFiles().at(-1);

/** As linhas das tabelas cujo primeiro campo é um elemento: células sem o rótulo. */
function docRows(): Map<string, string[]> {
  const rows = new Map<string, string[]>();
  for (const line of DOC.split('\n')) {
    if (!line.startsWith('| `')) continue;
    const cells = line
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim());
    const [el, , ...rest] = cells;
    rows.set(el!, [el!, ...rest]);
  }
  return rows;
}

/** A cadeia de elementos vazios da raiz até um item, pelo primeiro pai do schema. */
function chainTo(name: string): XElement[] {
  const parent = new Map<string, string>();
  for (const [n, spec] of Object.entries(schema.elements)) {
    for (const c of spec.children) if (!parent.has(c.name)) parent.set(c.name, n);
  }
  const names = [name];
  for (let p = parent.get(name); p; p = parent.get(p)) names.unshift(p);
  return names.map((n) => element(n));
}

const novo = (name: string): Change => ({
  element: name,
  fields: [],
  form: name,
  key: `novo:${name}`,
  kind: 'novo',
  path: [name],
});

describe('inventário da inclusão (docs/inclusao_por_tipo.md)', () => {
  it('lista cada tipo de item de lista do schema uma vez', () => {
    const rows = docRows();
    const expected = listItemElements(schema).map((n) => `\`${n}\``);
    expect([...rows.keys()].sort()).toEqual(expected.sort());
  });

  it('cada linha diz o que o código e a captura mais recente dizem', () => {
    const rows = docRows();
    for (const name of listItemElements(schema)) {
      expect(rows.get(`\`${name}\``), name).toEqual(inventoryRow(schema, name, census));
    }
  });

  it('o resumo conta os tipos por caminho', () => {
    const names = listItemElements(schema);
    for (const route of ['conector', 'importar', 'nenhum'] as const) {
      const of = names.filter((n) => createRoute(schema, n) === route);
      const created = of.filter((n) => editorCreates(schema, n));
      const line = new RegExp(`\\| ${route}\\s+\\|\\s+(\\d+) \\|\\s+(\\d+) \\|`).exec(DOC);
      expect(line?.slice(1).map(Number), route).toEqual([of.length, created.length]);
    }
    const parts = names.filter((n) => partOf(schema, n)).length;
    expect(DOC).toContain(`São ${names.length} tipos. ${names.length - parts} são itens`);
  });
});

describe('o caminho "conector" é o que o planejamento faz', () => {
  it('só os tipos de CONNECTOR_CREATES viram inclusão; os outros nunca', () => {
    for (const name of listItemElements(schema)) {
      const planned = planChange(novo(name), chainTo(name), name, { createItems: true });
      if (CONNECTOR_CREATES.has(name)) {
        // Um item vazio não passa das travas, mas o motivo é da operação de inclusão.
        expect(isOp(planned) || !/não suportado ainda/.test(planned.reason), name).toBe(true);
      } else {
        expect(isOp(planned) && planned.kind.startsWith('criar-'), name).toBe(false);
      }
    }
  });
});
