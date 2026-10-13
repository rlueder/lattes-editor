// Imagens da página da extensão na Chrome Web Store, em docs/img/loja/.
//
// O painel é o da extensão de verdade (dist-extension/panel.html), com um
// `chrome` falso que entrega uma fila de exemplo, com dados fictícios. Depois,
// scripts/store-cards.html monta as peças no tamanho que a loja pede: a imagem
// promocional pequena (440 × 280) e as capturas (1280 × 800), em JPEG, que não
// tem canal alfa.
//
//   pnpm build:extension
//   pnpm dev                    # o editor em http://localhost:5173 (ou outra porta)
//   pnpm capture:store [url]    # padrão: http://localhost:5173/

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { assertRendered, type Cdp, openTab, withHeadlessBrowser } from './headless.ts';

const root = new URL('../', import.meta.url).pathname;
const url = process.argv[2] ?? 'http://localhost:5173/';
const outDir = join(root, 'docs/img/loja');

if (!existsSync(join(root, 'dist-extension/panel.js'))) {
  throw new Error('Rode pnpm build:extension antes: o painel capturado é o da extensão montada');
}

/** Fila de exemplo: duas alterações conferidas e uma esperando, com o Lattes verificado. */
const QUEUE = {
  editor: 'app',
  ops: [
    {
      expect: { F_TEXTO: 'Professora e pesquisadora em ecologia de populações.' },
      key: 'resumo',
      kind: 'resumo',
      label: 'Resumo',
      set: {
        F_TEXTO:
          'Professora e pesquisadora em ecologia de populações, com foco em polinizadores do Cerrado.',
      },
    },
    {
      code: 'EN',
      expect: { F_CONVERSA: 'R', F_ESCREVE: 'R' },
      key: 'idioma-en',
      kind: 'idioma',
      label: 'Idioma: Inglês',
      set: { F_CONVERSA: 'B', F_ESCREVE: 'B' },
    },
    {
      expect: { f_ano_fim: '', f_status: 'S' },
      key: 'vinculo',
      kind: 'vinculo',
      label: 'Vínculo: Universidade Federal de Exemplo',
      seqAtiv: '1',
      seqHist: '1',
      set: { f_ano_fim: '2025', f_status: 'N' },
    },
  ],
  results: {
    'idioma-en': { detail: '', key: 'idioma-en', status: 'conferido' },
    resumo: { detail: '', key: 'resumo', status: 'conferido' },
  },
  running: false,
  verificacao: {
    checkedAt: '2026-10-12T21:40:00.000Z',
    forms: [],
    menu: [],
    status: 'ok',
  },
};

/** O mínimo da API chrome que o painel usa, antes de qualquer script da página. */
function chromeStub(consented: boolean): string {
  const local = consented ? { consentimento: { at: '2026-10-12T21:30:00.000Z', version: 1 } } : {};
  return `window.chrome = {
    runtime: {
      getManifest: () => ({ version: 'loja' }),
      getURL: (p) => p,
      sendMessage: () => Promise.resolve(),
    },
    storage: {
      local: { get: async () => (${JSON.stringify(local)}), set: async () => {} },
      session: { get: async () => ({ fila: ${JSON.stringify(QUEUE)} }), set: async () => {} },
      onChanged: { addListener() {} },
    },
  };`;
}

async function screenshot(cdp: Cdp, file: string, format: 'jpeg' | 'png'): Promise<void> {
  const { data } = await cdp.send<{ data: string }>('Page.captureScreenshot', {
    format,
    ...(format === 'jpeg' ? { quality: 92 } : {}),
  });
  writeFileSync(join(outDir, file), Buffer.from(data, 'base64'));
  console.log(`docs/img/loja/${file}`);
}

/** O painel da extensão, no tema claro, numa largura de painel lateral. */
async function capturePanel(name: 'aviso' | 'fila'): Promise<void> {
  const cdp = await openTab();
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: chromeStub(name === 'fila') });
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    deviceScaleFactor: 2,
    height: 680,
    mobile: false,
    width: 400,
  });
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }],
  });
  await cdp.send('Page.navigate', { url: new URL('/dist-extension/panel.html', url).href });
  await assertRendered(
    cdp,
    `Painel (${name})`,
    name === 'fila' ? '#conector:not([hidden])' : '#aviso:not([hidden])',
    {
      needsImages: false,
    },
  );
  await screenshot(cdp, `painel-${name}.png`, 'png');
  cdp.close();
}

async function captureCard(id: string, width: number, height: number): Promise<void> {
  const cdp = await openTab();
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    deviceScaleFactor: 1,
    height,
    mobile: false,
    width,
  });
  await cdp.send('Page.navigate', { url: new URL(`/scripts/store-cards.html#${id}`, url).href });
  await assertRendered(cdp, `Peça da loja (#${id})`, `#${id}`);
  await screenshot(cdp, `${id}-${width}x${height}.jpg`, 'jpeg');
  cdp.close();
}

mkdirSync(outDir, { recursive: true });
await withHeadlessBrowser(async () => {
  await capturePanel('fila');
  await capturePanel('aviso');
  await captureCard('promo', 440, 280);
  await captureCard('fila', 1280, 800);
  await captureCard('aviso', 1280, 800);
});
