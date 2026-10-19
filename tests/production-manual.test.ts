import { describe, expect, it } from 'vitest';

import { manualReason } from '../src/bridge/production/manual.ts';
import { element } from '../src/model/xml.ts';

const chain = (...names: string[]) => names.map((n) => element(n));

describe('tipos de produção que ficam à mão de propósito', () => {
  it('cada um diz por quê, pela parte mais perto da mudança', () => {
    // Patentes e registros vão pelo motor desde 19/10/2026 (targets/registros.ts).
    expect(
      manualReason(chain('CURRICULO-VITAE', 'PATENTE', 'DADOS-BASICOS-DA-PATENTE')),
    ).toBeUndefined();
    expect(manualReason(chain('SONOPLASTIA'))).toMatch(/não tem mais formulário para este tipo/);
    expect(manualReason(chain('CURRICULO-VITAE', 'TRABALHO-TECNICO'))).toBeUndefined();
  });
});
