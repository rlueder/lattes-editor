import { describe, expect, it } from 'vitest';

import { enumLabel } from '../src/labels/labels.ts';
import { childElements, firstChild, parseXml } from '../src/model/xml.ts';
import {
  buildReferenceIndex,
  courseView,
  institutionView,
  viewForContainer,
} from '../src/ui/reference-tables.ts';

const CV = parseXml(`<CURRICULO-VITAE>
<DADOS-GERAIS>
  <FORMACAO-ACADEMICA-TITULACAO>
    <MESTRADO CODIGO-INSTITUICAO="I1" NOME-INSTITUICAO="Pontifícia Universidade Católica" CODIGO-CURSO="C1" NOME-CURSO="Design" ANO-DE-INICIO="2006" ANO-DE-CONCLUSAO="2007"/>
  </FORMACAO-ACADEMICA-TITULACAO>
  <ATUACOES-PROFISSIONAIS>
    <ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="I2" NOME-INSTITUICAO="Empresa Ltda"><VINCULOS ANO-INICIO="2014" ANO-FIM="2016" CODIGO-INSTITUICAO="I2"/></ATUACAO-PROFISSIONAL>
  </ATUACOES-PROFISSIONAIS>
</DADOS-GERAIS>
<DADOS-COMPLEMENTARES>
  <INFORMACOES-ADICIONAIS-INSTITUICOES>
    <INFORMACAO-ADICIONAL-INSTITUICAO CODIGO-INSTITUICAO="I1" SIGLA-INSTITUICAO="PUC" SIGLA-UF-INSTITUICAO="RS" NOME-PAIS-INSTITUICAO="Brasil" FLAG-INSTITUICAO-DE-ENSINO="SIM" FLAG-AGENCIA-FOMENTO="NAO"/>
    <INFORMACAO-ADICIONAL-INSTITUICAO CODIGO-INSTITUICAO="I2" SIGLA-INSTITUICAO="" SIGLA-PAIS-INSTITUICAO="EUA" FLAG-AGENCIA-FOMENTO="SIM"/>
    <INFORMACAO-ADICIONAL-INSTITUICAO CODIGO-INSTITUICAO="I3" SIGLA-INSTITUICAO="ZZ"/>
    <INFORMACAO-ADICIONAL-INSTITUICAO CODIGO-INSTITUICAO="I4" SIGLA-INSTITUICAO="AA" NOME-PAIS-INSTITUICAO="Brasil"/>
  </INFORMACOES-ADICIONAIS-INSTITUICOES>
  <INFORMACOES-ADICIONAIS-CURSOS>
    <INFORMACAO-ADICIONAL-CURSO CODIGO-CURSO="C1" CODIGO-INSTITUICAO="I1" NOME-INSTITUICAO="PUC" NOME-GRANDE-AREA-DO-CONHECIMENTO="CIENCIAS_SOCIAIS_APLICADAS" NOME-DA-AREA-DO-CONHECIMENTO="Desenho Industrial" NIVEL-CURSO="MESTRADO"/>
    <INFORMACAO-ADICIONAL-CURSO CODIGO-CURSO="C2" CODIGO-INSTITUICAO="I1" NOME-GRANDE-AREA-DO-CONHECIMENTO="LINGUISTICA_LETRAS_E_ARTES" NOME-DA-AREA-DO-CONHECIMENTO="Letras" NOME-DA-SUB-AREA-DO-CONHECIMENTO="Línguas" NIVEL-CURSO="OT"/>
    <INFORMACAO-ADICIONAL-CURSO CODIGO-CURSO="C3"/>
  </INFORMACOES-ADICIONAIS-CURSOS>
</DADOS-COMPLEMENTARES>
</CURRICULO-VITAE>`).root;

const dc = firstChild(CV, 'DADOS-COMPLEMENTARES')!;
const institutions = childElements(firstChild(dc, 'INFORMACOES-ADICIONAIS-INSTITUICOES')!);
const courses = childElements(firstChild(dc, 'INFORMACOES-ADICIONAIS-CURSOS')!);
const index = buildReferenceIndex(CV);

describe('buildReferenceIndex', () => {
  it('resolve nome e usos; partes do item contam como o item, uma vez só', () => {
    expect(index.institutions.get('I1')).toEqual({
      name: 'Pontifícia Universidade Católica',
      usages: [
        { kind: 'Mestrado', period: '2006 – 2007', title: 'Design' },
        { kind: 'Informação adicional curso', period: '', title: 'Design' },
        {
          kind: 'Informação adicional curso',
          period: '',
          title: 'Letras › Línguas',
        },
      ],
    });
    expect(index.institutions.get('I2')?.usages).toEqual([
      { kind: 'Atuação profissional', period: '2014 – 2016', title: 'Empresa Ltda' },
    ]);
    expect(index.courses.get('C1')?.name).toBe('Design');
    expect(index.courses.has('C2')).toBe(false);
  });
});

describe('institutionView', () => {
  const view = institutionView(index);

  it('agrupa por país, maiores primeiro, "Sem país" no fim; mais usadas antes', () => {
    const groups = view.groups(institutions);
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ['Brasil', 2],
      ['EUA', 1],
      ['Sem país', 1],
    ]);
    expect(groups[0]!.items.map((el) => view.card(el).title)).toEqual(['PUC', 'AA']);
  });

  it('cartão: sigla no título, nome completo, UF e marcadores no subtítulo', () => {
    expect(view.card(institutions[0]!)).toMatchObject({
      aside: 'usada em 3 itens',
      subtitle: 'Pontifícia Universidade Católica · RS · instituição de ensino',
      title: 'PUC',
    });
    expect(view.card(institutions[1]!)).toMatchObject({
      aside: 'usada em 1 item',
      subtitle: 'agência de fomento',
      title: 'Empresa Ltda',
    });
    expect(view.card(institutions[2]!)).toMatchObject({ aside: undefined, title: 'ZZ' });
  });
});

describe('courseView', () => {
  const view = courseView(index);

  it('agrupa por grande área com o rótulo do CNPq', () => {
    expect(view.groups(courses).map((g) => g.label)).toEqual([
      'Ciências Sociais Aplicadas',
      'Linguística, Letras e Artes',
      'Sem área',
    ]);
  });

  it('cartão: nome do curso resolvido ou área; nível cru quando não há rótulo', () => {
    expect(view.card(courses[0]!)).toMatchObject({
      aside: 'usado em 1 item',
      subtitle: 'PUC · Mestrado · Desenho Industrial',
      title: 'Design',
    });
    expect(view.card(courses[1]!)).toMatchObject({
      aside: undefined,
      subtitle: 'OT · Letras › Línguas',
      title: 'Letras › Línguas',
    });
    expect(view.card(courses[2]!).title).toBe('C3');
  });
});

it('viewForContainer escolhe a visão pelo contêiner', () => {
  expect(viewForContainer('INFORMACOES-ADICIONAIS-INSTITUICOES', index)).toBeDefined();
  expect(viewForContainer('INFORMACOES-ADICIONAIS-CURSOS', index)).toBeDefined();
  expect(viewForContainer('ARTIGOS-PUBLICADOS', index)).toBeUndefined();
  expect(enumLabel('OT')).toBe('OT');
});
