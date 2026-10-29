// A limpeza da passada: cada linha das listas cujo texto traz a marca dos
// itens de teste (TEST_MARK) sai como o del() da página a tira, pelo mesmo
// formulário com f_ctr=E (docs/lattes_internals.md, seção 15). Só linhas com
// a marca; nada mais das listas é tocado.

import { encodeLatin1Form, pairValue, setPairs, successfulPairs } from '../../src/bridge/form.ts';
import { readFormInPage } from '../../src/bridge/form-dom.ts';
import { LattesTransport } from '../../src/bridge/transport.ts';
import type { ListSnapshot } from '../../src/census/test-ledger.ts';
import { TEST_MARK } from '../../src/census/test-plan.ts';
import { decodeLatin1 } from '../../src/model/latin1.ts';
import { snapshot, state } from './aba.ts';

/** O del() da página: o mesmo formulário com f_ctr=E. */
const DEL_TO_E = /f_ctr\.value\s*=\s*["']E["']/;

/** Até `max` linhas de teste excluídas; devolve as que ficaram e por quê. */
export async function apagar(max = 40, marca = TEST_MARK) {
  const lists = await snapshot();
  const rows = Object.values(lists)
    .flat()
    .filter((r) => r.text.includes(marca) && r.link);
  const unique = [...new Map(rows.map((r) => [r.link.toLowerCase(), r])).values()];
  const { problems, sent } = await deleteRows(unique.slice(0, max), (r) =>
    r.text.slice(r.text.indexOf(marca), r.text.indexOf(marca) + 70),
  );
  const after = new Set(
    Object.values(await snapshot())
      .flat()
      .filter((r) => r.text.includes(marca) && r.link)
      .map((r) => r.link.toLowerCase()),
  ).size;
  return { antes: unique.length, enviadas: sent, ficaram: after, problemas: problems };
}

/**
 * As linhas que as listas de `lista` (pkg_licenca, por exemplo) têm a mais
 * que a base: os itens sem título onde a marca caiba, como a licença. Só as
 * listas pedidas; as outras não são tocadas.
 */
export async function apagarNovas(lista: string) {
  const before =
    state.base ??
    (JSON.parse(sessionStorage.getItem('passada:base') ?? 'null') as ListSnapshot | null);
  if (!before) return 'rode base() antes';
  const now = await snapshot();
  const extra: { link: string; text: string }[] = [];
  for (const [key, rows] of Object.entries(now)) {
    if (!key.toLowerCase().includes(lista.toLowerCase())) continue;
    const was = (before[key] ?? []).map((r) => r.text);
    for (const r of rows) {
      const i = was.indexOf(r.text);
      if (i >= 0) was.splice(i, 1);
      else if (r.link) extra.push(r);
    }
  }
  const { problems, sent } = await deleteRows(extra, (_r, i) => `linha nova ${i + 1}`);
  return { aMais: extra.length, enviadas: sent, problemas: problems };
}

/** Cada linha pelo del() da sua página: o formulário com f_ctr=E. */
async function deleteRows<R extends { link: string; text: string }>(
  rows: R[],
  labelOf: (r: R, i: number) => string,
) {
  const traffic = new LattesTransport();
  const problems: Record<string, string> = {};
  let sent = 0;
  await traffic.run(async () => {
    const text = async (res: Response) => decodeLatin1(await traffic.bytes(res));
    const get = async (p: string) =>
      text(await traffic.request(new URL(p, location.href), { credentials: 'include' }));
    for (const [i, row] of rows.entries()) {
      const label = labelOf(row, i);
      const html = await get(row.link);
      // O formulário do item: o que tem f_ctr (a página das artes traz outro antes).
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const form = [...doc.querySelectorAll('form')].find((f) => f.elements.namedItem('f_ctr'));
      const name = form?.getAttribute('name') ?? undefined;
      const action = form?.getAttribute('action') ?? undefined;
      const controls = name ? readFormInPage(html, name) : undefined;
      if (!name || !action || !controls || !DEL_TO_E.test(html)) {
        problems[label] = 'a página não exclui como o del() espera';
        continue;
      }
      const pairs = successfulPairs(controls);
      // Um item que entrou pelo Importar pode abrir vazio, em modo de inclusão
      // (seção 28): o f_seq do formulário é o da linha, e a exclusão vai por ele.
      const seq = /[?&]f_seq=(\d+)/i.exec(row.link)?.[1];
      const mode = pairValue(pairs, 'f_ctr');
      if (mode !== 'U' && !(mode === 'I' && seq && pairValue(pairs, 'f_seq') === seq)) {
        problems[label] = `formulário em modo ${mode ?? '?'}`;
        continue;
      }
      const answer = await text(
        await traffic.request(new URL(action, location.href), {
          body: encodeLatin1Form(setPairs(pairs, { f_ctr: 'E' })),
          credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          method: 'POST',
        }),
      );
      sent++;
      const ora = /ORA-\d{5}:[^<]*/.exec(answer)?.[0];
      if (ora) problems[label] = ora.slice(0, 120);
    }
  });
  return { problems, sent };
}
