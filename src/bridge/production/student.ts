// O identificador do orientando, como a página de orientação o acha
// (pkg_orient.form, lida em 18/10/2026; docs/lattes_internals.md, seção 18).
// O Salvar da página chama pre_check(), que depois do check() faz um POST
// síncrono a pkg_orient.valida_orientador_ajax com o nome e a natureza e, só
// com sta_validado verdadeiro, copia idOrientado e seqFormOrientado para
// f_id_orientado e f_seq_form_orientado. Sem validação, os dois ficam como a
// página trouxe. Uma chamada de teste em 18/10/2026 confirmou que o POST só
// consulta: nenhuma lista do currículo mudou.

import type { LattesPort } from '../apply.ts';
import { encodeLatin1Form, type Pairs, pairValue } from '../form.ts';
import { latin1Param } from '../lattes-lists.ts';
import type { FieldValues } from '../plan.ts';

export const STUDENT_CHECK = 'pkg_orient.valida_orientador_ajax';

interface Reply {
  idOrientado?: string;
  seqFormOrientado?: string;
  sta_validado?: boolean;
}

/**
 * Os ocultos do orientando para o nome novo, como pre_check() os deixaria:
 * vazio quando o nome não valida (a página não mexe neles).
 */
export async function resolveStudent(
  name: string,
  port: LattesPort,
  pairs: Pairs,
): Promise<{ check: FieldValues; set: FieldValues }> {
  const none = { check: {}, set: {} };
  const fields = ['f_id_orientado', 'f_seq_form_orientado'];
  if (!fields.every((f) => pairs.some(([k]) => k === f))) return none;
  // nvlOrientacao(): o F_COD_PROD marcado inteiro, fora do modo T.
  const nature = pairValue(pairs, 'F_COD_PROD') ?? '';
  // O jQuery da página codifica de novo o que o escape() já codificou.
  const body = encodeLatin1Form([
    ['f_cod', pairValue(pairs, 'f_cod') ?? ''],
    ['f_nme', latin1Param(name.trim())],
    ['f_nivel', nature],
  ]);
  let reply: Reply;
  try {
    reply = JSON.parse(await port.post(STUDENT_CHECK, body)) as Reply;
  } catch {
    // Resposta que não é JSON: como a página, segue sem mexer nos dois.
    return none;
  }
  if (reply.sta_validado !== true) return none;
  return {
    // A sequência do formulário do orientando não volta na página relida
    // (inferido): a releitura confere só o identificador.
    check: { f_seq_form_orientado: null },
    set: {
      f_id_orientado: String(reply.idOrientado ?? ''),
      f_seq_form_orientado: String(reply.seqFormOrientado ?? ''),
    },
  };
}
