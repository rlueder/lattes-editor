import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { encodeCv, loadCv } from '../src/model/document.ts';
import { childElements, getAttr, setAttr, type XElement } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import { displayValue } from '../src/ui/display.ts';
import {
  daysInMonth,
  displayLattesDate,
  isLattesDateAttr,
  isRedundantDateFormat,
  isValidLattesDate,
  lattesFromMasked,
  maskDateInput,
} from '../src/ui/lattes-date.ts';

describe('isValidLattesDate', () => {
  it('aceita DDMMAAAA de datas que existem, inclusive 29 de fevereiro em ano bissexto', () => {
    expect(isValidLattesDate('15032024')).toBe(true);
    expect(isValidLattesDate('29022024')).toBe(true);
    expect(isValidLattesDate('29022000')).toBe(true);
    expect(isValidLattesDate('31122099')).toBe(true);
    expect(isValidLattesDate('30042024')).toBe(true);
  });

  it('recusa data impossível, incompleta ou fora do formato', () => {
    expect(isValidLattesDate('31022024')).toBe(false);
    expect(isValidLattesDate('29022023')).toBe(false);
    expect(isValidLattesDate('29021900')).toBe(false);
    expect(isValidLattesDate('31042024')).toBe(false);
    expect(isValidLattesDate('00032024')).toBe(false);
    expect(isValidLattesDate('15132024')).toBe(false);
    expect(isValidLattesDate('15002024')).toBe(false);
    expect(isValidLattesDate('15030000')).toBe(false);
    expect(isValidLattesDate('1503202')).toBe(false);
    expect(isValidLattesDate('032024')).toBe(false);
    expect(isValidLattesDate('15/03/2024')).toBe(false);
    expect(isValidLattesDate('DDMMAAAA')).toBe(false);
    expect(isValidLattesDate('')).toBe(false);
  });
});

describe('daysInMonth', () => {
  it('conta fevereiro pelo ano bissexto e os meses de 30 dias', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2024, 4)).toBe(30);
    expect(daysInMonth(2024, 12)).toBe(31);
  });
});

describe('maskDateInput', () => {
  it('põe as barras de dd/mm/aaaa enquanto se digita', () => {
    const typed = ['1', '15', '150', '1503', '15032', '150320', '1503202', '15032024'];
    expect(typed.map((t) => maskDateInput(t).value)).toEqual([
      '1',
      '15',
      '15/0',
      '15/03',
      '15/03/2',
      '15/03/20',
      '15/03/202',
      '15/03/2024',
    ]);
  });

  it('não põe barra sem dígito depois, para o backspace não esbarrar nela', () => {
    expect(maskDateInput('15/').value).toBe('15');
    expect(maskDateInput('15/03/').value).toBe('15/03');
  });

  it('aceita colar com ou sem barras e corta no oitavo dígito', () => {
    expect(maskDateInput('15032024').value).toBe('15/03/2024');
    expect(maskDateInput('15/03/2024').value).toBe('15/03/2024');
    expect(maskDateInput(' 15.03.2024 ').value).toBe('15/03/2024');
    expect(maskDateInput('150320241').value).toBe('15/03/2024');
    expect(maskDateInput('abc').value).toBe('');
  });

  it('mantém o cursor depois do mesmo dígito', () => {
    // Digitou "0" no fim de "15": o cursor passa a barra nova.
    expect(maskDateInput('150', 3)).toEqual({ caret: 4, value: '15/0' });
    // Digitou "9" no meio de "15/03/2024": o nono dígito cai fora.
    expect(maskDateInput('159/03/2024', 3)).toEqual({ caret: 4, value: '15/90/3202' });
    // Apagou a barra: o cursor fica antes dela.
    expect(maskDateInput('1503', 2)).toEqual({ caret: 2, value: '15/03' });
    expect(maskDateInput('', 0)).toEqual({ caret: 0, value: '' });
    expect(maskDateInput('15/03/2024')).toEqual({ caret: 10, value: '15/03/2024' });
  });
});

describe('lattesFromMasked', () => {
  it('converte dd/mm/aaaa completo e válido, e campo vazio vira vazio', () => {
    expect(lattesFromMasked('15/03/2024')).toBe('15032024');
    expect(lattesFromMasked(' 29/02/2024 ')).toBe('29022024');
    expect(lattesFromMasked('')).toBe('');
    expect(lattesFromMasked('   ')).toBe('');
  });

  it('recusa data incompleta ou impossível (o campo volta ao valor guardado)', () => {
    expect(lattesFromMasked('15/03/202')).toBeUndefined();
    expect(lattesFromMasked('15/03')).toBeUndefined();
    expect(lattesFromMasked('31/02/2024')).toBeUndefined();
    expect(lattesFromMasked('00/01/2024')).toBeUndefined();
    expect(lattesFromMasked('15032024')).toBeUndefined();
  });

  it('volta o que displayLattesDate mostra', () => {
    for (const value of ['01011900', '29022024', '31121999', '05062010', '01010001']) {
      expect(lattesFromMasked(displayLattesDate(value))).toBe(value);
    }
  });
});

describe('displayLattesDate', () => {
  it('mostra dd/mm/aaaa e deixa o resto como veio', () => {
    expect(displayLattesDate('15032024')).toBe('15/03/2024');
    expect(displayLattesDate('31022024')).toBe('31022024');
    expect(displayLattesDate('2024')).toBe('2024');
  });

  it('é o que a lista de alterações mostra para datas', () => {
    expect(displayValue('LICENCA', 'DATA-INICIO-LICENCA', '15032024')).toBe('15/03/2024');
    expect(displayValue('LICENCA', 'DATA-INICIO-LICENCA', '99999999')).toBe('99999999');
    expect(displayValue('LICENCA', 'DATA-INICIO-LICENCA', '')).toBe('');
  });
});

describe('isLattesDateAttr', () => {
  it('reconhece a data pelo FORMATO-<nome> ao lado, mesmo fora do schema', () => {
    expect(isLattesDateAttr('X', 'DATA-QUALQUER', ['FORMATO-DATA-QUALQUER'])).toBe(true);
    expect(isLattesDateAttr('X', 'DATA-QUALQUER', [])).toBe(false);
  });

  it('reconhece pelo schema quando o formato tem outro nome ou falta no arquivo', () => {
    expect(isLattesDateAttr('DADOS-GERAIS', 'DATA-NASCIMENTO', [])).toBe(true);
    expect(isLattesDateAttr('DADOS-GERAIS', 'DATA-FALECIMENTO', [])).toBe(true);
    expect(isLattesDateAttr('REGISTRO-OU-PATENTE', 'DATA-PEDIDO-DE-DEPOSITO', [])).toBe(true);
    expect(isLattesDateAttr('LICENCA', 'DATA-FIM-LICENCA', [])).toBe(true);
  });

  it('não pega atributo que não começa com DATA-', () => {
    expect(isLattesDateAttr('LICENCA', 'FORMATO-DATA-FIM-LICENCA', [])).toBe(false);
    expect(isLattesDateAttr('LICENCA', 'ANO-INICIO', [])).toBe(false);
  });

  it('cobre as datas do schema que têm formato DDMMAAAA declarado, e só elas', () => {
    const dates: string[] = [];
    const text: string[] = [];
    for (const [element, spec] of Object.entries(lattesSchema.elements)) {
      for (const a of spec.attributes) {
        if (!a.name.startsWith('DATA-')) continue;
        const names = spec.attributes.map((s) => s.name);
        (isLattesDateAttr(element, a.name, names) ? dates : text).push(`${element} ${a.name}`);
      }
    }
    // Artes cênicas e música não declaram formato: ficam texto.
    expect(text.sort()).toEqual([
      'DETALHAMENTO-DA-MUSICA DATA-ENCERRAMENTO',
      'DETALHAMENTO-DA-MUSICA DATA-ESTREIA',
      'DETALHAMENTO-DE-ARTES-CENICAS DATA-ENCERRAMENTO',
      'DETALHAMENTO-DE-ARTES-CENICAS DATA-ESTREIA',
    ]);
    expect(dates).toHaveLength(15);
  });
});

describe('isRedundantDateFormat', () => {
  it('esconde só o formato que repete DDMMAAAA ou está vazio', () => {
    expect(isRedundantDateFormat('FORMATO-DATA-INICIO-LICENCA', 'DDMMAAAA')).toBe(true);
    expect(isRedundantDateFormat('FORMATO-DATA-INICIO-LICENCA', '')).toBe(true);
    expect(isRedundantDateFormat('FORMATO-DATA-INICIO-LICENCA', 'AAAAMMDD')).toBe(false);
    expect(isRedundantDateFormat('DATA-INICIO-LICENCA', 'DDMMAAAA')).toBe(false);
  });
});

describe('datas do currículo sintético', () => {
  it('passar cada data pelo campo e gravar de volta mantém o arquivo byte a byte', async () => {
    const name = 'synthetic_full.xml';
    const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, '../fixtures', name)));
    const cv = await loadCv(bytes, name);
    let seen = 0;
    const walk = (el: XElement) => {
      const names = el.attrs.map((a) => a.name);
      for (const a of el.attrs) {
        if (!isLattesDateAttr(el.name, a.name, names)) continue;
        if (!isValidLattesDate(a.value)) continue;
        // O mesmo caminho do campo: mostra, lê de volta e grava só se mudou.
        const next = lattesFromMasked(displayLattesDate(a.value))!;
        if (next !== (getAttr(el, a.name) ?? '')) setAttr(el, a.name, next);
        seen++;
      }
      childElements(el).forEach(walk);
    };
    walk(cv.doc.root);
    expect(seen).toBeGreaterThan(10);
    expect(Buffer.from(encodeCv(cv.doc, cv.encoding)).equals(Buffer.from(cv.originalBytes))).toBe(
      true,
    );
  });
});
