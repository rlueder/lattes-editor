import { describe, expect, it } from 'vitest';

import {
  exportCv,
  type ExportPort,
  exportScreenState,
  fromBase64,
  toBase64,
  zipFileName,
} from '../src/bridge/export.ts';
import { canOpenFromLattes, failureText, retriesOnReading } from '../src/ui/lattes-open.ts';

const CODE = 'K000000000';
const ID = '0000000000000001';

/** A tela do Exportar como o Lattes mostrou em 13/10/2026, sem o que não importa. */
const SCREEN = `<form name="PKG_IMP" action="PKG_IMPCV.get_arquivo" method="post">
  <input type="radio" name="f_tpo_arq" value="1" checked> RTF
  <input type="radio" name="f_tpo_arq" value="3"> XML
  <input type="hidden" name="f_cod" value="${CODE}"><input type="hidden" name="f_ctr" value="">
  <a href="#" onclick="check();return false;">Confirmar</a></form>`;

const PENDING = `${SCREEN}<script>alert("Existem alterações realizadas no currículo que só serão aceitas quando enviadas ao CNPq em definitivo")</script>`;

const LOGON = '<form name="login" action="pkg_sec.logon" method="post"></form>';

const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

function fakeLattes(opts: {
  screen?: string;
  answer?: { bytes: Uint8Array; contentType: string; disposition?: string };
}) {
  const calls: { body?: string; method: string; path: string }[] = [];
  const port: ExportPort = {
    get(path) {
      calls.push({ method: 'GET', path });
      return Promise.resolve({ html: opts.screen ?? SCREEN, url: `https://x/${path}` });
    },
    postForBytes(path, body) {
      calls.push({ body, method: 'POST', path });
      const a = opts.answer ?? {
        bytes: ZIP,
        contentType: 'application/zip',
        disposition: `attachment; filename="CV_${ID}.zip"`,
      };
      return Promise.resolve({ ...a, disposition: a.disposition ?? '', url: `https://x/${path}` });
    },
  };
  return { calls, port };
}

describe('Abrir do Lattes: o Exportar pela ponte', () => {
  it('a tela, depois o POST do "Confirmar" com XML, e o ZIP', async () => {
    const { calls, port } = fakeLattes({});
    const r = await exportCv(port, CODE, ID);
    expect(r).toEqual({ bytes: ZIP, fileName: `CV_${ID}.zip`, ok: true });
    expect(calls).toEqual([
      { method: 'GET', path: `pkg_impcv.get_arquivo?f_cod=${CODE}` },
      {
        body: `f_cod=${CODE}&f_ctr=G&f_tpo_arq=3`,
        method: 'POST',
        path: 'PKG_IMPCV.get_arquivo',
      },
    ]);
  });

  it('com pendência ou sessão caída, nem tenta o POST', async () => {
    for (const [screen, reason] of [
      [PENDING, 'pendente'],
      [LOGON, 'sessao'],
    ] as const) {
      const { calls, port } = fakeLattes({ screen });
      expect(await exportCv(port, CODE, ID)).toEqual({ ok: false, reason });
      expect(calls).toHaveLength(1);
    }
  });

  it('tela que mudou, sem código, ou resposta que não é ZIP', async () => {
    expect(await exportCv(fakeLattes({ screen: '<p>outra</p>' }).port, CODE)).toEqual({
      detail: 'A tela do Exportar do Lattes mudou.',
      ok: false,
      reason: 'erro',
    });
    expect(await exportCv(fakeLattes({}).port, undefined)).toMatchObject({
      ok: false,
      reason: 'erro',
    });
    // O Lattes responde em Latin-1.
    const html = (s: string) => ({
      bytes: Uint8Array.from(s, (c) => c.charCodeAt(0)),
      contentType: 'text/html',
    });
    expect(await exportCv(fakeLattes({ answer: html(LOGON) }).port, CODE)).toEqual({
      ok: false,
      reason: 'sessao',
    });
    expect(await exportCv(fakeLattes({ answer: html(PENDING) }).port, CODE)).toEqual({
      ok: false,
      reason: 'pendente',
    });
    expect(await exportCv(fakeLattes({ answer: html('<p>erro</p>') }).port, CODE)).toEqual({
      detail: 'O Lattes não devolveu o arquivo da exportação.',
      ok: false,
      reason: 'erro',
    });
    // Content-Type de ZIP com bytes que não são ZIP também não passa.
    const fake = { bytes: new Uint8Array([1, 2, 3, 4, 5]), contentType: 'application/zip' };
    expect(await exportCv(fakeLattes({ answer: fake }).port, CODE)).toMatchObject({
      reason: 'erro',
    });
  });

  it('estado da tela do Exportar', () => {
    expect(exportScreenState(SCREEN)).toBe('ok');
    expect(exportScreenState(SCREEN.replace('value="3"', 'value="2"'))).toBe('mudou');
    expect(exportScreenState(SCREEN, 'https://x/pkg_sec.logon')).toBe('sessao');
    expect(exportScreenState(PENDING)).toBe('pendente');
  });

  it('nome do arquivo', () => {
    expect(zipFileName(`attachment; filename="CV_${ID}.zip"`)).toBe(`CV_${ID}.zip`);
    expect(zipFileName(`attachment; filename=CV_${ID}.zip`)).toBe(`CV_${ID}.zip`);
    expect(zipFileName('attachment; filename="../x.exe"', ID)).toBe(`CV_${ID}.zip`);
    expect(zipFileName('')).toBe('curriculo-lattes.zip');
  });

  it('base64 de ida e volta, inclusive maior que um bloco', () => {
    const big = new Uint8Array(100_000).map((_, i) => i % 256);
    expect(fromBase64(toBase64(big))).toEqual(big);
    expect(toBase64(ZIP)).toBe('UEsDBBQA');
  });
});

describe('Abrir do Lattes na tela inicial', () => {
  it('só com a extensão que sabe exportar', () => {
    expect(canOpenFromLattes({ state: { kind: 'sem-extensao' } })).toBe(false);
    expect(
      canOpenFromLattes({ features: ['estado-lattes'], state: { kind: 'lendo', version: '1' } }),
    ).toBe(false);
    expect(
      canOpenFromLattes({ features: ['curriculo'], state: { kind: 'lendo', version: '1' } }),
    ).toBe(true);
  });

  it('tenta de novo sozinho só no que se resolve no Lattes', () => {
    expect(['consentimento', 'sem-aba', 'sessao'].every((r) => retriesOnReading(r as never))).toBe(
      true,
    );
    expect(['pendente', 'erro', 'sem-resposta'].some((r) => retriesOnReading(r as never))).toBe(
      false,
    );
  });

  it('cada falha diz o que fazer', () => {
    for (const r of [
      'consentimento',
      'sem-aba',
      'sessao',
      'pendente',
      'sem-resposta',
      'erro',
    ] as const) {
      expect(failureText(r).length).toBeGreaterThan(30);
    }
    expect(failureText('erro', 'A tela do Exportar do Lattes mudou.')).toBe(
      'Não deu para exportar do Lattes (A tela do Exportar do Lattes mudou). Tente de novo, ou abra o arquivo exportado.',
    );
  });
});
