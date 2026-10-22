// Especificação dos formulários lidos, separada do motor de verificação.
import { BIOGRAPHIC_OPS_ENABLED, biographicContract } from './biographic.ts';
import type { Contract, FieldSpec } from './contract.ts';
import { CREATE_ITEMS_ENABLED } from './create.ts';
import { CREATE_SPECS } from './create-items.ts';
import { editContract } from './edit-items.ts';
import { enabledListEdits, listEditContract, type ListEditKind } from './edit-lists.ts';

const text = (maxLength: number): FieldSpec => ({ maxLength, type: 'text' });
const textarea = (maxLength: number): FieldSpec => ({ maxLength, type: 'textarea' });
const hidden: FieldSpec = { type: 'hidden' };
const select: FieldSpec = { type: 'select-one' };
const checkbox: FieldSpec = { type: 'checkbox' };
const radio: FieldSpec = { type: 'radio' };

/**
 * O que o conector viu no Lattes em 11/10/2026. Os limites vêm das tabelas de
 * docs/lattes_internals.md; um campo sem limite ali fica sem limite aqui.
 * Quando o Lattes mudar, a verificação aponta o campo e este contrato é
 * atualizado junto com o código que depende dele.
 */
export const buildContract = ({
  biographic = BIOGRAPHIC_OPS_ENABLED,
  create = CREATE_ITEMS_ENABLED,
  lists = enabledListEdits(),
}: {
  biographic?: boolean;
  create?: boolean;
  lists?: ReadonlySet<ListEditKind>;
} = {}): Contract => ({
  forms: {
    ...(create ? CREATE_SPECS : {}),
    ...biographicContract(biographic).forms,
    ...editContract().forms,
    ...listEditContract(lists).forms,
    idioma: {
      action: 'PKG_IDIOMA.FORM',
      fields: {
        f_cod: hidden,
        F_COD_IDIOMA: select,
        F_COMPR: radio,
        F_CONVERSA: radio,
        f_ctr: hidden,
        F_ESCREVE: radio,
        F_LE: radio,
        f_seq: hidden,
        f_tipo_privacidade: select,
        FC_COMPR: checkbox,
        FC_CONVERSA: checkbox,
        FC_ESCREVE: checkbox,
        FC_LE: checkbox,
      },
      name: 'GN_IDIOMA',
    },
    resumo: {
      action: 'PKG_RESUME.FORM',
      fields: {
        f_cod: hidden,
        f_ctr: hidden,
        f_resume_auto: hidden,
        f_resume_auto_en: hidden,
        f_ret: hidden,
        F_TEXTO: textarea(4000),
        F_TEXTO_EN: textarea(4000),
      },
      name: 'RES',
    },
    vinculo: {
      action: 'PKG_ATIV.VINCULOS',
      fields: {
        f_ano_fim: text(4),
        f_ano_ini: text(4),
        f_carga: text(3),
        f_cod: hidden,
        f_codinst: hidden,
        f_ctr: hidden,
        f_enqua: text(45),
        f_enqua_en: text(45),
        f_mes_fim: text(2),
        f_mes_ini: text(2),
        f_outras_inf: textarea(3950),
        f_outras_inf_en: textarea(2000),
        f_regime: checkbox,
        f_seq_ativ: hidden,
        f_seq_hist: hidden,
        f_status: radio,
        f_stavinc: select,
        f_tipo_privacidade: select,
        f_vinc: text(30),
        f_vinculo: hidden,
      },
      name: 'GN_ATIV_VINC',
    },
  },
  menu: [
    'pkg_ativ.lista',
    'pkg_idioma.lista',
    'pkg_resume.',
    ...biographicContract(biographic).menu,
    ...editContract().menu,
    ...listEditContract(lists).menu,
  ],
});

/** O contrato com as chaves desta montagem. */
export const LATTES_CONTRACT: Contract = buildContract();
