import { describe, expect, it } from 'vitest';

import { lattesStatusFrom } from '../src/bridge/lattes-status.ts';
import type { BridgeOp } from '../src/bridge/plan.ts';
import { type SentEntry, sentEntry } from '../src/bridge/sent-log.ts';
import {
  dateLabel,
  segmentLabel,
  statusStrip,
  unpublishedEntries,
  unpublishedSent,
} from '../src/ui/status-strip.ts';

const op: BridgeOp = {
  expect: { F_TEXTO: 'a' },
  key: 'r',
  kind: 'resumo',
  label: 'Resumo',
  set: { F_TEXTO: 'b' },
};

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

const entry = (id: number, sentAt: number, undoOf?: number): SentEntry => ({
  ...sentEntry(op, '0000000000000001', sentAt, { undoOf }),
  id,
});

describe('estado do Lattes no menu', () => {
  it('lê a data da última publicação e o aviso de pendência', () => {
    const html = `<div class="infoCv"><span>Última atualização: <b>11/10/2026</b></span>
      <span>&Uacute;ltima publica&ccedil;&atilde;o: <b>17/08/2026</b></span></div>
      <ul class="avisos"><li><a href="javascript:void(0)"
        onclick="parent.modalCV1.setarUrl('pkg_publicar.mostrar_cv?f_cod=K000000000',true)">
        Existem altera&ccedil;&otilde;es realizadas em seu curr&iacute;culo que ainda n&atilde;o foram enviadas ao CNPq</a></li></ul>
      <script>var aviso = "ainda não foram enviadas ao CNPq";</script>`;
    expect(lattesStatusFrom(html)).toEqual({ lastPublished: '2026-08-17', pending: true });
  });

  it('sem aviso não há pendência; sem data, ela fica em aberto', () => {
    expect(lattesStatusFrom('<p>Última publicação: 01/02/2025</p>')).toEqual({
      lastPublished: '2025-02-01',
      pending: false,
    });
    // Texto só dentro de script não conta como aviso.
    expect(
      lattesStatusFrom(
        '<p>Última publicação: 01/02/2025</p><script>"ainda não foram enviadas ao CNPq"</script>',
      ),
    ).toEqual({ lastPublished: '2025-02-01', pending: false });
    // Página que não é o menu (formulário, login): nenhuma leitura.
    expect(lattesStatusFrom('<form name="RES"><textarea name="F_TEXTO"></textarea></form>')).toBe(
      undefined,
    );
  });
});

describe('o que espera "Enviar ao CNPq"', () => {
  const published = '2026-08-17';

  it('conta o enviado desde o dia da publicação, quando o Lattes tem pendência', () => {
    const sent = [
      entry(1, at(2026, 8, 10)),
      entry(2, at(2026, 8, 17, 9)),
      entry(3, at(2026, 10, 12)),
    ];
    expect(unpublishedSent(sent, { lastPublished: published, pending: true })).toBe(2);
    // As mesmas, para o envio ao CNPq mostrar quais são.
    expect(
      unpublishedEntries(sent, { lastPublished: published, pending: true }).map((e) => e.id),
    ).toEqual([2, 3]);
    expect(unpublishedEntries(sent)).toEqual([]);
  });

  it('sem pendência no Lattes, só o gravado depois da leitura, que ela não viu', () => {
    const readAt = at(2026, 10, 12, 12);
    const lattes = { lastPublished: published, pending: false, readAt };
    expect(unpublishedSent([entry(1, at(2026, 10, 12, 9))], lattes)).toBe(0);
    expect(
      unpublishedSent([entry(1, at(2026, 10, 12, 9)), entry(2, at(2026, 10, 12, 13))], lattes),
    ).toBe(1);
    expect(
      unpublishedSent([entry(1, at(2026, 10, 12))], { lastPublished: published, pending: false }),
    ).toBe(0);
  });

  it('sem leitura do Lattes, não afirma nada', () => {
    expect(unpublishedSent([entry(1, at(2020, 1, 1)), entry(2, at(2026, 10, 12))])).toBe(0);
  });

  it('gravado e desfeito na mesma janela se anulam; desfazer de algo publicado conta', () => {
    const lattes = { lastPublished: published, pending: true };
    expect(
      unpublishedSent([entry(1, at(2026, 10, 12)), entry(2, at(2026, 10, 12, 13), 1)], lattes),
    ).toBe(0);
    expect(unpublishedSent([entry(1, at(2026, 8, 1)), entry(2, at(2026, 10, 12), 1)], lattes)).toBe(
      1,
    );
  });
});

describe('faixa de estados no cabeçalho', () => {
  const lattes = { lastPublished: '2026-08-17', pending: true };

  it('original, alterações, no Lattes e publicação, com o Lattes em destaque', () => {
    const state = statusStrip({ editorChanges: 5, lattes, sent: [entry(1, at(2026, 10, 12))] });
    expect(state.segments.map(segmentLabel)).toEqual([
      'Original',
      '5 alterações',
      '1 no Lattes',
      'publicado em 17/08/2026',
    ]);
    expect(state.action).toBe('no-lattes');
  });

  it('pendência no Lattes que o editor não gravou', () => {
    const state = statusStrip({ editorChanges: 1, lattes, sent: [] });
    expect(state.segments.map(segmentLabel)).toEqual([
      'Original',
      '1 alteração',
      'pendências que o editor não conhece',
      'publicado em 17/08/2026',
    ]);
    expect(state.action).toBe('pendencia-desconhecida');
  });

  it('sem nada pendente, só a data da publicação; sem extensão, só as alterações', () => {
    const clean = statusStrip({
      editorChanges: 0,
      lattes: { lastPublished: '2026-08-17', pending: false },
      sent: [entry(1, at(2026, 10, 12))],
    });
    expect(clean).toEqual({
      action: undefined,
      segments: [{ date: '2026-08-17', kind: 'publicado' }],
    });

    const noExtension = statusStrip({ editorChanges: 2, sent: [] });
    expect(noExtension.segments.map(segmentLabel)).toEqual(['Original', '2 alterações']);
    expect(noExtension.action).toBe('alteracoes');

    expect(statusStrip({ editorChanges: 0, sent: [] }).segments).toEqual([]);
    expect(dateLabel('2026-01-02')).toBe('02/01/2026');
  });
});
