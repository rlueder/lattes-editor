// Freio de escrita do conector (LAT-59, item 4).
//
// Três regras, aqui sem chrome nem React, para a extensão
// (extension/src/background.ts), o editor e os testes usarem as mesmas:
//
// - uma rodada grava no máximo WRITES_PER_ROUND alterações e pausa; para
//   seguir, a pessoa clica de novo no painel da extensão;
// - a fila inteira para no primeiro resultado que não for conferido
//   (divergência, erro, sessão caída) e em qualquer falha inesperada da aba;
// - "Enviar ao CNPq" fica bloqueado enquanto houver gravação divergente que
//   ninguém resolveu (openDivergences).

import type { OpResult, ResultStatus } from './apply.ts';
import { blocksKind, type ContractReport, driftText, lacksSample } from './contract.ts';
import type { BridgeOp } from './plan.ts';
import type { SentEntry } from './sent-log.ts';

/**
 * Quantas gravações uma rodada faz antes de pedir confirmação de novo. Uma
 * rodada comum do editor tem de uma a dez operações (cada operação é um
 * item inteiro num formulário, com todos os campos alterados dele), e passa
 * sem pausa. As grandes vêm de itens trazidos de outro XML ou de uma
 * restauração; cada operação faz de três a cinco pedidos ao Lattes (ler o
 * formulário, gravar, ler de novo), e 20 seguidas já são uns cem pedidos
 * sem a pessoa olhar o Lattes. É também o tanto que dá para conferir à mão
 * numa olhada no currículo.
 */
export const WRITES_PER_ROUND = 20;

/**
 * Antes da primeira gravação, o Lattes precisa estar como o conector espera.
 * Uma mudança do CNPq num formulário da fila para tudo, com o campo apontado;
 * se nem deu para conferir, também para: sem leitura, não há garantia.
 * undefined quando a fila pode seguir.
 */
export function contractStop(
  report: ContractReport,
  queue: readonly Pick<BridgeOp, 'kind'>[],
): Pick<OpResult, 'detail' | 'status'> | undefined {
  if (report.status === 'sessao') {
    return { detail: report.detail ?? 'A sessão do Lattes caiu; entre de novo', status: 'sessao' };
  }
  if (report.status === 'erro') {
    return {
      detail: `Não deu para conferir o Lattes (${report.detail ?? 'sem detalhe'}); nada foi enviado`,
      status: 'erro',
    };
  }
  const kinds = [...new Set(queue.map((op) => op.kind))];
  const blocking = kinds.flatMap((kind) => blocksKind(report, kind));
  if (blocking.length > 0) {
    return {
      detail: `O Lattes mudou (${blocking.map(driftText).join('; ')}); nada foi enviado. Veja a verificação no painel`,
      status: 'erro',
    };
  }
  const unsampled = kinds.map((kind) => lacksSample(report, kind)).find(Boolean);
  if (unsampled) {
    return {
      detail: `Não achei no Lattes um exemplar de ${unsampled.form} para conferir (${unsampled.detail ?? 'sem amostra'}); nada foi enviado`,
      status: 'erro',
    };
  }
  return undefined;
}

/** A rodada parou no teto: quantas gravou e quantas ficaram na fila. */
export interface RoundPause {
  done: number;
  left: number;
}

export type RoundEnd =
  /** A fila acabou, tudo conferido. */
  | { kind: 'fim' }
  /** A pessoa pediu para parar. */
  | { kind: 'parado' }
  /** O primeiro resultado que não foi conferido: a fila para aqui. */
  | { kind: 'problema'; result: OpResult }
  | ({ kind: 'pausa' } & RoundPause);

const STATUSES = new Set<ResultStatus>(['conferido', 'divergente', 'erro', 'sessao']);

const UNKNOWN_WRITE =
  'não dá para saber se gravou. Confira esta alteração no Lattes antes de mandar de novo';

/**
 * A resposta da aba como resultado. Sem resposta, ou com uma que não é o
 * resultado desta operação, a gravação pode ter acontecido ou não: fica como
 * divergente, que para a fila e bloqueia o envio ao CNPq até a pessoa
 * conferir.
 */
export function checkedResult(raw: unknown, key: string): OpResult {
  if (raw === undefined || raw === null) {
    return { detail: `A aba do Lattes não respondeu; ${UNKNOWN_WRITE}`, key, status: 'divergente' };
  }
  const r = raw as Partial<OpResult>;
  const valid =
    typeof r === 'object' &&
    typeof r.detail === 'string' &&
    r.key === key &&
    typeof r.status === 'string' &&
    STATUSES.has(r.status);
  if (!valid) {
    return {
      detail: `A aba do Lattes deu uma resposta inesperada; ${UNKNOWN_WRITE}`,
      key,
      status: 'divergente',
    };
  }
  return r as OpResult;
}

/** Uma falha que estourou no meio da operação (a aba fechou, a página mudou). */
export function unexpectedResult(key: string, err: unknown): OpResult {
  const why = err instanceof Error ? err.message : String(err);
  return {
    detail: `Falha inesperada na aba do Lattes (${why.replace(/\.$/, '')}); ${UNKNOWN_WRITE}`,
    key,
    status: 'divergente',
  };
}

/**
 * Roda a fila, uma operação por vez, com as três paradas: o teto da rodada,
 * o primeiro resultado não conferido e o pedido de parar. Toda resposta passa
 * por onResult antes da próxima operação, inclusive a que para a fila.
 */
export async function runRound(
  queue: readonly BridgeOp[],
  {
    apply,
    cap = WRITES_PER_ROUND,
    onResult,
    shouldStop = () => false,
  }: {
    apply: (op: BridgeOp) => Promise<unknown>;
    cap?: number;
    onResult: (result: OpResult) => Promise<void> | void;
    shouldStop?: () => boolean;
  },
): Promise<RoundEnd> {
  let done = 0;
  for (const op of queue) {
    if (shouldStop()) return { kind: 'parado' };
    if (done >= cap) return { done, kind: 'pausa', left: queue.length - done };
    let result: OpResult;
    try {
      result = checkedResult(await apply(op), op.key);
    } catch (err) {
      result = unexpectedResult(op.key, err);
    }
    done += 1;
    await onResult(result);
    if (result.status !== 'conferido') return { kind: 'problema', result };
  }
  return { kind: 'fim' };
}

const writes = (n: number) => (n === 1 ? '1 gravação' : `${n} gravações`);

/** O aviso da pausa, no painel da extensão ou no editor. */
export function pauseText(pause: RoundPause, where: 'editor' | 'painel'): string {
  const left = pause.left === 1 ? 'a que falta' : `as ${pause.left} que faltam`;
  const button = where === 'painel' ? '"Continuar"' : '"Continuar" no painel da extensão';
  return `Pausa depois de ${writes(pause.done)} nesta rodada. Confira no Lattes o que já foi gravado e clique em ${button} para gravar ${left}.`;
}

/**
 * As gravações divergentes que ninguém resolveu, da mais antiga à mais
 * recente. Uma divergência se resolve quando a mesma alteração (a mesma
 * chave) volta mais tarde gravada e conferida, ou quando a pessoa diz que
 * conferiu no Lattes (checkedAt). Quem chama escolhe as entradas: as que
 * ainda não foram publicadas (src/import-export/publish-view.ts).
 */
export function openDivergences(entries: readonly SentEntry[]): SentEntry[] {
  return entries
    .filter(
      (e) =>
        e.outcome?.status === 'divergente' &&
        e.checkedAt === undefined &&
        !entries.some(
          (later) => !later.outcome && later.op.key === e.op.key && later.sentAt > e.sentAt,
        ),
    )
    .sort((a, b) => a.sentAt - b.sentAt);
}

/** Por que o envio ao CNPq está bloqueado. */
export function publishBlockText(count: number): string {
  const what =
    count === 1
      ? '1 gravação do editor não foi conferida no Lattes'
      : `${count} gravações do editor não foram conferidas no Lattes`;
  return `${what}. Confira no Lattes e marque "Já conferi no Lattes", ou mande a alteração de novo até ela voltar conferida. Até lá, o envio ao CNPq fica bloqueado.`;
}
