// Os doadores da passada de itens de teste só dos tipos pedidos: o pacote de
// cada caminho decide que listas a leitura abre.
import { expect, it } from 'vitest';

import { packageOf } from '../extension/src/censo-test-donors.ts';

it('o pacote de um caminho do Lattes, sem caixa e sem a query', () => {
  expect(packageOf('PKG_BANCA_TRAB.form')).toBe('pkg_banca_trab');
  expect(packageOf('pkg_orient.lista?f_tipo=C&f_cod=X')).toBe('pkg_orient');
  expect(packageOf('prc_bib_outraprod?f_cod=X')).toBe('prc_bib_outraprod');
});
