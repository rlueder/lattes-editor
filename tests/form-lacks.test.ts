import { describe, expect, it } from 'vitest';

import { childLacks, fieldAbsent, formLacks } from '../src/bridge/form-lacks.ts';
import { element, parseXml } from '../src/model/xml.ts';
import { findIn } from './helpers/lattes-simulado.ts';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="P">
<PREMIOS-TITULOS><PREMIO-TITULO NOME-DO-PREMIO-OU-TITULO="Prêmio" NOME-DA-ENTIDADE-PROMOTORA="E" ANO-DA-PREMIACAO="2020" NOME-DO-PREMIO-OU-TITULO-INGLES=""/></PREMIOS-TITULOS>
</DADOS-GERAIS>
<DADOS-COMPLEMENTARES><PARTICIPACAO-EM-EVENTOS-CONGRESSOS>
<PARTICIPACAO-EM-CONGRESSO SEQUENCIA-PRODUCAO="7"><DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO NATUREZA="CONGRESSO" TITULO="Evento" ANO="2019" PAIS="Brasil" IDIOMA="Português" MEIO-DE-DIVULGACAO="IMPRESSO" FLAG-RELEVANCIA="NAO" FORMA-PARTICIPACAO="Ouvinte" TIPO-PARTICIPACAO="" HOME-PAGE-DO-TRABALHO="" DOI="" TITULO-INGLES="" FLAG-DIVULGACAO-CIENTIFICA="NAO"/><DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO NOME-DO-EVENTO="Congresso" CIDADE-DO-EVENTO="Porto Alegre" LOCAL-DO-EVENTO="" NOME-INSTITUICAO="" CODIGO-INSTITUICAO="" NOME-DO-EVENTO-INGLES=""/></PARTICIPACAO-EM-CONGRESSO>
</PARTICIPACAO-EM-EVENTOS-CONGRESSOS></DADOS-COMPLEMENTARES></CURRICULO-VITAE>`;

const pair = () => ({ original: parseXml(XML).root, working: parseXml(XML).root });
const byName = (root: ReturnType<typeof parseXml>['root'], name: string) =>
  findIn(root, (el) => el.name === name)!;

describe('campos que o formulário do Lattes não tem', () => {
  it('trava os do formulário de eventos e o nome do prêmio em inglês', () => {
    const { original, working } = pair();
    const basics = byName(working, 'DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO');
    expect(formLacks(original, working, basics, 'FLAG-RELEVANCIA')).toMatch(
      /^O formulário de eventos do Lattes não tem: Relevância/,
    );
    expect(formLacks(original, working, basics, 'IDIOMA')).toBeDefined();
    expect(formLacks(original, working, basics, 'TITULO')).toBeUndefined();
    expect(formLacks(original, working, basics, 'PAIS')).toBeUndefined();
    const prize = byName(working, 'PREMIO-TITULO');
    expect(formLacks(original, working, prize, 'NOME-DO-PREMIO-OU-TITULO-INGLES')).toMatch(
      /nome em inglês/,
    );
    expect(formLacks(original, working, prize, 'ANO-DA-PREMIACAO')).toBeUndefined();
  });

  it('item novo não trava: vai pelo Importar, com o XML inteiro', () => {
    const { original, working } = pair();
    const container = byName(working, 'PARTICIPACAO-EM-EVENTOS-CONGRESSOS');
    const novo = element('PARTICIPACAO-EM-CONGRESSO', { 'SEQUENCIA-PRODUCAO': '99' }, [
      element('DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO', {
        'FLAG-RELEVANCIA': 'NAO',
        TITULO: 'Novo',
      }),
    ]);
    container.children.push(novo);
    const basics = novo.children[0] as ReturnType<typeof element>;
    expect(formLacks(original, working, basics, 'FLAG-RELEVANCIA')).toBeUndefined();
  });

  it('só a falta do campo trava; valor que o Lattes não aceita, não', () => {
    expect(fieldAbsent('O formulário deste tipo no Lattes não tem: DOI')).toBe(true);
    expect(
      fieldAbsent('O formulário de projeto do Lattes não tem o período da sua participação'),
    ).toBe(true);
    expect(fieldAbsent('A tela da atuação no Lattes não tem: Instituição')).toBe(true);
    expect(fieldAbsent('Dados que o próprio Lattes gera na exportação')).toBe(true);
    expect(fieldAbsent('País que o formulário do Lattes não tem: Atlântida')).toBe(false);
    expect(fieldAbsent('Valor que o formulário de identificação do Lattes não tem: Sexo')).toBe(
      false,
    );
    expect(fieldAbsent('Campos não suportados ainda: Nível')).toBe(false);
  });

  it('palavras-chave novas num evento que já está no Lattes não entram', () => {
    const { original, working } = pair();
    const event = byName(working, 'PARTICIPACAO-EM-CONGRESSO');
    expect(childLacks(original, working, event, 'PALAVRAS-CHAVE')).toMatch(
      /não tem palavras-chave/,
    );
  });
});
