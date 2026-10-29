// A lista do Histórico (src/ui/history-timeline.ts): as quatro fontes viram
// uma linha por acontecimento, do mais recente ao mais antigo, por dia.

import { describe, expect, it } from 'vitest';

import type { BackupFile } from '../src/model/backups.ts';
import type { HistoryInfo } from '../src/model/store.ts';
import {
  buildTimeline,
  dayKey,
  dayLabel,
  NOTES,
  type SentInfo,
  type TimelineEntry,
} from '../src/ui/history-timeline.ts';

const at = (iso: string) => new Date(iso).getTime();
const NOW = at('2026-10-29T18:00:00');
const MIN = 60_000;

let ids = 0;
const point = (iso: string, note: string, keep = false): HistoryInfo => ({
  id: ++ids,
  keep,
  note,
  savedAt: at(iso),
});
const backup = (
  iso: string,
  kind: BackupFile['kind'],
  name = `${kind}-${iso}.zip`,
): BackupFile => ({
  kind,
  name,
  savedAt: at(iso),
  size: 100,
});
const sent = (iso: string, failed = false, undoOf?: number): SentInfo => ({
  failed,
  sentAt: at(iso),
  ...(undoOf === undefined ? {} : { undoOf }),
});

const flat = (days: ReturnType<typeof buildTimeline>): TimelineEntry[] =>
  days.flatMap((d) => d.entries);

describe('o dia de cada linha', () => {
  it('hoje, ontem e a data', () => {
    expect(dayKey(NOW)).toBe('2026-10-29');
    expect(dayLabel('2026-10-29', NOW)).toBe('Hoje');
    expect(dayLabel('2026-10-28', NOW)).toBe('Ontem');
    expect(dayLabel('2026-10-01', NOW)).toBe('01/10/2026');
  });
});

describe('o Histórico', () => {
  it('sem nada guardado, lista vazia', () => {
    expect(buildTimeline({ backups: [], points: [], sent: [], versions: [] }, NOW)).toEqual([]);
  });

  it('edições com a nota, a publicação sem ação, do mais recente ao mais antigo e por dia', () => {
    const a = point('2026-10-28T10:00:00', 'Item editado: Artigo A');
    const b = point('2026-10-29T09:00:00', 'Novo item: Livro B');
    const c = point('2026-10-29T11:00:00', NOTES.publicado);
    const days = buildTimeline({ backups: [], points: [a, b, c], sent: [], versions: [] }, NOW);
    expect(days.map((d) => d.label)).toEqual(['Hoje', 'Ontem']);
    expect(days[0]!.entries).toEqual([
      { at: c.savedAt, kind: 'publicacao', text: 'Publicado no CNPq' },
      { at: b.savedAt, kind: 'edicao', pointId: b.id, text: 'Novo item: Livro B' },
    ]);
    expect(days[1]!.entries[0]).toMatchObject({ kind: 'edicao', pointId: a.id });
  });

  it('o envio: o estado de antes, a cópia em arquivo e as gravações viram uma linha', () => {
    const before = point('2026-10-29T14:05:00', NOTES.antesDoEnvio, true);
    const file = backup('2026-10-29T14:04:30', 'restauracao');
    const entries = flat(
      buildTimeline(
        {
          backups: [file],
          points: [before],
          sent: [
            sent('2026-10-29T14:05:10'),
            sent('2026-10-29T14:05:20'),
            sent('2026-10-29T14:06:00', true),
          ],
          versions: [],
        },
        NOW,
      ),
    );
    expect(entries).toEqual([
      {
        at: before.savedAt,
        backup: file,
        kind: 'envio',
        pointId: before.id,
        sent: { failed: 1, total: 3 },
        text: 'Enviado ao Lattes: 2 alterações, 1 não conferida',
      },
    ]);
  });

  it('cada gravação vai para o envio mais recente antes dela', () => {
    const first = point('2026-10-29T10:00:00', NOTES.antesDoEnvio, true);
    const undo = point('2026-10-29T10:20:00', NOTES.antesDeDesfazer, true);
    const entries = flat(
      buildTimeline(
        {
          backups: [],
          points: [first, undo],
          sent: [sent('2026-10-29T10:01:00'), sent('2026-10-29T10:21:00', false, 1)],
          versions: [],
        },
        NOW,
      ),
    );
    expect(entries.map((e) => e.text)).toEqual([
      'Desfeito no Lattes: 1 alteração',
      'Enviado ao Lattes: 1 alteração',
    ]);
  });

  it('um envio que não gravou nada diz isso', () => {
    const before = point('2026-10-29T10:00:00', NOTES.antesDoEnvio, true);
    expect(
      flat(buildTimeline({ backups: [], points: [before], sent: [], versions: [] }, NOW))[0]!.text,
    ).toBe('Enviado ao Lattes: nada gravado');
  });

  it('a cópia em arquivo sem o estado continua aparecendo, só com o arquivo', () => {
    const file = backup('2026-10-20T09:00:00', 'restauracao');
    const entries = flat(
      buildTimeline(
        { backups: [file], points: [], sent: [sent('2026-10-20T09:01:00')], versions: [] },
        NOW,
      ),
    );
    expect(entries).toEqual([
      {
        at: file.savedAt,
        backup: file,
        kind: 'envio',
        sent: { failed: 0, total: 1 },
        text: 'Enviado ao Lattes: 1 alteração',
      },
    ]);
  });

  it('gravações sem estado nem arquivo se juntam por proximidade', () => {
    const entries = flat(
      buildTimeline(
        {
          backups: [],
          points: [],
          sent: [
            sent('2026-10-10T09:00:00', false, 7),
            sent('2026-10-10T09:10:00', false, 8),
            sent('2026-10-12T15:00:00'),
          ],
          versions: [],
        },
        NOW,
      ),
    );
    expect(entries.map((e) => [e.text, e.sent?.total])).toEqual([
      ['Enviado ao Lattes: 1 alteração', 1],
      ['Desfeito no Lattes: 2 alterações', 2],
    ]);
  });

  it('a primeira abertura junta o estado, a exportação e o ponto zero', () => {
    const opened = point('2026-10-28T08:00:00', NOTES.aberto);
    const zero = backup('2026-10-28T08:00:05', 'ponto-zero');
    const entries = flat(
      buildTimeline(
        {
          backups: [zero],
          points: [opened],
          sent: [],
          versions: [
            {
              exportedAt: '28102026 075900',
              id: 3,
              lattesId: '1',
              loadedAt: at('2026-10-28T08:00:00') + 200,
            },
          ],
        },
        NOW,
      ),
    );
    expect(entries).toEqual([
      {
        at: opened.savedAt,
        backup: zero,
        current: true,
        kind: 'abertura',
        pointId: opened.id,
        text: 'Primeira abertura: exportação de 28/10/2026 (ponto zero)',
        versionId: 3,
      },
    ]);
  });

  it('a recarga: "o de antes" é a cópia de trabalho anterior, e compara com a exportação anterior', () => {
    const first = {
      exportedAt: '20102026',
      id: 1,
      lattesId: '1',
      loadedAt: at('2026-10-20T08:00:00'),
    };
    const reloadAt = at('2026-10-29T12:00:00');
    const prior = {
      ...point('2026-10-29T12:00:00', NOTES.antesDeRecarregar, true),
      savedAt: reloadAt - 1,
    };
    const opened = { ...point('2026-10-29T12:00:00', NOTES.aberto), savedAt: reloadAt };
    const second = { id: 2, lattesId: '1', loadedAt: reloadAt + 300 };
    const entries = flat(
      buildTimeline(
        { backups: [], points: [prior, opened], sent: [], versions: [second, first] },
        NOW,
      ),
    );
    expect(entries[0]).toEqual({
      at: reloadAt,
      kind: 'recarga',
      pointId: prior.id,
      previousVersionId: 1,
      text: 'Recarregado do Lattes',
      versionId: 2,
    });
    expect(entries[1]).toMatchObject({
      kind: 'abertura',
      text: 'Primeira abertura: exportação de 20/10/2026',
      versionId: 1,
    });
    expect(entries[1]).not.toHaveProperty('pointId');
  });

  it('outra abertura depois da primeira, e o ponto zero longe de qualquer abertura', () => {
    const versions = [
      { exportedAt: '01102026', id: 1, lattesId: '1', loadedAt: at('2026-10-01T08:00:00') },
      { id: 2, lattesId: '1', loadedAt: at('2026-10-05T08:00:00') },
    ];
    const zero = backup('2026-09-01T08:00:00', 'ponto-zero');
    const entries = flat(buildTimeline({ backups: [zero], points: [], sent: [], versions }, NOW));
    expect(entries.map((e) => e.text)).toEqual([
      'Aberto: currículo do Lattes',
      'Primeira abertura: exportação de 01/10/2026',
      'Ponto zero: a primeira exportação deste currículo',
    ]);
    expect(entries[0]!.previousVersionId).toBe(1);
    expect(entries[2]!.backup).toBe(zero);
  });

  it('estados de abertura e de recarga sem exportação guardada ficam como estão', () => {
    const opened = point('2026-10-29T08:00:00', NOTES.aberto);
    const prior = point('2026-10-29T07:00:00', NOTES.antesDeRecarregar, true);
    const entries = flat(
      buildTimeline({ backups: [], points: [opened, prior], sent: [], versions: [] }, NOW),
    );
    expect(entries.map((e) => [e.kind, e.text, e.pointId])).toEqual([
      ['abertura', 'Arquivo aberto', opened.id],
      ['abertura', NOTES.antesDeRecarregar, prior.id],
    ]);
  });

  it('o estado de antes de restaurar o ponto zero é uma edição que se pode restaurar', () => {
    const p = point('2026-10-29T09:00:00', NOTES.antesDoPontoZero, true);
    expect(flat(buildTimeline({ backups: [], points: [p], sent: [], versions: [] }, NOW))).toEqual([
      { at: p.savedAt, kind: 'edicao', pointId: p.id, text: NOTES.antesDoPontoZero },
    ]);
  });

  it('o estado atual é o mais recente que não é um "de antes", e só ele', () => {
    const edit = point('2026-10-29T10:00:00', 'Item editado: A');
    const later = point('2026-10-29T11:00:00', 'Item editado: B');
    const beforeSend = point('2026-10-29T12:00:00', NOTES.antesDoEnvio, true);
    const entries = flat(
      buildTimeline(
        { backups: [], points: [edit, later, beforeSend], sent: [], versions: [] },
        NOW,
      ),
    );
    expect(entries.filter((e) => e.current).map((e) => e.text)).toEqual(['Item editado: B']);
    expect(entries.find((e) => e.kind === 'envio')?.current).toBeUndefined();
    // Só estados "de antes": nenhum é o atual.
    const only = flat(
      buildTimeline({ backups: [], points: [beforeSend], sent: [], versions: [] }, NOW),
    );
    expect(only.some((e) => e.current)).toBe(false);
  });

  it('não mexe nas listas recebidas', () => {
    const points = [point('2026-10-29T09:00:00', NOTES.antesDoEnvio, true)];
    const backups = [backup('2026-10-29T08:59:00', 'restauracao')];
    buildTimeline({ backups, points, sent: [], versions: [] }, NOW);
    expect(points).toHaveLength(1);
    expect(backups).toHaveLength(1);
  });

  it('sem id, a linha fica sem as ações que dependem dele', () => {
    const p: HistoryInfo = { note: 'Item editado: X', savedAt: NOW - MIN };
    const before: HistoryInfo = { note: NOTES.antesDoEnvio, savedAt: NOW - 2 * MIN };
    const entries = flat(
      buildTimeline({ backups: [], points: [p, before], sent: [], versions: [] }, NOW),
    );
    expect(entries.every((e) => e.pointId === undefined)).toBe(true);
  });
});
