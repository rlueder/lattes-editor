// O que mudou no Lattes desde a exportação carregada: compara os itens
// numerados da página de conferência (src/bridge/espelho.ts) com as produções
// e os eventos da exportação. Como o Exportar recusa enquanto há pendência
// (docs/lattes_internals.md, seção 10), a exportação é uma versão publicada,
// e a diferença é o que foi feito no Lattes depois dela.
//
// Compara títulos, não campos: um item cujo título aparece na linha da página
// conta como presente nos dois lados, mesmo que o ano ou um autor tenha mudado.

import type { EspelhoItem } from '../bridge/espelho.ts';
import { childElements, firstChild, getAttr, walk, type XElement } from '../model/xml.ts';
import { itemMeta } from '../ui/item-meta.ts';
import { normalizeTitle } from './consistency.ts';

/** Títulos mais curtos que isto casariam com qualquer linha; não são comparados. */
const MIN_TITLE = 4;

/** Sobrenome em maiúsculas seguido de vírgula: o começo de um autor. */
const SURNAME = /^[A-ZÀ-Ý][A-ZÀ-Ý'’\- ]*,/u;

/**
 * O trecho do título numa linha da página, depois dos autores: "TESTE, P.;
 * OUTRA, A.. Título, 2005. (...)" dá "Título, 2005. (...)". Formato observado
 * em 12/10/2026 (docs/lattes_internals.md, seção 10); a regra de onde os
 * autores acabam é inferida. Linha sem autores (eventos) devolve undefined.
 */
export function titlePart(text: string): string | undefined {
  const rest = lastAuthor(text);
  if (rest === undefined) return undefined;
  // O fim dos autores é certo no ponto duplo ("P.. ") ou no ponto depois de
  // um nome por extenso ("LÜDER, Rafael. "); um ponto depois de uma letra só
  // pode ser de uma inicial ou do próprio título, e aí não há trecho seguro.
  const double = /\.\.\s+/.exec(rest);
  if (double) return rest.slice(double.index + double[0].length);
  // Nome por extenso logo depois da vírgula do sobrenome, e só ali.
  const fullName = /^[^,]+,\s*(?:\p{Lu}\p{Ll}+\s*)+\.\s+/u.exec(rest);
  return fullName ? rest.slice(fullName[0].length) : undefined;
}

/** O trecho que começa no último autor da lista, ou undefined se a linha não abre com autor. */
function lastAuthor(text: string): string | undefined {
  if (!SURNAME.test(text)) return undefined;
  let rest = text;
  for (;;) {
    const i = rest.indexOf('; ');
    if (i < 0 || !SURNAME.test(rest.slice(i + 2))) break;
    rest = rest.slice(i + 2);
  }
  return rest;
}

/**
 * Linha com autores sem o fim reconhecido: o texto depois da primeira
 * inicial do último autor ("ANAIS, B.; TESTE, P. Título" → "Título"), para
 * que nenhum sobrenome da lista case com um título.
 */
function afterAuthors(text: string): string {
  const rest = lastAuthor(text) ?? text;
  const m = /,\s*(?:[A-ZÀ-Ý]\.\s*)+/u.exec(rest);
  return m ? rest.slice(m.index + m[0].length) : '';
}

/** Título longo o bastante para ser procurado em qualquer ponto da linha. */
const distinctive = (key: string) => key.length >= 8 || key.includes(' ');

export interface EspelhoDiff {
  /** Seções com itens na exportação cuja lista não foi lida ou veio vazia no Lattes: não comparadas. */
  notCompared?: string[];
  /**
   * De onde veio a comparação: as listas do Lattes, de todas as seções
   * (lists-diff.ts), ou a página de conferência, só produção e eventos.
   */
  scope?: 'listas' | 'pagina';
  /** Itens da exportação com título curto ou vazio demais para comparar. */
  skipped: number;
  /**
   * A página não pôde ser lida: nenhum item dela, ou nenhum título da
   * exportação encontrado nela. Mais provável o formato da página ter mudado
   * do que o currículo inteiro ter sido refeito; não há diferença a mostrar.
   */
  unreadable?: true;
  /** Itens da exportação cujo título não está na página: tirados ou renomeados no Lattes. */
  onlyInExport: { item: XElement; title: string }[];
  /** Itens da página sem título correspondente na exportação: incluídos no Lattes. */
  onlyInLattes: EspelhoItem[];
}

/**
 * As produções e eventos que a página mostra em "Produção" e "Eventos":
 * produção bibliográfica, técnica e participação em eventos.
 */
export function comparableItems(root: XElement): XElement[] {
  const items: XElement[] = [];
  const containers = [
    firstChild(root, 'PRODUCAO-BIBLIOGRAFICA'),
    firstChild(root, 'PRODUCAO-TECNICA'),
    firstChild(
      firstChild(root, 'DADOS-COMPLEMENTARES') ?? root,
      'PARTICIPACAO-EM-EVENTOS-CONGRESSOS',
    ),
  ].filter((el): el is XElement => el !== undefined);
  for (const c of containers) {
    walk(c, (el) => {
      if (getAttr(el, 'SEQUENCIA-PRODUCAO') !== undefined && childElements(el).length > 0) {
        items.push(el);
      }
    });
  }
  return items;
}

export function diffEspelho(lattes: EspelhoItem[], root: XElement): EspelhoDiff {
  const exported = comparableItems(root).map((item) => {
    const title = itemMeta(item).title;
    return { item, key: normalizeTitle(title), title };
  });
  const comparable = exported.filter((e) => e.key.length >= MIN_TITLE);
  // Títulos mais longos primeiro: "Design Gráfico" não pode tomar a linha de
  // "Design Gráfico Avançado" antes dele.
  const order = comparable
    .map((e, i) => ({ i, length: e.key.length }))
    .sort((a, b) => b.length - a.length)
    .map(({ i }) => i);
  const matched = new Set<number>();
  const onlyInLattes: EspelhoItem[] = [];
  for (const line of lattes) {
    // Com autores, o título tem de abrir o trecho depois deles: um título
    // curto ("Design", "Anais") não casa com um sobrenome nem com o veículo.
    // Sem autores (eventos), vale em qualquer ponto, só para títulos longos.
    // Linha com cara de autores (sobrenome em maiúsculas e vírgula) mas sem o
    // fim deles reconhecido: o título tem de estar depois da primeira
    // inicial do último autor, nunca no meio dos nomes. Cada linha é
    // normalizada uma vez.
    const part = titlePart(line.text);
    const authored = part === undefined && SURNAME.test(line.text);
    const hay =
      part !== undefined
        ? ` ${normalizeTitle(part)} `
        : ` ${normalizeTitle(authored ? afterAuthors(line.text) : line.text)} `;
    // Título curto só é exigido longo quando a linha tem autores: sem eles
    // (eventos), não há sobrenome com que colidir.
    const matches = (key: string) =>
      part !== undefined
        ? hay.startsWith(` ${key} `)
        : (!authored || distinctive(key)) && hay.includes(` ${key} `);
    // Cada linha casa com um item só, para duplicatas contarem certo.
    const hit = order.find((i) => !matched.has(i) && matches(comparable[i]!.key));
    if (hit !== undefined) matched.add(hit);
    else onlyInLattes.push(line);
  }
  const skipped = exported.length - comparable.length;
  if (comparable.length > 0 && matched.size === 0) {
    return { onlyInExport: [], onlyInLattes: [], scope: 'pagina', skipped, unreadable: true };
  }
  return {
    onlyInExport: comparable
      .filter((_, i) => !matched.has(i))
      .map(({ item, title }) => ({ item, title })),
    onlyInLattes,
    scope: 'pagina',
    skipped,
  };
}
