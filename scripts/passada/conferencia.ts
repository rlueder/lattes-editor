// Os passos de conferência da passada: as variantes no currículo lido, o
// formulário de uma variante e as páginas de alteração contra o que o
// carregamento montou.

import { readFormInPage } from '../../src/bridge/form-dom.ts';
import { PRODUCTION_TARGETS } from '../../src/bridge/production/targets/index.ts';
import { mapOf } from '../../src/bridge/refresh/from-form.ts';
import { readFormPage } from '../../src/bridge/refresh/read.ts';
import { TEST_MARK } from '../../src/census/test-plan.ts';
import { getAttr, walk, type XElement } from '../../src/model/xml.ts';
import { reading, snapshot, state, TAG } from './aba.ts';
import { choicesOf } from './variantes.ts';

/**
 * O passo 4: cada variante que está no currículo lido (por __carregarPonte),
 * escolha por escolha, contra o valor com que foi criada. Por ELEMENTO@ATRIBUTO,
 * quantas bateram e os pares que não (criado → lido), só com códigos de
 * enumerado.
 */
export function conferir() {
  const doc = state.loaded?.doc;
  if (!doc || !state.variants) return 'rode carregar() e gerar() antes';
  const byTag = new Map<string, XElement>();
  walk(doc.root, (el) => {
    for (const a of el.attrs) {
      const tag = TAG.exec(a.value)?.[1];
      if (tag && !byTag.has(tag)) byTag.set(tag, el);
    }
  });
  /** O item que contém a parte com o título. */
  const itemOf = (part: XElement, element: string): XElement | undefined => {
    let found: XElement | undefined;
    walk(doc.root, (el) => {
      if (!found && el.name === element && el.children.includes(part)) found = el;
    });
    return found ?? (part.name === element ? part : undefined);
  };
  const result: Record<string, { iguais: number; diferentes: Record<string, number> }> = {};
  let found = 0;
  for (const v of state.variants) {
    const part = byTag.get(v.tag);
    const loaded = part && itemOf(part, v.element);
    if (!loaded) continue;
    found++;
    for (const c of choicesOf(v.item)) {
      const want = getAttr(c.el, c.attr) ?? '';
      let got: string | undefined;
      walk(loaded, (el) => {
        if (got === undefined && el.name === c.el.name) got = getAttr(el, c.attr);
      });
      const key = `${c.el.name}@${c.attr}`;
      const r = (result[key] ??= { diferentes: {}, iguais: 0 });
      if ((got ?? '') === want) r.iguais++;
      else
        r.diferentes[`${want} → ${got === undefined ? '(sem)' : got || '(vazio)'}`] =
          (r.diferentes[`${want} → ${got === undefined ? '(sem)' : got || '(vazio)'}`] ?? 0) + 1;
    }
  }
  const diff = Object.fromEntries(
    Object.entries(result).filter(([, r]) => Object.keys(r.diferentes).length > 0),
  );
  return {
    atributos: Object.keys(result).length,
    comDiferenca: Object.keys(diff).length,
    diferencas: diff,
    lidas: found,
  };
}

/**
 * O formulário de alteração de uma variante, como a página o mostra: o valor
 * de cada campo pedido (rádio marcado, opção escolhida) e as opções dele.
 */
export async function campos(tag: string, names: string[]) {
  const lists = state.lastSnapshot ?? (state.lastSnapshot = await snapshot());
  const row = Object.values(lists)
    .flat()
    .find((r) => r.text.includes(`${TEST_MARK} ${tag} `) || r.text.endsWith(`${TEST_MARK} ${tag}`));
  if (!row) return 'linha não achada';
  return reading(async (get) => {
    const html = await get(row.link);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const form = doc.forms[0];
    const out: Record<string, unknown> = { form: form?.name };
    for (const n of names) {
      const els = [...(form?.querySelectorAll<HTMLInputElement>(`[name="${n}"]`) ?? [])];
      if (els.length === 0) {
        out[n] = '(sem campo)';
        continue;
      }
      const el = els[0]!;
      out[n] =
        el.tagName === 'SELECT'
          ? {
              opcoes: [...(el as unknown as HTMLSelectElement).options].map((o) => o.value),
              valor: el.value,
            }
          : el.type === 'radio' || el.type === 'checkbox'
            ? {
                marcado: els.filter((e) => e.checked).map((e) => e.value),
                opcoes: els.map((e) => e.value),
              }
            : {
                tipo: el.type,
                valor: el.value.length > 12 ? `(${el.value.length} car.)` : el.value,
              };
    }
    return out;
  });
}

/**
 * O que importa ao editor: para cada item de teste nas listas, a página de
 * alteração contra o item que o carregamento montou. Cada campo da
 * especificação: o valor do XML lido, levado de novo ao formulário (toForm),
 * tem de dar o que a página mostra. Junta também, por formulário e campo,
 * as opções que apareceram marcadas, para saber o que ficou sem exercitar.
 */
export async function conferirPaginas() {
  const doc = state.loaded?.doc;
  if (!doc) return 'rode __carregarPonte.carregar() antes';
  const lists = (state.lastSnapshot = await snapshot());
  const rows = Object.values(lists)
    .flat()
    .filter((r) => TAG.test(r.text));
  const byTag = new Map<string, XElement>();
  walk(doc.root, (el) => {
    for (const a of el.attrs) {
      const tag = TAG.exec(a.value)?.[1];
      if (tag && !byTag.has(tag)) byTag.set(tag, el);
    }
  });
  const itemFor = (part: XElement): XElement => {
    let found: XElement | undefined;
    walk(doc.root, (el) => {
      if (
        !found &&
        el.children.includes(part) &&
        PRODUCTION_TARGETS.some((t) => t.element === el.name)
      ) {
        found = el;
      }
    });
    return found ?? part;
  };
  const wrong: Record<string, Record<string, number>> = {};
  const right: Record<string, number> = {};
  const seen: Record<string, Set<string>> = {};
  let pages = 0;
  for (let i = 0; i < rows.length; i += 60) {
    const part = rows.slice(i, i + 60);
    await reading(async (get) => {
      for (const row of part) {
        const tag = TAG.exec(row.text)![1]!;
        const titled = byTag.get(tag);
        if (!titled) continue;
        const item = itemFor(titled);
        const t = PRODUCTION_TARGETS.find((x) => x.element === item.name);
        if (!t) continue;
        const html = await get(row.link);
        pages++;
        const reading = readFormPage(
          html,
          { forms: [t.form.name], link: row.link },
          readFormInPage,
        );
        const values = reading.values ?? {};
        for (const [key, m] of Object.entries(t.fields)) {
          const map = mapOf(m);
          const shown = values[map.field];
          if (shown === undefined || map.field.includes(':')) continue;
          (seen[`${t.form.name}.${map.field}`] ??= new Set()).add(shown);
          const [child, attr] = key.split('@') as [string, string];
          let xml: string | undefined;
          walk(item, (el) => {
            if (xml === undefined && el.name === child) xml = getAttr(el, attr);
          });
          const back = map.toForm ? (map.toForm(xml ?? '', 'before') ?? '?') : (xml ?? '');
          const id = `${t.id} ${key}`;
          if (back === shown || (shown === '' && (xml ?? '') === ''))
            right[id] = (right[id] ?? 0) + 1;
          else {
            const safeShown = /^[A-Za-z0-9_]{0,12}$/.test(shown) ? shown : `(${shown.length} car.)`;
            const safeXml = /^[A-Z0-9_]{0,24}$/.test(xml ?? '')
              ? xml || '(vazio)'
              : `(${(xml ?? '').length} car.)`;
            const pair = `página ${safeShown || '(vazio)'} ← xml ${safeXml}`;
            (wrong[id] ??= {})[pair] = (wrong[id]![pair] ?? 0) + 1;
          }
        }
      }
    });
  }
  state.seen = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v]]));
  return {
    camposCertos: Object.keys(right).length,
    erros: wrong,
    opcoesVistas: Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v].sort()])),
    paginas: pages,
  };
}
