// A parte do item que sai do formulário quando nenhum campo dela existe no
// formulário do Lattes (src/ui/ElementView.tsx).

import { describe, expect, it } from 'vitest';

import { element } from '../src/model/xml.ts';
import type { FormLacks } from '../src/ui/form-lacks-context.ts';
import { offLattesForm } from '../src/ui/off-lattes-form.ts';

const lacking = (attrs: string[]): FormLacks => ({
  child: () => undefined,
  field: (_el, attr) => (attrs.includes(attr) ? 'não tem' : undefined),
});

describe('parte fora do formulário do Lattes', () => {
  const part = element('PARTICIPANTE-DE-EVENTOS-CONGRESSOS', {
    'NOME-COMPLETO-DO-PARTICIPANTE-DE-EVENTOS-CONGRESSOS': 'Pessoa',
    'NOME-PARA-CITACAO-DO-PARTICIPANTE-DE-EVENTOS-CONGRESSOS': 'P.',
    'ORDEM-PARTICIPANTE': '1',
  });
  const all = Object.keys(Object.fromEntries(part.attrs.map((a) => [a.name, 1])));

  it('sai quando nenhum campo existe lá, e fica quando um existe', () => {
    expect(offLattesForm(part, lacking(all), false)).toBe(true);
    expect(offLattesForm(part, lacking(all.slice(1)), false)).toBe(false);
    expect(offLattesForm(part, undefined, false)).toBe(false);
  });

  it('o código do Lattes escondido não segura a parte', () => {
    const withCode = element('AUTORES', { 'NOME-COMPLETO-DO-AUTOR': 'Pessoa', 'NRO-ID-CNPQ': '1' });
    const lacks = lacking(['NOME-COMPLETO-DO-AUTOR']);
    expect(offLattesForm(withCode, lacks, false)).toBe(true);
    expect(offLattesForm(withCode, lacks, true)).toBe(false);
  });
});
