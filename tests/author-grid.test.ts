// A grade de autores como o check() das páginas do Lattes a serializa (LAT-57,
// seções 21 e 22 de docs/lattes_internals.md).

import { describe, expect, it } from 'vitest';

import {
  AUTHOR_KEYS,
  menuAuthors,
  ownerAuthor,
  ownerGridRow,
  REGISTRY_AUTHOR_KEYS,
  serializeGrid,
  TEAM_KEYS,
} from '../src/bridge/author-grid.ts';

const MENU = `<script>var areaDP = [];
var autorDP = [{l:'Ana Silva',c:'',t:'SILVA, A.',deletable:false},{l:'Bruno Lima',c:'3',t:'LIMA, B.',deletable:true},{l:'Ana Silva',c:'11',t:'SILVA, A. B.',deletable:true}];
</script>`;

describe('a grade de autores', () => {
  it('lê o autorDP do menu e acha a linha da própria pessoa pelo código vazio', () => {
    expect(menuAuthors(MENU)).toEqual([
      { c: '', l: 'Ana Silva', t: 'SILVA, A.' },
      { c: '3', l: 'Bruno Lima', t: 'LIMA, B.' },
      { c: '11', l: 'Ana Silva', t: 'SILVA, A. B.' },
    ]);
    // O mesmo nome com código de coautor não é a linha da pessoa (lote 4).
    expect(ownerAuthor(MENU)).toEqual({ c: '', l: 'Ana Silva', t: 'SILVA, A.' });
    expect(ownerAuthor('<script>var autorDP = [];</script>')).toBeUndefined();
    expect(ownerAuthor('<p>sem vetor</p>')).toBeUndefined();
    expect(menuAuthors('<script>var autorDP = [{x:1}];</script>')).toBeUndefined();
    expect(menuAuthors('<script>var autorDP = {l: 1};</script>')).toBeUndefined();
    expect(menuAuthors('<script>var autorDP = [{l:"a",c:1,t:</script>')).toBeUndefined();
  });

  it('serializa como o check(): chaves da lista, na ordem do objeto, "|" e "@"', () => {
    const owner = ownerAuthor(MENU)!;
    expect(serializeGrid([ownerGridRow(owner)], AUTHOR_KEYS)).toBe('Ana Silva||SILVA, A.');
    expect(serializeGrid([ownerGridRow(owner)], REGISTRY_AUTHOR_KEYS)).toBe('Ana Silva||SILVA, A.');
    // No projeto, o coordenador leva tit "s"; recuperaPosicaoResponsavel procura "|s@".
    expect(serializeGrid([ownerGridRow(owner, { tit: 's' })], TEAM_KEYS)).toBe(
      'Ana Silva||SILVA, A.|s',
    );
    // Um autor digitado na hora: {l, t, c: " ", tit, add: true} (seção 21).
    const typed = Object.fromEntries([
      ['l', 'Carla Souza'],
      ['t', 'SOUZA, C.'],
      ['c', ' '],
      ['tit', 'n'],
      ['add', true],
    ]);
    expect(serializeGrid([ownerGridRow(owner), typed, {}], AUTHOR_KEYS)).toBe(
      'Ana Silva||SILVA, A.@Carla Souza|SOUZA, C.| |true',
    );
  });
});
