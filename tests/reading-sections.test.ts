// O modo de leitura em todas as seções: registros com listas de filhos
// (atuação, projeto, banca), orientação e evento como registro, e a
// referência das produções com o campo de cada trecho.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { childElements, parseXml, walk, type XElement } from '../src/model/xml.ts';
import { flatten, isUsable, lineText, shownKeys } from '../src/ui/reading-layout.ts';
import { recordLayout } from '../src/ui/reading-records.ts';
import { referencePieces, splitSegments } from '../src/ui/reading-reference.ts';

const opts = { hideSensitive: false, showCodes: false };

async function demo(): Promise<XElement> {
  const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, '../fixtures/demo.xml')));
  return (await loadCv(bytes, 'demo.xml')).doc.root;
}

function first(root: XElement, name: string): XElement {
  let found: XElement | undefined;
  walk(root, (e) => {
    if (!found && e.name === name) found = e;
  });
  return found!;
}

/** Todo atributo preenchido e visível do item e dos filhos, com a chave da composição. */
function filledKeys(item: XElement): string[] {
  return flatten(item).flatMap((e, i) =>
    e.attrs
      .filter((a) => a.value.trim() !== '' && isUsable(e, a.name, opts))
      .map((a) => `${i}:${a.name}`),
  );
}

describe('registros com listas de filhos', () => {
  it('atuação: instituição, vínculos e atividades; todo campo preenchido aparece', async () => {
    const atuacao = first(await demo(), 'ATUACAO-PROFISSIONAL');
    const s = recordLayout(atuacao, false, opts);
    expect(lineText(s.lines[0]!)).toBe('Universidade Federal do Rio Grande do Sul');
    expect(s.nested.map((g) => g.label)).toEqual([
      'Vínculos',
      'Atividades de participação em projeto',
    ]);
    const vinculo = s.nested[0]!.items[0]!;
    expect(lineText(vinculo.lines[0]!)).toBe('Professora Adjunta');
    expect(lineText(vinculo.lines[1]!)).toBe('Servidor público');
    // O período do vínculo diz o mês, e o mês sai da grade.
    expect(lineText(vinculo.when!)).toBe('mar 2019 – atual');
    const shown = shownKeys([s]);
    // O enquadramento "Outro" só diz que vale o cargo escrito à parte, que já
    // é o título do vínculo: sai de propósito.
    const redundant = '1:ENQUADRAMENTO-FUNCIONAL';
    expect(shown).not.toContain(redundant);
    for (const key of filledKeys(atuacao).filter((k) => k !== redundant)) {
      expect(shown, key).toContain(key);
    }
  });

  it('vínculo com tipo e enquadramento iguais ("Livre"): uma vez só', () => {
    const atuacao = parseXml(
      `<ATUACAO-PROFISSIONAL NOME-INSTITUICAO="Empresa"><VINCULOS TIPO-DE-VINCULO="LIVRE" ENQUADRAMENTO-FUNCIONAL="LIVRE" OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO="Fundador" MES-INICIO="1" ANO-INICIO="2026" FLAG-VINCULO-EMPREGATICIO="NAO"/></ATUACAO-PROFISSIONAL>`,
    ).root;
    const vinculo = recordLayout(atuacao, false, opts).nested[0]!.items[0]!;
    expect(lineText(vinculo.lines[0]!)).toBe('Fundador');
    expect(lineText(vinculo.lines[1]!)).toBe('Livre');
    expect(vinculo.rows.map((r) => r.attr)).not.toContain('ENQUADRAMENTO-FUNCIONAL');
    expect(vinculo.rows.map((r) => r.attr)).not.toContain('MES-INICIO');
  });

  it('projeto: a equipe é uma lista de integrantes, cada um pelo nome', async () => {
    const projeto = first(await demo(), 'PROJETO-DE-PESQUISA');
    const s = recordLayout(projeto, false, opts);
    expect(lineText(s.lines[0]!)).toMatch(/^Genômica da conservação/);
    const equipe = s.nested.find((g) => g.label === 'Equipe do projeto')!;
    expect(equipe.items.map((i) => lineText(i.lines[0]!))).toEqual([
      'Ana Beatriz Souza Lima',
      'Tiago Silveira Oliveira',
      'Luísa Martins Ferreira',
    ]);
    // A ordem de integração é a posição na lista, não um campo à mostra.
    expect(shownKeys([s]).size).toBeGreaterThan(0);
    for (const key of filledKeys(projeto).filter((k) => !k.endsWith('ORDEM-DE-INTEGRACAO'))) {
      expect(shownKeys([s]), key).toContain(key);
    }
  });

  it('banca: título, instituição, candidato e os participantes', async () => {
    const banca = first(await demo(), 'PARTICIPACAO-EM-BANCA-DE-MESTRADO');
    const s = recordLayout(banca, false, opts);
    expect(s.lines.map(lineText).filter(Boolean)).toEqual([
      'Variação genética em populações de Araucaria angustifolia no Planalto Sul',
      'Universidade Federal do Rio Grande do Sul',
      'Candidato: Camila Fernandes Rosa',
    ]);
    expect(lineText(s.when!)).toBe('2024');
    expect(s.nested[0]!.items.length).toBe(2);
  });

  it('orientação e evento: registro com a pessoa e a forma de participação', async () => {
    const root = await demo();
    const orientacao = recordLayout(
      first(root, 'ORIENTACOES-CONCLUIDAS-PARA-MESTRADO'),
      false,
      opts,
    );
    expect(orientacao.lines.map(lineText)).toContain('Orientado: Luísa Martins Ferreira');
    const evento = recordLayout(first(root, 'PARTICIPACAO-EM-CONGRESSO'), false, opts);
    expect(lineText(evento.lines[1]!)).toBe(
      '68º Congresso Brasileiro de Genética · Participante · Apresentação oral',
    );
  });
});

describe('referência com o campo de cada trecho', () => {
  it('evento, ano, autores e trechos fixos', async () => {
    const trabalho = first(await demo(), 'TRABALHO-EM-EVENTOS');
    const pieces = referencePieces(trabalho, opts);
    const els = flatten(trabalho);
    const keyOf = (name: string, attr: string) =>
      `${els.findIndex((e) => e.name === name || e.name.startsWith(name))}:${attr}`;
    const eventPiece = pieces.find((p) => /CONGRESSO BRASILEIRO/.test(p.text))!;
    expect(eventPiece.keys).toContain(keyOf('DETALHAMENTO', 'NOME-DO-EVENTO'));
    const authorIndex = els.findIndex((e) => e.name === 'AUTORES');
    const author = pieces.find((p) => p.keys.includes(`${authorIndex}:NOME-COMPLETO-DO-AUTOR`))!;
    expect(author.keys).toContain(`${authorIndex}:NOME-PARA-CITACAO`);
    expect(author.text).toBe('LIMA, A. B. S.');
    // O ano do trabalho e o de realização do evento caem no mesmo trecho.
    const year = pieces.find((p) => p.text === '2023' && p.keys.length > 0)!;
    expect(year.keys).toEqual(
      expect.arrayContaining([
        keyOf('DADOS-BASICOS', 'ANO-DO-TRABALHO'),
        keyOf('DETALHAMENTO', 'ANO-DE-REALIZACAO'),
      ]),
    );
    const fixed = pieces.find((p) => p.text.includes('[S. l.: s. n.]'))!;
    expect(fixed.keys).toEqual([]);
    // O texto inteiro é o de sempre.
    expect(pieces.map((p) => p.text).join('')).toMatch(/^LIMA, A\. B\. S\.; OLIVEIRA, T\. S\. /);
    expect(childElements(trabalho).some((c) => c.name === 'AUTORES')).toBe(true);
  });

  it('corta nos limites dos destaques e dos campos', () => {
    const pieces = splitSegments(
      [{ text: 'A. ' }, { strong: true, text: 'Revista X' }, { text: ', 2020.' }],
      [
        { end: 2, key: 'au', start: 0 },
        { also: ['per2'], end: 12, key: 'per', start: 3 },
        { end: 18, key: 'ano', start: 14 },
      ],
    );
    expect(pieces).toEqual([
      { keys: ['au'], strong: undefined, text: 'A.' },
      { keys: [], strong: undefined, text: ' ' },
      { keys: ['per', 'per2'], strong: true, text: 'Revista X' },
      { keys: [], strong: undefined, text: ', ' },
      { keys: ['ano'], strong: undefined, text: '2020' },
      { keys: [], strong: undefined, text: '.' },
    ]);
  });
});
