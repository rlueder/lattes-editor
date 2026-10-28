// O que as seções de "Carregar do Lattes" usam em comum: as linhas de uma
// lista (os links de alteração), o formulário lido de uma página e os
// contêineres criados na ordem do schema.

import { insertInSchemaOrder } from '../../../model/schema-order.ts';
import { element, firstChild, type XElement } from '../../../model/xml.ts';
import { lattesSchema } from '../../../schema/lattes.ts';
import { findLinks, type LattesLink } from '../../lattes-html.ts';
import { type FormReading, readFormPage } from '../../refresh/read.ts';
import type { LoadContext } from '../loader.ts';

/** As listas lidas cujo procedimento é este, e cujos parâmetros têm estes valores ('' é sem). */
export function listsOf(
  ctx: LoadContext,
  proc: string,
  params: Record<string, string> = {},
): { html: string; url: string }[] {
  return [...ctx.lists.entries()]
    .filter(([key]) => {
      const [path = '', query = ''] = key.split('?');
      if (path !== proc.toLowerCase()) return false;
      const q = new URLSearchParams(query);
      return Object.entries(params).every(([k, v]) => (v === '' ? !q.get(k) : q.get(k) === v));
    })
    .map(([, page]) => page);
}

/** Os links de alteração das listas, sem repetir (a lista geral e a de divulgação). */
export function rowLinks(
  pages: { html: string }[],
  formProc: string,
  isRow: (params: Record<string, string>) => boolean = (p) => Boolean(p.f_seq),
): LattesLink[] {
  const seen = new Map<string, LattesLink>();
  for (const page of pages) {
    for (const link of findLinks(page.html, formProc)) {
      if (!isRow(link.params)) continue;
      const key = link.path.toLowerCase();
      if (!seen.has(key)) seen.set(key, link);
    }
  }
  return [...seen.values()];
}

/** O formulário de uma página: o primeiro dos nomes que ela tem. */
export function formIn(
  ctx: LoadContext,
  html: string | undefined,
  link: string,
  names: string[],
): FormReading | undefined {
  if (html === undefined) return undefined;
  const reading = readFormPage(html, { forms: names, link }, ctx.readForm);
  return reading.error ? undefined : reading;
}

/** O contêiner no caminho, criando os que faltam na ordem do schema. */
export function ensurePath(root: XElement, names: readonly string[]): XElement {
  let parent = root;
  for (const name of names) {
    let next = firstChild(parent, name);
    if (!next) {
      next = element(name);
      insertInSchemaOrder(lattesSchema, parent, next);
    }
    parent = next;
  }
  return parent;
}

/** Insere o item no pai, na ordem do schema. */
export const place = (parent: XElement, item: XElement) =>
  insertInSchemaOrder(lattesSchema, parent, item);
