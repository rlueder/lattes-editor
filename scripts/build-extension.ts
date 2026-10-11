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

const manifest = {
  action: { default_title: 'Ponte com o Lattes' },
  background: { service_worker: 'background.js' },
  content_scripts: [{ js: ['content.js'], matches: EDITOR_MATCHES, run_at: 'document_start' }],
  description:
    'Envia ao Lattes as alterações feitas no Editor do Currículo Lattes, a partir da sua própria sessão.',
  host_permissions: [
    'https://wwws.cnpq.br/*',
    'http://buscatextual.cnpq.br/*',
    'https://servicosweb.cnpq.br/*',
  ],
  manifest_version: 3,
  name: 'LattesEditor: ponte com o Lattes',
  permissions: ['scripting', 'sidePanel', 'storage', 'tabs'],
  side_panel: { default_path: 'panel.html' },
  version: pkg.version,
};
writeFileSync(`${out}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
for (const file of ['panel.html', 'panel.css'])
  copyFileSync(`${root}extension/${file}`, `${out}/${file}`);
console.log(`Extensão em ${out}`);
