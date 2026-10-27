// As alterações atrás de chave que este lado grava (ApplyGates) e o motivo de
// recusar uma operação de chave desligada. Fica fora de apply.ts para ele caber
// no limite de tamanho dos arquivos.

import { BIOGRAPHIC_FULL_ENABLED, isBiographicOp, needsFullBiographic } from './biographic.ts';
import { EDIT_EVENTO_ENABLED, isEventoOp, isFullEvento } from './edit-items.ts';
import {
  COMPL_ENDERECO_LOOKUPS_ENABLED,
  COMPL_LOOKUPS_ENABLED,
  enabledListEdits,
  isListEditOp,
  type ListEditKind,
} from './edit-lists.ts';
import type { BridgeOp } from './plan.ts';

/**
 * As alterações atrás de chave que este lado grava: as que têm o formulário
 * no contrato dele. O app só manda essas operações a uma extensão que anuncia
 * a capacidade (plan.ts, GATED_EDITS), mas a extensão não confia nisso: uma
 * operação de um tipo cuja chave ela tem desligada para sem enviar nada.
 */
export interface ApplyGates {
  /** BIOGRAPHIC_FULL_ENABLED; sem valor, desligada. */
  biographicFull?: boolean;
  /** COMPL_ENDERECO_LOOKUPS_ENABLED; sem valor, desligada. */
  complEnderecoLookups?: boolean;
  /** COMPL_LOOKUPS_ENABLED; sem valor, desligada. */
  complLookups?: boolean;
  editEvento: boolean;
  lists: ReadonlySet<ListEditKind>;
}

export const BUILD_GATES: ApplyGates = {
  biographicFull: BIOGRAPHIC_FULL_ENABLED,
  complEnderecoLookups: COMPL_ENDERECO_LOOKUPS_ENABLED,
  complLookups: COMPL_LOOKUPS_ENABLED,
  editEvento: EDIT_EVENTO_ENABLED,
  lists: enabledListEdits(),
};

/** Por que esta extensão não grava a operação; undefined quando grava. */
export function gatedOut(op: BridgeOp, gates: ApplyGates): string | undefined {
  if (isListEditOp(op) && !gates.lists.has(op.kind)) {
    return 'Esta extensão não tem o formulário deste tipo no contrato; a alteração fica à mão';
  }
  if (isBiographicOp(op) && !gates.biographicFull && needsFullBiographic(op)) {
    return 'Esta extensão não grava instituição, curso e agência pelas buscas, pós-doutorado, livre-docência nem outras informações; a alteração fica à mão';
  }
  const lookups =
    (isListEditOp(op) && op.lookups !== undefined && !gates.complLookups) ||
    (op.kind === 'endereco' &&
      (op.institution !== undefined || op.organ !== undefined) &&
      !gates.complEnderecoLookups);
  if (lookups) {
    return 'Esta extensão não grava instituição, curso e órgão pelas buscas neste formulário; a alteração fica à mão';
  }
  if (isEventoOp(op) && !gates.editEvento && isFullEvento(op)) {
    return 'Esta extensão só altera eventos de ouvinte; a alteração fica à mão';
  }
  return undefined;
}
