// "Carregar do Lattes" na aba do menu pela ponte local (scripts/censo-ponte.ts),
// sem a extensão, para o teste acompanhado no Lattes real: o mesmo
// loadCvFromLattes, com o transporte e os tetos de pedidos da extensão, e a
// comparação com a exportação do mesmo currículo, feita na própria aba. Só
// saem nomes de elementos e atributos e contagens, nunca valores do currículo
// (a não ser os códigos dos enumerados do XSD). Montado por
// scripts/build-conector-ponte.ts; não entra no app nem na extensão.

import { exportCv, type ExportPort } from '../src/bridge/export.ts';
import { readFormInPage } from '../src/bridge/form-dom.ts';
import { cvCodeFrom, lattesIdFrom } from '../src/bridge/lattes-html.ts';
import { loadCvFromLattes, type LoadResult } from '../src/bridge/load/loader.ts';
import { readPages } from '../src/bridge/load/pages.ts';
import { LattesTransport, READ_CONCURRENCY, READ_PACE } from '../src/bridge/transport.ts';
import { loadCv } from '../src/model/document.ts';
import { foldText } from '../src/model/fold-text.ts';
import { decodeLatin1 } from '../src/model/latin1.ts';
import { walk, type XElement } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';

// Na aba, fora do módulo: recarregar o pacote não perde a leitura feita.
const state = ((
  globalThis as unknown as {
    __carregarEstado?: { exported?: XElement; loaded?: LoadResult; traffic?: LattesTransport };
  }
).__carregarEstado ??= {});
let loaded = state.loaded;
let exported = state.exported;

/** Uma tarefa do transporte por leva, como a extensão faz. */
function inTask<T>(
  work: (
    get: (p: string) => Promise<string>,
    post: (p: string, b: string) => Promise<string>,
  ) => Promise<T>,
) {
  // Um transporte só para a leitura toda, como o da aba na extensão: o teto por
  // minuto vale entre as levas.
  const traffic = (state.traffic ??= new LattesTransport());
  return traffic.run(
    () => {
      const req = (path: string, init?: RequestInit) =>
        traffic.request(new URL(path, location.href), { credentials: 'include', ...init });
      const text = async (res: Response) => decodeLatin1(await traffic.bytes(res));
      return work(
        async (p) => text(await req(p)),
        async (p, body) =>
          text(
            await req(p, {
              body,
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              method: 'POST',
            }),
          ),
      );
    },
    undefined,
    READ_PACE,
  );
}

const counts = (root: XElement) => {
  const m: Record<string, number> = {};
  walk(root, (el) => {
    m[el.name] = (m[el.name] ?? 0) + 1;
  });
  return m;
};

/** Lê o currículo pelos formulários; devolve só o resumo. */
async function carregar() {
  const t0 = Date.now();
  loaded = state.loaded = await loadCvFromLattes({
    menu: async () => document.documentElement.outerHTML,
    pages: (requests) =>
      inTask((get, post) => readPages({ get, post }, requests, READ_CONCURRENCY)),
    readForm: readFormInPage,
  });
  return {
    elementos: loaded.doc ? counts(loaded.doc.root) : undefined,
    faltas: loaded.gaps,
    paginas: loaded.pages,
    parou: loaded.stopped,
    segundos: Math.round((Date.now() - t0) / 1000),
  };
}

/** A exportação do mesmo currículo, guardada na aba para a comparação. */
async function exportar() {
  const menu = document.documentElement.outerHTML;
  // Três pedidos, fora do transporte: a tela do Exportar e o POST do ZIP.
  const port: ExportPort = {
    async get(path) {
      const res = await fetch(new URL(path, location.href), { credentials: 'include' });
      return { html: decodeLatin1(new Uint8Array(await res.arrayBuffer())), url: res.url };
    },
    async postForBytes(path, body) {
      const res = await fetch(new URL(path, location.href), {
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
  const r = await exportCv(port, cvCodeFrom(menu), lattesIdFrom(menu));
  if (!r.ok) return { erro: r.reason };
  exported = state.exported = (await loadCv(r.bytes, r.fileName)).doc.root;
  return { elementos: counts(exported) };
}

/** Uma exportação guardada (o ZIP em base64), quando o Lattes não exporta agora. */
async function usarExportacao(zip: string) {
  const bytes = Uint8Array.from(atob(zip), (c) => c.charCodeAt(0));
  exported = state.exported = (await loadCv(bytes, 'guardada.zip')).doc.root;
  return { elementos: counts(exported) };
}

// SEQUENCIA-IMPORTANCIA é a ordem, não o número do item.
const SEQ = /^SEQUENCIA-(?!IMPORTANCIA)/;

/** A chave de um elemento: o caminho com os números de sequência de cada nível. */
function keyed(root: XElement): Map<string, XElement[]> {
  const out = new Map<string, XElement[]>();
  const visit = (el: XElement, path: string) => {
    const seq = el.attrs
      .filter((a) => SEQ.test(a.name) && a.value)
      .map((a) => `${a.name}=${a.value}`);
    const here = `${path}/${el.name}${seq.length ? `[${seq.join(',')}]` : ''}`;
    out.set(here, [...(out.get(here) ?? []), el]);
    for (const c of el.children) if (c.kind === 'element') visit(c, here);
  };
  visit(root, '');
  return out;
}

const norm = (v: string | undefined) => foldText((v ?? '').replace(/\s+/g, ' ').trim());

/**
 * Um valor que pode sair: código de enumerado do XSD, SIM/NAO, vazio, ou só a
 * forma (letras viram a, dígitos viram 9, o resto fica), sem o conteúdo.
 */
function safe(element: string, attr: string, v: string | undefined): string {
  if (!v) return '(vazio)';
  const spec = lattesSchema.elements[element]?.attributes.find((a) => a.name === attr);
  if (spec?.enum?.includes(v) || v === 'SIM' || v === 'NAO') return v;
  const shape = v
    .normalize('NFD')
    .replace(/\p{L}/gu, 'a')
    .replace(/\p{M}/gu, '')
    .replace(/\d/g, '9');
  return `${shape.length > 48 ? `${shape.slice(0, 48)}…` : shape} (${v.length})`;
}

/** Os irmãos sem número, pareados pelo maior número de atributos iguais. */
function pair(a: XElement[], b: XElement[]): [XElement, XElement | undefined][] {
  const free = [...b];
  return a.map((el) => {
    let best = -1;
    let at = -1;
    free.forEach((x, i) => {
      const same = el.attrs.filter(
        (y) => y.value && norm(x.attrs.find((z) => z.name === y.name)?.value) === norm(y.value),
      ).length;
      if (same > best) [best, at] = [same, i];
    });
    return [el, at >= 0 ? free.splice(at, 1)[0] : undefined];
  });
}

/**
 * Exportação contra o carregado: por ELEMENTO@ATRIBUTO, quantos itens diferem
 * e quantos o carregado não tem; os elementos que só um dos lados tem. Com
 * `detalhe`, os pares diferentes daquele atributo, no formato de safe().
 */
function comparar(detalhe?: string) {
  if (!exported || !loaded?.doc) return 'rode carregar() e exportar() antes';
  const a = keyed(exported);
  const b = keyed(loaded.doc.root);
  const soNaExportacao: Record<string, number> = {};
  const soNoCarregado: Record<string, number> = {};
  const atributos: Record<string, { diferente: number; falta: number }> = {};
  const pares: string[] = [];
  for (const [k, els] of a) {
    const name = k.split('/').pop()!.replace(/\[.*$/, '');
    for (const [el, twin] of pair(els, b.get(k) ?? [])) {
      if (!twin) {
        soNaExportacao[name] = (soNaExportacao[name] ?? 0) + 1;
        continue;
      }
      for (const at of el.attrs) {
        if (!at.value.trim()) continue;
        const got = twin.attrs.find((x) => x.name === at.name)?.value;
        const id = `${name}@${at.name}`;
        if (got === undefined || !got.trim()) {
          (atributos[id] ??= { diferente: 0, falta: 0 }).falta++;
          if (detalhe === id) pares.push(`${safe(name, at.name, at.value)} → (falta)`);
        } else if (norm(got) !== norm(at.value)) {
          (atributos[id] ??= { diferente: 0, falta: 0 }).diferente++;
          if (detalhe === id) {
            pares.push(`${safe(name, at.name, at.value)} → ${safe(name, at.name, got)}`);
          }
        }
      }
    }
  }
  for (const [k, els] of b) {
    if (!a.has(k)) {
      const name = k.split('/').pop()!.replace(/\[.*$/, '');
      soNoCarregado[name] = (soNoCarregado[name] ?? 0) + els.length;
    }
  }
  return detalhe ? pares : { atributos, soNaExportacao, soNoCarregado };
}

(globalThis as unknown as { __carregarPonte: unknown }).__carregarPonte = {
  carregar,
  comparar,
  exportar,
  usarExportacao,
};
