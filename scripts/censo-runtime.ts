import { fileURLToPath } from 'node:url';

import { build } from 'vite';

/** Compila o controlador que será embutido no srcdoc do quadro de origem opaca. */
export async function censusFrameRuntime(): Promise<string> {
  const result = await build({
    build: {
      lib: {
        entry: fileURLToPath(new URL('../extension/src/censo-frame-runtime.ts', import.meta.url)),
        formats: ['iife'],
        name: 'censo_frame',
      },
      minify: false,
      write: false,
    },
    configFile: false,
    logLevel: 'warn',
  });
  const output = Array.isArray(result) ? result[0] : result;
  if (!output || !('output' in output))
    throw new Error('Não foi possível montar o controlador do quadro Dev');
  const code = output.output.find((file) => file.type === 'chunk')?.code;
  if (!code) throw new Error('Controlador do quadro Dev vazio');
  return code;
}
