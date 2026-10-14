// O ícone da barra do navegador no tema certo: guarda a escolha, volta a ela
// quando o service worker acorda e abre o documento fora da tela que acompanha
// as trocas de tema. Saiu de background.ts sem mudança de comportamento.

import { DEFAULT_TOOLBAR_THEME, toolbarIconPaths, type ToolbarTheme } from './toolbar-icon.ts';

const TOOLBAR_KEY = 'temaDaBarra';

/** Troca o ícone da barra pela variante do tema e guarda a escolha. */
export async function setToolbarTheme(theme: ToolbarTheme): Promise<void> {
  await chrome.action.setIcon({ path: toolbarIconPaths(theme) });
  await chrome.storage.local.set({ [TOOLBAR_KEY]: theme });
}

/**
 * Ao acordar, volta ao último tema conhecido e abre o documento fora da tela,
 * que lê o tema atual e avisa a cada troca. O painel e a página do editor
 * também avisam, caso o documento não abra.
 */
export async function restoreToolbarTheme(): Promise<void> {
  void chrome.storage.local.get(TOOLBAR_KEY).then((stored) => {
    const theme = stored[TOOLBAR_KEY] as ToolbarTheme | undefined;
    if (theme && theme !== DEFAULT_TOOLBAR_THEME) {
      void chrome.action.setIcon({ path: toolbarIconPaths(theme) });
    }
  });
  await watchToolbarTheme();
}

async function watchToolbarTheme(): Promise<void> {
  try {
    if (await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({
      justification: 'Ler o tema do navegador para escolher o ícone da barra.',
      reasons: ['MATCH_MEDIA'],
      url: 'offscreen.html',
    });
  } catch {
    // Sem a API (ou com o documento já aberto por outra chamada): fica o painel.
  }
}
