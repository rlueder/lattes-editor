// Os campos do projeto sem atributo no XSD (a cooperação com empresa, as
// caixas do projeto de ensino), guardados ao lado do projeto como o Lattes os
// guarda fora da exportação. O projeto de ensino tem as caixas; os outros, a
// empresa (censo de 27/10/2026). A consulta do CNPJ (PR_RECUPERA_DADOS_INST)
// e o CNPJ que só grava com o código da empresa: passada de 29/10/2026.

import { getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import type { Binding } from './campos.ts';
import type { LattesState } from './estado.ts';
import type { SimRequest } from './pedido.ts';
import { html, type SimResponse } from './tipos.ts';

/** As empresas da consulta do CNPJ, sintéticas: CNPJ sem máscara → código, nome e e-mail. */
export const COMPANIES: Record<string, { cod: string; email: string; nome: string }> = {
  '11222333000181': {
    cod: 'EMP000000001',
    email: 'contato@exemplo.com.br',
    nome: 'Empresa Exemplo Ltda',
  },
};

const unmasked = (cnpj: string) => cnpj.toUpperCase().replace(/[^0-9A-Z]/g, '');

/**
 * PKG_PROJETO.PR_RECUPERA_DADOS_INST?p_cnpj=…: o JSON como o Lattes real o
 * serve (espaço antes das vírgulas, text/html), com tudo vazio quando o CNPJ
 * não é de empresa conhecida.
 */
export function companyLookup(req: SimRequest): SimResponse {
  const c = COMPANIES[unmasked(req.get('p_cnpj') ?? '')] ?? { cod: '', email: '', nome: '' };
  return html(
    `{"cod":${JSON.stringify(c.cod)} ,"nome":${JSON.stringify(c.nome)} ,"email":${JSON.stringify(c.email)}}`,
  );
}

/**
 * O que o servidor faz depois de gravar os campos: o CNPJ só fica com o código
 * da empresa que a consulta deu (sem ele, volta o de antes), e no projeto de
 * ensino uma ação inovadora marcada grava Sim no rádio, mesmo com Não enviado.
 */
export function afterSave(
  state: LattesState,
  projeto: XElement,
  req: SimRequest,
  cnpjBefore: string,
) {
  const fields = state.formOnly(projeto);
  const cnpj = req.get('f_cnpj_empresa');
  if (cnpj !== undefined && unmasked(cnpj) !== unmasked(cnpjBefore)) {
    const company = COMPANIES[unmasked(cnpj)];
    const code = req.get('f_cod_inst_empresa') ?? '';
    if (unmasked(cnpj) && company?.cod !== code) fields.f_cnpj_empresa = cnpjBefore;
    else fields.f_cod_inst_empresa = code;
  }
  if (getAttr(projeto, 'NATUREZA') === 'ENSINO' && fields.f_tpo_acao_inov) {
    setAttr(projeto, 'FLAG-POTENCIAL-INOVACAO', 'SIM');
  }
}

export function projectScreenBindings(
  state: LattesState,
  teaching: boolean,
  yesNo: [string, string][],
): Binding[] {
  const stored = (name: string, kind: Binding['kind'], max?: number): Binding => ({
    kind,
    maxLength: max,
    name,
    read: (el) => state.formOnly(el)[name] ?? '',
    write: (el, value) => {
      state.formOnly(el)[name] = value;
    },
  });
  return [
    { ...stored('f_tpo_pesq_emp', 'radio'), options: yesNo },
    ...(teaching
      ? (
          [
            ['f_tpo_cooperacao', ['IE', 'AF', 'EM']],
            ['f_tpo_acao_inov', ['EF', 'EM', 'GR', 'ES', 'GM', 'MP', 'GD']],
            ['f_tematica', ['EA', 'AP', 'PC', 'FI', 'IT', 'AI', 'IS', 'PI', 'MI', 'A', 'G', 'O']],
          ] as const
        ).map(([name, codes]): Binding => ({
          ...stored(name, 'checkboxes'),
          options: codes.map((c): [string, string] => [c, c]),
        }))
      : [
          stored('f_cnpj_empresa', 'text', 18),
          stored('f_cod_inst_empresa', 'hidden'),
          stored('f_txt_nme_empresa', 'text', 400),
          stored('f_txt_email_institucional', 'text', 400),
          stored('f_txt_setor', 'text', 400),
        ]),
  ];
}
