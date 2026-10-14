// Monta a extensão do conector em dist-extension/: um IIFE por ponto de entrada
// (service worker, script do editor, painel, script injetado no Lattes), o
// manifest e os arquivos estáticos do painel. Com --loja, monta em
// dist-extension-loja/ o pacote para a Chrome Web Store, sem a chave do manifest.
// Com --canal-dev, monta em dist-extension-dev/ a extensão do canal Dev: outro
// ID, outro nome e o host nativo do LattesEditor Dev, para as duas conviverem
// no mesmo navegador. LATTES_VERSAO, se definida, troca a versão do
// package.json (o canal Dev usa 0.22.0-dev.42).

import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

import { hostPermissions } from '../extension/src/lattes-hosts.ts';
import { DEFAULT_TOOLBAR_THEME, toolbarIconPaths } from '../extension/src/toolbar-icon.ts';

// fileURLToPath, não .pathname: no Windows, o pathname vem como /D:/a/... e
// vira D:\D:\a\... ao abrir o arquivo.
const root = fileURLToPath(new URL('../', import.meta.url));
// A loja recusa o pacote com "key" e dá o próprio ID na primeira publicação.
const forStore = process.argv.includes('--loja');
const devChannel = process.argv.includes('--canal-dev');
const out = `${root}${forStore ? 'dist-extension-loja' : devChannel ? 'dist-extension-dev' : 'dist-extension'}`;
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as { version: string };
const version = process.env.LATTES_VERSAO || pkg.version;
/** O Chrome só aceita números na versão: 0.22.0-dev.42 vira 0.22.0.42 (o texto inteiro vai em version_name). */
const manifestVersion = version.replace(/-[a-z]+\./i, '.');

/** Host nativo do app (src-tauri/src/conector.rs, HOST_NAME). */
const NATIVE_HOST = devChannel ? 'lattes_editor.conector_dev' : 'lattes_editor.conector';

/**
 * Onde o editor roda. Localhost cobre o desenvolvimento (qualquer porta). O
 * editor não é hospedado (só o app de desktop se distribui); a ligação do app
 * com a extensão ainda está em aberto (ROADMAP).
 */
const EDITOR_MATCHES = ['http://localhost/*', 'http://127.0.0.1/*'];

const ENTRIES = ['background', 'content', 'panel', 'lattes-runner', 'offscreen'];

/**
 * Chave pública (DER em base64) da extensão do canal Dev, que fixa o ID
 * alopgghbefjbmjomhgoebbjnmppokkgi. A privada não é usada nem guardada.
 */
const DEV_EXTENSION_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtBvNUqSTyD5FIUrbUVibxTVxgmpQeEuRzBcoT82UNeQJ5fgdEbxMTgPITrWJYJh2OGMyhur7JoOwL6dyf4t9545sELRCmfBPOZXYtm4Qs67ybeDXJmltHHIZdtMGsOxuKtFfqtM8Q4djOsKOD2jYOgyE3a4ENaaLEadTErlKkUkVcE3TGE8MTQbR44suMSs4AXSymM+7WCSzPTnbA3iGIBj9rKGY4Ng/GQ3bgANFF2sKUiIJf9gQ8R6ANohq+jM/FH06RcL/CSRizuMbYcYFFN5MR/V8QZ8TrdRHDYgzsOghe6d0G4mKrja3gOGfa8A0UYA1OWoOGYhcBDPLnqAEoQIDAQAB';

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
        name: `conector_${name.replace('-', '_')}`,
      },
      minify: false,
      outDir: out,
    },
    configFile: false,
    define: {
      __CANAL_DEV__: JSON.stringify(devChannel),
      __NATIVE_HOST__: JSON.stringify(NATIVE_HOST),
    },
    logLevel: 'warn',
  });
}

const ICONS = Object.fromEntries([16, 32, 48, 128].map((n) => [n, `icons/icon-${n}.png`]));
// Na barra, a variante monocromática (brand/extension-toolbar); o service worker troca
// para a branca quando o tema é escuro (extension/src/toolbar-icon.ts).
const TOOLBAR_ICONS = toolbarIconPaths(DEFAULT_TOOLBAR_THEME);

// Permissões no mínimo que o conector usa (política da Chrome Web Store: "the
// narrowest permissions necessary"): só o domínio do editor do Lattes. A foto
// do perfil é carregada pela página do editor, não pela extensão.
const manifest = {
  action: { default_icon: TOOLBAR_ICONS, default_title: devChannel ? 'Conector Dev' : 'Conector' },
  background: { service_worker: 'background.js' },
  content_scripts: [{ js: ['content.js'], matches: EDITOR_MATCHES, run_at: 'document_start' }],
  description:
    'Envia ao Lattes as alterações feitas no Editor do Currículo Lattes, a partir da sua própria sessão.',
  // No canal Dev, também o Lattes simulado em localhost (pnpm dev:lattes).
  host_permissions: hostPermissions(devChannel),
  icons: ICONS,
  // Chave pública fixa: o ID da extensão fica o mesmo em qualquer pasta
  // (elkaiefkldcngjdgelfjhjbljefbemac), e é esse ID que o app autoriza no
  // host de mensagens nativas (src-tauri/src/conector.rs).
  ...(forStore ? {} : { key: devChannel ? DEV_EXTENSION_KEY : EXTENSION_KEY }),
  manifest_version: 3,
  name: devChannel ? 'LattesEditor Dev: Conector' : 'LattesEditor: Conector',
  // Sem "tabs": achar a aba do Lattes pela URL basta com a permissão de host.
  // nativeMessaging fala com o app de desktop; alarms refaz a ligação; offscreen
  // lê o tema do navegador para o ícone da barra (o service worker não tem matchMedia).
  permissions: ['alarms', 'nativeMessaging', 'offscreen', 'scripting', 'sidePanel', 'storage'],
  side_panel: { default_path: 'panel.html' },
  version: manifestVersion,
  ...(manifestVersion === version ? {} : { version_name: version }),
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
if (forStore) {
  console.warn(
    'Pacote da loja: o ID da extensão será o da Chrome Web Store, e o app só fala com os IDs de ' +
      'EXTENSION_IDS (src-tauri/src/conector.rs). Confira que o ID da loja está lá antes de publicar.',
  );
}
