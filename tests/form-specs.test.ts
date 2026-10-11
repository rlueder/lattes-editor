import { describe, expect, it } from 'vitest';

import { suggestCitation } from '../src/forms/citation.ts';
import { FORM_SPECS, formSpec, missingRequired } from '../src/forms/specs.ts';
import { itemPart, newItem } from '../src/model/production.ts';
import { setAttr } from '../src/model/xml.ts';
import { lattesSchema as schema } from '../src/schema/lattes.ts';

describe('FORM_SPECS', () => {
  it('cada campo existe no schema, na parte indicada do item', () => {
    for (const spec of FORM_SPECS) {
      const item = newItem(schema, spec.itemName, 1);
      for (const set of spec.fieldsets) {
        const part = itemPart(item, set.part);
        expect(part, `${spec.itemName} ${set.part}`).toBeDefined();
        for (const field of set.fields) {
          expect(
            part!.attrs.some((a) => a.name === field.attr),
            `${spec.itemName}: ${part!.name}/@${field.attr}`,
          ).toBe(true);
        }
      }
    }
  });

  it('aponta campos obrigatórios do formulário vazios', () => {
    const spec = formSpec('ARTIGO-PUBLICADO')!;
    const item = newItem(schema, 'ARTIGO-PUBLICADO', 1);
    const partOf = (p: 'DADOS-BASICOS' | 'DETALHAMENTO') => itemPart(item, p);
    expect(missingRequired(spec, partOf).map((m) => m.attr)).toEqual([
      'TITULO-DO-ARTIGO',
      'ANO-DO-ARTIGO',
      'TITULO-DO-PERIODICO-OU-REVISTA',
    ]);
    setAttr(itemPart(item, 'DETALHAMENTO')!, 'TITULO-DO-PERIODICO-OU-REVISTA', 'Revista');
    expect(missingRequired(spec, partOf)).toHaveLength(2);
    expect(missingRequired(spec, () => undefined)).toEqual([]);
    expect(formSpec('SOFTWARE')).toBeUndefined();
  });
});

describe('suggestCitation', () => {
  it('sobrenome em caixa alta e iniciais, sem partículas', () => {
    expect(suggestCitation('Maria da Silva')).toBe('SILVA, M.');
    expect(suggestCitation('João Pedro de Souza')).toBe('SOUZA, J. P.');
    expect(suggestCitation(' Platão ')).toBe('PLATÃO');
  });
});
