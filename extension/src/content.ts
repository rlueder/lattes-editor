// Na página do editor: repassa mensagens entre a página (postMessage) e o
// service worker da extensão. Só aceita mensagens da própria página.

import {
  type BridgeMessage,
  bridgeMessage,
  fromSamePage,
  isEditorMessage,
} from '../../src/bridge/protocol.ts';

const toPage = (msg: BridgeMessage) => window.postMessage(bridgeMessage(msg), location.origin);

window.addEventListener('message', (event) => {
  if (!fromSamePage(event, { origin: location.origin, window })) return;
  if (!isEditorMessage(event.data)) return;
  void chrome.runtime.sendMessage({ from: 'editor', msg: event.data });
});

chrome.runtime.onMessage.addListener((message) => {
  const m = message as { msg?: BridgeMessage; to?: string };
  if (m.to === 'editor' && m.msg) toPage(m.msg);
});

// Anuncia-se ao carregar: o editor pode ter mandado "ola" antes do script entrar.
toPage({ type: 'ola', version: chrome.runtime.getManifest().version });
