import './ui/styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './ui/App.tsx';
import { TipProvider } from './ui/primitives/Tip.tsx';
import { applyTheme, readTheme } from './ui/theme.ts';

// Antes do primeiro render, para não piscar o tema do sistema.
applyTheme(readTheme());

// Âncoras de versões antigas (ids internos do React) não apontam para nada.
if (/^#_r_/.test(location.hash)) {
  history.replaceState(null, '', location.pathname + location.search);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TipProvider delay={350}>
      <App />
    </TipProvider>
  </StrictMode>,
);
