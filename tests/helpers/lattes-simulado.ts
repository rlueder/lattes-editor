// O Lattes simulado (scripts/lattes-simulado/) dentro do teste: sobe o
// servidor numa porta livre e entrega as portas que o núcleo do conector usa
// (LattesPort, ExportPort, ImportPort, PhotoPort, PublishPort), feitas como as da
// extensão (extension/src/lattes-runner.ts): fetch na base /cvlattesweb/,
// texto em Latin-1 e formulários lidos do HTML. A diferença é o menu: na aba,
// o conector lê o que está na tela; aqui, cada leitura pede o menu de novo,
// como uma aba recarregada.

import type { LattesState } from '../../scripts/lattes-simulado/estado.ts';
import { LOGON_REDIRECT } from '../../scripts/lattes-simulado/html.ts';
import type { SimRequest } from '../../scripts/lattes-simulado/pedido.ts';
import {
  type Intercept,
  type ServerOptions,
  startLattesSimulado,
} from '../../scripts/lattes-simulado/servidor.ts';
import type { SimResponse } from '../../scripts/lattes-simulado/tipos.ts';
import type { LattesPort } from '../../src/bridge/apply.ts';
import type { ExportPort } from '../../src/bridge/export.ts';
import type { ImportPort } from '../../src/bridge/importar.ts';
import type { PhotoPort } from '../../src/bridge/photo.ts';
import type { PublishPort } from '../../src/bridge/publish.ts';
import { decodeLatin1, encodeLatin1 } from '../../src/model/latin1.ts';
import { walk, type XElement } from '../../src/model/xml.ts';
import { readHtmlForm } from './html-form.ts';

const text = async (res: Response) => decodeLatin1(new Uint8Array(await res.arrayBuffer()));

const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };

export async function withLattesSimulado(options: ServerOptions = {}) {
  const lattes = await startLattesSimulado(options);
  const at = (path: string, base = lattes.base) => new URL(path, base);

  const port: LattesPort = {
    get: async (path) => text(await fetch(at(path))),
    menuHtml: async () => text(await fetch(at('PKG_MENU.menu'))),
    post: async (path, body) =>
      text(await fetch(at(path), { body, headers: FORM, method: 'POST' })),
    readForm: readHtmlForm,
  };

  const exportPort: ExportPort = {
    async get(path) {
      const res = await fetch(at(path));
      return { html: await text(res), url: res.url };
    },
    async postForBytes(path, body) {
      const res = await fetch(at(path), { body, headers: FORM, method: 'POST' });
      return {
        bytes: new Uint8Array(await res.arrayBuffer()),
        contentType: res.headers.get('content-type') ?? '',
        disposition: res.headers.get('content-disposition') ?? '',
        url: res.url,
      };
    },
  };

  const multipart: ImportPort['postMultipart'] = async (path, fields, file) => {
    const body = new FormData();
    body.append(file.field, new Blob([file.bytes as BlobPart], { type: file.type }), file.name);
    for (const [name, value] of fields) body.append(name, value);
    const res = await fetch(at(path), { body, method: 'POST' });
    return { html: await text(res), url: res.url };
  };

  const importPort: ImportPort = {
    get: exportPort.get,
    async post(path, body) {
      const res = await fetch(at(path), { body, headers: FORM, method: 'POST' });
      return { html: await text(res), url: res.url };
    },
    postMultipart: multipart,
  };

  const photoPort: PhotoPort = {
    get: exportPort.get,
    async getBytes(path) {
      const res = await fetch(at(path));
      return {
        bytes: new Uint8Array(await res.arrayBuffer()),
        contentType: res.headers.get('content-type') ?? '',
        url: res.url,
      };
    },
    postMultipart: multipart,
  };

  const publishPort: PublishPort = { get: exportPort.get, post: importPort.post };

  return { ...lattes, at, exportPort, importPort, photoPort, port, publishPort };
}

export type LattesSimuladoNoTeste = Awaited<ReturnType<typeof withLattesSimulado>>;

/**
 * Um currículo pequeno para os testes de alteração e exclusão (idioma,
 * resumo e vínculo): dois idiomas, uma atuação com dois vínculos e outra
 * sem vínculo. O que os Lattes falsos de bridge.test.ts e
 * delete-items.test.ts montavam cada um à sua maneira.
 */
export const SMALL_CV = `<?xml version="1.0" encoding="ISO-8859-1"?>
<CURRICULO-VITAE NUMERO-IDENTIFICADOR="0000000000000001"><DADOS-GERAIS NOME-COMPLETO="Pessoa de Teste">
<RESUMO-CV TEXTO-RESUMO-CV-RH="Resumo" TEXTO-RESUMO-CV-RH-EN="Summary"/>
<IDIOMAS><IDIOMA IDIOMA="EN" DESCRICAO-DO-IDIOMA="Inglês" PROFICIENCIA-DE-LEITURA="BEM" PROFICIENCIA-DE-FALA="BEM" PROFICIENCIA-DE-ESCRITA="BEM" PROFICIENCIA-DE-COMPREENSAO="BEM"/>
<IDIOMA IDIOMA="ES" DESCRICAO-DO-IDIOMA="Espanhol" PROFICIENCIA-DE-LEITURA="POUCO" PROFICIENCIA-DE-FALA="" PROFICIENCIA-DE-ESCRITA="" PROFICIENCIA-DE-COMPREENSAO=""/></IDIOMAS>
<ATUACOES-PROFISSIONAIS><ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="001" NOME-INSTITUICAO="X" SEQUENCIA-ATIVIDADE="5">
<VINCULOS SEQUENCIA-HISTORICO="1" TIPO-DE-VINCULO="CELETISTA" MES-INICIO="01" ANO-INICIO="2011" MES-FIM="12" ANO-FIM="2012" OUTRAS-INFORMACOES="" OUTRAS-INFORMACOES-INGLES="" FLAG-DEDICACAO-EXCLUSIVA="NAO" FLAG-VINCULO-EMPREGATICIO="SIM" CARGA-HORARIA-SEMANAL="40"/>
<VINCULOS SEQUENCIA-HISTORICO="2" TIPO-DE-VINCULO="CELETISTA" MES-INICIO="01" ANO-INICIO="2013" MES-FIM="" ANO-FIM="" OUTRAS-INFORMACOES="" OUTRAS-INFORMACOES-INGLES="" FLAG-DEDICACAO-EXCLUSIVA="NAO" FLAG-VINCULO-EMPREGATICIO="SIM" CARGA-HORARIA-SEMANAL="40"/>
</ATUACAO-PROFISSIONAL>
<ATUACAO-PROFISSIONAL CODIGO-INSTITUICAO="009" NOME-INSTITUICAO="Y" SEQUENCIA-ATIVIDADE="6"/>
</ATUACOES-PROFISSIONAIS></DADOS-GERAIS></CURRICULO-VITAE>`;

export function withSmallLattes(options: ServerOptions = {}) {
  return withLattesSimulado({ xml: encodeLatin1(SMALL_CV), ...options });
}

/** Os POSTs recebidos, com os campos decodificados. */
export function postsOf(lattes: { state: LattesState }) {
  return lattes.state.log
    .filter((l) => l.method === 'POST')
    .map((l) => ({
      fields: Object.fromEntries(l.pairs ?? []),
      pairs: l.pairs ?? [],
      proc: l.proc,
    }));
}

/** O primeiro elemento do currículo simulado que casa. */
export function findIn(root: XElement, match: (el: XElement) => boolean): XElement | undefined {
  let hit: XElement | undefined;
  walk(root, (el) => {
    if (!hit && match(el)) hit = el;
  });
  return hit;
}

const isMenu = (req: SimRequest) => req.proc.toLowerCase() === 'pkg_menu.menu';

/** Falhas que o Lattes de verdade pode ter, para os testes do conector. */
export const faults = {
  /** Grava e depois roda fn (um campo que não grava, um efeito colateral). */
  afterPost(fn: (req: SimRequest, state: LattesState) => void): Intercept {
    return async (req, state, next) => {
      const out = await next();
      if (req.method === 'POST') fn(req, state);
      return out;
    };
  },
  /** O POST não grava nada, mas responde como se tivesse gravado. */
  ignorePost(): Intercept {
    return (req, _state, next) =>
      req.method === 'POST' ? { html: '<script>/* nada gravado */</script>' } : next();
  },
  /** A sessão cai no n-ésimo GET, sem contar o do menu. */
  logonAtGet(n: number): Intercept {
    let gets = 0;
    return (req, _state, next) => {
      if (req.method !== 'GET' || isMenu(req)) return next();
      gets += 1;
      return gets === n ? { html: LOGON_REDIRECT } : next();
    };
  },
  /** A resposta de todo POST é outra (depois de gravar). */
  postResponse(html: string): Intercept {
    return async (req, _state, next) => {
      const out = await next();
      return req.method === 'POST' ? { html } : out;
    };
  },
  /** Troca o HTML das páginas (GET) dos procedimentos que casam. */
  rewritePages(proc: RegExp, fn: (html: string) => string): Intercept {
    return async (req, _state, next) => {
      const out = await next();
      if (req.method !== 'GET' || !proc.test(req.proc) || !('html' in out)) return out;
      return { ...out, html: fn(out.html) };
    };
  },
};

/** Vários intermediários em fila: o primeiro envolve os outros. */
export function chain(...intercepts: Intercept[]): Intercept {
  return (req, state, next) =>
    intercepts.reduceRight<() => Promise<SimResponse>>(
      (inner, outer) => async () => outer(req, state, inner),
      next,
    )();
}
