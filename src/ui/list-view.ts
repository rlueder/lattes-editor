// Como uma lista de itens se agrupa e o que cada cartão mostra. A linha do
// tempo por ano é a visão padrão; tabelas de apoio têm visões próprias
// (reference-tables.ts).

import type { XElement } from '../model/xml.ts';
import { formatDuration, formatPeriod, groupByYear, itemMeta } from './item-meta.ts';

export interface Usage {
  /** Rótulo do contêiner do item (Orientações concluídas), que agrupa os usos. */
  group: string;
  /** Tipo do item (Orientações concluídas para mestrado). */
  kind: string;
  period: string;
  /** Chave de ordenação decrescente do período (ItemMeta.sortKey). */
  sortKey: number;
  title: string;
}

export interface CardInfo {
  /** Texto à direita (período, contagem de usos). */
  aside?: string;
  /** Destaca o texto à direita (período atual). */
  asideStrong?: boolean;
  /** Segunda linha à direita (duração). */
  asideSub?: string;
  subtitle: string;
  title: string;
  /** Itens que referenciam este, mostrados ao abrir o cartão. */
  usages?: Usage[];
}

export interface ItemGroup {
  items: XElement[];
  key: string;
  label: string;
}

export interface ListView {
  card: (el: XElement) => CardInfo;
  groups: (items: XElement[]) => ItemGroup[];
  /** Chave do grupo que reúne o que não tem a informação usada para agrupar. */
  ungroupedKey: string;
}

export const yearView: ListView = {
  card: (el) => {
    const meta = itemMeta(el);
    return {
      aside: formatPeriod(meta) || undefined,
      asideStrong: meta.current,
      asideSub: formatDuration(meta) || undefined,
      subtitle: meta.subtitle,
      title: meta.title,
    };
  },
  groups: (items) =>
    groupByYear(items).map((g) => ({
      items: g.items.map((i) => i.el),
      key: g.key,
      label: g.label,
    })),
  ungroupedKey: 'sem-ano',
};

const elementKeys = new WeakMap<XElement, number>();
let nextElementKey = 0;

/**
 * Chave do cartão que acompanha o elemento, e não a posição na lista. Mudar o
 * ano de um item o leva a outro grupo; com a posição como chave, o cartão
 * seguinte herdaria o rascunho do campo editado e, ao sair dele, gravaria o
 * valor no item errado.
 */
export function elementKey(el: XElement): number {
  let key = elementKeys.get(el);
  if (key === undefined) {
    key = nextElementKey++;
    elementKeys.set(el, key);
  }
  return key;
}
