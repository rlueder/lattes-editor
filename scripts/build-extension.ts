// Monta a extensão da ponte em dist-extension/: um IIFE por ponto de entrada
// (service worker, script do editor, painel, script injetado no Lattes), o
// manifest e os arquivos estáticos do painel.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { build } from 'vite';

const root = new URL('../', import.meta.url).pathname;
const out = `${root}dist-extension`;
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as { version: string };

/**
 * Onde o editor roda. Localhost cobre o desenvolvimento (qualquer porta). Quando
 * o editor for publicado (GitHub Pages), o domínio entra aqui.
 */
const EDITOR_MATCHES = ['http://localhost/*', 'http://127.0.0.1/*'];

const ENTRIES = ['background', 'content', 'panel', 'lattes-runner'];

mkdirSync(out, { recursive: true });
for (const name of ENTRIES) {
  await build({
    build: {
      emptyOutDir: false,
      lib: {
        entry: `${root}extension/src/${name}.ts`,
        fileName: () => `${name}.js`,
        formats: ['iife'],
        name: `ponte_${name.replace('-', '_')}`,
      },
      minify: false,
      outDir: out,
    },
    configFile: false,
    logLevel: 'warn',
  });
}

const ICONS = Object.fromEntries([16, 32, 48, 128].map((n) => [n, `icons/icon-${n}.png`]));

// Permissões no mínimo que a ponte usa (política da Chrome Web Store: "the
// narrowest permissions necessary"): só o domínio do editor do Lattes. A foto
// do perfil é carregada pela página do editor, não pela extensão.
const manifest = {
  action: { default_icon: ICONS, default_title: 'Ponte com o Lattes' },
  background: { service_worker: 'background.js' },
  content_scripts: [{ js: ['content.js'], matches: EDITOR_MATCHES, run_at: 'document_start' }],
  description:
    'Envia ao Lattes as alterações feitas no Editor do Currículo Lattes, a partir da sua própria sessão.',
  host_permissions: ['https://wwws.cnpq.br/*'],
  icons: ICONS,
  manifest_version: 3,
  name: 'LattesEditor: ponte com o Lattes',
  // Sem "tabs": achar a aba do Lattes pela URL basta com a permissão de host.
  permissions: ['scripting', 'sidePanel', 'storage'],
  side_panel: { default_path: 'panel.html' },
  version: pkg.version,
};
writeFileSync(`${out}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
for (const file of ['panel.html', 'panel.css'])
  copyFileSync(`${root}extension/${file}`, `${out}/${file}`);
mkdirSync(`${out}/icons`, { recursive: true });
for (const icon of Object.values(ICONS)) copyFileSync(`${root}extension/${icon}`, `${out}/${icon}`);
console.log(`Extensão em ${out}`);
