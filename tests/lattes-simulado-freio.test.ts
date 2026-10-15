// O freio de escrita (LAT-59, item 4) contra o Lattes simulado: a rodada
// pausa no teto e segue com o "Continuar", e a fila inteira para na primeira
// divergência, com o que já foi conferido no registro do enviado e o envio
// ao CNPq bloqueado até a divergência se resolver.

import { afterEach, describe, expect, it } from 'vitest';

import { applyOp, type OpResult } from '../src/bridge/apply.ts';
import { type BridgeOp, planChanges } from '../src/bridge/plan.ts';
import { type SentEntry, sentEntry } from '../src/bridge/sent-log.ts';
import { openDivergences, runRound } from '../src/bridge/write-brake.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { loadCv } from '../src/model/document.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { getAttr, setAttr, type XDocument, type XElement } from '../src/model/xml.ts';
import { findIn, postsOf, SMALL_CV, withSmallLattes } from './helpers/lattes-simulado.ts';

type Lattes = Awaited<ReturnType<typeof withSmallLattes>>;
let open: Lattes | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

const LATTES_ID = '0000000000000001';

const idioma = (root: XElement, code: string) =>
  findIn(root, (el) => el.name === 'IDIOMA' && getAttr(el, 'IDIOMA') === code)!;
const resumo = (root: XElement) => findIn(root, (el) => el.name === 'RESUMO-CV')!;

/** Três alterações em três formulários: dois idiomas e o resumo. */
function editThree(doc: XDocument) {
  setAttr(idioma(doc.root, 'EN'), 'PROFICIENCIA-DE-ESCRITA', 'POUCO');
  setAttr(idioma(doc.root, 'ES'), 'PROFICIENCIA-DE-FALA', 'POUCO');
  setAttr(resumo(doc.root), 'TEXTO-RESUMO-CV-RH', 'Resumo novo');
}

async function planThree(): Promise<BridgeOp[]> {
  const original = await loadCv(encodeLatin1(SMALL_CV), 'pequeno.xml');
  const working = structuredClone(original.doc);
  editThree(working);
  const entries = diffDocuments(original.doc.root, working.root).map((change) => ({
    change,
    itemTitle: '',
  }));
  const { ops } = planChanges(entries, working.root, {});
  expect(ops.map((op) => op.kind).sort()).toEqual(['idioma', 'idioma', 'resumo']);
  return ops;
}

/** O que o editor faz com cada resposta: entra no registro do enviado. */
function recorder(ops: BridgeOp[], log: SentEntry[], clock: { now: number }) {
  return (r: OpResult) => {
    const op = ops.find((o) => o.key === r.key)!;
    clock.now += 1;
    log.push({
      ...sentEntry(op, LATTES_ID, clock.now, {
        outcome: r.status === 'conferido' ? undefined : { detail: r.detail, status: r.status },
      }),
      id: log.length + 1,
    });
  };
}

describe('Lattes simulado: o freio de escrita', () => {
  it('pausa no teto da rodada e grava o resto com o "Continuar"', async () => {
    const lattes = (open = await withSmallLattes());
    const ops = await planThree();
    const log: SentEntry[] = [];
    const clock = { now: 0 };
    const apply = (op: BridgeOp) => applyOp(op, lattes.port);

    const first = await runRound(ops, { apply, cap: 2, onResult: recorder(ops, log, clock) });
    expect(first).toEqual({ done: 2, kind: 'pausa', left: 1 });
    expect(postsOf(lattes)).toHaveLength(2);
    expect(log.map((e) => e.outcome)).toEqual([undefined, undefined]);

    // O "Continuar" do painel roda o que ficou na fila (o que não foi conferido).
    const confirmed = new Set(log.map((e) => e.op.key));
    const rest = ops.filter((op) => !confirmed.has(op.key));
    const second = await runRound(rest, { apply, cap: 2, onResult: recorder(ops, log, clock) });
    expect(second).toEqual({ kind: 'fim' });
    expect(postsOf(lattes)).toHaveLength(3);
    expect(getAttr(idioma(lattes.state.root, 'EN'), 'PROFICIENCIA-DE-ESCRITA')).toBe('POUCO');
    expect(getAttr(idioma(lattes.state.root, 'ES'), 'PROFICIENCIA-DE-FALA')).toBe('POUCO');
    expect(getAttr(resumo(lattes.state.root), 'TEXTO-RESUMO-CV-RH')).toBe('Resumo novo');
    expect(openDivergences(log)).toEqual([]);
  });

  it('para a fila inteira na primeira divergência e bloqueia o envio ao CNPq até resolver', async () => {
    const lattes = (open = await withSmallLattes());
    const planned = await planThree();
    // O resumo no meio da fila; alguém o mudou no próprio Lattes depois da exportação.
    const changed = planned.find((op) => op.kind === 'resumo')!;
    const idiomas = planned.filter((op) => op.kind === 'idioma');
    const ops = [idiomas[0]!, changed, idiomas[1]!];
    setAttr(resumo(lattes.state.root), 'TEXTO-RESUMO-CV-RH', 'Mudado no Lattes');

    const log: SentEntry[] = [];
    const clock = { now: 0 };
    const apply = (op: BridgeOp) => applyOp(op, lattes.port);
    const end = await runRound(ops, { apply, onResult: recorder(ops, log, clock) });

    expect(end).toMatchObject({
      kind: 'problema',
      result: { key: changed.key, status: 'divergente' },
    });
    // A primeira foi gravada e conferida e fica no registro; a terceira nem foi tentada.
    expect(postsOf(lattes)).toHaveLength(1);
    expect(log.map((e) => [e.op.key, e.outcome?.status])).toEqual([
      [ops[0]!.key, undefined],
      [changed.key, 'divergente'],
    ]);
    const blocking = openDivergences(log);
    expect(blocking.map((e) => e.op.key)).toEqual([changed.key]);

    // Volta o Lattes ao que o editor esperava e manda a mesma alteração de
    // novo: conferida, a divergência deixa de bloquear.
    setAttr(resumo(lattes.state.root), 'TEXTO-RESUMO-CV-RH', 'Resumo');
    const again = await runRound([changed, ops[2]!], {
      apply,
      onResult: recorder(ops, log, clock),
    });
    expect(again).toEqual({ kind: 'fim' });
    expect(openDivergences(log)).toEqual([]);
  });
});
