// Brave ou Chrome sem janela, com perfil temporário, falando pelo protocolo de
// depuração (sem Playwright nem outra dependência). Usado pelas capturas do
// editor (capture-screenshots.ts) e da extensão (capture-store.ts).

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9333;
let activePort = PORT;

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
  /** Um comando sem resposta em 30 s falha com o nome dele, em vez de travar a captura. */
  send<T = Record<string, unknown>>(method: string, params: object = {}): Promise<T> {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`O navegador não respondeu a ${method} em 30 s`));
      }, 30_000);
      this.pending.set(id, (v: unknown) => {
        clearTimeout(timer);
        resolve(v as T);
      });
    });
  }
  close(): void {
    this.ws.close();
  }
}

/** Aba nova em branco, já com Page habilitado. */
export async function openTab(): Promise<Cdp> {
  const target = (await (
    await fetch(`http://127.0.0.1:${activePort}/json/new?about:blank`, { method: 'PUT' })
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
      await fetch(`http://127.0.0.1:${activePort}/json/version`);
      return;
    } catch {
      await sleep(200);
    }
  }
  throw new Error('O navegador não abriu a porta de depuração');
}

/**
 * Abre o navegador, roda `work` e fecha tudo, inclusive o perfil temporário.
 *
 * - `LATTES_EXTENSAO=<pasta>` (a `dist-extension/` do `pnpm build:extension`)
 *   carrega a extensão do conector: o content script dela fala com o editor em
 *   `localhost`, e o painel de envio mostra o caminho pela extensão.
 * - `LATTES_PERFIL=<pasta>` usa esse perfil em vez de um temporário e não o
 *   apaga: é onde fica o "ok" do aviso de uso da extensão, que o navegador sem
 *   janela não consegue dar (ele não abre as páginas da extensão).
 * - `LATTES_JANELA=1` abre o navegador com janela, para dar esse "ok".
 * - `isolated: true` exige perfil temporário sem extensão nem janela e usa a
 *   porta automática informada pelo navegador naquele perfil.
 */
export async function withHeadlessBrowser(
  work: () => Promise<void>,
  { isolated = false }: { isolated?: boolean } = {},
): Promise<void> {
  if (
    isolated &&
    ['LATTES_PERFIL', 'LATTES_JANELA', 'LATTES_EXTENSAO'].some(
      (name) => process.env[name] !== undefined,
    )
  ) {
    throw new Error('O navegador de teste exige perfil temporário, sem janela e sem extensão.');
  }
  const requestedProfile = process.env.LATTES_PERFIL || undefined;
  const ownProfile = !requestedProfile;
  const profile = requestedProfile ?? mkdtempSync(join(tmpdir(), 'lattes-capturas-'));
  const extension = process.env.LATTES_EXTENSAO;
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
      ...(process.env.LATTES_JANELA ? [] : ['--headless=new']),
      `--remote-debugging-port=${isolated ? 0 : PORT}`,
      `--user-data-dir=${profile}`,
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      ...(extension
        ? [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
        : []),
    ],
    { stdio: 'ignore' },
  );
  const previousPort = activePort;
  try {
    activePort = PORT;
    if (isolated) {
      // A porta vem do arquivo criado no nosso perfil novo, nunca de um
      // navegador da pessoa que já esteja ouvindo numa porta conhecida.
      activePort = await waitForPrivatePort(
        profile,
        () => browser.exitCode !== null || browser.signalCode !== null,
      );
    }
    await waitForBrowser();
    await work();
  } finally {
    if (browser.exitCode === null && browser.signalCode === null) {
      const exited = new Promise((r) => browser.once('exit', r));
      browser.kill();
      await exited;
    }
    activePort = previousPort;
    if (ownProfile) {
      rmSync(profile, { force: true, maxRetries: 5, recursive: true, retryDelay: 200 });
    }
  }
}

async function waitForPrivatePort(profile: string, exited: () => boolean): Promise<number> {
  for (let i = 0; i < 50; i++) {
    if (exited()) throw new Error('O navegador de teste encerrou antes de abrir a depuração.');
    try {
      const [line, browserPath] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split(
        '\n',
      );
      const port = Number(line);
      if (
        browserPath?.startsWith('/devtools/browser/') &&
        Number.isInteger(port) &&
        port > 0 &&
        port <= 65535
      )
        return port;
    } catch {
      // O arquivo aparece depois que o navegador reserva a porta.
    }
    await sleep(200);
  }
  throw new Error('O navegador de teste não informou sua porta privada de depuração.');
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
