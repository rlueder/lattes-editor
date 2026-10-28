// Os itens de teste da passada que exercita toda opção (docs/lattes-formularios/
// itens-de-teste.md): para cada tipo de item que o Importar aceita, um item por
// valor da maior escolha do tipo, cada atributo de escolha (enumerado do XSD,
// ou SIM/NAO nos FLAG-*) passando por todos os seus valores, um por item.
// O molde de cada tipo é o item do exemplo sintético com valores das listas
// (cobertura-exemplo.ts), sem códigos de busca, áreas e setores, que o
// exemplo inventa. Todo título começa com TEST_MARK, seguido do tipo e da
// variante, e é por ele que a remoção acha os itens.

import censo from '../../docs/lattes-formularios/censo-2026-10-15.json' with { type: 'json' };
import recapturaB from '../../docs/lattes-formularios/censo-2026-10-15b.json' with { type: 'json' };
import recapturaC from '../../docs/lattes-formularios/censo-2026-10-15c.json' with { type: 'json' };
import recaptura27 from '../../docs/lattes-formularios/censo-2026-10-27.json' with { type: 'json' };
import { PRODUCTION_TARGETS } from '../../src/bridge/production/targets/index.ts';
import { mapOf } from '../../src/bridge/refresh/from-form.ts';
import { TEST_MARK } from '../../src/census/test-plan.ts';
import { compact } from '../../src/import-export/import-file.ts';
import { IMPORT_MODULES } from '../../src/import-export/importable.ts';
import { childElements, getAttr, setAttr, walk, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import { REGISTRY_KINDS } from '../cobertura-exemplo.ts';

/** Atributos numéricos: ordem, número, carga horária, duração, quantidade. */
const NUMERIC =
  /^(ORDEM-|NUMERO-(DE-|DA-|DO-|GRADUACAO|ESPECIALIZACAO|MESTRADO|DOUTORADO)|CARGA-HORARIA|DURACAO-EM-MESES|QUANTIDADE|NUMERO_)/;

/** Atributos que não variam: formatos fixos e os que dizem a qual item o item pertence. */
const FIXED = /^(FORMATO-|SEQUENCIA-|ORDEM-|TIPO-PATENTE$)/;

/** Os valores de escolha de um atributo de um elemento: o enumerado, ou SIM/NAO nos FLAG-*. */
export function choiceValues(element: string, attr: string): string[] | undefined {
  if (FIXED.test(attr)) return undefined;
  const spec = lattesSchema.elements[element]?.attributes.find((a) => a.name === attr);
  const values = spec?.enum ?? (attr.startsWith('FLAG-') ? ['SIM', 'NAO'] : undefined);
  return values?.length ? values : undefined;
}

/** Os itens repetidos que cada módulo do Importar lê, pelo nome. */
export function importableElements(): { element: string; module: string; path: string[] }[] {
  const out: { element: string; module: string; path: string[] }[] = [];
  for (const m of IMPORT_MODULES) {
    for (const p of m.paths) {
      const parts = p.split('/');
      const last = parts.at(-1)!;
      const parent = parts.slice(0, -1);
      const names =
        last === '*'
          ? (lattesSchema.elements[parent.at(-1)!]?.children.map((c) => c.name) ?? []).filter(
              (n) => !m.exclude?.includes(n),
            )
          : [last];
      for (const element of names) out.push({ element, module: m.id, path: parent });
    }
  }
  return out;
}

/** As escolhas de um item e de todas as partes dele, com os valores de cada uma. */
export function choicesOf(item: XElement): { attr: string; el: XElement; values: string[] }[] {
  const out: { attr: string; el: XElement; values: string[] }[] = [];
  walk(item, (el) => {
    for (const a of lattesSchema.elements[el.name]?.attributes ?? []) {
      const values = choiceValues(el.name, a.name);
      if (values) out.push({ attr: a.name, el, values });
    }
  });
  return out;
}

/**
 * Texto só com caracteres do Latin-1: o exemplo tem, de propósito, travessões e
 * letras de fora, que o arquivo leva como &#NNNN; e o Importar do Lattes recusa
 * (28/10/2026).
 */
export const latin1Only = (v: string) =>
  v
    .replace(/[\u2012-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .normalize('NFC')
    .replace(/[\u0100-\u{10ffff}]/gu, '?');

/** O molde: o item do exemplo, sem os códigos de busca, as áreas e os setores, em Latin-1. */
export function template(example: XElement): XElement {
  const item = structuredClone(example);
  compact(item);
  walk(item, (el) => {
    for (const a of el.attrs) {
      a.value = latin1Only(a.value);
      // O exemplo põe texto em campos que o Lattes lê como número (a ordem de
      // autoria, a de importância): o Importar recusa o arquivo (28/10/2026).
      if (NUMERIC.test(a.name) && !/^\d*$/.test(a.value)) a.value = '1';
      if (/^(CPF|NRO-ID-CNPQ)$/.test(a.name)) a.value = '';
    }
    for (const c of el.children) if (c.kind === 'text') c.value = latin1Only(c.value);
    el.children = el.children.filter(
      (c) =>
        c.kind !== 'element' ||
        (c.name !== 'AREAS-DO-CONHECIMENTO' && c.name !== 'SETORES-DE-ATIVIDADE'),
    );
    for (const a of el.attrs)
      if (/^CODIGO-/.test(a.name) && a.name !== 'CODIGO-DO-REGISTRO-OU-PATENTE') a.value = '';
  });
  return item;
}

/** O atributo de título do item: o primeiro TITULO*, NOME-DO-EVENTO ou DENOMINACAO das partes. */
function titleSlot(item: XElement): { attr: string; el: XElement } | undefined {
  for (const el of [item, ...childElements(item)]) {
    const a = el.attrs.find(
      (x) => /^(TITULO|DENOMINACAO|NOME-DO-EVENTO)/.test(x.name) && !/INGLES/.test(x.name),
    );
    if (a) return { attr: a.name, el };
  }
  return undefined;
}

type Capture = {
  entries: {
    elements?: string[];
    page?: { forms?: { fields: { maxLength?: number; name: string }[] }[] };
  }[];
};
const CAPTURES = [recaptura27, recapturaC, recapturaB, censo] as unknown as Capture[];

/** O limite de cada campo de um formulário, pelo nome, na captura mais recente que o tem. */
function limitsFor(element: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of CAPTURES) {
    for (const e of c.entries) {
      if (!e.elements?.includes(element)) continue;
      for (const f of e.page?.forms?.[0]?.fields ?? []) {
        if (f.maxLength && !out.has(f.name)) out.set(f.name, f.maxLength);
      }
    }
  }
  return out;
}

/**
 * Cada texto no limite do campo do formulário que o mostra (o Importar recusa
 * o arquivo com um valor maior que a coluna: o volume do artigo, em
 * 28/10/2026), pela ligação do conector entre atributo e campo.
 */
export function fitToForms(item: XElement): void {
  const t = PRODUCTION_TARGETS.find((x) => x.element === item.name);
  if (!t) return;
  const limits = limitsFor(item.name);
  for (const [key, m] of Object.entries(t.fields)) {
    const [child, attr] = key.split('@') as [string, string];
    const max = limits.get(mapOf(m).field);
    if (!max) continue;
    walk(item, (el) => {
      if (el.name !== child) return;
      const v = getAttr(el, attr);
      if (v && v.length > max) setAttr(el, attr, v.slice(0, max));
    });
  }
}

export interface Variant {
  element: string;
  item: XElement;
  module: string;
  path: string[];
  tag: string;
}

/**
 * As variantes de um tipo: tantas quantas os valores da maior escolha, cada
 * escolha no valor da variante (o i-ésimo, voltando ao começo).
 */
export function variantsOf(
  element: string,
  example: XElement,
  module: string,
  path: string[],
  firstSeq: number,
): Variant[] {
  const base = template(example);
  fitToForms(base);
  const count = Math.max(1, ...choicesOf(base).map((c) => c.values.length));
  const out: Variant[] = [];
  for (let i = 0; i < count; i++) {
    const item = structuredClone(base);
    for (const c of choicesOf(item)) {
      const values =
        c.attr === 'TIPO-PATENTE' && REGISTRY_KINDS[element] ? REGISTRY_KINDS[element]! : c.values;
      setAttr(c.el, c.attr, values[i % values.length]!);
    }
    const tag = `${element} v${i + 1}`;
    const title = titleSlot(item);
    if (title) setAttr(title.el, title.attr, `${TEST_MARK} ${tag}`);
    // A lista de eventos mostra o nome do evento, não o título (28/10/2026).
    walk(item, (el) => {
      if (getAttr(el, 'NOME-DO-EVENTO') !== undefined)
        setAttr(el, 'NOME-DO-EVENTO', `${TEST_MARK} ${tag}`);
    });
    if (getAttr(item, 'SEQUENCIA-PRODUCAO') !== undefined) {
      setAttr(item, 'SEQUENCIA-PRODUCAO', String(firstSeq + i));
    }
    out.push({ element, item, module, path, tag });
  }
  return out;
}
