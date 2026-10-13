// A faixa de estados do cabeçalho (LAT-40): o caminho de uma alteração, de
// original a publicada, com a contagem do que está em cada passo. Ver
// docs/fluxos_de_uso.md, "O caminho de uma alteração".

import type { LattesStatus } from '../bridge/lattes-status.ts';
import type { SentEntry } from '../bridge/sent-log.ts';

export interface StripInput {
  /** Itens novos e alterações do editor que ainda não foram ao Lattes. */
  editorChanges: number;
  /** O que a extensão leu do menu do Lattes; undefined sem extensão ou sem sessão. */
  lattes?: LattesStatus;
  /** O registro do enviado deste currículo. */
  sent: SentEntry[];
}

export type StripSegment =
  | { count: number; kind: 'alteracoes' }
  | { count: number; kind: 'no-lattes' }
  | { date: string; kind: 'publicado' }
  | { kind: 'original' }
  | { kind: 'pendencia-desconhecida' };

export interface StripState {
  /** O passo que pede ação agora, para destacar. */
  action?: 'alteracoes' | 'no-lattes' | 'pendencia-desconhecida';
  segments: StripSegment[];
}

/** Início do dia (hora local) de uma data AAAA-MM-DD. */
function dayStart(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!).getTime();
}

/**
 * Quantas gravações da ponte ainda esperam "Enviar ao CNPq". Regra:
 * - se o Lattes diz que não há pendência, nenhuma;
 * - senão, as enviadas desde o dia da última publicação (todas, sem data
 *   conhecida), porque a data do Lattes não tem hora;
 * - um par gravado e desfeito dentro dessa janela se anula e não conta. Só o
 *   desfazer dentro da janela, de algo já publicado, conta: é uma mudança
 *   nova no Lattes.
 */
export function unpublishedSent(sent: SentEntry[], lattes?: LattesStatus): number {
  if (lattes && !lattes.pending) return 0;
  const since = lattes?.lastPublished ? dayStart(lattes.lastPublished) : -Infinity;
  const window = sent.filter((e) => e.sentAt >= since);
  const ids = new Set(window.map((e) => e.id));
  const cancelled = new Set(
    window.flatMap((e) => (e.undoOf !== undefined && ids.has(e.undoOf) ? [e.undoOf, e.id] : [])),
  );
  return window.filter((e) => !cancelled.has(e.id)).length;
}

/** DD/MM/AAAA de uma data AAAA-MM-DD. */
export function dateLabel(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

export function statusStrip({ editorChanges, lattes, sent }: StripInput): StripState {
  const inLattes = unpublishedSent(sent, lattes);
  const unknown = Boolean(lattes?.pending) && inLattes === 0;
  const counts: StripSegment[] = [
    ...(editorChanges > 0 ? [{ count: editorChanges, kind: 'alteracoes' as const }] : []),
    ...(inLattes > 0 ? [{ count: inLattes, kind: 'no-lattes' as const }] : []),
    ...(unknown ? [{ kind: 'pendencia-desconhecida' as const }] : []),
  ];
  const published: StripSegment[] = lattes?.lastPublished
    ? [{ date: lattes.lastPublished, kind: 'publicado' }]
    : [];
  // O que está no Lattes sem publicar vem antes: lá não há como descartar.
  const action =
    inLattes > 0
      ? 'no-lattes'
      : unknown
        ? 'pendencia-desconhecida'
        : editorChanges > 0
          ? 'alteracoes'
          : undefined;
  return {
    action,
    segments: counts.length ? [{ kind: 'original' }, ...counts, ...published] : published,
  };
}

export function segmentLabel(segment: StripSegment): string {
  switch (segment.kind) {
    case 'alteracoes':
      return segment.count === 1 ? '1 alteração' : `${segment.count} alterações`;
    case 'no-lattes':
      return `${segment.count} no Lattes`;
    case 'original':
      return 'Original';
    case 'pendencia-desconhecida':
      return 'pendências que o editor não conhece';
    case 'publicado':
      return `publicado em ${dateLabel(segment.date)}`;
  }
}
