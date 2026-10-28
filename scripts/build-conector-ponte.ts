// Monta dist-censo/conector-ponte.js (o núcleo do conector) e
// dist-censo/carregar-ponte.js ("Carregar do Lattes") para a ponte local
// (scripts/*-ponte-entry.ts). Só para testes acompanhados.
//
//   node scripts/build-conector-ponte.ts
//   node scripts/censo-ponte.ts carregar dist-censo/conector-ponte.js

import { fileURLToPath } from 'node:url';

import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));

for (const [entry, file] of [
  ['conector-ponte-entry.ts', 'conector-ponte.js'],
  ['carregar-ponte-entry.ts', 'carregar-ponte.js'],
]) {
  await build({
    build: {
      emptyOutDir: false,
      lib: {
        entry: `${root}scripts/${entry}`,
        fileName: () => file!,
        formats: ['iife'],
        name: file!.replace(/\W/g, '_'),
      },
      minify: false,
      outDir: `${root}dist-censo`,
    },
    configFile: false,
    logLevel: 'warn',
  });
  console.log(`dist-censo/${file}`);
}
