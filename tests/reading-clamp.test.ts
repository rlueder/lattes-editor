// Texto longo na leitura (src/ui/reading-clamp.ts): para em seis linhas, com
// "Ler mais"; o link só aparece quando o texto passa do corte, e o texto vai
// inteiro no campo em foco e com um resultado da busca.

import { describe, expect, it } from 'vitest';

import {
  CLAMP_LINES,
  clampActionLabel,
  clampMemoryId,
  overflowsClamp,
  showsWhole,
} from '../src/ui/reading-clamp.ts';

describe('corte do texto longo na leitura', () => {
  it('seis linhas', () => {
    expect(CLAMP_LINES).toBe(6);
  });

  it('passa do corte só quando o conteúdo é mais alto que a caixa, com um pixel de folga', () => {
    expect(overflowsClamp(300, 153)).toBe(true);
    expect(overflowsClamp(153.5, 153)).toBe(false);
    expect(overflowsClamp(120, 120)).toBe(false);
  });

  it('o campo em foco na edição vai inteiro', () => {
    expect(showsWhole('0:TEXTO-RESUMO-CV-RH', 'texto', '0:TEXTO-RESUMO-CV-RH', '')).toBe(true);
    expect(showsWhole('0:TEXTO-RESUMO-CV-RH', 'texto', '0:OUTRO', '')).toBe(false);
  });

  it('um resultado da busca da seção vai inteiro; busca vazia não abre nada', () => {
    const text = 'Pesquisa em genômica da conservação de anfíbios';
    expect(showsWhole('k', text, null, 'genomica')).toBe(true);
    expect(showsWhole('k', text, null, 'astronomia')).toBe(false);
    expect(showsWhole('k', text, null, '   ')).toBe(false);
  });

  it('memória separada da das listas e as palavras do link', () => {
    expect(clampMemoryId('0:DESCRICAO')).toBe('ler-mais:0:DESCRICAO');
    expect(clampActionLabel(false)).toBe('Ler mais');
    expect(clampActionLabel(true)).toBe('Ler menos');
  });
});
