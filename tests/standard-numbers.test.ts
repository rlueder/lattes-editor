import { describe, expect, it } from 'vitest';

import {
  cleanIsbn,
  cleanIssn,
  formatIssn,
  isbnError,
  issnCheckDigit,
  issnError,
  issnOrIsbnError,
  validIsbn,
  validIssn,
} from '../src/model/standard-numbers.ts';
import { cleanLinkValue, linkError } from '../src/ui/link-fields.ts';

// Exemplos clássicos, com a conta feita à mão aqui ao lado do código.
describe('ISSN', () => {
  it('confere a conta do dígito de 0317-8471 (pesos 8 a 2, módulo 11)', () => {
    // 0·8 + 3·7 + 1·6 + 7·5 + 8·4 + 4·3 + 7·2 = 120; 120 mod 11 = 10; 11 − 10 = 1.
    const sum = 0 * 8 + 3 * 7 + 1 * 6 + 7 * 5 + 8 * 4 + 4 * 3 + 7 * 2;
    expect(sum).toBe(120);
    expect((11 - (sum % 11)) % 11).toBe(1);
    expect(issnCheckDigit('0317847')).toBe('1');
    expect(validIssn('0317-8471')).toBe(true);
    expect(validIssn('03178471')).toBe(true);
  });

  it('aceita o X como dígito 10, em minúscula também', () => {
    expect(issnCheckDigit('2434561')).toBe('X');
    expect(validIssn('2434-561x')).toBe(true);
  });

  it('recusa dígito trocado e tamanho errado, com a mensagem de cada caso', () => {
    expect(validIssn('0317-8472')).toBe(false);
    expect(issnError('0317-8472')).toBe('ISSN inválido: o dígito verificador não confere');
    expect(issnError('0317-847')).toMatch(/são 8 caracteres/);
    expect(issnError('  ')).toBeUndefined();
    expect(issnError('0317-8471')).toBeUndefined();
  });

  it('guarda como foi digitado, sem espaços e com X maiúsculo; mostra NNNN-NNNN', () => {
    expect(cleanIssn(' 2434-561x ')).toBe('2434-561X');
    expect(cleanIssn('03178471')).toBe('03178471');
    expect(formatIssn('03178471')).toBe('0317-8471');
    expect(formatIssn('0317-8471')).toBe('0317-8471');
    expect(formatIssn('abc')).toBe('abc');
  });
});

describe('ISBN', () => {
  it('ISBN-13 978-0-306-40615-7: pesos 1 e 3, soma divisível por 10', () => {
    const digits = [9, 7, 8, 0, 3, 0, 6, 4, 0, 6, 1, 5, 7];
    const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
    expect(sum).toBe(100);
    expect(validIsbn('978-0-306-40615-7')).toBe(true);
    expect(validIsbn('978 0 306 40615 7')).toBe(true);
  });

  it('ISBN-10 0-306-40615-2: pesos 10 a 1, soma divisível por 11', () => {
    const digits = [0, 3, 0, 6, 4, 0, 6, 1, 5, 2];
    const sum = digits.reduce((acc, d, i) => acc + d * (10 - i), 0);
    expect(sum).toBe(132);
    expect(sum % 11).toBe(0);
    expect(validIsbn('0-306-40615-2')).toBe(true);
  });

  it('ISBN-10 com X no fim', () => {
    // 0·10 + 8·9 + 0·8 + 4·7 + 4·6 + 2·5 + 9·4 + 5·3 + 7·2 = 199; 199 + 10 = 209 = 11·19.
    expect(validIsbn('0-8044-2957-X')).toBe(true);
    expect(validIsbn('080442957x')).toBe(true);
  });

  it('recusa dígito trocado, prefixo fora de 978/979 e tamanho errado', () => {
    expect(isbnError('978-0-306-40615-8')).toBe('ISBN inválido: o dígito verificador não confere');
    expect(isbnError('0-306-40615-3')).toBe('ISBN inválido: o dígito verificador não confere');
    expect(isbnError('977-0-306-40615-7')).toMatch(/978 ou 979/);
    expect(isbnError('12345')).toMatch(/10 ou 13 dígitos/);
    expect(isbnError('03064X6152')).toMatch(/ISBN-10 tem 9 dígitos/);
    expect(isbnError('')).toBeUndefined();
  });

  it('não converte 10 em 13: guarda só os dígitos do que foi digitado', () => {
    expect(cleanIsbn(' 0-306-40615-2 ')).toBe('0306406152');
    expect(cleanIsbn('978-0-306-40615-7')).toBe('9780306406157');
    expect(cleanIsbn('0-8044-2957-x')).toBe('080442957X');
  });
});

describe('nos campos', () => {
  it('ISSN-ISBN: 8 caracteres é ISSN; o resto, ISBN', () => {
    expect(issnOrIsbnError('0317-8471')).toBeUndefined();
    expect(issnOrIsbnError('0317-8472')).toMatch(/^ISSN inválido/);
    expect(issnOrIsbnError('978-0-306-40615-7')).toBeUndefined();
    expect(issnOrIsbnError('978-0-306-40615-8')).toMatch(/^ISBN inválido/);
    expect(cleanLinkValue('ISSN-ISBN', '0317-8471')).toBe('0317-8471');
    expect(cleanLinkValue('ISSN-ISBN', '978-0-306-40615-7')).toBe('9780306406157');
  });

  it('a limpeza e o aviso do campo passam pelo ISSN e pelo ISBN', () => {
    expect(cleanLinkValue('ISSN', ' 0317 8471 ')).toBe('03178471');
    expect(cleanLinkValue('ISBN', '978-0-306-40615-7')).toBe('9780306406157');
    expect(linkError('ISSN', '0317-8472')).toMatch(/dígito verificador/);
    expect(linkError('ISBN', '0-306-40615-2')).toBeUndefined();
  });
});
