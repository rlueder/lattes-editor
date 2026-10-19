// Os tipos de produção que ficam à mão de propósito, com o motivo para a
// pessoa ler no lugar do "Formulário não suportado ainda".

import type { XElement } from '../../model/xml.ts';

/**
 * Os tipos de produção artística do XSD fora de artes cênicas, música, artes
 * visuais e outra produção artística: o censo de 15/10/2026 não achou
 * formulário do Lattes para eles, e o menu do Lattes real de 19/10/2026 só
 * tem as quatro listas novas (pkg_arte_nova.lista com AC e MU,
 * prc_arte_lista com 36 e 3Z). Como um item antigo desses tipos aparece hoje
 * no Lattes não foi visto: nenhum currículo lido tinha um.
 */
const LEGACY_ART =
  'O Lattes não tem mais formulário para este tipo de produção artística: o menu só tem artes cênicas, música, artes visuais e outra produção artística';

/**
 * As informações adicionais de cursos e de instituições (dados
 * complementares): o menu do Lattes real de 19/10/2026 não tem tela para
 * elas.
 */
const NO_SCREEN =
  'O Lattes não tem mais formulário para este tipo: o menu não tem tela para as informações adicionais de cursos e de instituições';

const REASONS: Record<string, string> = {
  'APRESENTACAO-DE-OBRA-ARTISTICA': LEGACY_ART,
  'APRESENTACAO-EM-RADIO-OU-TV': LEGACY_ART,
  'ARRANJO-MUSICAL': LEGACY_ART,
  'COMPOSICAO-MUSICAL': LEGACY_ART,
  'CURSO-DE-CURTA-DURACAO': LEGACY_ART,
  'INFORMACOES-ADICIONAIS-CURSOS': NO_SCREEN,
  'INFORMACOES-ADICIONAIS-INSTITUICOES': NO_SCREEN,
  'OBRA-DE-ARTES-VISUAIS': LEGACY_ART,
  SONOPLASTIA: LEGACY_ART,
};

/** O motivo de uma mudança num desses tipos ficar à mão, ou undefined. */
export function manualReason(chain: readonly XElement[]): string | undefined {
  for (let i = chain.length - 1; i >= 0; i--) {
    const reason = REASONS[chain[i]!.name];
    if (reason) return reason;
  }
  return undefined;
}

const ITEM_LISTS = new Set([
  'AREAS-DO-CONHECIMENTO',
  'AREA-DO-CONHECIMENTO-1',
  'AREA-DO-CONHECIMENTO-2',
  'AREA-DO-CONHECIMENTO-3',
  'PALAVRAS-CHAVE',
  'SETORES-DE-ATIVIDADE',
]);

/**
 * As áreas, palavras-chave e setores de uma participação em evento: a página
 * de edição do evento (PKG_EVENTO.form) não tem essas grades nem os ocultos
 * delas (lido em 19/10/2026 no Lattes real, num evento do currículo).
 */
export function eventListReason(element: string, chain: readonly XElement[]): string | undefined {
  if (!ITEM_LISTS.has(element)) return undefined;
  // A formação complementar (PKG_FORMACAO_COMPL.form): o censo de 15/10/2026
  // leu o formulário sem as grades nem os ocultos delas.
  if (chain.some((e) => e.name === 'FORMACAO-COMPLEMENTAR')) {
    return 'O formulário de formação complementar do Lattes não tem: áreas do conhecimento, palavras-chave nem setores de atividade';
  }
  const inEvent = chain.some(
    (e) =>
      e.name.startsWith('PARTICIPACAO-EM-') ||
      e.name === 'OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS',
  );
  return inEvent
    ? 'O formulário de eventos do Lattes não tem: áreas do conhecimento, palavras-chave nem setores de atividade'
    : undefined;
}
