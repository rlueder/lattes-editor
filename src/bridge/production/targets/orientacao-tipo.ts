// O tipo do mestrado nas orientações (DADOS-BASICOS-...-MESTRADO@TIPO), que a
// página grava pelo atribui() da janela de tipo (orientacoes-bancas.ts).

import type { Change } from '../../../model/changes.ts';
import { childElements, getAttr, type XElement } from '../../../model/xml.ts';
import type { PartFieldsResult } from '../types.ts';

/**
 * O tipo do mestrado (f_sub_prod) pelo dominio() de pkg_orient.form, lido em
 * 26/10/2026: concluída 29 Acadêmico e 30 Profissional, em andamento 36 e 37.
 * O atribui() grava o código em f_sub_prod e o rótulo em f_dsc_outra (só de
 * leitura, vai no envio). Inferido: ACADEMICO e PROFISSIONALIZANTE do XML
 * pelos rótulos.
 */
const MASTER_KINDS: Record<'done' | 'ongoing', Record<string, readonly [string, string]>> = {
  done: {
    ACADEMICO: ['29', 'Acadêmico'],
    NAO_INFORMADO: ['', ''],
    PROFISSIONALIZANTE: ['30', 'Profissional'],
  },
  ongoing: {
    ACADEMICO: ['36', 'Acadêmico'],
    NAO_INFORMADO: ['', ''],
    PROFISSIONALIZANTE: ['37', 'Profissional'],
  },
};

/** O profissional busca o curso no nível 9 (retnivel(): 41 com 30, A41 com 37). */
const professional = (code: string) => code === '30' || code === '37';

/**
 * O tipo do mestrado: f_sub_prod e f_dsc_outra. Com curso no item, a troca
 * entre acadêmico e profissional muda o nível da busca de curso, e o curso de
 * antes é escolhido de novo no nível novo (lookups.ts); fora da lista dele, o
 * envio para antes do POST.
 */
export const masterKind =
  (done: boolean) =>
  (change: Change, el: XElement, item: XElement): PartFieldsResult => {
    const kinds = MASTER_KINDS[done ? 'done' : 'ongoing'];
    const f = change.fields.find((x) => x.attr === 'TIPO');
    if (!f) return { fields: {} };
    const before = kinds[f.before];
    const after = kinds[getAttr(el, 'TIPO') ?? ''];
    if (!before || !after) {
      return { reason: 'Tipo: valor que o formulário de orientação do Lattes não tem' };
    }
    const course =
      childElements(item)
        .filter((c) => c !== el)
        .map((c) => getAttr(c, 'CODIGO-CURSO') ?? '')
        .find(Boolean) ?? '';
    const relevel = course !== '' && professional(before[0]) !== professional(after[0]);
    return {
      also: [{ after: after[1], before: before[1], field: 'f_dsc_outra', label: 'Tipo' }],
      fields: { TIPO: { field: 'f_sub_prod', toForm: (v: string) => kinds[v]?.[0] } },
      ...(relevel
        ? { lookups: { course: { before: course, code: course }, subProd: after[0] } }
        : {}),
    };
  };

/** A NATUREZA do XML da orientação de outra natureza (49). */
const OTHER_NATURE = 'ORIENTACAO-DE-OUTRA-NATUREZA';

/**
 * O tipo da orientação de outra natureza (OUTRAS-ORIENTACOES-CONCLUIDAS@TIPO),
 * pelo dominio() de pkg_orient.form lido em 27/10/2026: com a outra natureza
 * marcada, a janela só oferece "Outro Tipo", e o atribui_ot() grava em
 * f_dsc_outra (até 100 caracteres) o texto pedido num prompt(). As outras
 * naturezas não têm tipo na página ("apenas para dissertação de mestrado e
 * orientação de outra natureza"). Inferido: o TIPO do XML é esse texto.
 */
export function otherKind(change: Change, el: XElement): PartFieldsResult {
  const f = change.fields.find((x) => x.attr === 'TIPO');
  if (!f) return { fields: {} };
  const nature = change.fields.find((x) => x.attr === 'NATUREZA');
  // A troca da natureza limpa f_dsc_outra (testa_nivel()).
  if (nature && nature.before !== nature.after) {
    return { reason: 'Tipo: troque a natureza num envio e o tipo em outro' };
  }
  if ((getAttr(el, 'NATUREZA') ?? '') !== OTHER_NATURE) {
    return { reason: 'Tipo: o Lattes só guarda o tipo na orientação de outra natureza' };
  }
  if (f.after.length > 100) return { reason: 'Tipo: o Lattes aceita até 100 caracteres' };
  return { fields: { TIPO: 'f_dsc_outra' } };
}
