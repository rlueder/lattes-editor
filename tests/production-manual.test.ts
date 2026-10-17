import { describe, expect, it } from 'vitest';

import { manualReason } from '../src/bridge/production/manual.ts';
import { element } from '../src/model/xml.ts';

const chain = (...names: string[]) => names.map((n) => element(n));

describe('tipos de produção que ficam à mão de propósito', () => {
  it('cada um diz por quê, pela parte mais perto da mudança', () => {
    expect(manualReason(chain('CURRICULO-VITAE', 'PATENTE', 'DADOS-BASICOS-DA-PATENTE'))).toMatch(
      /grades de titulares e de datas/,
    );
    expect(manualReason(chain('CAPITULO-DE-LIVRO-PUBLICADO', 'AUTORES'))).toMatch(
      /^O formulário de edição deste tipo ainda não foi lido no Lattes/,
    );
    expect(manualReason(chain('SONOPLASTIA'))).toMatch(/não achou no Lattes o formulário/);
    expect(manualReason(chain('CURRICULO-VITAE', 'TRABALHO-TECNICO'))).toBeUndefined();
  });
});
