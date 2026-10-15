// Ponto de restauração antes de cada rodada de escrita do conector (LAT-59).
//
// Quando a pessoa confirma a fila em "Enviar ao Lattes", e antes da primeira
// gravação, o editor pede ao Lattes o mesmo ZIP do Exportar e o guarda ao lado
// do ponto zero (src/model/backups.ts). O Exportar só funciona sem alteração
// pendente (docs/lattes_internals.md, seção 10), que é justamente o estado
// antes de gravar. Se o Lattes já tem pendência, não dá para fazer o ponto:
// a pessoa fica sabendo por quê, vê a cópia mais recente e só segue
// confirmando "Continuar sem ponto de restauração". Se a exportação falha por
// outro motivo (a sessão caiu), a rodada para com o motivo.
//
// Regra: nada é gravado no Lattes sem um ponto de restauração novo ou essa
// confirmação explícita.

import { type BackupFile, type BackupStore, latestBackup, queueSummary } from '../model/backups.ts';
import { loadCv } from '../model/document.ts';
import { getAttr } from '../model/xml.ts';
import { type ExportFailure, fromBase64 } from './export.ts';
import { sameCv } from './lattes-html.ts';
import type { BridgeMessage } from './protocol.ts';

/** A resposta da exportação: o ZIP, ou por que o Lattes não entregou. */
export type ExportReply =
  | { bytes: Uint8Array; ok: true }
  | { detail?: string; ok: false; reason: ExportFailure | 'sem-exportar' | 'sem-resposta' };

/** A resposta "curriculo" da extensão (o ZIP em base64, ou o motivo) como resultado. */
export function exportReplyOf(msg: {
  detail?: string;
  reason?: ExportFailure;
  zip?: string;
}): ExportReply {
  if (!msg.zip) return { detail: msg.detail, ok: false, reason: msg.reason ?? 'erro' };
  try {
    return { bytes: fromBase64(msg.zip), ok: true };
  } catch {
    return { detail: 'O arquivo chegou corrompido', ok: false, reason: 'erro' };
  }
}

/** O id dos pedidos do ponto de restauração; nenhuma abertura de arquivo usa este prefixo. */
export const RESTORE_REQUEST_PREFIX = 'restauracao-';
/** Quantos pedidos vencidos lembrar, para engolir a resposta que chegar atrasada. */
export const EXPIRED_LIMIT = 20;

/**
 * Os pedidos de exportação do ponto de restauração em aberto. A resposta
 * ("curriculo", com o mesmo id) resolve o pedido; a que chega depois do prazo
 * ou depois de a extensão desligar é engolida: um ZIP velho de ponto de
 * restauração nunca pode virar abertura de arquivo e substituir a cópia de
 * trabalho.
 */
export class ExportRequests {
  private readonly waiters = new Map<string, (reply: ExportReply) => void>();
  /** Pedidos vencidos, do mais antigo ao mais novo, no máximo EXPIRED_LIMIT. */
  private readonly expired: string[] = [];
  private count = 0;

  private expire(id: string): void {
    this.waiters.delete(id);
    this.expired.push(id);
    if (this.expired.length > EXPIRED_LIMIT) this.expired.shift();
  }

  /** Manda o pedido e espera a resposta, ou o prazo. */
  request(post: (id: string) => void, timeoutMs: number): Promise<ExportReply> {
    this.count += 1;
    const id = `${RESTORE_REQUEST_PREFIX}${Date.now()}-${this.count}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.expire(id);
        resolve({ ok: false, reason: 'sem-resposta' });
      }, timeoutMs);
      this.waiters.set(id, (reply) => {
        clearTimeout(timer);
        resolve(reply);
      });
      post(id);
    });
  }

  /**
   * Uma mensagem da extensão. true quando a resposta é de um pedido do ponto
   * (em aberto, vencido ou só pelo prefixo do id): quem chama não a trata
   * como abertura de arquivo.
   */
  take(msg: BridgeMessage): boolean {
    if (msg.type !== 'curriculo' || !msg.id) return false;
    const waiter = this.waiters.get(msg.id);
    if (waiter) {
      this.waiters.delete(msg.id);
      waiter(exportReplyOf(msg));
      return true;
    }
    const late = this.expired.indexOf(msg.id);
    if (late >= 0) this.expired.splice(late, 1);
    return late >= 0 || msg.id.startsWith(RESTORE_REQUEST_PREFIX);
  }

  /** A extensão desligou: os pedidos em aberto não vão ter resposta. */
  dropAll(): void {
    for (const [id, resolve] of [...this.waiters]) {
      this.expire(id);
      resolve({ ok: false, reason: 'sem-resposta' });
    }
  }
}

/** Sem ponto novo, mas a pessoa pode seguir confirmando. */
export type NoRestoreReason = 'gravacao' | 'pendente' | 'sem-exportar';
/** A rodada para: escrever agora seria às cegas. */
export type StopReason =
  'consentimento' | 'erro' | 'outro-cv' | 'sem-aba' | 'sem-resposta' | 'sessao';

export type RestoreOutcome =
  | { file: string; kind: 'feito'; where: BackupStore['where'] }
  | { detail?: string; kind: 'parar'; reason: StopReason }
  | { detail?: string; kind: 'sem-ponto'; latest?: BackupFile; reason: NoRestoreReason };

/** O NUMERO-IDENTIFICADOR de dentro do ZIP, para não guardar o currículo de outra pessoa. */
async function cvIdOf(bytes: Uint8Array): Promise<string | undefined> {
  try {
    const cv = await loadCv(bytes, 'restauracao.zip');
    return getAttr(cv.doc.root, 'NUMERO-IDENTIFICADOR');
  } catch {
    return undefined;
  }
}

async function latestOf(store: BackupStore, lattesId: string): Promise<BackupFile | undefined> {
  try {
    return latestBackup(await store.list(lattesId));
  } catch {
    return undefined;
  }
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Exporta o Lattes atual e guarda como ponto de restauração. A exportação
 * também vale como ponto zero quando o currículo ainda não tem um.
 */
export async function makeRestorePoint({
  exportNow,
  lattesId,
  now = () => new Date(),
  ops,
  store,
}: {
  exportNow: () => Promise<ExportReply>;
  lattesId: string;
  now?: () => Date;
  ops: readonly { kind: string }[];
  store: BackupStore;
}): Promise<RestoreOutcome> {
  const reply = await exportNow();
  if (!reply.ok) {
    if (reply.reason === 'pendente' || reply.reason === 'sem-exportar') {
      return {
        detail: reply.detail,
        kind: 'sem-ponto',
        latest: await latestOf(store, lattesId),
        reason: reply.reason,
      };
    }
    return { detail: reply.detail, kind: 'parar', reason: reply.reason };
  }
  const exportedId = await cvIdOf(reply.bytes);
  if (!exportedId) {
    return { detail: 'O arquivo da exportação não abriu.', kind: 'parar', reason: 'erro' };
  }
  if (!sameCv(lattesId, exportedId)) return { kind: 'parar', reason: 'outro-cv' };
  const at = now();
  try {
    await store.saveBaseline(lattesId, reply.bytes, 'conector', at);
  } catch {
    // O ponto zero é à parte: a restauração abaixo é o que esta rodada precisa.
  }
  try {
    const file = await store.saveRestorePoint(lattesId, reply.bytes, queueSummary(ops), at);
    return { file, kind: 'feito', where: store.where };
  } catch (err) {
    return {
      detail: messageOf(err),
      kind: 'sem-ponto',
      latest: await latestOf(store, lattesId),
      reason: 'gravacao',
    };
  }
}

/**
 * O começo de uma rodada de escrita: o ponto de restauração e, sem ele, a
 * confirmação da pessoa. Devolve se pode gravar. `confirmWithout` só é
 * chamado quando não houve ponto novo e a rodada não precisa parar.
 */
export async function beginSendSession({
  confirmWithout,
  onOutcome,
  restore,
}: {
  confirmWithout: (outcome: Extract<RestoreOutcome, { kind: 'sem-ponto' }>) => Promise<boolean>;
  onOutcome?: (outcome: RestoreOutcome) => void;
  restore: () => Promise<RestoreOutcome>;
}): Promise<boolean> {
  const outcome = await restore();
  onOutcome?.(outcome);
  if (outcome.kind === 'feito') return true;
  if (outcome.kind === 'parar') return false;
  return confirmWithout(outcome);
}

const dateTime = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Por que não houve ponto de restauração, para a pessoa. */
export function noRestoreText(outcome: Extract<RestoreOutcome, { kind: 'sem-ponto' }>): string {
  switch (outcome.reason) {
    case 'pendente':
      return 'Não deu para fazer um ponto de restauração: o Lattes já tem alterações não enviadas ao CNPq, e enquanto isso o Exportar não entrega o currículo.';
    case 'sem-exportar':
      return 'Não deu para fazer um ponto de restauração: a extensão instalada não sabe exportar o currículo. Atualize a extensão para ter o ponto antes de cada envio.';
    case 'gravacao':
      return `O Lattes exportou o currículo, mas a cópia não foi guardada${outcome.detail ? ` (${outcome.detail.replace(/\.$/, '')})` : ''}.`;
  }
}

/** A cópia mais recente, quando há uma, ou o aviso de que não há nenhuma. */
export function latestText(latest: BackupFile | undefined): string {
  if (!latest) return 'Ainda não há nenhuma cópia de segurança deste currículo.';
  const what = latest.kind === 'ponto-zero' ? 'o ponto zero' : 'um ponto de restauração';
  return `A cópia mais recente é ${what}, de ${dateTime(latest.savedAt)}: ${latest.name}.`;
}

/** Por que a rodada parou antes de gravar. */
export function stopText(outcome: Extract<RestoreOutcome, { kind: 'parar' }>): string {
  const detail = outcome.detail ? ` (${outcome.detail.replace(/\.$/, '')})` : '';
  switch (outcome.reason) {
    case 'sessao':
      return 'Nada foi enviado: a sessão do Lattes expirou antes do ponto de restauração. Entre de novo no Lattes e envie outra vez.';
    case 'sem-aba':
      return 'Nada foi enviado: não achei o Lattes aberto no navegador para fazer o ponto de restauração.';
    case 'consentimento':
      return 'Nada foi enviado: aceite o aviso no painel da extensão e envie outra vez.';
    case 'outro-cv':
      return 'Nada foi enviado: a sessão aberta no Lattes é de outro currículo.';
    case 'sem-resposta':
      return 'Nada foi enviado: a extensão não respondeu ao pedido do ponto de restauração.';
    case 'erro':
      return `Nada foi enviado: a exportação para o ponto de restauração falhou${detail}.`;
  }
}

/** O aviso curto depois de um ponto feito. */
export function doneText(outcome: Extract<RestoreOutcome, { kind: 'feito' }>): string {
  return outcome.where === 'pasta'
    ? `Ponto de restauração guardado na pasta das cópias: ${outcome.file}.`
    : `Ponto de restauração guardado neste navegador: ${outcome.file}.`;
}
