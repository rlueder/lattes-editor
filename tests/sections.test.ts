import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { parseXml, type XElement } from '../src/model/xml.ts';
import {
  buildSections,
  countItems,
  groupItemList,
  isRepeatableItem,
  type SectionGroup,
} from '../src/ui/sections.ts';

const el = (xml: string): XElement => parseXml(xml).root;
const groupOf = (...elements: XElement[]): SectionGroup => ({ elements, id: 'g', label: 'g' });

const fullSections = async () => {
  const name = 'synthetic_full.xml';
  const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, '../fixtures', name)));
  return buildSections((await loadCv(bytes, name)).doc.root);
};

/** Como cada grupo da seção se apresenta: cartões soltos, lista embrulhada ou campos. */
const layouts = async (sectionId: string) => {
  const section = (await fullSections()).find((s) => s.id === sectionId)!;
  return Object.fromEntries(
    section.groups.map((g) => {
      const list = groupItemList(g);
      return [g.label, list ? (list.container ? 'contêiner' : 'cartões') : 'campos'];
    }),
  );
};

describe('isRepeatableItem', () => {
  it('item que o schema deixa repetir, mesmo sozinho', () => {
    expect(isRepeatableItem(el('<SOFTWARE SEQUENCIA-PRODUCAO="1"/>'))).toBe(true);
    expect(isRepeatableItem(el('<PATENTE SEQUENCIA-PRODUCAO="2"/>'))).toBe(true);
  });

  it('bloco único do perfil, contêiner puro e elemento desconhecido não são itens', () => {
    expect(isRepeatableItem(el('<RESUMO-CV TEXTO-RESUMO-CV-RH="x"/>'))).toBe(false);
    expect(isRepeatableItem(el('<ENDERECO FLAG-DE-PREFERENCIA="x"/>'))).toBe(false);
    expect(isRepeatableItem(el('<IDIOMAS><IDIOMA IDIOMA="EN"/></IDIOMAS>'))).toBe(false);
    expect(isRepeatableItem(el('<NAO-EXISTE X="1"/>'))).toBe(false);
  });
});

describe('groupItemList', () => {
  it('vários elementos são a lista', () => {
    const a = el('<SOFTWARE SEQUENCIA-PRODUCAO="1"/>');
    const b = el('<SOFTWARE SEQUENCIA-PRODUCAO="2"/>');
    expect(groupItemList(groupOf(a, b))).toEqual({ items: [a, b] });
  });

  it('um item sozinho é lista de um, sem contêiner', () => {
    const only = el(
      '<PATENTE SEQUENCIA-PRODUCAO="1"><DADOS-BASICOS-DA-PATENTE TITULO="x"/></PATENTE>',
    );
    expect(groupItemList(groupOf(only))).toEqual({ items: [only] });
  });

  it('contêiner único devolve os filhos e o próprio contêiner', () => {
    const box = el('<IDIOMAS><IDIOMA IDIOMA="EN"/><IDIOMA IDIOMA="ES"/><VAZIO/></IDIOMAS>');
    const list = groupItemList(groupOf(box));
    expect(list?.container).toBe(box);
    expect(list?.items.map((i) => i.attrs[0]!.value)).toEqual(['EN', 'ES']);
  });

  it('bloco de campos, contêiner vazio ou de partes soltas e grupo vazio não são lista', () => {
    expect(groupItemList(groupOf(el('<RESUMO-CV TEXTO-RESUMO-CV-RH="x"/>')))).toBeNull();
    expect(groupItemList(groupOf(el('<IDIOMAS/>')))).toBeNull();
    expect(groupItemList(groupOf(el('<A><B><C X="1"/></B></A>')))).toBeNull();
    expect(groupItemList(groupOf())).toBeNull();
  });
});

describe('countItems', () => {
  it('um item sozinho conta um, não as partes dele', () => {
    const only = el(
      '<PATENTE SEQUENCIA-PRODUCAO="1"><DADOS-BASICOS-DA-PATENTE TITULO="x"/><AUTORES NOME-COMPLETO-DO-AUTOR="y"/></PATENTE>',
    );
    expect(countItems(groupOf(only))).toBe(1);
  });

  it('contêiner conta os filhos; bloco sem filhos conta um', () => {
    expect(countItems(groupOf(el('<IDIOMAS><IDIOMA/><IDIOMA/></IDIOMAS>')))).toBe(2);
    expect(countItems(groupOf(el('<RESUMO-CV TEXTO-RESUMO-CV-RH="x"/>')))).toBe(1);
  });
});

describe('grupos do currículo sintético', () => {
  it('Dados gerais: o perfil continua em campos; as listas, embrulhadas', async () => {
    expect(await layouts('dados-gerais')).toEqual({
      Endereço: 'campos',
      Identificação: 'campos',
      Idiomas: 'contêiner',
      Licenças: 'contêiner',
      'Outras informações relevantes': 'campos',
      'Prêmios e títulos': 'contêiner',
      Resumo: 'campos',
      'Áreas de atuação': 'contêiner',
    });
  });

  it('Patentes e Registros: cada registro sozinho vira cartão', async () => {
    expect(Object.values(await layouts('patentes'))).toEqual(Array(6).fill('cartões'));
  });

  it('Produções e Projetos: itens soltos viram cartões, contêineres continuam', async () => {
    const producoes = await layouts('producoes');
    for (const label of [
      'Softwares',
      'Produtos',
      'Processos ou técnicas',
      'Trabalhos técnicos',
      'Demais trabalhos',
    ]) {
      expect(producoes[label]).toBe('cartões');
    }
    expect(producoes['Artigos completos publicados']).toBe('contêiner');
    expect(await layouts('projetos')).toEqual({ Projetos: 'cartões' });
  });

  it('nenhum grupo fora de Dados gerais fica como formulário aberto', async () => {
    const fields = (await fullSections())
      .filter((s) => s.id !== 'dados-gerais')
      .flatMap((s) => s.groups.filter((g) => !groupItemList(g)).map((g) => g.label));
    expect(fields).toEqual([]);
  });
});
