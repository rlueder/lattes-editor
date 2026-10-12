// "Alterações a levar ao Lattes" (guia, marco 2): tudo o que difere entre a
// exportação carregada e a cópia de trabalho e que o Importar não leva.
//
// O Importar só insere itens de produção novos. Mudanças em seções
// biográficas e em itens que já estão no Lattes precisam ser feitas à mão nos
// formulários. Esta lista é a entrada da futura ponte com o navegador (fase 3),
// então é dado antes de ser tela: cada mudança tem chave estável, caminho e
// valores antes e depois.

import { attributeLabel, elementLabel } from '../labels/labels.ts';
import { childElements, type XElement, type XText } from './xml.ts';

export type ChangeKind = 'alterado' | 'novo' | 'removido';

export interface FieldChange {
  after: string;
  /** Nome XML do atributo; "#texto" para conteúdo de texto. */
  attr: string;
  before: string;
  label: string;
}

export interface Change {
  /** Elemento XML que mudou. */
  element: string;
  fields: FieldChange[];
  /** Rótulo do formulário do Lattes onde a mudança é feita (o tipo do elemento). */
  form: string;
  /** Chave estável: o caminho com as chaves de identidade. */
  key: string;
  kind: ChangeKind;
  /** Caminho de elementos com as chaves de identidade, da raiz até o elemento. */
  path: string[];
}

/** Chaves que identificam um item entre exportações. SEQUENCIA-IMPORTANCIA é ordem, não identidade. */
function identity(el: XElement): string | undefined {
  const seq = el.attrs.find(
    (a) => a.name.startsWith('SEQUENCIA') && a.name !== 'SEQUENCIA-IMPORTANCIA' && a.value,
  );
  if (seq) return `${seq.name}=${seq.value}`;
  const natural: Record<string, string> = {
    IDIOMA: 'IDIOMA',
    'INFORMACAO-ADICIONAL-CURSO': 'CODIGO-CURSO',
    'INFORMACAO-ADICIONAL-INSTITUICAO': 'CODIGO-INSTITUICAO',
  };
  const attr = natural[el.name];
  const value = attr && el.attrs.find((a) => a.name === attr)?.value;
  if (value) return `${attr}=${value}`;
  const order = el.attrs.find((a) => a.name.startsWith('ORDEM') && a.value);
  if (order) return `${order.name}=${order.value}`;
  return undefined;
}

/** Filhos-elemento com uma chave cada: identidade ou posição entre irmãos de mesmo nome. */
function keyed(el: XElement): Map<string, XElement> {
  const map = new Map<string, XElement>();
  const counts = new Map<string, number>();
  for (const child of childElements(el)) {
    const n = counts.get(child.name) ?? 0;
    counts.set(child.name, n + 1);
    const key = `${child.name}[${identity(child) ?? `#${n}`}]`;
    map.set(map.has(key) ? `${key}~${n}` : key, child);
  }
  return map;
}

function text(el: XElement): string {
  return el.children
    .filter((c): c is XText => c.kind === 'text')
    .map((c) => c.value)
    .join('')
    .trim();
}

function fieldDiff(before: XElement | undefined, after: XElement | undefined): FieldChange[] {
  const names = new Set([...(before?.attrs ?? []), ...(after?.attrs ?? [])].map((a) => a.name));
  const fields: FieldChange[] = [];
  for (const name of names) {
    const b = before?.attrs.find((a) => a.name === name)?.value ?? '';
    const a = after?.attrs.find((x) => x.name === name)?.value ?? '';
    if (a !== b) fields.push({ after: a, attr: name, before: b, label: attributeLabel(name) });
  }
  const tb = before ? text(before) : '';
  const ta = after ? text(after) : '';
  if (ta !== tb) fields.push({ after: ta, attr: '#texto', before: tb, label: 'Texto' });
  return fields;
}

/** Elemento sem nenhum valor (atributos vazios, sem texto, sem filhos com valor). */
export function isBlank(el: XElement): boolean {
  return el.attrs.every((a) => !a.value.trim()) && !text(el) && childElements(el).every(isBlank);
}

export interface DiffOptions {
  /** Itens que o Importar leva (produção nova): ficam fora desta lista. */
  skip?: (el: XElement) => boolean;
}

export function diffDocuments(
  original: XElement,
  working: XElement,
  opts: DiffOptions = {},
): Change[] {
  const changes: Change[] = [];

  const visit = (b: XElement | undefined, a: XElement | undefined, path: string[]) => {
    const el = (a ?? b)!;
    if (a && opts.skip?.(a)) return;
    const kind: ChangeKind = !b ? 'novo' : !a ? 'removido' : 'alterado';
    if (kind !== 'alterado' && isBlank(el)) return;

    const fields = fieldDiff(b, a).filter((f) => kind === 'alterado' || f.after || f.before);
    if (fields.length > 0 || kind !== 'alterado') {
      changes.push({
        element: el.name,
        fields,
        form: elementLabel(el.name),
        key: path.join('/'),
        kind,
        path,
      });
    }
    // Item novo ou removido entra inteiro; não repete os filhos um por um.
    if (kind !== 'alterado') return;
    const kb = keyed(b!);
    const ka = keyed(a!);
    for (const key of new Set([...kb.keys(), ...ka.keys()])) {
      visit(kb.get(key), ka.get(key), [...path, key]);
    }
  };

  visit(original, working, [original.name]);
  return changes;
}

/** Cadeia de elementos (da raiz ao alvo) que um caminho de mudança aponta, ou o quanto existir. */
export function resolvePath(root: XElement, path: string[]): XElement[] {
  const chain: XElement[] = [];
  if (path[0] !== root.name) return chain;
  chain.push(root);
  let current = root;
  for (const key of path.slice(1)) {
    const next = keyed(current).get(key);
    if (!next) break;
    chain.push(next);
    current = next;
  }
  return chain;
}

/**
 * Descarta uma mudança na cópia de trabalho, voltando ao que a exportação
 * tinha: atributos e texto restaurados, elemento novo removido, elemento
 * removido devolvido ao pai na ordem do schema. Devolve false se o caminho
 * não existe mais (a cópia mudou depois do cálculo da lista).
 */
export function revertChange(
  original: XElement,
  working: XElement,
  change: Change,
  insert: (parent: XElement, child: XElement) => void,
): boolean {
  const workChain = resolvePath(working, change.path);
  const origChain = resolvePath(original, change.path);
  const complete = (chain: XElement[]) => chain.length === change.path.length;

  if (change.kind === 'alterado') {
    if (!complete(workChain) || !complete(origChain)) return false;
    const el = workChain.at(-1)!;
    const before = origChain.at(-1)!;
    el.attrs = structuredClone(before.attrs);
    // Texto (DISCIPLINA, INTEGRANTES-DO-PROJETO): troca os nós de texto, mantém os filhos.
    el.children = [
      ...before.children.filter((c) => c.kind === 'text').map((c) => structuredClone(c)),
      ...el.children.filter((c) => c.kind !== 'text'),
    ];
    return true;
  }
  if (change.kind === 'novo') {
    if (!complete(workChain) || workChain.length < 2) return false;
    const el = workChain.at(-1)!;
    const parent = workChain.at(-2)!;
    parent.children = parent.children.filter((c) => c !== el);
    return true;
  }
  // removido: o pai precisa existir na cópia de trabalho.
  const parentChain = resolvePath(working, change.path.slice(0, -1));
  if (parentChain.length !== change.path.length - 1 || !complete(origChain)) return false;
  insert(parentChain.at(-1)!, structuredClone(origChain.at(-1)!));
  return true;
}

/** Descarta um campo de uma mudança "alterado": volta ao valor (ou ausência) da exportação. */
export function revertField(
  original: XElement,
  working: XElement,
  change: Change,
  attr: string,
): boolean {
  if (change.kind !== 'alterado') return false;
  const el = resolvePath(working, change.path).at(-1);
  const before = resolvePath(original, change.path).at(-1);
  if (!el || !before || el.name !== change.element || before.name !== change.element) return false;
  if (attr === '#texto') {
    el.children = [
      ...before.children.filter((c) => c.kind === 'text').map((c) => structuredClone(c)),
      ...el.children.filter((c) => c.kind !== 'text'),
    ];
    return true;
  }
  const orig = before.attrs.find((a) => a.name === attr);
  const i = el.attrs.findIndex((a) => a.name === attr);
  if (orig && i >= 0) el.attrs[i] = { ...orig };
  else if (orig) el.attrs.push({ ...orig });
  else if (i >= 0) el.attrs.splice(i, 1);
  return true;
}

/**
 * Leva os valores novos de uma mudança "alterado" para o original: depois que
 * a ponte grava e confere no Lattes, o Lattes é o novo "antes", e a mudança
 * sai da lista. É `revertField` no sentido contrário.
 */
export function acceptChange(original: XElement, working: XElement, change: Change): boolean {
  if (change.kind !== 'alterado') return false;
  return change.fields.every((f) => revertField(working, original, change, f.attr));
}
