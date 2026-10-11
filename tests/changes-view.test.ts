import { afterEach, describe, expect, it, vi } from 'vitest';

import { diffDocuments } from '../src/model/changes.ts';
import { parseXml } from '../src/model/xml.ts';
import { groupChanges, openCount } from '../src/ui/changes-view.ts';
import { copyText } from '../src/ui/clipboard.ts';
import { buildSections } from '../src/ui/sections.ts';

const ORIGINAL = `<CURRICULO-VITAE>
  <DADOS-GERAIS NOME-COMPLETO="Pessoa" CIDADE-NASCIMENTO="Pelotas">
    <ATUACOES-PROFISSIONAIS>
      <ATUACAO-PROFISSIONAL SEQUENCIA-ATIVIDADE="1" NOME-INSTITUICAO="Empresa A">
        <VINCULOS SEQUENCIA-HISTORICO="1" ANO-INICIO="2010" ANO-FIM=""/>
      </ATUACAO-PROFISSIONAL>
    </ATUACOES-PROFISSIONAIS>
    <IDIOMAS><IDIOMA IDIOMA="EN" DESCRICAO-DO-IDIOMA="Inglês"/></IDIOMAS>
  </DADOS-GERAIS>
  <PRODUCAO-BIBLIOGRAFICA><ARTIGOS-PUBLICADOS>
    <ARTIGO-PUBLICADO SEQUENCIA-PRODUCAO="5"><DADOS-BASICOS-DO-ARTIGO TITULO-DO-ARTIGO="Um artigo" ANO-DO-ARTIGO="2020"/></ARTIGO-PUBLICADO>
  </ARTIGOS-PUBLICADOS></PRODUCAO-BIBLIOGRAFICA>
</CURRICULO-VITAE>`;

function setup(edit: (xml: string) => string, done: Record<string, string> = {}) {
  const original = parseXml(ORIGINAL).root;
  const working = parseXml(edit(ORIGINAL)).root;
  const sections = buildSections(working);
  return groupChanges(diffDocuments(original, working), original, working, sections, done);
}

describe('groupChanges', () => {
  it('agrupa pela seção do Lattes, com o item que contém a mudança', () => {
    const groups = setup((x) =>
      x
        .replace('ANO-FIM=""', 'ANO-FIM="2020"')
        .replace('CIDADE-NASCIMENTO="Pelotas"', 'CIDADE-NASCIMENTO="Rio Grande"'),
    );
    expect(
      groups.map((g) => [g.label, g.entries.map((e) => [e.itemTitle, e.change.form])]),
    ).toEqual([
      ['Dados gerais', [['', 'Identificação']]],
      ['Atuação', [['Empresa A', 'Vínculos']]],
    ]);
    expect(openCount(groups)).toBe(2);
  });

  it('item existente de produção editado: seção importável, com aviso', () => {
    const [group] = setup((x) => x.replace('Um artigo', 'Um artigo revisto'));
    expect(group).toMatchObject({ importable: true, label: 'Produções' });
    expect(group!.entries[0]!.itemTitle).toBe('Um artigo revisto');
  });

  it('item removido acha a seção pela cópia de trabalho e o título pelo original', () => {
    const [group] = setup((x) =>
      x.replace('<IDIOMA IDIOMA="EN" DESCRICAO-DO-IDIOMA="Inglês"/>', ''),
    );
    expect(group!.label).toBe('Dados gerais');
    expect(group!.entries[0]).toMatchObject({ itemTitle: 'Inglês' });
  });

  it('feito vale enquanto a assinatura bate', () => {
    const first = setup((x) => x.replace('ANO-FIM=""', 'ANO-FIM="2020"'));
    const entry = first[0]!.entries[0]!;
    const done = { [entry.change.key]: entry.signature };
    expect(setup((x) => x.replace('ANO-FIM=""', 'ANO-FIM="2020"'), done)[0]!.entries[0]!.done).toBe(
      true,
    );
    expect(setup((x) => x.replace('ANO-FIM=""', 'ANO-FIM="2021"'), done)[0]!.entries[0]!.done).toBe(
      false,
    );
    expect(openCount(setup((x) => x.replace('ANO-FIM=""', 'ANO-FIM="2020"'), done))).toBe(0);
  });

  it('sem seção conhecida cai em "Outros dados", no fim', () => {
    const groups = setup((x) =>
      x
        .replace('</CURRICULO-VITAE>', '<NOVO-BLOCO X="1"/></CURRICULO-VITAE>')
        .replace('ANO-FIM=""', 'ANO-FIM="1"'),
    );
    expect(groups.map((g) => g.label)).toEqual(['Atuação', 'Outros dados']);
  });
});

describe('copyText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('usa a API da área de transferência', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('abc')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('abc');
  });

  it('sem a API, recorre a execCommand', async () => {
    vi.stubGlobal('navigator', {});
    const area = { remove: vi.fn(), select: vi.fn(), setAttribute: vi.fn(), style: {}, value: '' };
    vi.stubGlobal('document', {
      body: { appendChild: vi.fn() },
      createElement: () => area,
      execCommand: () => true,
    });
    expect(await copyText('abc')).toBe(true);
    expect(area.value).toBe('abc');
    expect(area.remove).toHaveBeenCalled();
  });
});
