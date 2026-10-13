import './ui/styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { openExternalLinksNatively } from './desktop/external-links.ts';
import { isDesktop } from './desktop/native.ts';
import { initStorage } from './desktop/storage-key.ts';
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

// Links para fora abrem no navegador padrão, não na janela do app.
if (isDesktop()) openExternalLinksNatively();

// Âncoras de versões antigas (ids internos do React) não apontam para nada.
if (/^#_r_/.test(location.hash)) {
  history.replaceState(null, '', location.pathname + location.search);
}

const root = createRoot(document.getElementById('root')!);

// Enquanto o chaveiro responde (no Linux pode pedir a senha), a janela já
// mostra algo, em vez de ficar em branco.
root.render(<p className="boot">Abrindo o LattesEditor…</p>);

function render() {
  root.render(
    <StrictMode>
      <TipProvider delay={350}>
        <App />
      </TipProvider>
    </StrictMode>,
  );
}

// A chave dos dados locais vem antes de qualquer leitura do banco
// (src/desktop/storage-key.ts). No `pnpm dev`, ?exemplo abre o currículo
// sintético (src/dev/example.ts); no build, import.meta.env.DEV é false e o
// import some do bundle.
void initStorage().then(() => {
  if (!import.meta.env.DEV) return render();
  void import('./dev/example.ts')
    .then((m) => m.openExampleIfAsked(location.search))
    .catch((err: unknown) => console.error('Currículo de exemplo não carregou:', err))
    .finally(render);
});
