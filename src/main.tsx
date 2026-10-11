import './ui/styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './ui/App.tsx';
import { applyTheme, readTheme } from './ui/theme.ts';

// Antes do primeiro render, para não piscar o tema do sistema.
applyTheme(readTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
