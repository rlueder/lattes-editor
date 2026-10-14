import { describe, expect, it } from 'vitest';

import { searchPalette } from '../src/ui/palette-search.ts';
import { effectiveQuery, MIN_QUERY } from '../src/ui/query.ts';

describe('busca a partir de 3 caracteres', () => {
  it('menos de 3 caracteres não conta; espaços nas pontas não contam', () => {
    expect(MIN_QUERY).toBe(3);
    expect(effectiveQuery('')).toBe('');
    expect(effectiveQuery('ab')).toBe('');
    expect(effectiveQuery('  ab  ')).toBe('');
    expect(effectiveQuery(' abc ')).toBe('abc');
  });

  it('a paleta mostra tudo até o terceiro caractere', () => {
    const entries = [
      { key: 'a', label: 'Formação' },
      { key: 'b', label: 'Bancas' },
    ] as Parameters<typeof searchPalette>[0];
    expect(searchPalette(entries, 'fo')).toHaveLength(2);
    expect(searchPalette(entries, 'for').map((e) => e.key)).toEqual(['a']);
  });
});
