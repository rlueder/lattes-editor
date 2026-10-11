import { readFileSync } from 'node:fs';

import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Embute JS e CSS no index.html. Módulos externos não carregam por file://
 * (o navegador bloqueia por CORS), e o app precisa abrir com dois cliques no
 * arquivo, sem servidor. Um script inline funciona.
 */
function inlineBundle(): Plugin {
  return {
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
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
        }
      }
      html.source = source;
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
  // Versão mostrada no menu de configurações.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), inlineBundle()],
  test: {
    coverage: {
      exclude: ['src/**/*.tsx', 'src/schema/**', 'src/model/store.ts', 'src/ui/use-*.ts'],
      // Lógica pura: modelo, ZIP, seções, busca do ⌘K e rótulos. Componentes
      // React e o IndexedDB ficam para os testes de fluxo com Playwright.
      include: ['src/**/*.ts'],
      provider: 'v8',
      thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 },
    },
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
