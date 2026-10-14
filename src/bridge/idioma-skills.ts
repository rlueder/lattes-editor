// Proficiência do IDIOMA → par de campos do GN_IDIOMA, usada pela alteração
// (plan.ts) e pela exclusão (delete.ts), que confere as mesmas proficiências
// antes de excluir.

/**
 * A caixa FC_* diz que a habilidade foi informada, o rádio F_* diz o nível
 * (P, R, B). NAO_INFORMADO é a caixa desmarcada e nenhum rádio. Lido no
 * formulário em 11/10/2026.
 */
export const IDIOMA_SKILLS: Record<string, string> = {
  'PROFICIENCIA-DE-COMPREENSAO': 'COMPR',
  'PROFICIENCIA-DE-ESCRITA': 'ESCREVE',
  'PROFICIENCIA-DE-FALA': 'CONVERSA',
  'PROFICIENCIA-DE-LEITURA': 'LE',
};

/** Nível do XML → valor do rádio. */
export const LEVEL: Record<string, string> = { BEM: 'B', POUCO: 'P', RAZOAVELMENTE: 'R' };
