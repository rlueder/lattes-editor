// Regressão de navegador só com páginas sintéticas locais e DNS externo bloqueado.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

import { isolationResponse } from './censo-isolation-fixture.ts';
import { censusFrameRuntime } from './censo-runtime.ts';
import { Cdp, sleep } from './headless.ts';
import { startLattesSimulado } from './lattes-simulado/servidor.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'lattes-isolation-'));
const extension = join(dir, 'extension');
cpSync(join(root, 'dist-extension-dev'), extension, { recursive: true });
const manifestPath = join(extension, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { key?: string };
delete manifest.key;
writeFileSync(manifestPath, JSON.stringify(manifest));
const background = join(extension, 'background.js');
writeFileSync(
  background,
  readFileSync(background, 'utf8').replaceAll('lattes_editor.conector_dev', ''),
);
const bundle = await build({
  build: {
    lib: {
      entry: join(root, 'scripts/censo-isolation-probe.ts'),
      formats: ['iife'],
      name: 'isolation_probe',
    },
    minify: false,
    write: false,
  },
  configFile: false,
  define: { __CENSUS_FRAME_RUNTIME__: JSON.stringify(await censusFrameRuntime()) },
  logLevel: 'warn',
});
const output = Array.isArray(bundle) ? bundle[0] : bundle;
if (!output || !('output' in output)) throw new Error('Teste de isolamento não compilou');
const code = output.output.find((file) => file.type === 'chunk')!.code;
const writes: { mode: string; pairs: [string, string][] }[] = [];
const server = await startLattesSimulado({
  intercept: async (req, _state, next) => {
    if (req.proc.toLowerCase() === 'pkg_isolation.save')
      writes.push({ mode: req.get('mode') ?? '', pairs: req.pairs });
    return (await isolationResponse(req)) ?? next();
  },
});
const profile = join(dir, 'profile');
const browser = spawn(
  process.env.LATTES_BROWSER ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    `--load-extension=${extension}`,
    `--disable-extensions-except=${extension}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
  ],
  { stdio: 'ignore' },
);
const clients: Cdp[] = [];
const watchdog = setTimeout(() => browser.kill('SIGKILL'), 90_000);
async function connect(target: { webSocketDebuggerUrl: string }): Promise<Cdp> {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
  const client = new Cdp(socket);
  clients.push(client);
  return client;
}
async function evaluate<T>(client: Cdp, expression: string): Promise<T> {
  const result = await client.send<{ exceptionDetails?: unknown; result: { value: T } }>(
    'Runtime.evaluate',
    { awaitPromise: true, expression, returnByValue: true },
  );
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
interface Result {
  error?: string;
  info?: { text: string };
  msgs?: string[];
  opaque?: boolean;
  sandbox?: string;
  uncertain?: boolean;
}
try {
  let port: string | undefined;
  for (let i = 0; i < 80; i++) {
    try {
      port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0];
      break;
    } catch {
      await sleep(100);
    }
  }
  assert.ok(port, 'O navegador não iniciou');
  const endpoint = `http://127.0.0.1:${port}`;
  const target = (await (
    await fetch(`${endpoint}/json/new?${encodeURIComponent(`${server.base}PKG_MENU.menu`)}`, {
      method: 'PUT',
    })
  ).json()) as { webSocketDebuggerUrl: string };
  const page = await connect(target);
  await sleep(500);
  await evaluate(page, 'window.savedFetch = fetch.bind(window); window.escaped = false');
  await evaluate(page, code);
  const run = (mode: string) => evaluate<Result>(page, `__isolationTest(${JSON.stringify(mode)})`);
  const escapes = await run('escapes');
  assert.equal(escapes.opaque, true, JSON.stringify(escapes));
  assert.equal(escapes.sandbox, 'allow-scripts');
  const flags = JSON.parse(
    /\{"fetch":[^}]+\}/.exec(escapes.info?.text ?? '')?.[0] ?? '{}',
  ) as Record<string, boolean>;
  assert.equal(Object.keys(flags).length, 9, JSON.stringify(escapes));
  assert.ok(Object.values(flags).every(Boolean), JSON.stringify(flags));
  assert.equal(
    await evaluate(page, 'window.escaped || document.body.dataset.escaped === "sim"'),
    false,
  );
  const results: Record<string, Result> = { escapes };
  for (const mode of ['save', 'step', 'unnamed', 'benign', 'clone', 'delete']) {
    results[mode] = await run(mode);
    assert.deepEqual(results[mode]!.msgs, ['sucesso'], JSON.stringify(results[mode]));
    assert.equal(results[mode]!.opaque, true);
  }
  assert.ok(
    writes.some((entry) =>
      entry.pairs.some(([name, value]) => name === 'f_codigo' && value === 'ação'),
    ),
  );
  for (const mode of ['step', 'unnamed']) {
    const steps = writes.filter((entry) => entry.mode === mode);
    assert.equal(steps.length, 2);
    for (const step of steps) {
      assert.ok(
        step.pairs.some(([name, value]) => name === 'f_inst' && value === 'Doador original'),
      );
      assert.ok(step.pairs.some(([name, value]) => name === 'f_authors' && value === '1'));
    }
  }
  for (const mode of ['external', 'unsolicited', 'unsupported', 'duplicate', 'cancel']) {
    results[mode] = await run(mode);
    assert.ok(results[mode]!.error, `${mode}: ${JSON.stringify(results[mode])}`);
  }
  assert.equal(results.cancel!.uncertain, true);
  assert.equal(results.duplicate!.uncertain, true);
  assert.equal(writes.filter((entry) => entry.mode === 'duplicate').length, 1);
  assert.equal(writes.filter((entry) => entry.mode === 'cancel').length, 1);
  for (const mode of ['external', 'unsolicited', 'unsupported'])
    assert.equal(writes.filter((entry) => entry.mode === mode).length, 0);
  results.navigate = await run('navigate');
  assert.equal(results.navigate.opaque, true, JSON.stringify(results.navigate));
  assert.ok(!server.state.log.some((entry) => entry.proc.toLowerCase() === 'pkg_isolation.bypass'));
  assert.ok((await evaluate<string>(page, 'location.href')).includes('PKG_MENU.menu'));
  assert.equal(await evaluate(page, 'document.querySelectorAll("iframe[sandbox]").length'), 0);
  console.log(
    JSON.stringify({
      blocked: flags,
      checked: Object.keys(results),
      ok: true,
      writes: writes.length,
    }),
  );
} finally {
  clearTimeout(watchdog);
  clients.forEach((client) => client.close());
  if (browser.exitCode === null) {
    const ended = new Promise((resolve) => browser.once('exit', resolve));
    browser.kill();
    await ended;
  }
  await server.close();
  rmSync(dir, { force: true, recursive: true });
}
