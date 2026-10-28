// Monta dist-censo/conector-ponte.js: o núcleo do conector para a ponte local
// (scripts/conector-ponte-entry.ts). Só para testes acompanhados.
//
//   node scripts/build-conector-ponte.ts
//   node scripts/censo-ponte.ts carregar dist-censo/conector-ponte.js

import { fileURLToPath } from 'node:url';

import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));

await build({
  build: {
    emptyOutDir: false,
    lib: {
      entry: `${root}scripts/conector-ponte-entry.ts`,
      fileName: () => 'conector-ponte.js',
      formats: ['iife'],
      name: 'conector_ponte',
    },
    minify: false,
    outDir: `${root}dist-censo`,
  },
  configFile: false,
  logLevel: 'warn',
});
console.log('dist-censo/conector-ponte.js');
