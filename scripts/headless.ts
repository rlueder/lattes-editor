// Brave ou Chrome sem janela, com perfil temporário, falando pelo protocolo de
// depuração (sem Playwright nem outra dependência). Usado pelas capturas do
// editor (capture-screenshots.ts) e da extensão (capture-store.ts).

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9333;

const BROWSERS = [
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Cdp {
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
  close(): void {
    this.ws.close();
  }
}

/** Aba nova em branco, já com Page habilitado. */
export async function openTab(): Promise<Cdp> {
  const target = (await (
    await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
  ).json()) as { webSocketDebuggerUrl: string };
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  return cdp;
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

/** Abre o navegador, roda `work` e fecha tudo, inclusive o perfil temporário. */
export async function withHeadlessBrowser(work: () => Promise<void>): Promise<void> {
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
  try {
    await waitForBrowser();
    await work();
  } finally {
    const exited = new Promise((r) => browser.once('exit', r));
    browser.kill();
    await exited;
    rmSync(profile, { force: true, maxRetries: 5, recursive: true, retryDelay: 200 });
  }
}

/**
 * Espera o documento, a fonte do projeto e as imagens, e confere que a página
 * renderizou de fato: uma imagem quebrada falha o script em vez de ser gravada.
 * document.fonts.check() daria verdadeiro sem fonte nenhuma declarada;
 * fonts.load() só devolve faces que a página carregou.
 */
export async function assertRendered(
  cdp: Cdp,
  what: string,
  selector: string,
  { needsImages = true, textSelector = selector } = {},
): Promise<void> {
  const { result } = await cdp.send<{ result: { value?: string } }>('Runtime.evaluate', {
    awaitPromise: true,
    expression: `(async () => {
      for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      const faces = await document.fonts.load('600 50px "IBM Plex Sans"');
      const imgs = [...document.querySelectorAll(${JSON.stringify(`${selector} img`)})];
      await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
      return JSON.stringify({
        font: faces.some((f) => f.family.includes('IBM Plex Sans') && f.status === 'loaded'),
        images: (imgs.length > 0 || !${needsImages}) && imgs.every((i) => i.complete && i.naturalWidth > 0),
        content: Boolean(document.querySelector(${JSON.stringify(textSelector)})?.textContent?.trim()),
      });
    })()`,
    returnByValue: true,
  });
  const ready = JSON.parse(result.value ?? '{}') as Record<string, boolean>;
  const missing = ['font', 'images', 'content'].filter((k) => !ready[k]);
  if (missing.length) throw new Error(`${what} não renderizou: ${missing.join(', ')}`);
}
