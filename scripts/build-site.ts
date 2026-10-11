// Monta a página inicial para publicar (GitHub Pages): site/ na raiz e o
// editor, já gerado por `pnpm build`, em app/index.html.

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';

const out = new URL('../dist-site/', import.meta.url);
const app = new URL('../dist/index.html', import.meta.url);

if (!existsSync(app)) {
  console.error('dist/index.html não existe; rode `pnpm build` antes.');
  process.exit(1);
}

rmSync(out, { force: true, recursive: true });
cpSync(new URL('../site/', import.meta.url), out, { recursive: true });
mkdirSync(new URL('app/', out), { recursive: true });
cpSync(app, new URL('app/index.html', out));
console.log('dist-site/ pronto: página inicial na raiz, editor em app/.');
