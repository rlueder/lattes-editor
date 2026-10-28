// Interação com os controles React reais num navegador sem janela e com perfil
// temporário. Não usa a sessão da pessoa nem abre páginas do CNPq.

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

import { type Cdp, openTab, withHeadlessBrowser } from './headless.ts';

if (
  ['LATTES_PERFIL', 'LATTES_JANELA', 'LATTES_EXTENSAO'].some(
    (name) => process.env[name] !== undefined,
  )
) {
  throw new Error(
    'Este teste exige perfil temporário, sem janela e sem extensão. Retire LATTES_PERFIL, LATTES_JANELA e LATTES_EXTENSAO.',
  );
}

const entry = fileURLToPath(new URL('./contact-controls-entry.ts', import.meta.url));
const component = fileURLToPath(new URL('../src/ui/ContactFields.tsx', import.meta.url));
const built = await build({
  build: {
    lib: { entry, formats: ['iife'], name: 'contact_controls' },
    minify: false,
    write: false,
  },
  configFile: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  logLevel: 'error',
  plugins: [
    {
      enforce: 'pre',
      load: (id) =>
        id === `\0${entry}`
          ? `
      import { createElement } from 'react';
      import { flushSync } from 'react-dom';
      import { createRoot } from 'react-dom/client';
      import { ContactFields } from ${JSON.stringify(component)};
      const root = createRoot(document.getElementById('root'));
      window.mountContacts = (attr, raw) => {
        window.contactCommits = [];
        flushSync(() => root.render(createElement(ContactFields, {
          key: attr + raw, attr, label: attr, raw,
          onCommit: value => window.contactCommits.push(value)
        })));
      };
    `
          : undefined,
      name: 'contact-controls',
      resolveId: (id) => (id === entry ? `\0${entry}` : undefined),
    },
  ],
});
const output = Array.isArray(built) ? built[0] : built;
if (!output || !('output' in output)) throw new Error('O teste não montou o componente.');
const code = output.output.find((chunk) => chunk.type === 'chunk')?.code;
if (!code) throw new Error('O componente montado está vazio.');

async function evaluate<T>(cdp: Cdp, expression: string): Promise<T> {
  const reply = await cdp.send<{
    exceptionDetails?: { exception?: { description?: string }; text?: string };
    result: { value: T };
  }>('Runtime.evaluate', {
    awaitPromise: true,
    expression,
    returnByValue: true,
  });
  if (reply.exceptionDetails)
    throw new Error(
      `O código de verificação falhou no navegador: ${reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text}`,
    );
  return reply.result.value;
}

async function key(cdp: Cdp, name: string, code: number) {
  for (const type of ['keyDown', 'keyUp']) {
    await cdp.send('Input.dispatchKeyEvent', {
      code: name,
      key: name,
      type,
      windowsVirtualKeyCode: code,
    });
  }
}

await withHeadlessBrowser(
  async () => {
    const cdp = await openTab();
    try {
      await cdp.send('Network.enable');
      await cdp.send('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] });
      const { frameTree } = await cdp.send<{ frameTree: { frame: { id: string } } }>(
        'Page.getFrameTree',
      );
      await cdp.send('Page.setDocumentContent', {
        frameId: frameTree.frame.id,
        html: '<!doctype html><html lang="pt-BR"><body><div id="root"></div></body></html>',
      });
      await evaluate(cdp, code);
      const mount = async (attr: string, raw: string) => {
        await evaluate(
          cdp,
          `window.mountContacts(${JSON.stringify(attr)}, ${JSON.stringify(raw)}); new Promise(r => requestAnimationFrame(r))`,
        );
      };
      const type = async (text: string) => {
        await evaluate(
          cdp,
          `document.querySelector('input').focus(); document.querySelector('input').select()`,
        );
        await cdp.send('Input.insertText', { text });
      };
      const emails = 'I: contato@example.org; R: outro@example.org';
      await mount('ELETRONICO', emails);
      assert.equal(await evaluate(cdp, 'document.querySelectorAll("input[type=email]").length'), 2);
      await type('novo@example.org');
      await key(cdp, 'Enter', 13);
      assert.deepEqual(await evaluate(cdp, 'window.contactCommits'), [
        'I: novo@example.org; R: outro@example.org',
      ]);

      const social =
        'ID Rede Social: 0001, Nome Rede Social: Linkedin, Endereço: https://example.org/antes';
      await mount('REDE-SOCIAL', social);
      await type('javascript:alert(1)');
      await key(cdp, 'Enter', 13);
      assert.deepEqual(await evaluate(cdp, 'window.contactCommits'), []);
      assert.equal(
        await evaluate(cdp, 'document.querySelector("input").getAttribute("aria-invalid")'),
        'true',
      );
      await type('https://example.org/novo');
      await key(cdp, 'Escape', 27);
      assert.equal(
        await evaluate(cdp, 'document.querySelector("input").value'),
        'https://example.org/antes',
      );
      await type('https://example.org/novo');
      await key(cdp, 'Enter', 13);
      assert.deepEqual(await evaluate(cdp, 'window.contactCommits'), [
        social.replace('/antes', '/novo'),
      ]);

      await mount('ELETRONICO', 'contato@example.org');
      assert.equal(await evaluate(cdp, 'document.querySelectorAll("input").length'), 0);
      assert.equal(
        await evaluate(cdp, 'document.body.textContent.includes("contato@example.org")'),
        true,
      );
      console.log(
        'Contatos: edição, preservação do formato, validação e Escape conferidos em perfil temporário sem janela.',
      );
    } finally {
      cdp.close();
    }
  },
  { isolated: true },
);
