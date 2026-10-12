import './ui/styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { isDesktop } from './desktop/native.ts';
import { App } from './ui/App.tsx';
import { TipProvider } from './ui/primitives/Tip.tsx';
import { applyTheme, readTheme } from './ui/theme.ts';

// Antes do primeiro render, para não piscar o tema do sistema.
applyTheme(readTheme());

// No app de macOS, o cabeçalho faz as vezes da barra de título (botões da
// janela dentro dele): o CSS abre espaço para eles.
if (isDesktop() && /Mac/.test(navigator.platform)) {
  document.documentElement.classList.add('desktop-mac');
}

// Âncoras de versões antigas (ids internos do React) não apontam para nada.
if (/^#_r_/.test(location.hash)) {
  history.replaceState(null, '', location.pathname + location.search);
}

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <TipProvider delay={350}>
        <App />
      </TipProvider>
    </StrictMode>,
  );
}

// No `pnpm dev`, ?exemplo abre o currículo sintético (src/dev/example.ts).
// No build, import.meta.env.DEV é false e o import some do bundle.
if (import.meta.env.DEV) {
  void import('./dev/example.ts')
    .then((m) => m.openExampleIfAsked(location.search))
    .catch((err: unknown) => console.error('Currículo de exemplo não carregou:', err))
    .finally(render);
} else {
  render();
}
