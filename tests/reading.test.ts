import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { element, firstChild, parseXml } from '../src/model/xml.ts';
import {
  addressLines,
  clickOpensEditor,
  curlyQuotes,
  displayValue,
  formatCep,
  formationEntry,
  hasData,
  hiddenNote,
  isProse,
  isReadingSection,
  paragraphs,
  readingFields,
  readingKeyAction,
  type ReadingKeyContext,
  readingRequested,
  showEmptySettingVisible,
  tabWidth,
  yearColumn,
} from '../src/ui/reading.ts';

const el = (xml: string) => parseXml(xml).root;

const fixture = async (name: string) => {
  const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, '../fixtures', name)));
  return (await loadCv(bytes, name)).doc.root;
};

describe('modo de leitura: a chave na URL', () => {
  it('vale com ?leitura no pnpm dev e some no build', () => {
    expect(readingRequested('?leitura', true)).toBe(true);
    expect(readingRequested('?exemplo=demo&leitura=1', true)).toBe(true);
    expect(readingRequested('?leitura', false)).toBe(false);
  });

  it('fica desligado sem a chave ou com ?leitura=0', () => {
    expect(readingRequested('', true)).toBe(false);
    expect(readingRequested('?exemplo=demo', true)).toBe(false);
    expect(readingRequested('?leitura=0', true)).toBe(false);
  });

  it('só vale para Dados gerais, Formação e Produções', () => {
    expect(isReadingSection('dados-gerais', true)).toBe(true);
    expect(isReadingSection('formacao', true)).toBe(true);
    expect(isReadingSection('producoes', true)).toBe(true);
    expect(isReadingSection('atuacao', true)).toBe(false);
    expect(isReadingSection('producoes', false)).toBe(false);
  });
});

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

  it('o ⚙ "Mostrar campos vazios" sai do menu no modo de leitura', () => {
    expect(showEmptySettingVisible(true)).toBe(false);
    expect(showEmptySettingVisible(false)).toBe(true);
  });
});

describe('modo de leitura: campos', () => {
  const opts = { hideSensitive: false, showCodes: false };

  it('esconde campos vazios, sequências, formato de data e códigos do Lattes', () => {
    const dg = el(
      `<DADOS-GERAIS NOME-COMPLETO="Ana Lima" NUMERO-DO-PASSAPORTE="" SEQUENCIA-X="3" FORMATO-DATA-DE-NASCIMENTO="DDMMAAAA" DATA-NASCIMENTO="03051986" SIGLA-PAIS-NACIONALIDADE="BRA" PAIS-DE-NASCIMENTO="Brasil"/>`,
    );
    const fields = readingFields(dg, opts);
    expect(fields.map((f) => f.attr)).toEqual([
      'NOME-COMPLETO',
      'DATA-NASCIMENTO',
      'PAIS-DE-NASCIMENTO',
    ]);
    expect(fields.find((f) => f.attr === 'DATA-NASCIMENTO')?.text).toBe('03/05/1986');
  });

  it('mostra os códigos quando "Mostrar códigos do Lattes" está ligado', () => {
    const dg = el(`<DADOS-GERAIS NOME-COMPLETO="Ana" SIGLA-PAIS-NACIONALIDADE="BRA"/>`);
    const attrs = readingFields(dg, { ...opts, showCodes: true }).map((f) => f.attr);
    expect(attrs).toContain('SIGLA-PAIS-NACIONALIDADE');
  });

  it('mascara os dados sensíveis no modo de privacidade, sem pôr o valor na tela', () => {
    const dg = el(
      `<DADOS-GERAIS NOME-COMPLETO="Ana" DATA-NASCIMENTO="03051986" NOME-DA-MAE="Marta"/>`,
    );
    const fields = readingFields(dg, { ...opts, hideSensitive: true });
    expect(fields.find((f) => f.attr === 'NOME-COMPLETO')).toMatchObject({
      masked: false,
      text: 'Ana',
    });
    expect(fields.find((f) => f.attr === 'NOME-DA-MAE')).toMatchObject({ masked: true, text: '' });
    expect(fields.find((f) => f.attr === 'DATA-NASCIMENTO')?.text).toBe('');
  });

  it('só o texto longo vira parágrafo sem rótulo', () => {
    const base = { attr: 'X', label: 'X', masked: false };
    expect(isProse({ ...base, text: 'Brasil' })).toBe(false);
    expect(isProse({ ...base, text: 'a'.repeat(91) })).toBe(true);
    expect(isProse({ ...base, masked: true, text: '' })).toBe(false);
    expect(isProse({ ...base, text: 'a'.repeat(91), url: 'https://x' })).toBe(false);
  });

  it('acha dado em qualquer nível, inclusive só nos netos', () => {
    expect(hasData(el('<A X=""><B Y=""/></A>'))).toBe(false);
    expect(hasData(el('<A X=""><B><C Z="1"/></B></A>'))).toBe(true);
    expect(hasData(el('<A X="1"/>'))).toBe(true);
  });

  it('resume os dados escondidos numa linha', () => {
    expect(hiddenNote(1)).toBe('1 dado pessoal oculto pelo modo de privacidade.');
    expect(hiddenNote(12)).toBe('12 dados pessoais ocultos pelo modo de privacidade.');
  });

  it('deixa de fora o que outro trecho da leitura já mostra', () => {
    const dg = el(`<DADOS-GERAIS NOME-COMPLETO="Ana" TEXTO-RESUMO-CV-RH="Resumo"/>`);
    const fields = readingFields(dg, { ...opts, except: new Set(['TEXTO-RESUMO-CV-RH']) });
    expect(fields.map((f) => f.attr)).toEqual(['NOME-COMPLETO']);
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

  it('transforma página e ORCID em link', () => {
    const dg = el(`<DADOS-GERAIS ORCID-ID="https://orcid.org/0000-0002-1825-0097"/>`);
    expect(readingFields(dg, { ...opts, showCodes: true })[0]?.url).toBe(
      'https://orcid.org/0000-0002-1825-0097',
    );
    const prof = el(`<ENDERECO-PROFISSIONAL HOME-PAGE="ufrgs.br"/>`);
    expect(readingFields(prof, opts)[0]?.url).toBeUndefined();
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

  it('compõe o endereço em linhas, com CEP formatado', () => {
    const prof = element('ENDERECO-PROFISSIONAL', {
      BAIRRO: 'Agronomia',
      CEP: '91501970',
      CIDADE: 'Porto Alegre',
      'LOGRADOURO-COMPLEMENTO': 'Avenida Bento Gonçalves, 9500',
      'NOME-INSTITUICAO-EMPRESA': 'Universidade Federal do Rio Grande do Sul',
      'NOME-UNIDADE': 'Departamento de Genética',
      PAIS: 'Brasil',
      UF: 'RS',
    });
    expect(addressLines(prof)).toEqual([
      'Universidade Federal do Rio Grande do Sul, Departamento de Genética',
      'Avenida Bento Gonçalves, 9500, Agronomia',
      'Porto Alegre – RS',
      '91501-970, Brasil',
    ]);
    expect(addressLines(element('ENDERECO-RESIDENCIAL', { LOGRADOURO: 'Rua A', UF: '' }))).toEqual([
      'Rua A',
    ]);
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

describe('modo de leitura: formação', () => {
  it('compõe nível e curso, instituição, trabalho, orientação e bolsa', () => {
    const mestrado = el(
      `<MESTRADO NOME-CURSO="Genética" NOME-INSTITUICAO="UFRGS" TITULO-DA-DISSERTACAO-TESE="Estrutura &quot;genética&quot;" TITULO-DA-DISSERTACAO-TESE-INGLES="Genetic structure" NOME-COMPLETO-DO-ORIENTADOR="Paulo Mendes" NOME-DO-CO-ORIENTADOR="Helena Vieira" FLAG-BOLSA="SIM" NOME-AGENCIA="CAPES"/>`,
    );
    expect(formationEntry(mestrado, 'Mestrado')).toEqual({
      degree: 'Mestrado em Genética',
      institution: 'UFRGS',
      notes: ['Orientação: Paulo Mendes; coorientação: Helena Vieira', 'Bolsa: CAPES'],
      work: 'Estrutura “genética”',
    });
  });

  it('sem curso fica só o nível; agência sem bolsa não vira bolsa', () => {
    const pos = el(
      `<POS-DOUTORADO NOME-INSTITUICAO="USP" FLAG-BOLSA="NAO" NOME-AGENCIA="FAPESP"/>`,
    );
    expect(formationEntry(pos, 'Pós-doutorado')).toEqual({
      degree: 'Pós-doutorado',
      institution: 'USP',
      notes: ['Agência: FAPESP'],
      work: undefined,
    });
  });

  it('lê a formação do currículo de demonstração', async () => {
    const root = await fixture('demo.xml');
    const dg = firstChild(root, 'DADOS-GERAIS')!;
    const doutorado = firstChild(firstChild(dg, 'FORMACAO-ACADEMICA-TITULACAO')!, 'DOUTORADO')!;
    const entry = formationEntry(doutorado, 'Doutorado');
    expect(entry.degree).toBe('Doutorado em Genética e Biologia Molecular');
    expect(entry.notes[0]).toMatch(/^Orientação: /);
  });
});
