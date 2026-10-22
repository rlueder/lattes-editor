import { describe, expect, it } from 'vitest';

import { natureCode } from '../src/bridge/edit-items.ts';
import { newItem } from '../src/model/production.ts';
import { validateItem } from '../src/model/validate.ts';
import { element, firstChild, setAttr } from '../src/model/xml.ts';
import { lattesSchema as schema } from '../src/schema/lattes.ts';
import listas from '../src/schema/listas-lattes.json' with { type: 'json' };
import {
  canonicalChoice,
  derivedValue,
  emptyChoicesHint,
  EVENT_NATURES,
  isEventBasics,
  matchesDerived,
  outOfList,
  titleRequired,
  typedChoices,
} from '../src/schema/typed-choices.ts';

const CONGRESS = 'DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO';
const OTHER = 'DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS';
const TODAY = new Date(2026, 9, 13);

const basics = (name: string, attrs: Record<string, string> = {}) => element(name, attrs);
const values = (choices: { value: string }[] | undefined) => choices?.map((c) => c.value);

describe('campos tipados: natureza da participação em evento', () => {
  it('segue o tipo de evento, com o texto do combo do Lattes', () => {
    const expected: Record<string, string> = {
      CONGRESSO: 'Congresso',
      ENCONTRO: 'Encontro',
      EXPOSICAO: 'Exposição',
      FEIRA: 'Feira',
      OFICINA: 'Oficina',
      OLIMPIADA: 'Olimpíada',
      SEMINARIO: 'Seminário',
      SIMPOSIO: 'Simpósio',
    };
    for (const [kind, nature] of Object.entries(expected)) {
      expect(derivedValue(`DADOS-BASICOS-DA-PARTICIPACAO-EM-${kind}`, 'NATUREZA')).toBe(nature);
    }
    expect(derivedValue(OTHER, 'NATUREZA')).toBe('Outra');
    // O vigia confere a mesma lista que o campo usa: cada natureza derivada está
    // nela, e nada além delas.
    const derived = [...Object.keys(expected).map((k) => expected[k]!), 'Outra'];
    expect([...EVENT_NATURES].sort()).toEqual(derived.sort());
  });

  it('não vale fora da participação em evento nem para outro atributo', () => {
    expect(derivedValue('DADOS-BASICOS-DO-TRABALHO', 'NATUREZA')).toBeUndefined();
    expect(derivedValue(CONGRESS, 'TITULO')).toBeUndefined();
    expect(isEventBasics(CONGRESS)).toBe(true);
    expect(isEventBasics(OTHER)).toBe(true);
    expect(isEventBasics('DADOS-BASICOS-DO-ARTIGO')).toBe(false);
  });

  it('um item novo já vem com a natureza', () => {
    const item = newItem(schema, 'PARTICIPACAO-EM-CONGRESSO', 34);
    expect(firstChild(item, CONGRESS)?.attrs.find((a) => a.name === 'NATUREZA')?.value).toBe(
      'Congresso',
    );
  });
});

describe('campos tipados: listas', () => {
  it('país e idioma pelo nome, nas listas do Lattes', () => {
    const countries = values(typedChoices(basics('DADOS-BASICOS-DO-ARTIGO'), 'PAIS'));
    expect(countries).toEqual(listas.paises);
    expect(countries).toContain('Alemanha');
    expect(countries).toContain('Brasil');
    for (const attr of ['PAIS-DE-NASCIMENTO', 'PAIS-DE-PUBLICACAO', 'PAIS-DO-EVENTO']) {
      expect(typedChoices(basics('DADOS-GERAIS'), attr)).toBeDefined();
    }
    const languages = values(typedChoices(basics('DADOS-BASICOS-DO-ARTIGO'), 'IDIOMA'));
    expect(languages).toContain('Inglês');
    expect(languages).toContain('Português');
    expect(typedChoices(basics('DETALHAMENTO-DA-TRADUCAO'), 'IDIOMA-DA-OBRA-ORIGINAL')).toEqual(
      typedChoices(basics('DADOS-BASICOS-DO-ARTIGO'), 'IDIOMA'),
    );
  });

  it('UF de nascimento e do órgão emissor pela sigla, da identificação', () => {
    const ufs = values(typedChoices(basics('DADOS-GERAIS'), 'UF-NASCIMENTO'));
    expect(ufs).toHaveLength(27);
    expect(ufs).toContain('RS');
    expect(typedChoices(basics('DADOS-GERAIS'), 'UF-ORGAO-EMISSOR')).toEqual(
      typedChoices(basics('DADOS-GERAIS'), 'UF-NASCIMENTO'),
    );
    expect(typedChoices(basics('ENDERECO-PROFISSIONAL'), 'UF')).toBeUndefined();
    expect(outOfList(basics('DADOS-GERAIS', { 'UF-NASCIMENTO': 'XX' }), 'UF-NASCIMENTO')).toBe(
      true,
    );
  });

  it('o idioma da seção Idiomas é código e fica de fora', () => {
    expect(typedChoices(basics('IDIOMA'), 'IDIOMA')).toBeUndefined();
  });

  it('forma de participação e tipo conforme a forma', () => {
    expect(values(typedChoices(basics(CONGRESS), 'FORMA-PARTICIPACAO'))).toEqual([
      'Convidado',
      'Participante',
      'Ouvinte',
    ]);
    const typeFor = (form: string) =>
      values(typedChoices(basics(CONGRESS, { 'FORMA-PARTICIPACAO': form }), 'TIPO-PARTICIPACAO'));
    expect(typeFor('Convidado')).toEqual([
      'Conferencista',
      'Simposista',
      'Moderador',
      'Avaliador',
      'Homenageado',
    ]);
    expect(typeFor('Participante')).toEqual([
      'Poster / Painel',
      'Apresentação oral',
      'Outras formas',
    ]);
    expect(typeFor('Ouvinte')).toEqual([]);
    expect(typeFor('')).toEqual([]);
    expect(values(typedChoices(basics(CONGRESS), 'TIPO-PARTICIPACAO'))).toEqual([]);
  });

  it('campo livre e participação fora de evento não têm lista', () => {
    expect(typedChoices(basics(CONGRESS), 'TITULO')).toBeUndefined();
    expect(typedChoices(basics('DADOS-BASICOS-DO-ARTIGO'), 'FORMA-PARTICIPACAO')).toBeUndefined();
  });

  it('o tipo sem opção explica por quê', () => {
    expect(emptyChoicesHint(basics(CONGRESS), 'TIPO-PARTICIPACAO')).toBe(
      'Escolha a forma primeiro',
    );
    expect(
      emptyChoicesHint(basics(CONGRESS, { 'FORMA-PARTICIPACAO': 'Ouvinte' }), 'TIPO-PARTICIPACAO'),
    ).toBe('Não se aplica a ouvinte');
    // Forma que não é da lista (dado antigo): não fingir que é ouvinte.
    expect(
      emptyChoicesHint(basics(CONGRESS, { 'FORMA-PARTICIPACAO': 'Outro' }), 'TIPO-PARTICIPACAO'),
    ).toBe('Forma não reconhecida: escolha outra');
    expect(emptyChoicesHint(basics(CONGRESS), 'PAIS')).toBeUndefined();
    expect(
      emptyChoicesHint(basics('DADOS-BASICOS-DO-ARTIGO'), 'TIPO-PARTICIPACAO'),
    ).toBeUndefined();
  });
});

describe('campos tipados: valor fora da lista', () => {
  it('vazio e valor da lista não contam; o resto sim', () => {
    expect(outOfList(basics(CONGRESS, { PAIS: '' }), 'PAIS')).toBe(false);
    expect(outOfList(basics(CONGRESS, { PAIS: 'Alemanha' }), 'PAIS')).toBe(false);
    expect(outOfList(basics(CONGRESS, { PAIS: 'Germany' }), 'PAIS')).toBe(true);
    expect(outOfList(basics(CONGRESS, { TITULO: 'Qualquer coisa' }), 'TITULO')).toBe(false);
  });

  it('toda natureza que o editor oferece tem a opção do Lattes no envio', () => {
    // As duas listas (a do campo e a de F_COD_PROD no conector) são do mesmo
    // combo: uma natureza que o editor aceita e o conector não acha ficaria à mão.
    expect(EVENT_NATURES).toHaveLength(9);
    expect(EVENT_NATURES.map(natureCode)).toEqual(expect.not.arrayContaining([undefined]));
    expect(new Set(EVENT_NATURES.map(natureCode)).size).toBe(9);
  });

  it('a natureza se escolhe entre as do Lattes, a do tipo de evento primeiro', () => {
    expect(outOfList(basics(CONGRESS, { NATUREZA: 'Congresso' }), 'NATUREZA')).toBe(false);
    // Outra natureza do Lattes vale: a página de alteração troca no mesmo item.
    expect(outOfList(basics(CONGRESS, { NATUREZA: 'Encontro' }), 'NATUREZA')).toBe(false);
    expect(outOfList(basics(CONGRESS, { NATUREZA: 'Palestra' }), 'NATUREZA')).toBe(true);
    // Vazia conta: o Lattes nunca deixa a natureza vazia.
    expect(outOfList(basics(CONGRESS, { NATUREZA: '' }), 'NATUREZA')).toBe(true);
    const list = values(typedChoices(basics(CONGRESS, { NATUREZA: 'Encontro' }), 'NATUREZA'));
    expect(list?.[0]).toBe('Congresso');
    expect(list).toHaveLength(9);
    // O campo nunca trava; "congresso" fica dentro da lista, sem acento nem caixa.
    expect(matchesDerived(basics(CONGRESS, { NATUREZA: 'Congresso' }), 'NATUREZA')).toBe(false);
    expect(outOfList(basics(CONGRESS, { NATUREZA: 'congresso' }), 'NATUREZA')).toBe(false);
  });

  it('acento e maiúscula não contam na comparação com a lista', () => {
    expect(outOfList(basics(CONGRESS, { PAIS: 'alemanha' }), 'PAIS')).toBe(false);
    expect(outOfList(basics(CONGRESS, { PAIS: 'Coreia Do Sul' }), 'PAIS')).toBe(false);
  });

  it('o valor que só difere em acento ou maiúscula aponta a opção certa', () => {
    expect(canonicalChoice(basics(CONGRESS, { PAIS: 'alemanha' }), 'PAIS')).toBe('Alemanha');
    expect(canonicalChoice(basics(CONGRESS, { PAIS: 'Alemanha' }), 'PAIS')).toBeUndefined();
    expect(canonicalChoice(basics(CONGRESS, { PAIS: 'Germany' }), 'PAIS')).toBeUndefined();
    expect(canonicalChoice(basics(CONGRESS, { PAIS: '' }), 'PAIS')).toBeUndefined();
    expect(canonicalChoice(basics(CONGRESS, { TITULO: 'x' }), 'TITULO')).toBeUndefined();
    expect(canonicalChoice(basics(CONGRESS, { NATUREZA: 'congresso' }), 'NATUREZA')).toBe(
      'Congresso',
    );
  });

  it('o tipo tem de combinar com a forma', () => {
    const el = basics(CONGRESS, {
      'FORMA-PARTICIPACAO': 'Ouvinte',
      'TIPO-PARTICIPACAO': 'Apresentação oral',
    });
    expect(outOfList(el, 'TIPO-PARTICIPACAO')).toBe(true);
    setAttr(el, 'FORMA-PARTICIPACAO', 'Participante');
    expect(outOfList(el, 'TIPO-PARTICIPACAO')).toBe(false);
  });
});

describe('campos tipados: validação da participação em evento', () => {
  function participation(attrs: Record<string, string>) {
    const item = newItem(schema, 'PARTICIPACAO-EM-CONGRESSO', 34);
    const part = firstChild(item, CONGRESS)!;
    setAttr(part, 'ANO', '2026');
    for (const [k, v] of Object.entries(attrs)) setAttr(part, k, v);
    const detail = firstChild(item, 'DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO')!;
    setAttr(detail, 'NOME-DO-EVENTO', '2026 LOINC Conference');
    return item;
  }
  const messages = (attrs: Record<string, string>) =>
    validateItem(schema, participation(attrs), TODAY).map((p) => p.message);

  it('ouvinte não precisa de título', () => {
    expect(messages({ 'FORMA-PARTICIPACAO': 'Ouvinte' })).not.toContain('Título: obrigatório');
    expect(messages({})).not.toContain('Título: obrigatório');
  });

  it('participante e convidado precisam de título', () => {
    expect(messages({ 'FORMA-PARTICIPACAO': 'Participante' })).toContain('Título: obrigatório');
    expect(messages({ 'FORMA-PARTICIPACAO': 'Convidado' })).toContain('Título: obrigatório');
    expect(messages({ 'FORMA-PARTICIPACAO': 'Participante', TITULO: 'fhir-brasil' })).not.toContain(
      'Título: obrigatório',
    );
  });

  it('valor fora da lista vira pendência, sem apagar o valor', () => {
    const item = participation({ PAIS: 'Germany' });
    const problems = validateItem(schema, item, TODAY);
    expect(problems.map((p) => p.message)).toContain('País: "Germany" não está na lista do Lattes');
    expect(firstChild(item, CONGRESS)?.attrs.find((a) => a.name === 'PAIS')?.value).toBe('Germany');
  });

  it('título fora da participação em evento continua obrigatório', () => {
    expect(titleRequired(basics('DADOS-BASICOS-DO-ARTIGO'))).toBe(true);
  });
});

describe('campos tipados: status do curso do pós-doutorado', () => {
  it('oferece as três opções do rádio do Lattes, com o valor dos outros níveis', () => {
    const postdoc = basics('POS-DOUTORADO', { 'STATUS-DO-CURSO': 'CONCLUIDO' });
    expect(typedChoices(postdoc, 'STATUS-DO-CURSO')).toEqual([
      { label: 'Em andamento', value: 'EM_ANDAMENTO' },
      { label: 'Concluído', value: 'CONCLUIDO' },
      { label: 'Incompleto', value: 'INCOMPLETO' },
    ]);
    expect(outOfList(postdoc, 'STATUS-DO-CURSO')).toBe(false);
    expect(typedChoices(postdoc, 'STATUS-DO-ESTAGIO')).toBeUndefined();
    expect(typedChoices(basics('DOUTORADO'), 'STATUS-DO-CURSO')).toBeUndefined();
  });

  it('listas de produção conferidas no Lattes real, com o texto da opção como valor', () => {
    const acting = typedChoices(element('DETALHAMENTO-DE-ARTES-CENICAS'), 'ATIVIDADE-DOS-AUTORES');
    expect(acting?.map((c) => c.value)).toContain('Ator');
    expect(acting?.every((c) => c.label === c.value)).toBe(true);
    expect(
      typedChoices(element('DETALHAMENTO-DE-CURSOS-CURTA-DURACAO-MINISTRADO'), 'UNIDADE')?.map(
        (c) => c.value,
      ),
    ).toEqual(['horas', 'dias', 'semanas']);
    expect(typedChoices(element('DETALHAMENTO-DA-MARCA'), 'NATUREZA')).toHaveLength(4);
    // A disponibilidade ainda não: a grafia exata do XML não ficou firme.
    expect(
      typedChoices(element('DETALHAMENTO-DO-PRODUTO-TECNOLOGICO'), 'DISPONIBILIDADE'),
    ).toBeUndefined();
  });
});
