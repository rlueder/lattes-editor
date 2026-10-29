// Incluir formação acadêmica e projeto no Lattes pelo conector (LAT-52), atrás
// da mesma chave da atuação (CREATE_ITEMS_ENABLED, em create.ts). Os
// formulários, os links de inclusão e as buscas são os de
// docs/lattes_internals.md, seções 17 e 18, lidos só com GET. Nenhuma
// inclusão foi enviada a um Lattes de verdade: a resposta do POST, o modo como
// o novo item aparece na lista e a correspondência entre atributo do XML e
// campo do formulário (pelo nome, fora a situação do curso, conferida na
// seção 5) são inferidos até o teste acompanhado.
//
// Fica de fora, à mão:
// - patente e registros: create-registro.ts (LAT-57);
// - pós-doutorado e livre-docência, que não estão no combo de níveis;
// - a instituição do sanduíche e a da cotutela, que a exportação guarda só
//   pelo código, sem o nome que a busca pede (o tipo, os orientadores e a
//   instituição do doutorado vão, create-formacao.ts).
//
// Cada operação confere antes de enviar (lista sem item igual, formulário em
// modo de inclusão do nível ou da natureza certa, todos os campos presentes),
// e depois relê a lista: tem de haver exatamente um item novo, com os campos
// lidos de volta iguais aos enviados.

import type { Change } from '../model/changes.ts';
import { childElements, type XElement } from '../model/xml.ts';
import type { FormSpec } from './contract.ts';
import { CREATE_ATUACAO_SPEC } from './create.ts';
import {
  applyCreateAtividade,
  atividadeFormPath,
  CREATE_ATIVIDADE_SPEC,
  type CreateAtividadeOp,
  planCreateAtividade,
  teachingItem,
} from './create-atividade.ts';
import { cargoItem, planCreateCargo } from './create-cargo.ts';
import {
  applyCreateComplementar,
  complementarFormPath,
  complementarItem,
  CREATE_COMPLEMENTAR_SPEC,
  type CreateComplementarOp,
  planCreateComplementar,
} from './create-complementar.ts';
import {
  applyCreateEvento,
  type CreateEventoOp,
  EVENT_ELEMENTS,
  eventItem,
  planCreateEvento,
} from './create-evento.ts';
import {
  AP_LEVELS,
  applyCreateFormacao,
  CREATE_FORMACAO_SPEC,
  type CreateFormacaoOp,
  FORMATION_LEVELS,
  planCreateFormacao,
} from './create-formacao.ts';
import {
  applyCreateGeneral,
  applyCreateVinculo,
  type CreateGeneralOp,
  type CreateVinculoOp,
  GENERAL_CREATES,
  planCreateGeneral,
} from './create-general.ts';
import {
  CREATE_DADO_SPEC,
  CREATE_VINCULO_SPEC,
  generalFormPath,
} from './create-general-contract.ts';
import {
  applyCreateProjeto,
  CREATE_PROJETO_SPEC,
  type CreateProjetoOp,
  isInclusion,
  planCreateProjeto,
  PROJECT_CARRIERS,
} from './create-projeto.ts';
import {
  applyCreateRegistro,
  CREATE_REGISTRO_SPEC,
  type CreateRegistroOp,
  planCreateRegistro,
  REGISTRY_TYPES,
  registryItem,
} from './create-registro.ts';
import { registryInclusion, registryList } from './create-registro-rules.ts';
import type { SendExtras } from './create-shared.ts';
import type { Planned } from './create-shared.ts';
import { EVENTO_SPEC } from './edit-items.ts';
import { COMPL_LEVELS } from './edit-lists.ts';
import { findLinks } from './lattes-html.ts';
import { ACTIVITY_ORGAN_ELEMENTS } from './organ-windows.ts';
import {
  creatableTarget,
  creatableTargets,
  CREATE_PRODUCTION_ENABLED,
  planCreateProduction,
} from './production/create.ts';
import type { ProductionOp } from './production/plan.ts';

export {
  applyCreateAtividade,
  applyCreateComplementar,
  applyCreateEvento,
  applyCreateFormacao,
  applyCreateGeneral,
  applyCreateProjeto,
  applyCreateRegistro,
  applyCreateVinculo,
};

export type CreateItemOp =
  | CreateAtividadeOp
  | CreateComplementarOp
  | CreateEventoOp
  | CreateFormacaoOp
  | CreateGeneralOp
  | CreateProjetoOp
  | CreateRegistroOp
  | CreateVinculoOp;

/**
 * Os elementos que o conector sabe incluir (com a chave ligada): a atuação
 * (create.ts), cada nível da formação, o projeto, os registros, os dados
 * gerais, o vínculo e os eventos. O inventário (create-inventory.ts) parte
 * daqui.
 */
export const CONNECTOR_CREATES: ReadonlySet<string> = new Set([
  'ATUACAO-PROFISSIONAL',
  ...Object.keys(FORMATION_LEVELS),
  ...Object.keys(AP_LEVELS),
  // Registros e patente: os autores pelo autorDP do menu (seção 22), e o
  // depositante da patente pelo titularPessoaDP ou pela busca de titulares
  // instituições (create-registro-extras.ts).
  ...Object.keys(REGISTRY_TYPES),
  // O projeto, com o órgão escolhido na lista do Lattes (create-projeto.ts).
  'PROJETO-DE-PESQUISA',
  ...GENERAL_CREATES,
  // A atividade de ensino, com as disciplinas (create-atividade.ts), e as
  // outras naturezas, com o órgão da janela de órgãos (create-cargo.ts).
  'ENSINO',
  ...ACTIVITY_ORGAN_ELEMENTS,
  // Eventos: pelo formulário, no lugar do Importar, com a chave ligada (direct-inclusion.ts).
  ...EVENT_ELEMENTS,
  // Formação complementar: os dois passos do FORM2 (create-complementar.ts).
  ...Object.keys(COMPL_LEVELS),
  // Produção, orientação e banca pelo formulário de inclusão (production/create.ts).
  ...(CREATE_PRODUCTION_ENABLED ? creatableTargets().map((t) => t.element) : []),
]);

/**
 * Planeja a inclusão de um item novo de formação ou projeto; undefined quando
 * a mudança não é desses tipos (a atuação segue em create.ts).
 */
export function planCreateItem(
  change: Change,
  chain: XElement[],
  label: string,
  extras: SendExtras = {},
): Planned<CreateItemOp | ProductionOp> | undefined {
  const el = chain.at(-1);
  if (!el) return undefined;
  // Produção, orientação e banca pelo formulário, no lugar do Importar (production/create.ts).
  if (CREATE_PRODUCTION_ENABLED && el.name === change.element && creatableTarget(el.name)) {
    return planCreateProduction(change, el, label, extras);
  }
  const registro = registryItem(el);
  if (registro) return planCreateRegistro(change, chain, registro, label, extras);
  const ensino = teachingItem(el);
  if (ensino) return planCreateAtividade(change, chain, ensino, label);
  const cargo = cargoItem(el);
  if (cargo) return planCreateCargo(change, chain, cargo, label);
  const evento = eventItem(el);
  if (evento) return planCreateEvento(change, chain, evento, label);
  const complementar = complementarItem(chain);
  if (complementar) return planCreateComplementar(change, complementar, label);
  const general = planCreateGeneral(change, chain, label);
  if (general) return general;
  if (PROJECT_CARRIERS.has(el.name)) return planCreateProjeto(change, chain, label, extras);
  if (chain.at(-2)?.name === 'FORMACAO-ACADEMICA-TITULACAO') {
    return planCreateFormacao(change, el, label);
  }
  // Primeira formação do currículo: o contêiner inteiro é novo.
  if (el.name === 'FORMACAO-ACADEMICA-TITULACAO') {
    const levels = childElements(el);
    return levels.length === 1
      ? planCreateFormacao(change, levels[0]!, label)
      : { reason: 'A inclusão pelo conector leva uma formação por vez' };
  }
  return undefined;
}

/**
 * O caminho do formulário de inclusão que o contrato confere, seguindo os
 * links do menu: o mestrado na formação (a base da seção 17), a lista de
 * projetos de pesquisa no projeto, a cultivar registrada nos registros. Devolve o procedimento que faltou, se faltou.
 */
export async function createFormPath(
  kind: CreateItemOp['kind'],
  get: (path: string) => Promise<string>,
  menu: string,
): Promise<{ missing: string } | { path: string }> {
  if (kind === 'criar-dado' || kind === 'criar-vinculo') return generalFormPath(kind, get, menu);
  if (kind === 'criar-atividade') return atividadeFormPath(get, menu);
  if (kind === 'criar-complementar') {
    const lista = findLinks(menu, 'pkg_formacao_compl.lista')[0];
    return lista?.params.f_cod
      ? { path: complementarFormPath(lista.params.f_cod) }
      : { missing: 'pkg_formacao_compl.lista' };
  }
  if (kind === 'criar-evento') {
    const lista = findLinks(menu, 'pkg_evento.lista').find(
      (l) => !l.params.f_sta_divulgacao_cientifica,
    );
    if (!lista) return { missing: 'pkg_evento.lista' };
    const inc = findLinks(await get(lista.path), 'PKG_EVENTO.form').find((l) => !l.params.f_seq);
    return inc ? { path: inc.path } : { missing: 'PKG_EVENTO.form' };
  }
  if (kind === 'criar-registro') {
    // A cultivar registrada: o formulário do contrato (create-registro.ts).
    const lista = registryList(menu, 'CR');
    if (!lista) return { missing: 'PKG_PATENTE_REGISTRO.LISTA' };
    const path = registryInclusion(await get(lista.path), 'CR', lista.params.f_cod ?? '');
    return path ? { path } : { missing: 'PKG_PATENTE_REGISTRO.form' };
  }
  if (kind === 'criar-formacao') {
    const lista = findLinks(menu, 'pkg_formacao.lista').find(
      (l) => (l.params.f_tipo ?? '').toUpperCase() === 'FA',
    );
    if (!lista?.params.f_cod) return { missing: 'pkg_formacao.lista' };
    return { path: `pkg_formacao.form?f_cod=${lista.params.f_cod}&f_tipo=FA&f_nivel=3` };
  }
  const lista = findLinks(menu, 'pkg_projeto.lista').find(
    (l) => (l.params.f_cod_tipo ?? '').toUpperCase() === 'P',
  );
  if (!lista) return { missing: 'pkg_projeto.lista' };
  const inclusion = findLinks(await get(lista.path), 'PKG_PROJETO.form').find(isInclusion);
  return inclusion ? { path: inclusion.path } : { missing: 'PKG_PROJETO.form' };
}

/** Os formulários de inclusão que o contrato confere com a chave ligada. */
export const CREATE_SPECS: Record<'criar-atuacao' | CreateItemOp['kind'], FormSpec> = {
  'criar-atividade': CREATE_ATIVIDADE_SPEC,
  'criar-atuacao': CREATE_ATUACAO_SPEC,
  'criar-complementar': CREATE_COMPLEMENTAR_SPEC,
  'criar-dado': CREATE_DADO_SPEC,
  'criar-evento': { ...EVENTO_SPEC, mode: 'I', partial: true },
  'criar-formacao': CREATE_FORMACAO_SPEC,
  'criar-projeto': CREATE_PROJETO_SPEC,
  'criar-registro': CREATE_REGISTRO_SPEC,
  'criar-vinculo': CREATE_VINCULO_SPEC,
};

/** As inclusões de create-items.ts (a da atuação fica em create.ts). */
export const isCreateItemKind = (kind: string): kind is CreateItemOp['kind'] =>
  kind !== 'criar-atuacao' && kind in CREATE_SPECS;
