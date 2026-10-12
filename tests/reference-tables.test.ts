import { describe, expect, it } from 'vitest';

import { enumLabel } from '../src/labels/labels.ts';
import { childElements, firstChild, parseXml } from '../src/model/xml.ts';
import type { Usage } from '../src/ui/list-view.ts';
import {
  buildReferenceIndex,
  courseView,
  groupUsages,
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
        {
          group: 'Formação acadêmica/titulação',
          kind: 'Mestrado',
          period: '2006 – 2007',
          sortKey: 200700,
          title: 'Design',
        },
        {
          group: 'Informações adicionais de cursos',
          kind: 'Informação adicional curso',
          period: '',
          sortKey: 0,
          title: 'Design',
        },
        {
          group: 'Informações adicionais de cursos',
          kind: 'Informação adicional curso',
          period: '',
          sortKey: 0,
          title: 'Letras › Línguas',
        },
      ],
    });
    // O código também está em VINCULOS; o grupo é o contêiner do item
    // (ATUACOES-PROFISSIONAIS, que o Lattes chama no singular).
    expect(index.institutions.get('I2')?.usages).toEqual([
      {
        group: 'Atuação profissional',
        kind: 'Atuação profissional',
        period: '2014 – 2016',
        sortKey: 201600,
        title: 'Empresa Ltda',
      },
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
    const orphan = parseXml(
      '<INFORMACAO-ADICIONAL-INSTITUICAO CODIGO-INSTITUICAO="000700000992" SIGLA-INSTITUICAO=""/>',
    ).root;
    expect(view.card(orphan)).toMatchObject({
      subtitle: 'código 000700000992 · não aparece em nenhum item',
      title: 'Instituição sem nome no arquivo',
    });
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

  it('cartão: nome do curso resolvido ou área; nível sem rótulo fica de fora', () => {
    expect(view.card(courses[0]!)).toMatchObject({
      aside: 'usado em 1 item',
      subtitle: 'PUC · Mestrado · Desenho Industrial',
      title: 'Design',
    });
    expect(view.card(courses[1]!)).toMatchObject({
      aside: undefined,
      subtitle: 'Letras › Línguas',
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

describe('groupUsages', () => {
  const usage = (group: string, kind: string, title: string, sortKey = 0, period = ''): Usage => ({
    group,
    kind,
    period,
    sortKey,
    title,
  });

  it('um grupo por contêiner, em ordem alfabética do pt-BR, com a contagem', () => {
    const groups = groupUsages([
      usage('Orientações concluídas', 'Orientações concluídas para mestrado', 'B'),
      usage('Atuações profissionais', 'Atuação profissional', 'A'),
      usage('Ênfase', 'Ênfase', 'E'),
      usage('Orientações concluídas', 'Outras orientações concluídas', 'C'),
      usage('Formação acadêmica/titulação', 'Mestrado', 'D'),
    ]);
    // "Ênfase" fica entre "Atuações" e "Formação", não no fim como no código.
    expect(groups.map((g) => [g.label, g.usages.length])).toEqual([
      ['Atuações profissionais', 1],
      ['Ênfase', 1],
      ['Formação acadêmica/titulação', 1],
      ['Orientações concluídas', 2],
    ]);
  });

  it('dentro do grupo: período mais recente primeiro, depois o título', () => {
    const [group] = groupUsages([
      usage('G', 'K', 'sem período'),
      usage('G', 'K', 'Zeta', 202000, '2020'),
      usage('G', 'K', 'atual', 10_201_800, '2018 – atual'),
      usage('G', 'K', 'Álgebra', 202000, '2020'),
      usage('G', 'K', 'antigo', 199500, '1995'),
    ]);
    expect(group!.usages.map((u) => u.title)).toEqual([
      'atual',
      'Álgebra',
      'Zeta',
      'antigo',
      'sem período',
    ]);
  });

  it('marca grupos com tipos diferentes e não altera a lista recebida', () => {
    const input = [
      usage('Orientações concluídas', 'Orientações concluídas para mestrado', 'B'),
      usage('Orientações concluídas', 'Outras orientações concluídas', 'A'),
      usage('Atuações profissionais', 'Atuação profissional', 'C'),
    ];
    const groups = groupUsages(input);
    expect(groups.map((g) => g.mixedKinds)).toEqual([false, true]);
    expect(input.map((u) => u.title)).toEqual(['B', 'A', 'C']);
    expect(groupUsages([])).toEqual([]);
  });

  it('no índice, um item sem contêiner agrupa pelo próprio tipo', () => {
    const lone = parseXml('<MESTRADO CODIGO-INSTITUICAO="X" ANO-DE-CONCLUSAO="2001"/>').root;
    expect(buildReferenceIndex(lone).institutions.get('X')?.usages[0]?.group).toBe('Mestrado');
  });
});
