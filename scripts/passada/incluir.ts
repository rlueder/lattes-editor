// As variantes que o Importar deixa de fora (artes, mídia social, artigo que
// não é completo…), incluídas pelo formulário de inclusão do próprio Lattes
// (src/bridge/production/create.ts), uma a uma, com a releitura do conector.

import { applyOp, BUILD_GATES } from '../../src/bridge/apply.ts';
import { creatableTarget, planCreateProduction } from '../../src/bridge/production/create.ts';
import { LattesTransport } from '../../src/bridge/transport.ts';
import { TEST_MARK } from '../../src/census/test-plan.ts';
import { getAttr, setAttr, walk } from '../../src/model/xml.ts';
import { connectorPort, type Fate, snapshot, state } from './aba.ts';

/** Até `max` variantes que não estão nas listas, pelo formulário; devolve o que houve com cada uma. */
export async function incluir(max = 20, retry = false) {
  if (!state.variants) return 'rode gerar() antes';
  const lists = await snapshot();
  const texts = Object.values(lists)
    .flat()
    .map((r) => r.text);
  const fates = (state.fates ??= JSON.parse(
    sessionStorage.getItem('passada:destinos') ?? '{}',
  ) as Record<string, Fate>);
  const tried = new Set(retry ? [] : (state.formTried ?? []));
  const missing = state.variants.filter(
    (v) =>
      !tried.has(v.tag) &&
      creatableTarget(v.element) &&
      !texts.some(
        (t) => t.includes(`${TEST_MARK} ${v.tag} `) || t.endsWith(`${TEST_MARK} ${v.tag}`),
      ),
  );
  const out: Record<string, string> = {};
  for (const v of missing.slice(0, max)) {
    tried.add(v.tag);
    // O DOI de teste não existe (a página o confere na DOI.org), e WEB não é
    // opção do meio de divulgação: só nos itens de teste.
    const item = structuredClone(v.item);
    walk(item, (el) => {
      if (getAttr(el, 'DOI')) setAttr(el, 'DOI', '');
      if (getAttr(el, 'MEIO-DE-DIVULGACAO') === 'WEB')
        setAttr(el, 'MEIO-DE-DIVULGACAO', 'IMPRESSO');
    });
    const change = {
      element: v.element,
      fields: [],
      form: '',
      key: v.tag,
      kind: 'novo' as const,
      path: [],
    };
    const op = planCreateProduction(change, item, v.tag);
    if ('reason' in op) {
      out[v.tag] = `à mão: ${op.reason.slice(0, 120)}`;
      continue;
    }
    const traffic = new LattesTransport();
    const r = await traffic.run(
      () => applyOp(op, connectorPort(traffic), BUILD_GATES),
      (error) => ({ detail: error.message, key: op.key, status: 'erro' as const }),
    );
    out[v.tag] = `${r.status}: ${r.detail.slice(0, 140)}`;
    if (r.status === 'conferido') fates[v.tag] = 'formulario';
  }
  state.formTried = [...tried];
  sessionStorage.setItem('passada:destinos', JSON.stringify(fates));
  return { faltavam: missing.length, resultado: out };
}
