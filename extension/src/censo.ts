// O censo dos formulários do Lattes (LAT-55), para rodar na aba do menu do
// Lattes com a sessão de quem está logado. Montado à parte por
// scripts/build-censo.ts em dist-censo/censo-lattes.js: colado no console (ou
// injetado pela automação do navegador), deixa __lattesCensus na página.
//
//   await __lattesCensus.capture()            // formulários de inclusão
//   await __lattesCensus.link()               // passada de edição, pela exportação
//   await __lattesCensus.captureAll({ download: true })
//   await __lattesCensus.inspect(['pkg_x.form?…'], { download: true })  // recaptura avulsa
//   await __lattesCensus.activities({ download: true })  // atividades por natureza
//   __lattesCensus.authorShape('Nome Completo')           // forma das linhas de autor
//   __lattesCensus.vectorShape('titularPessoaDP', 'Nome') // o mesmo, para outro vetor do menu
//
// Só GET de formulário e de lista. A única exceção é link() sem XML, que
// pede a exportação pelo mesmo POST de leitura do "Exportar" (o conector já
// faz o mesmo, docs/lattes_internals.md, seção 12). Nada é enviado ao Lattes.

import { exportCv, type ExportPort } from '../../src/bridge/export.ts';
import { cvCodeFrom, isLogonPage, lattesIdFrom } from '../../src/bridge/lattes-html.ts';
import { authorShape as shapeOf } from '../../src/census/author-shape.ts';
import { inspectActivities, inspectPages } from '../../src/census/inspect.ts';
import { linkFields, type LinkOptions } from '../../src/census/link.ts';
import {
  type CensusFile,
  type CensusOptions,
  type CensusPort,
  runCensus,
} from '../../src/census/run.ts';
import { readZip } from '../../src/import-export/zip.ts';
import { decodeLatin1, decodeXmlBytes } from '../../src/model/latin1.ts';

declare const __CENSO_VERSAO__: string;

const base = () => new URL('/cvlattesweb/', location.origin);

async function get(path: string) {
  const res = await fetch(new URL(path, base()), { credentials: 'include' });
  return {
    html: decodeLatin1(new Uint8Array(await res.arrayBuffer())),
    status: res.status,
    url: res.url,
  };
}

/** O menu: o da aba, se é ele; senão um GET novo (só o cookie basta, seção 10). */
async function menuHtml(): Promise<string> {
  const here = document.documentElement.outerHTML;
  if (cvCodeFrom(here)) return here;
  const res = await get('PKG_MENU.menu');
  if (isLogonPage(res.html, res.url)) throw new Error('A sessão do Lattes caiu; entre de novo.');
  return res.html;
}

const port: CensusPort = { get, menuHtml };

const exportPort: ExportPort = {
  get,
  async postForBytes(path, body) {
    const res = await fetch(new URL(path, base()), {
      body,
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') ?? '',
      disposition: res.headers.get('content-disposition') ?? '',
      url: res.url,
    };
  },
};

async function code(): Promise<string> {
  const found = cvCodeFrom(await menuHtml());
  if (!found) throw new Error('Não achei o código do currículo. Abra o menu do Lattes nesta aba.');
  return found;
}

/** O XML da exportação, pelo POST de leitura do Exportar. */
async function exportedXml(): Promise<string> {
  const menu = await menuHtml();
  const r = await exportCv(exportPort, cvCodeFrom(menu), lattesIdFrom(menu));
  if (!r.ok) {
    throw new Error(
      r.reason === 'pendente'
        ? 'O Exportar recusa enquanto há alterações não enviadas ao CNPq; passe o XML em link(xml).'
        : `A exportação falhou (${r.reason}${r.detail ? `: ${r.detail}` : ''}).`,
    );
  }
  const entry = (await readZip(r.bytes)).find((e) => /\.xml$/i.test(e.name));
  if (!entry) throw new Error('O ZIP da exportação veio sem XML.');
  return decodeXmlBytes(entry.data).text;
}

/** Salva um objeto como arquivo JSON, pelo download do navegador. */
function download(data: unknown, name = `censo-${new Date().toISOString().slice(0, 10)}.json`) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

type Options = Omit<CensusOptions, 'collector'> & { download?: boolean };

async function capture(options: Options = {}): Promise<CensusFile> {
  const file = await runCensus(port, await code(), {
    ...options,
    collector: `lattes-editor ${__CENSO_VERSAO__}`,
  });
  if (options.download) download(file);
  return file;
}

async function link(xml?: string, options: LinkOptions = {}) {
  return linkFields(port, await code(), xml ?? (await exportedXml()), options);
}

/** As duas passadas num arquivo só: a captura e as ligações observadas. */
async function captureAll(options: Options & { xml?: string } = {}): Promise<CensusFile> {
  const file = await capture({ ...options, download: false });
  let out: CensusFile = file;
  // Sessão caída na captura: a passada de edição nem começa. Caída (ou
  // exportação recusada) na passada de edição: a captura feita não se perde.
  if (!file.interrupted) {
    try {
      const { links, summary } = await link(options.xml, {
        delayMs: options.delayMs,
        only: options.only,
      });
      out = { ...file, links, linkSummary: summary };
    } catch (err) {
      out = {
        ...file,
        interrupted: true,
        linkError: err instanceof Error ? err.message : 'Falha inesperada',
      };
    }
  }
  if (options.download) download(out);
  return out;
}

/**
 * Páginas avulsas, com scripts e links (docs/lattes-formularios/recaptura.md).
 * Cada caminho vai sem f_cod; `{ path, noCode: true }` abre sem ele.
 */
async function inspect(
  paths: Parameters<typeof inspectPages>[2],
  options: Pick<Options, 'delayMs' | 'download' | 'redact'> = {},
): Promise<CensusFile> {
  const file = await inspectPages(port, await code(), paths, {
    ...options,
    collector: `lattes-editor ${__CENSO_VERSAO__}`,
  });
  if (options.download) download(file, `recaptura-${new Date().toISOString().slice(0, 10)}.json`);
  return file;
}

/** Os formulários de atividade de cada natureza, numa atuação do currículo. */
async function activities(
  options: Pick<Options, 'delayMs' | 'download' | 'redact'> = {},
): Promise<CensusFile> {
  const file = await inspectActivities(port, await code(), {
    ...options,
    collector: `lattes-editor ${__CENSO_VERSAO__}`,
  });
  if (options.download)
    download(file, `recaptura-atividades-${new Date().toISOString().slice(0, 10)}.json`);
  return file;
}

/**
 * A forma das linhas de autor do menu (autorDP), sem nomes: a ordem das
 * chaves, o padrão dos códigos e a linha do dono, achada pelo nome dado.
 */
function authorShape(ownerName?: string) {
  return vectorShape('autorDP', ownerName);
}

/** O mesmo para outro vetor do menu (titularPessoaDP, por exemplo). */
function vectorShape(name: string, ownerName?: string) {
  return shapeOf((globalThis as unknown as Record<string, unknown>)[name], ownerName);
}

/** Contagens para conferir de relance o que voltou. */
function summary(file: CensusFile) {
  const status: Record<string, number> = {};
  for (const e of file.entries) status[e.status] = (status[e.status] ?? 0) + 1;
  return {
    entries: file.entries.length,
    interrupted: Boolean(file.interrupted),
    links: file.links?.length ?? 0,
    lists: Object.keys(file.lists).length,
    status,
  };
}

(globalThis as unknown as { __lattesCensus: unknown }).__lattesCensus = {
  activities,
  authorShape,
  capture,
  captureAll,
  download,
  inspect,
  link,
  summary,
  vectorShape,
  version: __CENSO_VERSAO__,
};
