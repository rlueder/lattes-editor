// O que o contrato confere das inclusões de create-general.ts (LAT-57): o
// formulário de inclusão de prêmio e o de vínculo numa atuação, como o censo
// de 15/10/2026 os leu, e o caminho até cada um pelos links do Lattes.

import type { FormSpec } from './contract.ts';
import { findLinks } from './lattes-html.ts';

const text = (maxLength: number) => ({ maxLength, type: 'text' });
const hiddenField = { type: 'hidden' };

/** A inclusão de prêmio (seção 16; censo de 15/10/2026), que o contrato confere. */
export const CREATE_DADO_SPEC: FormSpec & { mode: string; partial: true } = {
  action: 'pkg_premio.form',
  fields: {
    f_agencia: text(100),
    f_ano: text(4),
    f_cod: hiddenField,
    f_ctr: hiddenField,
    f_seq: hiddenField,
    f_tipo_privacidade: { type: 'select-one' },
    f_titulo: text(200),
  },
  mode: 'I',
  name: 'GN_PREMIO',
  partial: true,
};

/** A inclusão de vínculo numa atuação (censo de 15/10/2026). */
export const CREATE_VINCULO_SPEC: FormSpec & { mode: string; partial: true } = {
  action: 'PKG_ATIV.VINCULOS',
  fields: {
    f_ano_fim: text(4),
    f_ano_ini: text(4),
    f_carga: text(3),
    f_cod: hiddenField,
    f_codinst: hiddenField,
    f_ctr: hiddenField,
    f_enqua: text(45),
    f_enqua_en: text(45),
    f_mes_fim: text(2),
    f_mes_ini: text(2),
    f_outras_inf: { maxLength: 3950, type: 'textarea' },
    f_outras_inf_en: { maxLength: 2000, type: 'textarea' },
    f_regime: { type: 'checkbox' },
    f_seq_ativ: hiddenField,
    f_seq_hist: hiddenField,
    f_status: { type: 'radio' },
    f_stavinc: { type: 'select-one' },
    f_vinc: text(30),
    f_vinculo: hiddenField,
  },
  mode: 'I',
  name: 'GN_ATIV_VINC',
  partial: true,
};

/** Os caminhos dos dois formulários de inclusão acima, pelos links do Lattes. */
export async function generalFormPath(
  kind: 'criar-dado' | 'criar-vinculo',
  get: (path: string) => Promise<string>,
  menu: string,
): Promise<{ missing: string } | { path: string }> {
  if (kind === 'criar-dado') {
    const lista = findLinks(menu, 'pkg_premio.lista')[0];
    if (!lista) return { missing: 'pkg_premio.lista' };
    const inc = findLinks(await get(lista.path), 'pkg_premio.form').find((l) => !l.params.f_seq);
    return inc ? { path: inc.path } : { missing: 'pkg_premio.form' };
  }
  const lista = findLinks(menu, 'pkg_ativ.lista')[0];
  if (!lista) return { missing: 'pkg_ativ.lista' };
  const grid = findLinks(await get(lista.path), 'pkg_ativ.cargos_vinculos')[0];
  if (!grid) return { missing: 'pkg_ativ.cargos_vinculos' };
  const inc = findLinks(await get(grid.path), 'pkg_ativ.vinculos').find(
    (l) => !l.params.f_seq_hist,
  );
  return inc ? { path: inc.path } : { missing: 'pkg_ativ.vinculos' };
}
