// A grade de autores como o check() das páginas do Lattes a serializa (LAT-57,
// seções 21 e 22 de docs/lattes_internals.md).

import { describe, expect, it } from 'vitest';

import {
  AUTHOR_KEYS,
  menuAuthors,
  NO_OWNER_NAME,
  ownerAuthor,
  ownerGridRow,
  ownerNamesOf,
  REGISTRY_AUTHOR_KEYS,
  serializeGrid,
  TEAM_KEYS,
} from '../src/bridge/author-grid.ts';
import { element } from '../src/model/xml.ts';

const ANA = { citations: ['SILVA, A.', 'SILVA, ANA'], full: 'Ana Silva' };

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
    expect(ownerAuthor(MENU, ANA)).toEqual({ owner: { c: '', l: 'Ana Silva', t: 'SILVA, A.' } });
    expect(ownerAuthor('<script>var autorDP = [];</script>', ANA)).toEqual({
      reason: expect.stringMatching(/não está no menu/),
    });
    expect(ownerAuthor('<p>sem vetor</p>', ANA)).toEqual({
      reason: expect.stringMatching(/não está no menu/),
    });
  });

  it('a linha sem código só vale se trouxer o nome completo ou uma das citações', () => {
    // Pela citação, sem acento nem caixa, com o nome escrito de outro jeito.
    expect(ownerAuthor(MENU, { citations: ['silva, a.'], full: 'Ana B. Silva' })).toEqual({
      owner: { c: '', l: 'Ana Silva', t: 'SILVA, A.' },
    });
    // Pelo nome completo, sem citação nenhuma.
    expect(ownerAuthor(MENU, { citations: [], full: 'ÁNA SILVA' })).toMatchObject({
      owner: { l: 'Ana Silva' },
    });
    // Outra pessoa: a linha sem código não é dela, e nada vai.
    expect(ownerAuthor(MENU, { citations: ['LIMA, B.'], full: 'Bruno Lima' })).toEqual({
      reason: expect.stringMatching(/não tem o seu nome completo nem uma das suas citações/),
    });
    const two = `<script>var autorDP = [{l:'Ana Silva',c:'',t:'SILVA, A.'},{l:'Ana Silva',c:'',t:'SILVA, A.'}];</script>`;
    expect(ownerAuthor(two, ANA)).toEqual({ reason: expect.stringMatching(/não está no menu/) });
  });

  it('os nomes vêm do DADOS-GERAIS, com as citações separadas por ";"', () => {
    const root = (attrs: Record<string, string>) =>
      element('CURRICULO-VITAE', {}, [element('DADOS-GERAIS', attrs)]);
    expect(
      ownerNamesOf(
        root({
          'NOME-COMPLETO': ' Ana Silva ',
          'NOME-EM-CITACOES-BIBLIOGRAFICAS': 'SILVA, A.; SILVA, ANA;',
        }),
      ),
    ).toEqual({ citations: ['SILVA, A.', 'SILVA, ANA'], full: 'Ana Silva' });
    expect(ownerNamesOf(root({ 'NOME-COMPLETO': 'Ana' }))).toEqual({ citations: [], full: 'Ana' });
    expect(ownerNamesOf(root({}))).toBeUndefined();
    expect(ownerNamesOf(undefined)).toBeUndefined();
    expect(NO_OWNER_NAME).toMatch(/nome completo/);
    expect(menuAuthors('<script>var autorDP = [{x:1}];</script>')).toBeUndefined();
    expect(menuAuthors('<script>var autorDP = {l: 1};</script>')).toBeUndefined();
    expect(menuAuthors('<script>var autorDP = [{l:"a",c:1,t:</script>')).toBeUndefined();
  });

  it('serializa como o check(): chaves da lista, na ordem do objeto, "|" e "@"', () => {
    const found = ownerAuthor(MENU, ANA);
    if (!('owner' in found)) throw new Error(found.reason);
    const owner = found.owner;
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
