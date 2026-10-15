// O estado do Lattes simulado: o currículo em memória (a versão de trabalho,
// com o que ainda não foi enviado ao CNPq, e a publicada, que é a que o
// Exportar entrega), a pendência, a sessão, a solicitação do Importar e a
// foto. Nasce de fixtures/demo.xml, a pesquisadora fictícia.

import { readFileSync } from 'node:fs';

import { loadCv } from '../../src/model/document.ts';
import type { ProductionType } from '../../src/model/production.ts';
import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import {
  childElements,
  element,
  firstChild,
  getAttr,
  walk,
  type XDocument,
  type XElement,
} from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';

export const DEMO_XML = new URL('../../fixtures/demo.xml', import.meta.url);

/**
 * O que acontece com um item confirmado no passo 3 do Importar:
 * - "participante" (padrão): entra, menos o evento sem a própria pessoa entre
 *   os participantes, que some em silêncio (14/10/2026);
 * - "inserir": todo item entra;
 * - "descartar": nenhum entra, como no primeiro teste acompanhado.
 */
export type ImportOutcome = 'descartar' | 'inserir' | 'participante';

export interface Institution {
  /** Uma letra e 12 dígitos, como a busca mostra. */
  code: string;
  name: string;
  uf: string;
}

export interface SimuladoOptions {
  /** Código de 10 caracteres do currículo (f_cod das chamadas internas). */
  code?: string;
  /** Derruba a sessão depois deste número de pedidos (contando todos). */
  expireAfterRequests?: number;
  importOutcome?: ImportOutcome;
  /** Instituições a mais na busca, além das do simulado (buscas.ts). */
  institutions?: Institution[];
  /**
   * Mostra no HTML do formulário de eventos o tipo de participação gravado,
   * marcado. A página observada não mostra (o script monta a lista); serve
   * para testar o caminho em que a edição de um convidado o trouxesse.
   */
  tpoRendered?: boolean;
  /** O currículo de partida; o padrão é fixtures/demo.xml. */
  xml?: Uint8Array;
}

/** Item do arquivo enviado ao Importar, com o id que o servidor deu (f_sq). */
export interface ImportItem {
  el: XElement;
  id: string;
  /** Valor da caixa f_chkp do módulo. */
  module: number;
  title: string;
  /** Onde o item entra no currículo. */
  type: ProductionType;
  year?: number;
}

export interface ImportRequest {
  /** Módulos e ano escolhidos no passo 2, quando ele foi confirmado. */
  chosen?: { modules: number[]; year: number };
  id: string;
  items: ImportItem[];
}

/** Um pedido recebido, para o teste conferir o caminho percorrido. */
export interface LoggedRequest {
  /** O corpo de um POST urlencoded, como chegou (Latin-1 percentual). */
  body?: string;
  ctr?: string;
  /** O arquivo de um POST multipart: o campo e o nome. */
  file?: { field: string; name: string };
  method: string;
  /** Os campos de um POST, na ordem em que vieram. */
  pairs?: [string, string][];
  /** O procedimento com a query, como veio no caminho. */
  path: string;
  proc: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const brDate = (d: Date) =>
  `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/** Um JPEG mínimo (1 × 1) para a foto de partida. */
const PLACEHOLDER_JPEG = Uint8Array.from(
  Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=',
    'base64',
  ),
);

export class LattesState {
  code: string;
  expireAfterRequests?: number;
  /** Ids do servidor para itens sem número no XML (idiomas). */
  private ids = new WeakMap<XElement, string>();
  /** O que cada item confirmado no passo 3 virou: o número dado e se entrou. */
  imported: { inserted: boolean; seq: string; title: string }[] = [];
  importOutcome: ImportOutcome;
  importRequest?: ImportRequest;
  /** As instituições a mais que a busca encontra. */
  institutions: Institution[];
  /** O tipo de participação gravado aparece no HTML do evento (SimuladoOptions). */
  tpoRendered: boolean;
  lastPublished = new Date(2026, 9, 6);
  lastUpdate = new Date(2026, 9, 6);
  log: LoggedRequest[] = [];
  private nextId = 1;
  private nextImportId = 1;
  /** O último SEQUENCIA-PRODUCAO dado; cada item confirmado no Importar gasta um. */
  nextProduction = 0;
  pending = false;
  photo: Uint8Array = PLACEHOLDER_JPEG;
  /** Campos de formulário sem atributo no XML (f_classif do evento), por item. */
  private formOnlyFields = new WeakMap<XElement, Record<string, string>>();
  /** Privacidade por item (f_tipo_privacidade), que o XML não traz. */
  privacy = new WeakMap<XElement, string>();
  published: XDocument;
  sessionActive = true;
  working: XDocument;

  private constructor(doc: XDocument, options: SimuladoOptions) {
    this.code = options.code ?? 'K4790210P3';
    this.expireAfterRequests = options.expireAfterRequests;
    this.importOutcome = options.importOutcome ?? 'participante';
    this.institutions = options.institutions ?? [];
    this.tpoRendered = options.tpoRendered ?? false;
    this.working = doc;
    this.published = structuredClone(doc);
    walk(doc.root, (el) => {
      const n = Number(getAttr(el, 'SEQUENCIA-PRODUCAO'));
      if (n > this.nextProduction) this.nextProduction = n;
    });
  }

  static async create(options: SimuladoOptions = {}): Promise<LattesState> {
    const bytes = options.xml ?? new Uint8Array(readFileSync(DEMO_XML));
    const cv = await loadCv(bytes, 'demo.xml');
    return new LattesState(cv.doc, options);
  }

  get root(): XElement {
    return this.working.root;
  }

  get lattesId(): string {
    return getAttr(this.root, 'NUMERO-IDENTIFICADOR') ?? '';
  }

  get personName(): string {
    return getAttr(this.general, 'NOME-COMPLETO') ?? '';
  }

  get general(): XElement {
    return this.ensure(this.root, 'DADOS-GERAIS');
  }

  /** Um filho, criado na ordem do schema quando falta. */
  ensure(parent: XElement, name: string): XElement {
    const found = firstChild(parent, name);
    if (found) return found;
    const created = element(name);
    insertInSchemaOrder(lattesSchema, parent, created);
    return created;
  }

  /** O caminho de contêineres a partir da raiz, criando os que faltam. */
  ensurePath(names: string[]): XElement {
    return names.reduce((parent, name) => this.ensure(parent, name), this.root);
  }

  /** Um contêiner pelo caminho, sem criar. */
  find(names: string[]): XElement | undefined {
    let el: XElement | undefined = this.root;
    for (const name of names) el = el && firstChild(el, name);
    return el;
  }

  /** Id estável de um item que o XML não numera (o f_seq do idioma). */
  idOf(el: XElement): string {
    let id = this.ids.get(el);
    if (!id) {
      id = String(this.nextId++);
      this.ids.set(el, id);
    }
    return id;
  }

  /** Os campos sem atributo no XML guardados ao lado do item. */
  formOnly(el: XElement): Record<string, string> {
    let fields = this.formOnlyFields.get(el);
    if (!fields) {
      fields = {};
      this.formOnlyFields.set(el, fields);
    }
    return fields;
  }

  newImportId(): string {
    return String(this.nextImportId++);
  }

  remove(parent: XElement, child: XElement): void {
    parent.children = parent.children.filter((c) => c !== child);
  }

  /** Um POST gravado pelo formulário: o currículo fica com alteração pendente. */
  touch(now = new Date()): void {
    this.pending = true;
    this.lastUpdate = now;
  }

  /** "Enviar ao CNPq": a versão publicada passa a ser a de trabalho. */
  publish(now = new Date()): void {
    this.published = structuredClone(this.working);
    this.pending = false;
    this.lastPublished = now;
  }

  /** O próximo número em `attr` entre os irmãos `name`, acima do maior. */
  nextSeq(parent: XElement, name: string, attr: string): string {
    const max = Math.max(
      0,
      ...childElements(parent, name).map((c) => Number(getAttr(c, attr)) || 0),
    );
    return String(max + 1);
  }
}
