// Capturas do editor para o README, sempre com o currículo sintético
// (fixtures/synthetic_full.xml, "Pessoa de Teste A"), nunca com um real.
//
// Usa um Brave ou Chrome sem janela, com perfil temporário, falando pelo
// protocolo de depuração (sem Playwright nem outra dependência). Cada tela
// sai nos temas claro e escuro, em docs/img/<nome>-<tema>.jpg. A de Produções
// também vai para a página do projeto, em site/img/editor-<tema>.jpg. Por fim,
// a imagem de prévia da página (site/img/og.png, 1200 × 630) sai de
// scripts/og-card.html, servido pelo mesmo Vite.
//
//   pnpm dev                       # o editor em http://localhost:5173 (ou outra porta)
//   pnpm capture:screenshots [url] # padrão: http://localhost:5173/

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { assertRendered, openTab, sleep, withHeadlessBrowser } from './headless.ts';

const root = new URL('../', import.meta.url).pathname;
const url = process.argv[2] ?? 'http://localhost:5173/';
const fixture = join(root, 'fixtures/synthetic_full.xml');
const outDir = join(root, 'docs/img');

/** Uma tela: como chegar nela a partir do editor aberto. */
interface Shot {
  /** Outra cópia, sem o "-<tema>.jpg" (caminho a partir da raiz do repositório). */
  alsoTo?: string;
  name: string;
  /** Roda na página antes da captura. */
  prepare?: string;
  /**
   * Modo de privacidade (dados pessoais e foto mascarados). Só Dados gerais o
   * mostra ligado; nas outras telas a foto de exemplo aparece.
   */
  privacy?: boolean;
  /** Antes de abrir o currículo (a tela inicial). */
  welcome?: boolean;
}

const SHOTS: Shot[] = [
  { name: 'inicio', welcome: true },
  { alsoTo: 'site/img/editor', name: 'producoes', prepare: `location.hash = 'producoes'` },
  { name: 'dados-gerais', prepare: `location.hash = 'dados-gerais'`, privacy: true },
  {
    name: 'ir-para',
    prepare: `location.hash = 'producoes';
      setTimeout(() => document.querySelector('.search-btn')?.click(), 300);
      setTimeout(() => {
        const input = document.querySelector('.palette-input');
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(input, 'artigo');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, 700)`,
  },
  {
    name: 'novo-item',
    prepare: `location.hash = 'producoes';
      setTimeout(() => document.querySelector('[aria-label="Novo item"]')?.click(), 300)`,
  },
];

async function capture(theme: 'claro' | 'escuro'): Promise<void> {
  const cdp = await openTab();
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    deviceScaleFactor: 2,
    height: 860,
    mobile: false,
    width: 1440,
  });
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: theme === 'claro' ? 'light' : 'dark' }],
  });

  const shoot = async (shot: Shot) => {
    const { data } = await cdp.send<{ data: string }>('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 80,
    });
    const files = [join(outDir, `${shot.name}-${theme}.jpg`)];
    if (shot.alsoTo) files.push(join(root, `${shot.alsoTo}-${theme}.jpg`));
    for (const file of files) {
      writeFileSync(file, Buffer.from(data, 'base64'));
      console.log(file.replace(root, ''));
    }
  };
  const evaluate = (expression: string) => cdp.send('Runtime.evaluate', { expression });

  // Sem currículo guardado (o do tema anterior sai), a página abre na tela inicial.
  await cdp.send('Storage.clearDataForOrigin', {
    origin: new URL(url).origin,
    storageTypes: 'all',
  });
  await cdp.send('Page.navigate', { url });
  await sleep(1500);
  for (const shot of SHOTS.filter((s) => s.welcome)) await shoot(shot);

  const { root: doc } = await cdp.send<{ root: { nodeId: number } }>('DOM.getDocument');
  const { nodeId } = await cdp.send<{ nodeId: number }>('DOM.querySelector', {
    nodeId: doc.nodeId,
    selector: 'input[type=file]',
  });
  await cdp.send('DOM.setFileInputFiles', { files: [fixture], nodeId });
  await sleep(2000);

  // O modo de privacidade vem ligado; cada tela pede o seu. A troca recarrega
  // a página (o currículo fica no IndexedDB e volta aberto).
  let privacy: boolean | undefined;
  for (const shot of SHOTS.filter((s) => !s.welcome)) {
    const want = shot.privacy ?? false;
    if (want !== privacy) {
      await evaluate(
        `localStorage.setItem('lattes-editor:privacidade', '${want ? '1' : '0'}'); location.reload()`,
      );
      await sleep(2500);
      privacy = want;
    }
    // Fecha o que a captura anterior abriu (⌘K, modal) e volta ao topo.
    await evaluate(
      `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); scrollTo(0, 0)`,
    );
    await sleep(300);
    if (shot.prepare) await evaluate(shot.prepare);
    await sleep(1500);
    await shoot(shot);
  }
  cdp.close();
}

/** Imagem de prévia ao compartilhar a página do projeto (Open Graph). */
async function captureOgImage(): Promise<void> {
  const cdp = await openTab();
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    deviceScaleFactor: 1,
    height: 630,
    mobile: false,
    width: 1200,
  });
  await cdp.send('Page.navigate', { url: new URL('/scripts/og-card.html', url).href });
  await assertRendered(cdp, 'Prévia (og-card.html)', 'body', { textSelector: 'h1' });
  const { data } = await cdp.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
  const file = join(root, 'site/img/og.png');
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(file.replace(root, ''));
  cdp.close();
}

mkdirSync(outDir, { recursive: true });
await withHeadlessBrowser(async () => {
  await capture('claro');
  await capture('escuro');
  await captureOgImage();
});
