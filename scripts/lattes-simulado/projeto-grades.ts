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

import { elementLabel } from '../../src/labels/labels.ts';
import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import {
  childElements,
  element,
  getAttr,
  setAttr,
  walk,
  type XElement,
} from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import { institutionsOf } from './buscas.ts';
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

/** O código ligado é de uma orientação? (O item com esse SEQUENCIA-PRODUCAO no currículo.) */
export type IsOrientation = (code: string) => boolean;

/** Pela raiz do currículo: o item com o número é uma orientação. */
export function orientationLookup(root: XElement): IsOrientation {
  return (code) => {
    let name = '';
    walk(root, (el) => {
      if (!name && el.name !== LINK && getAttr(el, 'SEQUENCIA-PRODUCAO') === code) name = el.name;
    });
    return /ORIENTAC/.test(name);
  };
}

const LINK = 'PRODUCAO-CT-DO-PROJETO';

/** As linhas de uma grade: as ligações de produção na grid3, as de orientação na grid4. */
const rowsFor = (projeto: XElement, grid: LinkGrid, orient: IsOrientation) =>
  partsOf(projeto, grid.container).filter(
    (p) =>
      !grid.orientations ||
      grid.orientations === (orient(getAttr(p, 'SEQUENCIA-PRODUCAO-CT') ?? '') ? 'sim' : 'nao'),
  );

/** Os quatro vetores da página de alteração do projeto. */
export function projectGridScripts(
  projeto: XElement | undefined,
  orient: IsOrientation = () => false,
): string {
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
      ? rowsFor(projeto, grid, orient).map(
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
 * NATUREZA do financiador → a quarta célula. As letras e os rótulos são os do
 * select da janela de edição (lida em 27/10/2026). O simulado repete o
 * código do projeto, a moeda e o valor de uma linha de teste.
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
  /**
   * As ligações dividem o mesmo contêiner (PRODUCOES-CT-DO-PROJETO, como a
   * exportação de 27/10/2026): a grid4 fica com as orientações e a grid3 com o resto.
   */
  orientations?: 'nao' | 'sim';
  /** Os valores dos <span>, como o check() os junta. */
  values: (part: XElement) => string[];
}

/** O código do projeto e a moeda com o valor de cada financiador, como o POST os mandou. */
const funderCells = new WeakMap<XElement, [string, string]>();

const funderValues = (f: XElement) => [
  // A célula traz a letra da busca na frente do código (27/10/2026).
  getAttr(f, 'CODIGO-INSTITUICAO') ? `V${getAttr(f, 'CODIGO-INSTITUICAO')}` : '',
  // A exportação não traz o valor nem a moeda: o simulado guarda os do envio
  // ou repete os da linha observada.
  ...(funderCells.get(f) ?? ['0000;N;', '026|10,00']),
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
    orientations: 'nao',
  },
  {
    ...linked('SEQUENCIA-PRODUCAO-CT', 'TITULO-DA-PRODUCAO-CT', 'TIPO-PRODUCAO-CT'),
    container: 'PRODUCOES-CT-DO-PROJETO',
    field: 'f_orientacoes_l',
    id: 'grid4',
    orientations: 'sim',
  },
];

/** Os códigos ligados, como o oculto f_producoes_d ou f_orientacoes_d (34|39). */
export function linkedCodes(
  projeto: XElement,
  field: 'f_orientacoes_l' | 'f_producoes_l',
  orient: IsOrientation = () => false,
): string {
  const grid = LINK_GRIDS.find((g) => g.field === field)!;
  return rowsFor(projeto, grid, orient)
    .map((p) => grid.values(p)[0] ?? '')
    .join('|');
}

/** Uma ligação nova ao item do currículo com o número: o título e o tipo saem dele. */
function newLink(root: XElement, code: string): XElement | undefined {
  let item: XElement | undefined;
  walk(root, (el) => {
    if (!item && el.name !== LINK && getAttr(el, 'SEQUENCIA-PRODUCAO') === code) item = el;
  });
  if (!item) return undefined;
  const basics = childElements(item).find((c) => c.name.startsWith('DADOS-BASICOS')) ?? item;
  const title = basics.attrs.find((a) => a.name.startsWith('TITULO'))?.value ?? '';
  return element(LINK, {
    'SEQUENCIA-PRODUCAO-CT': code,
    'TIPO-PRODUCAO-CT': elementLabel(item.name),
    'TITULO-DA-PRODUCAO-CT': title,
  });
}

/**
 * O financiador de uma linha com outra instituição ou outra natureza: o da
 * mesma posição na grade, com a instituição da busca (pelo código) e a
 * natureza da letra. Inferido, como o resto da gravação.
 */
function renatured(
  state: LattesState,
  parts: XElement[],
  index: number,
  line: string,
): XElement | undefined {
  const cells = line.split('|');
  const nature = Object.entries(FUNDER_NATURE).find(([, [letter]]) => letter === cells.at(-2));
  const institution = institutionsOf(state).find((i) => i.code === cells[0]);
  const funder = parts[index];
  // Uma linha a mais que as do projeto: um financiador novo, da busca (inferido).
  if (!funder && nature && institution) {
    const created = element('FINANCIADOR-DO-PROJETO', {
      'CODIGO-INSTITUICAO': institution.code.slice(1),
      NATUREZA: nature[0],
      'NOME-INSTITUICAO': institution.name,
    });
    // As células do meio: o código do projeto e a moeda com o valor ("…|;N;||B|").
    funderCells.set(created, [cells[1] ?? '', cells.slice(2, -2).join('|')]);
    return created;
  }
  const same = funder && funderValues(funder)[0] === cells[0];
  if (!funder || !nature || (!same && !institution)) return undefined;
  setAttr(funder, 'NATUREZA', nature[0]);
  if (institution) {
    setAttr(funder, 'CODIGO-INSTITUICAO', institution.code.slice(1));
    setAttr(funder, 'NOME-INSTITUICAO', institution.name);
  }
  return funder;
}

/**
 * Grava as ligações do POST: ficam, na ordem do envio, as linhas que vieram
 * como a página as serializa; as outras saem. Sem o oculto, nada muda.
 */
export function applyProjectLinks(state: LattesState, projeto: XElement, req: SimRequest): void {
  // As produções e as orientações ligadas, no mesmo contêiner: ficam as que
  // vieram nas duas grades, na ordem; um código novo de um item do currículo
  // vira uma ligação nova (inferido: a janela de produções não foi lida).
  const orient = orientationLookup(state.root);
  const posted = (field: 'f_orientacoes_l' | 'f_producoes_l') => {
    const raw = req.get(field);
    return raw === undefined || raw === null
      ? linkedCodes(projeto, field, orient).split('|').filter(Boolean)
      : raw.split('@').filter(Boolean);
  };
  if (req.get('f_producoes_l') !== undefined || req.get('f_orientacoes_l') !== undefined) {
    const parts = partsOf(projeto, 'PRODUCOES-CT-DO-PROJETO');
    const kept = [...posted('f_producoes_l'), ...posted('f_orientacoes_l')]
      .map(
        (code) =>
          parts.find((p) => getAttr(p, 'SEQUENCIA-PRODUCAO-CT') === code) ??
          newLink(state.root, code),
      )
      .filter((p): p is XElement => p !== undefined);
    const container = childElements(projeto, 'PRODUCOES-CT-DO-PROJETO')[0];
    if (kept.length === 0) {
      if (container) projeto.children = projeto.children.filter((c) => c !== container);
    } else if (container) container.children = kept;
    else insertInSchemaOrder(lattesSchema, projeto, element('PRODUCOES-CT-DO-PROJETO', {}, kept));
  }
  for (const grid of LINK_GRIDS.filter((g) => g.field === 'f_inst_l')) {
    const posted = req.get(grid.field);
    if (posted === undefined || posted === null) continue;
    const parts = partsOf(projeto, grid.container);
    const kept: XElement[] = [];
    for (const [index, line] of posted.split('@').filter(Boolean).entries()) {
      const part =
        parts.find(
          (p) => !kept.includes(p) && grid.values(p).map(inner).join('|') + grid.end === `${line}@`,
        ) ?? (grid.field === 'f_inst_l' ? renatured(state, parts, index, line) : undefined);
      if (part) kept.push(part);
    }
    const container = childElements(projeto, grid.container)[0];
    if (kept.length === 0) {
      if (container) projeto.children = projeto.children.filter((c) => c !== container);
    } else if (container) container.children = kept;
    else insertInSchemaOrder(lattesSchema, projeto, element(grid.container, {}, kept));
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
