// Como uma lista de itens se agrupa e o que cada cartão mostra. A linha do
// tempo por ano é a visão padrão; tabelas de apoio têm visões próprias
// (reference-tables.ts).

import type { XElement } from '../model/xml.ts';
import { formatDuration, formatPeriod, groupByYear, itemMeta } from './item-meta.ts';

export interface Usage {
  kind: string;
  period: string;
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
