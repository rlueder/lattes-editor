// Monta dist-censo/conector-ponte.js (o núcleo do conector) e
// dist-censo/carregar-ponte.js ("Carregar do Lattes") para a ponte local
// (scripts/*-ponte-entry.ts). Só para testes acompanhados.
//
//   node scripts/build-conector-ponte.ts
//   node scripts/censo-ponte.ts carregar dist-censo/conector-ponte.js

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

import { decodeLatin1 } from '../src/model/latin1.ts';

const root = fileURLToPath(new URL('../', import.meta.url));

for (const [entry, file] of [
  ['conector-ponte-entry.ts', 'conector-ponte.js'],
  ['carregar-ponte-entry.ts', 'carregar-ponte.js'],
  ['passada-ponte-entry.ts', 'passada-ponte.js'],
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
    // O exemplo sintético para a passada (passada-ponte-entry.ts), já em texto:
    // o arquivo é Latin-1, e o ?raw do Vite o leria como UTF-8.
    define: {
      __EXEMPLO__: JSON.stringify(decodeLatin1(readFileSync(`${root}fixtures/synthetic_full.xml`))),
    },
    logLevel: 'warn',
  });
  console.log(`dist-censo/${file}`);
}
