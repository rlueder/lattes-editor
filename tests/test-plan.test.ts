import { describe, expect, it } from 'vitest';

import type { CensusEntry, CensusFile } from '../src/census/run.ts';
import {
  consistencyFixes,
  donorValues,
  lookupValues,
  matchesCreated,
  pickOption,
  TEST_MARK,
  testJobs,
  textValue,
  VALID_ISBN,
  VALID_ISSN,
  variantCount,
} from '../src/census/test-plan.ts';

const field = (name: string, type: string, values: string[] = []) => ({
  disabled: false,
  inHiddenBlock: false,
  label: name,
  name,
  options: values.map((v) => ({ label: v, value: v })),
  readOnly: false,
  type,
});

const entry = (id: string, fields: ReturnType<typeof field>[], status = 'ok'): CensusEntry =>
  ({
    elements: [],
    elementsProvenance: 'observado',
    id,
    label: id,
    page: { forms: [{ action: 'X', fields, hidden: 0, method: 'post', name: 'GN_X' }], title: '' },
    path: `${id}.form`,
    provenance: 'observado',
    source: 'teste',
    status,
  }) as unknown as CensusEntry;

describe('itens de teste: o plano', () => {
  it('uma variante por opção da maior escolha pequena; listas grandes não contam', () => {
    const e = entry('tec', [
      field('F_COD_PROD', 'radio', ['1', '2', '3']),
      field('f_meio', 'select-one', ['', 'I', 'D', 'V', 'O']),
      field('f_pais', 'select-one', ['BRA', 'ARG', 'CHL', 'URU', 'PAR', 'BOL']),
      field('f_titulo', 'text'),
    ]);
    expect(variantCount(e)).toBe(4);
  });

  it('pula registro único, entrada sem formulário e entrada com erro', () => {
    const file = {
      entries: [
        entry('tec', [field('F_COD_PROD', 'radio', ['1', '2'])]),
        entry('identificacao', [field('f_sexo', 'radio', ['M', 'F'])]),
        entry('quebrado', [], 'erro'),
      ],
    } as unknown as CensusFile;
    expect(testJobs(file).map((j) => j.tag)).toEqual(['tec-v0', 'tec-v1']);
  });

  it('o texto leva o marcador e cabe no limite; ano, data, mês e número no formato', () => {
    expect(textValue('f_titulo', 400, 0, 'tec-v0')).toBe(`${TEST_MARK} tec-v0 f_titulo`);
    expect(textValue('f_cidade', 10, 0, 'tec-v0')).toHaveLength(10);
    expect(textValue('f_ano', 4, 3, 'x')).toBe('2008');
    // Número de registro único por item, dentro do tamanho do campo.
    const reg = textValue('f_cod_reg', 16, 0, 'patente-v0');
    expect(reg).toMatch(/^TESTE\d+$/);
    expect(reg.length).toBeLessThanOrEqual(16);
    expect(textValue('f_cod_reg', 16, 0, 'patente-v1')).not.toBe(reg);
    expect(textValue('f_dta_ini', 10, 1, 'x')).toBe('11/02/2006');
    expect(textValue('f_mes_ini', 2, 11, 'x')).toBe('12');
    expect(textValue('f_duracao', 4, 2, 'x')).toBe('12');
    expect(textValue('f_homepage', 200, 0, 'tec-v0')).toBe('https://exemplo.org/tec-v0/f_homepage');
    expect(textValue('f_email', 100, 0, 'x')).toBe('teste@exemplo.org');
  });

  it('a opção da variante; nas listas grandes, Brasil ou português', () => {
    const opts = (...v: string[]) => v.map((value) => ({ text: value, value }));
    expect(pickOption('f_meio', opts('', 'I', 'D', 'V'), 4)?.value).toBe('D');
    expect(pickOption('f_pais', opts('ARG', 'BRA'), 0)?.value).toBe('BRA');
    expect(
      pickOption(
        'F_IDIOMA',
        [
          { text: 'Inglês', value: '1' },
          { text: 'Português', value: '2' },
        ],
        0,
      )?.value,
    ).toBe('2');
    expect(pickOption('f_meio', opts(''), 0)).toBeUndefined();
  });
});

describe('itens de teste: o que o check() das formações pede', () => {
  it('término e obtenção só com o curso concluído; agência só com bolsa', () => {
    const agency = { code: '0001', name: 'Agência' };
    expect(consistencyFixes({ F_BOLSA: 'S', F_STATUS: 'N' }, agency)).toEqual({
      f_agencia: '0001',
      f_ano_fim: '',
      f_ano_obten: '',
      f_mes_obten: '',
      f_nme_agencia: 'Agência',
    });
    expect(consistencyFixes({ F_BOLSA: 'N', F_STATUS: 'S' }, agency)).toEqual({
      f_agencia: '',
      f_nme_agencia: '',
    });
    expect(consistencyFixes({ F_BOLSA: 'S' })).toEqual({ f_agencia: '', f_nme_agencia: '' });
    expect(consistencyFixes({ F_STATUS: 'I' })).toEqual({ f_ano_obten: '', f_mes_obten: '' });
    expect(consistencyFixes({ f_titulo: 'x' })).toEqual({});
  });

  it('banca: o tipo acadêmico ou profissional só no mestrado', () => {
    expect(consistencyFixes({ F_COD_PROD: 'A12', f_sub_prod: '34 ' })).toEqual({ f_sub_prod: '' });
    expect(consistencyFixes({ F_COD_PROD: 'A11', f_sub_prod: '34 ' })).toEqual({});
  });

  it('a instituição de uma formação sua vale também para o sanduíche e a cotutela', () => {
    const out = lookupValues({ f_cod_curso: '9', f_cod_inst: '7', f_inst: 'Universidade' });
    expect(out).toMatchObject({
      f_cod_inst_dout: '7',
      f_cod_inst_dout_ct: '7',
      f_cod_inst_dout_sw: '7',
      f_inst_dout_sw: 'Universidade',
    });
  });

  it('item sem texto marcado se reconhece pelas datas que levou', () => {
    const values = { f_dta_fim: '10/01/2005', f_dta_inicio: '10/01/2005', f_tipo_licenca: '2' };
    expect(matchesCreated('<input value="10/01/2005">', values)).toBe(true);
    expect(matchesCreated('<input value="11/02/2006">', values)).toBe(false);
    expect(matchesCreated('qualquer', { f_tipo_licenca: '2' })).toBe(false);
    expect(matchesCreated(`x ${TEST_MARK} a`, { f_titulo: `${TEST_MARK} a` })).toBe(true);
  });
});

describe('itens de teste: o que as validações das produções e da atuação pedem', () => {
  it('DOI vazio, ISSN e ISBN válidos, números só com dígitos, artigo aceito no ano atual', () => {
    expect(textValue('f_cod_doi', 250, 0, 'artigo-v0')).toBe('');
    expect(textValue('f_issn', 10, 0, 'x')).toBe(VALID_ISSN);
    expect(textValue('f_isbn', 13, 0, 'x')).toBe(VALID_ISBN);
    expect(textValue('f_fasciculo', 10, 3, 'x')).toBe('13');
    expect(textValue('f_serie', 5, 0, 'x')).toBe('10');
    expect(textValue('f_ano', 4, 0, 'artigo-aceito-v0')).toBe(String(new Date().getFullYear()));
  });

  it('período atual sem fim, projeto com fim só concluído, e sem empresa', () => {
    expect(consistencyFixes({ f_status: 'S' })).toEqual({ f_ano_fim: '', f_mes_fim: '' });
    expect(consistencyFixes({ f_status: 'N' })).toEqual({});
    expect(consistencyFixes({ F_TPO_SITUACAO: 'A', f_tpo_pesq_emp: 'S' })).toEqual({
      F_ANO_FIM: '',
      f_tpo_pesq_emp: 'N',
    });
    expect(consistencyFixes({ F_TPO_SITUACAO: 'C' })).toEqual({});
  });

  it('de um item seu, só os campos de busca e de lugar com valor', () => {
    expect(
      donorValues([
        ['f_codorgao', '12'],
        ['f_seq_ativ', '3'],
        ['f_codinst', '0001'],
        ['f_titulo', 'Meu trabalho'],
        ['f_seq', '9'],
        ['f_cod', 'K000'],
        ['f_issn_h', ''],
      ]),
    ).toEqual({ f_codinst: '0001', f_codorgao: '12', f_seq_ativ: '3' });
  });
});
