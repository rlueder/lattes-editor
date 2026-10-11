// Itens de produção novos: tipos importáveis, montagem no formato que o Lattes
// exporta, autores, número de sequência e inserção no documento.
//
// Formato observado nas exportações (exportação de 17/08/2026 e o item
// aceito no teste de 10/10/2026, guia 3.5): DADOS-BASICOS-* e DETALHAMENTO-*
// sempre, com todos os atributos (vazios como ""); autores ou participantes
// sem CPF; PALAVRAS-CHAVE, AREAS-DO-CONHECIMENTO, SETORES-DE-ATIVIDADE e
// INFORMACOES-ADICIONAIS só quando preenchidos.

import { IMPORT_MODULES, type ImportModule } from '../import-export/importable.ts';
import type { LattesSchema } from '../schema/types.ts';
import { insertInSchemaOrder } from './schema-order.ts';
import {
  childElements,
  element,
  firstChild,
  getAttr,
  walk,
  type XAttr,
  type XDocument,
  type XElement,
} from './xml.ts';

export const SEQ_ATTR = 'SEQUENCIA-PRODUCAO';

/** Um tipo de item que o Importar aceita, com o caminho do contêiner a partir da raiz. */
export interface ProductionType {
  /** Contêineres da raiz até o pai do item, sem incluir a raiz. */
  containerPath: string[];
  itemName: string;
  module: ImportModule;
}

export function importableTypes(schema: LattesSchema): ProductionType[] {
  const types: ProductionType[] = [];
  for (const module of IMPORT_MODULES) {
    for (const path of module.paths) {
      const segments = path.split('/');
      const last = segments.at(-1)!;
      if (last === '*') {
        const container = segments.slice(0, -1);
        const parent = container.at(-1)!;
        for (const child of schema.elements[parent]?.children ?? []) {
          if (module.exclude?.includes(child.name)) continue;
          types.push({ containerPath: container, itemName: child.name, module });
        }
      } else {
        types.push({ containerPath: segments.slice(0, -1), itemName: last, module });
      }
    }
  }
  return types;
}

export function productionType(schema: LattesSchema, itemName: string): ProductionType | undefined {
  return importableTypes(schema).find((t) => t.itemName === itemName);
}

// Autores ---------------------------------------------------------------------

export interface Author {
  citation: string;
  /** NRO-ID-CNPQ, 16 dígitos; vazio para quem não tem currículo Lattes. */
  lattesId: string;
  name: string;
}

const AUTHOR_ELEMENTS = ['AUTORES', 'PARTICIPANTE-BANCA', 'PARTICIPANTE-DE-EVENTOS-CONGRESSOS'];

/** O elemento de autoria que o tipo usa (AUTORES ou um dos PARTICIPANTE-*). */
export function authorElementName(schema: LattesSchema, itemName: string): string | undefined {
  return schema.elements[itemName]?.children.find((c) => AUTHOR_ELEMENTS.includes(c.name))?.name;
}

/** Papel de cada atributo de um elemento de autoria, pelo nome. CPF fica de fora. */
function authorRole(attr: string): keyof Author | 'order' | 'cpf' | undefined {
  if (attr.startsWith('CPF')) return 'cpf';
  if (attr.startsWith('NOME-COMPLETO')) return 'name';
  if (attr.startsWith('NOME-PARA-CITACAO')) return 'citation';
  if (attr.startsWith('ORDEM')) return 'order';
  if (attr === 'NRO-ID-CNPQ') return 'lattesId';
  return undefined;
}

export function readAuthor(el: XElement): Author {
  const author: Author = { citation: '', lattesId: '', name: '' };
  for (const a of el.attrs) {
    const role = authorRole(a.name);
    if (role === 'name' || role === 'citation' || role === 'lattesId') author[role] = a.value;
  }
  return author;
}

export function readAuthors(item: XElement): Author[] {
  return childElements(item)
    .filter((c) => AUTHOR_ELEMENTS.includes(c.name))
    .sort((a, b) => order(a) - order(b))
    .map(readAuthor);
}

function order(el: XElement): number {
  const attr = el.attrs.find((a) => authorRole(a.name) === 'order');
  return Number.parseInt(attr?.value ?? '', 10) || 0;
}

/** Substitui os autores do item, na ordem dada, no lugar que o schema manda. */
export function setAuthors(schema: LattesSchema, item: XElement, authors: Author[]): void {
  const name = authorElementName(schema, item.name);
  if (!name) throw new Error(`${item.name} não tem elemento de autoria`);
  item.children = item.children.filter((c) => c.kind !== 'element' || c.name !== name);
  const spec = schema.elements[name]!;
  authors.forEach((author, i) => {
    const attrs: XAttr[] = [];
    for (const a of spec.attributes) {
      const role = authorRole(a.name);
      if (role === 'cpf') continue;
      const value = role === 'order' ? String(i + 1) : role ? author[role] : '';
      attrs.push({ name: a.name, value });
    }
    insertInSchemaOrder(schema, item, element(name, attrs));
  });
}

/**
 * Coautores já presentes no currículo, sem repetição, com o dono primeiro.
 * Serve de lista para reaproveitar entre itens (guia, marco 2).
 */
export function knownAuthors(doc: XDocument): Author[] {
  const dg = firstChild(doc.root, 'DADOS-GERAIS');
  const owner: Author = {
    citation: (dg && getAttr(dg, 'NOME-EM-CITACOES-BIBLIOGRAFICAS'))?.split(';')[0]?.trim() ?? '',
    lattesId: getAttr(doc.root, 'NUMERO-IDENTIFICADOR') ?? '',
    name: (dg && getAttr(dg, 'NOME-COMPLETO')) ?? '',
  };
  const seen = new Set<string>();
  const key = (a: Author) =>
    a.lattesId ? `id:${a.lattesId}` : `nome:${a.name.trim().toLowerCase()}`;
  const list: Author[] = [];
  const add = (a: Author) => {
    if (!a.name.trim()) return;
    const k = key(a);
    if (seen.has(k)) return;
    seen.add(k);
    // O dono também aparece pelo nome, sem ID, em itens antigos.
    seen.add(`nome:${a.name.trim().toLowerCase()}`);
    list.push(a);
  };
  add(owner);
  walk(doc.root, (el) => {
    if (AUTHOR_ELEMENTS.includes(el.name)) add(readAuthor(el));
  });
  return list;
}

// Montagem ---------------------------------------------------------------------

/**
 * Atributos vazios na ordem do schema. FLAG-* SIM/NAO começa em NAO, como a
 * caixa desmarcada no formulário do Lattes (o item aceito em 10/10/2026 tinha
 * FLAG-RELEVANCIA="NAO"). Os outros enums ficam vazios até alguém escolher, e
 * a validação impede exportar assim.
 */
function emptyAttrs(schema: LattesSchema, name: string): XAttr[] {
  return (schema.elements[name]?.attributes ?? [])
    .filter((a) => !a.name.startsWith('CPF'))
    .map((a) => {
      const flag = a.name.startsWith('FLAG-') && a.enum?.includes('NAO');
      return { name: a.name, value: a.default ?? (flag ? 'NAO' : '') };
    });
}

const OPTIONAL_EXTRAS = [
  'PALAVRAS-CHAVE',
  'AREAS-DO-CONHECIMENTO',
  'SETORES-DE-ATIVIDADE',
  'INFORMACOES-ADICIONAIS',
];

/**
 * Item vazio com o número de sequência já atribuído: dados básicos,
 * detalhamento e filhos obrigatórios. Autores e extras entram depois.
 */
export function newItem(schema: LattesSchema, itemName: string, sequencia: number): XElement {
  const spec = schema.elements[itemName];
  if (!spec) throw new Error(`Tipo de item desconhecido: ${itemName}`);
  const attrs = emptyAttrs(schema, itemName);
  const seq = attrs.find((a) => a.name === SEQ_ATTR);
  if (!seq) throw new Error(`${itemName} não tem ${SEQ_ATTR}`);
  seq.value = String(sequencia);
  const item = element(itemName, attrs);
  for (const child of spec.children) {
    const structural =
      child.name.startsWith('DADOS-BASICOS') || child.name.startsWith('DETALHAMENTO');
    if (structural || (child.min > 0 && !AUTHOR_ELEMENTS.includes(child.name))) {
      insertInSchemaOrder(schema, item, element(child.name, emptyAttrs(schema, child.name)));
    }
  }
  return item;
}

/** Parte do item pelo prefixo: "DADOS-BASICOS" ou "DETALHAMENTO". */
export function itemPart(item: XElement, prefix: string): XElement | undefined {
  return childElements(item).find((c) => c.name.startsWith(prefix));
}

/** Palavras-chave (até 6): cria, atualiza ou remove PALAVRAS-CHAVE. */
export function setKeywords(schema: LattesSchema, item: XElement, words: string[]): void {
  const clean = words
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 6);
  item.children = item.children.filter((c) => c.kind !== 'element' || c.name !== 'PALAVRAS-CHAVE');
  if (clean.length === 0) return;
  const attrs = emptyAttrs(schema, 'PALAVRAS-CHAVE').map((a) => {
    const n = Number(a.name.split('-').pop());
    return { name: a.name, value: clean[n - 1] ?? '' };
  });
  insertInSchemaOrder(schema, item, element('PALAVRAS-CHAVE', attrs));
}

export function readKeywords(item: XElement): string[] {
  const kw = firstChild(item, 'PALAVRAS-CHAVE');
  return kw ? kw.attrs.map((a) => a.value).filter((v) => v.trim()) : [];
}

/** Tira extras opcionais que ficaram sem nenhum valor, como o Lattes faz. */
export function pruneEmptyExtras(item: XElement): void {
  const hasValue = (el: XElement): boolean =>
    el.attrs.some((a) => a.value.trim() !== '') || childElements(el).some(hasValue);
  item.children = item.children.filter(
    (c) => c.kind !== 'element' || !OPTIONAL_EXTRAS.includes(c.name) || hasValue(c),
  );
}

/** Insere o item no documento, criando os contêineres que faltam na ordem do schema. */
export function addProduction(
  schema: LattesSchema,
  doc: XDocument,
  type: ProductionType,
  item: XElement,
): void {
  let parent = doc.root;
  for (const name of type.containerPath) {
    let next = firstChild(parent, name);
    if (!next) {
      next = element(name);
      insertInSchemaOrder(schema, parent, next);
    }
    parent = next;
  }
  insertInSchemaOrder(schema, parent, item);
}

/** Remove um item pelo número de sequência. Só faz sentido para itens novos. */
export function removeProduction(doc: XDocument, sequencia: number): boolean {
  let removed = false;
  walk(doc.root, (el) => {
    const before = el.children.length;
    el.children = el.children.filter(
      (c) => c.kind !== 'element' || getAttr(c, SEQ_ATTR) !== String(sequencia),
    );
    if (el.children.length !== before) removed = true;
  });
  return removed;
}

/** Itens criados no editor: sequência acima do maior número da exportação carregada. */
export function pendingItems(doc: XDocument, loadedMax: number): XElement[] {
  const items: XElement[] = [];
  walk(doc.root, (el) => {
    const n = Number.parseInt(getAttr(el, SEQ_ATTR) ?? '', 10);
    if (Number.isFinite(n) && n > loadedMax) items.push(el);
  });
  return items;
}

export function findBySequencia(doc: XDocument, sequencia: number): XElement | undefined {
  let found: XElement | undefined;
  walk(doc.root, (el) => {
    if (!found && getAttr(el, SEQ_ATTR) === String(sequencia)) found = el;
  });
  return found;
}

/** Troca um item (achado pela sequência) por outro, no mesmo lugar. */
export function replaceProduction(doc: XDocument, sequencia: number, next: XElement): boolean {
  let replaced = false;
  walk(doc.root, (el) => {
    if (replaced) return;
    const i = el.children.findIndex(
      (c) => c.kind === 'element' && getAttr(c, SEQ_ATTR) === String(sequencia),
    );
    if (i >= 0) {
      el.children[i] = next;
      replaced = true;
    }
  });
  return replaced;
}

/** Próximo número livre: nunca abaixo do contador salvo nem do maior do documento. */
export function nextSequencia(doc: XDocument, counter: number): number {
  let max = 0;
  walk(doc.root, (el) => {
    const n = Number.parseInt(getAttr(el, SEQ_ATTR) ?? '', 10);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return Math.max(counter, max + 1);
}
