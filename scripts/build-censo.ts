// Monta o censo dos formulários do Lattes (LAT-55) num arquivo só,
// dist-censo/censo-lattes.js: um IIFE que, rodado na aba do menu do Lattes,
// deixa __lattesCensus na página (extension/src/censo.ts). Não faz parte da
// extensão publicada.
//
//   pnpm build:censo

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as { version: string };

await build({
  build: {
    emptyOutDir: true,
    lib: {
      entry: `${root}extension/src/censo.ts`,
      fileName: () => 'censo-lattes.js',
      formats: ['iife'],
      name: 'censo_lattes',
    },
    minify: false,
    outDir: `${root}dist-censo`,
  },
  configFile: false,
  define: { __CENSO_VERSAO__: JSON.stringify(process.env.LATTES_VERSAO || pkg.version) },
  logLevel: 'warn',
});
console.log('dist-censo/censo-lattes.js');
