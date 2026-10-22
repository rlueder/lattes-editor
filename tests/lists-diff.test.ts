import { describe, expect, it } from 'vitest';

import type { ListSnapshot } from '../src/census/test-ledger.ts';
import { parseXml } from '../src/model/xml.ts';
import { compareWithLattes, diffLists } from '../src/review/lists-diff.ts';

// Linhas no formato das listas do Lattes real (lidas em 21/10/2026), com dados
// inventados.
const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Exemplo">
<FORMACAO-ACADEMICA-TITULACAO><MESTRADO SEQUENCIA-FORMACAO="1" NOME-INSTITUICAO="Universidade Exemplo" NOME-CURSO="Design" ANO-DE-INICIO="2006" ANO-DE-CONCLUSAO="2007"/></FORMACAO-ACADEMICA-TITULACAO>
<ATUACOES-PROFISSIONAIS>
<ATUACAO-PROFISSIONAL NOME-INSTITUICAO="Empresa Exemplo Ltda." SEQUENCIA-ATIVIDADE="24"><VINCULOS MES-INICIO="01" ANO-INICIO="2011" MES-FIM="12" ANO-FIM="2012" OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO="Designer"/></ATUACAO-PROFISSIONAL>
<ATUACAO-PROFISSIONAL NOME-INSTITUICAO="Outra Empresa S.A." SEQUENCIA-ATIVIDADE="3"><VINCULOS MES-INICIO="07" ANO-INICIO="2008" OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO="Desenvolvedor"/></ATUACAO-PROFISSIONAL>
</ATUACOES-PROFISSIONAIS>
<PREMIOS-TITULOS><PREMIO-TITULO NOME-DO-PREMIO-OU-TITULO="Prêmio de Exemplo" NOME-DA-ENTIDADE-PROMOTORA="Entidade" ANO-DA-PREMIACAO="2015"/></PREMIOS-TITULOS>
<IDIOMAS><IDIOMA IDIOMA="EN" DESCRICAO-DO-IDIOMA="Inglês"/></IDIOMAS>
</DADOS-GERAIS>
<PRODUCAO-TECNICA><TRABALHO-TECNICO SEQUENCIA-PRODUCAO="5"><DADOS-BASICOS-DO-TRABALHO-TECNICO TITULO-DO-TRABALHO-TECNICO="Relatório Anual de Exemplo" ANO="2005"/></TRABALHO-TECNICO></PRODUCAO-TECNICA>
<DADOS-COMPLEMENTARES><PARTICIPACAO-EM-EVENTOS-CONGRESSOS>
<PARTICIPACAO-EM-CONGRESSO SEQUENCIA-PRODUCAO="7"><DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO NATUREZA="Congresso" ANO="2007" FORMA-PARTICIPACAO="Ouvinte"/><DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO NOME-DO-EVENTO="Congresso de Exemplo"/></PARTICIPACAO-EM-CONGRESSO>
</PARTICIPACAO-EM-EVENTOS-CONGRESSOS></DADOS-COMPLEMENTARES>
</CURRICULO-VITAE>`;

const row = (text: string, link = '') => ({ link, text });

function lattes(): ListSnapshot {
  return {
    'pkg_ativ.cargos_vinculos?f_codinst=V1&f_seq_ativ=24': [row('01/2011 12/2012 Designer')],
    'pkg_ativ.cargos_vinculos?f_codinst=V2&f_seq_ativ=3': [row('07/2008 - Desenvolvedor')],
    'pkg_ativ.lista?': [
      row('Empresa Exemplo Ltda. EXEMPLO De 2011 até 2012'),
      row('Outra Empresa S.A. OUTRA De 2008 até o presente'),
    ],
    'pkg_dic_autor.lista?': [row('Pessoa Exemplo EXEMPLO, P. 3 0')],
    'pkg_evento.lista?': [row('Congresso de Exemplo Ouvinte 2007 -', 'PKG_EVENTO.form?f_seq=7')],
    'pkg_evento.lista?f_sta_divulgacao_cientifica=S': [
      row('Congresso de Exemplo Ouvinte 2007 -', 'PKG_EVENTO.form?f_seq=7'),
    ],
    'pkg_formacao.lista?f_tipo=FA': [row('2006... 2007 Mestrado Universidade Exemplo')],
    'pkg_idioma.lista?': [row('Inglês Bem Bem Bem Bem')],
    'pkg_premio.lista?': [row('Prêmio de Exemplo Entidade 2015')],
    'pkg_relatorio.lista?': [row('Relatório Anual de Exemplo 2005')],
  };
}

const root = () => parseXml(XML).root;

describe('comparação pelas listas do Lattes, todas as seções', () => {
  it('tudo nas listas: nada a mais, nada a menos, e o evento das duas listas conta uma vez', () => {
    const d = diffLists(lattes(), root());
    expect(d).toMatchObject({ onlyInExport: [], onlyInLattes: [], scope: 'listas' });
    expect(d.notCompared).toBeUndefined();
  });

  it('uma atuação e um vínculo tirados no Lattes aparecem como só na exportação', () => {
    const lists = lattes();
    lists['pkg_ativ.lista?'] = [lists['pkg_ativ.lista?']![0]!];
    lists['pkg_ativ.cargos_vinculos?f_codinst=V1&f_seq_ativ=24'] = [
      row('03/2013 12/2014 Consultor'),
    ];
    const d = diffLists(lists, root());
    expect(d.onlyInExport.map((x) => x.title)).toEqual([
      'Outra Empresa S.A.',
      'Empresa Exemplo Ltda.: vínculo de 01/2011',
    ]);
    expect(d.onlyInLattes).toEqual([
      {
        group: 'Vínculos e atividades: Empresa Exemplo Ltda.',
        section: 'Atuação',
        text: '03/2013 12/2014 Consultor',
      },
    ]);
  });

  it('seção que a exportação não tem não vira item a comparar', () => {
    const lists = lattes();
    lists['pkg_formacao_compl.lista?'] = [row('2010 2010 Curso de Exemplo Escola')];
    const d = diffLists(lists, root());
    expect(d.onlyInExport).toEqual([]);
    expect(d.onlyInLattes).toEqual([
      { section: 'Formação complementar', text: '2010 2010 Curso de Exemplo Escola' },
    ]);
  });

  it('o que o Lattes tem a mais aparece com a seção, e o dicionário não conta', () => {
    const lists = lattes();
    lists['pkg_premio.lista?']!.push(row('Outro Prêmio Entidade 2020'));
    lists['pkg_dic_autor.lista?']!.push(row('Outra Pessoa OUTRA, P. 1 0'));
    const d = diffLists(lists, root());
    expect(d.onlyInLattes).toEqual([
      { section: 'Prêmios e títulos', text: 'Outro Prêmio Entidade 2020' },
    ]);
  });

  it('a chave casa palavras inteiras: "Design" não acha "Designer"', () => {
    const lists = lattes();
    lists['pkg_formacao.lista?f_tipo=FA'] = [
      row('2006... 2007 Mestrado Universidade Exemplo Designer'),
    ];
    expect(diffLists(lists, root()).onlyInExport).toEqual([]);
    lists['pkg_relatorio.lista?'] = [row('Relatório Anual de Exemplos 2005')];
    expect(diffLists(lists, root()).onlyInExport.map((x) => x.title)).toEqual([
      'Relatório Anual de Exemplo',
    ]);
  });

  it('lista que não veio, ou veio vazia com itens na exportação: a seção não é comparada', () => {
    const lists = lattes();
    delete lists['pkg_idioma.lista?'];
    lists['pkg_premio.lista?'] = [];
    const d = diffLists(lists, root());
    expect(d.notCompared).toEqual(['Prêmios e títulos', 'Idiomas']);
    expect(d.onlyInExport).toEqual([]);
  });

  it('nenhuma linha em lista nenhuma: a leitura não serviu', () => {
    const empty = Object.fromEntries(Object.keys(lattes()).map((k) => [k, []]));
    expect(diffLists(empty, root())).toMatchObject({ scope: 'listas', unreadable: true });
  });

  it('sem as listas (extensão antiga), compara pela página de conferência', () => {
    expect(compareWithLattes({ lists: lattes() }, root())?.scope).toBe('listas');
    expect(compareWithLattes({ items: [] }, root())?.scope).toBe('pagina');
    expect(compareWithLattes({}, root())).toBeUndefined();
  });

  it('número de atuação que não é só dígito não vira padrão', () => {
    const xml = XML.replace('SEQUENCIA-ATIVIDADE="24"', 'SEQUENCIA-ATIVIDADE="2(4"');
    expect(() => diffLists(lattes(), parseXml(xml).root)).not.toThrow();
  });

  it('lista que falhou na leitura deixa a seção como não comparada; "*" deixa todas', () => {
    expect(diffLists(lattes(), root(), ['pkg_premio.lista?']).notCompared).toEqual([
      'Prêmios e títulos',
    ]);
    expect(diffLists(lattes(), root(), ['*'])).toMatchObject({ unreadable: true });
  });

  it('atuação sem a página de vínculos entre as listas: os vínculos dela não são comparados', () => {
    const lists = lattes();
    delete lists['pkg_ativ.cargos_vinculos?f_codinst=V2&f_seq_ativ=3'];
    const d = diffLists(lists, root());
    expect(d.notCompared).toEqual(['Vínculos e atividades: Outra Empresa S.A.']);
    expect(d.onlyInExport).toEqual([]);
  });

  it('prêmio sem nome não é comparado pelo ano sozinho', () => {
    const xml = XML.replace(
      'NOME-DO-PREMIO-OU-TITULO="Prêmio de Exemplo"',
      'NOME-DO-PREMIO-OU-TITULO=""',
    );
    const lists = lattes();
    lists['pkg_premio.lista?'] = [row('Outro Prêmio 2015')];
    const d = diffLists(lists, parseXml(xml).root);
    expect(d.skipped).toBe(1);
    expect(d.onlyInLattes).toEqual([{ section: 'Prêmios e títulos', text: 'Outro Prêmio 2015' }]);
  });

  it('lista desconhecida com linhas não vira "só no Lattes": sai como não comparada', () => {
    const lists = lattes();
    lists['pkg_revisor.lista?f_natur=RV'] = [row('Revista de Exemplo 2019')];
    const d = diffLists(lists, root());
    expect(d.onlyInLattes).toEqual([]);
    expect(d.notCompared).toEqual(['Outras listas do Lattes']);
  });

  it('banca entra como produção, não como evento', () => {
    const xml = XML.replace(
      '<DADOS-COMPLEMENTARES>',
      '<DADOS-COMPLEMENTARES><PARTICIPACAO-EM-BANCA-TRABALHOS-CONCLUSAO><PARTICIPACAO-EM-BANCA-DE-MESTRADO SEQUENCIA-PRODUCAO="9"><DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO TITULO="Dissertação de Exemplo" ANO="2018"/></PARTICIPACAO-EM-BANCA-DE-MESTRADO></PARTICIPACAO-EM-BANCA-TRABALHOS-CONCLUSAO>',
    );
    const lists = lattes();
    lists['pkg_banca_trab.lista?'] = [row('Aluno. Dissertação de Exemplo. 2018. Mestrado')];
    expect(diffLists(lists, parseXml(xml).root)).toMatchObject({
      onlyInExport: [],
      onlyInLattes: [],
    });
  });
});
