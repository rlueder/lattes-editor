import { describe, expect, it } from 'vitest';

import { knownOptionValue } from '../src/census/known-options.ts';
import type { FieldLink } from '../src/census/link.ts';
import { booleanOf, checkOptions, editorControl, observedMap } from '../src/census/option-check.ts';

const o = (value: string, label = '') => ({ label, value });
const radio = (name: string) => ({ name, type: 'radio' });
const enumLink = (valueMap: Record<string, string>, extra: Partial<FieldLink> = {}): FieldLink => ({
  attribute: 'A',
  by: 'enumeracao',
  conflicts: 0,
  element: 'E',
  field: 'f',
  matches: 2,
  target: 't',
  valueMap,
  ...extra,
});

describe('censo: opções do Lattes contra o controle do editor', () => {
  it('decide o controle como o editor', () => {
    expect(editorControl('IDIOMA', 'IDIOMA')).toBe('sistema');
    expect(editorControl('FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA', 'NIVEL')).toBe(
      'sistema',
    );
    expect(editorControl('MESTRADO', 'FLAG-BOLSA')).toBe('booleano');
    expect(editorControl('MESTRADO', 'TIPO-MESTRADO')).toBe('codigo');
    expect(editorControl('DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO', 'NATUREZA')).toBe(
      'derivado',
    );
    expect(editorControl('DADOS-BASICOS-DO-ARTIGO', 'PAIS')).toBe('lista');
    expect(editorControl('MESTRADO', 'STATUS-DO-CURSO')).toBe('enum');
    expect(editorControl('MESTRADO', 'NOME-INSTITUICAO')).toBe('derivado');
    expect(editorControl('DOUTORADO', 'TIPO-DOUTORADO')).toBe('codigo');
    expect(editorControl('DADOS-GERAIS', 'PCD')).toBe('texto');
  });

  it('sim/não pelo código, ou pelo rótulo quando o código não diz', () => {
    expect(booleanOf(o('S', 'Não'))).toBe('SIM');
    expect(booleanOf(o('0'))).toBe('NAO');
    expect(booleanOf(o('x', 'sim'))).toBe('SIM');
    expect(booleanOf(o('x', 'Não'))).toBe('NAO');
    expect(booleanOf(o('3', 'Dedicação exclusiva'))).toBeUndefined();
  });

  it('booleano: S/N e caixa sozinha servem; outra coisa ou mapa contrário diverge', () => {
    const w = 't:MESTRADO@FLAG-BOLSA';
    expect(
      checkOptions(w, radio('F_BOLSA'), [o(''), o('S', 'Sim'), o('N', 'Não')], []).found,
    ).toEqual([]);
    expect(
      checkOptions(w, { name: 'f_regime', type: 'checkbox' }, [o('3', 'Dedicação')], []).found,
    ).toEqual([]);
    expect(
      checkOptions(w, radio('F_X'), [o('A', 'Talvez'), o('B', 'Nunca')], []).found[0]!.key,
    ).toBe('booleano-diferente:t:MESTRADO@FLAG-BOLSA');
    const contra = checkOptions(
      w,
      radio('f_s'),
      [o('0'), o('1')],
      [enumLink({ '0': 'SIM', '1': 'NAO' })],
    ).found;
    expect(contra).toEqual([
      {
        detail:
          'MESTRADO@FLAG-BOLSA: nos itens da exportação, f_s 0 vem com SIM, 1 vem com NAO, ao contrário do código da opção',
        key: 'valor-contrariado:t:MESTRADO@FLAG-BOLSA:f_s',
      },
    ]);
    // f_stavinc é invertido em relação à exportação (observado em 15/10/2026):
    // 0 ↔ SIM e 1 ↔ NAO é o esperado, e o contrário passa a ser a divergência.
    const vinc = 'vinculo:VINCULOS@FLAG-VINCULO-EMPREGATICIO';
    const stavinc = { name: 'f_stavinc', type: 'select-one' };
    const opts = [o(''), o('0', 'Não'), o('1', 'Sim')];
    expect(checkOptions(vinc, stavinc, opts, [enumLink({ '0': 'SIM', '1': 'NAO' })]).found).toEqual(
      [],
    );
    expect(checkOptions(vinc, stavinc, opts, [enumLink({ '0': 'NAO', '1': 'SIM' })]).found).toEqual(
      [
        {
          detail:
            'VINCULOS@FLAG-VINCULO-EMPREGATICIO: nos itens da exportação, f_stavinc 0 vem com NAO, 1 vem com SIM, ao contrário da inversão observada',
          key: 'valor-contrariado:vinculo:VINCULOS@FLAG-VINCULO-EMPREGATICIO:f_stavinc',
        },
      ],
    );
    // Mapa fraco (um item, ou com contradição) não conta.
    expect(
      observedMap([enumLink({ S: 'X' }, { matches: 1 }), enumLink({ N: 'Y' }, { conflicts: 1 })]),
    ).toEqual({});
  });

  it('códigos do editor contra os do Lattes, com rótulo', () => {
    const w = 't:MESTRADO@TIPO-MESTRADO';
    expect(
      checkOptions(w, radio('f_tpo'), [o('N', 'normal'), o('S', 'sanduíche')], []).found,
    ).toEqual([]);
    const diff = checkOptions(w, radio('f_tpo'), [o('N', 'comum'), o('C', 'co-tutela')], []).found;
    expect(diff[0]!.detail).toBe(
      'MESTRADO@TIPO-MESTRADO: códigos novos no Lattes: C; só no editor: S; rótulos diferentes: N (comum)',
    );
  });

  it('enumeração do XSD: pelo rótulo, pelo código no fim do valor, ou pelo observado', () => {
    const status = 't:MESTRADO@STATUS-DO-CURSO';
    expect(
      checkOptions(status, radio('F_STATUS'), [o('N', 'em andamento'), o('S', 'concluído')], [])
        .found,
    ).toEqual([]);
    const patente = 't:REGISTRO-OU-PATENTE@TIPO-PATENTE';
    expect(
      checkOptions(patente, radio('f_tipo'), [o('PI', 'Invenção'), o('MU', 'Modelo')], []).found,
    ).toEqual([]);
    const sexo = 't:DADOS-GERAIS@SEXO';
    const seen = [enumLink({ F: 'FEMININO', M: 'MASCULINO' })];
    expect(checkOptions(sexo, radio('f_sexo'), [o('M'), o('F')], seen).found).toEqual([]);
    expect(checkOptions(sexo, radio('f_sexo'), [o('M'), o('F')], []).found[0]!.key).toBe(
      'lista-diferente:t:DADOS-GERAIS@SEXO',
    );
  });

  it('lista tipada pelos rótulos; texto livre com opções é lista não ligada; sistema não conta', () => {
    const pais = checkOptions(
      't:DADOS-BASICOS-DO-ARTIGO@PAIS',
      { name: 'f_pais', type: 'select-one' },
      [o('BRA', 'Brasil'), o('ATL', 'Atlântida')],
      [],
    );
    expect(pais.control).toBe('lista');
    expect(pais.found[0]!.detail).toMatch(/novas no Lattes: Atlântida; só no editor: /);
    expect(
      checkOptions('t:DADOS-GERAIS@PCD', radio('f_pcd'), [o('N', 'não')], []).found[0]!.key,
    ).toBe('lista-nao-ligada:t:DADOS-GERAIS@PCD:f_pcd');
    expect(
      checkOptions('t:IDIOMA@IDIOMA', radio('F_COD_IDIOMA'), [o('EN', 'Inglês')], []).found,
    ).toEqual([]);
  });

  it('o mapa de uma ligação por valor também vale como observado', () => {
    expect(observedMap([enumLink({ '1B3': 'ORQUESTRA' }, { by: 'valor' })])).toEqual({
      '1B3': 'ORQUESTRA',
    });
  });

  it('valor conhecido de uma opção: pelo elemento e atributo ou só pelo atributo', () => {
    expect(knownOptionValue('DADOS-BASICOS-DO-LIVRO', 'TIPO', '133')).toBe(
      'LIVRO_ORGANIZADO_OU_EDICAO',
    );
    expect(knownOptionValue('DADOS-BASICOS-DO-TRABALHO', 'MEIO-DE-DIVULGACAO', 'V')).toBe('VARIOS');
    expect(
      knownOptionValue('DADOS-BASICOS-DO-TRABALHO', 'MEIO-DE-DIVULGACAO', 'X'),
    ).toBeUndefined();
    const check = checkOptions(
      't:DADOS-BASICOS-DO-TRABALHO@MEIO-DE-DIVULGACAO',
      { name: 'f_meio', type: 'select-one' },
      [o('I', 'Impresso'), o('V', 'impresso e mídia eletrônica')],
      [],
    );
    expect(check.found).toEqual([]);
  });
});
