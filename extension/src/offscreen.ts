// Documento fora da tela, só para ler o tema do navegador: o service worker não
// tem matchMedia. Avisa o tema agora e a cada troca (ver toolbar-icon.ts).

import { toolbarTheme } from './toolbar-icon.ts';

const darkScheme = matchMedia('(prefers-color-scheme: dark)');
const report = () => void chrome.runtime.sendMessage({ toolbar: toolbarTheme(darkScheme.matches) });
report();
darkScheme.addEventListener('change', report);
