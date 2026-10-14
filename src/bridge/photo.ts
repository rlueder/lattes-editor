// Trocar a foto do currículo no Lattes pela extensão, na sessão da pessoa.
// Ver docs/lattes_internals.md, seção 14.
//
// O caminho, lido em 14/10/2026 sem enviar nada: a janela "Enviar sua foto"
// do menu carrega prc_upload_foto?f_cod=<código>&f_ret=MENU, com o formulário
// "fl" (multipart, para PRC_UPLOAD_FOTO) de campos file (JPEG), f_cod,
// f_ctr=I e f_ret=MENU, nessa ordem. A foto atual sai de
// pkg_util_img.show_foto?v_cod=<código> (o mesmo código), em JPEG de
// 600 × 600. O formato da resposta do POST não se sabe (o script da página
// espera um objeto com success e message), então a conferência não depende
// dela: a foto é lida antes e depois.

import { isLogonPage } from './lattes-html.ts';

/** A tela do Lattes pede "uma imagem no formato JPEG com tamanho de até 70kB". */
export const PHOTO_MAX_BYTES = 70_000;

export interface PhotoPort {
  /** GET de um caminho relativo a /cvlattesweb/; texto decodificado de Latin-1. */
  get(path: string): Promise<{ html: string; url: string }>;
  /** GET que devolve bytes (a foto). */
  getBytes(path: string): Promise<{ bytes: Uint8Array; contentType: string; url: string }>;
  /** POST multipart: os campos na ordem dada, com o arquivo no lugar de `file`. */
  postMultipart(
    path: string,
    fields: [name: string, value: string][],
    file: { bytes: Uint8Array; field: string; name: string; type: string },
  ): Promise<{ html: string; url: string }>;
}

/** Por que a foto não foi trocada. */
export type PhotoFailure =
  'arquivo' | 'consentimento' | 'divergente' | 'erro' | 'outro-cv' | 'sem-aba' | 'sessao';

export type PhotoResult = { ok: true } | { detail?: string; ok: false; reason: PhotoFailure };

/** Os três primeiros bytes de todo JPEG. */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** O que a pessoa pode corrigir antes de enviar: formato e tamanho. */
export function photoProblem(bytes: Uint8Array): string | undefined {
  if (!isJpeg(bytes)) return 'A foto precisa estar em JPEG.';
  if (bytes.length > PHOTO_MAX_BYTES) return 'A foto passa de 70 kB, o limite do Lattes.';
  return undefined;
}

/** A tela de envio da foto: o formulário como lido, a sessão caída ou outra tela. */
export function photoScreenState(html: string, url = ''): 'mudou' | 'ok' | 'sessao' {
  if (isLogonPage(html, url)) return 'sessao';
  const form = /<form[^>]*name\s*=\s*["']?fl\b[^>]*>/i.exec(html)?.[0] ?? '';
  const ok =
    /action\s*=\s*["']?PRC_UPLOAD_FOTO\b/i.test(form) &&
    /multipart\/form-data/i.test(form) &&
    ['file', 'f_cod', 'f_ctr', 'f_ret'].every((name) =>
      new RegExp(`name\\s*=\\s*["']?${name}["'\\s>]`, 'i').test(html),
    );
  return ok ? 'ok' : 'mudou';
}

/**
 * A resposta do envio, se for o objeto que o script da página espera
 * ({ success, message }); undefined para qualquer outra coisa.
 */
export function uploadReply(text: string): { message?: string; success?: boolean } | undefined {
  try {
    const data: unknown = JSON.parse(text.trim());
    if (typeof data !== 'object' || data === null) return undefined;
    const d = data as Record<string, unknown>;
    return {
      message: typeof d.message === 'string' ? d.message : undefined,
      success: typeof d.success === 'boolean' ? d.success : undefined,
    };
  } catch {
    return undefined;
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/** A foto atual no Lattes; ts evita uma cópia guardada pelo navegador. */
async function currentPhoto(port: PhotoPort, code: string, ts: number): Promise<Uint8Array> {
  const res = await port.getBytes(`pkg_util_img.show_foto?v_cod=${code}&ts=${ts}`);
  return res.bytes;
}

/**
 * Troca a foto: confere o arquivo, abre a tela de envio (que diz se a sessão
 * caiu ou se a tela mudou), guarda a foto de antes, envia como o "Salvar" da
 * janela e lê a foto de novo. Conferida quando a de depois é a enviada ou,
 * se o Lattes recomprimir, ao menos outra que a de antes.
 */
export async function uploadPhoto(
  port: PhotoPort,
  code: string | undefined,
  jpeg: Uint8Array,
  now: () => number = Date.now,
): Promise<PhotoResult> {
  const problem = photoProblem(jpeg);
  if (problem) return { detail: problem, ok: false, reason: 'arquivo' };
  if (!code) {
    return {
      detail: 'Não achei o código do currículo no menu do Lattes.',
      ok: false,
      reason: 'erro',
    };
  }
  const screen = await port.get(`prc_upload_foto?f_cod=${code}&f_ret=MENU`);
  const state = photoScreenState(screen.html, screen.url);
  if (state === 'sessao') return { ok: false, reason: 'sessao' };
  if (state === 'mudou') {
    return { detail: 'A tela de envio da foto do Lattes mudou.', ok: false, reason: 'erro' };
  }
  const before = await currentPhoto(port, code, now());
  const res = await port.postMultipart(
    'PRC_UPLOAD_FOTO',
    [
      ['f_cod', code],
      ['f_ctr', 'I'],
      ['f_ret', 'MENU'],
    ],
    { bytes: jpeg, field: 'file', name: 'foto.jpg', type: 'image/jpeg' },
  );
  if (isLogonPage(res.html, res.url)) return { ok: false, reason: 'sessao' };
  const reply = uploadReply(res.html);
  if (reply?.success === false) {
    return {
      detail: reply.message || 'O Lattes recusou a foto.',
      ok: false,
      reason: 'erro',
    };
  }
  const after = await currentPhoto(port, code, now() + 1);
  if (!isJpeg(after)) {
    return { detail: 'O Lattes não devolveu a foto depois do envio.', ok: false, reason: 'erro' };
  }
  if (sameBytes(after, jpeg) || !sameBytes(after, before)) return { ok: true };
  return {
    detail: 'O Lattes respondeu, mas a foto continua a de antes.',
    ok: false,
    reason: 'divergente',
  };
}

/**
 * A troca da foto não começa com a fila de alterações rodando nem com outra
 * troca em andamento: as duas usariam a mesma sessão e a mesma aba, e o menu
 * relido depois da foto cairia no meio da fila.
 */
export function photoBusy(queueRunning: boolean, photoInFlight: boolean): PhotoResult | undefined {
  if (queueRunning) {
    return {
      detail: 'A extensão está enviando alterações ao Lattes. Espere terminar e tente de novo.',
      ok: false,
      reason: 'erro',
    };
  }
  if (photoInFlight) {
    return {
      detail: 'Outra troca de foto ainda está em andamento.',
      ok: false,
      reason: 'erro',
    };
  }
  return undefined;
}

/** O que dizer quando a troca não deu certo. */
export function photoFailureMessage(reason: PhotoFailure | undefined, detail?: string): string {
  switch (reason) {
    case 'consentimento':
      return 'Aceite o aviso da extensão antes de enviar a foto.';
    case 'sem-aba':
      return 'A extensão não achou o Lattes aberto. Entre no currículo numa aba do navegador e tente de novo.';
    case 'sessao':
      return 'A sessão do Lattes caiu. Entre de novo e tente outra vez.';
    case 'outro-cv':
      return 'A sessão aberta no Lattes é de outro currículo.';
    default:
      return detail || 'A foto não foi trocada no Lattes.';
  }
}
