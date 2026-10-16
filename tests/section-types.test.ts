import { describe, expect, it } from 'vitest';

import { lattesSchema as schema } from '../src/schema/lattes.ts';
import { EMPTY_NOTES, NEW_GENERAL_LABELS, typesForSection } from '../src/ui/section-types.ts';

describe('typesForSection', () => {
  it('seções que recebem itens: tipos dos módulos do Passo 2', () => {
    expect(typesForSection(schema, 'bancas').map((t) => t.module.id)).toEqual(
      expect.arrayContaining(['bancas']),
    );
    expect(typesForSection(schema, 'bancas').every((t) => t.module.id === 'bancas')).toBe(true);
    expect(typesForSection(schema, 'orientacoes').length).toBeGreaterThan(5);
    expect(typesForSection(schema, 'producoes')[0]?.itemName).toBe('TRABALHO-EM-EVENTOS');
  });

  it('seções que o Importar não preenche: nenhum tipo; nota só onde explica algo', () => {
    for (const id of ['patentes', 'projetos', 'inovacao', 'educacao', 'formacao', 'atuacao']) {
      expect(typesForSection(schema, id)).toEqual([]);
    }
    for (const id of ['patentes', 'projetos', 'inovacao', 'educacao']) {
      expect(EMPTY_NOTES[id]).toBeTruthy();
    }
    // Sem a frase de que o item novo vai por "Enviar ao Lattes": nota vazia some.
    expect(EMPTY_NOTES.formacao).toBeUndefined();
    expect(EMPTY_NOTES.atuacao).toBeUndefined();
    expect(EMPTY_NOTES.projetos).toBe('Projetos ficam dentro de uma atuação profissional.');
  });

  it('Patentes cria todos os registros: sem o aviso de "só a patente"', () => {
    expect(EMPTY_NOTES.patentes).not.toMatch(/só a patente|ainda não/);
    expect(EMPTY_NOTES.patentes).not.toMatch(/Enviar ao Lattes/);
    expect(NEW_GENERAL_LABELS.patentes).toBe('Nova patente ou registro');
  });
});
