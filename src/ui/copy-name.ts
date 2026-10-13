// Nome do arquivo ao salvar a cópia de um ponto do histórico: o nome do
// currículo com a data e a hora do ponto, para nunca sobrescrever outra cópia.

/** CV_123.xml → CV_123-copia-2026-10-11-1530.xml */
export function copyFileName(fileName: string, when: Date): string {
  const base = fileName.replace(/\.(xml|zip)$/i, '');
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}-${pad(when.getHours())}${pad(when.getMinutes())}`;
  return `${base}-copia-${stamp}.xml`;
}
