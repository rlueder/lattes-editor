// Cópias de segurança contra o Lattes simulado (LAT-59): a rodada de escrita
// começa pelo ponto de restauração, antes de qualquer gravação; com pendência
// no Lattes, só grava com a confirmação explícita; com a sessão caída, para; e
// as cópias nunca mudam depois de gravadas. As cópias vão para o banco do
// navegador (fake-indexeddb), o mesmo caminho do build sem Tauri; o "nunca
// sobrescreve" da pasta do desktop está nos testes de src-tauri/src/copias.rs.

import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyAll } from '../src/bridge/apply.ts';
import { exportCv } from '../src/bridge/export.ts';
import { cvCodeFrom, lattesIdFrom } from '../src/bridge/lattes-html.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { beginSendSession, makeRestorePoint } from '../src/bridge/restore-point.ts';
import { keepBaseline } from '../src/desktop/backup-folder.ts';
import { browserBackupBytes, browserBackupStore as backups } from '../src/model/backup-store.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { loadCv } from '../src/model/document.ts';
import { getAttr, setAttr, walk, type XElement } from '../src/model/xml.ts';
import {
  faults,
  type LattesSimuladoNoTeste,
  postsOf,
  SMALL_CV,
  withSmallLattes,
} from './helpers/lattes-simulado.ts';

const ID = '0000000000000001';

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function start(options: Parameters<typeof withSmallLattes>[0] = {}) {
  open = await withSmallLattes(options);
  return open;
}

async function exported(lattes: LattesSimuladoNoTeste) {
  const menu = await lattes.port.menuHtml();
  return exportCv(lattes.exportPort, cvCodeFrom(menu), lattesIdFrom(menu));
}

function spanish(root: XElement): XElement {
  let hit: XElement | undefined;
  walk(root, (el) => {
    if (!hit && el.name === 'IDIOMA' && getAttr(el, 'IDIOMA') === 'ES') hit = el;
  });
  if (!hit) throw new Error('idioma não achado');
  return hit;
}

/** O que o editor faria: parte do currículo carregado, muda uma proficiência do espanhol e planeja. */
async function planReading(value: string, attr = 'PROFICIENCIA-DE-LEITURA') {
  const original = await loadCv(new TextEncoder().encode(SMALL_CV), 'cv.xml');
  const working = structuredClone(original.doc);
  setAttr(spanish(working.root), attr, value);
  const entries = diffDocuments(original.doc.root, working.root).map((change) => ({
    change,
    itemTitle: '',
  }));
  return planChanges(entries, working.root, {}).ops;
}

/** Uma rodada como a do app: o ponto de restauração, a pergunta se faltar, e só então a fila. */
async function sendRound(
  lattes: LattesSimuladoNoTeste,
  ops: Awaited<ReturnType<typeof planReading>>,
  answer: boolean,
) {
  const confirmWithout = vi.fn().mockResolvedValue(answer);
  const outcomes: unknown[] = [];
  const go = await beginSendSession({
    confirmWithout,
    onOutcome: (o) => outcomes.push(o),
    restore: () =>
      makeRestorePoint({ exportNow: () => exported(lattes), lattesId: ID, ops, store: backups }),
  });
  const results = go ? await applyAll(ops, lattes.port) : [];
  return { asked: confirmWithout.mock.calls.length > 0, go, outcome: outcomes[0], results };
}

const readingIn = async (bytes: Uint8Array) =>
  getAttr(spanish((await loadCv(bytes, 'copia.zip')).doc.root), 'PROFICIENCIA-DE-LEITURA');

describe('Lattes simulado: cópias de segurança', () => {
  it('a rodada guarda o ponto de restauração antes da primeira gravação; com pendência, só grava confirmando', async () => {
    const lattes = await start();

    // Abrir do Lattes: a primeira exportação vira o ponto zero.
    const first = await exported(lattes);
    if (!first.ok) throw new Error(first.reason);
    const baseline = await keepBaseline(ID, first.bytes, 'conector', backups);
    expect(baseline).toMatch(/^ponto-zero-\d{4}-\d{2}-\d{2}\.zip$/);

    // Primeira rodada: sem pendência, o Exportar entrega e o ponto sai antes de gravar.
    const round1 = await sendRound(lattes, await planReading('BEM'), false);
    expect(round1).toMatchObject({ asked: false, go: true, outcome: { kind: 'feito' } });
    expect(round1.results.map((r) => r.status)).toEqual(['conferido']);
    const log = lattes.state.log.map((l) => `${l.method} ${l.proc.toLowerCase()}`);
    const exportPost = log.lastIndexOf('POST pkg_impcv.get_arquivo');
    const firstWrite = log.findIndex(
      (l, i) => l.startsWith('POST') && i !== exportPost && !l.includes('get_arquivo'),
    );
    expect(exportPost).toBeGreaterThan(-1);
    expect(firstWrite).toBeGreaterThan(exportPost);

    const restoreName = (round1.outcome as { file: string }).file;
    const restoreBytes = await browserBackupBytes(ID, restoreName);
    // O ponto é o Lattes de antes da rodada: a leitura ainda é a antiga.
    expect(await readingIn(restoreBytes!)).toBe('POUCO');

    // Segunda rodada: o Lattes tem pendência e o Exportar recusa. Sem confirmar, nada é gravado.
    const postsBefore = postsOf(lattes).length;
    const refused = await sendRound(
      lattes,
      await planReading('BEM', 'PROFICIENCIA-DE-FALA'),
      false,
    );
    expect(refused).toMatchObject({
      asked: true,
      go: false,
      outcome: { kind: 'sem-ponto', latest: { name: restoreName }, reason: 'pendente' },
    });
    expect(postsOf(lattes).length).toBe(postsBefore);

    // "Continuar sem ponto de restauração": agora grava.
    const confirmed = await sendRound(
      lattes,
      await planReading('BEM', 'PROFICIENCIA-DE-FALA'),
      true,
    );
    expect(confirmed).toMatchObject({ asked: true, go: true });
    expect(postsOf(lattes).length).toBeGreaterThan(postsBefore);

    // Gravado uma vez, nunca mais muda: o ponto zero e o ponto da primeira rodada continuam iguais.
    expect([...((await browserBackupBytes(ID, baseline!)) ?? [])]).toEqual([...first.bytes]);
    expect([...((await browserBackupBytes(ID, restoreName)) ?? [])]).toEqual([...restoreBytes!]);
    const after = await exported(lattes);
    expect(after.ok).toBe(false);
    expect(
      await keepBaseline(ID, new Uint8Array([0x50, 0x4b, 9]), 'arquivo', backups),
    ).toBeUndefined();
    expect((await backups.list(ID)).map((f) => f.kind)).toEqual(['ponto-zero', 'restauracao']);
  });

  it('com a sessão caída na exportação, a rodada para sem gravar nada', async () => {
    const lattes = await start({ intercept: faults.logonAtGet(1) });
    const round = await sendRound(lattes, await planReading('BEM'), true);
    expect(round).toMatchObject({
      asked: false,
      go: false,
      outcome: { kind: 'parar', reason: 'sessao' },
    });
    expect(postsOf(lattes)).toEqual([]);
  });
});
