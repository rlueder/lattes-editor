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
 * Fim da lista de autores: ponto seguido de espaço que não seja de uma
 * inicial ("J. "), ou ponto duplo ("P.. ", a inicial do último autor).
 */
const AUTHOR_END = /(?:\.\.|(?<![\s,][A-ZÀ-Ý])\.)\s+/u;

/**
 * O trecho do título numa linha da página, depois dos autores: "TESTE, P.;
 * OUTRA, A.. Título, 2005. (...)" dá "Título, 2005. (...)". Formato observado
 * em 12/10/2026 (docs/lattes_internals.md, seção 10); a regra de onde os
 * autores acabam é inferida. Linha sem autores (eventos) devolve undefined.
 */
export function titlePart(text: string): string | undefined {
  if (!SURNAME.test(text)) return undefined;
  let rest = text;
  for (;;) {
    const i = rest.indexOf('; ');
    if (i < 0 || !SURNAME.test(rest.slice(i + 2))) break;
    rest = rest.slice(i + 2);
  }
  const end = AUTHOR_END.exec(rest);
  return end ? rest.slice(end.index + end[0].length) : undefined;
}

/** O texto depois da primeira inicial de nome ("TESTE, P. Título" → "Título"). */
function afterFirstInitial(text: string): string {
  const m = /\b[A-ZÀ-Ý]\.\s/.exec(text);
  return m ? text.slice(m.index + m[0].length) : '';
}

/** Título longo o bastante para ser procurado em qualquer ponto da linha. */
const distinctive = (key: string) => key.length >= 8 || key.includes(' ');

export interface EspelhoDiff {
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
    // inicial, nunca no meio dos nomes. Cada linha é normalizada uma vez.
    const part = titlePart(line.text);
    const authored = part === undefined && SURNAME.test(line.text);
    const hay =
      part !== undefined
        ? ` ${normalizeTitle(part)} `
        : ` ${normalizeTitle(authored ? afterFirstInitial(line.text) : line.text)} `;
    const matches = (key: string) =>
      part !== undefined
        ? hay.startsWith(` ${key} `)
        : distinctive(key) && hay.includes(` ${key} `);
    // Cada linha casa com um item só, para duplicatas contarem certo.
    const hit = order.find((i) => !matched.has(i) && matches(comparable[i]!.key));
    if (hit !== undefined) matched.add(hit);
    else onlyInLattes.push(line);
  }
  const skipped = exported.length - comparable.length;
  if (comparable.length > 0 && matched.size === 0) {
    return { onlyInExport: [], onlyInLattes: [], skipped, unreadable: true };
  }
  return {
    onlyInExport: comparable
      .filter((_, i) => !matched.has(i))
      .map(({ item, title }) => ({ item, title })),
    onlyInLattes,
    skipped,
  };
}
