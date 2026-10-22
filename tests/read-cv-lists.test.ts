import { describe, expect, it } from 'vitest';

import { readCvLists } from '../extension/src/read-cv-lists.ts';
import type { ListsPart } from '../src/bridge/cv-lists.ts';

const rows = [{ link: '', text: 'Linha' }];

describe('listas do diagnóstico em partes', () => {
  it('junta as partes até a fila acabar, passando a fila adiante', async () => {
    const calls: string[][] = [];
    const parts: ListsPart[] = [
      { lists: { 'a?': rows }, queue: ['b', 'c'], unread: [] },
      { lists: { 'b?': rows, 'c?': rows }, queue: [], unread: ['x?'] },
    ];
    const out = await readCvLists(async (args) => {
      calls.push(args);
      return parts.shift();
    });
    expect(calls).toEqual([[], ['["b","c"]']]);
    expect(out).toEqual({ lists: { 'a?': rows, 'b?': rows, 'c?': rows }, listsUnread: ['x?'] });
  });

  it('parte que falha deixa o que faltava como não lido, sem perder o já lido', async () => {
    let n = 0;
    const out = await readCvLists(async () => {
      if (n++ === 0) return { lists: { 'a?': rows }, queue: ['pkg_b.lista?f_cod=K1'], unread: [] };
      throw new Error('aba');
    });
    expect(out).toEqual({ lists: { 'a?': rows }, listsUnread: ['pkg_b.lista?'] });
  });

  it('sem a primeira parte, nenhuma lista foi lida', async () => {
    expect(await readCvLists(async () => ({ error: 'sem código' }))).toEqual({
      lists: {},
      listsUnread: ['*'],
    });
  });
});
