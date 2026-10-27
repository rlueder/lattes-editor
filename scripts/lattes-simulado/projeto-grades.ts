// As grades da página de alteração de um projeto no Lattes simulado: a
// equipe, os financiadores, as produções e as orientações ligadas.
//
// Observado (seção 21 de docs/lattes_internals.md, no código do check()): a
// equipe vai em f_autores_l com as chaves c, l, t, tit e add; os
// financiadores em f_inst_l; as produções e orientações em f_producoes_l e
// f_orientacoes_l. Observado na página de alteração real (18/10/2026): o
// autorProvider da equipe e as tabelas grid2, grid3 e grid4 dos
// financiadores, produções e orientações. Inferido: a ordem das chaves de
// cada linha da equipe (l, c, t, tit) e que o servidor a grave como chegou.
//
// As linhas das tabelas seguem as da página real de 20/10/2026 (um projeto
// de teste com um financiador e duas produções ligadas): o valor que o
// check() envia está num <span> de cada célula com tagValor. Inferido: que o
// servidor grave as linhas na ordem em que chegam e tire as que não vêm. O
// simulado não cria ligação nova: uma linha enviada que não é de nenhuma
// ligação do projeto não entra.

import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import type { LattesState } from './estado.ts';
import { esc } from './html.ts';
import type { SimRequest } from './pedido.ts';

type Row = Record<string, boolean | string>;

const ordered = (...entries: [string, boolean | string][]): Row => Object.fromEntries(entries);

const provider = (decl: string, rows: Row[]) =>
  `<script>\n${decl} = \n${JSON.stringify([...rows, {}])};\n</script>`;

const team = (projeto: XElement) => {
  const equipe = childElements(projeto, 'EQUIPE-DO-PROJETO')[0];
  return equipe ? childElements(equipe, 'INTEGRANTES-DO-PROJETO') : [];
};

const partsOf = (projeto: XElement, container: string) =>
  childElements(projeto, container).flatMap((c) => childElements(c));

/** Os quatro vetores da página de alteração do projeto. */
export function projectGridScripts(projeto: XElement | undefined): string {
  const members = projeto
    ? [...team(projeto)]
        .sort(
          (a, b) =>
            Number(getAttr(a, 'ORDEM-DE-INTEGRACAO') ?? 0) -
            Number(getAttr(b, 'ORDEM-DE-INTEGRACAO') ?? 0),
        )
        .map((m) =>
          ordered(
            ['l', getAttr(m, 'NOME-COMPLETO') ?? ''],
            ['c', getAttr(m, 'NRO-ID-CNPQ') ?? ''],
            ['t', getAttr(m, 'NOME-PARA-CITACAO') ?? ''],
            ['tit', getAttr(m, 'FLAG-RESPONSAVEL') === 'SIM' ? 's' : 'n'],
            ['editable', false],
            ['deletable', true],
          ),
        )
    : [];
  // Financiadores, produções e orientações: tabelas que o servidor escreve
  // com as linhas (grid2, grid3 e grid4 da página real, 18/10/2026).
  const table = (grid: LinkGrid) => {
    const rows = projeto
      ? partsOf(projeto, grid.container).map(
          (p) =>
            `<tr> ${grid
              .cells(p)
              .map((c) => `<td tabindex="0">${c}</td>`)
              .join(' ')} </tr>`,
        )
      : [];
    return `<table class="grid" id="${grid.id}">\n  <thead><tr><th>Título</th></tr></thead>\n  <tbody>\n${rows.join('\n')}\n</tbody></table>`;
  };
  return [
    provider('var autorProvider', members),
    // As instituições do projeto, que o configurarInstituicoes() serializa em f_instituicoes.
    '<script>\nvar titularInstProvider = \n[{}];\n</script>',
    ...LINK_GRIDS.map(table),
  ].join('\n');
}

/** O texto como o innerHTML o devolve: só &, < e > viram entidade. */
const inner = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * NATUREZA do financiador → a quarta célula. Observado só o Auxílio
 * Financeiro (A, 20/10/2026). As outras letras são inferidas; os rótulos são
 * os de verificaNaturFinacNula() da página (lida em 26/10/2026), que tem
 * "Outra". As células 0000;N; e 026|10,00 também são inferidas.
 */
const FUNDER_NATURE: Record<string, [string, string]> = {
  AUXILIO_FINANCEIRO: ['A', 'Auxílio Financeiro'],
  BOLSA: ['B', 'Bolsa'],
  COOPERACAO: ['C', 'Cooperação'],
  OUTRO: ['O', 'Outra'],
  REMUNERACAO: ['R', 'Remuneração'],
};

interface LinkGrid {
  /** As células de uma linha, em HTML. */
  cells: (part: XElement) => string[];
  container: string;
  /** O fim de cada linha no oculto. */
  end: string;
  field: string;
  id: string;
  /** Os valores dos <span>, como o check() os junta. */
  values: (part: XElement) => string[];
}

const funderValues = (f: XElement) => [
  getAttr(f, 'CODIGO-INSTITUICAO') ?? '',
  // A exportação não traz o valor nem a moeda: o simulado repete os da linha
  // observada, cujo sentido não foi lido.
  '0000;N;',
  '026|10,00',
  FUNDER_NATURE[getAttr(f, 'NATUREZA') ?? '']?.[0] ?? '',
];

/** Uma ligação de produção ou orientação: título com o código, ano e tipo. */
const linked = (seq: string, title: string, type: string): Omit<LinkGrid, 'field' | 'id'> => ({
  cells: (p) => [
    `${esc(getAttr(p, title) ?? '')}<SPAN>${inner(getAttr(p, seq) ?? '')}</SPAN>`,
    '',
    esc(getAttr(p, type) ?? ''),
  ],
  container: '',
  end: '@',
  values: (p) => [getAttr(p, seq) ?? ''],
});

const LINK_GRIDS: LinkGrid[] = [
  {
    cells: (f) => {
      const [code = '', other = '', value = '', nature = ''] = funderValues(f).map(inner);
      return [
        `${esc(getAttr(f, 'NOME-INSTITUICAO') ?? '')}<span id="cod_inst_aux">${code}</span>`,
        `0000<span>${other}</span>`,
        `R$ 10,00<span>${value}</span>`,
        `${esc(FUNDER_NATURE[getAttr(f, 'NATUREZA') ?? '']?.[1] ?? '')}<span>${nature}</span>`,
        '<img src="editar.gif" onClick="editarLinhaTabela(this)"><img src="apagar.gif" onClick="apagaLinhaTabela(this)">',
      ];
    },
    container: 'FINANCIADORES-DO-PROJETO',
    end: '|@',
    field: 'f_inst_l',
    id: 'grid2',
    values: funderValues,
  },
  {
    ...linked('SEQUENCIA-PRODUCAO-CT', 'TITULO-DA-PRODUCAO-CT', 'TIPO-PRODUCAO-CT'),
    container: 'PRODUCOES-CT-DO-PROJETO',
    field: 'f_producoes_l',
    id: 'grid3',
  },
  {
    ...linked('SEQUENCIA-ORIENTACAO', 'TITULO-ORIENTACAO', 'TIPO-ORIENTACAO'),
    container: 'ORIENTACOES',
    field: 'f_orientacoes_l',
    id: 'grid4',
  },
];

/** Os códigos ligados, como o oculto f_producoes_d ou f_orientacoes_d (34|39). */
export function linkedCodes(projeto: XElement, field: 'f_orientacoes_l' | 'f_producoes_l'): string {
  const grid = LINK_GRIDS.find((g) => g.field === field)!;
  return partsOf(projeto, grid.container)
    .map((p) => grid.values(p)[0] ?? '')
    .join('|');
}

/**
 * O financiador da linha com outra letra de natureza (a última célula): o do
 * mesmo código, já com a natureza nova. Inferido, como as letras.
 */
function renatured(parts: XElement[], kept: XElement[], line: string): XElement | undefined {
  const cells = line.split('|');
  const nature = Object.entries(FUNDER_NATURE).find(([, [letter]]) => letter === cells.at(-2));
  const funder = parts.find((p) => !kept.includes(p) && funderValues(p)[0] === cells[0]);
  if (!funder || !nature) return undefined;
  setAttr(funder, 'NATUREZA', nature[0]);
  return funder;
}

/**
 * Grava as ligações do POST: ficam, na ordem do envio, as linhas que vieram
 * como a página as serializa; as outras saem. Sem o oculto, nada muda.
 */
export function applyProjectLinks(projeto: XElement, req: SimRequest): void {
  for (const grid of LINK_GRIDS) {
    const posted = req.get(grid.field);
    if (posted === undefined || posted === null) continue;
    const parts = partsOf(projeto, grid.container);
    const kept: XElement[] = [];
    for (const line of posted.split('@').filter(Boolean)) {
      const part =
        parts.find(
          (p) => !kept.includes(p) && grid.values(p).map(inner).join('|') + grid.end === `${line}@`,
        ) ?? (grid.field === 'f_inst_l' ? renatured(parts, kept, line) : undefined);
      if (part) kept.push(part);
    }
    const container = childElements(projeto, grid.container)[0];
    if (!container) continue;
    if (kept.length === 0) {
      projeto.children = projeto.children.filter((c) => c !== container);
    } else {
      container.children = kept;
    }
  }
}

/** Grava a equipe do POST no projeto, como chegou (l|c|t|tit por linha). */
export function applyProjectTeam(state: LattesState, projeto: XElement, req: SimRequest): void {
  const grid = req.get('f_autores_l');
  if (grid === undefined || grid === null) return;
  const equipe = state.ensure(projeto, 'EQUIPE-DO-PROJETO');
  equipe.children = equipe.children.filter(
    (c) => !(c.kind === 'element' && c.name === 'INTEGRANTES-DO-PROJETO'),
  );
  grid
    .split('@')
    .filter(Boolean)
    .forEach((line, i) => {
      const [l = '', c = '', t = '', tit = ''] = line.split('|');
      insertInSchemaOrder(
        lattesSchema,
        equipe,
        element('INTEGRANTES-DO-PROJETO', {
          'FLAG-RESPONSAVEL': tit === 's' ? 'SIM' : 'NAO',
          'NOME-COMPLETO': l,
          'NOME-PARA-CITACAO': t,
          'NRO-ID-CNPQ': c,
          'ORDEM-DE-INTEGRACAO': String(i + 1),
        }),
      );
    });
}
