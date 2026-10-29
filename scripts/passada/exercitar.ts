// O passo 5 da passada pelo conector: cada escolha ainda não vista numa
// página vai num item de teste, planejado como no editor e gravado com a
// releitura.

import { applyOp, BUILD_GATES } from '../../src/bridge/apply.ts';
import { ALL_ON, planChanges } from '../../src/bridge/plan.ts';
import { PRODUCTION_TARGETS } from '../../src/bridge/production/targets/index.ts';
import { mapOf } from '../../src/bridge/refresh/from-form.ts';
import { LattesTransport } from '../../src/bridge/transport.ts';
import { diffDocuments } from '../../src/model/changes.ts';
import { getAttr, setAttr, walk, type XElement } from '../../src/model/xml.ts';
import { connectorPort, state, TAG } from './aba.ts';
import { choiceValues } from './variantes.ts';

/**
 * O passo 5, pelo conector: para cada tipo com itens de teste, um item por
 * rodada com cada escolha num valor do XML cuja opção ainda não apareceu
 * marcada em página nenhuma (conferirPaginas), planejado como no editor e
 * gravado com a releitura do conector. Devolve o que gravou, o que não
 * conferiu e o que o planejamento mandou à mão.
 */
export async function exercitar(maxOps = 20) {
  const doc = state.loaded?.doc;
  if (!doc || !state.seen) return 'rode carregar() e conferirPaginas() antes';
  const seen = state.seen;
  const failedTypes = new Set(state.failedTypes ?? []);
  const items = new Map<string, XElement[]>();
  walk(doc.root, (el) => {
    const t = PRODUCTION_TARGETS.find((x) => x.element === el.name);
    if (!t) return;
    let marked = false;
    walk(el, (p) => {
      if (p.attrs.some((a) => TAG.test(a.value))) marked = true;
    });
    if (marked) items.set(t.id, [...(items.get(t.id) ?? []), el]);
  });
  const done: string[] = [];
  const failed: string[] = [];
  const byHand: string[] = [];
  let ops = 0;
  for (const t of PRODUCTION_TARGETS) {
    const list = items.get(t.id);
    if (!list?.length || ops >= maxOps || failedTypes.has(t.id)) continue;
    const working = structuredClone(doc.root);
    const original = structuredClone(doc.root);
    const index = [
      ...(function* idx(): Generator<XElement> {
        const stack = [working];
        while (stack.length) {
          const el = stack.shift()!;
          if (el.name === t.element) yield el;
          for (const c of el.children) if (c.kind === 'element') stack.push(c);
        }
      })(),
    ];
    // O primeiro item de teste do tipo, achado de novo na cópia de trabalho.
    const target = index.find((el) => {
      let marked = false;
      walk(el, (p) => {
        if (p.attrs.some((a) => TAG.test(a.value))) marked = true;
      });
      return marked;
    });
    if (!target) continue;
    const planned: string[] = [];
    for (const [key, m] of Object.entries(t.fields)) {
      const map = mapOf(m);
      if (!map.toForm || map.field.includes(':')) continue;
      const [child, attr] = key.split('@') as [string, string];
      const values = choiceValues(child, attr);
      if (!values) continue;
      const shownKey = `${t.form.name}.${map.field}`;
      const v = values.find((x) => {
        const shown = map.toForm!(x, 'before');
        return shown && !seen[shownKey]?.includes(shown);
      });
      if (!v) continue;
      walk(target, (el) => {
        if (el.name === child && getAttr(el, attr) !== undefined) setAttr(el, attr, v);
      });
      planned.push(`${shownKey}=${map.toForm(v, 'before')}`);
    }
    if (planned.length === 0) continue;
    const changes = diffDocuments(original, working);
    const { ops: bridgeOps, unsupported } = planChanges(
      changes.map((change) => ({ change, itemTitle: t.id })),
      working,
      ALL_ON,
    );
    for (const u of unsupported) byHand.push(`${t.id}: ${u.reason.slice(0, 100)}`);
    let allSaved = bridgeOps.length > 0;
    for (const op of bridgeOps) {
      if (ops >= maxOps) {
        allSaved = false;
        break;
      }
      ops++;
      const traffic = new LattesTransport();
      const r = await traffic.run(
        () => applyOp(op, connectorPort(traffic), BUILD_GATES),
        (error) => ({ detail: error.message, key: op.key, status: 'erro' as const }),
      );
      if (r.status === 'conferido') {
        done.push(`${t.id}: ${planned.join(', ')}`);
        for (const p of planned) {
          const [k, val] = p.split('=') as [string, string];
          (seen[k] ??= []).push(val);
        }
      } else {
        allSaved = false;
        failed.push(`${t.id} ${r.status}: ${r.detail.slice(0, 140)}`);
      }
    }
    // A cópia lida acompanha o que o Lattes gravou: a próxima rodada parte
    // dela. O tipo que não conferiu não volta, para não repetir o mesmo envio.
    if (allSaved) doc.root = working;
    else failedTypes.add(t.id);
    state.failedTypes = [...failedTypes];
  }
  return { aMao: byHand, falharam: failed, gravadas: done, operacoes: ops };
}
