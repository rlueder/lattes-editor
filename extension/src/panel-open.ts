// O aviso de uso e o painel lateral: a aba do aviso na instalação ou na
// atualização ainda não aceita, e o clique no ícone onde não há painel lateral.

import { hasConsent } from './consent.ts';

export function registerPanel(): void {
  chrome.runtime.onInstalled.addListener((details) => {
    // O aviso de uso abre numa aba (o painel lateral só abre com um clique) na
    // instalação e na atualização de quem ainda não aceitou esta versão dele.
    // Falha aqui não pode impedir o painel lateral, configurado logo abaixo.
    void (async () => {
      try {
        const pending =
          details.reason === 'install' || (details.reason === 'update' && !(await hasConsent()));
        if (pending) await chrome.tabs.create({ url: chrome.runtime.getURL('panel.html') });
      } catch {
        // Sem a aba, o aviso aparece quando o painel for aberto.
      }
    })();
    // Painel lateral onde existir (Chrome, Brave recente); senão o clique abre o painel numa aba.
    if (chrome.sidePanel?.setPanelBehavior) {
      void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  });

  chrome.action.onClicked.addListener(() => {
    if (!chrome.sidePanel?.setPanelBehavior)
      void chrome.tabs.create({ url: chrome.runtime.getURL('panel.html') });
  });
}
