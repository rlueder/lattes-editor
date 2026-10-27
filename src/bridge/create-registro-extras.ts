// O que a inclusão de uma patente ou registro leva além dos campos
// (create-registro.ts): os autores além da própria pessoa, as informações
// adicionais, as palavras-chave, áreas e setores, e o depositante da patente.
//
// Observado: o formulário de inclusão de cada tipo tem f_ref e f_ref_en
// (censo de 27/10/2026), as grades f_autores_l, f_plv_l, f_area_l e f_setor_l
// e, na patente, f_depositante_pessoa_l e f_depositante_inst_l. Os autores e o
// depositante saem das mesmas listas da alteração: o autorDP do menu e o
// titularPessoaDP ou a busca de titulares instituições (holders.ts,
// institution-holder.ts). Inferido, até o teste acompanhado: que a inclusão
// grave essas grades como a alteração.

import { foldText } from '../model/fold-text.ts';
import { childElements, firstChild, getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort, ResultStatus } from './apply.ts';
import {
  menuAuthors,
  ownerAuthor,
  ownerGridRow,
  type OwnerNames,
  REGISTRY_AUTHOR_KEYS,
  serializeGrid,
} from './author-grid.ts';
import { newGridPairs, newGridProblems, type NewItemGrids, newItemGrids } from './create-grids.ts';
import { getChecked, readBack } from './create-shared.ts';
import type { FormControl, Pairs } from './form.ts';
import type { FieldValues } from './plan.ts';
import {
  AUTHOR_PART,
  authorRows,
  authorsOf,
  type AuthorSpec,
  gridPairs,
  type GridRow,
} from './production/grids.ts';
import { depositorReplace } from './production/institution-holder.ts';

export interface RegistroExtras {
  /** Os autores na ordem de autoria, com a marca da própria pessoa. */
  authors: (AuthorSpec & { owner: boolean })[];
  /** O depositante da patente (NOME-DO-DEPOSITANTE), pessoa ou instituição. */
  depositor?: string;
  grids?: NewItemGrids;
  /** As informações adicionais, em português e em inglês. */
  info?: { en: string; pt: string };
}

/** As partes do item que os extras levam, fora os dados básicos e o detalhamento. */
export const EXTRA_PARTS = [
  'AUTORES',
  'INFORMACOES-ADICIONAIS',
  'PALAVRAS-CHAVE',
  'AREAS-DO-CONHECIMENTO',
  'SETORES-DE-ATIVIDADE',
];

/**
 * Os extras do item novo; o motivo, quando um não vai. `isOwner` diz se o
 * autor é a própria pessoa, que precisa estar entre os autores.
 */
export function planRegistroExtras(
  item: XElement,
  root: XElement | undefined,
  depositor: string,
): RegistroExtras | { reason: string } {
  const authors = authorsOf(childElements(item, AUTHOR_PART.element)).map((a) => ({
    ...a,
    owner: isOwner(a, root),
  }));
  // Sem autores no XML, só a própria pessoa, como a inclusão sempre fez.
  if (authors.length === 0) authors.push({ citation: '', cnpq: '', name: '', owner: true });
  if (!authors.some((a) => a.owner)) {
    return { reason: 'O Lattes exige você entre os autores do registro' };
  }
  const grids = newItemGrids(item);
  if (grids && 'reason' in grids) return grids;
  const info = childElements(item, 'INFORMACOES-ADICIONAIS')[0];
  const pt = (info && getAttr(info, 'DESCRICAO-INFORMACOES-ADICIONAIS')) ?? '';
  const en = (info && getAttr(info, 'DESCRICAO-INFORMACOES-ADICIONAIS-INGLES')) ?? '';
  return {
    authors,
    ...(depositor.trim() ? { depositor: depositor.trim() } : {}),
    ...(grids ? { grids } : {}),
    ...(pt || en ? { info: { en, pt } } : {}),
  };
}

type Failure = { detail: string; status: ResultStatus };

/**
 * Os ocultos e campos que os extras põem no envio: a grade de autores, as
 * informações adicionais, as três grades e, na patente, as dos depositantes.
 */
export async function registroExtrasSet(
  extras: RegistroExtras,
  owner: OwnerNames,
  menu: string,
  port: LattesPort,
  pairs: Pairs,
): Promise<{ set: FieldValues } | Failure> {
  const self = ownerAuthor(menu, owner);
  if ('reason' in self) return { detail: self.reason, status: 'erro' };
  const known = menuAuthors(menu) ?? [];
  const rows: GridRow[] = [];
  const missing: string[] = [];
  for (const a of extras.authors) {
    if (a.owner) {
      rows.push(ownerGridRow(self.owner));
      continue;
    }
    const built = authorRows([], known, [a]);
    missing.push(...built.missing);
    rows.push(...built.rows);
  }
  if (missing.length > 0) {
    return {
      detail: `Autor que não está na lista do Lattes: ${missing.join(', ')}. Inclua-o no Lattes uma vez; depois o editor consegue mandar`,
      status: 'erro',
    };
  }
  const set: FieldValues = { f_autores_l: serializeGrid(rows, REGISTRY_AUTHOR_KEYS) };
  if (extras.info) Object.assign(set, { f_ref: extras.info.pt, f_ref_en: extras.info.en });
  if (extras.grids) {
    const grids = newGridPairs(extras.grids, menu);
    if ('detail' in grids) return { detail: grids.detail, status: 'erro' };
    Object.assign(set, grids.set);
  }
  if (extras.depositor) {
    const built = await depositorReplace(
      port,
      pairs,
      menu,
      {},
      {
        after: extras.depositor,
        institutions: true,
      },
    );
    if ('status' in built) return built;
    Object.assign(
      set,
      gridPairs({ f_depositante_inst_l: [], f_depositante_pessoa_l: [] }, built.replace),
    );
  }
  return { set };
}

/** O dono do currículo, pelo ID Lattes ou, sem ele, pelo nome. */
function isOwner(author: AuthorSpec, root: XElement | undefined): boolean {
  if (!root) return false;
  const ownerId = getAttr(root, 'NUMERO-IDENTIFICADOR') ?? '';
  if (ownerId && author.cnpq) return ownerId === author.cnpq;
  const dg = firstChild(root, 'DADOS-GERAIS');
  const ownerName = foldText((dg && getAttr(dg, 'NOME-COMPLETO')) ?? '');
  return ownerName !== '' && ownerName === foldText(author.name);
}

/**
 * A releitura do item criado: os campos enviados, as informações adicionais e
 * as grades; os autores e os depositantes não se releem.
 */
export async function registroCheck(
  port: LattesPort,
  path: string,
  saved: { controls: FormControl[]; pairs: Pairs },
  set: FieldValues,
  extras: RegistroExtras | undefined,
): Promise<ReturnType<typeof readBack>> {
  const info: FieldValues = extras?.info ? { f_ref: extras.info.pt, f_ref_en: extras.info.en } : {};
  // A grade de datas da patente, como as outras grades, sai do script da
  // página, e o oculto não se relê.
  const { f_dados_grid_datas: _dates, ...fields } = set;
  const check = readBack(saved, { ...fields, ...info });
  if (extras?.grids) {
    check.differ.push(...newGridProblems(await getChecked(port, path), extras.grids));
  }
  return check;
}
