// Remoção dos itens de teste pelo registro (Fase 0 de docs/development/PLAN.md):
// só as linhas que não estavam na base das listas, conferidas no fim contra a
// base inteira. Separada de censo-test-items.ts, que cria.

import { markedBatch, removalOrder, rowLabel } from '../../src/census/test-ledger.ts';
import { TEST_MARK } from '../../src/census/test-plan.ts';
import { frameState } from './censo-frame.ts';
import { clearCensusCache } from './censo-reading.ts';
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
import { censusTraffic } from './censo-traffic.ts';

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
 * marca, a linha sem ela fica de fora e volta em semMarca, com o link em
 * semMarcaLinks; as que a pessoa conferiu voltam pelo link em unmarked e saem.
 * A página que não se lê volta em naoLidas e não sai.
 */
export async function removeTestItems(
  code: string,
  get: (path: string) => Promise<{ html: string }>,
  {
    batch = 10,
    confirmedPresent = [],
    delayMs = [3000, 6000],
    dryRun = false,
    unmarked = [],
  }: BatchOptions & { dryRun?: boolean; unmarked?: string[] } = {},
) {
  const menu = document.documentElement.outerHTML;
  const progress = load();
  setLive({ done: 0, last: undefined, phase: 'lendo', total: undefined });
  const { added, missing } = await ledgerNow(menu, code, get);
  if (progress.pendingRemovals?.length) {
    progress.pendingRemovals = progress.pendingRemovals.filter(
      (link) => added.some((r) => r.link === link) && !confirmedPresent.includes(link),
    );
    save(progress);
    if (progress.pendingRemovals.length)
      throw new Error(
        'Uma exclusão anterior ficou incerta e o item ainda aparece; confira no Lattes antes de continuar',
      );
  }
  if (progress.results.some((r) => r.uncertain))
    throw new Error('Há inclusões incertas; reconcilie o registro antes de remover');
  // Um link com f_ctr é ação, nunca um item a abrir.
  const candidates = removalOrder(added)
    .filter((r) => r.link && !/[?&]f_ctr=/i.test(r.link))
    .filter((r) => !/cargos_vinculos/i.test(r.link) || newAtuacao(r));
  setLive({ done: 0, last: undefined, phase: 'lendo', total: candidates.length });
  const checked = await markedBatch(
    candidates,
    async (link) => (await get(withCode(link, code))).html,
    {
      allowed: unmarked,
      batch,
      between: () => pause([300, 800]),
      mark: TEST_MARK,
      onRead: (done, row) => setLive({ done, last: row.text.slice(0, 40) }),
    },
  );
  const { plan } = checked;
  const noMark = checked.noMark.map(rowLabel);
  // O link de cada sem marca, na mesma ordem: é o que a pessoa devolve ao conferir.
  const noMarkLinks = checked.noMark.map((r) => r.link);
  const unreadable = checked.unreadable.map(rowLabel);
  if (dryRun) {
    setLive({ phase: 'parado' });
    return {
      ensaio: plan.map((r) => `${r.list} :: ${r.text}`),
      faltandoDaBase: missing.map((r) => `${r.list} :: ${r.text}`),
      naoLidas: unreadable,
      registrados: added.length,
      removidos: 0,
      semMarca: noMark,
      semMarcaLinks: noMarkLinks,
      total: progress.removed.length,
    };
  }
  const removed: string[] = [];
  const failed: string[] = [];
  setLive({ done: 0, last: undefined, phase: 'removendo', total: plan.length });
  for (const row of plan) {
    censusTraffic.signal.throwIfAborted();
    const frame = await openFrame(withoutCode(row.link), code);
    try {
      progress.pendingRemovals = [row.link];
      save(progress);
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
        if (frameState(frame).submitted)
          throw new Error('O Lattes não confirmou a exclusão; confira antes de continuar');
        progress.pendingRemovals = [];
        save(progress);
        failed.push(`${row.list} :: ${row.text} :: ${msgs.join(' | ')}`);
        continue;
      }
      clearCensusCache();
      const checked = await ledgerNow(menu, code, get);
      if (checked.added.some((r) => r.link === row.link))
        throw new Error('O item ainda aparece depois da exclusão; a rodada parou');
      progress.pendingRemovals = [];
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
    naoLidas: unreadable,
    registrados: after.added.length,
    removidos: removed.length,
    semMarca: noMark,
    semMarcaLinks: noMarkLinks,
    total: progress.removed.length,
  };
}
