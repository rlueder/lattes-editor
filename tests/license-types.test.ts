import { describe, expect, it } from 'vitest';

import { planChanges } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { element, firstChild, parseXml, setAttr } from '../src/model/xml.ts';
import { licenseChoices, licenseToForm } from '../src/schema/license-types.ts';
import { typedChoices } from '../src/schema/typed-choices.ts';

describe('tipos de licença: controle e plano usam os mesmos valores', () => {
  it('oferece as três opções do formulário sem alterar outro elemento', () => {
    expect(typedChoices(element('LICENCA'), 'TIPO-LICENCA')).toEqual(licenseChoices);
    expect(licenseChoices.map((c) => licenseToForm(c.value))).toEqual(['M', 'P', 'A']);
    expect(licenseToForm('')).toBeUndefined();
    expect(licenseToForm('desconhecido')).toBeUndefined();
    expect(licenseToForm('toString')).toBeUndefined();
    expect(licenseToForm('__proto__')).toBeUndefined();
    expect(typedChoices(element('DADOS-GERAIS'), 'TIPO-LICENCA')).toBeUndefined();
  });

  it.each(licenseChoices)(
    'a escolha $label planeja o código correto e mantém as datas',
    ({ value }) => {
      const before = value === 'MATERNIDADE' ? 'PATERNIDADE' : 'MATERNIDADE';
      const xml = `<CURRICULO-VITAE><DADOS-GERAIS><LICENCAS><LICENCA TIPO-LICENCA="${before}" DATA-INICIO-LICENCA="01012025" DATA-FIM-LICENCA="01052025"/></LICENCAS></DADOS-GERAIS></CURRICULO-VITAE>`;
      const original = parseXml(xml).root;
      const working = parseXml(xml).root;
      const general = firstChild(working, 'DADOS-GERAIS')!;
      const container = firstChild(general, 'LICENCAS')!;
      const item = firstChild(container, 'LICENCA')!;
      setAttr(item, 'TIPO-LICENCA', value);
      const changes = diffDocuments(original, working);
      expect(changes).toHaveLength(1);
      expect(changes[0]!.fields).toHaveLength(1);
      const plan = planChanges(
        changes.map((change) => ({ change, itemTitle: 'Licença' })),
        working,
        { editProduction: true },
      );
      expect(plan.unsupported).toEqual([]);
      expect(plan.ops).toHaveLength(1);
      expect(plan.ops[0]).toMatchObject({
        expect: { f_tipo_licenca: licenseToForm(before) },
        set: { f_tipo_licenca: licenseToForm(value) },
      });
    },
  );
});
