// Remoção dos itens de teste pelo registro (Fase 0 de docs/development/PLAN.md):
// só as linhas que não estavam na base das listas, conferidas no fim contra a
// base inteira. Separada de censo-test-items.ts, que cria.

import { removalOrder } from '../../src/census/test-ledger.ts';
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
import { ledgerNow, newAtuacao } from './censo-test-ledger.ts';

const withoutCode = (p: string) => p.replace(/([?&])f_cod=[A-Z0-9]+&?/, '$1').replace(/[?&]$/, '');

/**
 * Remove um lote dos itens de teste pelo registro: as linhas que não estavam
 * na base das listas (Fase 0). Não depende da marca, que nem todo formulário
 * tem onde levar. Uma atuação só sai inteira se a página dela não existia na
 * base. No fim, o que ainda difere da base volta no resumo; com dryRun, só a
 * lista do que sairia.
 */
export async function removeTestItems(
  code: string,
  get: (path: string) => Promise<{ html: string }>,
  { batch = 10, delayMs = [3000, 6000], dryRun = false }: BatchOptions & { dryRun?: boolean } = {},
) {
  const menu = document.documentElement.outerHTML;
  const progress = load();
  setLive({ done: 0, last: undefined, phase: 'lendo', total: undefined });
  const { added, missing } = await ledgerNow(menu, code, get);
  // Um link com f_ctr é ação, nunca um item a abrir.
  const plan = removalOrder(added)
    .filter((r) => r.link && !/[?&]f_ctr=/i.test(r.link))
    .filter((r) => !/cargos_vinculos/i.test(r.link) || newAtuacao(r))
    .slice(0, batch);
  if (dryRun) {
    setLive({ phase: 'parado' });
    return {
      ensaio: plan.map((r) => `${r.list} :: ${r.text}`),
      faltandoDaBase: missing.map((r) => `${r.list} :: ${r.text}`),
      registrados: added.length,
      removidos: 0,
      total: progress.removed.length,
    };
  }
  const removed: string[] = [];
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
      // Só conta o que a página confirmou.
      if (msgs.some((m) => /^exceção/.test(m))) continue;
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
  return {
    faltandoDaBase: after.missing.map((r) => `${r.list} :: ${r.text}`),
    registrados: after.added.length,
    removidos: removed.length,
    total: progress.removed.length,
  };
}
