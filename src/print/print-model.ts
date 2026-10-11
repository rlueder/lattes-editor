// O que a impressão mostra: seções e grupos do menu lateral que fazem sentido
// num currículo impresso, os modelos (resumido, ampliado, completo) e a forma
// de cada grupo (texto, referências, lista curta em colunas, lista com período).
//
// Ficam de fora: a identificação (vira o cabeçalho, sem documentos), o
// endereço residencial, Inovação e Educação (repetem itens de outras seções)
// e "Outros dados" (tabelas de apoio do Lattes, não conteúdo).

import { childElements, type XElement } from '../model/xml.ts';
import { isListItem } from '../ui/item-meta.ts';
import type { Section, SectionGroup } from '../ui/sections.ts';

export type Template = 'resumido' | 'ampliado' | 'completo' | 'personalizado';

export const TEMPLATES: { label: string; value: Template }[] = [
  { label: 'Resumido', value: 'resumido' },
  { label: 'Ampliado', value: 'ampliado' },
  { label: 'Completo', value: 'completo' },
  { label: 'Personalizado', value: 'personalizado' },
];

/** Como o grupo é composto na página. */
export type GroupKind = 'text' | 'address' | 'short' | 'list';

export interface PrintGroup {
  id: string;
  items: XElement[];
  /** Nome do contêiner XML (ARTIGOS-PUBLICADOS…), estável entre arquivos. */
  key: string;
  kind: GroupKind;
  label: string;
}

export interface PrintSection {
  groups: PrintGroup[];
  id: string;
  label: string;
}

export interface PrintOptions {
  /** Títulos e realces na cor do Lattes; sem cor, tudo em preto. */
  color: boolean;
  /** Títulos das seções em inglês e, quando existir, o título em inglês dos itens. */
  english: boolean;
  /** De quatro autores em diante, só o primeiro e "et al.". */
  etAl: boolean;
  /** Ids dos grupos marcados. */
  selected: Set<string>;
}

const SKIPPED_SECTIONS = new Set(['inovacao', 'educacao', 'outros']);
const SKIPPED_GROUPS = new Set(['DADOS-GERAIS']);
const TEXT_GROUPS = new Set(['RESUMO-CV', 'OUTRAS-INFORMACOES-RELEVANTES']);
const SHORT_GROUPS = new Set(['IDIOMAS', 'AREAS-DE-ATUACAO', 'PREMIOS-TITULOS', 'LICENCAS']);

const RESUMIDO = [
  'RESUMO-CV',
  'FORMACAO-ACADEMICA-TITULACAO',
  'ATUACOES-PROFISSIONAIS',
  'ARTIGOS-PUBLICADOS',
  'LIVROS-PUBLICADOS-OU-ORGANIZADOS',
  'CAPITULOS-DE-LIVROS-PUBLICADOS',
  'TRABALHOS-EM-EVENTOS',
  'TEXTOS-EM-JORNAIS-OU-REVISTAS',
  'DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA',
];

const AMPLIADO = [
  ...RESUMIDO,
  'OUTRAS-INFORMACOES-RELEVANTES',
  'IDIOMAS',
  'PREMIOS-TITULOS',
  'AREAS-DE-ATUACAO',
  'FORMACAO-COMPLEMENTAR',
  'PROJETO-DE-PESQUISA',
  'ARTIGOS-ACEITOS-PARA-PUBLICACAO',
  'SOFTWARE',
  'PRODUTO-TECNOLOGICO',
  'PROCESSOS-OU-TECNICAS',
  'TRABALHO-TECNICO',
  'ORIENTACOES-EM-ANDAMENTO',
  'ORIENTACOES-CONCLUIDAS',
];

/** Títulos em inglês, quando o rótulo em português tem tradução estabelecida. */
const ENGLISH: Record<string, string> = {
  'AREAS-DE-ATUACAO': 'Areas of expertise',
  'ARTIGOS-ACEITOS-PARA-PUBLICACAO': 'Articles accepted for publication',
  'ARTIGOS-PUBLICADOS': 'Journal articles',
  'ATUACOES-PROFISSIONAIS': 'Professional experience',
  'CAPITULOS-DE-LIVROS-PUBLICADOS': 'Book chapters',
  'DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA': 'Other bibliographic production',
  'DEMAIS-TIPOS-DE-PRODUCAO-TECNICA': 'Other technical production',
  ENDERECO: 'Professional address',
  'FORMACAO-ACADEMICA-TITULACAO': 'Education',
  'FORMACAO-COMPLEMENTAR': 'Complementary education',
  IDIOMAS: 'Languages',
  LICENCAS: 'Licenses',
  'LIVROS-PUBLICADOS-OU-ORGANIZADOS': 'Books',
  'ORIENTACOES-CONCLUIDAS': 'Completed supervisions',
  'ORIENTACOES-EM-ANDAMENTO': 'Ongoing supervisions',
  'OUTRAS-INFORMACOES-RELEVANTES': 'Other relevant information',
  'PARTICIPACAO-EM-BANCA-JULGADORA': 'Selection committees',
  'PARTICIPACAO-EM-BANCA-TRABALHOS-CONCLUSAO': 'Thesis committees',
  'PARTICIPACAO-EM-EVENTOS-CONGRESSOS': 'Events and conferences',
  'PREMIOS-TITULOS': 'Awards and honors',
  'PROCESSOS-OU-TECNICAS': 'Processes and techniques',
  'PRODUTO-TECNOLOGICO': 'Technological products',
  'PROJETO-DE-PESQUISA': 'Research projects',
  'RESUMO-CV': 'Summary',
  SOFTWARE: 'Software',
  'TEXTOS-EM-JORNAIS-OU-REVISTAS': 'Newspaper and magazine articles',
  'TRABALHO-TECNICO': 'Technical work',
  'TRABALHOS-EM-EVENTOS': 'Conference papers',
};

const ENGLISH_SECTIONS: Record<string, string> = {
  atuacao: 'Professional experience',
  bancas: 'Committees',
  'dados-gerais': 'General information',
  eventos: 'Events',
  formacao: 'Education',
  orientacoes: 'Supervision',
  patentes: 'Patents and registrations',
  producoes: 'Production',
  projetos: 'Projects',
};

export function groupLabel(g: PrintGroup, english: boolean): string {
  return (english && ENGLISH[g.key]) || g.label;
}

export function sectionLabel(s: PrintSection, english: boolean): string {
  return (english && ENGLISH_SECTIONS[s.id]) || s.label;
}

/** Os itens de um grupo: os próprios elementos, ou os filhos de um contêiner único. */
export function groupItems(g: SectionGroup): XElement[] {
  if (g.elements.length !== 1) return g.elements;
  const only = g.elements[0]!;
  // Um item sozinho (um único SOFTWARE, por exemplo) é o próprio item; as partes
  // dele (DADOS-BASICOS…) não são itens. O endereço é a exceção: os itens são
  // o profissional e o residencial.
  if (only.attrs.length > 0 && only.name !== 'ENDERECO') return [only];
  const kids = childElements(only).filter(isListItem);
  return kids.length > 0 ? kids : [only];
}

function kindOf(key: string): GroupKind {
  if (TEXT_GROUPS.has(key)) return 'text';
  if (key === 'ENDERECO') return 'address';
  if (SHORT_GROUPS.has(key)) return 'short';
  return 'list';
}

/** Seções e grupos que podem ir para a página, na ordem do menu lateral. */
export function printOutline(sections: Section[]): PrintSection[] {
  return sections
    .filter((s) => !SKIPPED_SECTIONS.has(s.id))
    .map((s) => ({
      groups: s.groups
        .map((g): PrintGroup => {
          const key = g.elements[0]?.name ?? '';
          return { id: g.id, items: groupItems(g), key, kind: kindOf(key), label: g.label };
        })
        .filter((g) => g.key && !SKIPPED_GROUPS.has(g.key) && g.items.length > 0),
      id: s.id,
      label: s.label,
    }))
    .filter((s) => s.groups.length > 0);
}

/** Os grupos marcados por um modelo. "Personalizado" parte do que já estava marcado. */
export function templateSelection(
  outline: PrintSection[],
  template: Template,
  current: Set<string> = new Set(),
): Set<string> {
  if (template === 'personalizado') return new Set(current);
  const all = outline.flatMap((s) => s.groups);
  if (template === 'completo') return new Set(all.map((g) => g.id));
  const keys = new Set(template === 'resumido' ? RESUMIDO : AMPLIADO);
  return new Set(all.filter((g) => keys.has(g.key)).map((g) => g.id));
}

/** O modelo que corresponde à seleção, ou "personalizado". */
export function matchTemplate(outline: PrintSection[], selected: Set<string>): Template {
  for (const t of ['resumido', 'ampliado', 'completo'] as const) {
    const ids = templateSelection(outline, t);
    if (ids.size === selected.size && [...ids].every((id) => selected.has(id))) return t;
  }
  return 'personalizado';
}

/** Marca ou desmarca grupos; devolve um conjunto novo. */
export function toggleGroups(selected: Set<string>, ids: string[], on: boolean): Set<string> {
  const next = new Set(selected);
  for (const id of ids) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
}

/** Quantos itens há nos grupos marcados (para o rótulo do botão). */
export function selectedCount(outline: PrintSection[], selected: Set<string>): number {
  return outline
    .flatMap((s) => s.groups)
    .filter((g) => selected.has(g.id))
    .reduce((n, g) => n + g.items.length, 0);
}
