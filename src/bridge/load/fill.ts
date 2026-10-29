// O campo vazio do formulário de volta para o XML. Uma caixa desmarcada e a
// opção vazia de uma lista aparecem no formulário como "", e o XML guarda a
// opção do enumerado que dá "" no formulário (NAO, NAO_INFORMADO). A leitura
// pelo formulário (from-form.ts) deixa o "" como está; aqui ele vira essa
// opção, quando o enumerado tem uma só que dê "". Sem nenhuma, e com
// NAO_INFORMADO no enumerado sem opção no formulário (a natureza do texto em
// jornal), o vazio é NAO_INFORMADO.

import { getAttr, setAttr, type XElement } from '../../model/xml.ts';
import { lattesSchema } from '../../schema/lattes.ts';
import type { ProductionTarget } from '../production/types.ts';
import { mapOf, partMaps, partOf } from '../refresh/from-form.ts';

export function fillEmptyChoices(
  t: ProductionTarget,
  item: XElement,
  values: Record<string, string>,
): void {
  const maps = [...Object.entries(t.fields), ...partMaps(t, item).fields];
  for (const [key, m] of maps) {
    const map = mapOf(m);
    if (!map.toForm || map.field.includes(':') || values[map.field] !== '') continue;
    const [child, attr] = key.split('@') as [string, string];
    const part = partOf(item, child);
    if (!part || (getAttr(part, attr) ?? '') !== '') continue;
    // Os FLAG-* sem enumerado no XSD também são SIM ou NAO.
    const choices =
      lattesSchema.elements[child]?.attributes.find((a) => a.name === attr)?.enum ??
      (attr.startsWith('FLAG-') ? ['SIM', 'NAO'] : undefined);
    const empty = (choices ?? []).filter((c) => c !== '' && map.toForm!(c) === '');
    if (empty.length === 1) setAttr(part, attr, empty[0]!);
    else if (
      empty.length === 0 &&
      choices?.includes('NAO_INFORMADO') &&
      !map.toForm('NAO_INFORMADO')
    ) {
      setAttr(part, attr, 'NAO_INFORMADO');
    }
  }
}
