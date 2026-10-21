// A base e o registro dos itens de teste (docs/development/PLAN.md, Fase 0).
// A limpeza de 18/10/2026 confiou na marca "TESTE EDITOR APAGAR" e deixou 23
// itens no currículo: formações sem campo de texto para a marca, e uma lista
// que o menu abre por um formato de link que a varredura não pegava. Aqui o
// que conta é a diferença entre as listas antes e depois: o que apareceu foi
// o teste, o que sumiu da base é um problema.

/** Uma linha de uma lista do Lattes: o texto como a pessoa vê e o link da edição. */
export interface ListRow {
  link: string;
  text: string;
}

/** As linhas de cada lista, pela chave da lista (o caminho sem o código do currículo). */
export type ListSnapshot = Record<string, ListRow[]>;

/** Uma linha com a lista de onde veio. */
export interface PlacedRow extends ListRow {
  list: string;
}

const decode = (html: string) =>
  html
    .replace(/&quot;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');

/** O caminho de uma lista sem o f_cod e com os parâmetros em ordem: a mesma lista dá a mesma chave. */
export function listKey(url: string): string {
  const [path = '', query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  params.delete('f_cod');
  const rest = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${path.toLowerCase()}?${rest}`;
}

/**
 * Todos os endereços de lista do menu, em qualquer formato de link (setarUrl
 * entre aspas simples, ou dentro de &quot; num atributo). Endereço com f_ctr
 * é ação, não lista, e fica de fora.
 */
export function listUrls(menuHtml: string): string[] {
  const html = decode(menuHtml);
  const found = [...html.matchAll(/((?:pkg|prc)_\w*\.?\w*lista\w*(?:\?[^'"\s<>)]*)?)/gi)]
    .map((m) => m[1]!)
    .filter((u) => !/[?&]f_ctr=/i.test(u));
  return [...new Map(found.map((u) => [listKey(u), u])).values()];
}

/** As listas dentro de uma lista: a página de uma atuação e o grupo de um periódico do revisor. */
export function nestedUrls(listHtml: string): string[] {
  const html = decode(listHtml);
  return [
    ...new Set(
      [
        ...html.matchAll(
          /(?:setarUrl|abreUrlModal)\('([^']*(?:cargos_vinculos|lista_periodico)[^']*)'/gi,
        ),
      ].map((m) => m[1]!),
    ),
  ].filter((u) => !/[?&]f_ctr=/i.test(u));
}

const rowText = (html: string) =>
  decode(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // O número da linha muda quando outra linha entra ou sai.
    .replace(/^\d+\s+/, '');

/** As linhas clicáveis de uma lista, com o link da edição de cada uma. */
export function rowsOf(listHtml: string): ListRow[] {
  return [...listHtml.matchAll(/<tr[^>]*onclick="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => {
    const link = /(?:setarUrl|abreUrlModal)\('([^']+)'/.exec(decode(m[1]!))?.[1] ?? '';
    return { link, text: rowText(m[2]!) };
  });
}

/**
 * O que apareceu e o que sumiu em relação à base, linha a linha, contando
 * repetidas (duas formações iguais são duas linhas). Compara pelo texto: o
 * link de uma linha antiga pode mudar de posição, o texto não.
 */
export function diffSnapshots(
  base: ListSnapshot,
  now: ListSnapshot,
): { added: PlacedRow[]; missing: PlacedRow[] } {
  const added: PlacedRow[] = [];
  const missing: PlacedRow[] = [];
  for (const list of new Set([...Object.keys(base), ...Object.keys(now)])) {
    const before = [...(base[list] ?? [])];
    for (const row of now[list] ?? []) {
      const i = before.findIndex((b) => b.text === row.text);
      if (i >= 0) before.splice(i, 1);
      else added.push({ ...row, list });
    }
    missing.push(...before.map((row) => ({ ...row, list })));
  }
  return { added, missing };
}

/**
 * A ordem da remoção: o que está dentro de uma atuação antes da atuação, para
 * a exclusão da atuação (que leva tudo de dentro) vir por último.
 */
export function removalOrder(rows: PlacedRow[]): PlacedRow[] {
  const nested = (r: PlacedRow) => /cargos_vinculos|lista_periodico/.test(r.list);
  return [...rows.filter(nested), ...rows.filter((r) => !nested(r))];
}

/**
 * O lote da remoção: até `batch` candidatas cuja página tem a marca (ou todas,
 * com unmarked), e as sem marca, para a pessoa conferir. A linha diferente da
 * base pode ser item seu incluído ou alterado depois dela; a marca na página
 * é o que diz que é de teste (21/10/2026).
 */
export async function markedBatch(
  candidates: readonly PlacedRow[],
  pageHtml: (link: string) => Promise<string>,
  { batch, mark, unmarked }: { batch: number; mark: string; unmarked: boolean },
): Promise<{ noMark: PlacedRow[]; plan: PlacedRow[] }> {
  const plan: PlacedRow[] = [];
  const noMark: PlacedRow[] = [];
  for (const row of candidates) {
    if (plan.length >= batch) break;
    const marked = (await pageHtml(row.link)).includes(mark);
    if (marked || unmarked) plan.push(row);
    if (!marked) noMark.push(row);
  }
  return { noMark, plan };
}
