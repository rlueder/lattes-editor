import { describe, expect, it } from 'vitest';

import { parseXml } from '../src/model/xml.ts';
import {
  clickOpensEditor,
  curlyQuotes,
  displayValue,
  formatCep,
  hiddenNote,
  paragraphs,
  readingKeyAction,
  type ReadingKeyContext,
  tabWidth,
  yearColumn,
} from '../src/ui/reading.ts';

const el = (xml: string) => parseXml(xml).root;

describe('modo de leitura: ler e editar', () => {
  const reading: ReadingKeyContext = {
    afterGo: false,
    editing: false,
    handled: false,
    modifier: false,
    onBlock: true,
  };
  const editing = { ...reading, editing: true, onBlock: false };

  it('E, e ou Enter no bloco focado abrem a edição', () => {
    expect(readingKeyAction('e', reading)).toBe('edit');
    expect(readingKeyAction('E', reading)).toBe('edit');
    expect(readingKeyAction('Enter', reading)).toBe('edit');
    expect(readingKeyAction('x', reading)).toBeNull();
    expect(readingKeyAction('Escape', reading)).toBeNull();
  });

  it('não abre fora do bloco, com modificador, depois de G ou se a tecla já foi tratada', () => {
    expect(readingKeyAction('e', { ...reading, onBlock: false })).toBeNull();
    expect(readingKeyAction('e', { ...reading, modifier: true })).toBeNull();
    expect(readingKeyAction('e', { ...reading, afterGo: true })).toBeNull();
    expect(readingKeyAction('e', { ...reading, handled: true })).toBeNull();
  });

  it('Esc em edição volta à leitura; as outras teclas são dos campos', () => {
    expect(readingKeyAction('Escape', editing)).toBe('close');
    expect(readingKeyAction('e', editing)).toBeNull();
    expect(readingKeyAction('Enter', editing)).toBeNull();
    // O Esc que fechou uma lista de opções não fecha a edição junto.
    expect(readingKeyAction('Escape', { ...editing, handled: true })).toBeNull();
  });

  it('o clique abre a edição, menos ao selecionar texto ou num link ou botão', () => {
    expect(clickOpensEditor('', false)).toBe(true);
    expect(clickOpensEditor('  ', false)).toBe(true);
    expect(clickOpensEditor('Porto Alegre', false)).toBe(false);
    expect(clickOpensEditor('', true)).toBe(false);
  });

  it('dois ou três cliques selecionam texto e não abrem', () => {
    expect(clickOpensEditor('', false, 1)).toBe(true);
    expect(clickOpensEditor('', false, 2)).toBe(false);
    expect(clickOpensEditor('', false, 3)).toBe(false);
  });
});

describe('modo de leitura: campos', () => {
  it('resume os dados escondidos numa linha', () => {
    expect(hiddenNote(1)).toBe('1 dado pessoal oculto pelo modo de privacidade.');
    expect(hiddenNote(12)).toBe('12 dados pessoais ocultos pelo modo de privacidade.');
  });

  it('escreve enum, sim/não, códigos e citações por extenso', () => {
    const dg = el(
      `<DADOS-GERAIS SEXO="FEMININO" NACIONALIDADE="B" NOME-EM-CITACOES-BIBLIOGRAFICAS="LIMA, A.;LIMA, ANA" PERMISSAO-DE-DIVULGACAO="NAO"/>`,
    );
    expect(displayValue(dg, 'SEXO', 'FEMININO')).toBe('Feminino');
    expect(displayValue(dg, 'NACIONALIDADE', 'B')).toBe('Brasileira');
    expect(displayValue(dg, 'NOME-EM-CITACOES-BIBLIOGRAFICAS', 'LIMA, A.;LIMA, ANA')).toBe(
      'LIMA, A.; LIMA, ANA',
    );
    expect(displayValue(dg, 'PERMISSAO-DE-DIVULGACAO', 'NAO')).toBe('Não');
    expect(displayValue(dg, 'PERMISSAO-DE-DIVULGACAO', 'SIM')).toBe('Sim');
  });

  it('lê pelo rótulo o valor que outro elemento enumera no mesmo atributo', () => {
    const pos = el(`<POS-DOUTORADO STATUS-DO-CURSO="CONCLUIDO"/>`);
    expect(displayValue(pos, 'STATUS-DO-CURSO', 'CONCLUIDO')).toBe('Concluído');
    expect(displayValue(pos, 'STATUS-DO-CURSO', 'em andamento')).toBe('em andamento');
  });
});

describe('modo de leitura: texto', () => {
  it('troca aspas e apóstrofos retos por curvos', () => {
    expect(curlyQuotes('o "projeto" da d\'Ávila')).toBe('o “projeto” da d’Ávila');
    expect(curlyQuotes('\'Butia\' ("palmeira")')).toBe('‘Butia’ (“palmeira”)');
    expect(curlyQuotes('sem aspas')).toBe('sem aspas');
    // Aspas dentro de aspas abrem nos dois níveis.
    expect(curlyQuotes(`"'x'"`)).toBe('\u201c\u2018x\u2019\u201d');
    expect(curlyQuotes(`'"x"'`)).toBe('\u2018\u201cx\u201d\u2019');
  });

  it('separa parágrafos pelas quebras de linha e descarta linhas vazias', () => {
    expect(paragraphs('Um.\n\nDois.\r\nTrês.  ')).toEqual(['Um.', 'Dois.', 'Três.']);
    expect(paragraphs('')).toEqual([]);
  });

  it('a coluna da esquerda tem a largura do texto mais longo, no mínimo um ano', () => {
    expect(tabWidth(['2024', '2023'])).toBe(4);
    expect(tabWidth(['2016 – 2018', '2011'])).toBe(11);
    expect(tabWidth([])).toBe(4);
    expect(tabWidth(['', ''])).toBe(4);
  });

  it('formata só o CEP de oito dígitos', () => {
    expect(formatCep('91501970')).toBe('91501-970');
    expect(formatCep('91501-970')).toBe('91501-970');
    expect(formatCep('SW1A 1AA')).toBe('SW1A 1AA');
  });

  it('mostra o ano só na primeira linha de cada sequência', () => {
    expect(yearColumn(['2024', '2024', '2023', '', '', '2023'])).toEqual([
      { shown: '2024', value: '2024' },
      { shown: '', value: '2024' },
      { shown: '2023', value: '2023' },
      { shown: '', value: '' },
      { shown: '', value: '' },
      { shown: '2023', value: '2023' },
    ]);
  });
});
