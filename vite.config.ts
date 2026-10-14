import { readFileSync } from 'node:fs';

import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Embute JS e CSS no index.html. Vem da versão em HTML solto, que abria com
 * dois cliques por file:// (onde módulos externos não carregam). Os
 * lançamentos não publicam mais essa versão; o app de desktop não precisa do
 * arquivo único, e o plugin pode sair num próximo passo.
 */
function inlineBundle(): Plugin {
  return {
    apply: 'build',
    enforce: 'post',
    // order 'post': roda depois do generateBundle do próprio Vite, que troca o
    // marcador __VITE_PRELOAD__ dos imports dinâmicos. Antes dele, o marcador
    // ia cru para o HTML e o app de desktop, que faz esses imports ao abrir,
    // parava com ReferenceError e tela em branco.
    generateBundle: {
      handler(_options, bundle) {
        const html = Object.values(bundle).find(
          (f) => f.type === 'asset' && f.fileName.endsWith('.html'),
        );
        if (!html || html.type !== 'asset') return;
        let source = String(html.source);
        for (const [name, file] of Object.entries(bundle)) {
          if (file.type === 'chunk' && file.isEntry) {
            const tag = new RegExp(`<script[^>]*src="[^"]*${escapeRe(name)}"[^>]*></script>`);
            // "</script" dentro do código fecharia a tag antes da hora.
            const code = file.code.replace(/<\/script/gi, '<\\/script');
            source = source.replace(tag, () => `<script type="module">${code}</script>`);
            delete bundle[name];
          } else if (file.type === 'asset' && name.endsWith('.css')) {
            const tag = new RegExp(`<link[^>]*href="[^"]*${escapeRe(name)}"[^>]*>`);
            source = source.replace(tag, () => `<style>${String(file.source)}</style>`);
            delete bundle[name];
          } else if (file.type === 'asset' && name.endsWith('.svg') && source.includes(name)) {
            // O favicon vira data: URI, como o resto do bundle.
            const uri = `data:image/svg+xml,${encodeURIComponent(String(file.source))}`;
            source = source.replaceAll(`./${name}`, uri);
            delete bundle[name];
          }
        }
        html.source = source;
      },
      order: 'post',
    },
    name: 'inline-bundle',
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  base: './',
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  // Versão mostrada no menu de configurações e anunciada à extensão. O canal
  // Dev (.github/workflows/dev.yml) troca pela dele em LATTES_VERSAO.
  define: { __APP_VERSION__: JSON.stringify(process.env.LATTES_VERSAO || pkg.version) },
  plugins: [react(), inlineBundle()],
  test: {
    coverage: {
      exclude: ['src/**/*.tsx', 'src/schema/**', 'src/ui/use-*.ts'],
      // Lógica pura: modelo, ZIP, seções, busca do ⌘K e rótulos, mais o banco
      // local, testado com o fake-indexeddb. Componentes React ficam para os
      // testes de fluxo com Playwright.
      include: ['src/**/*.ts'],
      provider: 'v8',
      thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 },
    },
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
