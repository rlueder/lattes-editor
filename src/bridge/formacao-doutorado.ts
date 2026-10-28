// O doutorado e a graduação na inclusão da formação (create-formacao.ts): a
// outra instituição pela busca com f_sta_outra=S, e os blocos que o tipo
// mostra. Rótulos lidos em 28/10/2026, num doutorado sanduíche de teste: o
// sanduíche do tipo S é o primeiro bloco (f_orient_dout, f_inst_dout); o bloco
// _sw é o sanduíche da cotutela com sanduíche (CS), e o _ct, a cotutela (C e
// CS). O f_orient_dout_sw enviado num tipo S voltou vazio.

import { getAttr, type XElement } from '../model/xml.ts';
import type { FieldValues } from './plan.ts';

export function planDoutorado(
  el: XElement,
  set: FieldValues,
): { institution?: { code: string; name: string } } | { reason: string } {
  const type = set.f_tpo_doutorado ?? '';
  if (set.f_orient_dout_sw && type !== 'CS') {
    return {
      reason: 'O orientador do sanduíche na cotutela só existe no tipo cotutela com sanduíche',
    };
  }
  if (set.f_orient_dout_ct && type !== 'C' && type !== 'CS') {
    return { reason: 'O orientador da cotutela só existe nos tipos com cotutela' };
  }
  const institution = ['DOUT', 'GRAD']
    .map((s) => ({
      code: getAttr(el, `CODIGO-INSTITUICAO-${s}`) ?? '',
      name: getAttr(el, `NOME-INSTITUICAO-${s}`) ?? '',
    }))
    .find((i) => i.code || i.name);
  if (institution && !institution.code) {
    return { reason: 'Instituição do doutorado sem código do Lattes: escolha pela busca' };
  }
  return institution ? { institution } : {};
}
