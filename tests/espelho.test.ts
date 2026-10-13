import { describe, expect, it } from 'vitest';

import { isEspelhoPage, parseEspelho } from '../src/bridge/espelho.ts';
import { decodeHtmlEntities, htmlLines } from '../src/bridge/html-text.ts';
import { parseXml } from '../src/model/xml.ts';
import { diffEspelho, titlePart } from '../src/review/espelho-diff.ts';

// Página de conferência sintética, com a ordem e os textos vistos em
// 12/10/2026 (docs/lattes_internals.md, seção 10). As tags são inferidas.
const PAGE = `<html><head><script>var x = "1. não é item";</script></head><body>
<div class="title-wrapper"><h2>Pessoa de Teste</h2></div>
<div><b>Áreas de atuação</b></div>
<div>1. Grande área: Ciências Exatas e da Terra</div>
<div><h1>Producão</h1></div>
<div><b>Produção bibliográfica</b></div>
<div>Outras produções bibliográficas</div>
<div>1. TESTE, P.; TESTE, P.. Malhas Tipogr&aacute;ficas (Grid Systems). Trabalho de Conclusão de Curso. , 2004.</div>
<div>Referências adicionais: Brasil/Português. Meio de divulgação: Impresso</div>
<div><b>Produção técnica</b></div>
<div>Trabalhos técnicos</div>
<div>1. TESTE, P.. Relatório Anual 2004 (hotsite), 2005</div>
<div>Palavras-chave: design, Internet</div>
<div>2. TESTE, P.; OUTRA, A.. Site Novo no Lattes (website), 2025</div>
<div>Demais produções técnicas</div>
<div>1. TESTE, P.. Revista Exemplo 31, 2006. (Periódico, Editoração)</div>
<div><h1>Eventos</h1></div>
<div>Eventos</div>
<div>Participação em eventos</div>
<div>1. 2º Encontro de Exemplo, 2007. (Congresso) .</div>
<div>Totais de produção</div>
<div>1. Isto já é o rodapé</div>
<p>Este arquivo não foi gerado a partir do Currículo Lattes validado e disponível publicamente.</p>
</body></html>`;

describe('página de conferência do Lattes (cv_espelho)', () => {
  it('lê só os itens numerados de Produção e Eventos, com o subtítulo de cada lista', () => {
    expect(parseEspelho(PAGE)).toEqual([
      {
        group: 'Outras produções bibliográficas',
        section: 'Produção',
        text: 'TESTE, P.; TESTE, P.. Malhas Tipográficas (Grid Systems). Trabalho de Conclusão de Curso. , 2004.',
      },
      {
        group: 'Trabalhos técnicos',
        section: 'Produção',
        text: 'TESTE, P.. Relatório Anual 2004 (hotsite), 2005',
      },
      {
        group: 'Trabalhos técnicos',
        section: 'Produção',
        text: 'TESTE, P.; OUTRA, A.. Site Novo no Lattes (website), 2025',
      },
      {
        group: 'Demais produções técnicas',
        section: 'Produção',
        text: 'TESTE, P.. Revista Exemplo 31, 2006. (Periódico, Editoração)',
      },
      {
        group: 'Participação em eventos',
        section: 'Eventos',
        text: '2º Encontro de Exemplo, 2007. (Congresso) .',
      },
    ]);
  });

  it('um título de seção fora da lista encerra a seção comparada', () => {
    const page = `<div><h1>Producão</h1></div><div>Trabalhos técnicos</div>
      <div>1. TESTE, P.. Relatório Anual, 2005</div>
      <div><h1>Projetos de pesquisa</h1></div>
      <div>1. Projeto que não é produção, 2010</div>
      <div><h1>Inovação</h1></div>
      <div>2. Outra coisa numerada</div>`;
    expect(parseEspelho(page).map((i) => i.text)).toEqual(['TESTE, P.. Relatório Anual, 2005']);
  });

  it('reconhece a página de conferência e recusa o login', () => {
    expect(isEspelhoPage(PAGE)).toBe(true);
    expect(isEspelhoPage('<form action="pkg_sec.logon">Entrar</form>')).toBe(false);
  });

  it('texto em linhas: blocos quebram, inline não, entidades resolvidas', () => {
    expect(
      htmlLines('<div>Um <b>dois</b>&nbsp;tr&ecirc;s</div><br>quatro&#33;<p>&#x41;</p>'),
    ).toEqual(['Um dois três', 'quatro!', 'A']);
  });
});

describe('entidades do HTML', () => {
  it('decodifica numa passada só e ignora nomes do Object.prototype', () => {
    expect(decodeHtmlEntities('&amp;#65; &#65; &#x41; &eacute;')).toBe('&#65; A A é');
    expect(decodeHtmlEntities('&constructor; &toString; &__proto__;')).toBe(
      '&constructor; &toString; &__proto__;',
    );
    expect(decodeHtmlEntities('&#128512; &#x110000;')).toBe('😀 &#x110000;');
    // Títulos em maiúsculas do Lattes e pontuação.
    expect(decodeHtmlEntities('A&Ccedil;&Atilde;O E EDUCA&Ccedil;&Atilde;O &ndash; 1&ordm;')).toBe(
      'AÇÃO E EDUCAÇÃO – 1º',
    );
  });
});

describe('o que mudou no Lattes desde a exportação', () => {
  const root = parseXml(`<CURRICULO-VITAE NUMERO-IDENTIFICADOR="0000000000000001">
    <PRODUCAO-BIBLIOGRAFICA><DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA>
      <OUTRA-PRODUCAO-BIBLIOGRAFICA SEQUENCIA-PRODUCAO="1">
        <DADOS-BASICOS-DE-OUTRA-PRODUCAO TITULO="Malhas Tipográficas (Grid Systems)" ANO="2004"/>
      </OUTRA-PRODUCAO-BIBLIOGRAFICA>
    </DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA></PRODUCAO-BIBLIOGRAFICA>
    <PRODUCAO-TECNICA>
      <TRABALHO-TECNICO SEQUENCIA-PRODUCAO="2">
        <DADOS-BASICOS-DO-TRABALHO-TECNICO TITULO-DO-TRABALHO-TECNICO="Relatório Anual 2004 (hotsite)" ANO="2005"/>
      </TRABALHO-TECNICO>
      <TRABALHO-TECNICO SEQUENCIA-PRODUCAO="3">
        <DADOS-BASICOS-DO-TRABALHO-TECNICO TITULO-DO-TRABALHO-TECNICO="Projeto Tirado do Lattes" ANO="2005"/>
      </TRABALHO-TECNICO>
      <TRABALHO-TECNICO SEQUENCIA-PRODUCAO="4">
        <DADOS-BASICOS-DO-TRABALHO-TECNICO TITULO-DO-TRABALHO-TECNICO="Ok" ANO="2005"/>
      </TRABALHO-TECNICO>
      <DEMAIS-TIPOS-DE-PRODUCAO-TECNICA>
        <OUTRA-PRODUCAO-TECNICA SEQUENCIA-PRODUCAO="5">
          <DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA TITULO="Revista Exemplo 3" ANO="2006"/>
        </OUTRA-PRODUCAO-TECNICA>
        <OUTRA-PRODUCAO-TECNICA SEQUENCIA-PRODUCAO="6">
          <DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA TITULO="Revista Exemplo 31" ANO="2006"/>
        </OUTRA-PRODUCAO-TECNICA>
      </DEMAIS-TIPOS-DE-PRODUCAO-TECNICA>
    </PRODUCAO-TECNICA>
    <DADOS-COMPLEMENTARES><PARTICIPACAO-EM-EVENTOS-CONGRESSOS>
      <PARTICIPACAO-EM-CONGRESSO SEQUENCIA-PRODUCAO="7">
        <DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO TITULO="" ANO="2007"/>
        <DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO NOME-DO-EVENTO="2º Encontro de Exemplo"/>
      </PARTICIPACAO-EM-CONGRESSO>
    </PARTICIPACAO-EM-EVENTOS-CONGRESSOS></DADOS-COMPLEMENTARES>
  </CURRICULO-VITAE>`).root;

  it('separa o incluído no Lattes, o tirado de lá e o curto demais para comparar', () => {
    const diff = diffEspelho(parseEspelho(PAGE), root);
    expect(diff.onlyInLattes.map((i) => i.text)).toEqual([
      'TESTE, P.; OUTRA, A.. Site Novo no Lattes (website), 2025',
    ]);
    // "Revista Exemplo 3" não casa dentro de "Revista Exemplo 31".
    expect(diff.onlyInExport.map((e) => e.title)).toEqual([
      'Projeto Tirado do Lattes',
      'Revista Exemplo 3',
    ]);
    expect(diff.skipped).toBe(1);
  });

  it('título mais longo casa primeiro: o curto não toma a linha do longo', () => {
    const two = parseXml(`<CURRICULO-VITAE><PRODUCAO-TECNICA>
      <TRABALHO-TECNICO SEQUENCIA-PRODUCAO="1">
        <DADOS-BASICOS-DO-TRABALHO-TECNICO TITULO-DO-TRABALHO-TECNICO="Design Gráfico" ANO="2005"/>
      </TRABALHO-TECNICO>
      <TRABALHO-TECNICO SEQUENCIA-PRODUCAO="2">
        <DADOS-BASICOS-DO-TRABALHO-TECNICO TITULO-DO-TRABALHO-TECNICO="Design Gráfico Avançado" ANO="2005"/>
      </TRABALHO-TECNICO></PRODUCAO-TECNICA></CURRICULO-VITAE>`).root;
    const diff = diffEspelho(
      [
        { section: 'Produção', text: 'TESTE, P.. Design Gráfico Avançado, 2005' },
        { section: 'Produção', text: 'TESTE, P.. Design Gráfico, 2005' },
      ],
      two,
    );
    expect(diff).toEqual({ onlyInExport: [], onlyInLattes: [], skipped: 0 });
  });

  it('página que não bate com nada não vira diferença: fica ilegível', () => {
    expect(diffEspelho([], root)).toMatchObject({ unreadable: true, onlyInExport: [] });
    expect(
      diffEspelho([{ section: 'Produção', text: 'Algo que não é nenhum título daqui' }], root),
    ).toMatchObject({ unreadable: true });
  });

  it('o título é o trecho depois dos autores', () => {
    expect(titlePart('TESTE, P.; OUTRA, A.. Site Novo (website), 2025')).toBe(
      'Site Novo (website), 2025',
    );
    expect(titlePart('SILVA, J. A.. Um Título. Anais, 2005')).toBe('Um Título. Anais, 2005');
    expect(titlePart('LÜDER, Rafael. Embraer Defense Systems, 2005')).toBe(
      'Embraer Defense Systems, 2005',
    );
    expect(titlePart('2º Encontro de Exemplo, 2007. (Congresso) .')).toBeUndefined();
  });

  it('título curto não casa com sobrenome de autor nem com o veículo', () => {
    const cvWith = (title: string) =>
      parseXml(`<CURRICULO-VITAE><PRODUCAO-TECNICA>
        <TRABALHO-TECNICO SEQUENCIA-PRODUCAO="1">
          <DADOS-BASICOS-DO-TRABALHO-TECNICO TITULO-DO-TRABALHO-TECNICO="${title}" ANO="2005"/>
        </TRABALHO-TECNICO>
        <TRABALHO-TECNICO SEQUENCIA-PRODUCAO="2">
          <DADOS-BASICOS-DO-TRABALHO-TECNICO TITULO-DO-TRABALHO-TECNICO="Outro Trabalho Real" ANO="2005"/>
        </TRABALHO-TECNICO></PRODUCAO-TECNICA></CURRICULO-VITAE>`).root;
    // "Design" é sobrenome de um autor da linha, não o título dela.
    const byAuthor = diffEspelho(
      [{ section: 'Produção', text: 'DESIGN, Ana; TESTE, P.. Outro Trabalho Real, 2005' }],
      cvWith('Design'),
    );
    expect(byAuthor.onlyInExport.map((e) => e.title)).toEqual(['Design']);
    // "Anais" aparece no veículo, depois do título de outro item.
    const byVenue = diffEspelho(
      [{ section: 'Produção', text: 'TESTE, P.. Outro Trabalho Real. Anais do Congresso, 2005' }],
      cvWith('Anais'),
    );
    expect(byVenue.onlyInExport.map((e) => e.title)).toEqual(['Anais']);
  });

  it('autor que não termina como de costume não deixa o sobrenome casar com um título', () => {
    const one = parseXml(`<CURRICULO-VITAE><PRODUCAO-TECNICA>
      <TRABALHO-TECNICO SEQUENCIA-PRODUCAO="1">
        <DADOS-BASICOS-DO-TRABALHO-TECNICO TITULO-DO-TRABALHO-TECNICO="Anais de Exemplo" ANO="2005"/>
      </TRABALHO-TECNICO></PRODUCAO-TECNICA></CURRICULO-VITAE>`).root;
    // "P. " é inicial: o fim dos autores não é reconhecido, e o título só
    // pode estar depois dela.
    const diff = diffEspelho(
      [
        { section: 'Produção', text: 'ANAIS DE EXEMPLO, P. Outro Trabalho, 2005' },
        { section: 'Produção', text: 'TESTE, P. Anais de Exemplo, 2005' },
      ],
      one,
    );
    expect(diff.onlyInLattes.map((l) => l.text)).toEqual([
      'ANAIS DE EXEMPLO, P. Outro Trabalho, 2005',
    ]);
    expect(diff.onlyInExport).toEqual([]);
  });

  it('ponto simples depois de inicial não decide o fim dos autores; título curto de evento casa', () => {
    expect(titlePart('TESTE, P. Outro Trabalho. Anais, 2005')).toBeUndefined();
    const xml = (titles: string[]) =>
      parseXml(
        `<CURRICULO-VITAE><PRODUCAO-TECNICA>${titles
          .map(
            (t, i) => `<TRABALHO-TECNICO SEQUENCIA-PRODUCAO="${i + 1}">
          <DADOS-BASICOS-DO-TRABALHO-TECNICO TITULO-DO-TRABALHO-TECNICO="${t}" ANO="2005"/>
        </TRABALHO-TECNICO>`,
          )
          .join('')}</PRODUCAO-TECNICA></CURRICULO-VITAE>`,
      ).root;
    // O título real casa depois dos autores, mesmo com ponto no meio.
    expect(
      diffEspelho(
        [{ section: 'Produção', text: 'TESTE, P. Outro Trabalho. Anais, 2005' }],
        xml(['Outro Trabalho']),
      ),
    ).toEqual({ onlyInExport: [], onlyInLattes: [], skipped: 0 });
    // O sobrenome do segundo autor não casa com o título.
    expect(
      diffEspelho(
        [
          { section: 'Produção', text: 'ANAIS, B.; ANAIS DE EXEMPLO, D. Titulo Qualquer' },
          { section: 'Produção', text: 'TESTE, P.. Anais de Exemplo, 2005' },
        ],
        xml(['Anais de Exemplo', 'Titulo Qualquer']),
      ),
    ).toEqual({ onlyInExport: [], onlyInLattes: [], skipped: 0 });
    // Sem autores (evento), um título curto casa.
    expect(
      diffEspelho([{ section: 'Eventos', text: 'Fórum, 2007. (Congresso) .' }], xml(['Fórum'])),
    ).toEqual({ onlyInExport: [], onlyInLattes: [], skipped: 0 });
  });

  it('nada mudou quando cada linha tem o seu item', () => {
    const diff = diffEspelho(
      [{ section: 'Produção', text: 'TESTE, P.. Relatório Anual 2004 (hotsite), 2005' }],
      parseXml(`<CURRICULO-VITAE><PRODUCAO-TECNICA>
        <TRABALHO-TECNICO SEQUENCIA-PRODUCAO="1">
          <DADOS-BASICOS-DO-TRABALHO-TECNICO TITULO-DO-TRABALHO-TECNICO="Relatório Anual 2004 (hotsite)" ANO="2005"/>
        </TRABALHO-TECNICO></PRODUCAO-TECNICA></CURRICULO-VITAE>`).root,
    );
    expect(diff).toEqual({ onlyInExport: [], onlyInLattes: [], skipped: 0 });
  });
});
