// Cópia de segurança antes de enviar ao Lattes: o currículo como ele está no
// Lattes agora (a exportação carregada, com o que já foi conferido), em
// arquivo, para dar para voltar atrás se um envio sair errado. Quem grava é
// saveBytes (src/desktop/native.ts): diálogo de salvar no app, download no
// navegador.

/** CV_123.xml → CV_123-antes-do-envio-2026-10-11-1530.xml */
export function backupFileName(fileName: string, now: Date): string {
  const base = fileName.replace(/\.(xml|zip)$/i, '');
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${base}-antes-do-envio-${stamp}.xml`;
}
