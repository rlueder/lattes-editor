// Texto longo na leitura (resumo, descrições, informações adicionais): para
// em seis linhas, com "Ler mais" para abrir e "Ler menos" para fechar. O link
// só aparece quando o texto passa mesmo das seis linhas, medido na tela
// (ReadingClamp, em ReadingParts.tsx); aqui fica a lógica sem React. Na
// impressão, o texto vai inteiro (styles.css, ".reading-clamp").

import { matchesQuery } from './facets.ts';

/** Linhas à mostra antes de "Ler mais"; o mesmo número está em styles.css. */
export const CLAMP_LINES = 6;

/**
 * O texto passou do corte: a altura do conteúdo é maior que a da caixa
 * cortada. Um pixel de folga, porque o navegador arredonda as duas medidas.
 */
export function overflowsClamp(scrollHeight: number, clientHeight: number): boolean {
  return scrollHeight - clientHeight > 1;
}

/**
 * O texto aparece inteiro, sem corte nem link: é o campo em foco na edição
 * (o trecho aceso na prévia tem de estar à vista) ou traz um resultado da
 * busca da seção. A mesma regra das listas fechadas (nested-collapse.ts).
 */
export function showsWhole(key: string, text: string, focusPart: string | null, query: string) {
  if (focusPart === key) return true;
  return query.trim() !== '' && matchesQuery(text, query);
}

/** Chave na memória de abertos e fechados do bloco (rememberNested), separada da das listas. */
export function clampMemoryId(key: string): string {
  return `ler-mais:${key}`;
}

export function clampActionLabel(open: boolean): string {
  return open ? 'Ler menos' : 'Ler mais';
}
