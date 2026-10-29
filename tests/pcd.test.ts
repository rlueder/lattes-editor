import { describe, expect, it } from 'vitest';

import { pcdTypes } from '../src/bridge/dados-gerais-edit.ts';
import type { FormControl } from '../src/bridge/form.ts';
import { pcdChecked, pcdExportOrder, pcdOrder, withPcd } from '../src/bridge/pcd.ts';
import { PCD_EXPORT_ORDER, typedChoices } from '../src/schema/typed-choices.ts';

describe('pessoa com deficiência no formulário de identificação', () => {
  it('o DUMMY e os tipos no lugar do primeiro f_pcd, como o navegador manda', () => {
    const pairs: [string, string][] = [
      ['f_pcd_r', 'N'],
      ['f_pcd', 'DUMMY'],
      ['f_priv_pcd', '1'],
    ];
    expect(withPcd(pairs, ['V'])).toEqual([
      ['f_pcd_r', 'N'],
      ['f_pcd', 'DUMMY'],
      ['f_pcd', 'V'],
      ['f_priv_pcd', '1'],
    ]);
    expect(
      withPcd(
        [
          ['f_pcd', 'DUMMY'],
          ['f_pcd', 'A'],
        ],
        [],
      ),
    ).toEqual([['f_pcd', 'DUMMY']]);
    expect(withPcd([['f_x', '1']], ['F', 'V'])).toEqual([
      ['f_x', '1'],
      ['f_pcd', 'DUMMY'],
      ['f_pcd', 'F'],
      ['f_pcd', 'V'],
    ]);
  });

  it('lê as caixas marcadas, sem o oculto', () => {
    const c = (value: string, type: string, checked = false): FormControl => ({
      checked,
      name: 'f_pcd',
      type,
      value,
    });
    expect(
      pcdChecked([c('DUMMY', 'hidden'), c('A', 'checkbox'), c('V', 'checkbox', true)]),
    ).toEqual(['V']);
  });
});

describe('a ordem dos tipos de deficiência', () => {
  it('a página manda na ordem das caixas; a exportação junta pelo código', () => {
    const all = ['M', 'E', 'V', 'I', 'F', 'A'];
    expect(pcdOrder(all)).toEqual(['A', 'F', 'I', 'V', 'E', 'M']);
    expect(pcdExportOrder(all)).toEqual(['A', 'E', 'F', 'I', 'M', 'V']);
  });

  it('a ordem de rótulos do editor é a da exportação, e cada rótulo é uma caixa', () => {
    expect(pcdTypes(PCD_EXPORT_ORDER.join(', '))).toEqual(['A', 'F', 'I', 'V', 'E', 'M']);
    expect(PCD_EXPORT_ORDER.map((l) => pcdTypes(l)![0])).toEqual(['A', 'E', 'F', 'I', 'M', 'V']);
    const el = { attrs: [], children: [], name: 'DADOS-GERAIS' } as never;
    expect(
      typedChoices(el, 'PCD')!
        .map((c) => c.value)
        .sort(),
    ).toEqual([...PCD_EXPORT_ORDER].sort());
  });
});
