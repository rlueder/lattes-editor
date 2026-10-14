import { afterEach, describe, expect, it } from 'vitest';

import type { Intercept } from '../scripts/lattes-simulado/servidor.ts';
import {
  isJpeg,
  PHOTO_MAX_BYTES,
  photoBusy,
  photoFailureMessage,
  photoProblem,
  photoScreenState,
  uploadPhoto,
  uploadReply,
} from '../src/bridge/photo.ts';
import { centerSquare, fitUnderLimit } from '../src/ui/photo-image.ts';
import { faults, type LattesSimuladoNoTeste, withSmallLattes } from './helpers/lattes-simulado.ts';

const jpeg = (n: number, fill = 1) => {
  const bytes = new Uint8Array(n).fill(fill);
  bytes.set([0xff, 0xd8, 0xff], 0);
  return bytes;
};

// O Lattes do teste é o simulado (scripts/lattes-simulado/): a tela de envio,
// a foto atual e o POST multipart que a troca.
let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattesFor(options: Parameters<typeof withSmallLattes>[0] = {}) {
  await open?.close();
  open = await withSmallLattes(options);
  open.state.photo = jpeg(500, 7);
  return open;
}

/** O que o conector pediu ao Lattes, na ordem. */
const calls = (lattes: LattesSimuladoNoTeste) =>
  lattes.state.log.map((l) =>
    l.method === 'GET' ? `GET ${l.path.split('&ts=')[0]}` : `POST ${l.proc}`,
  );

/** A resposta do envio trocada, sem guardar a foto. */
const reply =
  (html: string): Intercept =>
  (req, _state, next) =>
    req.method === 'POST' ? { contentType: 'application/json', html } : next();

const screenOf = async (lattes: LattesSimuladoNoTeste) =>
  lattes.port.get(`prc_upload_foto?f_cod=${lattes.state.code}&f_ret=MENU`);

describe('foto: o arquivo', () => {
  it('só JPEG de até 70 kB', () => {
    expect(isJpeg(jpeg(10))).toBe(true);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(photoProblem(jpeg(PHOTO_MAX_BYTES))).toBeUndefined();
    expect(photoProblem(jpeg(PHOTO_MAX_BYTES + 1))).toMatch(/70 kB/);
    expect(photoProblem(new Uint8Array([1, 2, 3, 4]))).toMatch(/JPEG/);
  });

  it('a tela de envio: formulário como lido, sessão caída ou outra tela', async () => {
    const screen = await screenOf(await lattesFor());
    expect(photoScreenState(screen)).toBe('ok');
    expect(photoScreenState(screen.replace('name="f_ctr"', 'name="outro"'))).toBe('mudou');
    expect(photoScreenState('<html>nada</html>')).toBe('mudou');
    expect(photoScreenState(screen, 'https://x/pkg_sec.logon')).toBe('sessao');
  });

  it('a resposta do envio só conta se for o objeto esperado', () => {
    expect(uploadReply('{"success":false,"message":"Arquivo grande"}')).toEqual({
      message: 'Arquivo grande',
      success: false,
    });
    expect(uploadReply('<html></html>')).toBeUndefined();
    expect(uploadReply('null')).toBeUndefined();
  });
});

describe('foto: envio ao Lattes', () => {
  it('abre a tela, guarda a de antes, envia como o "Salvar" e confere', async () => {
    const lattes = await lattesFor();
    const code = lattes.state.code;
    const sent = jpeg(800);
    const result = await uploadPhoto(lattes.photoPort, code, sent, () => 1);
    expect(result).toEqual({ ok: true });
    expect(calls(lattes)).toEqual([
      `GET prc_upload_foto?f_cod=${code}&f_ret=MENU`,
      `GET pkg_util_img.show_foto?v_cod=${code}`,
      'POST PRC_UPLOAD_FOTO',
      `GET pkg_util_img.show_foto?v_cod=${code}`,
    ]);
    const post = lattes.state.log.find((l) => l.method === 'POST')!;
    expect(post.pairs).toEqual([
      ['f_cod', code],
      ['f_ctr', 'I'],
      ['f_ret', 'MENU'],
    ]);
    expect(post.file).toEqual({ field: 'file', name: 'foto.jpg' });
    expect([...lattes.state.photo]).toEqual([...sent]);
  });

  it('arquivo fora do formato não chega a ir', async () => {
    const lattes = await lattesFor();
    const result = await uploadPhoto(
      lattes.photoPort,
      lattes.state.code,
      jpeg(PHOTO_MAX_BYTES + 5),
    );
    expect(result).toMatchObject({ ok: false, reason: 'arquivo' });
    expect(calls(lattes)).toEqual([]);
  });

  it('sem código, tela mudada ou sessão caída: nada é enviado', async () => {
    const lattes = await lattesFor();
    expect(await uploadPhoto(lattes.photoPort, undefined, jpeg(10))).toMatchObject({
      reason: 'erro',
    });
    const changed = await lattesFor({
      intercept: faults.rewritePages(/^prc_upload_foto$/i, () => '<html>outra</html>'),
    });
    expect(await uploadPhoto(changed.photoPort, changed.state.code, jpeg(10))).toMatchObject({
      reason: 'erro',
    });
    expect(calls(changed).some((c) => c.startsWith('POST'))).toBe(false);
    const logon = await lattesFor({ intercept: faults.logonAtGet(1) });
    expect(await uploadPhoto(logon.photoPort, logon.state.code, jpeg(10))).toMatchObject({
      reason: 'sessao',
    });
    expect(calls(logon).some((c) => c.startsWith('POST'))).toBe(false);
  });

  it('recusa do Lattes vira erro com a mensagem dele', async () => {
    const lattes = await lattesFor({
      intercept: reply('{"success":false,"message":"Formato inválido."}'),
    });
    expect(await uploadPhoto(lattes.photoPort, lattes.state.code, jpeg(10))).toEqual({
      detail: 'Formato inválido.',
      ok: false,
      reason: 'erro',
    });
  });

  it('foto que não mudou depois do envio é divergência', async () => {
    const lattes = await lattesFor({ intercept: reply('') });
    expect(await uploadPhoto(lattes.photoPort, lattes.state.code, jpeg(10))).toMatchObject({
      ok: false,
      reason: 'divergente',
    });
  });

  it('cada motivo de falha tem o que dizer', () => {
    expect(photoFailureMessage('sessao')).toMatch(/sessão/);
    expect(photoFailureMessage('outro-cv')).toMatch(/outro currículo/);
    expect(photoFailureMessage('erro', 'Detalhe')).toBe('Detalhe');
    expect(photoFailureMessage(undefined)).toMatch(/não foi trocada/);
  });
});

describe('foto: uma coisa por vez na sessão', () => {
  it('recusa com a fila rodando ou outra troca em andamento', () => {
    expect(photoBusy(false, false)).toBeUndefined();
    expect(photoBusy(true, false)).toMatchObject({
      detail: expect.stringContaining('enviando alterações'),
      ok: false,
      reason: 'erro',
    });
    expect(photoBusy(false, true)).toMatchObject({
      detail: expect.stringContaining('Outra troca'),
      ok: false,
    });
  });
});

describe('foto: preparar a imagem', () => {
  it('recorta o quadrado do centro', () => {
    expect(centerSquare(800, 600)).toEqual({ size: 600, sx: 100, sy: 0 });
    expect(centerSquare(600, 900)).toEqual({ size: 600, sx: 0, sy: 150 });
  });

  it('a primeira qualidade que cabe, e um lado menor quando nenhuma cabe', async () => {
    const tried: string[] = [];
    // Cabe só com lado 480 e qualidade até 0,7.
    const encode = async (side: number, quality: number) => {
      tried.push(`${side}@${quality}`);
      return new Uint8Array(side === 480 && quality <= 0.7 ? 60_000 : 90_000);
    };
    const fit = await fitUnderLimit(encode, 1200);
    expect(fit).toMatchObject({ quality: 0.7, side: 480 });
    expect(tried[0]).toBe('600@0.92');
    expect(await fitUnderLimit(async () => new Uint8Array(90_000), 600)).toBeUndefined();
  });

  it('cada lado é tentado uma vez só, mesmo com imagem maior que 600', async () => {
    const sides: number[] = [];
    const encode = async (side: number, quality: number) => {
      if (quality === 0.92) sides.push(side);
      return new Uint8Array(90_000);
    };
    expect(await fitUnderLimit(encode, 1200)).toBeUndefined();
    expect(sides).toEqual([600, 480, 360]);
    sides.length = 0;
    await fitUnderLimit(encode, 500);
    expect(sides).toEqual([500, 480, 360]);
  });

  it('imagem menor que 600 não é ampliada', async () => {
    const fit = await fitUnderLimit(async () => new Uint8Array(10), 300);
    expect(fit?.side).toBe(300);
  });
});
