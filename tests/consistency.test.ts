import { describe, expect, it } from 'vitest';

import { parseXml } from '../src/model/xml.ts';
import {
  LONG_COURSE_YEARS,
  normalizeTitle,
  OLD_CURRENT_YEARS,
  reviewCv,
  validIssn,
} from '../src/review/consistency.ts';
import { bySequencia, locate, placeIndex, sequenciaKey } from '../src/review/locate.ts';
import { buildSections } from '../src/ui/sections.ts';

const TODAY = new Date(2026, 9, 13);

const artigo = (seq: number, attrs: string, extra = '', detail = 'ISSN="00280836"') => `
  <ARTIGO-PUBLICADO SEQUENCIA-PRODUCAO="${seq}">
    <DADOS-BASICOS-DO-ARTIGO ${attrs}/>
    <DETALHAMENTO-DO-ARTIGO TITULO-DO-PERIODICO-OU-REVISTA="Revista" ${detail}/>
    ${extra}
  </ARTIGO-PUBLICADO>`;

const autor = (citacao: string, id = '') =>
  `<AUTORES NOME-COMPLETO-DO-AUTOR="${citacao}" NOME-PARA-CITACAO="${citacao}" ORDEM-DE-AUTORIA="1" NRO-ID-CNPQ="${id}"/>`;

function cv(body: { atuacao?: string; formacao?: string; producao?: string; tecnica?: string }) {
  return parseXml(`<CURRICULO-VITAE NUMERO-IDENTIFICADOR="0000000000000001">
    <DADOS-GERAIS NOME-COMPLETO="Pessoa de Teste" NOME-EM-CITACOES-BIBLIOGRAFICAS="TESTE, P.;TESTE, Pessoa">
      <FORMACAO-ACADEMICA-TITULACAO>${body.formacao ?? ''}</FORMACAO-ACADEMICA-TITULACAO>
      <ATUACOES-PROFISSIONAIS>${body.atuacao ?? ''}</ATUACOES-PROFISSIONAIS>
    </DADOS-GERAIS>
    <PRODUCAO-BIBLIOGRAFICA><ARTIGOS-PUBLICADOS>${body.producao ?? ''}</ARTIGOS-PUBLICADOS></PRODUCAO-BIBLIOGRAFICA>
    <PRODUCAO-TECNICA>${body.tecnica ?? ''}</PRODUCAO-TECNICA>
  </CURRICULO-VITAE>`).root;
}

const checks = (root: ReturnType<typeof cv>) => reviewCv(root, TODAY).map((f) => f.check);

describe('revisão de consistência (LAT-29)', () => {
  it('ISSN pelo dígito verificador, com ou sem hífen, X valendo 10', () => {
    expect(validIssn('0028-0836')).toBe(true);
    expect(validIssn('00280836')).toBe(true);
    expect(validIssn('2434-561X')).toBe(true);
    expect(validIssn('0028-0837')).toBe(false);
    expect(validIssn('1234')).toBe(false);
  });

  it('título comparável sem acento, caixa ou pontuação', () => {
    expect(normalizeTitle('  Malhas Tipográficas (Grid Systems).')).toBe(
      'malhas tipograficas grid systems',
    );
  });

  it('vínculo atual antigo, fim antes do início e início no futuro', () => {
    const old = TODAY.getFullYear() - OLD_CURRENT_YEARS - 1;
    const root = cv({
      atuacao: `
        <ATUACAO-PROFISSIONAL NOME-INSTITUICAO="Universidade A" SEQUENCIA-ATIVIDADE="1">
          <VINCULOS ANO-INICIO="${old}" ANO-FIM=""/>
        </ATUACAO-PROFISSIONAL>
        <ATUACAO-PROFISSIONAL NOME-INSTITUICAO="Empresa B" SEQUENCIA-ATIVIDADE="2">
          <VINCULOS ANO-INICIO="2010" ANO-FIM="2008"/>
          <VINCULOS ANO-INICIO="2012" MES-INICIO="6" ANO-FIM="2012" MES-FIM="3"/>
          <VINCULOS ANO-INICIO="2030" ANO-FIM="2031"/>
        </ATUACAO-PROFISSIONAL>
        <ATUACAO-PROFISSIONAL NOME-INSTITUICAO="Recente" SEQUENCIA-ATIVIDADE="3">
          <VINCULOS ANO-INICIO="2024" ANO-FIM=""/>
          <VINCULOS ANO-INICIO="" ANO-FIM="2020"/>
        </ATUACAO-PROFISSIONAL>`,
    });
    const found = reviewCv(root, TODAY);
    expect(found.map((f) => [f.check, f.title])).toEqual([
      ['atual-antigo', 'Universidade A'],
      ['fim-antes-do-inicio', 'Empresa B'],
      ['fim-antes-do-inicio', 'Empresa B'],
      ['ano-futuro', 'Empresa B'],
    ]);
    expect(found[0]!.severity).toBe('nota');
    expect(found[0]!.message).toContain(String(old));
  });

  it('formação concluída antes de começar e em andamento há muito tempo', () => {
    const long = TODAY.getFullYear() - LONG_COURSE_YEARS - 1;
    const root = cv({
      formacao: `
        <GRADUACAO SEQUENCIA-FORMACAO="1" NOME-CURSO="Design" STATUS-DO-CURSO="CONCLUIDO" ANO-DE-INICIO="2004" ANO-DE-CONCLUSAO="2001"/>
        <DOUTORADO SEQUENCIA-FORMACAO="2" NOME-CURSO="Comunicação" STATUS-DO-CURSO="EM_ANDAMENTO" ANO-DE-INICIO="${long}" ANO-DE-CONCLUSAO=""/>
        <MESTRADO SEQUENCIA-FORMACAO="3" NOME-CURSO="Recente" STATUS-DO-CURSO="EM_ANDAMENTO" ANO-DE-INICIO="2024" ANO-DE-CONCLUSAO=""/>`,
    });
    expect(checks(root)).toEqual(['fim-antes-do-inicio', 'curso-longo']);
  });

  it('produção repetida, ano no futuro, sem DOI e ISSN que não confere', () => {
    const root = cv({
      producao: [
        artigo(1, 'TITULO-DO-ARTIGO="Um estudo" ANO-DO-ARTIGO="2020" DOI="10.1000/x"'),
        artigo(2, 'TITULO-DO-ARTIGO="Um Estudo." ANO-DO-ARTIGO="2020" DOI="10.1000/y"'),
        artigo(3, 'TITULO-DO-ARTIGO="Um estudo" ANO-DO-ARTIGO="2021" DOI="10.1000/z"'),
        artigo(4, 'TITULO-DO-ARTIGO="Do futuro" ANO-DO-ARTIGO="2030" DOI="10.1000/w"'),
        artigo(5, 'TITULO-DO-ARTIGO="Sem DOI" ANO-DO-ARTIGO="2019" DOI=""'),
        artigo(
          6,
          'TITULO-DO-ARTIGO="ISSN errado" ANO-DO-ARTIGO="2019" DOI="10.1/a"',
          '',
          'ISSN="00280837"',
        ),
      ].join(''),
    });
    expect(reviewCv(root, TODAY).map((f) => [f.check, f.title])).toEqual([
      ['producao-repetida', 'Um Estudo.'],
      ['ano-futuro', 'Do futuro'],
      ['sem-doi', 'Sem DOI'],
      ['issn-invalido', 'ISSN errado'],
    ]);
  });

  it('autor repetido no mesmo item e nome de citação fora da lista da pessoa', () => {
    const root = cv({
      producao: [
        artigo(
          1,
          'TITULO-DO-ARTIGO="Dois autores iguais" ANO-DO-ARTIGO="2020" DOI="10.1/a"',
          autor('TESTE, P.', '0000000000000001') + autor('TESTE, P.', '0000000000000001'),
        ),
        artigo(
          2,
          'TITULO-DO-ARTIGO="Outra forma" ANO-DO-ARTIGO="2020" DOI="10.1/b"',
          autor('Teste, Pessoa', '0000000000000001') + autor('P. TESTE', '0000000000000001'),
        ),
      ].join(''),
    });
    const found = reviewCv(root, TODAY);
    expect(found.map((f) => [f.check, f.title])).toEqual([
      ['autor-repetido', 'Dois autores iguais'],
      ['nome-de-citacao', 'Outra forma'],
    ]);
    expect(found[0]!.message).toContain('TESTE, P.');
    expect(found[1]!.message).toContain('"P. TESTE"');
  });

  it('currículo sem achados', () => {
    const root = cv({
      producao: artigo(1, 'TITULO-DO-ARTIGO="Tudo certo" ANO-DO-ARTIGO="2020" DOI="10.1/a"'),
    });
    expect(reviewCv(root, TODAY)).toEqual([]);
  });

  it('cada achado sabe a seção e o grupo onde o item aparece', () => {
    const root = cv({
      atuacao: `<ATUACAO-PROFISSIONAL NOME-INSTITUICAO="Universidade A" SEQUENCIA-ATIVIDADE="1">
          <VINCULOS ANO-INICIO="2000" ANO-FIM=""/></ATUACAO-PROFISSIONAL>`,
      producao: artigo(1, 'TITULO-DO-ARTIGO="Sem DOI" ANO-DO-ARTIGO="2019" DOI=""'),
    });
    const sections = buildSections(root);
    const places = reviewCv(root, TODAY).map((f) => locate(sections, f.item));
    expect(places.map((p) => p?.sectionId)).toEqual(['atuacao', 'producoes']);
    expect(places[1]?.anchor).toMatch(/^producoes\//);
    expect(locate(sections, parseXml('<SOLTO/>').root)).toBeUndefined();
    // O mesmo item numa cópia do documento (a exportação original) leva ao
    // item do documento aberto pela SEQUENCIA-PRODUCAO.
    const copy = cv({
      producao: artigo(1, 'TITULO-DO-ARTIGO="Sem DOI" ANO-DO-ARTIGO="2019" DOI=""'),
    });
    const [fromCopy] = reviewCv(copy, TODAY);
    const same = bySequencia(root).get(sequenciaKey(fromCopy!.item)!);
    expect(same).not.toBe(fromCopy!.item);
    expect(placeIndex(sections).get(same!)?.sectionId).toBe('producoes');
  });
});
