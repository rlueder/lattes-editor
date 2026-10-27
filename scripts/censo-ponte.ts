// Ponte local para rodar o censo na aba do Lattes em segundo plano, pela
// depuração remota do navegador (docs/desenvolvimento.md, "Censo pela ponte
// local"). Uma conexão CDP fica aberta e um servidor em 127.0.0.1 avalia
// expressões na aba do menu, sem foco, teclado nem área de transferência.
//
//   node scripts/censo-ponte.ts servir            # mantém a conexão (o navegador pede "Allow")
//   node scripts/censo-ponte.ts carregar [pacote] # põe dist-censo/censo-lattes.js (ou o pacote) na aba
//   node scripts/censo-ponte.ts avaliar '<expr>'  # avalia e imprime o valor
//   node scripts/censo-ponte.ts chamar '<expr>'   # espera a Promise da expressão e imprime
//   node scripts/censo-ponte.ts reanexar          # volta para a aba do menu depois de um login
//   node scripts/censo-ponte.ts capturas          # os POSTs da aba ao Lattes desde a última consulta
//
// Só escuta em 127.0.0.1, com um token num arquivo da pasta temporária. O
// navegador precisa da depuração remota ligada (brave://inspect/#remote-debugging
// ou chrome://inspect/#remote-debugging); LATTES_PERFIL aponta outra pasta de
// perfil.

import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 47999;
const DIR = join(tmpdir(), 'lattes-editor-ponte');
const TOKEN = join(DIR, 'token');
const PROFILE =
  process.env.LATTES_PERFIL ??
  join(homedir(), 'Library/Application Support/BraveSoftware/Brave-Browser');

async function serve(): Promise<void> {
  const [port, path] = readFileSync(join(PROFILE, 'DevToolsActivePort'), 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  let next = 1;
  const pending = new Map<number, { reject: (e: Error) => void; resolve: (v: unknown) => void }>();
  const send = (method: string, params: object = {}, sessionId?: string) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const id = next++;
      pending.set(id, { reject, resolve: (v) => resolve(v as Record<string, unknown>) });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  // Os POSTs da aba ao Lattes, só na memória desta ponte, para comparar o que a
  // página manda com o que o conector manda. Sai pelo pedido "capturas".
  const posts: { at: string; pairs: [string, string][]; url: string }[] = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data)) as {
      error?: { message: string };
      id?: number;
      method?: string;
      params?: { request?: { method: string; postData?: string; url: string } };
      result?: unknown;
    };
    const request = m.params?.request;
    if (m.method === 'Network.requestWillBeSent' && request?.method === 'POST') {
      const url = new URL(request.url);
      if (url.pathname.includes('/cvlattesweb/')) {
        posts.push({
          at: new Date().toISOString(),
          pairs: [...new URLSearchParams(request.postData ?? '')],
          url: url.pathname.split('/').pop() ?? '',
        });
      }
    }
    const p = m.id !== undefined ? pending.get(m.id) : undefined;
    if (!p) return;
    pending.delete(m.id!);
    if (m.error) p.reject(new Error(m.error.message));
    else p.resolve(m.result);
  };
  ws.onclose = () => {
    console.log('conexão fechada');
    process.exit(0);
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  console.log('conectado');

  let session: string | undefined;
  const attach = async () => {
    const { targetInfos } = (await send('Target.getTargets')) as {
      targetInfos: { targetId: string; type: string; url: string }[];
    };
    // A aba aberta por último no menu: depois de um login, a nova.
    const tab = targetInfos.filter(
      (t) => t.type === 'page' && t.url.includes('cvlattesweb/PKG_MENU'),
    )[0];
    if (!tab) throw new Error('nenhuma aba no menu do Lattes');
    const { sessionId } = (await send('Target.attachToTarget', {
      flatten: true,
      targetId: tab.targetId,
    })) as { sessionId: string };
    await send('Network.enable', { maxPostDataSize: 65_536 }, sessionId);
    return sessionId;
  };
  const evaluate = (expression: string) =>
    send('Runtime.evaluate', { awaitPromise: true, expression, returnByValue: true }, session);

  const token = randomBytes(16).toString('hex');
  mkdirSync(DIR, { mode: 0o700, recursive: true });
  writeFileSync(TOKEN, token, { mode: 0o600 });
  createServer(async (req, res) => {
    if (req.headers['x-token'] !== token) return void res.writeHead(403).end();
    let body = '';
    for await (const c of req) body += String(c);
    try {
      const { capturas, expr, reattach } = JSON.parse(body) as {
        capturas?: boolean;
        expr: string;
        reattach?: boolean;
      };
      if (!session || reattach) session = await attach();
      if (capturas) {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(posts));
        posts.length = 0;
        return;
      }
      const r = await evaluate(expr).catch(async () => {
        // A aba recarregou: anexa de novo, uma vez.
        session = await attach();
        return evaluate(expr);
      });
      const failed = r.exceptionDetails as
        { exception?: { description?: string }; text?: string } | undefined;
      res
        .writeHead(200, { 'content-type': 'application/json' })
        .end(
          JSON.stringify(
            failed
              ? { erro: failed.exception?.description ?? failed.text }
              : { valor: (r.result as { value?: unknown }).value },
          ),
        );
    } catch (err) {
      res.writeHead(500).end(JSON.stringify({ erro: String(err) }));
    }
  }).listen(PORT, '127.0.0.1', () => console.log(`ouvindo em 127.0.0.1:${PORT}`));
}

async function ask(expr: string, reattach = false): Promise<{ erro?: string; valor?: unknown }> {
  const res = await fetch(`http://127.0.0.1:${PORT}/`, {
    body: JSON.stringify({ expr, reattach }),
    headers: { 'x-token': readFileSync(TOKEN, 'utf8') },
    method: 'POST',
  });
  return (await res.json()) as { erro?: string; valor?: unknown };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Roda uma chamada assíncrona do censo e espera, consultando a cada 5 s (cada pedido da ponte tem prazo). */
async function call(expr: string): Promise<unknown> {
  await ask(
    `window.__ponte = { rodando: true }; Promise.resolve().then(() => ${expr}).then((r) => { window.__ponte = { ok: true, r }; }, (e) => { window.__ponte = { erro: String(e) }; }); 'iniciado'`,
  );
  for (;;) {
    await sleep(5000);
    const { valor } = await ask(
      'JSON.stringify(window.__ponte?.rodando ? { rodando: true, agora: globalThis.__lattesTestLive } : window.__ponte)',
    );
    const state = JSON.parse(String(valor)) as {
      erro?: string;
      ok?: boolean;
      r?: unknown;
      rodando?: boolean;
    };
    if (!state.rodando) return state;
  }
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'servir') await serve();
else if (cmd === 'carregar') {
  // Sem argumento, o censo; com um caminho, outro pacote (o conector-ponte.js).
  const file = arg ?? fileURLToPath(new URL('../dist-censo/censo-lattes.js', import.meta.url));
  const bundle = readFileSync(file, 'utf8');
  console.log(
    JSON.stringify(await ask(`${bundle}\n;typeof __lattesCensus + ' ' + typeof __conectorPonte`)),
  );
} else if (cmd === 'avaliar' && arg) console.log(JSON.stringify(await ask(arg)));
else if (cmd === 'chamar' && arg) console.log(JSON.stringify(await call(arg)));
else if (cmd === 'reanexar') console.log(JSON.stringify(await ask('location.pathname', true)));
else if (cmd === 'capturas') {
  // Os POSTs da aba desde a última consulta. Os valores de texto saem como o
  // tamanho; códigos, flags e os campos de busca (f_cod*, *_old) aparecem.
  const res = await fetch(`http://127.0.0.1:${PORT}/`, {
    body: JSON.stringify({ capturas: true, expr: '' }),
    headers: { 'x-token': readFileSync(TOKEN, 'utf8') },
    method: 'POST',
  });
  const posts = (await res.json()) as { at: string; pairs: [string, string][]; url: string }[];
  const shown =
    /^(f_ctr|f_cod_|f_cod$|f_codorgao|f_codinst|f_seq|f_nivel|f_tipo|f_sta|f_.*_old$|F_COD_PROD|f_sub_prod)/i;
  for (const p of posts) {
    console.log(`${p.at} ${p.url}`);
    for (const [k, v] of p.pairs) {
      const masked = /^f_cod$/i.test(k) ? '[código]' : shown.test(k) ? v : `(${v.length} car.)`;
      console.log(`  ${k}=${masked}`);
    }
  }
} else {
  console.error(
    'uso: node scripts/censo-ponte.ts servir | carregar | avaliar <expr> | chamar <expr> | reanexar',
  );
  process.exitCode = 1;
}
