// Prepara só o exemplo sintético para a auditoria: as listas e os contatos
// precisam de valores reconhecíveis, não do texto genérico do gerador.

import { parseXml, serializeXml, setAttr, walk, type XElement } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import { derivedValue, outOfList, typedChoices } from '../src/schema/typed-choices.ts';

/** Os tipos de registro que cada tipo de item aceita (o formulário de cada um). */
export const REGISTRY_KINDS: Record<string, string[]> = {
  'CULTIVAR-PROTEGIDA': ['CULTIVAR_PROTEGIDA_CTV'],
  'CULTIVAR-REGISTRADA': ['CULTIVAR_PROTEGIDA_CTV'],
  'DESENHO-INDUSTRIAL': ['DESENHO_INDUSTRIAL_DI'],
  MARCA: [
    'MARCA_REGISTRADA_DE_PRODUTO_MPD',
    'MARCA_REGISTRADA_DE_SERVICO_MSV',
    'MARCA_REGISTRADA_COLETIVA_MCL',
    'MARCA_REGISTRADA_DE_CERTIFICACAO_MCT',
  ],
  PATENTE: ['PRIVILEGIO_DE_INOVACAO_PI', 'MODELO_DE_UTILIDADE_MU'],
  SOFTWARE: ['PROGRAMA_DE_COMPUTADOR_PC'],
  'TOPOGRAFIA-DE-CIRCUITO-INTEGRADO': ['TOPOGRAFIA_DE_CIRCUITO_INTEGRADO_REGISTRADA_TCI'],
};

const elementsOf = (root: XElement) => {
  const elements: XElement[] = [];
  walk(root, (el) => {
    elements.push(el);
  });
  return elements;
};

/** Duas passadas porque a lista de um campo pode depender de outro campo. */
export function withListValues(raw: string): { rewritten: number; xml: string } {
  const doc = parseXml(raw);
  const elements = elementsOf(doc.root);
  const was = new Map(elements.flatMap((el) => el.attrs.map((a) => [a, a.value])));
  for (const item of elements) {
    if (item.name === 'ENDERECO') {
      setAttr(item, 'ELETRONICO', 'I: teste@example.org');
      setAttr(
        item,
        'REDE-SOCIAL',
        'ID Rede Social: 1, Nome Rede Social: GitHub, Endereço: https://example.org/teste',
      );
    }
    const kind = REGISTRY_KINDS[item.name];
    if (!kind) continue;
    for (const reg of elementsOf(item).filter((e) => e.name === 'REGISTRO-OU-PATENTE')) {
      setAttr(reg, 'TIPO-PATENTE', kind[0]!);
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    for (const el of elements) {
      for (const a of el.attrs) {
        const choices = lattesSchema.elements[el.name]?.attributes.find(
          (x) => x.name === a.name,
        )?.enum;
        if (choices?.length && a.value && !choices.includes(a.value)) a.value = choices[0]!;
        if (a.name === 'NACIONALIDADE' && !['B', 'E', ''].includes(a.value)) a.value = 'B';
        if (!choices && a.name.startsWith('FLAG-') && !['', 'SIM', 'NAO'].includes(a.value)) {
          a.value = 'NAO';
        }
        if (!outOfList(el, a.name)) continue;
        const value = derivedValue(el.name, a.name) ?? typedChoices(el, a.name)?.[0]?.value;
        if (value !== undefined) a.value = value;
      }
    }
  }
  const rewritten = [...was].filter(([a, v]) => a.value !== v).length;
  return { rewritten, xml: serializeXml(doc) };
}
