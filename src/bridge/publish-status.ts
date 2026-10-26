// Mensagens e checagem de ocupação do envio ao CNPq. A execução fica em publish.ts.

import type { PublishResult } from './publish.ts';

/** O que dizer depois de um envio, a partir do resultado. */
export function publishMessage(result: PublishResult): string {
  switch (result.outcome) {
    case 'publicado':
      return 'Publicado. O menu do Lattes mostra a publicação de hoje e não tem mais alterações pendentes.';
    case 'consentimento':
      return 'Aceite o aviso da extensão antes de enviar.';
    case 'sem-aba':
      return 'A extensão não achou o Lattes aberto. Entre no currículo numa aba do navegador e tente de novo.';
    case 'sessao':
      return result.detail ?? 'A sessão do Lattes caiu. Entre de novo e tente outra vez.';
    case 'outro-cv':
      return result.detail ?? 'A sessão aberta no Lattes é de outro currículo; nada foi enviado.';
    case 'desligado':
      return 'O envio ao CNPq pelo editor está desligado. Envie pela tela do Lattes.';
    default:
      return result.detail ?? 'O envio não foi feito.';
  }
}

/** Todos usam a mesma sessão; o envio espera a fila, foto, Importar e conferência. */
export function publishBusy(busy: {
  importing: boolean;
  photo: boolean;
  publishing: boolean;
  queue: boolean;
  verifying: boolean;
}): PublishResult | undefined {
  if (Object.values(busy).some(Boolean)) {
    return {
      detail: 'A extensão já está enviando algo ao Lattes. Espere terminar e tente de novo.',
      outcome: 'erro',
    };
  }
  return undefined;
}

/** AAAA-MM-DD de uma data, no fuso local (o Lattes mostra a data sem hora). */
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
