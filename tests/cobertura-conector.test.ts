import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { coveragePercent } from '../scripts/cobertura-conector.ts';

const report = (elements: string) =>
  execFileSync(
    process.execPath,
    ['scripts/cobertura-conector.ts', `--so=${elements}`, '--resumo'],
    { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8' },
  );

describe('cobertura do conector', () => {
  it('mede os códigos do mestrado e doutorado oferecidos no editor, antes do enum do XSD', () => {
    const output = report('MESTRADO,DOUTORADO');
    expect(output).toMatch(/(\d+) de \1 campos avaliados para envio vão pelo conector \(100%\)/);
  });

  it('conta a instituição da lista AP sem tratar campos ausentes como enviáveis', () => {
    const output = report('POS-DOUTORADO,LIVRE-DOCENCIA');
    expect(output).toContain('9 de 9 campos avaliados para envio vão pelo conector (100%)');
    expect(output).toContain('Outros 6 o formulário do Lattes não tem');
  });

  it('não arredonda uma categoria incompleta para 100%', () => {
    expect(coveragePercent(229, 230)).toBe('99,5%');
    expect(coveragePercent(9999, 10000)).toBe('99,9%');
    expect(coveragePercent(1, 1)).toBe('100%');
    // Sem erro de ponto flutuante: (57 / 100) * 1000 dá 569,99…
    expect(coveragePercent(57, 100)).toBe('57%');
    expect(coveragePercent(0, 1)).toBe('0%');
    expect(coveragePercent(0, 0)).toBe('-');
  });
});
