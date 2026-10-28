// @ts-nocheck
// Presets compartilhados de @precisa-saude/eslint-config, os mesmos da
// platform: base (TypeScript, imports, perfectionist, prettier, limites de
// tamanho) e react (hooks, a11y, react-refresh) restrito a src/.

import base from '@precisa-saude/eslint-config/base';
import { withFiles } from '@precisa-saude/eslint-config/react';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  ...withFiles(['src/**/*.{ts,tsx}']),
  {
    ignores: [
      'src/schema/lattes.ts',
      'brand/**',
      'docs/**',
      'private/**',
      'fixtures/**',
      'dist-extension/**',
      'dist-extension-loja/**',
      'dist-extension-dev/**',
      'dist-extension-gravacao/**',
      'dist-censo/**',
      // Montagens locais do Tauri (pnpm tauri build), com cópias da extensão.
      'src-tauri/target/**',
      // Worktrees de trabalho paralelo, cada uma com o próprio lint.
      '.claude/**',
    ],
  },
  {
    // Scripts de geração rodam no Node e reportam no console.
    files: ['scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },
];
