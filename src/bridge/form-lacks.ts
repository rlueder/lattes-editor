// O campo de um item que já está no Lattes e que o formulário do Lattes não
// tem (o idioma de um evento, o nome de um prêmio em inglês). Alterar um
// desses não chega ao Lattes por caminho nenhum, então o editor o mostra sem
// edição, com o motivo. A resposta vem do próprio plano do conector, com uma
// troca de teste no campo: a mesma regra que deixaria a alteração à mão.

import { attributeLabel, elementLabel } from '../labels/labels.ts';
import { type Change, pathTo, resolvePath } from '../model/changes.ts';
import { element, getAttr, type XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { ALL_ON, isOp, planChange } from './plan.ts';

/**
 * O motivo é a falta do campo no formulário, e não um valor que o Lattes
 * não aceita ("Valor que o formulário…", "País que o formulário…") nem
 * trabalho que falta no conector.
 */
export function fieldAbsent(reason: string): boolean {
  // O motivo de target.manual vem com o rótulo na frente ("Ano: O formulário…").
  const tail = /^[^:]{1,60}: (O formulário.*)$/.exec(reason)?.[1];
  return [reason, ...(tail ? [tail] : [])].some(
    (r) =>
      /^O formulário[^:]*? não tem(:| o | campo| palavras)/.test(r) ||
      /^A tela d[ae] [^:]* não tem:/.test(r) ||
      /^A grade d[ae] [^:]* do Lattes não tem:/.test(r) ||
      /^Dados que o próprio Lattes gera/.test(r),
  );
}

/** Outro valor do mesmo tipo, só para perguntar ao plano. */
function probe(element: string, attr: string, value: string): string {
  const choices = lattesSchema.elements[element]?.attributes.find((a) => a.name === attr)?.enum;
  if (choices?.length) return choices.find((c) => c !== value) ?? value;
  if (value === 'SIM') return 'NAO';
  if (value === 'NAO') return 'SIM';
  return `${value}x`;
}

/**
 * Por que o campo não se altera, num elemento que já estava na exportação;
 * undefined quando se altera, ou quando o elemento é novo (vai pelo
 * Importar, que leva o XML inteiro).
 */
export function formLacks(
  original: XElement,
  working: XElement,
  el: XElement,
  attr: string,
): string | undefined {
  const path = pathTo(working, el);
  if (!path || resolvePath(original, path).length !== path.length) return undefined;
  const value = getAttr(el, attr) ?? '';
  const change: Change = {
    element: el.name,
    fields: [
      { after: probe(el.name, attr, value), attr, before: value, label: attributeLabel(attr) },
    ],
    form: elementLabel(el.name),
    key: path.join('/'),
    kind: 'alterado',
    path,
  };
  const planned = planChange(change, resolvePath(working, path), '', ALL_ON, [change]);
  if (isOp(planned) || !fieldAbsent(planned.reason)) return undefined;
  return planned.reason;
}

/**
 * Por que uma parte nova (as palavras-chave) não entra num item que já está
 * no Lattes; undefined quando entra, ou quando o item é novo.
 */
export function childLacks(
  original: XElement,
  working: XElement,
  item: XElement,
  child: string,
): string | undefined {
  const path = pathTo(working, item);
  if (!path || resolvePath(original, path).length !== path.length) return undefined;
  const attr = lattesSchema.elements[child]?.attributes[0]?.name ?? '';
  const change: Change = {
    element: child,
    fields: [{ after: 'x', attr, before: '', label: attributeLabel(attr) }],
    form: elementLabel(child),
    key: [...path, `${child}[#0]`].join('/'),
    kind: 'novo',
    path: [...path, `${child}[#0]`],
  };
  const chain = [...resolvePath(working, path), element(child, { [attr]: 'x' })];
  const planned = planChange(change, chain, '', ALL_ON, [change]);
  if (isOp(planned) || !fieldAbsent(planned.reason)) return undefined;
  return planned.reason;
}
