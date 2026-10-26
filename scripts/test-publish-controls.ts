// Painel real, declaração sintética e transporte substituído por um registro
// em memória. Não usa sessão da pessoa, extensão nem pedidos ao CNPq.

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

import { type Cdp, openTab, withHeadlessBrowser } from './headless.ts';

if (
  ['LATTES_PERFIL', 'LATTES_JANELA', 'LATTES_EXTENSAO'].some(
    (name) => process.env[name] !== undefined,
  )
) {
  throw new Error('Este teste exige perfil temporário, sem janela e sem extensão.');
}

const entry = fileURLToPath(new URL('./publish-controls-entry.ts', import.meta.url));
const panel = fileURLToPath(new URL('../src/import-export/PublishPanel.tsx', import.meta.url));
const built = await build({
  build: {
    lib: { entry, formats: ['iife'], name: 'publish_controls' },
    minify: false,
    write: false,
  },
  configFile: false,
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0-teste'),
    __CANAL_DEV__: 'false',
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  logLevel: 'error',
  plugins: [
    {
      enforce: 'pre',
      load(id) {
        if (id === '\0publish-controls-hook')
          return 'export function usePublish() { return window.testPublishBridge; }';
        if (id === '\0publish-controls-preview')
          return 'export function simulatedSendScreen() { return window.testPreview ? window.testPublishBridge.screen : undefined; }';
        if (id !== '\0publish-controls') return undefined;
        return `
        import { createElement } from 'react';
        import { flushSync } from 'react-dom';
        import { createRoot } from 'react-dom/client';
        import { PublishPanel } from ${JSON.stringify(panel)};
        const root = createRoot(document.getElementById('root'));
        const declaration = 'Declaração sintética para testar o painel, sem qualquer efeito no CNPq ou aceite de termos reais.';
        window.testPublishBridge = {
          screen: { at: Date.now(), id: 'test-screen', screen: {
            declaration, agree: 'Aceitar a declaração sintética',
            emailAlternative: '', emailContact: 'teste@example.org',
            english: { checked: true, label: 'Versão em inglês', value: '1' },
            language: { options: [{ label: 'Português', value: '1' }], selected: '1' },
            terms: 'https://example.org/termos-sinteticos'
          } },
          requestScreen: () => 'test-screen',
          publish: request => { window.publishRequests.push(request); return 'test-attempt'; }
        };
        const bridge = { available: true, features: ['enviar-cnpq', 'publicar-cnpq'], sent: [],
          lattes: { pending: true, lastPublished: '2026-10-25' },
          requestEspelho() {}, checkSent() {}
        };
        let serial = 0;
        function render(open) {
          flushSync(() => root.render(createElement(PublishPanel, {
            key: serial, bridge, inline: true, lattesId: '1', open, onClose() {}
          })));
        }
        window.openPublishTest = preview => {
          window.testPreview = preview; window.publishRequests = []; serial++; render(true);
        };
        window.setPublishOpen = render;
        window.setPublishCapability = enabled => {
          bridge.features = enabled ? ['enviar-cnpq', 'publicar-cnpq'] : ['enviar-cnpq'];
          render(true);
        };
        window.setPublishAvailable = available => { bridge.available = available; render(true); };
      `;
      },
      name: 'publish-controls',
      resolveId(id) {
        if (id === entry) return '\0publish-controls';
        if (id.endsWith('/use-publish.ts')) return '\0publish-controls-hook';
        if (id.endsWith('/send-screen-preview.ts')) return '\0publish-controls-preview';
        return undefined;
      },
    },
  ],
});
const output = Array.isArray(built) ? built[0] : built;
if (!output || !('output' in output)) throw new Error('O teste não montou o painel.');
const code = output.output.find((chunk) => chunk.type === 'chunk')?.code;
if (!code) throw new Error('O painel montado está vazio.');

async function evaluate<T>(cdp: Cdp, expression: string): Promise<T> {
  const result = await cdp.send<{
    exceptionDetails?: { exception?: { description?: string }; text?: string };
    result: { value: T };
  }>('Runtime.evaluate', {
    awaitPromise: true,
    expression,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      `O teste falhou no navegador: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`,
    );
  return result.result.value;
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
      const settle = () =>
        evaluate(cdp, 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
      await evaluate(cdp, 'window.openPublishTest(false)');
      await settle();
      assert.equal(
        await evaluate(cdp, 'document.querySelector(".publish-agree input").checked'),
        false,
      );
      assert.equal(await evaluate(cdp, 'document.querySelector("button.primary").disabled'), true);
      await evaluate(cdp, 'document.querySelector(".publish-agree input").click()');
      await settle();
      assert.equal(await evaluate(cdp, 'document.querySelector("button.primary").disabled'), false);
      await evaluate(
        cdp,
        `window.testPublishBridge.screen = {
      ...window.testPublishBridge.screen, at: window.testPublishBridge.screen.at + 1
    }; window.setPublishOpen(true)`,
      );
      await settle();
      assert.equal(
        await evaluate(cdp, 'document.querySelector(".publish-agree input").checked'),
        false,
      );
      assert.equal(await evaluate(cdp, 'document.querySelector("button.primary").disabled'), true);
      await evaluate(cdp, 'document.querySelector(".publish-agree input").click()');
      await settle();
      await evaluate(
        cdp,
        `window.testPublishBridge.screen = {
      ...window.testPublishBridge.screen,
      screen: { ...window.testPublishBridge.screen.screen,
        declaration: 'Declaração sintética nova, apenas para testar que um texto diferente exige outro aceite.' }
    }; window.setPublishOpen(true)`,
      );
      await settle();
      assert.equal(
        await evaluate(cdp, 'document.querySelector(".publish-agree input").checked'),
        false,
      );
      assert.equal(await evaluate(cdp, 'document.querySelector("button.primary").disabled'), true);
      assert.equal(await evaluate(cdp, 'window.publishRequests.length'), 0);
      await evaluate(cdp, 'document.querySelector(".publish-agree input").click()');
      await settle();
      await evaluate(cdp, 'window.setPublishOpen(false)');
      await evaluate(cdp, 'window.setPublishOpen(true)');
      await settle();
      assert.equal(
        await evaluate(cdp, 'document.querySelector(".publish-agree input").checked'),
        false,
      );
      assert.equal(await evaluate(cdp, 'document.querySelector("button.primary").disabled'), true);
      await evaluate(cdp, 'document.querySelector(".publish-agree input").click()');
      await settle();
      await evaluate(cdp, 'document.querySelector("button.primary").click()');
      await settle();
      assert.equal(await evaluate(cdp, 'window.publishRequests.length'), 1);
      assert.equal(await evaluate(cdp, 'window.publishRequests[0].declarationAccepted'), true);
      assert.equal(
        await evaluate(cdp, 'window.publishRequests[0].declarationText'),
        'Declaração sintética nova, apenas para testar que um texto diferente exige outro aceite.',
      );
      assert.equal(
        await evaluate(cdp, 'document.querySelector(".publish-agree input").checked'),
        false,
      );
      assert.equal(await evaluate(cdp, 'document.querySelector("button.primary")'), null);
      await evaluate(cdp, 'window.openPublishTest(true)');
      await settle();
      await evaluate(cdp, 'document.querySelector(".publish-agree input").click()');
      await settle();
      assert.equal(await evaluate(cdp, 'document.querySelector("button.primary").disabled'), true);
      await evaluate(cdp, 'document.querySelector("button.primary").click()');
      assert.equal(await evaluate(cdp, 'window.publishRequests.length'), 0);
      await evaluate(cdp, 'window.openPublishTest(false)');
      await settle();
      await evaluate(cdp, 'window.setPublishCapability(false)');
      await settle();
      await evaluate(cdp, 'document.querySelector(".publish-agree input").click()');
      await settle();
      assert.equal(await evaluate(cdp, 'document.querySelector("button.primary").disabled'), true);
      await evaluate(cdp, 'document.querySelector("button.primary").click()');
      assert.equal(await evaluate(cdp, 'window.publishRequests.length'), 0);
      assert.equal(
        await evaluate(cdp, 'document.body.textContent.includes("Atualize a extensão")'),
        true,
      );
      await evaluate(cdp, 'window.setPublishAvailable(false); window.setPublishCapability(true)');
      await settle();
      assert.equal(await evaluate(cdp, 'document.querySelector("button.primary").disabled'), true);
      await evaluate(cdp, 'document.querySelector("button.primary").click()');
      assert.equal(await evaluate(cdp, 'window.publishRequests.length'), 0);
      console.log(
        'Publicação: declaração desmarcada ao reabrir, uma tentativa por aceite e prévia sem envio conferidas com transporte sintético.',
      );
    } finally {
      cdp.close();
    }
  },
  { isolated: true },
);
