// Capturas do editor para o README e a página do projeto, sempre com o
// currículo de demonstração (fixtures/demo.xml, uma pesquisadora fictícia,
// pnpm gen:demo), nunca com um real.
//
// Usa um Brave ou Chrome sem janela, com perfil temporário, falando pelo
// protocolo de depuração (sem Playwright nem outra dependência). Cada tela
// sai nos temas claro e escuro, em docs/img/<nome>-<tema>.jpg, numa janela de
// 1440 × 860 em 2x. A de Produções também vai para a página do projeto, em
// site/img/editor-<tema>.jpg. As demais capturas da página saem só no tema
// claro, em site/img/homepage/: as do Panorama na mesma janela e as da
// abertura e da busca numa janela de 1024 × 640, porque a página as mostra
// pequenas e numa janela larga o texto do app some. Por fim, a imagem de
// prévia da página (site/img/og.png, 1200 × 630) sai de
// scripts/og-card.html, servido pelo mesmo Vite.
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
const outDir = join(root, 'docs/img');

/** Uma tela: como chegar nela a partir do editor aberto. */
interface Shot {
  /** Outra cópia, sem o "-<tema>.jpg" (caminho a partir da raiz do repositório). */
  alsoTo?: string;
  name: string;
  /**
   * Roda na página antes da captura, dentro de uma função assíncrona.
   * `await wait(seletor, texto?)` espera um elemento aparecer e falha se não
   * vier, para uma captura errada não ir parar na página do projeto.
   */
  prepare?: string;
  /**
   * Modo de privacidade (dados pessoais mascarados). Só Dados gerais o mostra
   * ligado.
   */
  privacy?: boolean;
  /** Só a página do projeto (caminho a partir da raiz, sem ".jpg"). */
  site?: string;
  /** Antes de abrir o currículo (a tela inicial). */
  welcome?: boolean;
}

const OPEN_SEARCH = `location.hash = 'producoes';
  (await wait('.search-btn')).click();
  const input = await wait('.palette-input');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(input, 'artigo');
  input.dispatchEvent(new Event('input', { bubbles: true }))`;
const OPEN_NEW_ITEM = `location.hash = 'producoes';
  (await wait('[aria-label="Novo item"]')).click()`;

/** As telas do README, nos dois temas. */
const DOC_SHOTS: Shot[] = [
  { name: 'inicio', welcome: true },
  { alsoTo: 'site/img/editor', name: 'producoes', prepare: `location.hash = 'producoes'` },
  { name: 'dados-gerais', prepare: `location.hash = 'dados-gerais'`, privacy: true },
  { name: 'ir-para', prepare: OPEN_SEARCH },
  { name: 'novo-item', prepare: OPEN_NEW_ITEM },
];

/**
 * O Panorama na página do projeto, na janela larga: três vistas e a passagem
 * do gráfico ao item. A barra de 2023 tem um artigo só, e o filtro de
 * Produções o reproduz, então o clique abre a seção direto, sem passar pela
 * seleção.
 */
const PANORAMA_SHOTS: Shot[] = [
  {
    name: 'panorama',
    prepare: `location.hash = 'panorama/producoes-por-ano'`,
    site: 'site/img/homepage/panorama',
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
  {
    name: 'panorama-item',
    prepare: `location.hash = 'panorama/producoes-por-ano';
      const mark = await wait('.pano-mark[aria-label="2023, Artigos: 1"]');
      await settle();
      mark.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait('.filter-status')`,
    site: 'site/img/homepage/panorama-item',
  },
];

/** A abertura e a busca da página do projeto, na janela estreita. */
const NARROW_SHOTS: Shot[] = [
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
  { name: 'search', prepare: OPEN_SEARCH, site: 'site/img/homepage/search' },
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
const NARROW: Viewport = { height: 640, width: 1024 };

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
    const files = shot.site
      ? [join(root, `${shot.site}.jpg`)]
      : [join(outDir, `${shot.name}-${theme}.jpg`)];
    if (shot.alsoTo) files.push(join(root, `${shot.alsoTo}-${theme}.jpg`));
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
  for (const shot of shots.filter((s) => s.welcome)) await shoot(shot);

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
  for (const shot of shots.filter((s) => !s.welcome)) {
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

mkdirSync(outDir, { recursive: true });
await withHeadlessBrowser(async () => {
  await capture('claro', [...DOC_SHOTS, ...PANORAMA_SHOTS], WIDE);
  await capture('escuro', DOC_SHOTS, WIDE);
  await capture('claro', NARROW_SHOTS, NARROW);
  await captureOgImage();
});
