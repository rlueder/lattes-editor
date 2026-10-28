import { afterEach, describe, expect, it } from 'vitest';

import { PENDING_ALERT } from '../scripts/lattes-simulado/exportar.ts';
import type { Intercept } from '../scripts/lattes-simulado/servidor.ts';
import type { SimResponse } from '../scripts/lattes-simulado/tipos.ts';
import {
  exportCv,
  exportScreenState,
  fromBase64,
  toBase64,
  zipFileName,
} from '../src/bridge/export.ts';
import { loadCv } from '../src/model/document.ts';
import { getAttr } from '../src/model/xml.ts';
import { canOpenFromLattes, failureText, retriesOnReading } from '../src/ui/lattes-open.ts';
import { faults, type LattesSimuladoNoTeste, withSmallLattes } from './helpers/lattes-simulado.ts';

const ID = '0000000000000001';

const LOGON = '<form name="login" action="pkg_sec.logon" method="post"></form>';

const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

// O Lattes do teste é o simulado (scripts/lattes-simulado/), com o currículo
// pequeno (NUMERO-IDENTIFICADOR 0000000000000001).
let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattesFor(options: Parameters<typeof withSmallLattes>[0] = {}) {
  await open?.close();
  open = await withSmallLattes(options);
  return open;
}

/** A resposta do POST do Exportar trocada por outra (HTML em Latin-1 ou bytes). */
const answer =
  (out: SimResponse): Intercept =>
  (req, _state, next) =>
    req.method === 'POST' ? out : next();

const exportedCalls = (lattes: LattesSimuladoNoTeste) =>
  lattes.state.log
    .filter((l) => /^pkg_impcv\.get_arquivo$/i.test(l.proc))
    .map((l) => ({ method: l.method, pairs: l.pairs, path: l.path }));

describe('Abrir do Lattes: o Exportar pelo conector', () => {
  it('a tela, depois o POST do "Confirmar" com XML, e o ZIP', async () => {
    const lattes = await lattesFor();
    const code = lattes.state.code;
    const r = await exportCv(lattes.exportPort, code, ID);
    if (!r.ok) throw new Error(r.reason);
    expect(r.fileName).toBe(`CV_${ID}.zip`);
    expect(r.bytes.slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));
    expect(getAttr((await loadCv(r.bytes, r.fileName)).doc.root, 'NUMERO-IDENTIFICADOR')).toBe(ID);
    expect(exportedCalls(lattes)).toEqual([
      { method: 'GET', pairs: undefined, path: `pkg_impcv.get_arquivo?f_cod=${code}` },
      {
        method: 'POST',
        pairs: [
          ['f_cod', code],
          ['f_ctr', 'G'],
          ['f_tpo_arq', '3'],
        ],
        path: 'PKG_IMPCV.get_arquivo',
      },
    ]);
  });

  it('com pendência ou sessão caída, nem tenta o POST', async () => {
    const pendente = await lattesFor();
    pendente.state.touch();
    expect(await exportCv(pendente.exportPort, pendente.state.code, ID)).toEqual({
      ok: false,
      reason: 'pendente',
    });
    expect(exportedCalls(pendente)).toEqual([
      {
        method: 'GET',
        pairs: undefined,
        path: `pkg_impcv.get_arquivo?f_cod=${pendente.state.code}`,
      },
    ]);
    const caida = await lattesFor();
    caida.state.sessionActive = false;
    expect(await exportCv(caida.exportPort, caida.state.code, ID)).toEqual({
      ok: false,
      reason: 'sessao',
    });
    expect(exportedCalls(caida)).toEqual([
      { method: 'GET', pairs: undefined, path: `pkg_impcv.get_arquivo?f_cod=${caida.state.code}` },
    ]);
  });

  it('tela que mudou, sem código, ou resposta que não é ZIP', async () => {
    const mudou = await lattesFor({
      intercept: faults.rewritePages(/^pkg_impcv\./i, () => '<p>outra</p>'),
    });
    expect(await exportCv(mudou.exportPort, mudou.state.code)).toEqual({
      detail: 'A tela do Exportar do Lattes mudou.',
      ok: false,
      reason: 'erro',
    });
    expect(await exportCv(mudou.exportPort, undefined)).toMatchObject({
      ok: false,
      reason: 'erro',
    });
    const pendingPage = `<script>alert("${PENDING_ALERT}")</script>`;
    for (const [out, expected] of [
      [{ html: LOGON }, { ok: false, reason: 'sessao' }],
      [{ html: pendingPage }, { ok: false, reason: 'pendente' }],
      [
        { html: '<p>erro</p>' },
        { detail: 'O Lattes não devolveu o arquivo da exportação.', ok: false, reason: 'erro' },
      ],
    ] as const) {
      const lattes = await lattesFor({ intercept: answer(out) });
      expect(await exportCv(lattes.exportPort, lattes.state.code)).toEqual(expected);
    }
    // Content-Type de ZIP com bytes que não são ZIP também não passa.
    const fake = await lattesFor({
      intercept: answer({ bytes: new Uint8Array([1, 2, 3, 4, 5]), contentType: 'application/zip' }),
    });
    expect(await exportCv(fake.exportPort, fake.state.code)).toMatchObject({ reason: 'erro' });
  });

  it('estado da tela do Exportar', async () => {
    const lattes = await lattesFor();
    const path = `pkg_impcv.get_arquivo?f_cod=${lattes.state.code}`;
    const screen = await lattes.port.get(path);
    expect(exportScreenState(screen)).toBe('ok');
    expect(exportScreenState(screen.replace('value="3"', 'value="2"'))).toBe('mudou');
    expect(exportScreenState(screen, 'https://x/pkg_sec.logon')).toBe('sessao');
    lattes.state.touch();
    expect(exportScreenState(await lattes.port.get(path))).toBe('pendente');
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
      'Não deu para ler o currículo no Lattes (A tela do Exportar do Lattes mudou). Tente de novo, ou abra o arquivo exportado.',
    );
  });
});
