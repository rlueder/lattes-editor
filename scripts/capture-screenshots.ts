// Capturas do editor para o README, sempre com o currículo sintético
// (fixtures/synthetic_full.xml, "Pessoa de Teste A"), nunca com um real.
//
// Usa um Brave ou Chrome sem janela, com perfil temporário, falando pelo
// protocolo de depuração (sem Playwright nem outra dependência). Cada tela
// sai nos temas claro e escuro, em docs/img/<nome>-<tema>.jpg.
//
//   pnpm dev                       # o editor em http://localhost:5173 (ou outra porta)
//   pnpm capture:screenshots [url] # padrão: http://localhost:5173/

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const url = process.argv[2] ?? 'http://localhost:5173/';
const fixture = join(root, 'fixtures/synthetic_full.xml');
const outDir = join(root, 'docs/img');
const PORT = 9333;

const BROWSERS = [
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Uma tela: como chegar nela a partir do editor aberto. */
interface Shot {
  name: string;
  /** Roda na página antes da captura. */
  prepare?: string;
  /** Antes de abrir o currículo (a tela inicial). */
  welcome?: boolean;
}

const SHOTS: Shot[] = [
  { name: 'inicio', welcome: true },
  { name: 'producoes', prepare: `location.hash = 'producoes'` },
  { name: 'dados-gerais', prepare: `location.hash = 'dados-gerais'` },
  {
    name: 'ir-para',
    prepare: `location.hash = 'producoes';
      setTimeout(() => document.querySelector('.search-btn')?.click(), 300);
      setTimeout(() => {
        const input = document.querySelector('.palette-input');
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(input, 'artigo');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, 700)`,
  },
  {
    name: 'novo-item',
    prepare: `location.hash = 'producoes';
      setTimeout(() => document.querySelector('[aria-label="Novo item"]')?.click(), 300)`,
  },
];

class Cdp {
  private id = 0;
  private pending = new Map<number, (v: unknown) => void>();
  private ws: WebSocket;
  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(String(e.data)) as { id?: number; result?: unknown; error?: unknown };
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)!(msg.error ? Promise.reject(msg.error) : msg.result);
        this.pending.delete(msg.id);
      }
    });
  }
  send<T = Record<string, unknown>>(method: string, params: object = {}): Promise<T> {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((r) => this.pending.set(id, r as (v: unknown) => void));
  }
}

async function waitForBrowser(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return;
    } catch {
      await sleep(200);
    }
  }
  throw new Error('O navegador não abriu a porta de depuração');
}

async function capture(theme: 'claro' | 'escuro'): Promise<void> {
  const target = (await (
    await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
  ).json()) as { webSocketDebuggerUrl: string };
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    deviceScaleFactor: 2,
    height: 860,
    mobile: false,
    width: 1440,
  });
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: theme === 'claro' ? 'light' : 'dark' }],
  });

  const shoot = async (name: string) => {
    const { data } = await cdp.send<{ data: string }>('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 80,
    });
    const file = join(outDir, `${name}-${theme}.jpg`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    console.log(file.replace(root, ''));
  };
  const evaluate = (expression: string) => cdp.send('Runtime.evaluate', { expression });

  // Sem currículo guardado (o do tema anterior sai), a página abre na tela inicial.
  await cdp.send('Storage.clearDataForOrigin', {
    origin: new URL(url).origin,
    storageTypes: 'all',
  });
  await cdp.send('Page.navigate', { url });
  await sleep(1500);
  for (const shot of SHOTS.filter((s) => s.welcome)) await shoot(shot.name);

  const { root: doc } = await cdp.send<{ root: { nodeId: number } }>('DOM.getDocument');
  const { nodeId } = await cdp.send<{ nodeId: number }>('DOM.querySelector', {
    nodeId: doc.nodeId,
    selector: 'input[type=file]',
  });
  await cdp.send('DOM.setFileInputFiles', { files: [fixture], nodeId });
  await sleep(2000);

  for (const shot of SHOTS.filter((s) => !s.welcome)) {
    // Fecha o que a captura anterior abriu (⌘K, modal) e volta ao topo.
    await evaluate(
      `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); scrollTo(0, 0)`,
    );
    await sleep(300);
    if (shot.prepare) await evaluate(shot.prepare);
    await sleep(1500);
    await shoot(shot.name);
  }
  ws.close();
}

const profile = mkdtempSync(join(tmpdir(), 'lattes-capturas-'));
const exe = BROWSERS.find((b) => {
  try {
    return statSync(b).isFile();
  } catch {
    return false;
  }
});
if (!exe) throw new Error('Brave ou Chrome não encontrado');
const browser = spawn(
  exe,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
  ],
  { stdio: 'ignore' },
);
mkdirSync(outDir, { recursive: true });
try {
  await waitForBrowser();
  await capture('claro');
  await capture('escuro');
} finally {
  const exited = new Promise((r) => browser.once('exit', r));
  browser.kill();
  await exited;
  rmSync(profile, { force: true, maxRetries: 5, recursive: true, retryDelay: 200 });
}
