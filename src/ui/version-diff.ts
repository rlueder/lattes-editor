// O que mudou entre duas exportações do Lattes (linha do tempo de versões,
// LAT-12), com a mesma comparação da lista de alterações do editor: itens
// novos, removidos e alterados, por seção, cada um com o caminho até o grupo
// onde ele aparece no editor.

import { type Change, diffDocuments, resolvePath } from '../model/changes.ts';
import { getAttr, parseXml, type XElement } from '../model/xml.ts';
import { groupChanges } from './changes-view.ts';
import type { HashRoute } from './hash-route.ts';
import type { Section } from './sections.ts';

export interface VersionChange {
  change: Change;
  itemTitle: string;
  /** Grupo do editor onde o item aparece (ou aparecia, se foi removido). */
  route?: HashRoute;
}

export interface VersionDiffGroup {
  changes: VersionChange[];
  label: string;
}

export interface VersionDiff {
  added: number;
  /** Itens alterados, contados uma vez cada, mesmo com vários campos mudados. */
  changed: number;
  groups: VersionDiffGroup[];
  removed: number;
}

/**
 * O item do editor que contém algum elemento do caminho, do mais fundo ao
 * mais raso, e a rota até o grupo dele.
 */
function itemOf(
  chain: XElement[],
  sections: Section[],
): { item: XElement; route: HashRoute } | undefined {
  for (let i = chain.length - 1; i >= 0; i--) {
    const el = chain[i]!;
    for (const section of sections) {
      if (section.importable === 'filtro') continue;
      const group = section.groups.find((g) => g.elements.includes(el));
      // O grupo pode ser o contêiner (ARTIGOS-PUBLICADOS): o item é o filho
      // dele no caminho.
      if (group) {
        return { item: chain[i + 1] ?? el, route: { anchor: group.id, sectionId: section.id } };
      }
    }
  }
  return undefined;
}

/**
 * Compara a versão anterior com a seguinte. `sections` são as seções da
 * versão seguinte (buildSections dela): o caminho de um item removido
 * resolve até o contêiner que ainda existe.
 */
export function diffVersions(older: XElement, newer: XElement, sections: Section[]): VersionDiff {
  const changes = diffDocuments(older, newer);
  // O item de cada mudança, para contar um item alterado uma vez só, mesmo
  // com vários campos mudados ou com título igual ao de outro item.
  const itemByChange = new Map<Change, XElement | undefined>();
  const groups = groupChanges(changes, older, newer, sections).map((g) => ({
    changes: g.entries.map(({ change, itemTitle }) => {
      const found = itemOf(resolvePath(newer, change.path), sections);
      itemByChange.set(change, found?.item);
      return { change, itemTitle, route: found?.route };
    }),
    label: g.label,
  }));
  const all = groups.flatMap((g) => g.changes);
  const changedItems = new Set<XElement | string>(
    all
      .filter((c) => c.change.kind === 'alterado')
      .map((c) => itemByChange.get(c.change) ?? c.change.key),
  );
  return {
    added: all.filter((c) => c.change.kind === 'novo').length,
    changed: changedItems.size,
    groups,
    removed: all.filter((c) => c.change.kind === 'removido').length,
  };
}

/** DATA-ATUALIZACAO (DDMMAAAA) de um XML de exportação. */
export function exportDateOf(xml: string | undefined): string | undefined {
  return xml ? getAttr(parseXml(xml).root, 'DATA-ATUALIZACAO') : undefined;
}

/** DATA-ATUALIZACAO e HORA-ATUALIZACAO da exportação, juntas ("15032024 101500"). */
export function exportStamp(root: XElement): string | undefined {
  const date = getAttr(root, 'DATA-ATUALIZACAO');
  if (!date) return undefined;
  const time = getAttr(root, 'HORA-ATUALIZACAO');
  return time ? `${date} ${time}` : date;
}

/** "15/03/2024" de um carimbo de exportação; sem ele, a data em que foi aberta. */
export function versionDate(version: { exportedAt?: string; loadedAt: number }): string {
  const m = /^(\d{2})(\d{2})(\d{4})/.exec(version.exportedAt ?? '');
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;
  return new Date(version.loadedAt).toLocaleDateString('pt-BR');
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Desde a versão de 15/03/2024: 3 itens novos, 1 alterado, nenhum removido." */
export function diffSummary(diff: VersionDiff, since: string): string {
  if (diff.added + diff.changed + diff.removed === 0) {
    return `Nada mudou desde a versão de ${since}.`;
  }
  const parts = [
    plural(diff.added, 'item novo', 'itens novos'),
    plural(diff.changed, 'alterado', 'alterados'),
    plural(diff.removed, 'removido', 'removidos'),
  ];
  return `Desde a versão de ${since}: ${parts.join(', ')}.`;
}
