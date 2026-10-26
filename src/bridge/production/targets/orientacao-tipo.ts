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
