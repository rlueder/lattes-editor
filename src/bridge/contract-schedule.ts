// Quando a verificação automática do contrato (contract.ts) roda, e quando
// tenta de novo antes de mostrar o resultado no painel.

import type { ContractReport } from './contract.ts';

/** Com o Lattes como esperado, a verificação automática se repete a cada meia hora. */
export const AUTO_VERIFY_EVERY_MS = 30 * 60_000;

/** Com problema, de novo a cada vez que o Lattes carrega, no máximo uma vez por minuto. */
export const AUTO_VERIFY_RETRY_MS = 60_000;

/**
 * Espera antes da verificação automática. Logo depois de o menu carregar (ou
 * do painel abrir junto com ele), a primeira verificação falhava e a manual,
 * segundos depois, passava (observado em 13/10/2026).
 */
export const AUTO_VERIFY_DELAY_MS = 3000;

/** Na verificação automática, uma falha de leitura tenta de novo depois disto. */
export const AUTO_VERIFY_RETRY_DELAY_MS = 5000;

/**
 * Se o resultado da verificação automática merece uma segunda tentativa antes
 * de aparecer no painel: leitura que falhou ou sessão que pareceu caída, que
 * podem ser a aba ainda terminando de carregar. Mudança no contrato, não.
 */
export function retryAutoVerify(report: ContractReport): boolean {
  return report.status === 'erro' || report.status === 'sessao';
}

/**
 * Se a verificação automática (painel aberto, menu do Lattes carregado) deve
 * rodar agora. Ela lê o menu e um exemplar de cada formulário: com tudo certo,
 * não precisa repetir a cada página.
 */
export function shouldAutoVerify(report: ContractReport | undefined, now: number): boolean {
  if (!report) return true;
  const age = now - Date.parse(report.checkedAt);
  if (!Number.isFinite(age)) return true;
  return age >= (report.status === 'ok' ? AUTO_VERIFY_EVERY_MS : AUTO_VERIFY_RETRY_MS);
}
