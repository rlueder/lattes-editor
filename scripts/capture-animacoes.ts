// As animações da página do projeto, em site/img/homepage/*.webp: as três
// telas da abertura, as quatro vistas do Panorama, a busca e a impressão da seção
// Recursos (com a troca de tema) e o envio ao Lattes.
//
// Cada cena abre o currículo de demonstração (fixtures/demo.xml) numa janela
// de 1440 × 860 em 2x (os quadros têm 2880 × 1720) e grava 10 quadros por
// segundo enquanto clica e digita. O img2webp (pacote webp do Homebrew) monta
// cada WebP animado, com compressão com perdas.
//
//   pnpm dev                        # o editor em http://localhost:5173 (ou outra porta)
//   pnpm capture:animacoes [url] [cena]   # padrão: http://localhost:5173/, todas as cenas
//
// A cena `enviar` grava de verdade, no Lattes simulado, pela extensão do canal
// Dev carregada no navegador sem janela (ver LATTES_EXTENSAO e LATTES_PERFIL
// em headless.ts):
//   pnpm dev:lattes                                        # o simulado em 127.0.0.1:5197
//   node scripts/build-extension.ts --canal-dev --sem-app  # dist-extension-gravacao/
//   LATTES_EXTENSAO=dist-extension-gravacao LATTES_PERFIL=<perfil> \
//     pnpm capture:animacoes http://localhost:5173/ enviar
// A montagem --sem-app não tem o host nativo: a extensão Dev comum acordaria o
// LattesEditor Dev instalado na máquina de quem grava e mandaria a gravação
// para ele.
// O perfil precisa ter o "ok" do aviso de uso da extensão (docs/desenvolvimento.md).
// A cena abre o menu do simulado numa segunda aba, que é onde a extensão grava.
// Nada fala com o CNPq.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { openTab, sleep, withHeadlessBrowser } from './headless.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const url = process.argv[2] ?? 'http://localhost:5173/';
const fixture = join(root, 'fixtures/demo.xml');
const outDir = join(root, 'site/img/homepage');
const FPS = 10;

// Disponível nos trechos avaliados na página.
const HELPERS = `const wait = async (selector, text, ms = 5000) => {
  for (let i = 0; i < ms / 100; i++) {
    const found = [...document.querySelectorAll(selector)].find((element) => {
      const own = element.textContent.trim();
      return !text || own === text || (text.endsWith('…') && own.startsWith(text));
    });
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Não apareceu: ' + selector + (text ? ' "' + text + '"' : ''));
};
const type = (input, value) => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const key = (target, k) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const settle = () => new Promise((resolve) => setTimeout(resolve, 500));`;

type Scene = {
  name: string;
  /** Antes de abrir o editor: prepara o navegador (extensão, outras abas). */
  prepare?: () => Promise<void>;
  run: (step: Step) => Promise<void>;
  /** Guarda também o último quadro em JPEG, para quem pede movimento reduzido. */
  still?: boolean;
};
type Step = {
  click: (selector: string, text?: string) => Promise<void>;
  evaluate: (expression: string) => Promise<void>;
  hold: (count: number) => Promise<void>;
  /** Digita de verdade (Input.insertText), no fim do campo focado. */
  insert: (selector: string, text: string) => Promise<void>;
  /** O id do campo cujo rótulo é este texto. */
  labelledId: (label: string) => Promise<string>;
  typeInto: (selector: string, word: string) => Promise<void>;
};

const SIMULATED_MENU =
  process.env.LATTES_SIMULADO ?? 'http://127.0.0.1:5197/cvlattesweb/PKG_MENU.menu';

/**
 * A extensão Dev só grava com o aviso de uso aceito (no perfil de
 * LATTES_PERFIL, ver headless.ts) e com o menu do Lattes (aqui, o simulado)
 * aberto numa aba.
 */
async function prepareSimulatedLattes(): Promise<void> {
  if (!process.env.LATTES_EXTENSAO || !process.env.LATTES_PERFIL) {
    throw new Error('A cena enviar precisa de LATTES_EXTENSAO e LATTES_PERFIL (ver o cabeçalho)');
  }
  const lattes = await openTab();
  await lattes.send('Page.navigate', { url: SIMULATED_MENU });
  await sleep(1500);
  lattes.close();
}

const SCENES: Scene[] = [
  {
    // Produções: o grupo pela barra lateral e o ano pela barra de anos.
    name: 'hero-editor',
    run: async ({ click, hold }) => {
      await hold(8);
      await click('.jump-bar.section a', 'Artigos completos publicados');
      await hold(12);
      await click('.jump-bar.year a', '2022');
      await hold(16);
    },
  },
  {
    // Panorama: o modo troca, e a barra de 2023 abre a seção filtrada.
    name: 'hero-panorama',
    run: async ({ click, evaluate, hold }) => {
      await hold(6);
      await click('.mode-switch [role=radio]', 'Panorama');
      await hold(8);
      await evaluate(`location.hash = 'panorama/producoes-por-ano'; await settle()`);
      await hold(10);
      await evaluate(`const mark = await wait('.pano-mark[aria-label="2023, Artigos: 1"]');
        await settle();
        mark.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait('.filter-status')`);
      await hold(16);
    },
  },
  {
    // Novo item: o diálogo, o filtro de tipos e o formulário do artigo.
    name: 'hero-new',
    run: async ({ click, hold, typeInto }) => {
      await hold(6);
      await click('[aria-label="Novo item"]');
      await hold(10);
      await typeInto('.picker-filter input', 'arti');
      await hold(8);
      await click('.picker-item', 'Artigo completo publicado');
      await hold(16);
    },
  },
  {
    // Panorama, janela larga: a barra de 2023 abre a seção filtrada.
    name: 'panorama',
    run: async ({ evaluate, hold }) => {
      await evaluate(`location.hash = 'panorama/producoes-por-ano'; await settle()`);
      await hold(10);
      await evaluate(`const mark = await wait('.pano-mark[aria-label="2023, Artigos: 1"]');
        mark.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait('.filter-status')`);
      await hold(16);
    },
  },
  {
    // Saúde do currículo: uma contagem do que falta abre a seção filtrada.
    name: 'panorama-health',
    run: async ({ evaluate, hold }) => {
      await evaluate(`location.hash = 'panorama/saude-do-curriculo'; await settle()`);
      await hold(10);
      // Uma linha com itens faltando: a de palavras-chave (6 de 10 no demo).
      await evaluate(`await wait('.pano-check');
        [...document.querySelectorAll('.pano-check')]
          .find((line) => line.textContent.includes('palavras-chave'))
          .click()`);
      await hold(16);
    },
  },
  {
    // Pessoas: a lista vira rede, e uma pessoa abre o painel.
    name: 'panorama-people',
    run: async ({ click, evaluate, hold }) => {
      await evaluate(`location.hash = 'panorama/pessoas'; await settle()`);
      await hold(8);
      await click('[role=radio]', 'Rede');
      await hold(10);
      await evaluate(`(await wait('.pano-mark[aria-label^="Helena Castro Vieira"]')).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )`);
      await hold(16);
    },
  },
  {
    // Linha do tempo: ⌘ com a roda do mouse aproxima um trecho.
    name: 'panorama-timeline',
    run: async ({ evaluate, hold }) => {
      await evaluate(`location.hash = 'panorama/linha-do-tempo'; await settle()`);
      await hold(8);
      for (let i = 0; i < 4; i++) {
        await evaluate(`const area = await wait('.pano-tl-scroll');
          const box = area.getBoundingClientRect();
          area.dispatchEvent(new WheelEvent('wheel', {
            bubbles: true, cancelable: true, ctrlKey: true, deltaY: -120,
            clientX: box.left + box.width * 0.8, clientY: box.top + box.height / 2,
          }))`);
        await hold(3);
      }
      await hold(14);
    },
  },
  {
    // Enviar ao Lattes: o nome de um prêmio muda, e o painel revisa, grava no
    // Lattes simulado pela extensão e mostra o passo de publicar.
    name: 'enviar',
    prepare: prepareSimulatedLattes,
    run: async ({ click, evaluate, hold, insert, labelledId }) => {
      await evaluate(`location.hash = 'dados-gerais'; await settle()`);
      await hold(6);
      await click('[aria-label="Editar Menção honrosa pela tese de doutorado"]');
      await hold(6);
      // Os campos gravam ao perder o foco: o Concluir tira o foco e grava.
      await insert(
        `[id="${await labelledId('Nome do prêmio ou título')}"]`,
        ', melhor tese do ano',
      );
      await hold(8);
      await click('.reading-done');
      await hold(8);
      await click('[aria-label^="Enviar ao Lattes"]');
      await hold(16);
      await click('button', 'Gravar 1 alteração no Lattes');
      await hold(30);
    },
    still: true,
  },
  {
    // A busca ⌘K: digita, desce um item e entra; depois a impressão e o tema escuro.
    name: 'busca',
    run: async ({ click, evaluate, hold, typeInto }) => {
      await hold(8);
      await click('.search-btn');
      await hold(6);
      await typeInto('.palette-input', 'artigo');
      await hold(8);
      await evaluate(`key(await wait('.palette-input'), 'ArrowDown')`);
      await hold(6);
      await evaluate(`key(await wait('.palette-input'), 'Enter')`);
      await hold(14);
      await click('[aria-label="Configurações e arquivo"]');
      await hold(6);
      await click('.menu-item', 'Imprimir ou salvar PDF…');
      await hold(18);
      await click('[role=dialog] .modal-close');
      await hold(4);
      await click('[aria-label="Configurações e arquivo"]');
      await hold(6);
      await click('[role=menuitemradio]', 'Escuro');
      await hold(4);
      await evaluate(
        `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`,
      );
      await hold(16);
    },
  },
];

async function record(scene: Scene): Promise<void> {
  const frames = mkdtempSync(join(tmpdir(), `lattes-${scene.name}-`));
  let frame = 0;
  // O instante de cada quadro: a captura em 2x leva mais que os 100 ms do
  // ritmo, então a duração de cada um no WebP vem do relógio, não do FPS.
  const stamps: number[] = [];
  const cdp = await openTab();
  // A mesma janela larga das capturas (capture-screenshots.ts), em 2x.
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    deviceScaleFactor: 2,
    height: 860,
    mobile: false,
    width: 1440,
  });
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }],
  });

  const evaluate = async (expression: string) => {
    trace(`avalia ${expression.trim().slice(0, 60).replace(/\s+/g, ' ')}`);
    const { exceptionDetails } = await cdp.send<{
      exceptionDetails?: { exception?: { description?: string }; text: string };
    }>('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => { ${HELPERS} ${expression} })()`,
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    }
  };
  // Guarda `count` quadros, um a cada 1/FPS s: a pausa que a pessoa vê.
  const hold = async (count: number) => {
    for (let i = 0; i < count; i++) {
      const started = Date.now();
      const { data } = await cdp.send<{ data: string }>('Page.captureScreenshot', {
        format: 'png',
      });
      stamps.push(started);
      writeFileSync(
        join(frames, `${String(frame++).padStart(4, '0')}.png`),
        Buffer.from(data, 'base64'),
      );
      await sleep(Math.max(0, 1000 / FPS - (Date.now() - started)));
    }
  };
  // LATTES_DEBUG=1 conta os passos no stderr, para achar onde uma cena para.
  const trace = (what: string) => {
    if (process.env.LATTES_DEBUG) console.error(`[${scene.name}] ${what} (quadro ${frame})`);
  };
  const click = async (selector: string, text?: string) => {
    trace(`clique ${selector} ${text ?? ''}`);
    await evaluate(
      `(await wait(${JSON.stringify(selector)}, ${JSON.stringify(text ?? '')})).click()`,
    );
    await sleep(300);
  };
  // Palavra a palavra, com um quadro entre uma e outra, pelo teclado de verdade.
  const labelledId = async (label: string) => {
    const { result } = await cdp.send<{ result: { value: string } }>('Runtime.evaluate', {
      expression: `[...document.querySelectorAll('label')].find((l) => l.textContent.trim() === ${JSON.stringify(label)})?.htmlFor ?? ''`,
      returnByValue: true,
    });
    if (!result.value) throw new Error(`Sem campo com o rótulo "${label}"`);
    return result.value;
  };
  const insert = async (selector: string, text: string) => {
    await evaluate(`const field = await wait(${JSON.stringify(selector)});
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length)`);
    for (const word of text.split(/(?<= )/)) {
      await cdp.send('Input.insertText', { text: word });
      await hold(1);
    }
  };
  // Letra a letra, com dois quadros entre uma e outra.
  const typeInto = async (selector: string, word: string) => {
    for (let i = 1; i <= word.length; i++) {
      await evaluate(
        `type(await wait(${JSON.stringify(selector)}), ${JSON.stringify(word.slice(0, i))})`,
      );
      await sleep(60);
      await hold(2);
    }
  };

  await scene.prepare?.();
  await cdp.send('Storage.clearDataForOrigin', {
    origin: new URL(url).origin,
    storageTypes: 'all',
  });
  await cdp.send('Page.navigate', { url });
  await sleep(1500);
  // Com a extensão e o menu do Lattes abertos, o editor abre o currículo
  // sozinho pelo conector; sem eles, solta o arquivo na tela inicial.
  await evaluate(`[...document.querySelectorAll('button')]
    .find((b) => b.textContent.trim() === 'Prefiro abrir o arquivo exportado')
    ?.click()`);
  await sleep(500);
  const { root: doc } = await cdp.send<{ root: { nodeId: number } }>('DOM.getDocument');
  const { nodeId } = await cdp.send<{ nodeId: number }>('DOM.querySelector', {
    nodeId: doc.nodeId,
    selector: 'input[type=file]',
  });
  if (nodeId) {
    await cdp.send('DOM.setFileInputFiles', { files: [fixture], nodeId });
  }
  // Pelo conector, abrir o currículo leva mais tempo que soltar o arquivo, e a
  // página pode recarregar no meio: uma espera longa dentro da página ficaria
  // sem resposta, então a espera é daqui, em consultas curtas.
  for (let i = 0; ; i++) {
    const found = await cdp
      .send<{ result: { value: boolean } }>('Runtime.evaluate', {
        expression: `!!document.querySelector('.mode-switch')`,
        returnByValue: true,
      })
      .then((r) => r.result.value)
      .catch(() => false);
    if (found) break;
    if (i >= 60) throw new Error('O currículo não abriu em 30 s');
    await sleep(500);
  }
  await sleep(2000);
  await evaluate(`localStorage.setItem('lattes-editor:privacidade', '0'); location.reload()`);
  await sleep(2500);
  await evaluate(`location.hash = 'producoes'`);
  await sleep(800);

  await scene.run({ click, evaluate, hold, insert, labelledId, typeInto });
  if (scene.still) {
    const { data } = await cdp.send<{ data: string }>('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 80,
    });
    writeFileSync(join(outDir, `${scene.name}.jpg`), Buffer.from(data, 'base64'));
  }
  cdp.close();

  const out = join(outDir, `${scene.name}.webp`);
  const files = readdirSync(frames)
    .sort()
    .map((f) => join(frames, f));
  // `-d` vale para os quadros seguintes: cada um dura até o próximo instante.
  const timed = files.flatMap((file, i) => {
    const next = stamps[i + 1] ?? stamps[i]! + 1000 / FPS;
    return ['-d', String(Math.max(20, Math.round(next - stamps[i]!))), file];
  });
  execFileSync('img2webp', ['-loop', '0', '-lossy', '-q', '72', '-m', '4', ...timed, '-o', out], {
    stdio: 'inherit',
  });
  rmSync(frames, { force: true, recursive: true });
  console.log(out.replace(root, ''), `(${frame} quadros)`);
}

mkdirSync(outDir, { recursive: true });
const only = process.argv[3];
// Uma cena que trava (o navegador parou de responder) derruba a gravação em
// vez de ficar pendurada para sempre.
const deadline = (name: string) =>
  new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`A cena ${name} passou de 4 minutos`)), 240_000).unref();
  });
await withHeadlessBrowser(async () => {
  for (const scene of SCENES) {
    if (!only || scene.name === only) await Promise.race([record(scene), deadline(scene.name)]);
  }
});
