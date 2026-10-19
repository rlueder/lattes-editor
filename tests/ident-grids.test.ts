import { describe, expect, it } from 'vitest';

import { identGrids, orcidCut } from '../src/bridge/ident-grids.ts';

describe('identificação: os campos que o check() monta', () => {
  it('grade do ORCID vazia vira <root></root >, como a página manda', () => {
    expect(
      identGrids(
        '<script>var provider2 = [{}];\nvar providerDetNmeCit =\n[{"l":"LÜDER, Rafael","c":"LÜDER, Rafael"},{}];</script>',
      ),
    ).toEqual({
      f_dados_grid: '<root></root >',
      f_nome_citacao: 'LÜDER, Rafael',
    });
  });

  it('nomes em citação sem espaço em volta do ; e sem repetidos', () => {
    const html =
      '<script>var provider2 = [{}]; var providerDetNmeCit = [{"l":"A, B "},{"l":" C, D"},{"l":"A, B"},{}];</script>';
    expect(identGrids(html)?.f_nome_citacao).toBe('A, B;C, D');
  });

  it('o recorte do endereço do ORCID segue a página passo a passo', () => {
    // Sem aspas no XML, o indexOf('"') dá -1 e o endereço fica vazio, como na página.
    expect(
      orcidCut('<root><item>\n\t<endereco>https://orcid.org/0000</endereco>\n</item >\n</root >'),
    ).toBe('<root><item>\n\t<endereco></endereco>\n</item >\n</root >');
    expect(identGrids('<p>sem grades</p>')).toBeUndefined();
  });
});
