// O servidor do Lattes simulado: node:http, os procedimentos de cada tela
// pelo nome (sem diferença de caixa, como no gateway PL/SQL), as duas bases
// de caminho do Lattes (/cvlattesweb/ e /curriculoweb/), a sessão que vence e
// algumas rotas de controle em /__simulado/ para quem testa.
//
// Respostas gravadas: com `recordings`, um arquivo
// <pasta>/<procedimento em minúsculas>.<get|post>.html responde no lugar da
// página montada, com {{f_cod}} e {{lattes_id}} trocados pelos do currículo.
// É por onde pares de pedido e resposta gravados no Lattes de verdade (a
// extensão Dev, num próximo passo) podem ser repetidos.

import { existsSync, readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { join } from 'node:path';

import { encodeLatin1 } from '../../src/model/latin1.ts';
import { ATUACAO_ROUTES } from './atuacao.ts';
import { BUSCAS_ROUTES } from './buscas.ts';
import { CENSO_ROUTES } from './censo.ts';
import { DADOS_GERAIS_ROUTES } from './dados-gerais.ts';
import { type ImportOutcome, LattesState, type SimuladoOptions } from './estado.ts';
import { EVENTOS_ROUTES } from './eventos.ts';
import { EXPORTAR_ROUTES } from './exportar.ts';
import { FORMACAO_ROUTES } from './formacao.ts';
import { LOGON_REDIRECT } from './html.ts';
import { IMPORTAR_ROUTES } from './importar.ts';
import { MENU_ROUTES } from './menu.ts';
import { PATENTE_ROUTES } from './patente.ts';
import { buildRequest, type SimRequest } from './pedido.ts';
import { PREMIOS_COMPLEMENTAR_ROUTES } from './premios-complementar.ts';
import { productionRoutes } from './producao.ts';
import { PROJETO_ROUTES } from './projeto.ts';
import { notFound, type Routes, type SimResponse } from './tipos.ts';

export const ROUTES: Routes = {
  ...productionRoutes(),
  ...ATUACAO_ROUTES,
  ...BUSCAS_ROUTES,
  ...CENSO_ROUTES,
  ...DADOS_GERAIS_ROUTES,
  ...EVENTOS_ROUTES,
  ...EXPORTAR_ROUTES,
  ...FORMACAO_ROUTES,
  ...IMPORTAR_ROUTES,
  ...MENU_ROUTES,
  ...PATENTE_ROUTES,
  ...PREMIOS_COMPLEMENTAR_ROUTES,
  ...PROJETO_ROUTES,
};

/** As duas bases em que o editor do Lattes responde. */
export const BASES = ['cvlattesweb', 'curriculoweb'];

/**
 * Um intermediário em volta de cada pedido, para os testes simularem falhas
 * (a sessão que cai no meio, o POST que não grava um campo). Chama next()
 * para a resposta normal.
 */
export type Intercept = (
  req: SimRequest,
  state: LattesState,
  next: () => Promise<SimResponse>,
) => Promise<SimResponse> | SimResponse;

export interface ServerOptions extends SimuladoOptions {
  host?: string;
  intercept?: Intercept;
  /** 0 escolhe uma porta livre. */
  port?: number;
  /** Pasta de respostas gravadas (ver o comentário do arquivo). */
  recordings?: string;
}

export interface LattesSimulado {
  /** A base do editor, terminada em /cvlattesweb/. */
  base: string;
  close(): Promise<void>;
  state: LattesState;
  /** O endereço do servidor, sem barra no fim. */
  url: string;
}

export interface RawRequest {
  body: Uint8Array;
  contentType: string;
  method: string;
  /** Caminho com a query, como chegou (/cvlattesweb/PKG_MENU.menu?f_cod=…). */
  path: string;
}

function recorded(dir: string | undefined, proc: string, method: string, state: LattesState) {
  if (!dir) return undefined;
  const file = join(dir, `${proc.toLowerCase()}.${method.toLowerCase()}.html`);
  if (!existsSync(file)) return undefined;
  return readFileSync(file, 'latin1')
    .replaceAll('{{f_cod}}', state.code)
    .replaceAll('{{lattes_id}}', state.lattesId);
}

/** Um pedido ao editor do Lattes simulado, sem HTTP no meio. */
export async function handle(
  state: LattesState,
  raw: RawRequest,
  options: Pick<ServerOptions, 'intercept' | 'recordings'> = {},
): Promise<SimResponse> {
  const [pathname = '', query = ''] = raw.path.split('?', 2) as [string, string?];
  const [, base = '', proc = ''] = /^\/([^/]+)\/([^/]*)$/.exec(pathname) ?? [];
  if (!BASES.includes(base.toLowerCase()) || !proc) return notFound(pathname);
  const req = buildRequest({
    base: base.toLowerCase(),
    body: raw.body,
    contentType: raw.contentType,
    method: raw.method,
    proc,
    query: query ?? '',
  });
  const urlencoded = raw.method === 'POST' && !/multipart/i.test(raw.contentType);
  state.log.push({
    body: urlencoded ? Buffer.from(raw.body).toString('latin1') : undefined,
    ctr: req.get('f_ctr'),
    file: req.file && { field: req.file.field, name: req.file.name },
    method: raw.method,
    pairs: raw.method === 'POST' ? req.pairs : undefined,
    path: query ? `${proc}?${query}` : proc,
    proc,
  });
  if (state.expireAfterRequests !== undefined && state.log.length > state.expireAfterRequests) {
    state.sessionActive = false;
    state.expireAfterRequests = undefined;
  }
  const run = async (): Promise<SimResponse> => {
    const key = proc.toLowerCase();
    if (!state.sessionActive && key !== 'pkg_sec.logon') return { html: LOGON_REDIRECT };
    const saved = recorded(options.recordings, proc, raw.method, state);
    if (saved !== undefined) return { html: saved };
    const route = ROUTES[key];
    return route ? route(req, state) : notFound(proc);
  };
  return options.intercept ? options.intercept(req, state, run) : run();
}

/** Rotas de controle para quem testa: estado em JSON, sessão, publicação, Importar. */
function control(state: LattesState, action: string, query: URLSearchParams): unknown {
  if (action === 'expirar') state.sessionActive = false;
  if (action === 'entrar') state.sessionActive = true;
  if (action === 'publicar') state.publish();
  if (action === 'gravar') state.touch();
  if (action === 'importacao') {
    const outcome = query.get('resultado');
    if (outcome === 'descartar' || outcome === 'inserir' || outcome === 'participante') {
      state.importOutcome = outcome satisfies ImportOutcome;
    }
  }
  return {
    importacao: state.importRequest
      ? { itens: state.importRequest.items.length, solicitacao: state.importRequest.id }
      : null,
    importados: state.imported,
    pedidos: state.log.length,
    pendente: state.pending,
    resultadoDoImportar: state.importOutcome,
    sessao: state.sessionActive,
    ultimaAtualizacao: state.lastUpdate.toISOString(),
    ultimaPublicacao: state.lastPublished.toISOString(),
  };
}

/**
 * O controle só aceita pedido sem Origin (curl, testes) ou da própria origem
 * do simulado: um POST de outro site aberto no navegador não passa.
 */
export function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  return !origin || origin === `http://${req.headers.host ?? ''}`;
}

async function readBody(req: IncomingMessage): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return new Uint8Array(Buffer.concat(chunks));
}

function send(res: ServerResponse, out: SimResponse): void {
  if ('cut' in out) {
    res.socket?.destroy();
    return;
  }
  const headers = { 'Cache-Control': 'no-store', ...out.headers };
  if ('bytes' in out) {
    res.writeHead(out.status ?? 200, { ...headers, 'Content-Type': out.contentType });
    res.end(Buffer.from(out.bytes));
    return;
  }
  const type = out.contentType ?? 'text/html';
  res.writeHead(out.status ?? 200, { ...headers, 'Content-Type': `${type}; charset=ISO-8859-1` });
  res.end(Buffer.from(encodeLatin1(out.html)));
}

export async function startLattesSimulado(options: ServerOptions = {}): Promise<LattesSimulado> {
  const state = await LattesState.create(options);
  const server: Server = createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? '/', 'http://simulado');
        if (url.pathname === '/' || url.pathname === '/cvlattesweb/') {
          res.writeHead(302, { Location: '/cvlattesweb/PKG_MENU.menu' }).end();
          return;
        }
        const ctl = /^\/__simulado\/(\w*)$/.exec(url.pathname);
        if (ctl && !sameOrigin(req)) {
          // Outra página aberta no navegador não mexe no simulado.
          res
            .writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
            .end('Origem recusada');
          return;
        }
        if (ctl) {
          const body = control(state, req.method === 'POST' ? ctl[1]! : '', url.searchParams);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(body, null, 2));
          return;
        }
        const out = await handle(
          state,
          {
            body: await readBody(req),
            contentType: req.headers['content-type'] ?? '',
            method: req.method ?? 'GET',
            path: req.url ?? '/',
          },
          options,
        );
        send(res, out);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(err instanceof Error ? err.stack : String(err));
      }
    })();
  });
  await new Promise<void>((resolve) =>
    server.listen(options.port ?? 0, options.host ?? '127.0.0.1', resolve),
  );
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : options.port;
  const url = `http://${options.host ?? '127.0.0.1'}:${port}`;
  return {
    base: `${url}/cvlattesweb/`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((err) => (err ? reject(err) : resolve()));
      }),
    state,
    url,
  };
}
