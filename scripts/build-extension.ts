// Monta a extensão da ponte em dist-extension/: um IIFE por ponto de entrada
// (service worker, script do editor, painel, script injetado no Lattes), o
// manifest e os arquivos estáticos do painel.

import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { build } from 'vite';

import { DEFAULT_TOOLBAR_THEME, toolbarIconPaths } from '../extension/src/toolbar-icon.ts';

const root = new URL('../', import.meta.url).pathname;
const out = `${root}dist-extension`;
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as { version: string };

/**
 * Onde o editor roda. Localhost cobre o desenvolvimento (qualquer porta). O
 * editor não é hospedado (só o app de desktop se distribui); a ligação do app
 * com a extensão ainda está em aberto (ROADMAP).
 */
const EDITOR_MATCHES = ['http://localhost/*', 'http://127.0.0.1/*'];

const ENTRIES = ['background', 'content', 'panel', 'lattes-runner', 'offscreen'];

/** Chave pública (DER em base64) que fixa o ID da extensão. A privada não é usada nem guardada. */
const EXTENSION_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsto1W7uktgE8f/+ZTR490rR7dwCdDbM5nOzKzEBcxdZImC7VTwhKnKWrHzxB3GOHUcdMx7cgKjSsuOetyU0NNMVhtcqd5lCDBXv+QsRRkCCRvJi+00/bmpqYUPKWXq5s3UCLWmPkRcOdzR8VXVbyW6POdxB1A3+5R2HW6RvSpYxcEue8dF85o022CEhcalF/jyIjGio9TVRZyR6XzTPV+feYGithL5Ld5+ZzGIs5blEqIUqYavwSjpb3/yvDPx9LE1BSHyA244SdDmyBHqfPH5DE0fVon1FKE84vbXylNZbjJWB8DmIn51jYd8nRlbIzI16Q6nMIzz9pH07IItu8kQIDAQAB';

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
// Na barra, a variante monocromática (brand/extension-toolbar); o service worker troca
// para a branca quando o tema é escuro (extension/src/toolbar-icon.ts).
const TOOLBAR_ICONS = toolbarIconPaths(DEFAULT_TOOLBAR_THEME);

// Permissões no mínimo que a ponte usa (política da Chrome Web Store: "the
// narrowest permissions necessary"): só o domínio do editor do Lattes. A foto
// do perfil é carregada pela página do editor, não pela extensão.
const manifest = {
  action: { default_icon: TOOLBAR_ICONS, default_title: 'Ponte com o Lattes' },
  background: { service_worker: 'background.js' },
  content_scripts: [{ js: ['content.js'], matches: EDITOR_MATCHES, run_at: 'document_start' }],
  description:
    'Envia ao Lattes as alterações feitas no Editor do Currículo Lattes, a partir da sua própria sessão.',
  host_permissions: ['https://wwws.cnpq.br/*'],
  icons: ICONS,
  // Chave pública fixa: o ID da extensão fica o mesmo em qualquer pasta
  // (elkaiefkldcngjdgelfjhjbljefbemac), e é esse ID que o app autoriza no
  // host de mensagens nativas (src-tauri/src/ponte.rs).
  key: EXTENSION_KEY,
  manifest_version: 3,
  name: 'LattesEditor: ponte com o Lattes',
  // Sem "tabs": achar a aba do Lattes pela URL basta com a permissão de host.
  // nativeMessaging fala com o app de desktop; alarms refaz a ligação; offscreen
  // lê o tema do navegador para o ícone da barra (o service worker não tem matchMedia).
  permissions: ['alarms', 'nativeMessaging', 'offscreen', 'scripting', 'sidePanel', 'storage'],
  side_panel: { default_path: 'panel.html' },
  version: pkg.version,
};
writeFileSync(`${out}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
for (const file of ['panel.html', 'panel.css', 'offscreen.html'])
  copyFileSync(`${root}extension/${file}`, `${out}/${file}`);
// A mesma IBM Plex do editor, com a licença.
mkdirSync(`${out}/fonts`, { recursive: true });
for (const file of readdirSync(`${root}src/ui/fonts`))
  copyFileSync(`${root}src/ui/fonts/${file}`, `${out}/fonts/${file}`);
mkdirSync(`${out}/icons`, { recursive: true });
for (const icon of Object.values(ICONS)) copyFileSync(`${root}extension/${icon}`, `${out}/${icon}`);
for (const theme of ['clara', 'escura'] as const) {
  for (const icon of Object.values(toolbarIconPaths(theme))) {
    mkdirSync(dirname(`${out}/${icon}`), { recursive: true });
    copyFileSync(`${root}extension/${icon}`, `${out}/${icon}`);
  }
}
console.log(`Extensão em ${out}`);
