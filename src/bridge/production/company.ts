// A empresa do projeto de cooperação, como a página de projeto a acha
// (pkg_projeto.form, lida em 29/10/2026): o onChange do CNPJ chama
// recuperaDadosInst(), um GET de PKG_PROJETO.PR_RECUPERA_DADOS_INST com
// p_cnpj sem a máscara, e a resposta em JSON ({cod, nome, email}) põe o código
// em f_cod_inst_empresa. Sem esse código, o CNPJ enviado não gravou (passada
// de 29/10/2026). Com o nome vazio na resposta, a página avisa "CNPJ inválido."
// e limpa os dados da empresa. A consulta só lê.

import type { LattesPort } from '../apply.ts';
import type { FieldValues } from '../plan.ts';

export const COMPANY_LOOKUP = 'PKG_PROJETO.PR_RECUPERA_DADOS_INST';

/** O CNPJ como o tiraMasc() da página o deixa: só letras e dígitos, em maiúsculas (inferido do nome). */
export const unmasked = (cnpj: string) => cnpj.toUpperCase().replace(/[^0-9A-Z]/g, '');

/** O código da empresa para o CNPJ, ou o motivo de não ir. */
export async function resolveCompany(
  cnpj: string,
  port: LattesPort,
): Promise<{ check: FieldValues; set: FieldValues } | { detail: string }> {
  const digits = unmasked(cnpj);
  // Sem CNPJ, sem empresa: o código vai vazio.
  if (!digits) return { check: {}, set: { f_cod_inst_empresa: '' } };
  let reply: { cod?: unknown; nome?: unknown };
  try {
    reply = JSON.parse(await port.get(`${COMPANY_LOOKUP}?p_cnpj=${digits}`)) as typeof reply;
  } catch {
    return { detail: 'O Lattes não respondeu à consulta do CNPJ; nada foi enviado' };
  }
  const code = String(reply.cod ?? '').trim();
  if (!String(reply.nome ?? '').trim() || !code) {
    return {
      detail: 'O Lattes não achou empresa com esse CNPJ ("CNPJ inválido."); nada foi enviado',
    };
  }
  // A página de alteração traz o código num oculto; a releitura confere o CNPJ.
  return { check: { f_cod_inst_empresa: null }, set: { f_cod_inst_empresa: code } };
}
