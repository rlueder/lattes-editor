// O que a inclusão de um projeto leva além dos campos (create-projeto.ts): a
// equipe além da própria pessoa, os financiadores e as produções e
// orientações ligadas, nas mesmas grades da alteração.
//
// A equipe sai da lista de autores do menu (autorDP), como na alteração
// (production/members.ts), com a marca de coordenador (tit). Os financiadores
// saem da busca do financiador (financiador.ts) e as ligações pelo código do
// item ligado (project-links.ts). Inferido, até o teste acompanhado: que a
// inclusão grave as grades como a alteração.

import { childElements, firstChild, getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort, ResultStatus } from './apply.ts';
import {
  menuAuthors,
  ownerAuthor,
  ownerGridRow,
  type OwnerNames,
  serializeGrid,
  TEAM_KEYS,
} from './author-grid.ts';
import { foldText } from './html-text.ts';
import type { FieldValues } from './plan.ts';
import { FUNDER_NATURE, searchFunder } from './production/financiador.ts';
import { authorRows, type GridRow } from './production/grids.ts';
import { opaqueValue, serializeCells } from './production/opaque.ts';
import { gridOf } from './production/project-links.ts';
import type { OpaqueGrid } from './production/types.ts';

interface Member {
  citation: string;
  cnpq: string;
  lead: boolean;
  name: string;
  owner: boolean;
}

export interface ProjetoExtras {
  funders: { letter: string; name: string }[];
  links: { orientacoes: string[]; producoes: string[] };
  team: Member[];
}

/** As partes do projeto que os extras levam. */
export const PROJECT_EXTRA_PARTS = [
  'EQUIPE-DO-PROJETO',
  'FINANCIADORES-DO-PROJETO',
  'PRODUCOES-CT-DO-PROJETO',
];

/** O dono do currículo, pelo ID Lattes ou, sem ele, pelo nome. */
function isOwner(m: { cnpq: string; name: string }, root: XElement | undefined): boolean {
  if (!root) return false;
  const ownerId = getAttr(root, 'NUMERO-IDENTIFICADOR') ?? '';
  if (ownerId && m.cnpq) return ownerId === m.cnpq;
  const dg = firstChild(root, 'DADOS-GERAIS');
  const ownerName = foldText((dg && getAttr(dg, 'NOME-COMPLETO')) ?? '');
  return ownerName !== '' && ownerName === foldText(m.name);
}

/** A equipe, os financiadores e as ligações do projeto novo; o motivo, quando um não vai. */
export function planProjetoExtras(
  projeto: XElement,
  root: XElement | undefined,
): ProjetoExtras | { reason: string } {
  const equipe = firstChild(projeto, 'EQUIPE-DO-PROJETO');
  const members = (equipe ? childElements(equipe, 'INTEGRANTES-DO-PROJETO') : [])
    .sort(
      (a, b) =>
        Number(getAttr(a, 'ORDEM-DE-INTEGRACAO') ?? 0) -
        Number(getAttr(b, 'ORDEM-DE-INTEGRACAO') ?? 0),
    )
    .map((m) => {
      const spec = {
        citation: getAttr(m, 'NOME-PARA-CITACAO') ?? '',
        cnpq: getAttr(m, 'NRO-ID-CNPQ') ?? '',
        lead: getAttr(m, 'FLAG-RESPONSAVEL') === 'SIM',
        name: getAttr(m, 'NOME-COMPLETO') ?? '',
      };
      return { ...spec, owner: isOwner(spec, root) };
    });
  // Sem equipe no XML, a própria pessoa como coordenadora, como a inclusão sempre fez.
  const team = members.length
    ? members
    : [{ citation: '', cnpq: '', lead: true, name: '', owner: true }];
  if (!team.some((m) => m.owner)) return { reason: 'O Lattes exige você na equipe do projeto' };
  if (!team.some((m) => m.lead)) return { reason: 'O Lattes exige um coordenador na equipe' };
  const fin = firstChild(projeto, 'FINANCIADORES-DO-PROJETO');
  const funders: ProjetoExtras['funders'] = [];
  for (const f of fin ? childElements(fin, 'FINANCIADOR-DO-PROJETO') : []) {
    const name = (getAttr(f, 'NOME-INSTITUICAO') ?? '').trim();
    const letter = FUNDER_NATURE[getAttr(f, 'NATUREZA') ?? ''];
    if (!name || !letter) {
      return { reason: 'Financiador sem a instituição ou com natureza que o Lattes não tem' };
    }
    funders.push({ letter, name });
  }
  const prods = firstChild(projeto, 'PRODUCOES-CT-DO-PROJETO');
  const links: ProjetoExtras['links'] = { orientacoes: [], producoes: [] };
  for (const l of prods ? childElements(prods, 'PRODUCAO-CT-DO-PROJETO') : []) {
    const code = getAttr(l, 'SEQUENCIA-PRODUCAO-CT') ?? '';
    const grid = root && gridOf(root, code);
    if (!grid) return { reason: `O item ligado ${code} não está no currículo` };
    links[grid].push(code);
  }
  return { funders, links, team };
}

type Failure = { detail: string; status: ResultStatus };

/** Os ocultos da equipe, dos financiadores e das ligações para a inclusão. */
export async function projetoExtrasSet(
  extras: ProjetoExtras,
  owner: OwnerNames,
  menu: string,
  port: LattesPort,
  path: string,
): Promise<{ set: FieldValues } | Failure> {
  const self = ownerAuthor(menu, owner);
  if ('reason' in self) return { detail: self.reason, status: 'erro' };
  const known = menuAuthors(menu) ?? [];
  const rows: GridRow[] = [];
  const missing: string[] = [];
  for (const m of extras.team) {
    const tit = m.lead ? 's' : 'n';
    if (m.owner) {
      rows.push(ownerGridRow(self.owner, { tit }));
      continue;
    }
    const built = authorRows([], known, [m]);
    missing.push(...built.missing);
    rows.push(...built.rows.map((r) => ({ ...r, tit })));
  }
  if (missing.length > 0) {
    return {
      detail: `Integrante que não está na lista do Lattes: ${missing.join(', ')}. Inclua-o no Lattes uma vez; depois o editor consegue mandar`,
      status: 'erro',
    };
  }
  const funderRows: string[][] = [];
  for (const f of extras.funders) {
    const found = await searchFunder(port, path, f.name);
    if ('status' in found) return found;
    funderRows.push([found.code, ';N;', '|', f.letter]);
  }
  const grid = (codes: string[]) => codes.map((c) => `${c}@`).join('');
  return {
    set: {
      f_autores_l: serializeGrid(rows, TEAM_KEYS),
      f_inst_l: serializeCells(funderRows, { cells: 4, end: '|@' }),
      f_orientacoes_d: extras.links.orientacoes.join('|'),
      f_orientacoes_l: grid(extras.links.orientacoes),
      f_producoes_d: extras.links.producoes.join('|'),
      f_producoes_l: grid(extras.links.producoes),
    },
  };
}

/** As grades do projeto criado que não voltaram como foram (a equipe não se relê). */
export function projetoExtrasProblems(
  html: string,
  grids: readonly OpaqueGrid[],
  set: FieldValues,
): string[] {
  return grids
    .filter((g) => {
      const now = opaqueValue(html, g);
      const sent = set[g.field] ?? '';
      // Sem a tabela na página, só acusa quando algo foi enviado nela.
      return now === undefined ? sent !== '' : now !== sent;
    })
    .map((g) => g.label);
}
