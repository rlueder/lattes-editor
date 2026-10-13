// Abrir do Lattes (LAT-22): a extensão pede ao Lattes, na sessão da pessoa, o
// mesmo ZIP do "Exportar" e o entrega ao editor, sem download nem arquivo
// para escolher. Ver docs/lattes_internals.md, seção 12.
//
// O caminho, observado em 13/10/2026: o GET de pkg_impcv.get_arquivo mostra a
// tela do Exportar (formulário PKG_IMP); o "Confirmar" põe f_ctr = "G" e
// envia o formulário por POST para PKG_IMPCV.get_arquivo, com f_tpo_arq = 3
// (XML) e f_cod. A resposta é o ZIP, application/zip, com um único
// <16 dígitos>.xml dentro. Com alterações não enviadas ao CNPq, a tela abre
// com um alert() e não exporta (seção 10).

import { isLogonPage } from './lattes-html.ts';

export interface ExportPort {
  /** GET de um caminho relativo a /cvlattesweb/; texto decodificado de Latin-1. */
  get(path: string): Promise<{ html: string; url: string }>;
  /** POST de formulário que devolve bytes (o ZIP), com os cabeçalhos que importam. */
  postForBytes(
    path: string,
    body: string,
  ): Promise<{ bytes: Uint8Array; contentType: string; disposition: string; url: string }>;
}

/** Por que o Lattes não entregou o currículo. */
export type ExportFailure = 'consentimento' | 'erro' | 'pendente' | 'sem-aba' | 'sessao';

export type ExportResult =
  | { bytes: Uint8Array; fileName: string; ok: true }
  | { detail?: string; ok: false; reason: ExportFailure };

/** O aviso da tela do Exportar enquanto há alteração não enviada ao CNPq. */
const PENDING = /só serão aceitas quando enviadas ao CNPq/i;

/** O que a tela do Exportar diz antes de exportar. */
export function exportScreenState(html: string, url = ''): 'mudou' | 'ok' | 'pendente' | 'sessao' {
  if (isLogonPage(html, url)) return 'sessao';
  if (PENDING.test(html)) return 'pendente';
  // O formulário que o "Confirmar" envia, com a opção de XML.
  const form = /<form[^>]*name\s*=\s*["']?PKG_IMP\b/i.test(html);
  const xml =
    /name\s*=\s*["']?f_tpo_arq["']?[^>]*value\s*=\s*["']?3\b|value\s*=\s*["']?3["']?[^>]*name\s*=\s*["']?f_tpo_arq/i.test(
      html,
    );
  return form && xml ? 'ok' : 'mudou';
}

/** Nome do arquivo do cabeçalho Content-Disposition, ou CV_<id>.zip. */
export function zipFileName(disposition: string, lattesId?: string): string {
  const name = /filename\*?=\s*"?([^";]+)"?/i.exec(disposition)?.[1]?.trim();
  if (name && /^[\w.-]+\.zip$/i.test(name)) return name;
  return lattesId ? `CV_${lattesId}.zip` : 'curriculo-lattes.zip';
}

/** Os dois primeiros bytes de todo ZIP: "PK". */
function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/**
 * Pede o ZIP ao Lattes. Primeiro a tela do Exportar, que diz se a sessão caiu
 * ou se há pendência; só então o POST, igual ao do "Confirmar".
 */
export async function exportCv(
  port: ExportPort,
  code: string | undefined,
  lattesId?: string,
): Promise<ExportResult> {
  if (!code) {
    return {
      detail: 'Não achei o código do currículo no menu do Lattes.',
      ok: false,
      reason: 'erro',
    };
  }
  const screen = await port.get(`pkg_impcv.get_arquivo?f_cod=${code}`);
  const state = exportScreenState(screen.html, screen.url);
  if (state === 'sessao' || state === 'pendente') return { ok: false, reason: state };
  if (state === 'mudou') {
    return { detail: 'A tela do Exportar do Lattes mudou.', ok: false, reason: 'erro' };
  }
  const body = new URLSearchParams({ f_cod: code, f_ctr: 'G', f_tpo_arq: '3' }).toString();
  const res = await port.postForBytes('PKG_IMPCV.get_arquivo', body);
  if (!/zip/i.test(res.contentType) || !isZip(res.bytes)) {
    const html = new TextDecoder('latin1').decode(res.bytes.subarray(0, 20_000));
    if (isLogonPage(html, res.url)) return { ok: false, reason: 'sessao' };
    if (PENDING.test(html)) return { ok: false, reason: 'pendente' };
    return { detail: 'O Lattes não devolveu o arquivo da exportação.', ok: false, reason: 'erro' };
  }
  return { bytes: res.bytes, fileName: zipFileName(res.disposition, lattesId), ok: true };
}

/** Bytes em base64, para a mensagem do conector (JSON). */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
