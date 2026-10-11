import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { parseXml, walk, type XElement } from '../src/model/xml.ts';
import {
  abntAuthor,
  abntAuthors,
  abntDate,
  abntDoi,
  abntImprint,
  abntPages,
  referenceText,
  withPeriod,
} from '../src/print/abnt.ts';
import {
  languageLine,
  listEntry,
  newestFirst,
  paragraphText,
  professionalAddress,
} from '../src/print/entries.ts';
import {
  groupItems,
  groupLabel,
  matchTemplate,
  printOutline,
  sectionLabel,
  selectedCount,
  templateSelection,
  toggleGroups,
} from '../src/print/print-model.ts';
import { hasReference, referenceFor } from '../src/print/references.ts';
import { buildSections } from '../src/ui/sections.ts';

const fixture = async (name: string) => {
  const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, '../fixtures', name)));
  return (await loadCv(bytes, name)).doc.root;
};

const el = (xml: string) => parseXml(xml).root;

const AUTHORS = `
  <AUTORES NOME-COMPLETO-DO-AUTOR="Regina Maria Marteleto" NOME-PARA-CITACAO="MARTELETO, R. M." ORDEM-DE-AUTORIA="1"/>`;

describe('ABNT: autores', () => {
  it('entra pelo SOBRENOME, com prenomes abreviados', () => {
    expect(abntAuthor({ citation: '', name: 'Regina Maria Marteleto' })).toBe('MARTELETO, R. M.');
    expect(abntAuthor({ citation: '', name: 'Maria da Silva' })).toBe('SILVA, M.');
  });

  it('mantém Junior, Filho e Neto junto do sobrenome', () => {
    expect(abntAuthor({ citation: '', name: 'José Ribeiro Junior' })).toBe('RIBEIRO JUNIOR, J.');
    expect(abntAuthor({ citation: '', name: 'Ana Souza Neto' })).toBe('SOUZA NETO, A.');
  });

  it('sem nome completo, usa a primeira forma de citação do Lattes', () => {
    expect(abntAuthor({ citation: 'Lüder, R.;LUDER, R.', name: '' })).toBe('LÜDER, R.');
    expect(abntAuthor({ citation: 'MONONIMO', name: '' })).toBe('MONONIMO');
    expect(abntAuthor({ citation: '', name: 'Platão' })).toBe('PLATÃO');
  });

  it('separa por ponto e vírgula e encurta com et al. de quatro em diante', () => {
    const four = ['Ana Lima', 'Bia Melo', 'Caio Reis', 'Davi Sá'].map((name) => ({
      citation: '',
      name,
    }));
    expect(abntAuthors(four)).toBe('LIMA, A.; MELO, B.; REIS, C.; SÁ, D.');
    expect(abntAuthors(four, { etAl: true })).toBe('LIMA, A. et al.');
    expect(abntAuthors(four.slice(0, 3), { etAl: true })).toBe('LIMA, A.; MELO, B.; REIS, C.');
    expect(abntAuthors([])).toBe('');
  });
});

describe('ABNT: partes', () => {
  it('formata data, páginas, local e editora, DOI e ponto final', () => {
    expect(abntDate('09062006')).toBe('9 jun. 2006');
    expect(abntDate('13052024')).toBe('13 maio 2024');
    expect(abntDate('', '2020')).toBe('2020');
    expect(abntDate('00132020', '2020')).toBe('2020');
    expect(abntPages('71', '81')).toBe('p. 71-81');
    expect(abntPages('4', '4')).toBe('p. 4');
    expect(abntPages(undefined, '9')).toBe('p. 9');
    expect(abntPages()).toBe('');
    expect(abntImprint('Caxambu', 'ABEP')).toBe('Caxambu: ABEP');
    expect(abntImprint('', 'ABEP')).toBe('[S. l.]: ABEP');
    expect(abntImprint('Caxambu', '')).toBe('Caxambu: [s. n.]');
    expect(abntImprint()).toBe('[S. l.: s. n.]');
    expect(abntDoi('https://doi.org/10.1590/x')).toBe('DOI: https://doi.org/10.1590/x');
    expect(abntDoi('')).toBe('');
    expect(withPeriod('et al.')).toBe('et al.');
    expect(withPeriod('Título')).toBe('Título.');
    expect(withPeriod('  ')).toBe('');
  });
});

describe('ABNT: referências', () => {
  it('artigo de periódico, com o periódico destacado (exemplo do guia da UFU)', () => {
    const item = el(`<ARTIGO-PUBLICADO SEQUENCIA-PRODUCAO="1">
      <DADOS-BASICOS-DO-ARTIGO TITULO-DO-ARTIGO="Análise de redes sociais: aplicação nos estudos de transferência da informação" ANO-DO-ARTIGO="2001" DOI=""/>
      <DETALHAMENTO-DO-ARTIGO TITULO-DO-PERIODICO-OU-REVISTA="Ciência da Informação" VOLUME="30" FASCICULO="1" PAGINA-INICIAL="71" PAGINA-FINAL="81" LOCAL-DE-PUBLICACAO="Brasília, DF"/>
      ${AUTHORS}
    </ARTIGO-PUBLICADO>`);
    const ref = referenceFor(item);
    expect(referenceText(ref)).toBe(
      'MARTELETO, R. M. Análise de redes sociais: aplicação nos estudos de transferência da informação. Ciência da Informação, Brasília, DF, v. 30, n. 1, p. 71-81, 2001.',
    );
    expect(ref.find((s) => s.strong)?.text).toBe('Ciência da Informação,');
  });

  it('artigo sem local leva [s. l.] e o DOI no fim', () => {
    const item = el(`<ARTIGO-PUBLICADO>
      <DADOS-BASICOS-DO-ARTIGO TITULO-DO-ARTIGO="A comparison" ANO-DO-ARTIGO="1982" DOI="10.1/x"/>
      <DETALHAMENTO-DO-ARTIGO TITULO-DO-PERIODICO-OU-REVISTA="The Journal of Hygiene" VOLUME="89"/>
    </ARTIGO-PUBLICADO>`);
    expect(referenceText(referenceFor(item))).toBe(
      'A comparison. The Journal of Hygiene, [s. l.], v. 89, 1982. DOI: https://doi.org/10.1/x.',
    );
  });

  it('trabalho em evento: In: NOME DO EVENTO, ano, local; anais; editora; páginas', () => {
    const item = el(`<TRABALHO-EM-EVENTOS>
      <DADOS-BASICOS-DO-TRABALHO TITULO-DO-TRABALHO="O rural e urbano no Brasil" ANO-DO-TRABALHO="2006"/>
      <DETALHAMENTO-DO-TRABALHO NOME-DO-EVENTO="Encontro Nacional de Estudos Populacionais" CIDADE-DO-EVENTO="Caxambu" ANO-DE-REALIZACAO="2006" TITULO-DOS-ANAIS-OU-PROCEEDINGS="Anais [...]" NOME-DA-EDITORA="ABEP" CIDADE-DA-EDITORA="Caxambu" PAGINA-INICIAL="1" PAGINA-FINAL="13"/>
      <AUTORES NOME-COMPLETO-DO-AUTOR="Daniela Silva Reis" ORDEM-DE-AUTORIA="1"/>
    </TRABALHO-EM-EVENTOS>`);
    expect(referenceText(referenceFor(item))).toBe(
      'REIS, D. S. O rural e urbano no Brasil. In: ENCONTRO NACIONAL DE ESTUDOS POPULACIONAIS, 2006, Caxambu. Anais [...]. Caxambu: ABEP, 2006. p. 1-13.',
    );
  });

  it('livro organizado leva (org.) e a edição', () => {
    const item = el(`<LIVRO-PUBLICADO-OU-ORGANIZADO>
      <DADOS-BASICOS-DO-LIVRO TIPO="LIVRO_ORGANIZADO_OU_EDICAO" TITULO-DO-LIVRO="A trama do conhecimento" ANO="2008"/>
      <DETALHAMENTO-DO-LIVRO NUMERO-DA-EDICAO-REVISAO="2" NOME-DA-EDITORA="Papirus" CIDADE-DA-EDITORA="São Paulo"/>
      <AUTORES NOME-COMPLETO-DO-AUTOR="Lucídio Bianchetti" ORDEM-DE-AUTORIA="1"/>
    </LIVRO-PUBLICADO-OU-ORGANIZADO>`);
    const ref = referenceFor(item);
    expect(referenceText(ref)).toBe(
      'BIANCHETTI, L. (org.). A trama do conhecimento. 2. ed. São Paulo: Papirus, 2008.',
    );
    expect(ref.find((s) => s.strong)?.text).toBe('A trama do conhecimento.');
  });

  it('capítulo: In: organizadores (org.), livro destacado, páginas', () => {
    const item = el(`<CAPITULO-DE-LIVRO-PUBLICADO>
      <DADOS-BASICOS-DO-CAPITULO TITULO-DO-CAPITULO-DO-LIVRO="A teoria das representações sociais" ANO="2008"/>
      <DETALHAMENTO-DO-CAPITULO TITULO-DO-LIVRO="A trama do conhecimento" ORGANIZADORES="BIANCHETTI, L.; MEKSENAS, P." PAGINA-INICIAL="205" PAGINA-FINAL="220" NOME-DA-EDITORA="Papirus" CIDADE-DA-EDITORA="São Paulo"/>
      <AUTORES NOME-COMPLETO-DO-AUTOR="Fernando Cruz Souza" ORDEM-DE-AUTORIA="1"/>
    </CAPITULO-DE-LIVRO-PUBLICADO>`);
    expect(referenceText(referenceFor(item))).toBe(
      'SOUZA, F. C. A teoria das representações sociais. In: BIANCHETTI, L.; MEKSENAS, P. (org.). A trama do conhecimento. São Paulo: Papirus, 2008. p. 205-220.',
    );
    const noOrg = el(`<CAPITULO-DE-LIVRO-PUBLICADO>
      <DADOS-BASICOS-DO-CAPITULO TITULO-DO-CAPITULO-DO-LIVRO="Cap" ANO="2010"/>
      <DETALHAMENTO-DO-CAPITULO TITULO-DO-LIVRO="Livro"/>
    </CAPITULO-DE-LIVRO-PUBLICADO>`);
    expect(referenceText(referenceFor(noOrg))).toBe('Cap. In: Livro. [S. l.: s. n.], 2010.');
  });

  it('texto em jornal com data completa, título em inglês e tipo genérico', () => {
    const text = el(`<TEXTO-EM-JORNAL-OU-REVISTA>
      <DADOS-BASICOS-DO-TEXTO TITULO-DO-TEXTO="Dados abertos" TITULO-DO-TEXTO-INGLES="Open data" ANO-DO-TEXTO="2006"/>
      <DETALHAMENTO-DO-TEXTO TITULO-DO-JORNAL-OU-REVISTA="Zero Hora" LOCAL-DE-PUBLICACAO="Porto Alegre" PAGINA-INICIAL="4" DATA-DE-PUBLICACAO="09062006"/>
    </TEXTO-EM-JORNAL-OU-REVISTA>`);
    expect(referenceText(referenceFor(text))).toBe(
      'Dados abertos. Zero Hora, Porto Alegre, p. 4, 9 jun. 2006.',
    );
    expect(referenceText(referenceFor(text, { english: true }))).toContain('Open data.');
    const other = el(`<OUTRA-PRODUCAO-BIBLIOGRAFICA>
      <DADOS-BASICOS-DE-OUTRA-PRODUCAO TITULO="Prefácio" ANO="2019"/>
    </OUTRA-PRODUCAO-BIBLIOGRAFICA>`);
    expect(referenceText(referenceFor(other))).toBe('Prefácio. 2019.');
    expect(hasReference(other)).toBe(true);
    expect(hasReference(el('<IDIOMA IDIOMA="en"/>'))).toBe(false);
  });

  it('todo item de produção do arquivo sintético gera referência com título', async () => {
    const root = await fixture('synthetic_full.xml');
    const items: XElement[] = [];
    walk(root, (node) => {
      if (node.attrs.some((a) => a.name === 'SEQUENCIA-PRODUCAO') && hasReference(node))
        items.push(node);
    });
    expect(items.length).toBeGreaterThan(5);
    for (const item of items) expect(referenceText(referenceFor(item)).length).toBeGreaterThan(5);
  });
});

describe('impressão: seções e modelos', () => {
  it('deixa de fora identificação, Inovação, Educação e Outros dados', async () => {
    const outline = printOutline(buildSections(await fixture('synthetic_full.xml')));
    const ids = outline.map((s) => s.id);
    expect(ids).toContain('producoes');
    expect(ids).not.toContain('inovacao');
    expect(ids).not.toContain('outros');
    const keys = outline.flatMap((s) => s.groups.map((g) => g.key));
    expect(keys).not.toContain('DADOS-GERAIS');
    expect(keys).toContain('RESUMO-CV');
  });

  it('modelos marcam do resumido ao completo e reconhecem a seleção', async () => {
    const outline = printOutline(buildSections(await fixture('synthetic_full.xml')));
    const resumido = templateSelection(outline, 'resumido');
    const ampliado = templateSelection(outline, 'ampliado');
    const completo = templateSelection(outline, 'completo');
    expect(resumido.size).toBeGreaterThan(0);
    expect(ampliado.size).toBeGreaterThan(resumido.size);
    expect(completo.size).toBeGreaterThanOrEqual(ampliado.size);
    expect(matchTemplate(outline, resumido)).toBe('resumido');
    expect(matchTemplate(outline, completo)).toBe('completo');
    const custom = toggleGroups(
      resumido,
      [...completo].filter((id) => !resumido.has(id)).slice(0, 1),
      true,
    );
    expect(matchTemplate(outline, custom)).toBe('personalizado');
    expect(templateSelection(outline, 'personalizado', custom)).toEqual(custom);
    expect(toggleGroups(custom, [...custom], false).size).toBe(0);
    expect(selectedCount(outline, completo)).toBeGreaterThan(selectedCount(outline, resumido));
  });

  it('títulos em inglês quando há tradução, português no resto', () => {
    const g = {
      id: 'x',
      items: [],
      key: 'ARTIGOS-PUBLICADOS',
      kind: 'list' as const,
      label: 'Artigos',
    };
    expect(groupLabel(g, true)).toBe('Journal articles');
    expect(groupLabel(g, false)).toBe('Artigos');
    expect(groupLabel({ ...g, key: 'SEM-TRADUCAO' }, true)).toBe('Artigos');
    const s = { groups: [], id: 'producoes', label: 'Produções' };
    expect(sectionLabel(s, true)).toBe('Production');
    expect(sectionLabel({ ...s, id: 'nada' }, true)).toBe('Produções');
  });
});

describe('impressão: itens de um grupo', () => {
  it('item sozinho é o próprio item; contêiner dá os filhos; endereço dá as partes', () => {
    const one = el(
      '<SOFTWARE SEQUENCIA-PRODUCAO="3"><DADOS-BASICOS-DO-SOFTWARE TITULO-DO-SOFTWARE="S"/></SOFTWARE>',
    );
    expect(groupItems({ elements: [one], id: 'a', label: 'a' })).toEqual([one]);
    const box = el('<IDIOMAS><IDIOMA IDIOMA="en"/><IDIOMA IDIOMA="es"/></IDIOMAS>');
    expect(groupItems({ elements: [box], id: 'b', label: 'b' })).toHaveLength(2);
    const end = el(
      '<ENDERECO FLAG-DE-PREFERENCIA="X"><ENDERECO-PROFISSIONAL CIDADE="C"/></ENDERECO>',
    );
    expect(groupItems({ elements: [end], id: 'c', label: 'c' })[0]!.name).toBe(
      'ENDERECO-PROFISSIONAL',
    );
  });
});

describe('impressão: entradas', () => {
  it('idioma, resumo, endereço profissional e lista com período', () => {
    const idioma = el(
      '<IDIOMA IDIOMA="en" DESCRICAO-DO-IDIOMA="Inglês" PROFICIENCIA-DE-COMPREENSAO="BEM" PROFICIENCIA-DE-FALA="RAZOAVELMENTE" PROFICIENCIA-DE-LEITURA="BEM" PROFICIENCIA-DE-ESCRITA="POUCO"/>',
    );
    expect(languageLine(idioma, false)).toEqual({
      detail: 'compreende bem, fala razoavelmente, lê bem, escreve pouco',
      name: 'Inglês',
    });
    expect(languageLine(idioma, true).detail).toBe(
      'understands well, speaks reasonably, reads well, writes a little',
    );
    const resumo = el('<RESUMO-CV TEXTO-RESUMO-CV-RH="Texto" TEXTO-RESUMO-CV-RH-EN="Text"/>');
    expect(paragraphText(resumo, false)).toBe('Texto');
    expect(paragraphText(resumo, true)).toBe('Text');
    expect(paragraphText(el('<RESUMO-CV TEXTO-RESUMO-CV-RH="Só pt"/>'), true)).toBe('Só pt');
    expect(
      paragraphText(
        el('<OUTRAS-INFORMACOES-RELEVANTES OUTRAS-INFORMACOES-RELEVANTES="Mais"/>'),
        false,
      ),
    ).toBe('Mais');
    const prof = el(
      '<ENDERECO-PROFISSIONAL NOME-INSTITUICAO-EMPRESA="Universidade" NOME-UNIDADE="Faculdade" CIDADE="Pelotas" UF="RS" PAIS="Brasil" HOME-PAGE="https://x.org" E-MAIL="a@b.c" TELEFONE="123"/>',
    );
    expect(professionalAddress(prof)).toEqual([
      'Universidade, Faculdade',
      'Pelotas – RS, Brasil',
      'https://x.org',
    ]);
    const older = el('<PREMIO-TITULO NOME-DO-PREMIO-OU-TITULO="Antigo" ANO-DA-PREMIACAO="2001"/>');
    const newer = el('<PREMIO-TITULO NOME-DO-PREMIO-OU-TITULO="Novo" ANO-DA-PREMIACAO="2020"/>');
    expect(newestFirst([older, newer])).toEqual([newer, older]);
    expect(listEntry(newer)).toMatchObject({ period: '2020', title: 'Novo' });
  });
});
