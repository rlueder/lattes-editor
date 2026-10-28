// Recarregar do Lattes pela ponte (LAT-46): com a extensão sabendo exportar,
// "Recarregar do Lattes…" pede o ZIP do Exportar em vez de um arquivo, passa
// pela mesma confirmação de antes quando há itens novos não importados, e a
// falha vai para o sino. Aqui ficam as regras; o efeito está em
// use-lattes-reload.ts.

import { fromBase64 } from '../bridge/export.ts';
import { sameCv } from '../bridge/lattes-html.ts';
import { encodeLatin1 } from '../model/latin1.ts';
import type { OpenFailure } from './lattes-open.ts';
import type { Notice } from './notifications.ts';
import type { CurriculoReading } from './use-bridge.ts';

export interface ReloadFailure {
  detail?: string;
  reason: OpenFailure | 'outro-cv';
}

/**
 * O que fazer com a resposta: o arquivo para abrir, ou a falha. A sessão do
 * Lattes precisa ser do currículo aberto: recarregar outro currículo por cima
 * deste apagaria o trabalho.
 */
export function reloadReply(
  reply: CurriculoReading,
  currentLattesId: string | undefined,
): { failure: ReloadFailure } | { file: File } {
  if (!reply.zip) return { failure: { detail: reply.detail, reason: reply.reason ?? 'erro' } };
  if (!sameCv(currentLattesId, reply.lattesId)) {
    return { failure: { reason: 'outro-cv' } };
  }
  try {
    const bytes = fromBase64(reply.zip);
    return { file: new File([bytes], reply.fileName ?? 'curriculo-lattes.zip') };
  } catch {
    return { failure: { detail: 'O arquivo chegou corrompido', reason: 'erro' } };
  }
}

/** O que dizer no sino quando o currículo não foi recarregado. */
export function reloadFailureText({ detail, reason }: ReloadFailure): string {
  switch (reason) {
    case 'outro-cv':
      return 'A sessão aberta no Lattes é de outro currículo. Entre no Lattes com o currículo aberto aqui e tente de novo.';
    case 'pendente':
      return 'O Lattes tem alterações ainda não enviadas ao CNPq e só exporta depois do envio. Envie ao CNPq e recarregue de novo.';
    case 'consentimento':
      return 'Aceite o aviso no painel da extensão e tente de novo.';
    case 'sem-aba':
      return 'Abra o seu currículo no Lattes numa aba do navegador e tente de novo.';
    case 'sessao':
      return 'A sessão do Lattes expirou. Entre de novo e tente outra vez.';
    case 'sem-resposta':
      return 'A extensão não respondeu. Tente de novo, ou escolha o arquivo exportado.';
    case 'erro':
      return `Não deu para ler o currículo no Lattes${detail ? ` (${detail.replace(/\.$/, '')})` : ''}. Tente de novo, ou escolha o arquivo exportado.`;
  }
}

/** A notificação da falha: clicada, abre a escolha do arquivo exportado. */
export function reloadNotice(failure: ReloadFailure): Notice {
  return {
    action: 'recarregar-arquivo',
    id: 'recarregar',
    level: 'aviso',
    text: `${reloadFailureText(failure)} Clique para escolher o arquivo.`,
    title: 'O currículo não foi recarregado',
  };
}

/**
 * Os bytes de uma versão guardada (o XML como foi lido), para abrir de novo
 * como arquivo: em Latin-1 quando o prólogo declara, como a exportação do
 * Lattes; senão em UTF-8.
 */
export function versionBytes(xml: string): Uint8Array<ArrayBuffer> {
  const prolog = /^\s*<\?xml[^>]*\?>/.exec(xml)?.[0] ?? '';
  if (/encoding\s*=\s*["'](ISO-8859-1|latin-?1)["']/i.test(prolog)) {
    return new Uint8Array(encodeLatin1(xml));
  }
  return new TextEncoder().encode(xml);
}

/** O que recarregar faz com o trabalho que só existe no editor. */
export interface ReloadPlan {
  /** Pergunta antes: há itens novos, alterações ou edição que não foram ao Lattes. */
  confirm: boolean;
  /**
   * A cópia de trabalho de agora, guardada no histórico (marcada para não
   * sair) antes de a exportação nova tomar o lugar dela; ausente quando ela é
   * a própria exportação carregada.
   */
  previous?: { note: string; xml: string };
}

export function reloadPlan({
  currentXml,
  newItems,
  openChanges,
  originalXml,
}: {
  currentXml: string;
  newItems: number;
  openChanges: number;
  originalXml: string;
}): ReloadPlan {
  const modified = currentXml !== originalXml;
  return {
    confirm: newItems > 0 || openChanges > 0 || modified,
    previous: modified
      ? { note: 'Cópia de trabalho antes de recarregar do Lattes', xml: currentXml }
      : undefined,
  };
}
