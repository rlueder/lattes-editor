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
// - patente: a inclusão passa por uma janela prévia e por um POST
//   verifica_cadastrado que não foi feito, e o formulário com f_ctr=R não foi
//   lido (seção 17);
// - pós-doutorado e livre-docência, que não estão no combo de níveis;
// - palavras-chave, áreas e setores (grades serializadas, seção 16), o
//   sanduíche e a cotutela do doutorado, equipe além do dono, financiadores,
//   produções e orientações do projeto.
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
  applyCreateFormacao,
  CREATE_FORMACAO_SPEC,
  type CreateFormacaoOp,
  FORMATION_LEVELS,
  planCreateFormacao,
} from './create-formacao.ts';
import {
  applyCreateProjeto,
  CREATE_PROJETO_SPEC,
  type CreateProjetoOp,
  isInclusion,
  planCreateProjeto,
  PROJECT_CARRIERS,
} from './create-projeto.ts';
import type { Planned } from './create-shared.ts';
import { findLinks } from './lattes-html.ts';

export { applyCreateFormacao, applyCreateProjeto };

export type CreateItemOp = CreateFormacaoOp | CreateProjetoOp;

/**
 * Os elementos que o conector sabe incluir (com a chave ligada): a atuação
 * (create.ts), cada nível do "Incluir novo item" da formação e o projeto.
 * O inventário (create-inventory.ts) parte daqui.
 */
export const CONNECTOR_CREATES: ReadonlySet<string> = new Set([
  'ATUACAO-PROFISSIONAL',
  ...Object.keys(FORMATION_LEVELS),
  'PROJETO-DE-PESQUISA',
]);

/**
 * Planeja a inclusão de um item novo de formação ou projeto; undefined quando
 * a mudança não é desses tipos (a atuação segue em create.ts).
 */
export function planCreateItem(
  change: Change,
  chain: XElement[],
  label: string,
): Planned<CreateItemOp> | undefined {
  const el = chain.at(-1);
  if (!el) return undefined;
  if (el.name === 'PATENTE') {
    return {
      reason:
        'Patente vai à mão: a inclusão passa por uma consulta prévia ao Lattes que ainda não foi observada',
    };
  }
  if (PROJECT_CARRIERS.has(el.name)) return planCreateProjeto(change, chain, label);
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
 * projetos de pesquisa no projeto. Devolve o procedimento que faltou, se faltou.
 */
export async function createFormPath(
  kind: CreateItemOp['kind'],
  get: (path: string) => Promise<string>,
  menu: string,
): Promise<{ missing: string } | { path: string }> {
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
  'criar-atuacao': CREATE_ATUACAO_SPEC,
  'criar-formacao': CREATE_FORMACAO_SPEC,
  'criar-projeto': CREATE_PROJETO_SPEC,
};
