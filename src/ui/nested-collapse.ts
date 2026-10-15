// Listas dentro de listas na leitura (Atuação › Atividades › Projeto ›
// Equipe): o registro e o primeiro nível de listas ficam abertos; do segundo
// nível para baixo, cada lista começa fechada numa linha de texto ("Projeto
// de pesquisa: Genômica da conservação · ver detalhes", "Equipe do projeto ·
// 4 pessoas · mostrar"). Abrir e fechar vale para aquela lista, na sessão.
//
// Uma lista fechada abre sozinha quando tem o campo em foco na edição (para o
// trecho aceso aparecer na prévia) ou um resultado da busca da seção.

import { createContext, useContext } from 'react';

import type { XElement } from '../model/xml.ts';
import { matchesQuery } from './facets.ts';
import { lineText, type NestedGroup, partText, type Section } from './reading-layout.ts';

/** Do segundo nível de listas para baixo, a lista começa fechada. */
export const COLLAPSE_FROM_LEVEL = 2;

export function startsCollapsed(level: number): boolean {
  return level >= COLLAPSE_FROM_LEVEL;
}

/** As chaves de todos os campos de uma seção, com as listas dentro dela. */
function sectionKeys(s: Section): string[] {
  const parts = [...s.lines.flatMap((l) => l.parts), ...s.rows, ...(s.when?.parts ?? [])];
  return [...parts.map((p) => p.key), ...s.nested.flatMap(groupKeys)];
}

export function groupKeys(g: NestedGroup): string[] {
  return g.items.flatMap(sectionKeys);
}

/** O texto de uma seção, com as listas dentro dela, para a busca. */
function sectionText(s: Section): string {
  const parts = [...s.lines.flatMap((l) => l.parts), ...s.rows, ...(s.when?.parts ?? [])];
  return [...parts.map(partText), ...s.nested.map(groupText)].join(' ');
}

export function groupText(g: NestedGroup): string {
  return g.items.map(sectionText).join(' ');
}

/** A lista fechada precisa abrir: tem o campo em foco ou um resultado da busca. */
export function mustExpand(g: NestedGroup, focusPart: string | null, query: string): boolean {
  if (focusPart !== null && groupKeys(g).includes(focusPart)) return true;
  return query.trim() !== '' && matchesQuery(groupText(g), query);
}

/**
 * A linha da lista fechada, sem a palavra de ação: com um item e título, o
 * rótulo e o título ("Projeto de pesquisa: Genômica da conservação"); senão,
 * o rótulo e a contagem ("Equipe do projeto · 4 pessoas").
 */
export function collapsedText(g: NestedGroup, items: Section[]): string {
  const title = items.length === 1 && items[0]!.lines[0] ? lineText(items[0]!.lines[0]) : '';
  if (title) return `${g.label}: ${title}`;
  const n = items.length;
  const noun = g.people ? (n === 1 ? 'pessoa' : 'pessoas') : n === 1 ? 'item' : 'itens';
  return `${g.label} · ${n} ${noun}`;
}

/** A palavra de ação: abrir o detalhe de um item, mostrar a lista, ocultar. */
export function actionWord(open: boolean, items: Section[], hasTitle: boolean): string {
  if (open) return 'ocultar';
  return items.length === 1 && hasTitle ? 'ver detalhes' : 'mostrar';
}

// Aberta ou fechada, por lista: o bloco (o elemento do item, o mesmo na
// leitura e na edição) e a posição da lista nele. Só nesta sessão da página.
const memory = new WeakMap<XElement, Map<string, boolean>>();

export function rememberedNested(scope: XElement | null, id: string | undefined) {
  if (!scope || id === undefined) return undefined;
  return memory.get(scope)?.get(id);
}

export function rememberNested(scope: XElement | null, id: string | undefined, open: boolean) {
  if (!scope || id === undefined) return;
  const map = memory.get(scope) ?? new Map<string, boolean>();
  map.set(id, open);
  memory.set(scope, map);
}

/** O item do bloco, para a memória das listas abertas; sem provedor, nenhum. */
export const NestedScopeContext = createContext<XElement | null>(null);

/** A chave do campo em foco na edição (a do trecho aceso na prévia). */
export const FocusPartContext = createContext<string | null>(null);

/** A busca da seção, para abrir a lista que tem um resultado. */
export const ReadingQueryContext = createContext('');

export function useNestedContext() {
  return {
    focusPart: useContext(FocusPartContext),
    query: useContext(ReadingQueryContext),
    scope: useContext(NestedScopeContext),
  };
}
