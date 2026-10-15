import { describe, expect, it } from 'vitest';

import {
  acceptChange,
  acceptCreated,
  diffDocuments,
  resolvePath,
  revertChange,
  revertField,
} from '../src/model/changes.ts';
import { parseXml } from '../src/model/xml.ts';

const doc = (xml: string) => parseXml(xml).root;

const ORIGINAL = `<CURRICULO-VITAE>
  <DADOS-GERAIS NOME-COMPLETO="Pessoa" CIDADE-NASCIMENTO="Pelotas">
    <RESUMO-CV TEXTO-RESUMO-CV-RH="Resumo antigo"/>
    <ATUACOES-PROFISSIONAIS>
      <ATUACAO-PROFISSIONAL SEQUENCIA-ATIVIDADE="1" SEQUENCIA-IMPORTANCIA="1" NOME-INSTITUICAO="A">
        <VINCULOS SEQUENCIA-HISTORICO="1" ANO-INICIO="2010" ANO-FIM=""/>
      </ATUACAO-PROFISSIONAL>
      <ATUACAO-PROFISSIONAL SEQUENCIA-ATIVIDADE="2" SEQUENCIA-IMPORTANCIA="2" NOME-INSTITUICAO="B"/>
    </ATUACOES-PROFISSIONAIS>
    <IDIOMAS><IDIOMA IDIOMA="EN" PROFICIENCIA-DE-LEITURA="BEM"/></IDIOMAS>
  </DADOS-GERAIS>
  <PRODUCAO-BIBLIOGRAFICA><ARTIGOS-PUBLICADOS>
    <ARTIGO-PUBLICADO SEQUENCIA-PRODUCAO="5"><DADOS-BASICOS-DO-ARTIGO TITULO-DO-ARTIGO="X"/></ARTIGO-PUBLICADO>
  </ARTIGOS-PUBLICADOS></PRODUCAO-BIBLIOGRAFICA>
</CURRICULO-VITAE>`;

describe('diffDocuments', () => {
  it('sem mudanças, lista vazia', () => {
    expect(diffDocuments(doc(ORIGINAL), doc(ORIGINAL))).toEqual([]);
  });

  it('atributo alterado, com antes e depois e caminho pela identidade', () => {
    const working = doc(ORIGINAL.replace('ANO-FIM=""', 'ANO-FIM="2020"'));
    const [change] = diffDocuments(doc(ORIGINAL), working);
    expect(change).toMatchObject({
      element: 'VINCULOS',
      fields: [{ after: '2020', attr: 'ANO-FIM', before: '', label: 'Ano fim' }],
      form: 'Vínculos',
      kind: 'alterado',
    });
    expect(change!.key).toBe(
      'CURRICULO-VITAE/DADOS-GERAIS[#0]/ATUACOES-PROFISSIONAIS[#0]/ATUACAO-PROFISSIONAL[SEQUENCIA-ATIVIDADE=1]/VINCULOS[SEQUENCIA-HISTORICO=1]',
    );
  });

  it('reordenar (SEQUENCIA-IMPORTANCIA) muda só a importância, sem trocar a identidade', () => {
    const working = doc(ORIGINAL.replace('SEQUENCIA-IMPORTANCIA="1"', 'SEQUENCIA-IMPORTANCIA="9"'));
    const changes = diffDocuments(doc(ORIGINAL), working);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.fields.map((f) => f.attr)).toEqual(['SEQUENCIA-IMPORTANCIA']);
  });

  it('item novo e removido entram inteiros, só com campos preenchidos', () => {
    const working = doc(
      ORIGINAL.replace(
        '<IDIOMA IDIOMA="EN" PROFICIENCIA-DE-LEITURA="BEM"/>',
        '<IDIOMA IDIOMA="ES" PROFICIENCIA-DE-LEITURA="POUCO" PROFICIENCIA-DE-FALA=""/>',
      ),
    );
    const changes = diffDocuments(doc(ORIGINAL), working);
    expect(changes.map((c) => [c.kind, c.element, c.fields.map((f) => f.attr)])).toEqual([
      ['removido', 'IDIOMA', ['IDIOMA', 'PROFICIENCIA-DE-LEITURA']],
      ['novo', 'IDIOMA', ['IDIOMA', 'PROFICIENCIA-DE-LEITURA']],
    ]);
  });

  it('elemento novo em branco não conta; texto e atributo novo contam', () => {
    const working = doc(
      ORIGINAL.replace(
        '<RESUMO-CV TEXTO-RESUMO-CV-RH="Resumo antigo"/>',
        '<RESUMO-CV TEXTO-RESUMO-CV-RH="Resumo antigo"/><ENDERECO X=""/>',
      ).replace('CIDADE-NASCIMENTO="Pelotas"', 'CIDADE-NASCIMENTO="Pelotas" PCD="NAO"'),
    );
    const changes = diffDocuments(doc(ORIGINAL), working);
    expect(changes.map((c) => c.element)).toEqual(['DADOS-GERAIS']);
    expect(changes[0]!.fields).toEqual([{ after: 'NAO', attr: 'PCD', before: '', label: 'PcD' }]);

    const withText = diffDocuments(
      doc('<A><DISCIPLINA SEQUENCIA-ESPECIFICACAO="1">Velha</DISCIPLINA></A>'),
      doc('<A><DISCIPLINA SEQUENCIA-ESPECIFICACAO="1">Nova</DISCIPLINA></A>'),
    );
    expect(withText[0]!.fields).toEqual([
      { after: 'Nova', attr: '#texto', before: 'Velha', label: 'Texto' },
    ]);
  });

  it('itens que o Importar leva ficam de fora', () => {
    const working = doc(
      ORIGINAL.replace(
        '</ARTIGOS-PUBLICADOS>',
        '<ARTIGO-PUBLICADO SEQUENCIA-PRODUCAO="6"><DADOS-BASICOS-DO-ARTIGO TITULO-DO-ARTIGO="Novo"/></ARTIGO-PUBLICADO></ARTIGOS-PUBLICADOS>',
      ),
    );
    const skip = (el: { attrs: { name: string; value: string }[] }) =>
      Number(el.attrs.find((a) => a.name === 'SEQUENCIA-PRODUCAO')?.value ?? 0) > 5;
    expect(diffDocuments(doc(ORIGINAL), working, { skip })).toEqual([]);
    expect(diffDocuments(doc(ORIGINAL), working)).toHaveLength(1);
  });

  it('irmãos sem identidade casam pela posição; chave duplicada não colide', () => {
    const changes = diffDocuments(
      doc('<A><B X="1"/><B X="2"/></A>'),
      doc('<A><B X="1"/><B X="3"/></A>'),
    );
    expect(changes.map((c) => c.key)).toEqual(['A/B[#1]']);
    const dup = diffDocuments(
      doc('<A><C SEQUENCIA-X="1" V="a"/><C SEQUENCIA-X="1" V="b"/></A>'),
      doc('<A><C SEQUENCIA-X="1" V="a"/><C SEQUENCIA-X="1" V="c"/></A>'),
    );
    expect(dup.map((c) => c.key)).toEqual(['A/C[SEQUENCIA-X=1]~1']);
  });
});

describe('resolvePath', () => {
  it('segue o caminho pelas chaves; para onde o elemento some', () => {
    const working = doc(ORIGINAL.replace('ANO-FIM=""', 'ANO-FIM="2020"'));
    const [change] = diffDocuments(doc(ORIGINAL), working);
    const chain = resolvePath(working, change!.path);
    expect(chain.map((e) => e.name)).toEqual([
      'CURRICULO-VITAE',
      'DADOS-GERAIS',
      'ATUACOES-PROFISSIONAIS',
      'ATUACAO-PROFISSIONAL',
      'VINCULOS',
    ]);
    expect(resolvePath(working, ['OUTRA'])).toEqual([]);
    expect(resolvePath(working, ['CURRICULO-VITAE', 'X[#0]']).map((e) => e.name)).toEqual([
      'CURRICULO-VITAE',
    ]);
  });
});

describe('revertChange', () => {
  const insert = (parent: ReturnType<typeof doc>, child: ReturnType<typeof doc>) => {
    parent.children.push(child);
  };

  it('alterado: volta os atributos da exportação', () => {
    const original = doc(ORIGINAL);
    const working = doc(ORIGINAL.replace('ANO-FIM=""', 'ANO-FIM="2020"'));
    const [change] = diffDocuments(original, working);
    expect(revertChange(original, working, change!, insert)).toBe(true);
    expect(diffDocuments(original, working)).toEqual([]);
  });

  it('novo sai; removido volta', () => {
    const original = doc(ORIGINAL);
    const working = doc(
      ORIGINAL.replace(
        '<IDIOMA IDIOMA="EN" PROFICIENCIA-DE-LEITURA="BEM"/>',
        '<IDIOMA IDIOMA="ES" PROFICIENCIA-DE-LEITURA="POUCO"/>',
      ),
    );
    const changes = diffDocuments(original, working);
    for (const c of changes) expect(revertChange(original, working, c, insert)).toBe(true);
    expect(diffDocuments(original, working)).toEqual([]);
  });

  it('texto e caminho que sumiu', () => {
    const original = doc('<A><DISCIPLINA SEQUENCIA-ESPECIFICACAO="1">Velha</DISCIPLINA></A>');
    const working = doc('<A><DISCIPLINA SEQUENCIA-ESPECIFICACAO="1">Nova</DISCIPLINA></A>');
    const [change] = diffDocuments(original, working);
    expect(revertChange(original, working, change!, insert)).toBe(true);
    expect(diffDocuments(original, working)).toEqual([]);
    expect(revertChange(original, doc('<A/>'), change!, insert)).toBe(false);
    expect(revertChange(original, doc('<A/>'), { ...change!, kind: 'novo' }, insert)).toBe(false);
    expect(
      revertChange(
        original,
        doc('<B/>'),
        { ...change!, kind: 'removido', path: ['A', 'X[#0]'] },
        insert,
      ),
    ).toBe(false);
  });
});

describe('revertField', () => {
  it('volta só o campo; atributo que não existia sai; texto volta', () => {
    const original = doc(ORIGINAL);
    const working = doc(
      ORIGINAL.replace('ANO-FIM=""', 'ANO-FIM="2020" NOVO="x"').replace(
        'ANO-INICIO="2010"',
        'ANO-INICIO="2011"',
      ),
    );
    const [change] = diffDocuments(original, working);
    expect(revertField(original, working, change!, 'ANO-FIM')).toBe(true);
    expect(revertField(original, working, change!, 'NOVO')).toBe(true);
    expect(diffDocuments(original, working)[0]!.fields.map((f) => f.attr)).toEqual(['ANO-INICIO']);
    expect(revertField(original, working, { ...change!, kind: 'novo' }, 'ANO-INICIO')).toBe(false);
    expect(revertField(original, doc('<CURRICULO-VITAE/>'), change!, 'ANO-INICIO')).toBe(false);

    const o = doc('<A><DISCIPLINA SEQUENCIA-ESPECIFICACAO="1">Velha</DISCIPLINA></A>');
    const w = doc('<A><DISCIPLINA SEQUENCIA-ESPECIFICACAO="1">Nova</DISCIPLINA></A>');
    const [t] = diffDocuments(o, w);
    expect(revertField(o, w, t!, '#texto')).toBe(true);
    expect(diffDocuments(o, w)).toEqual([]);
    const removed = doc('<A><DISCIPLINA SEQUENCIA-ESPECIFICACAO="1" X="1">Velha</DISCIPLINA></A>');
    const [r] = diffDocuments(
      removed,
      doc('<A><DISCIPLINA SEQUENCIA-ESPECIFICACAO="1">Velha</DISCIPLINA></A>'),
    );
    const target = doc('<A><DISCIPLINA SEQUENCIA-ESPECIFICACAO="1">Velha</DISCIPLINA></A>');
    expect(revertField(removed, target, r!, 'X')).toBe(true);
    expect(diffDocuments(removed, target)).toEqual([]);
  });
});

describe('aceitar mudança conferida no Lattes', () => {
  it('leva o valor novo ao original e a mudança some da lista', () => {
    const original = parseXml(
      '<CURRICULO-VITAE><DADOS-GERAIS NOME-COMPLETO="Ana" CPF="1"/></CURRICULO-VITAE>',
    ).root;
    const working = parseXml(
      '<CURRICULO-VITAE><DADOS-GERAIS NOME-COMPLETO="Ana Maria" CPF="1"/></CURRICULO-VITAE>',
    ).root;
    const [change] = diffDocuments(original, working);
    expect(change).toBeDefined();
    expect(acceptChange(original, working, change!)).toBe(true);
    expect(diffDocuments(original, working)).toEqual([]);
  });

  it('não aceita inclusões nem exclusões', () => {
    const original = parseXml('<CURRICULO-VITAE/>').root;
    const working = parseXml('<CURRICULO-VITAE><IDIOMA IDIOMA="Inglês"/></CURRICULO-VITAE>').root;
    const [change] = diffDocuments(original, working);
    expect(acceptChange(original, working, change!)).toBe(false);
  });
});

describe('aceitar item novo incluído pelo conector', () => {
  it('entra no original com o número que o Lattes deu, e a mudança some da lista', () => {
    const original = doc(ORIGINAL);
    const working = doc(ORIGINAL);
    const atuacoes = resolvePath(working, ['CURRICULO-VITAE', 'DADOS-GERAIS[#0]']).at(-1)!;
    const container = atuacoes.children.find(
      (c) => c.kind === 'element' && c.name === 'ATUACOES-PROFISSIONAIS',
    );
    if (!container || container.kind !== 'element') throw new Error('sem atuações');
    container.children.push(
      parseXml(
        '<ATUACAO-PROFISSIONAL SEQUENCIA-ATIVIDADE="3" NOME-INSTITUICAO="C"><VINCULOS SEQUENCIA-HISTORICO="1" ANO-INICIO="2020"/></ATUACAO-PROFISSIONAL>',
      ).root,
    );
    const [change] = diffDocuments(original, working);
    expect(change?.kind).toBe('novo');
    // O Lattes deu 7, não o 3 provisório do editor.
    expect(acceptCreated(original, working, change!, { 'SEQUENCIA-ATIVIDADE': '7' })).toBe(true);
    expect(diffDocuments(original, working)).toEqual([]);
    const accepted = resolvePath(original, [
      'CURRICULO-VITAE',
      'DADOS-GERAIS[#0]',
      'ATUACOES-PROFISSIONAIS[#0]',
      'ATUACAO-PROFISSIONAL[SEQUENCIA-ATIVIDADE=7]',
    ]);
    expect(accepted).toHaveLength(4);
    expect(acceptChange(original, working, change!)).toBe(false);
  });

  it('cria os contêineres que o original não tem; número sem dono certo fica de fora', () => {
    const original = parseXml('<CURRICULO-VITAE/>').root;
    const working = parseXml(
      '<CURRICULO-VITAE><DADOS-COMPLEMENTARES><PARTICIPACAO-EM-EVENTOS-CONGRESSOS><PARTICIPACAO-EM-CONGRESSO SEQUENCIA-PRODUCAO="90"><DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO TITULO="T"/></PARTICIPACAO-EM-CONGRESSO></PARTICIPACAO-EM-EVENTOS-CONGRESSOS></DADOS-COMPLEMENTARES></CURRICULO-VITAE>',
    ).root;
    const [change] = diffDocuments(original, working);
    expect(change?.element).toBe('PARTICIPACAO-EM-CONGRESSO');
    expect(
      acceptCreated(original, working, change!, {
        'SEQUENCIA-PRODUCAO': '41',
        'SEQUENCIA-OUTRA': '1',
      }),
    ).toBe(true);
    expect(diffDocuments(original, working)).toEqual([]);
    expect(
      resolvePath(original, [
        'CURRICULO-VITAE',
        'DADOS-COMPLEMENTARES[#0]',
        'PARTICIPACAO-EM-EVENTOS-CONGRESSOS[#0]',
        'PARTICIPACAO-EM-CONGRESSO[SEQUENCIA-PRODUCAO=41]',
      ]),
    ).toHaveLength(4);
    // Caminho que não existe mais na cópia, ou mudança que não é inclusão: nada muda.
    expect(acceptCreated(original, working, { ...change!, path: ['X'] })).toBe(false);
    expect(acceptCreated(original, working, { ...change!, kind: 'alterado' })).toBe(false);
  });
});
