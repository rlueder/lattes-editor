// A exclusão dos tipos de delete-items.ts no Lattes simulado: o item tirado
// no editor, achado pelo caminho da alteração, sai pelo del() da página.

import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { DEMO_XML } from '../scripts/lattes-simulado/estado.ts';
import { applyAll } from '../src/bridge/apply.ts';
import { ALL_ON, planChanges, planOptionsFor } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { loadCv } from '../src/model/document.ts';
import { getAttr, walk, type XElement } from '../src/model/xml.ts';
import {
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const DEMO = new Uint8Array(readFileSync(DEMO_XML));

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

const all = (root: XElement, name: string) => {
  const out: XElement[] = [];
  walk(root, (el) => {
    if (el.name === name) out.push(el);
  });
  return out;
};

/** Tira do documento o primeiro elemento com o nome. */
function drop(root: XElement, name: string): void {
  walk(root, (el) => {
    const i = el.children.findIndex((c) => c.kind === 'element' && c.name === name);
    if (i >= 0 && !el.children.some((c, j) => j < i && c.kind === 'element' && c.name === name)) {
      el.children.splice(i, 1);
      throw new Error('feito');
    }
  });
}

const dropFirst = (root: XElement, name: string) => {
  try {
    drop(root, name);
  } catch {
    /* tirado */
  }
};

async function plan(name: string, options = ALL_ON) {
  const original = (await loadCv(DEMO, 'demo.xml')).doc.root;
  const working = structuredClone(original);
  dropFirst(working, name);
  const entries = diffDocuments(original, working).map((change) => ({ change, itemTitle: name }));
  return planChanges(entries, working, { ...options, original }, true);
}

describe('exclusão pelo del() da página', () => {
  it('artigo, evento, prêmio e orientação: o item sai e nada mais muda', async () => {
    for (const name of [
      'ARTIGO-PUBLICADO',
      'PARTICIPACAO-EM-CONGRESSO',
      'PREMIO-TITULO',
      'ORIENTACOES-CONCLUIDAS-PARA-MESTRADO',
    ]) {
      open = await withLattesSimulado();
      const count = all(open.state.root, name).length;
      const { ops, unsupported } = await plan(name);
      expect(unsupported, name).toEqual([]);
      // O prêmio não tem número: tirar o primeiro aparece também como o
      // primeiro trocado pelo segundo, que vai depois da exclusão.
      expect(ops[0]?.kind, name).toBe('excluir-item');
      const results = await applyAll(ops, open.port);
      expect(
        results.map((r) => r.status),
        name,
      ).toEqual(ops.map(() => 'conferido'));
      expect(all(open.state.root, name), name).toHaveLength(count - 1);
      expect(
        postsOf(open).some((p) => p.fields.f_ctr === 'E'),
        name,
      ).toBe(true);
      await open.close();
      open = undefined;
    }
  });

  it('a formação: o del() pergunta antes ao SETA_ULTIMO_PUBLICO, como a página', async () => {
    open = await withLattesSimulado();
    const { ops } = await plan('DOUTORADO');
    expect(ops[0]).toMatchObject({
      kind: 'excluir-item',
      seta: 'PKG_FORMACAO.SETA_ULTIMO_PUBLICO',
    });
    const [r] = await applyAll(ops, open.port);
    expect(r).toMatchObject({ status: 'conferido' });
    expect(all(open.state.root, 'DOUTORADO')).toHaveLength(0);
  });

  it('a atuação inteira sai pelo GET com E2, com tudo o que pende dela', async () => {
    open = await withLattesSimulado();
    const before = all(open.state.root, 'ATUACAO-PROFISSIONAL');
    const { ops } = await plan('ATUACAO-PROFISSIONAL');
    expect(ops[0]).toMatchObject({ kind: 'excluir-atuacao' });
    expect((ops[0] as { rows: { after: string }[] }).rows[0]?.after).toMatch(
      /atividades, vínculos, projetos e linhas/,
    );
    const [r] = await applyAll(ops, open.port);
    expect(r).toMatchObject({ status: 'conferido' });
    const after = all(open.state.root, 'ATUACAO-PROFISSIONAL');
    expect(after).toHaveLength(before.length - 1);
    expect(getAttr(after[0]!, 'SEQUENCIA-ATIVIDADE')).not.toBe(
      getAttr(before[0]!, 'SEQUENCIA-ATIVIDADE'),
    );
  });

  it('o item diferente no Lattes: nada vai', async () => {
    open = await withLattesSimulado();
    const { ops } = await plan('PARTICIPACAO-EM-CONGRESSO');
    const evento = all(open.state.root, 'DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO')[0]!;
    evento.attrs = evento.attrs.map((a) => (a.name === 'ANO' ? { ...a, value: '1900' } : a));
    const posts = postsOf(open).length;
    const [r] = await applyAll(ops, open.port);
    expect(r).toMatchObject({ status: 'divergente' });
    expect(postsOf(open)).toHaveLength(posts);
  });

  it('sem a capacidade, segue o caminho de antes', async () => {
    const { ops, unsupported } = await plan('ARTIGO-PUBLICADO', planOptionsFor(['excluir-itens']));
    expect(ops).toEqual([]);
    expect(unsupported[0]?.reason).toMatch(/atualize a extensão/);
  });
});
