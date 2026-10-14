import { describe, expect, it } from 'vitest';

import {
  isJpeg,
  PHOTO_MAX_BYTES,
  photoFailureMessage,
  type PhotoPort,
  photoProblem,
  photoScreenState,
  uploadPhoto,
  uploadReply,
} from '../src/bridge/photo.ts';
import { centerSquare, fitUnderLimit } from '../src/ui/photo-image.ts';

const jpeg = (n: number, fill = 1) => {
  const bytes = new Uint8Array(n).fill(fill);
  bytes.set([0xff, 0xd8, 0xff], 0);
  return bytes;
};

/** A tela de envio como lida no Lattes em 14/10/2026. */
const SCREEN = `<form name="fl" action="PRC_UPLOAD_FOTO" method="post" enctype="multipart/form-data">
  <input type="file" name="file" accept="image/jpg,image/jpeg">
  <input type="hidden" name="f_cod" value="K1234567A8">
  <input type="hidden" name="f_ctr" value="I">
  <input type="hidden" name="f_ret" value="MENU">
</form>`;

/** Um Lattes falso: guarda a foto que chega e devolve a atual. */
function fakeLattes({
  reply = '{"success":true}',
  screen = SCREEN,
  stores = true,
}: { reply?: string; screen?: string; stores?: boolean } = {}) {
  let current: Uint8Array = jpeg(500, 7);
  const calls: string[] = [];
  const posted: { fields: [string, string][]; file: { field: string; name: string } }[] = [];
  const port: PhotoPort = {
    get: async (path) => {
      calls.push(`GET ${path}`);
      return { html: screen, url: path };
    },
    getBytes: async (path) => {
      calls.push(`FOTO ${path.split('&ts=')[0]}`);
      return { bytes: current, contentType: 'image/jpeg', url: path };
    },
    postMultipart: async (path, fields, file) => {
      calls.push(`POST ${path}`);
      posted.push({ fields, file: { field: file.field, name: file.name } });
      if (stores) current = file.bytes;
      return { html: reply, url: path };
    },
  };
  return { calls, port, posted };
}

describe('foto: o arquivo', () => {
  it('só JPEG de até 70 kB', () => {
    expect(isJpeg(jpeg(10))).toBe(true);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(photoProblem(jpeg(PHOTO_MAX_BYTES))).toBeUndefined();
    expect(photoProblem(jpeg(PHOTO_MAX_BYTES + 1))).toMatch(/70 kB/);
    expect(photoProblem(new Uint8Array([1, 2, 3, 4]))).toMatch(/JPEG/);
  });

  it('a tela de envio: formulário como lido, sessão caída ou outra tela', () => {
    expect(photoScreenState(SCREEN)).toBe('ok');
    expect(photoScreenState(SCREEN.replace('name="f_ctr"', 'name="outro"'))).toBe('mudou');
    expect(photoScreenState('<html>nada</html>')).toBe('mudou');
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
    const lattes = fakeLattes();
    const result = await uploadPhoto(lattes.port, 'K1234567A8', jpeg(800), () => 1);
    expect(result).toEqual({ ok: true });
    expect(lattes.calls).toEqual([
      'GET prc_upload_foto?f_cod=K1234567A8&f_ret=MENU',
      'FOTO pkg_util_img.show_foto?v_cod=K1234567A8',
      'POST PRC_UPLOAD_FOTO',
      'FOTO pkg_util_img.show_foto?v_cod=K1234567A8',
    ]);
    expect(lattes.posted[0]).toEqual({
      fields: [
        ['f_cod', 'K1234567A8'],
        ['f_ctr', 'I'],
        ['f_ret', 'MENU'],
      ],
      file: { field: 'file', name: 'foto.jpg' },
    });
  });

  it('arquivo fora do formato não chega a ir', async () => {
    const lattes = fakeLattes();
    const result = await uploadPhoto(lattes.port, 'K1234567A8', jpeg(PHOTO_MAX_BYTES + 5));
    expect(result).toMatchObject({ ok: false, reason: 'arquivo' });
    expect(lattes.calls).toEqual([]);
  });

  it('sem código, tela mudada ou sessão caída: nada é enviado', async () => {
    expect(await uploadPhoto(fakeLattes().port, undefined, jpeg(10))).toMatchObject({
      reason: 'erro',
    });
    const changed = fakeLattes({ screen: '<html>outra</html>' });
    expect(await uploadPhoto(changed.port, 'K1234567A8', jpeg(10))).toMatchObject({
      reason: 'erro',
    });
    expect(changed.calls.some((c) => c.startsWith('POST'))).toBe(false);
    const logon = fakeLattes({ screen: '<form name="frmLogon" action="pkg_sec.logon">' });
    expect(await uploadPhoto(logon.port, 'K1234567A8', jpeg(10))).toMatchObject({
      reason: 'sessao',
    });
  });

  it('recusa do Lattes vira erro com a mensagem dele', async () => {
    const lattes = fakeLattes({ reply: '{"success":false,"message":"Formato inválido."}' });
    expect(await uploadPhoto(lattes.port, 'K1234567A8', jpeg(10))).toEqual({
      detail: 'Formato inválido.',
      ok: false,
      reason: 'erro',
    });
  });

  it('foto que não mudou depois do envio é divergência', async () => {
    const lattes = fakeLattes({ reply: '', stores: false });
    expect(await uploadPhoto(lattes.port, 'K1234567A8', jpeg(10))).toMatchObject({
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
