// Agrupa as mudanças por seção do Lattes e dá a cada uma o item a que
// pertence, para a lista "Alterações a levar ao Lattes".

import { type Change, changeSignature, resolvePath } from '../model/changes.ts';
import type { XElement } from '../model/xml.ts';
import { itemMeta } from './item-meta.ts';
import type { Section } from './sections.ts';

export interface ChangeEntry {
  change: Change;
  done: boolean;
  /** Título do item que contém a mudança (a atuação, a formação…). */
  itemTitle: string;
  signature: string;
}

export interface ChangeGroup {
  entries: ChangeEntry[];
  /** A seção é lida pelo Importar, mas o Importar não atualiza itens existentes. */
  importable: boolean;
  label: string;
}

const PART = /^(DADOS-BASICOS|DETALHAMENTO|VINCULOS)/;

function sectionOf(chain: XElement[], sections: Section[]): Section | undefined {
  for (let i = chain.length - 1; i >= 0; i--) {
    const el = chain[i]!;
    // A "Identificação" de Dados gerais é uma cópia rasa de DADOS-GERAIS que
    // compartilha a lista de atributos; por isso a segunda comparação.
    const found = sections.find(
      (s) =>
        s.importable !== 'filtro' &&
        s.groups.some(
          (g) =>
            g.elements.includes(el) ||
            g.elements.some((e) => e.name === el.name && e.attrs === el.attrs),
        ),
    );
    if (found) return found;
  }
  return undefined;
}

function itemTitle(chain: XElement[]): string {
  for (let i = chain.length - 1; i >= 1; i--) {
    const el = chain[i]!;
    // DADOS-GERAIS é a seção, não um item; o nome completo não serve de título aqui.
    if (PART.test(el.name) || el.name === 'DADOS-GERAIS') continue;
    const title = itemMeta(el).title;
    if (title) return title;
  }
  return '';
}

export function groupChanges(
  changes: Change[],
  original: XElement,
  working: XElement,
  sections: Section[],
  done: Record<string, string>,
): ChangeGroup[] {
  const groups = new Map<string, ChangeGroup>();
  for (const change of changes) {
    // A seção vem da cópia de trabalho (as seções são montadas dela), até onde o
    // caminho existir; o título de um item removido vem da exportação original.
    const section = sectionOf(resolvePath(working, change.path), sections);
    const chain = resolvePath(change.kind === 'removido' ? original : working, change.path);
    const label = section?.label ?? 'Outros dados';
    if (!groups.has(label)) {
      groups.set(label, { entries: [], importable: section?.importable === true, label });
    }
    const signature = changeSignature(change);
    groups.get(label)!.entries.push({
      change,
      done: done[change.key] === signature,
      itemTitle: itemTitle(chain),
      signature,
    });
  }
  // Ordem do menu do Lattes, como na barra lateral.
  const order = sections.map((s) => s.label);
  return [...groups.values()].sort((a, b) => {
    const ia = order.indexOf(a.label);
    const ib = order.indexOf(b.label);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

export function openCount(groups: ChangeGroup[]): number {
  return groups.reduce((n, g) => n + g.entries.filter((e) => !e.done).length, 0);
}
