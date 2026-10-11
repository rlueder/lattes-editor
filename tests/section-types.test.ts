import { describe, expect, it } from 'vitest';

import { lattesSchema as schema } from '../src/schema/lattes.ts';
import { EMPTY_NOTES, typesForSection } from '../src/ui/section-types.ts';

describe('typesForSection', () => {
  it('seções que recebem itens: tipos dos módulos do Passo 2', () => {
    expect(typesForSection(schema, 'bancas').map((t) => t.module.id)).toEqual(
      expect.arrayContaining(['bancas']),
    );
    expect(typesForSection(schema, 'bancas').every((t) => t.module.id === 'bancas')).toBe(true);
    expect(typesForSection(schema, 'orientacoes').length).toBeGreaterThan(5);
    expect(typesForSection(schema, 'producoes')[0]?.itemName).toBe('TRABALHO-EM-EVENTOS');
  });

  it('seções que o Importar não preenche: nenhum tipo, com nota', () => {
    for (const id of ['patentes', 'projetos', 'inovacao', 'educacao', 'formacao', 'atuacao']) {
      expect(typesForSection(schema, id)).toEqual([]);
      expect(EMPTY_NOTES[id]).toBeTruthy();
    }
  });
});
