import { describe, expect, it } from 'vitest';

import { foldText, rankOptions } from '../src/ui/option-filter.ts';

const opt = (label: string, value = label) => ({ label, value });
const countries = [
  opt('(escolha)', ''),
  opt('Brasil'),
  opt('Alemanha'),
  opt('Bósnia'),
  opt('São Tomé E Príncipe'),
  opt('Belarus'),
];
const ufs = [opt('', ''), opt('RJ'), opt('RS'), opt('SP')];
const labels = (xs: { label: string }[]) => xs.map((x) => x.label);

describe('listas digitáveis: filtro', () => {
  it('sem acento nem diferença de maiúsculas', () => {
    expect(foldText('  São Tomé ')).toBe('sao tome');
    expect(labels(rankOptions(countries, 'BOS'))).toEqual(['Bósnia']);
    expect(labels(rankOptions(countries, 'sao to'))).toEqual(['São Tomé E Príncipe']);
  });

  it('desde o primeiro caractere, quem começa antes de quem contém', () => {
    expect(labels(rankOptions(countries, 'b'))).toEqual(['Brasil', 'Bósnia', 'Belarus']);
    expect(labels(rankOptions(countries, 'a'))).toEqual([
      'Alemanha',
      'Brasil',
      'Bósnia',
      'São Tomé E Príncipe',
      'Belarus',
    ]);
  });

  it('código curto, como a UF', () => {
    expect(labels(rankOptions(ufs, 'rs'))).toEqual(['RS']);
    expect(labels(rankOptions([opt('Impresso', 'IMPRESSO'), opt('Web', 'WEB')], 'we'))).toEqual([
      'Web',
    ]);
  });

  it('sem texto mostra tudo, com a opção vazia; com texto, ela some', () => {
    expect(rankOptions(countries, '')).toEqual(countries);
    expect(rankOptions(countries, '   ')).toEqual(countries);
    expect(labels(rankOptions(countries, 'e'))).not.toContain('(escolha)');
  });

  it('nada casa: lista vazia', () => {
    expect(rankOptions(countries, 'xyz')).toEqual([]);
  });
});
