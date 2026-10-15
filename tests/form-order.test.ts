// Ordem dos campos nos formulários: a do formulário do Lattes onde ela é
// conhecida (src/ui/form-order.ts), com os campos que o Lattes não tem em
// "Em inglês" (as versões em inglês) ou em "Outros dados", e nenhum campo num
// grupo errado por semelhança de nome.

import { describe, expect, it } from 'vitest';

import { attributeLabel } from '../src/labels/labels.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import { codeAttrFor, type FieldEntry, groupFields, isSystemAttr } from '../src/ui/field-kind.ts';
import {
  formLayout,
  formSlot,
  IN_ENGLISH,
  isEnglishAttr,
  offForm,
  OTHER_DATA,
} from '../src/ui/form-order.ts';

/** Todos os atributos dos elementos, como um bloco do formulário. */
function entriesOf(...elements: string[]): FieldEntry[] {
  return elements.flatMap((element) =>
    lattesSchema.elements[element]!.attributes.map((a) => ({
      attr: a.name,
      element,
      key: `${element}:${a.name}`,
    })),
  );
}

const groupsOf = (entries: FieldEntry[], isEmpty?: (e: FieldEntry) => boolean) =>
  groupFields(entries, attributeLabel, (e) => e.attr.startsWith('FLAG-'), isEmpty);

/** Grupos e atributos, sem os códigos do Lattes. */
const shape = (entries: FieldEntry[]) =>
  groupsOf(entries)
    .filter((g) => !g.system)
    .map((g) => [g.label, g.entries.map((e) => e.attr)] as const);

/** A ordem dos atributos do formulário que o elemento tem, na ordem do Lattes. */
function formOrder(element: string): string[] {
  const has = new Set(lattesSchema.elements[element]!.attributes.map((a) => a.name));
  return formLayout(element)!
    .flatMap((g) => g.attrs)
    .filter((a) => has.has(a));
}

/** Os atributos fora dos códigos, na ordem em que o bloco os mostra. */
function shownOrder(entries: FieldEntry[], element: string): string[] {
  return groupsOf(entries)
    .flatMap((g) => g.entries)
    .filter((e) => e.element === element && formSlot(element, e.attr))
    .map((e) => e.attr);
}

describe('ordem do formulário do Lattes', () => {
  it('participação em evento: forma, tipo, nome, ano, natureza, cidade, país, página, título…', () => {
    const entries = entriesOf(
      'DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO',
      'DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO',
    );
    expect(shape(entries)).toEqual([
      [
        'Principal',
        ['FORMA-PARTICIPACAO', 'TIPO-PARTICIPACAO', 'NOME-DO-EVENTO', 'ANO', 'NATUREZA'],
      ],
      ['Local', ['CIDADE-DO-EVENTO', 'PAIS']],
      [
        'Trabalho apresentado',
        ['HOME-PAGE-DO-TRABALHO', 'TITULO', 'FLAG-DIVULGACAO-CIENTIFICA', 'TITULO-INGLES'],
      ],
      [IN_ENGLISH, ['NOME-DO-EVENTO-INGLES']],
      [
        OTHER_DATA,
        [
          'DOI',
          'IDIOMA',
          'LOCAL-DO-EVENTO',
          'MEIO-DE-DIVULGACAO',
          'NOME-INSTITUICAO',
          'CODIGO-INSTITUICAO',
          'FLAG-RELEVANCIA',
        ],
      ],
    ]);
  });

  it('vale para todos os tipos de evento, e não para as bancas', () => {
    for (const kind of ['SEMINARIO', 'SIMPOSIO', 'OFICINA', 'ENCONTRO', 'FEIRA', 'EXPOSICAO']) {
      expect(formLayout(`DADOS-BASICOS-DA-PARTICIPACAO-EM-${kind}`)).toBeDefined();
    }
    expect(formLayout('DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO')).toBeUndefined();
  });

  it('formação: curso, situação e período, bolsa, trabalho e orientação, em cada nível', () => {
    for (const level of ['GRADUACAO', 'ESPECIALIZACAO', 'MESTRADO', 'DOUTORADO', 'POS-DOUTORADO']) {
      expect(shownOrder(entriesOf(level), level), level).toEqual(formOrder(level));
    }
    expect(shape(entriesOf('MESTRADO')).slice(0, 4)).toEqual([
      [
        'Curso',
        [
          'TIPO-MESTRADO',
          'NOME-INSTITUICAO',
          'CODIGO-INSTITUICAO',
          'NOME-ORGAO',
          'CODIGO-ORGAO',
          'NOME-CURSO',
          'CODIGO-CURSO',
        ],
      ],
      [
        'Situação e período',
        ['STATUS-DO-CURSO', 'ANO-DE-INICIO', 'ANO-DE-CONCLUSAO', 'ANO-DE-OBTENCAO-DO-TITULO'],
      ],
      ['Bolsa', ['FLAG-BOLSA', 'NOME-AGENCIA', 'CODIGO-AGENCIA-FINANCIADORA']],
      [
        'Trabalho e orientação',
        ['TITULO-DA-DISSERTACAO-TESE', 'NOME-COMPLETO-DO-ORIENTADOR', 'NOME-DO-CO-ORIENTADOR'],
      ],
    ]);
  });

  it('código do Lattes logo depois do nome que ele acompanha', () => {
    const curso = groupsOf(entriesOf('MESTRADO')).find((g) => g.label === 'Curso')!;
    expect(curso.entries.map((e) => e.attr)).toEqual([
      'TIPO-MESTRADO',
      'NOME-INSTITUICAO',
      'CODIGO-INSTITUICAO',
      'NOME-ORGAO',
      'CODIGO-ORGAO',
      'NOME-CURSO',
      'CODIGO-CURSO',
    ]);
  });

  it('doutorado: orientadores do sanduíche e da cotutela no grupo deles', () => {
    const group = groupsOf(entriesOf('DOUTORADO')).find((g) => g.label === 'Sanduíche e cotutela')!;
    expect(group.entries.map((e) => e.attr)).toEqual(
      expect.arrayContaining(['NOME-DO-ORIENTADOR-SANDUICHE', 'NOME-DO-ORIENTADOR-CO-TUTELA']),
    );
  });

  it('o número Lattes do orientador é código do Lattes', () => {
    expect(isSystemAttr('DOUTORADO', 'NUMERO-ID-ORIENTADOR')).toBe(true);
    expect(
      isSystemAttr('DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO', 'NUMERO-ID-ORIENTADO'),
    ).toBe(true);
    expect(isSystemAttr('DADOS-GERAIS', 'NUMERO-IDENTIDADE')).toBe(false);
  });

  it('pós-doutorado: só os campos do formulário do Lattes aparecem vazios', () => {
    for (const attr of ['NOME-INSTITUICAO', 'STATUS-DO-CURSO', 'ANO-DE-INICIO', 'NOME-AGENCIA']) {
      expect(offForm('POS-DOUTORADO', attr), attr).toBe(false);
    }
    for (const attr of ['STATUS-DO-ESTAGIO', 'TITULO-DO-TRABALHO', 'NOME-CURSO-INGLES']) {
      expect(offForm('POS-DOUTORADO', attr), attr).toBe(true);
    }
    expect(offForm('DOUTORADO', 'STATUS-DO-ESTAGIO')).toBe(false);
  });

  it('prêmio: título, entidade promotora, ano; o título em inglês à parte', () => {
    expect(shape(entriesOf('PREMIO-TITULO'))).toEqual([
      ['Principal', ['NOME-DO-PREMIO-OU-TITULO', 'NOME-DA-ENTIDADE-PROMOTORA', 'ANO-DA-PREMIACAO']],
      [IN_ENGLISH, ['NOME-DO-PREMIO-OU-TITULO-INGLES']],
    ]);
  });

  it('idioma: lê, fala, escreve, compreende', () => {
    expect(shape(entriesOf('IDIOMA'))).toEqual([
      ['Idioma', ['DESCRICAO-DO-IDIOMA', 'IDIOMA']],
      [
        'Proficiência',
        [
          'PROFICIENCIA-DE-LEITURA',
          'PROFICIENCIA-DE-FALA',
          'PROFICIENCIA-DE-ESCRITA',
          'PROFICIENCIA-DE-COMPREENSAO',
        ],
      ],
    ]);
  });

  it('endereço: instituição, depois país, CEP, rua, bairro, cidade, UF, e os contatos', () => {
    expect(shownOrder(entriesOf('ENDERECO-PROFISSIONAL'), 'ENDERECO-PROFISSIONAL')).toEqual(
      formOrder('ENDERECO-PROFISSIONAL'),
    );
    expect(shape(entriesOf('ENDERECO-RESIDENCIAL'))).toEqual([
      ['Localização', ['PAIS', 'CEP', 'LOGRADOURO', 'BAIRRO', 'CIDADE', 'UF']],
      ['Contato', ['DDD', 'TELEFONE', 'RAMAL', 'FAX', 'CAIXA-POSTAL', 'HOME-PAGE', 'E-MAIL']],
    ]);
  });

  it('identificação: nome, nascimento, documentos, filiação; o resto em outros dados', () => {
    const groups = shape(entriesOf('DADOS-GERAIS'));
    expect(groups.map(([label]) => label)).toEqual([
      'Identificação',
      'Nascimento',
      'Documentos',
      'Filiação',
      'Deficiência',
      OTHER_DATA,
    ]);
    expect(groups[1]![1]).toEqual([
      'PAIS-DE-NASCIMENTO',
      'UF-NASCIMENTO',
      'CIDADE-NASCIMENTO',
      'DATA-NASCIMENTO',
    ]);
    // O órgão emissor do RG não vai para "Instituição" por ter ORGAO no nome.
    expect(groups[2]![1]).toContain('ORGAO-EMISSOR');
    expect(groups.at(-1)![1]).toContain('PERMISSAO-DE-DIVULGACAO');
  });

  it('vínculo da atuação: vínculo, período, outras informações', () => {
    expect(shownOrder(entriesOf('VINCULOS'), 'VINCULOS')).toEqual(formOrder('VINCULOS'));
    expect(shape(entriesOf('VINCULOS')).map(([label]) => label)).toEqual([
      'Vínculo',
      'Período',
      'Outras informações',
      OTHER_DATA,
    ]);
  });

  it('projeto: nome e descrição, situação e período, alunos, inovação', () => {
    expect(shownOrder(entriesOf('PROJETO-DE-PESQUISA'), 'PROJETO-DE-PESQUISA')).toEqual(
      formOrder('PROJETO-DE-PESQUISA'),
    );
    expect(shape(entriesOf('PROJETO-DE-PESQUISA')).map(([label]) => label)).toEqual([
      'Projeto',
      'Situação e período',
      'Alunos envolvidos',
      'Inovação',
      OTHER_DATA,
    ]);
  });

  it('nenhum campo do formulário cai em outro grupo, nem um código fora dos códigos', () => {
    const elements = [
      'DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO',
      'DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO',
      'MESTRADO',
      'DOUTORADO',
      'GRADUACAO',
      'PREMIO-TITULO',
      'IDIOMA',
      'ENDERECO-PROFISSIONAL',
      'DADOS-GERAIS',
      'VINCULOS',
      'PROJETO-DE-PESQUISA',
    ];
    for (const element of elements) {
      for (const g of groupsOf(entriesOf(element))) {
        g.entries.forEach((e, i) => {
          const slot = formSlot(element, e.attr);
          // Código do Lattes ao lado do nome que ele acompanha, no grupo do nome.
          const paired = i > 0 && codeAttrFor(element, g.entries[i - 1]!.attr) === e.attr;
          if (slot) expect(g.label, `${element} ${e.attr}`).toBe(slot.label);
          else if (paired) expect(isSystemAttr(element, e.attr)).toBe(true);
          else if (g.label !== 'Códigos do Lattes') {
            expect(g.label, `${element} ${e.attr}`).toBe(
              isEnglishAttr(e.attr) ? IN_ENGLISH : OTHER_DATA,
            );
          }
        });
      }
    }
  });

  it('vazios no fim de cada grupo, sem trocar de grupo', () => {
    const empty = new Set(['NOME-DO-EVENTO', 'TIPO-PARTICIPACAO']);
    const groups = groupsOf(
      entriesOf(
        'DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO',
        'DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO',
      ),
      (e) => empty.has(e.attr),
    );
    expect(groups[0]!.entries.map((e) => e.attr)).toEqual([
      'FORMA-PARTICIPACAO',
      'ANO',
      'NATUREZA',
      'TIPO-PARTICIPACAO',
      'NOME-DO-EVENTO',
    ]);
  });
});

describe('ordem por assunto, onde o Lattes não diz', () => {
  it('nome e cidade do evento ficam em Evento, não em Publicação', () => {
    const entries = entriesOf('DETALHAMENTO-DO-TRABALHO');
    const groups = groupsOf(entries);
    const where = (attr: string) =>
      groups.find((g) => g.entries.some((e) => e.attr === attr))?.label;
    expect(where('NOME-DO-EVENTO')).toBe('Evento');
    expect(where('CIDADE-DO-EVENTO')).toBe('Evento');
    expect(where('TITULO-DOS-ANAIS-OU-PROCEEDINGS')).toBe('Publicação');
    expect(formLayout('DETALHAMENTO-DO-TRABALHO')).toBeUndefined();
  });
});
