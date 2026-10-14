// Abrir do Lattes na tela inicial (LAT-22): com a extensão ligada e sabendo
// exportar, o editor pede o currículo da sessão do Lattes sozinho, na primeira
// abertura sem cópia de trabalho. Aqui ficam as regras; o efeito está em
// use-lattes-open.ts.

import type { ExportFailure } from '../bridge/export.ts';
import type { Link } from '../bridge/link.ts';

export type OpenFailure = ExportFailure | 'sem-resposta';

export type OpenState =
  | { kind: 'abrindo' }
  | { detail?: string; kind: 'falhou'; reason: OpenFailure }
  | { kind: 'parado' };

/** Quanto esperar o ZIP antes de desistir: o Exportar leva menos de um segundo. */
export const OPEN_TIMEOUT_MS = 30_000;

/** A extensão ligada sabe exportar (capacidade "curriculo", src/bridge/compat.ts). */
export function canOpenFromLattes(link: Link): boolean {
  return Boolean(link.features?.includes('curriculo'));
}

/**
 * Falhas que se resolvem fora do editor (aceitar o aviso, abrir o Lattes,
 * entrar de novo): o editor tenta de novo sozinho quando a extensão volta a
 * ler o menu do Lattes.
 */
export function retriesOnReading(reason: OpenFailure): boolean {
  return reason === 'consentimento' || reason === 'sem-aba' || reason === 'sessao';
}

export function failureText(reason: OpenFailure, detail?: string): string {
  switch (reason) {
    case 'consentimento':
      return 'Aceite o aviso no painel da extensão. O currículo abre em seguida.';
    case 'sem-aba':
      return 'Abra o seu currículo no Lattes numa aba do navegador. Ele abre aqui em seguida.';
    case 'sessao':
      return 'A sessão do Lattes expirou. Entre de novo; o currículo abre em seguida.';
    case 'pendente':
      return 'O seu Lattes tem alterações ainda não enviadas ao CNPq, e o Lattes só exporta depois do envio. Use "Enviar" no Lattes e tente de novo.';
    case 'sem-resposta':
      return 'A extensão não respondeu. Tente de novo, ou abra o arquivo exportado.';
    case 'erro':
      return `Não deu para exportar do Lattes${detail ? ` (${detail.replace(/\.$/, '')})` : ''}. Tente de novo, ou abra o arquivo exportado.`;
  }
}
