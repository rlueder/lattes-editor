import { describe, expect, it } from 'vitest';

import { toBase64 } from '../src/bridge/export.ts';
import { decodeLatin1 } from '../src/model/latin1.ts';
import type { OpenFailure } from '../src/ui/lattes-open.ts';
import {
  reloadFailureText,
  reloadNotice,
  reloadPlan,
  reloadReply,
  versionBytes,
} from '../src/ui/lattes-reload.ts';
import { noticesFor, staleExportNotice } from '../src/ui/notifications.ts';

const ID = '0000000000000001';

describe('Recarregar do Lattes pela ponte (LAT-46)', () => {
  it('o ZIP do currículo aberto vira o arquivo do recarregar', async () => {
    const zip = toBase64(new Uint8Array([0x50, 0x4b, 3, 4, 5]));
    const out = reloadReply({ at: 1, fileName: `CV_${ID}.zip`, id: 'a', lattesId: ID, zip }, ID);
    expect('file' in out && out.file.name).toBe(`CV_${ID}.zip`);
    expect('file' in out && new Uint8Array(await out.file.arrayBuffer())[0]).toBe(0x50);
    const unnamed = reloadReply({ at: 1, id: 'a', lattesId: ID, zip }, ID);
    expect('file' in unnamed && unnamed.file.name).toBe('curriculo-lattes.zip');
  });

  it('a sessão de outro currículo, ou sem saber de quem é, não recarrega por cima', () => {
    const zip = toBase64(new Uint8Array([0x50, 0x4b]));
    expect(reloadReply({ at: 1, id: 'a', lattesId: '9999999999999999', zip }, ID)).toEqual({
      failure: { reason: 'outro-cv' },
    });
    expect(reloadReply({ at: 1, id: 'a', zip }, ID)).toEqual({ failure: { reason: 'outro-cv' } });
  });

  it('falhas: o motivo da extensão, ou o arquivo corrompido no caminho', () => {
    expect(reloadReply({ at: 1, id: 'a', reason: 'pendente' }, ID)).toEqual({
      failure: { detail: undefined, reason: 'pendente' },
    });
    expect(reloadReply({ at: 1, detail: 'x', id: 'a' }, ID)).toEqual({
      failure: { detail: 'x', reason: 'erro' },
    });
    expect(reloadReply({ at: 1, id: 'a', lattesId: ID, zip: '%%%' }, ID)).toEqual({
      failure: { detail: 'O arquivo chegou corrompido', reason: 'erro' },
    });
  });

  it('cada falha tem o que dizer, e a do Exportar bloqueado pede o envio ao CNPq', () => {
    const reasons: (OpenFailure | 'outro-cv')[] = [
      'outro-cv',
      'pendente',
      'consentimento',
      'sem-aba',
      'sessao',
      'sem-resposta',
      'erro',
    ];
    for (const reason of reasons) expect(reloadFailureText({ reason })).toBeTruthy();
    expect(reloadFailureText({ reason: 'pendente' })).toMatch(/Envie ao CNPq/);
    expect(reloadFailureText({ detail: 'A tela mudou.', reason: 'erro' })).toMatch(
      /\(A tela mudou\)/,
    );
  });

  it('a falha vai ao sino, primeiro, e clicada pede o arquivo', () => {
    const notice = reloadNotice({ reason: 'sem-aba' });
    expect(notice).toMatchObject({
      action: 'recarregar-arquivo',
      id: 'recarregar',
      level: 'aviso',
    });
    const notices = noticesFor({
      appVersion: '1.0.0',
      reload: notice,
      storage: 'cifrado',
      unknownPending: true,
    });
    expect(notices.map((n) => n.id)).toEqual(['recarregar', 'pendencia-desconhecida']);
    expect(noticesFor({ appVersion: '1.0.0', storage: 'cifrado' })).toEqual([]);
  });

  it('a versão guardada volta a bytes como veio: Latin-1 quando o prólogo diz', () => {
    const latin = '<?xml version="1.0" encoding="ISO-8859-1"?><CURRICULO-VITAE A="Ação"/>';
    const bytes = versionBytes(latin);
    expect(bytes.length).toBe(latin.length);
    expect(decodeLatin1(bytes)).toBe(latin);
    const utf = '<?xml version="1.0" encoding="UTF-8"?><CURRICULO-VITAE A="Ação"/>';
    expect(new TextDecoder().decode(versionBytes(utf))).toBe(utf);
    expect(versionBytes('<CURRICULO-VITAE/>').length).toBe(18);
  });

  it('recarregar pergunta antes quando há trabalho que não foi ao Lattes', () => {
    const base = { currentXml: '<a/>', newItems: 0, openChanges: 0, originalXml: '<a/>' };
    expect(reloadPlan(base)).toEqual({ confirm: false, previous: undefined });
    expect(reloadPlan({ ...base, newItems: 1 }).confirm).toBe(true);
    expect(reloadPlan({ ...base, openChanges: 2 }).confirm).toBe(true);
    // Editado sem nada na lista (um campo que o editor não planeja): também pergunta,
    // e a cópia de agora vai para o histórico.
    const edited = reloadPlan({ ...base, currentXml: '<a b="1"/>' });
    expect(edited.confirm).toBe(true);
    expect(edited.previous).toEqual({
      note: 'Cópia de trabalho antes de recarregar do Lattes',
      xml: '<a b="1"/>',
    });
  });
});

describe('exportação anterior à última publicação (27/10/2026)', () => {
  it('avisa quando o Lattes publicou depois da data do arquivo aberto', () => {
    const notice = staleExportNotice('22102026', '2026-10-27');
    expect(notice).toMatchObject({ id: 'exportacao-atrasada', level: 'aviso' });
    expect(notice?.text).toMatch(
      /publicou em 27\/10\/2026, mas ainda exporta o arquivo de 22\/10\/2026/,
    );
    const all = noticesFor({ appVersion: '1.0.0', stale: notice, storage: 'cifrado' });
    expect(all.map((n) => n.id)).toContain('exportacao-atrasada');
  });

  it('sem aviso com o arquivo do mesmo dia ou mais novo, ou sem leitura do menu', () => {
    expect(staleExportNotice('27102026', '2026-10-27')).toBeUndefined();
    expect(staleExportNotice('28102026', '2026-10-27')).toBeUndefined();
    expect(staleExportNotice('22102026', undefined)).toBeUndefined();
    expect(staleExportNotice(undefined, '2026-10-27')).toBeUndefined();
  });
});
