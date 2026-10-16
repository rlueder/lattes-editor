// Os tipos de produção que ficam à mão de propósito, com o motivo para a
// pessoa ler no lugar do "Formulário não suportado ainda".

import type { XElement } from '../../model/xml.ts';

/**
 * Patentes e registros: o formulário PKG_PATENTE_REGISTRO tem, além das
 * quatro grades de produção, as de titulares (f_depositante_pessoa_l,
 * f_depositante_inst_l), a de datas (f_dados_grid_datas) e a coluna tit na de
 * autores (seção 21 de docs/lattes_internals.md). O check() refaz todas antes
 * do envio, e a forma em que a página de edição as traz não foi lida: um envio
 * com elas como vieram poderia apagar titulares e datas.
 */
const REGISTRY =
  'Alterar patentes e registros pelo conector: não suportado ainda. O formulário do Lattes refaz as grades de titulares e de datas no envio, e a forma delas na edição não foi lida';

/**
 * Os tipos de produção artística do XSD fora de artes cênicas, música, artes
 * visuais e outra produção artística: o censo de 15/10/2026 não achou
 * formulário do Lattes para eles. O catálogo de menus do reconhecimento cita
 * uma lista prc_arte_lista, que não foi aberta.
 */
const LEGACY_ART =
  'O censo dos formulários não achou no Lattes o formulário deste tipo de produção artística; altere no Lattes';

/**
 * Capítulo e prefácio: o censo de 15/10/2026 leu só o formulário do livro
 * (PKG_LVR_CAP.FORM_LVR); o do capítulo e a lista do prefácio não foram
 * abertos.
 */
const UNREAD =
  'O formulário de edição deste tipo ainda não foi lido no Lattes, e o conector não envia sem conhecê-lo; altere no Lattes por enquanto';

const REASONS: Record<string, string> = {
  'APRESENTACAO-DE-OBRA-ARTISTICA': LEGACY_ART,
  'APRESENTACAO-EM-RADIO-OU-TV': LEGACY_ART,
  'ARRANJO-MUSICAL': LEGACY_ART,
  'CAPITULO-DE-LIVRO-PUBLICADO': UNREAD,
  'COMPOSICAO-MUSICAL': LEGACY_ART,
  'CULTIVAR-PROTEGIDA': REGISTRY,
  'CULTIVAR-REGISTRADA': REGISTRY,
  'CURSO-DE-CURTA-DURACAO': LEGACY_ART,
  'DESENHO-INDUSTRIAL': REGISTRY,
  MARCA: REGISTRY,
  'OBRA-DE-ARTES-VISUAIS': LEGACY_ART,
  PATENTE: REGISTRY,
  'PREFACIO-POSFACIO': UNREAD,
  SOFTWARE: REGISTRY,
  SONOPLASTIA: LEGACY_ART,
  'TOPOGRAFIA-DE-CIRCUITO-INTEGRADO': REGISTRY,
};

/** O motivo de uma mudança num desses tipos ficar à mão, ou undefined. */
export function manualReason(chain: readonly XElement[]): string | undefined {
  for (let i = chain.length - 1; i >= 0; i--) {
    const reason = REASONS[chain[i]!.name];
    if (reason) return reason;
  }
  return undefined;
}
