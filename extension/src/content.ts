// Na página do editor: repassa mensagens entre a página (postMessage) e o
// service worker da extensão. Só aceita mensagens da própria página.

import {
  type BridgeMessage,
  bridgeMessage,
  fromSamePage,
  isEditorMessage,
} from '../../src/bridge/protocol.ts';
import { toolbarTheme } from './toolbar-icon.ts';

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

// Avisa o service worker do tema da barra (ver toolbar-icon.ts), agora e a cada troca.
const darkScheme = matchMedia('(prefers-color-scheme: dark)');
const reportToolbarTheme = () =>
  void chrome.runtime.sendMessage({ toolbar: toolbarTheme(darkScheme.matches) });
reportToolbarTheme();
darkScheme.addEventListener('change', reportToolbarTheme);
