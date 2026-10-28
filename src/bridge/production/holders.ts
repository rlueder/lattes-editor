// Os depositantes ou titulares pessoas de patentes e registros
// (ProductionTarget.holders), na grade f_depositante_pessoa_l. Observado na
// exportação e na edição da mesma patente de teste em 20/10/2026: o
// NOME-DO-DEPOSITANTE do REGISTRO-OU-PATENTE é a pessoa do
// titularPessoaProvider da página, e a exportação copia essa pessoa também nos
// AUTORES, que o autorProvider da página não tem. A troca vai com um nome só:
// a patente de teste tinha um depositante, e como a exportação junta mais de
// um não foi visto.

import type { Change } from '../../model/changes.ts';
import { resolvePath } from '../../model/changes.ts';
import { foldText } from '../../model/fold-text.ts';
import { childElements, getAttr, type XElement } from '../../model/xml.ts';
import { menuAuthors } from '../author-grid.ts';
import { authorNames, type GridRow, holderRows, sameWords } from './grids.ts';
import type { ProductionTarget } from './types.ts';

export const SEVERAL_HOLDERS =
  'Mais de um depositante vai à mão: como a exportação junta mais de um depositante não foi visto; troque no Lattes';

const key = (v: string | undefined) => foldText((v ?? '').trim());

/**
 * Quantas cópias de cada depositante a exportação pôs nos autores: uma por
 * depositante com aquele nome, como o item estava na exportação (o valor de
 * antes, quando uma mudança da fila troca o depositante). O depositante novo
 * de uma mudança ainda não exportada não tem cópia.
 */
function exportedHolders(
  target: ProductionTarget,
  item: XElement,
  root: XElement | undefined,
  siblings: readonly Change[],
): Map<string, number> {
  const spec = target.holders;
  const counts = new Map<string, number>();
  if (!spec) return counts;
  const find = (el: XElement): XElement[] =>
    childElements(el).flatMap((c) => (c.name === spec.child ? [c] : find(c)));
  for (const part of find(item)) {
    const pending = siblings.find(
      (c) => c.element === spec.child && !!root && resolvePath(root, c.path).at(-1) === part,
    );
    const field = pending?.fields.find((f) => f.attr === spec.attr);
    const name = key(field ? field.before : getAttr(part, spec.attr));
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

/**
 * Os autores antes e depois sem as cópias dos depositantes, para a mudança de
 * autores conferir com a grade da página, que não as tem; o motivo, quando
 * não dá para separar. A cópia se reconhece só pelo nome: com tantos autores
 * daquele nome quanto depositantes, todos são cópias; com mais, um deles é
 * um autor de verdade (quem inventou e também deposita), e o conector não
 * adivinha qual. Mexer numa linha com o nome de um depositante também fica à
 * mão, pela mesma razão.
 */
export function withoutHolderCopies(
  target: ProductionTarget,
  item: XElement,
  root: XElement | undefined,
  siblings: readonly Change[],
  change: Change,
  nameAttr: string,
  lists: { after: XElement[]; before: XElement[] },
): { after: XElement[]; before: XElement[] } | { reason: string } {
  const counts = exportedHolders(target, item, root, siblings);
  if (counts.size === 0) return lists;
  const nameOf = (a: XElement) => key(getAttr(a, nameAttr));
  for (const list of [lists.before, lists.after]) {
    for (const [name, holders] of counts) {
      if (list.filter((a) => nameOf(a) === name).length > holders) {
        return {
          reason:
            'O item tem mais autores com o nome do depositante do que depositantes: a exportação do Lattes copia o depositante nos autores, e não dá para saber qual linha é a cópia; troque os autores no Lattes',
        };
      }
    }
  }
  const el = root && change.kind !== 'removido' ? resolvePath(root, change.path).at(-1) : undefined;
  const touched = [
    ...(el ? [getAttr(el, nameAttr)] : []),
    ...change.fields.filter((f) => f.attr === nameAttr).map((f) => f.before),
  ];
  if (touched.some((n) => counts.has(key(n)))) {
    return {
      reason:
        'Esta linha de autor tem o nome do depositante, que a exportação do Lattes copia nos autores, e não dá para saber se é a cópia; troque o depositante, ou os autores no Lattes',
    };
  }
  const keep = (list: XElement[]) => list.filter((a) => !counts.has(nameOf(a)));
  return { after: keep(lists.after), before: keep(lists.before) };
}

/** A troca do depositante: um nome só (ou nenhum) antes e depois, ou o motivo. */
export function planHolder(f: {
  after: string;
  before: string;
}): { after: string; before: string } | { reason: string } {
  const value = { after: f.after.trim(), before: f.before.trim() };
  // Só o ";" separa pessoas, como nas outras listas de nomes do currículo: a
  // vírgula pode ser de um nome só ("SOBRENOME, Nome"). Como a exportação junta
  // mais de um depositante não foi visto; a grade da página com mais de uma
  // linha também fica à mão (apply.ts).
  if (value.after.includes(';') || value.before.includes(';')) return { reason: SEVERAL_HOLDERS };
  return value;
}

/** A grade de depositantes da página tem esse nome só (ou ninguém, com o nome vazio)? */
export const sameHolder = (rows: readonly GridRow[], name: string): boolean =>
  sameWords(authorNames(rows), name.trim() ? [name] : []);

/** As linhas da grade com o depositante novo, do titularPessoaDP do menu; o motivo, sem ele lá. */
export function holderReplace(
  rows: readonly GridRow[],
  menu: string,
  after: string,
): { reason: string } | { rows: GridRow[] } {
  const built = holderRows(rows, menuAuthors(menu, 'titularPessoaDP') ?? [], after);
  if ('rows' in built) return built;
  return {
    reason: `Depositante que não está na lista de coautores do Lattes: ${built.missing}. Escolha-o no Lattes uma vez; depois o editor consegue mandar`,
  };
}

/**
 * A mudança no depositante (target.holders), com a grade e o campo da
 * operação; undefined quando o atributo não é ele. Pessoa ou instituição, a
 * exportação põe as duas em NOME-DO-DEPOSITANTE (institution-holder.ts).
 */
export function holderField(
  target: ProductionTarget,
  key: string,
  f: { after: string; before: string },
):
  | { grid: 'f_depositante_pessoa_l'; op: 'holders'; value: { after: string; before: string } }
  | { reason: string }
  | undefined {
  const spec = target.holders;
  if (!spec || key !== `${spec.child}@${spec.attr}`) return undefined;
  const value = planHolder(f);
  if ('reason' in value) return value;
  return { grid: 'f_depositante_pessoa_l', op: 'holders', value };
}
