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
//   __lattesCensus.authorShape(['Nome Completo', 'NOME, N.']) // forma das linhas de autor
//   __lattesCensus.vectorShape('titularPessoaDP', 'Nome') // o mesmo, para outro vetor do menu
//
// Só GET de formulário e de lista. As exceções: link() sem XML, que pede a
// exportação pelo mesmo POST de leitura do "Exportar" (o conector já faz o
// mesmo, docs/lattes_internals.md, seção 12), e testItems() e
// removeTestItems(), que gravam no currículo e só a pessoa roda.

import { exportCv, type ExportPort } from '../../src/bridge/export.ts';
import { cvCodeFrom, isLogonPage, lattesIdFrom } from '../../src/bridge/lattes-html.ts';
import { authorShape as shapeOf } from '../../src/census/author-shape.ts';
import { inspectActivities, inspectPages } from '../../src/census/inspect.ts';
import { linkFields, linkOnlyFile, type LinkOptions } from '../../src/census/link.ts';
import {
  type CensusFile,
  type CensusOptions,
  type CensusPort,
  runCensus,
} from '../../src/census/run.ts';
import { testJobs } from '../../src/census/test-plan.ts';
import { readZip } from '../../src/import-export/zip.ts';
import { decodeLatin1, decodeXmlBytes } from '../../src/model/latin1.ts';
import { censusGet, clearCensusCache, withCensusCache } from './censo-reading.ts';
import { ensureContext } from './censo-test-donors.ts';
import {
  createTestItems,
  live,
  resetTestItems,
  setLive,
  testProgress,
} from './censo-test-items.ts';
import { loadBase, markInCv, saveBase, snapshotLists } from './censo-test-ledger.ts';
import { removeTestItems } from './censo-test-removal.ts';
import { censusTraffic } from './censo-traffic.ts';

declare const __CENSO_VERSAO__: string;
declare const __CENSUS_BUILD__: string;

const base = () => new URL('/cvlattesweb/', location.origin);

/** Na leitura dos formulários dos itens de teste: cada página lida conta no andamento. */
let reading = false;

/**
 * No Lattes, um GET também executa: o link de exclusão de uma atuação é
 * pkg_ativ.form com f_ctr=E2, e apagou a atuação inteira quando foi lido
 * como página (18/10/2026). Leitura nunca leva f_ctr de exclusão.
 */
export const DELETE_GET = /[?&]f_ctr=E/i;

async function get(path: string) {
  if (DELETE_GET.test(path))
    throw new Error(`Leitura recusada, o endereço exclui: ${path.split('?')[0]}`);
  if (reading) setLive({ done: (live()?.done ?? 0) + 1, last: path.split('?')[0] });
  const res = await censusGet(new URL(path, base()));
  return {
    html: decodeLatin1(res.bytes),
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
    const res = await censusTraffic.request(new URL(path, base()), 'POST', body);
    return {
      bytes: res.bytes,
      contentType: new Headers(res.headers).get('content-type') ?? '',
      disposition: new Headers(res.headers).get('content-disposition') ?? '',
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

/**
 * Só a passada de edição. Com `download`, baixa um arquivo no formato do censo
 * (sem formulários), que o relatório lê junto com as capturas
 * (docs/lattes-formularios/README.md).
 */
async function link(xml?: string, options: LinkOptions & { download?: boolean } = {}) {
  const result = await linkFields(port, await code(), xml ?? (await exportedXml()), options);
  if (options.download) {
    const day = new Date().toISOString().slice(0, 10);
    download(
      linkOnlyFile(result, `lattes-editor ${__CENSO_VERSAO__}`),
      `censo-${day}-ligacoes.json`,
    );
  }
  return result;
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
 * Páginas avulsas, com scripts e links (docs/lattes-formularios/README.md).
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
 * chaves, o padrão dos códigos, cada linha que casa com o nome completo ou
 * uma das citações dadas, e se a linha sem código é uma delas.
 */
function authorShape(ownerNames?: string | string[]) {
  return vectorShape('autorDP', ownerNames);
}

/** O mesmo para outro vetor do menu (titularPessoaDP, por exemplo). */
function vectorShape(name: string, ownerNames?: string | string[]) {
  return shapeOf((globalThis as unknown as Record<string, unknown>)[name], ownerNames);
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

/**
 * Os itens de teste da passada completa (docs/lattes-formularios/
 * itens-de-teste.md), um lote por chamada. Grava no currículo: só a pessoa
 * roda, na aba do menu.
 */
let captured: CensusFile | undefined;
/** Lê os formulários uma vez (alguns minutos); os lotes seguintes usam a leitura. */
async function prepareTestItems() {
  // A leitura inclui os seus itens de onde as buscas são copiadas: antes ela
  // ficava para o começo do primeiro lote, que parecia parado sem andamento.
  setLive({ done: 0, last: undefined, phase: 'lendo', total: undefined });
  reading = true;
  try {
    if (!captured || captured.interrupted) captured = await capture({ download: false });
    if (!captured.interrupted) await ensureContext(await code(), get);
  } finally {
    reading = false;
    setLive({ phase: 'parado' });
  }
  // Sessão caída no meio da leitura: nenhum formulário foi lido, e o lote
  // sairia vazio como se não faltasse nada.
  if (captured.interrupted) {
    const lost = captured;
    captured = undefined;
    throw new Error(
      `A leitura dos formulários parou (${lost.entries.filter((e) => e.status === 'nao-lido').length} sem ler): a sessão do Lattes pode ter caído. Entre de novo e rode outra vez.`,
    );
  }
  // A base das listas (Fase 0), antes do primeiro item: sem ela, a remoção
  // não teria com o que comparar.
  if (!loadBase()) {
    if (testProgress().criados > 0) {
      throw new Error(
        'Há itens de teste criados sem a base das listas. Confira e remova-os à mão, rode resetTestItems() e comece de novo.',
      );
    }
    setLive({ done: 0, last: undefined, phase: 'lendo', total: undefined });
    reading = true;
    try {
      // Uma base com itens de teste dentro os tomaria por seus.
      const marks = await markInCv(await code(), get);
      if (marks > 0) {
        throw new Error(
          `O currículo já tem ${marks} ocorrências da marca dos itens de teste. Remova-as antes de tirar a base.`,
        );
      }
      saveBase(await snapshotLists(await menuHtml(), await code(), get));
    } finally {
      reading = false;
      setLive({ phase: 'parado' });
    }
  }
  return testProgress(testJobs(captured));
}

async function testItems(options: Parameters<typeof createTestItems>[3] = {}) {
  await prepareTestItems();
  clearCensusCache();
  return createTestItems(testJobs(captured!), await code(), get, options);
}

/** Como a leitura achou um formulário (estado, formulários, endereço), sem tocar no Lattes. */
function entryOf(id: string) {
  const e = captured?.entries.find((x) => x.id === id);
  if (!e) return captured ? 'não está na leitura' : 'sem leitura';
  return {
    forms: e.page?.forms.map((f) => f.name),
    jobs: testJobs(captured!).filter((j) => j.id === id).length,
    status: e.status,
  };
}

/** O andamento guardado, sem tocar no Lattes. */
function progress() {
  return testProgress(captured ? testJobs(captured) : undefined);
}

async function removeTests(options: Parameters<typeof removeTestItems>[2] = {}) {
  clearCensusCache();
  return removeTestItems(await code(), get, options);
}

async function protectedRun<T>(work: () => Promise<T>): Promise<T> {
  if (censusTraffic.running) throw new Error('O censo já está ocupado');
  try {
    return await censusTraffic.run(() => withCensusCache(work));
  } finally {
    setLive({ phase: 'parado' });
  }
}

(globalThis as unknown as { __lattesCensus: unknown }).__lattesCensus = {
  activities: (...args: Parameters<typeof activities>) => protectedRun(() => activities(...args)),
  authorShape,
  build: __CENSUS_BUILD__,
  cancel: () => censusTraffic.cancel(),
  capture: (...args: Parameters<typeof capture>) => protectedRun(() => capture(...args)),
  captureAll: (...args: Parameters<typeof captureAll>) => protectedRun(() => captureAll(...args)),
  download,
  entryOf,
  inspect: (...args: Parameters<typeof inspect>) => protectedRun(() => inspect(...args)),
  link: (...args: Parameters<typeof link>) => protectedRun(() => link(...args)),
  prepareTestItems: () => protectedRun(prepareTestItems),
  removeTestItems: (...args: Parameters<typeof removeTests>) =>
    protectedRun(() => removeTests(...args)),
  resetTestItems,
  summary,
  testItems: (...args: Parameters<typeof testItems>) => protectedRun(() => testItems(...args)),
  testProgress: progress,
  vectorShape,
  version: __CENSO_VERSAO__,
};
