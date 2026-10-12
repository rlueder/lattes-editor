import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { encodeCv, loadCv } from '../src/model/document.ts';
import { childElements, getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import {
  initialPickerYear,
  isFourDigitYear,
  isLattesYearAttr,
  isValidLattesYear,
  lattesYearFromInput,
  maskYearInput,
  MAX_LATTES_YEAR,
  MIN_LATTES_YEAR,
} from '../src/ui/lattes-year.ts';
import { elementKey } from '../src/ui/list-view.ts';

describe('isLattesYearAttr', () => {
  it('reconhece ANO e ANO-* sem lista de opções', () => {
    expect(isLattesYearAttr('DADOS-BASICOS-DO-ARTIGO', 'ANO-DO-ARTIGO')).toBe(true);
    expect(isLattesYearAttr('ENSINO-MEDIO-SEGUNDO-GRAU', 'ANO-DE-INICIO')).toBe(true);
    expect(isLattesYearAttr('PROJETO-DE-PESQUISA', 'ANO-FIM')).toBe(true);
    expect(isLattesYearAttr('DADOS-BASICOS-DO-TRABALHO', 'ANO-DO-TRABALHO')).toBe(true);
    // Elemento fora do schema: vale o nome.
    expect(isLattesYearAttr('ELEMENTO-DESCONHECIDO', 'ANO')).toBe(true);
  });

  it('não pega nomes que só começam com ANO', () => {
    expect(isLattesYearAttr('DADOS-BASICOS-DO-ARTIGO', 'ANOTACAO')).toBe(false);
    expect(isLattesYearAttr('DADOS-BASICOS-DO-ARTIGO', 'MES-ANO')).toBe(false);
    expect(isLattesYearAttr('DADOS-BASICOS-DO-ARTIGO', 'TITULO-DO-ARTIGO')).toBe(false);
  });

  it('fixa a lista de atributos de ano do schema', () => {
    const years = new Set<string>();
    for (const [element, spec] of Object.entries(lattesSchema.elements)) {
      for (const a of spec.attributes) {
        if (isLattesYearAttr(element, a.name)) years.add(a.name);
      }
    }
    expect([...years].sort()).toEqual([
      'ANO',
      'ANO-DA-OBRA',
      'ANO-DA-OBRA-DE-REFERENCIA',
      'ANO-DA-PREMIACAO',
      'ANO-DE-CONCLUSAO',
      'ANO-DE-INICIO',
      'ANO-DE-OBTENCAO-DO-TITULO',
      'ANO-DE-REALIZACAO',
      'ANO-DESENVOLVIMENTO',
      'ANO-DO-ARTIGO',
      'ANO-DO-TEXTO',
      'ANO-DO-TRABALHO',
      'ANO-FIM',
      'ANO-INICIO',
      'ANO-SOLICITACAO',
    ]);
  });

  it('nenhum atributo de ano do schema tem lista de opções', () => {
    for (const spec of Object.values(lattesSchema.elements)) {
      for (const a of spec.attributes) {
        if (/^ANO($|-)/.test(a.name)) expect(a.enum).toBeUndefined();
      }
    }
  });
});

describe('validação do ano', () => {
  it('quatro dígitos é o que o campo de ano consegue mostrar', () => {
    expect(isFourDigitYear('2024')).toBe(true);
    expect(isFourDigitYear('0999')).toBe(true);
    expect(isFourDigitYear('')).toBe(false);
    expect(isFourDigitYear('24')).toBe(false);
    expect(isFourDigitYear('20245')).toBe(false);
    expect(isFourDigitYear('2024 ')).toBe(false);
    expect(isFourDigitYear('s/d')).toBe(false);
  });

  it('aceita de 1000 a 9999', () => {
    expect(MIN_LATTES_YEAR).toBe(1000);
    expect(MAX_LATTES_YEAR).toBe(9999);
    expect(isValidLattesYear('1000')).toBe(true);
    expect(isValidLattesYear('2024')).toBe(true);
    expect(isValidLattesYear('9999')).toBe(true);
    expect(isValidLattesYear('0999')).toBe(false);
    expect(isValidLattesYear('0000')).toBe(false);
    expect(isValidLattesYear('999')).toBe(false);
    expect(isValidLattesYear('20a4')).toBe(false);
  });
});

describe('maskYearInput', () => {
  it('fica só com os dígitos, até quatro', () => {
    expect(maskYearInput('2024')).toEqual({ caret: 4, value: '2024' });
    expect(maskYearInput('20a24')).toEqual({ caret: 4, value: '2024' });
    expect(maskYearInput('202456')).toEqual({ caret: 4, value: '2024' });
    expect(maskYearInput('abc')).toEqual({ caret: 0, value: '' });
  });

  it('mantém o cursor depois do mesmo número de dígitos', () => {
    expect(maskYearInput('2x024', 2)).toEqual({ caret: 1, value: '2024' });
    expect(maskYearInput('2024', 2)).toEqual({ caret: 2, value: '2024' });
    expect(maskYearInput('20245', 5)).toEqual({ caret: 4, value: '2024' });
  });
});

describe('lattesYearFromInput', () => {
  it('ano válido grava como está e campo limpo grava vazio', () => {
    expect(lattesYearFromInput('2024')).toBe('2024');
    expect(lattesYearFromInput(' 2024 ')).toBe('2024');
    expect(lattesYearFromInput('')).toBe('');
    expect(lattesYearFromInput('   ')).toBe('');
  });

  it('ano incompleto ou fora de 1000 a 9999 volta ao guardado', () => {
    expect(lattesYearFromInput('202')).toBeUndefined();
    expect(lattesYearFromInput('0999')).toBeUndefined();
    expect(lattesYearFromInput('20245')).toBeUndefined();
  });
});

describe('initialPickerYear', () => {
  it('abre no ano guardado ou, sem ele, no ano corrente', () => {
    expect(initialPickerYear('1987', 2026)).toBe(1987);
    expect(initialPickerYear('', 2026)).toBe(2026);
    expect(initialPickerYear('0999', 2026)).toBe(2026);
  });

  it('fica entre 1000 e 9999', () => {
    expect(initialPickerYear('', 500)).toBe(1000);
    expect(initialPickerYear('', 12000)).toBe(9999);
  });
});

describe('anos do currículo sintético', () => {
  it('passar cada ano pelo campo e gravar de volta mantém o arquivo byte a byte', async () => {
    const name = 'synthetic_full.xml';
    const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, '../fixtures', name)));
    const cv = await loadCv(bytes, name);
    let seen = 0;
    const walk = (el: XElement) => {
      for (const a of el.attrs) {
        if (!isLattesYearAttr(el.name, a.name)) continue;
        if (a.value !== '' && !isFourDigitYear(a.value)) continue;
        // O mesmo caminho do campo: o texto do campo é o valor guardado, e só
        // grava o que mudou.
        const next = lattesYearFromInput(a.value) ?? a.value;
        if (next !== (getAttr(el, a.name) ?? '')) setAttr(el, a.name, next);
        seen++;
      }
      childElements(el).forEach(walk);
    };
    walk(cv.doc.root);
    expect(seen).toBeGreaterThan(100);
    expect(Buffer.from(encodeCv(cv.doc, cv.encoding)).equals(Buffer.from(cv.originalBytes))).toBe(
      true,
    );
  });
});

describe('elementKey', () => {
  it('acompanha o elemento quando a lista muda de ordem', () => {
    const cv = parseXml('<A><B ANO="2024"/><B ANO="2019"/></A>');
    const [first, second] = childElements(cv.root);
    const keys = [elementKey(first!), elementKey(second!)];
    expect(keys[0]).not.toBe(keys[1]);
    // Mudar o ano reordena a lista; a chave de cada cartão continua a mesma.
    setAttr(first!, 'ANO', '2011');
    expect([elementKey(second!), elementKey(first!)]).toEqual([keys[1], keys[0]]);
  });
});
