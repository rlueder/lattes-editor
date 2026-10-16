// Registro do que o conector gravou no Lattes. O Lattes não mostra o que está
// pendente nem deixa descartar antes de "Enviar ao CNPq"
// (docs/lattes_internals.md, seção 10); este registro é o único lugar onde a
// pessoa vê o que foi gravado e de onde pode desfazer. As tentativas que não
// deram certo também entram, e o registro sai em texto para anexar a um
// recurso de edital quando o Lattes cai no prazo (LAT-47).

import type { Change } from '../model/changes.ts';
import type { ResultStatus } from './apply.ts';
import { isDeleteOp } from './delete.ts';
import { opRows } from './field-labels.ts';
import type { BridgeOp } from './plan.ts';
import { isProductionOp } from './production/plan.ts';

export interface SentRow {
  after: string;
  before: string;
  label: string;
  name: string;
}

export interface SentEntry {
  /** Mudança do editor que gerou a operação, para reabri-la se for desfeita. */
  change?: Change;
  /**
   * Quando a pessoa marcou "Já conferi no Lattes" numa gravação divergente:
   * a divergência deixa de bloquear o envio ao CNPq (src/bridge/write-brake.ts).
   */
  checkedAt?: number;
  id?: number;
  /** NUMERO-IDENTIFICADOR do currículo. */
  lattesId: string;
  /** A operação exatamente como foi enviada e conferida. */
  op: BridgeOp;
  /**
   * Como terminou, quando não foi conferido: recusado antes de gravar, sessão
   * caída, ou criado no Lattes com divergência na conferência. Ausente é
   * gravado e conferido (e todas as entradas de antes deste campo).
   */
  outcome?: {
    /**
     * Números que o Lattes deu ao item criado, mesmo sem conferir
     * (OpResult.assigned): com "Já conferi no Lattes", o item entra na cópia
     * com eles, como entraria conferido.
     */
    assigned?: Record<string, string>;
    detail: string;
    status: Exclude<ResultStatus, 'conferido'>;
  };
  /** Linhas "antes → depois", guardadas prontas para mostrar. */
  rows: SentRow[];
  sentAt: number;
  /** id da entrada que esta desfez. */
  undoOf?: number;
}

/** A tentativa não terminou conferida. */
export const failed = (entry: SentEntry): boolean => entry.outcome !== undefined;

export function sentEntry(
  op: BridgeOp,
  lattesId: string,
  sentAt: number,
  extra: Pick<SentEntry, 'change' | 'outcome' | 'undoOf'> = {},
): SentEntry {
  return { ...extra, lattesId, op, rows: opRows(op), sentAt };
}

export const UNDO_KEY_PREFIX = 'desfazer:';

/**
 * O selo de uma gravação no registro do enviado: "novo" para um item criado,
 * "removido" para uma exclusão; a alteração de um item que já existia não
 * tem selo.
 */
export function opBadge(op: BridgeOp): 'novo' | 'removido' | undefined {
  if (op.kind.startsWith('criar-')) return 'novo';
  if (isDeleteOp(op)) return 'removido';
  return undefined;
}

/**
 * Por que esta operação não se desfaz pelo editor, mesmo conferida; undefined
 * quando se desfaz. Desfazer é mandar de volta os valores de antes, e um item
 * criado ou excluído não tem "antes" no mesmo formulário.
 */
export function noUndoReason(op: BridgeOp): string | undefined {
  if (op.kind.startsWith('criar-')) {
    return 'Item criado pelo conector: para tirar, exclua no próprio Lattes';
  }
  if (isDeleteOp(op)) {
    return 'Exclusão: o Lattes não tem como desfazer; para voltar, inclua o item de novo no próprio Lattes';
  }
  // Desfazer a troca para ouvinte seria trocar a forma de ouvinte para outra,
  // que o conector ainda não faz (edit-items.ts, planShape).
  if (op.kind === 'formacao' && op.lookups) {
    return 'Instituição, curso ou agência trocados pela busca do Lattes: para voltar, escolha de novo pela busca no editor e envie';
  }
  if (op.kind === 'evento' && op.set.F_FORMA === '40' && (op.expect.F_FORMA ?? '40') !== '40') {
    return 'Voltar de ouvinte para convidado ou participante pelo conector espera o teste acompanhado; volte a forma no próprio Lattes';
  }
  return undefined;
}

/**
 * A operação que volta o Lattes ao que estava antes: grava os valores
 * esperados e espera os gravados. Os campos de identidade que não mudaram (o
 * início do vínculo) seguem como estavam. Sem o "antes" de algum campo, não
 * há como desfazer com segurança: devolve undefined.
 */
export function undoOp(entry: SentEntry): BridgeOp | undefined {
  // O que não terminou conferido pode não ter gravado nada, ou gravado
  // diferente do enviado: voltar o "antes" às cegas poderia apagar um valor
  // que já estava lá. (A atuação criada no Lattes nunca teve "antes" para
  // voltar: sai de lá excluída no próprio Lattes.)
  if (entry.id === undefined || entry.undoOf !== undefined || failed(entry)) return undefined;
  const { op } = entry;
  if (noUndoReason(op)) return undefined;
  const fields = Object.keys(op.set);
  if (fields.length === 0 || fields.some((f) => !(f in op.expect))) return undefined;
  // Nada mudou (a natureza do evento, só conferida): não há o que desfazer.
  if (fields.every((f) => op.set[f] === op.expect[f])) return undefined;
  const set = Object.fromEntries(fields.map((f) => [f, op.expect[f] ?? null]));
  const expect = { ...op.expect, ...op.set };
  return {
    ...op,
    // Palavras-chave e autores conferem e gravam pelas listas; as linhas mostram o desfazer.
    ...(isProductionOp(op)
      ? {
          authors: op.authors && { after: op.authors.before, before: op.authors.after },
          keywords: op.keywords && { after: op.keywords.before, before: op.keywords.after },
          rows: op.rows.map((r) => ({ ...r, after: r.before, before: r.after })),
        }
      : {}),
    expect,
    key: `${UNDO_KEY_PREFIX}${entry.id}`,
    label: `Desfazer: ${op.label}`,
    set,
  };
}

/**
 * ids das entradas que já foram desfeitas. Um desfazer que não terminou
 * conferido não conta: o Lattes pode continuar com o valor gravado, e a
 * entrada original precisa poder ser desfeita de novo.
 */
export function undoneIds(entries: SentEntry[]): Set<number> {
  return new Set(entries.flatMap((e) => (e.undoOf === undefined || failed(e) ? [] : [e.undoOf])));
}

export interface SentDay {
  /** Data local no formato AAAA-MM-DD. */
  day: string;
  entries: SentEntry[];
}

function localDay(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Agrupa por dia, do mais recente para o mais antigo. */
export function groupByDay(entries: SentEntry[]): SentDay[] {
  const sorted = [...entries].sort((a, b) => b.sentAt - a.sentAt);
  const days: SentDay[] = [];
  for (const entry of sorted) {
    const day = localDay(entry.sentAt);
    const last = days.at(-1);
    if (last?.day === day) last.entries.push(entry);
    else days.push({ day, entries: [entry] });
  }
  return days;
}

/** Nome do arquivo do registro em texto, com a data local (a do corpo do texto). */
export const sentLogFileName = (lattesId: string, now: number): string =>
  `registro-lattes-${lattesId}-${localDay(now)}.txt`;

const OUTCOME_TEXT: Record<Exclude<ResultStatus, 'conferido'>, string> = {
  divergente: 'não conferido',
  erro: 'não gravado',
  sessao: 'não gravado, sessão do Lattes caída',
};

const pad = (n: number) => String(n).padStart(2, '0');
const dateText = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const timeText = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * O registro em texto simples, do mais antigo ao mais recente, para anexar a
 * um recurso: o currículo, a versão do app, cada envio com data, hora e
 * resultado, e cada campo com o valor de antes e o de depois.
 */
export function sentLogText(
  entries: SentEntry[],
  { appVersion, lattesId, now }: { appVersion: string; lattesId: string; now: number },
): string {
  const lines = [
    'Registro do que o LattesEditor enviou ao Currículo Lattes',
    '',
    `Currículo: ${lattesId} (https://lattes.cnpq.br/${lattesId})`,
    `LattesEditor ${appVersion}`,
    `Gerado em ${dateText(now)} às ${timeText(now)}`,
    '',
    'As gravações feitas pelo editor ficam no Lattes como alteração pendente até',
    '"Enviar ao CNPq"; este registro foi gerado pelo editor e não pelo CNPq.',
  ];
  const sorted = [...entries].sort((a, b) => a.sentAt - b.sentAt);
  let day = '';
  for (const entry of sorted) {
    const date = dateText(entry.sentAt);
    if (date !== day) {
      day = date;
      lines.push('', date);
    }
    const checked =
      entry.checkedAt === undefined
        ? ''
        : `; conferido no Lattes pela pessoa em ${dateText(entry.checkedAt)} às ${timeText(entry.checkedAt)}`;
    const result = entry.outcome
      ? `${OUTCOME_TEXT[entry.outcome.status]}${entry.outcome.detail ? `: ${entry.outcome.detail}` : ''}${checked}`
      : entry.undoOf !== undefined
        ? 'desfeito e conferido'
        : isDeleteOp(entry.op)
          ? 'excluído e conferido'
          : 'gravado e conferido';
    lines.push(`- ${timeText(entry.sentAt)} ${entry.op.label} (${result})`);
    for (const row of entry.rows) {
      lines.push(`    ${row.label}: ${row.before || '(vazio)'} -> ${row.after || '(vazio)'}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
