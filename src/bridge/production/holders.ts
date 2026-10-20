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
import type { ProductionTarget } from './types.ts';

export const SEVERAL_HOLDERS =
  'Mais de um depositante vai à mão: como a exportação junta mais de um depositante não foi visto; troque no Lattes';

const key = (v: string | undefined) => foldText((v ?? '').trim());

/**
 * Os nomes dos depositantes pessoas do item: o de agora e, das mudanças da
 * fila no mesmo item, o de antes e o de depois (o autor copiado do depositante
 * de antes segue no XML enquanto a troca não foi exportada de novo).
 */
function holderNames(
  target: ProductionTarget,
  item: XElement,
  root: XElement | undefined,
  siblings: readonly Change[],
): Set<string> {
  const spec = target.holders;
  const names = new Set<string>();
  if (!spec) return names;
  const add = (v: string | undefined) => {
    if (key(v)) names.add(key(v));
  };
  const find = (el: XElement): XElement[] =>
    childElements(el).flatMap((c) => (c.name === spec.child ? [c] : find(c)));
  for (const part of find(item)) add(getAttr(part, spec.attr));
  for (const c of siblings) {
    if (c.element !== spec.child || !root || !resolvePath(root, c.path).includes(item)) continue;
    for (const f of c.fields.filter((x) => x.attr === spec.attr)) {
      add(f.before);
      add(f.after);
    }
  }
  return names;
}

/**
 * Os autores do XML que são cópias de um depositante, para a mudança de
 * autores deixar de fora (antes e depois); o motivo, quando a mudança é numa
 * dessas linhas.
 */
export function holderCopies(
  target: ProductionTarget,
  item: XElement,
  root: XElement | undefined,
  siblings: readonly Change[],
  change: Change,
  nameAttr: string,
): { isCopy: (author: XElement) => boolean } | { reason: string } {
  const names = holderNames(target, item, root, siblings);
  const el = root && change.kind !== 'removido' ? resolvePath(root, change.path).at(-1) : undefined;
  const touched = [
    ...(el ? [getAttr(el, nameAttr)] : []),
    ...change.fields.filter((f) => f.attr === nameAttr).map((f) => f.before),
  ];
  if (touched.some((n) => names.has(key(n)))) {
    return {
      reason:
        'Esta linha de autor é o depositante, que a exportação do Lattes copia nos autores; troque o depositante, e não esta linha',
    };
  }
  return { isCopy: (a) => names.has(key(getAttr(a, nameAttr))) };
}

/** A troca do depositante: um nome só (ou nenhum) antes e depois, ou o motivo. */
export function planHolder(f: {
  after: string;
  before: string;
}): { after: string; before: string } | { reason: string } {
  const value = { after: f.after.trim(), before: f.before.trim() };
  // Nomes completos não têm vírgula nem ponto e vírgula: com eles, é mais de um.
  if (/[;,]/.test(value.after) || /[;,]/.test(value.before)) return { reason: SEVERAL_HOLDERS };
  return value;
}
