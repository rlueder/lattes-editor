// Remoção dos itens de teste pelo registro (Fase 0 de docs/development/PLAN.md):
// só as linhas que não estavam na base das listas, conferidas no fim contra a
// base inteira. Separada de censo-test-items.ts, que cria.

import { markedBatch, removalOrder } from '../../src/census/test-ledger.ts';
import { TEST_MARK } from '../../src/census/test-plan.ts';
import {
  type BatchOptions,
  type FrameWindow,
  load,
  openFrame,
  pause,
  save,
  setLive,
  submit,
} from './censo-test-items.ts';
import { ledgerNow, markInCv, newAtuacao } from './censo-test-ledger.ts';

const withCode = (p: string, code: string) =>
  /[?&]f_cod=/.test(p) ? p : `${p}${p.includes('?') ? '&' : '?'}f_cod=${code}`;
const withoutCode = (p: string) => p.replace(/([?&])f_cod=[A-Z0-9]+&?/, '$1').replace(/[?&]$/, '');

/**
 * Remove um lote dos itens de teste pelo registro: as linhas que não estavam
 * na base das listas (Fase 0). Uma atuação só sai inteira se a página dela
 * não existia na base. No fim, o que ainda difere da base volta no resumo;
 * com dryRun, só a lista do que sairia.
 *
 * A linha só sai se a página do item tem a marca. Toda linha diferente da base
 * vira candidata, e numa base antiga isso inclui item seu incluído ou
 * alterado depois dela (21/10/2026). Como nem todo formulário tem onde levar a
 * marca, a linha sem ela fica de fora e volta em semMarca; com unmarked, sai
 * também, depois de a pessoa conferir a lista.
 */
export async function removeTestItems(
  code: string,
  get: (path: string) => Promise<{ html: string }>,
  {
    batch = 10,
    delayMs = [3000, 6000],
    dryRun = false,
    unmarked = false,
  }: BatchOptions & { dryRun?: boolean; unmarked?: boolean } = {},
) {
  const menu = document.documentElement.outerHTML;
  const progress = load();
  setLive({ done: 0, last: undefined, phase: 'lendo', total: undefined });
  const { added, missing } = await ledgerNow(menu, code, get);
  // Um link com f_ctr é ação, nunca um item a abrir.
  const candidates = removalOrder(added)
    .filter((r) => r.link && !/[?&]f_ctr=/i.test(r.link))
    .filter((r) => !/cargos_vinculos/i.test(r.link) || newAtuacao(r));
  const { noMark: rows, plan } = await markedBatch(
    candidates,
    async (link) => (await get(withCode(link, code))).html,
    { batch, mark: TEST_MARK, unmarked },
  );
  const noMark = rows.map((r) => `${r.list} :: ${r.text}`);
  if (dryRun) {
    setLive({ phase: 'parado' });
    return {
      ensaio: plan.map((r) => `${r.list} :: ${r.text}`),
      faltandoDaBase: missing.map((r) => `${r.list} :: ${r.text}`),
      registrados: added.length,
      removidos: 0,
      semMarca: noMark,
      total: progress.removed.length,
    };
  }
  const removed: string[] = [];
  const failed: string[] = [];
  setLive({ done: 0, last: undefined, phase: 'removendo', total: plan.length });
  for (const row of plan) {
    const frame = await openFrame(withoutCode(row.link), code);
    try {
      const msgs = await submit(frame, (fw) => {
        const page = fw as FrameWindow & { dele?: () => void };
        if (/cargos_vinculos/i.test(row.link)) page.dele!();
        else if (page.del) page.del();
        else throw new Error('Sem como excluir nesta página');
      });
      // Só conta o que a página confirmou: nenhuma mensagem (a página nova
      // carregou) ou só a de sucesso. O resto vai para as falhas, com a
      // mensagem; a conferência pelas listas no fim diz o que de fato saiu.
      if (msgs.some((m) => !/sucesso/i.test(m))) {
        failed.push(`${row.list} :: ${row.text} :: ${msgs.join(' | ')}`);
        continue;
      }
      removed.push(row.text);
      progress.removed = [...progress.removed, `${row.list} :: ${row.text}`];
      save(progress);
      setLive({ done: removed.length, last: row.text.slice(0, 40) });
    } finally {
      frame.remove();
    }
    await pause(delayMs);
  }
  // A conferência: o que ainda difere da base, para mais e para menos.
  setLive({ phase: 'lendo' });
  const after = await ledgerNow(menu, code, get);
  progress.added = after.added;
  progress.missing = after.missing;
  save(progress);
  setLive({ phase: 'parado' });
  // A conferência que as listas não fazem: a marca no currículo inteiro.
  const marca = await markInCv(code, get);
  return {
    falhas: failed,
    faltandoDaBase: after.missing.map((r) => `${r.list} :: ${r.text}`),
    marcaNoCurriculo: marca,
    registrados: after.added.length,
    removidos: removed.length,
    semMarca: noMark,
    total: progress.removed.length,
  };
}
