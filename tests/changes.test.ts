import { describe, expect, it } from 'vitest';

import { changeSignature, diffDocuments, resolvePath } from '../src/model/changes.ts';
import { getAttr, parseXml } from '../src/model/xml.ts';

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

describe('changeSignature', () => {
  it('muda quando o valor novo muda', () => {
    const before = doc(ORIGINAL);
    const a = diffDocuments(before, doc(ORIGINAL.replace('Resumo antigo', 'Resumo novo')))[0]!;
    const b = diffDocuments(before, doc(ORIGINAL.replace('Resumo antigo', 'Outro resumo')))[0]!;
    expect(a.key).toBe(b.key);
    expect(changeSignature(a)).not.toBe(changeSignature(b));
    expect(getAttr(before, 'X')).toBeUndefined();
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
