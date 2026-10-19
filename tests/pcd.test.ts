import { describe, expect, it } from 'vitest';

import type { FormControl } from '../src/bridge/form.ts';
import { pcdChecked, withPcd } from '../src/bridge/pcd.ts';

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
