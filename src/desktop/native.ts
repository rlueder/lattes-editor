// Arquivos no app de desktop (Tauri) e no navegador, pela mesma interface.
//
// No desktop, abrir e salvar usam os diálogos nativos e comandos do próprio
// app (src-tauri/src/lib.rs), que leem e gravam os bytes sem mexer neles; o
// XML segue em Latin-1, como no navegador. Fora do desktop, nada muda: input
// de arquivo para abrir e download para salvar.

export interface FileFilter {
  extensions: string[];
  name: string;
}

export const CV_FILTER: FileFilter = { extensions: ['zip', 'xml'], name: 'Exportação do Lattes' };

/** O editor está rodando dentro do app de desktop? */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Nome do arquivo no fim de um caminho, com / ou \\ como separador. */
export function baseName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

/** Abre um arquivo pelo diálogo nativo; undefined se a pessoa cancelar. */
export async function pickFileNative(
  filters: FileFilter[] = [CV_FILTER],
): Promise<File | undefined> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { invoke } = await import('@tauri-apps/api/core');
  const path = await open({ filters, multiple: false });
  if (typeof path !== 'string') return undefined;
  const bytes = await invoke<number[]>('read_file', { path });
  return new File([new Uint8Array(bytes)], baseName(path));
}

function downloadInBrowser(bytes: Uint8Array, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Salva bytes: no desktop, pelo diálogo nativo de salvar (com o nome sugerido);
 * no navegador, como download. Devolve false se a pessoa cancelar.
 */
export async function saveBytes(
  bytes: Uint8Array,
  fileName: string,
  type = 'application/xml',
): Promise<boolean> {
  if (!isDesktop()) {
    downloadInBrowser(bytes, fileName, type);
    return true;
  }
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { invoke } = await import('@tauri-apps/api/core');
  const ext = fileName.includes('.') ? fileName.split('.').pop()! : '';
  const path = await save({
    defaultPath: fileName,
    filters: ext ? [{ extensions: [ext], name: ext.toUpperCase() }] : [],
  });
  if (!path) return false;
  await invoke('write_file', { bytes: Array.from(bytes), path });
  return true;
}
