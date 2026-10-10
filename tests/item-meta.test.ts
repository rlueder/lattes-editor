import { describe, expect, it } from 'vitest';

import { parseXml } from '../src/model/xml.ts';
import {
  formatDuration,
  formatPeriod,
  groupByYear,
  isListItem,
  itemMeta,
} from '../src/ui/item-meta.ts';

const el = (xml: string) => parseXml(xml).root;
const TODAY = new Date(2026, 9, 10);

const atuacao = (vinculos: string) =>
  el(`<ATUACAO-PROFISSIONAL NOME-INSTITUICAO="Empresa">${vinculos}</ATUACAO-PROFISSIONAL>`);

describe('itemMeta: períodos', () => {
  it('junta vários vínculos: menor início, maior fim, papel do mais recente', () => {
    const meta = itemMeta(
      atuacao(
        '<VINCULOS ANO-INICIO="2016" MES-INICIO="8" ANO-FIM="2018" MES-FIM="1" OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO="Designer"/>' +
          '<VINCULOS ANO-INICIO="2018" MES-INICIO="2" ANO-FIM="2020" MES-FIM="9" OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO="Diretor de design"/>',
      ),
    );
    expect(meta.title).toBe('Empresa');
    expect(meta.subtitle).toBe('Diretor de design');
    expect(formatPeriod(meta)).toBe('ago 2016 – set 2020');
    expect(formatDuration(meta, TODAY)).toBe('4 anos e 2 meses');
    expect(meta.groupYear).toBe(2020);
  });

  it('vínculo sem ano de fim é atual', () => {
    const meta = itemMeta(atuacao('<VINCULOS ANO-INICIO="2025" MES-INICIO="1" ANO-FIM=""/>'));
    expect(meta.current).toBe(true);
    expect(formatPeriod(meta)).toBe('jan 2025 – atual');
    expect(formatDuration(meta, TODAY)).toBe('1 ano e 10 meses');
  });

  it('usa o enquadramento codificado quando não há texto livre', () => {
    const meta = itemMeta(
      atuacao(
        '<VINCULOS ANO-INICIO="2020" ANO-FIM="2021" ENQUADRAMENTO-FUNCIONAL="PROFESSOR_TITULAR"/>',
      ),
    );
    expect(meta.subtitle).toBe('Professor titular');
    expect(
      itemMeta(
        atuacao('<VINCULOS ANO-INICIO="2020" ANO-FIM="2021" ENQUADRAMENTO-FUNCIONAL="OUTRO"/>'),
      ).subtitle,
    ).toBe('');
  });

  it('formação: curso como título, instituição no subtítulo, em andamento é atual', () => {
    const meta = itemMeta(
      el(
        '<MESTRADO NOME-CURSO="Design" NOME-INSTITUICAO="Unisinos" ANO-DE-INICIO="2026" ANO-DE-CONCLUSAO="2028" STATUS-DO-CURSO="EM_ANDAMENTO"/>',
      ),
    );
    expect(meta.title).toBe('Design');
    expect(meta.subtitle).toBe('Unisinos');
    expect(meta.current).toBe(true);
  });

  it('anos sem mês, mesmo ano de início e fim, e só início', () => {
    const range = itemMeta(el('<GRADUACAO ANO-DE-INICIO="2001" ANO-DE-CONCLUSAO="2004"/>'));
    expect(formatPeriod(range)).toBe('2001 – 2004');
    expect(formatDuration(range, TODAY)).toBe('3 anos');
    expect(formatPeriod(itemMeta(el('<X ANO-INICIO="2009" ANO-FIM="2009"/>')))).toBe('2009');
    expect(formatDuration(itemMeta(el('<X ANO-INICIO="2009" ANO-FIM="2009"/>')), TODAY)).toBe('');
    const curso = itemMeta(el('<X ANO-INICIO="2009" FLAG-PERIODO="ANTERIOR"/>'));
    expect(formatPeriod(curso)).toBe('2009 – atual');
  });

  it('meses curtos e mês inválido', () => {
    const short = itemMeta(el('<X ANO-INICIO="2024" MES-INICIO="10" ANO-FIM="2025" MES-FIM="1"/>'));
    expect(formatDuration(short, TODAY)).toBe('4 meses');
    expect(
      formatPeriod(itemMeta(el('<X ANO-INICIO="2024" MES-INICIO="13" ANO-FIM="2025"/>'))),
    ).toBe('2024 – 2025');
  });
});

describe('itemMeta: itens pontuais', () => {
  it('produção: título e ano dos dados básicos, periódico no subtítulo', () => {
    const meta = itemMeta(
      el(
        '<ARTIGO-PUBLICADO SEQUENCIA-PRODUCAO="3"><DADOS-BASICOS-DO-ARTIGO TITULO-DO-ARTIGO="Um artigo" ANO-DO-ARTIGO="2023"/><DETALHAMENTO-DO-ARTIGO TITULO-DO-PERIODICO-OU-REVISTA="Revista X"/></ARTIGO-PUBLICADO>',
      ),
    );
    expect(meta).toMatchObject({
      groupYear: 2023,
      subtitle: 'Revista X',
      title: 'Um artigo',
      year: 2023,
    });
    expect(formatPeriod(meta)).toBe('2023');
    expect(formatDuration(meta)).toBe('');
  });

  it('evento sem título usa o nome do evento e mostra a forma de participação', () => {
    const meta = itemMeta(
      el(
        '<PARTICIPACAO-EM-CONGRESSO><DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO TITULO="" ANO="2007" FORMA-PARTICIPACAO="OUVINTE"/><DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO NOME-DO-EVENTO="P&amp;D Design"/></PARTICIPACAO-EM-CONGRESSO>',
      ),
    );
    expect(meta.title).toBe('P&D Design');
    expect(meta.subtitle).toBe('Ouvinte');
  });

  it('sem ano nem título', () => {
    const meta = itemMeta(el('<X OUTRO="1"/>'));
    expect(meta).toMatchObject({ current: false, groupYear: undefined, title: '' });
    expect(formatPeriod(meta)).toBe('');
  });
});

describe('groupByYear', () => {
  it('atual primeiro, depois anos decrescentes, sem ano no fim; ordem estável', () => {
    const items = [
      el('<A ID="a" ANO="2020"/>'),
      el('<A ID="b"/>'),
      el('<A ID="c" ANO-INICIO="2021" ANO-FIM=""/>'),
      el('<A ID="d" ANO="2023"/>'),
      el('<A ID="e" ANO="2020"/>'),
    ];
    const groups = groupByYear(items);
    expect(groups.map((g) => g.label)).toEqual(['Atual', '2023', '2020', 'Sem ano']);
    expect(groups[2]!.items.map((i) => i.el.attrs[0]!.value)).toEqual(['a', 'e']);
  });
});

describe('isListItem', () => {
  it('item tem atributos ou dados básicos; contêiner puro não', () => {
    expect(isListItem(el('<A X="1"/>'))).toBe(true);
    expect(isListItem(el('<A><DADOS-BASICOS-DO-X/></A>'))).toBe(true);
    expect(isListItem(el('<A><B X="1"/></A>'))).toBe(false);
  });
});
