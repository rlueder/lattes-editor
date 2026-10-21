import { afterEach, describe, expect, it } from 'vitest';

import { locate } from '../src/bridge/production/locate.ts';
import { type ProductionOp, productionTarget } from '../src/bridge/production/plan.ts';
import { childElements, firstChild, setAttr } from '../src/model/xml.ts';
import { type LattesSimuladoNoTeste, withLattesSimulado } from './helpers/lattes-simulado.ts';

let lattes: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await lattes?.close();
});
const target = productionTarget('artigo-publicado')!;
const op = (title: string): ProductionOp => ({
  key: 'x',
  kind: 'producao',
  label: 'x',
  match: { title, year: '2025' },
  target: target.id,
  expect: {},
  set: {},
  rows: [],
});

async function setup(size: number) {
  lattes = await withLattesSimulado();
  const parent = lattes.state.ensurePath(['PRODUCAO-BIBLIOGRAFICA', 'ARTIGOS-PUBLICADOS']);
  const template = childElements(parent, 'ARTIGO-PUBLICADO')[0]!;
  parent.children = [];
  for (let i = 0; i < size; i++) {
    const el = structuredClone(template);
    setAttr(el, 'SEQUENCIA-PRODUCAO', String(100 + i));
    setAttr(firstChild(el, 'DADOS-BASICOS-DO-ARTIGO')!, 'TITULO-DO-ARTIGO', `Sintético ${i}`);
    setAttr(firstChild(el, 'DADOS-BASICOS-DO-ARTIGO')!, 'ANO-DO-ARTIGO', '2025');
    parent.children.push(el);
  }
  const menu = await lattes.port.menuHtml();
  const port = { ...lattes.port, productionScans: new Map() };
  const reads = () =>
    lattes!.state.log.filter((r) => r.method === 'GET' && !/^pkg_menu/i.test(r.proc)).length;
  return { parent, port, menu, reads };
}

describe('índice dos títulos de produção', () => {
  it('a segunda edição relê a lista e o item, sem repetir toda a categoria', async () => {
    const { port, menu, reads } = await setup(100);
    await locate(op('Sintético 0'), target, port, menu);
    expect(reads()).toBe(101);
    await locate(op('Sintético 99'), target, port, menu);
    expect(reads()).toBe(103);
  });

  it('relê todos os homônimos e recusa duplicatas mesmo depois do índice pronto', async () => {
    const { parent, port, menu } = await setup(3);
    setAttr(
      firstChild(childElements(parent)[1]!, 'DADOS-BASICOS-DO-ARTIGO')!,
      'TITULO-DO-ARTIGO',
      'Sintético 0',
    );
    await locate(op('Sintético 2'), target, port, menu);
    await expect(locate(op('Sintético 0'), target, port, menu)).rejects.toThrow('mais de um');
  });

  it('uma mudança no HTML da lista invalida os títulos guardados', async () => {
    const { parent, port, menu } = await setup(3);
    await locate(op('Sintético 0'), target, port, menu);
    setAttr(
      firstChild(childElements(parent)[1]!, 'DADOS-BASICOS-DO-ARTIGO')!,
      'TITULO-DO-ARTIGO',
      'Novo título',
    );
    await expect(locate(op('Novo título'), target, port, menu)).resolves.toHaveProperty('path');
  });

  it('a varredura interrompida retoma os títulos que ainda não leu', async () => {
    const { port, menu } = await setup(4);
    let count = 0;
    const stopped = {
      ...port,
      get: async (path: string) => {
        if (++count === 4) throw new Error('limite');
        return port.get(path);
      },
    };
    await expect(locate(op('Sintético 3'), target, stopped, menu)).rejects.toThrow('limite');
    const before = count;
    await locate(op('Sintético 3'), target, stopped, menu);
    expect(count - before).toBe(3);
  });
});
