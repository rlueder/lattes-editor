// Capturas do editor para a página do projeto, sempre com o currículo de
// demonstração (fixtures/demo.xml, uma pesquisadora fictícia, pnpm gen:demo),
// nunca com um real. O README usa as animações de site/img/homepage/
// (pnpm capture:animacoes).
//
// Usa um Brave ou Chrome sem janela, com perfil temporário, falando pelo
// protocolo de depuração (sem Playwright nem outra dependência). Tudo sai de
// uma janela de 1440 × 860 em 2x. A de Produções sai nos dois temas, em
// site/img/editor-<tema>.jpg (a prévia do vídeo e a imagem do schema.org); as
// outras só no tema claro, em site/img/homepage/: a busca, as da abertura e as
// do Panorama. Por fim, a imagem de prévia da página (site/img/og.png,
// 1200 × 630) sai de scripts/og-card.html, servido pelo mesmo Vite.
//
//   pnpm dev                       # o editor em http://localhost:5173 (ou outra porta)
//   pnpm capture:screenshots [url] # padrão: http://localhost:5173/

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertRendered, openTab, sleep, withHeadlessBrowser } from './headless.ts';

// fileURLToPath, não .pathname: no Windows, o pathname vem como /D:/a/... e
// vira D:\D:\a\... ao abrir o arquivo.
const root = fileURLToPath(new URL('../', import.meta.url));
const url = process.argv[2] ?? 'http://localhost:5173/';
const fixture = join(root, 'fixtures/demo.xml');

/** Uma tela: como chegar nela a partir do editor aberto. */
interface Shot {
  /** Sai também no tema escuro, com o sufixo "-<tema>". */
  bothThemes?: boolean;
  name: string;
  /**
   * Roda na página antes da captura, dentro de uma função assíncrona.
   * `await wait(seletor, texto?)` espera um elemento aparecer e falha se não
   * vier, para uma captura errada não ir parar na página do projeto.
   */
  prepare?: string;
  /** O arquivo, a partir da raiz do repositório, sem ".jpg". */
  site: string;
}

const OPEN_SEARCH = `location.hash = 'producoes';
  await settle();
  (await wait('.search-btn')).click();
  const input = await wait('.palette-input');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(input, 'artigo');
  input.dispatchEvent(new Event('input', { bubbles: true }))`;
const OPEN_NEW_ITEM = `location.hash = 'producoes';
  await settle();
  (await wait('[aria-label="Novo item"]')).click()`;

/** A prévia do vídeo e a imagem do schema.org, nos dois temas, e a busca. */
const SITE_SHOTS: Shot[] = [
  {
    bothThemes: true,
    name: 'producoes',
    prepare: `location.hash = 'producoes'`,
    site: 'site/img/editor',
  },
  { name: 'ir-para', prepare: OPEN_SEARCH, site: 'site/img/homepage/search' },
];

/** O Panorama na página do projeto: as quatro vistas. */
const PANORAMA_SHOTS: Shot[] = [
  {
    name: 'panorama',
    prepare: `location.hash = 'panorama/producoes-por-ano'`,
    site: 'site/img/homepage/panorama',
  },
  {
    name: 'panorama-health',
    prepare: `location.hash = 'panorama/saude-do-curriculo'`,
    site: 'site/img/homepage/panorama-health',
  },
  {
    name: 'panorama-people',
    prepare: `location.hash = 'panorama/pessoas';
      (await wait('[role=radio]', 'Rede')).click()`,
    site: 'site/img/homepage/panorama-people',
  },
  {
    name: 'panorama-timeline',
    prepare: `location.hash = 'panorama/linha-do-tempo'`,
    site: 'site/img/homepage/panorama-timeline',
  },
];

/** As telas da abertura da página do projeto. */
const HERO_SHOTS: Shot[] = [
  {
    name: 'hero-editor',
    prepare: `location.hash = 'producoes'`,
    site: 'site/img/homepage/hero-editor',
  },
  {
    name: 'hero-panorama',
    prepare: `location.hash = 'panorama/producoes-por-ano'`,
    site: 'site/img/homepage/hero-panorama',
  },
  { name: 'hero-new', prepare: OPEN_NEW_ITEM, site: 'site/img/homepage/hero-new' },
];

// Disponível nos `prepare`: `wait` espera um elemento (até 5 s), opcionalmente
// pelo texto exato, e falha quando ele não aparece; `settle` dá meio segundo
// para o gráfico terminar de montar (o Panorama mede a largura e redesenha).
const WAIT = `const wait = async (selector, text) => {
  for (let i = 0; i < 50; i++) {
    const found = [...document.querySelectorAll(selector)].find(
      (element) => !text || element.textContent.trim() === text,
    );
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Não apareceu: ' + selector + (text ? ' "' + text + '"' : ''));
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 500));`;

interface Viewport {
  height: number;
  width: number;
}
const WIDE: Viewport = { height: 860, width: 1440 };

async function capture(
  theme: 'claro' | 'escuro',
  shots: Shot[],
  viewport: Viewport,
): Promise<void> {
  const cdp = await openTab();
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    deviceScaleFactor: 2,
    mobile: false,
    ...viewport,
  });
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: theme === 'claro' ? 'light' : 'dark' }],
  });

  const shoot = async (shot: Shot) => {
    const { data } = await cdp.send<{ data: string }>('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 80,
    });
    const files = shot.bothThemes
      ? [join(root, `${shot.site}-${theme}.jpg`)]
      : theme === 'claro'
        ? [join(root, `${shot.site}.jpg`)]
        : [];
    for (const file of files) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, Buffer.from(data, 'base64'));
      console.log(file.replace(root, ''));
    }
  };
  const evaluate = async (expression: string) => {
    const { exceptionDetails } = await cdp.send<{
      exceptionDetails?: { exception?: { description?: string }; text: string };
    }>('Runtime.evaluate', { awaitPromise: true, expression });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    }
  };

  // Sem currículo guardado (o do tema anterior sai), a página abre na tela inicial.
  await cdp.send('Storage.clearDataForOrigin', {
    origin: new URL(url).origin,
    storageTypes: 'all',
  });
  await cdp.send('Page.navigate', { url });
  await sleep(1500);

  const { root: doc } = await cdp.send<{ root: { nodeId: number } }>('DOM.getDocument');
  const { nodeId } = await cdp.send<{ nodeId: number }>('DOM.querySelector', {
    nodeId: doc.nodeId,
    selector: 'input[type=file]',
  });
  await cdp.send('DOM.setFileInputFiles', { files: [fixture], nodeId });
  await sleep(2000);

  // O modo de privacidade vem ligado, e as telas do site saem com os dados à
  // mostra (o currículo é o de demonstração). A troca recarrega a página; o
  // currículo fica no IndexedDB e volta aberto.
  await evaluate(`localStorage.setItem('lattes-editor:privacidade', '0'); location.reload()`);
  await sleep(2500);
  for (const shot of shots) {
    // Fecha o que a captura anterior abriu (⌘K, modal) e volta ao topo.
    await evaluate(
      `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); scrollTo(0, 0)`,
    );
    await sleep(300);
    if (shot.prepare) await evaluate(`(async () => { ${WAIT} ${shot.prepare} })()`);
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

await withHeadlessBrowser(async () => {
  await capture('claro', [...SITE_SHOTS, ...HERO_SHOTS, ...PANORAMA_SHOTS], WIDE);
  await capture(
    'escuro',
    SITE_SHOTS.filter((s) => s.bothThemes),
    WIDE,
  );
  await captureOgImage();
});
