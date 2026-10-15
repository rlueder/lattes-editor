// As opções de um campo do Lattes contra o controle que o editor mostra para
// o mesmo atributo (LAT-55). O editor decide o controle em
// src/ui/AttributeField.tsx, pela ordem: código do Lattes (só leitura),
// sim/não, lista de códigos (field-kind.ts), lista tipada
// (typed-choices.ts), enumeração do XSD, texto. A conferência segue a mesma
// ordem, e compara os valores: S/N do Lattes com SIM/NAO, N/S do mestrado com
// os códigos do editor, os rótulos de uma lista com os da lista tipada.

import { compareList } from '../bridge/list-watch.ts';
import { foldText } from '../model/fold-text.ts';
import { element } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { derivedValue, typedChoices } from '../schema/typed-choices.ts';
import { codeAttrFor, codeChoices, isBooleanAttr, isSystemAttr } from '../ui/field-kind.ts';
import type { CensusOption } from './census-page.ts';
import type { FieldLink } from './link.ts';

export type EditorControl =
  'booleano' | 'codigo' | 'derivado' | 'enum' | 'lista' | 'sistema' | 'texto';

const specOf = (el: string, attr: string) =>
  lattesSchema.elements[el]?.attributes.find((a) => a.name === attr);

/** O controle que o editor mostra para o atributo, como AttributeField.tsx decide. */
export function editorControl(el: string, attr: string): EditorControl {
  if (isSystemAttr(el, attr)) return 'sistema';
  const spec = specOf(el, attr);
  if (isBooleanAttr(attr, spec, '')) return 'booleano';
  if (codeChoices(el, attr)) return 'codigo';
  // A natureza do evento sai do tipo do item: uma opção só, de propósito.
  if (derivedValue(el, attr) !== undefined) return 'derivado';
  if (typedChoices(element(el), attr)) return 'lista';
  if (spec?.enum) return 'enum';
  // O nome que acompanha um código escolhido numa lista (instituição, curso).
  if (codeAttrFor(el, attr)) return 'derivado';
  return 'texto';
}

/** Comparação sem acento, caixa nem sublinhado (MEIO_DIGITAL é "meio digital"). */
const fold = (text: string) => foldText(text.replace(/_+/g, ' '));

/** SIM ou NAO de uma opção do Lattes: pelo código (S, N, 1, 0) ou, sem ele, pelo rótulo. */
export function booleanOf(o: CensusOption): 'NAO' | 'SIM' | undefined {
  const v = o.value.toUpperCase();
  if (v === 'S' || v === '1' || v === 'SIM' || v === 'ON') return 'SIM';
  if (v === 'N' || v === '0' || v === 'NAO') return 'NAO';
  const l = fold(o.label);
  if (l === 'sim') return 'SIM';
  if (l === 'nao') return 'NAO';
  return undefined;
}

/** O valor do XSD de uma opção: pelo rótulo, pelo código no fim do valor (…_PI), ou pelo observado. */
function enumOf(o: CensusOption, values: string[], observed: Record<string, string>) {
  return (
    values.find((v) => fold(v) === fold(o.label)) ??
    values.find((v) => o.value && v.endsWith(`_${o.value.toUpperCase()}`)) ??
    (observed[o.value] && values.includes(observed[o.value]!) ? observed[o.value] : undefined)
  );
}

export interface OptionCheck {
  control: EditorControl;
  /** Divergências; vazio quando o editor oferece o que o Lattes oferece. */
  found: { detail: string; key: string }[];
}

const SHOWN = 5;
export const names = (list: string[]) =>
  list.length > SHOWN
    ? `${list.slice(0, SHOWN).join(', ')} e mais ${list.length - SHOWN}`
    : list.join(', ');

/** O mapa opção ↔ valor observado nos itens da pessoa, quando é firme (dois itens, sem contradição). */
export function observedMap(links: FieldLink[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of links) {
    if (l.by !== 'enumeracao' || l.matches < 2 || l.conflicts > 0) continue;
    Object.assign(out, l.valueMap);
  }
  return out;
}

/**
 * Confere as opções de um campo do Lattes com o controle do editor. `where`
 * é entrada:ELEMENTO@ATRIBUTO; `links` são as ligações observadas desse campo
 * com esse atributo.
 */
export function checkOptions(
  where: string,
  field: { name: string; type: string },
  options: CensusOption[],
  links: FieldLink[],
): OptionCheck {
  const [, path = ''] = where.split(':');
  const [el = '', attr = ''] = path.split('@');
  const control = editorControl(el, attr);
  const opts = options.filter((o) => o.value || o.label);
  const seen = observedMap(links);
  const found: OptionCheck['found'] = [];
  const add = (kind: string, detail: string, suffix = '') =>
    found.push({ detail: `${path}: ${detail}`, key: `${kind}:${where}${suffix}` });

  if (control === 'texto') {
    add(
      'lista-nao-ligada',
      `o campo ${field.name} tem opções no Lattes e o editor mostra texto livre`,
      `:${field.name}`,
    );
  } else if (control === 'booleano') {
    // Uma caixa sozinha é sim/não (marcada ou não), qualquer que seja o valor dela.
    const single = field.type === 'checkbox' && opts.length === 1;
    const mapped = opts.map(booleanOf);
    const values = new Set(mapped);
    if (
      !single &&
      (mapped.includes(undefined) || (opts.length === 2 && values.size !== 2) || opts.length > 2)
    ) {
      add(
        'booleano-diferente',
        `o editor mostra sim/não e ${field.name} tem ${names(opts.map((o) => o.label || o.value))}`,
      );
    }
    const contradicted = Object.entries(seen).filter(
      ([code, value]) => booleanOf({ label: '', value: code }) !== value,
    );
    if (contradicted.length) {
      add(
        'valor-contrariado',
        `nos itens da exportação, ${field.name} ${contradicted.map(([c, v]) => `${c} vem com ${v}`).join(', ')}, ao contrário do código da opção`,
        `:${field.name}`,
      );
    }
  } else if (control === 'codigo') {
    const editor = codeChoices(el, attr) ?? [];
    const lattes = opts.map((o) => o.value);
    const missing = lattes.filter((v) => !editor.some((c) => c.value === v));
    const extra = editor.filter((c) => !lattes.includes(c.value)).map((c) => c.value);
    const relabeled = opts.filter((o) => {
      const c = editor.find((x) => x.value === o.value);
      return c && o.label && fold(c.label) !== fold(o.label);
    });
    if (missing.length || extra.length || relabeled.length) {
      const parts = [
        missing.length ? `códigos novos no Lattes: ${names(missing)}` : '',
        extra.length ? `só no editor: ${names(extra)}` : '',
        relabeled.length
          ? `rótulos diferentes: ${names(relabeled.map((o) => `${o.value} (${o.label})`))}`
          : '',
      ].filter(Boolean);
      add('lista-diferente', parts.join('; '));
    }
  } else if (control === 'lista') {
    const choices = typedChoices(element(el), attr) ?? [];
    if (choices.length) {
      const { added, removed } = compareList(
        choices.map((c) => c.label),
        opts.map((o) => o.label).filter(Boolean),
      );
      if (added.length || removed.length) {
        const parts = [
          added.length ? `novas no Lattes: ${names(added)}` : '',
          removed.length ? `só no editor: ${names(removed)}` : '',
        ].filter(Boolean);
        add('lista-diferente', parts.join('; '));
      }
    }
  } else if (control === 'enum') {
    const values = specOf(el, attr)?.enum ?? [];
    const loose = opts.filter((o) => !enumOf(o, values, seen));
    if (loose.length) {
      add(
        'lista-diferente',
        `opções do Lattes sem valor conhecido no XSD (${values.length} valores): ${names(loose.map((o) => `${o.value} (${o.label})`))}`,
      );
    }
  }
  return { control, found };
}
