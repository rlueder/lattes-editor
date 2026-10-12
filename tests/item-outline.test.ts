import { describe, expect, it } from 'vitest';

import { parseHash } from '../src/ui/hash-route.ts';
import {
  activeCard,
  outlineEntries,
  outlineId,
  sameEntries,
  trackOpen,
} from '../src/ui/item-outline.ts';

describe('outlineId', () => {
  it('limpa o id do React e numera a subseção', () => {
    expect(outlineId('_r_1f_', 0)).toBe('item-_r_1f_-0');
    expect(outlineId('«r3»', 2)).toBe('item-r3-2');
    expect(outlineId(':r7:', 1)).toBe('item-r7-1');
  });

  it('não tem barra, e a URL não o confunde com seção/grupo/ano', () => {
    const id = outlineId('a/b c', 4);
    expect(id).toBe('item-abc-4');
    expect(id).not.toContain('/');
    // Sem barra, o roteador lê no máximo uma "seção" que não existe; nunca uma âncora.
    expect(parseHash(`#${id}`)).toEqual({ sectionId: id });
  });

  it('bases diferentes dão ids diferentes', () => {
    expect(outlineId('_r_1_', 0)).not.toBe(outlineId('_r_2_', 0));
    expect(outlineId('_r_1_', 0)).not.toBe(outlineId('_r_1_', 1));
  });
});

describe('trackOpen e activeCard', () => {
  it('o último aberto é o ativo; fechar volta ao anterior', () => {
    let stack: string[] = [];
    stack = trackOpen(stack, 'a', true);
    stack = trackOpen(stack, 'b', true);
    expect(activeCard(stack, () => true)).toBe('b');
    stack = trackOpen(stack, 'b', false);
    expect(stack).toEqual(['a']);
    expect(activeCard(stack, () => true)).toBe('a');
    stack = trackOpen(stack, 'a', false);
    expect(activeCard(stack, () => true)).toBeUndefined();
  });

  it('reabrir um cartão o leva para o fim, sem duplicar', () => {
    const stack = trackOpen(['a', 'b', 'c'], 'a', true);
    expect(stack).toEqual(['b', 'c', 'a']);
  });

  it('fechar um cartão que não estava na lista não muda nada', () => {
    expect(trackOpen(['a'], 'z', false)).toEqual(['a']);
  });

  it('não altera a lista recebida', () => {
    const stack = ['a'];
    trackOpen(stack, 'b', true);
    expect(stack).toEqual(['a']);
  });

  it('pula cartões que não valem mais (desmontados ou fechados)', () => {
    const alive = new Set(['a']);
    expect(activeCard(['a', 'b', 'c'], (c) => alive.has(c))).toBe('a');
    expect(activeCard([], () => true)).toBeUndefined();
  });
});

describe('outlineEntries', () => {
  it('mantém a ordem e normaliza espaços', () => {
    expect(
      outlineEntries([
        { id: 'item-x-0', text: 'Vínculos' },
        { id: 'item-x-1', text: '  Atividades de\n direção e administração ' },
      ]),
    ).toEqual([
      { id: 'item-x-0', label: 'Vínculos' },
      { id: 'item-x-1', label: 'Atividades de direção e administração' },
    ]);
  });

  it('deixa de fora título sem id ou sem texto', () => {
    expect(
      outlineEntries([
        { id: '', text: 'Sem id' },
        { id: 'item-x-1', text: '   ' },
        { id: 'item-x-2', text: 'Autores' },
        { id: 'item-x-3', text: 'Palavras-chave' },
      ]),
    ).toEqual([
      { id: 'item-x-2', label: 'Autores' },
      { id: 'item-x-3', label: 'Palavras-chave' },
    ]);
  });

  it('com menos de duas subseções não há índice', () => {
    expect(outlineEntries([])).toEqual([]);
    expect(outlineEntries([{ id: 'item-x-0', text: 'Autores' }])).toEqual([]);
    expect(
      outlineEntries([
        { id: 'item-x-0', text: 'Autores' },
        { id: '', text: 'Sem id' },
      ]),
    ).toEqual([]);
  });
});

describe('sameEntries', () => {
  const a = [
    { id: 'item-x-0', label: 'Autores' },
    { id: 'item-x-1', label: 'Palavras-chave' },
  ];

  it('compara id e rótulo, na ordem', () => {
    expect(sameEntries(a, [...a.map((e) => ({ ...e }))])).toBe(true);
    expect(sameEntries(a, [a[1]!, a[0]!])).toBe(false);
    expect(sameEntries(a, [a[0]!])).toBe(false);
    expect(sameEntries(a, [a[0]!, { id: 'item-x-1', label: 'Outro' }])).toBe(false);
    expect(sameEntries([], [])).toBe(true);
  });
});
