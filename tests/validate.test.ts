import { describe, expect, it } from 'vitest';

import { newItem, setAuthors } from '../src/model/production.ts';
import { problemPlace, validateItem } from '../src/model/validate.ts';
import { firstChild, setAttr } from '../src/model/xml.ts';
import { lattesSchema as schema } from '../src/schema/lattes.ts';

const TODAY = new Date(2026, 9, 11);

function validPaper() {
  const item = newItem(schema, 'TRABALHO-EM-EVENTOS', 33);
  const basics = firstChild(item, 'DADOS-BASICOS-DO-TRABALHO')!;
  setAttr(basics, 'NATUREZA', 'COMPLETO');
  setAttr(basics, 'TITULO-DO-TRABALHO', 'Um trabalho');
  setAttr(basics, 'ANO-DO-TRABALHO', '2025');
  setAttr(basics, 'MEIO-DE-DIVULGACAO', 'MEIO_DIGITAL');
  const detail = firstChild(item, 'DETALHAMENTO-DO-TRABALHO')!;
  setAttr(detail, 'CLASSIFICACAO-DO-EVENTO', 'NACIONAL');
  setAuthors(schema, item, [
    { citation: 'TESTE, P.', lattesId: '0000000000000001', name: 'Pessoa' },
  ]);
  return item;
}

describe('validateItem', () => {
  it('item completo passa', () => {
    expect(validateItem(schema, validPaper(), TODAY)).toEqual([]);
  });

  it('aponta enum vazio, título, ano, autoria e DOI', () => {
    const item = newItem(schema, 'TRABALHO-EM-EVENTOS', 33);
    const messages = validateItem(schema, item, TODAY).map((p) => p.message);
    expect(messages).toContain('Natureza: escolha uma opção');
    expect(messages).toContain('Título: obrigatório');
    expect(messages).toContain('Ano: obrigatório');
    expect(messages).toContain('Inclua ao menos um autor');
  });

  it('valor fora do enum, ano fora do intervalo, ID e DOI malformados', () => {
    const item = validPaper();
    const basics = firstChild(item, 'DADOS-BASICOS-DO-TRABALHO')!;
    setAttr(basics, 'NATUREZA', 'OUTRA_COISA');
    setAttr(basics, 'ANO-DO-TRABALHO', '3020');
    setAttr(basics, 'DOI', 'doi:abc');
    setAuthors(schema, item, [{ citation: '', lattesId: '123', name: ' ' }]);
    const problems = validateItem(schema, item, TODAY);
    expect(problems.map((p) => p.message)).toEqual([
      'Natureza: valor "OUTRA_COISA" não é aceito',
      'Ano do trabalho: ano inválido',
      'Autor 1: nome obrigatório',
      'Autor 1: ID Lattes tem 16 dígitos',
      'DOI: formato esperado 10.xxxx/…',
    ]);
    expect(problemPlace(problems[0]!)).toBe('Dados básicos do trabalho');
  });

  it('atributo obrigatório vazio e item sem autoria no schema', () => {
    const item = newItem(schema, 'ORIENTACOES-CONCLUIDAS-PARA-MESTRADO', 40);
    expect(
      validateItem(schema, item, TODAY).some((p) => p.message === 'Inclua ao menos um autor'),
    ).toBe(false);
    const root = {
      attrs: [{ name: 'SISTEMA-ORIGEM-XML', value: '' }],
      children: [],
      kind: 'element' as const,
      name: 'CURRICULO-VITAE',
      selfClosing: true,
    };
    expect(validateItem(schema, root, TODAY).map((p) => p.message)).toEqual([
      'Sistema origem XML: obrigatório',
    ]);
  });
});
