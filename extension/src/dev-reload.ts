// Canal Dev: a extensão Dev vem no pacote do LattesEditor Dev, que a copia
// para a pasta que o navegador carrega (src-tauri/src/extensao_dev.rs). Aqui,
// a extensão percebe que o app mudou de versão e se recarrega para ler a pasta
// de novo.

/** A versão desta extensão: version_name (0.22.0-dev.42) quando há, senão version. */
export function ownVersion(): string {
  const manifest = chrome.runtime.getManifest();
  return manifest.version_name ?? manifest.version;
}

const DEV_RELOAD_KEY = 'recarregada-para';

/**
 * Canal Dev: o LattesEditor Dev copia a extensão nova para a pasta que o
 * navegador carrega a cada versão (src-tauri/src/extensao_dev.rs). Quando o
 * app anuncia outra versão, a extensão se recarrega para ler a pasta de novo.
 * Uma vez só por versão do app: se a pasta não mudou, não fica em laço.
 */
export async function reloadForApp(appVersion: string | undefined): Promise<boolean> {
  if (!__CANAL_DEV__ || !appVersion || appVersion === ownVersion()) return false;
  const stored = await chrome.storage.local.get(DEV_RELOAD_KEY).catch(() => ({}));
  if ((stored as Record<string, unknown>)[DEV_RELOAD_KEY] === appVersion) return false;
  await chrome.storage.local.set({ [DEV_RELOAD_KEY]: appVersion }).catch(() => undefined);
  chrome.runtime.reload();
  return true;
}
