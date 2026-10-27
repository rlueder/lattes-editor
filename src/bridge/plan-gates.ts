// As chaves das alterações que só vão a uma extensão que anuncia a capacidade
// delas (compat.ts), e as opções do plano que saem disso. Fica fora de
// plan.ts para o plano caber no limite de tamanho dos arquivos.

import { EDIT_AREAS_ENABLED } from './areas-atuacao.ts';
import { BIOGRAPHIC_FULL_ENABLED, BIOGRAPHIC_OPS_ENABLED } from './biographic.ts';
import { CREATE_ITEMS_ENABLED } from './create.ts';
import { DELETE_ITEMS_ENABLED } from './delete.ts';
import { EDIT_ATIVIDADES_ENABLED } from './edit-atividade.ts';
import { EDIT_CITACOES_ENABLED } from './edit-citacao.ts';
import { EDIT_EVENTO_ENABLED, EDIT_OUVINTE_ENABLED } from './edit-items.ts';
import {
  COMPL_ENDERECO_LOOKUPS_ENABLED,
  COMPL_LOOKUPS_ENABLED,
  EDIT_FORMACAO_COMPL_ENABLED,
  EDIT_PREMIO_ENABLED,
} from './edit-lists.ts';
import type { PlanOptions } from './plan.ts';
import { INSTITUTION_HOLDERS_ENABLED } from './production/institution-holder.ts';
import {
  EDIT_PRODUCTION_ENABLED,
  PRODUCTION_LOOKUPS_ENABLED,
  PROJECT_ORGAN_ENABLED,
} from './production/plan.ts';
/**
 * Chaves de inclusão, exclusão e alteração que dependem de uma capacidade da
 * extensão. Cada uma
 * entra em BRIDGE_FEATURES (compat.ts) no mesmo commit em que a chave liga, e
 * só então, e sai no commit em que ela voltar a desligar (a exceção à regra
 * de compat.ts de que capacidade não sai): uma extensão que anunciasse a
 * capacidade com a chave desligada não teria o formulário no contrato. Mesmo
 * assim, applyOp recusa o tipo desligado na montagem dela (apply.ts,
 * ApplyGates). O teste tests/edit-flags.test.ts cobra chave e capacidade
 * juntas.
 */
export const GATED_EDITS: readonly {
  enabled: boolean;
  feature: string;
  option: keyof PlanOptions;
}[] = [
  { enabled: CREATE_ITEMS_ENABLED, feature: 'incluir-itens', option: 'createItems' },
  { enabled: DELETE_ITEMS_ENABLED, feature: 'excluir-itens', option: 'deleteItems' },
  { enabled: BIOGRAPHIC_OPS_ENABLED, feature: 'alterar-dados-gerais', option: 'biographicOps' },
  {
    enabled: BIOGRAPHIC_FULL_ENABLED,
    feature: 'alterar-dados-gerais-completo',
    option: 'biographicFull',
  },
  { enabled: EDIT_OUVINTE_ENABLED, feature: 'alterar-evento', option: 'editOuvinte' },
  { enabled: EDIT_EVENTO_ENABLED, feature: 'alterar-evento-completo', option: 'editEvento' },
  { enabled: EDIT_PREMIO_ENABLED, feature: 'alterar-premio', option: 'editPremio' },
  {
    enabled: EDIT_FORMACAO_COMPL_ENABLED,
    feature: 'alterar-formacao-complementar',
    option: 'editFormacaoComplementar',
  },
  {
    enabled: COMPL_ENDERECO_LOOKUPS_ENABLED,
    feature: 'buscas-complementar-endereco',
    option: 'complEnderecoLookups',
  },
  { enabled: COMPL_LOOKUPS_ENABLED, feature: 'buscas-complementar', option: 'complLookups' },
  { enabled: EDIT_PRODUCTION_ENABLED, feature: 'alterar-producao', option: 'editProduction' },
  {
    enabled: PRODUCTION_LOOKUPS_ENABLED,
    feature: 'buscas-producao',
    option: 'productionLookups',
  },
  { enabled: PROJECT_ORGAN_ENABLED, feature: 'orgao-projeto', option: 'projectOrgan' },
  {
    enabled: INSTITUTION_HOLDERS_ENABLED,
    feature: 'titular-instituicao',
    option: 'institutionHolders',
  },
  { enabled: EDIT_AREAS_ENABLED, feature: 'alterar-areas-atuacao', option: 'editAreas' },
  { enabled: EDIT_ATIVIDADES_ENABLED, feature: 'alterar-atividades', option: 'editAtividades' },
  { enabled: EDIT_CITACOES_ENABLED, feature: 'alterar-citacoes', option: 'editCitacoes' },
];

/**
 * As chaves do plano para a extensão ligada: cada alteração de GATED_EDITS
 * só vai a uma extensão que anuncia a capacidade dela (compat.ts), porque uma
 * mais antiga não tem o formulário no contrato e gravaria sem conferir. Sem
 * ela, essas mudanças ficam à mão.
 */
export function planOptionsFor(features: readonly string[]): PlanOptions {
  return Object.fromEntries(
    GATED_EDITS.map((g) => [g.option, g.enabled && features.includes(g.feature)]),
  );
}
