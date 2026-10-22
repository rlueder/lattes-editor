// O que mudou no Lattes desde a exportação carregada, em todas as seções: as
// listas do currículo no Lattes (src/bridge/cv-lists.ts, uma linha por item)
// contra os itens da exportação. A comparação pela página de conferência
// (espelho-diff.ts) só lê as linhas numeradas de produção e eventos; as
// listas trazem também atuação (com os vínculos e as atividades de cada uma),
// formação, formação complementar, prêmios e idiomas.
//
// Compara chaves, não campos: um item conta como presente quando uma linha da
// lista dele traz as suas chaves (a instituição e o ano de início numa
// formação, o nome do evento e o ano num evento, o título numa produção),
// mesmo que outro campo tenha mudado. Formatos das linhas lidos no Lattes
// real em 21/10/2026.

import type { EspelhoItem } from '../bridge/espelho.ts';
import type { ListRow, ListSnapshot } from '../census/test-ledger.ts';
import { childElements, firstChild, getAttr, walk, type XElement } from '../model/xml.ts';
import { itemMeta } from '../ui/item-meta.ts';
import { normalizeTitle } from './consistency.ts';
import { diffEspelho, type EspelhoDiff } from './espelho-diff.ts';

/** Chaves mais curtas que isto casariam com qualquer linha; o item não é comparado. */
const MIN_KEY = 4;

interface Candidate {
  item: XElement;
  /** Todas têm de estar na linha. */
  keys: string[];
  /** A primeira chave abre a linha (o começo do período de um vínculo). */
  prefix?: boolean;
  title: string;
}

interface Group {
  candidates: Candidate[];
  /** Subtítulo das linhas que sobram (a atuação de um vínculo). */
  group?: string;
  /** Alguma lista da seção foi lida; sem isso, nada dela é comparado. */
  read: boolean;
  rows: ListRow[];
  section: string;
}

/** Listas que não são itens do currículo: dicionários, importação, histórico de periódicos. */
const IGNORED = /^(pkg_dic_|pkg_import_|pkg_linhapesq|pkg_alteracao_periodico)/;

/** As listas com grupo próprio acima. */
const HANDLED = /^(pkg_ativ\.|pkg_formacao|pkg_evento\.lista|pkg_premio\.lista|pkg_idioma\.lista)/;

/**
 * As listas de produção, projeto, orientação, banca e afins, cujos itens a
 * exportação traz com título (SEQUENCIA-PRODUCAO ou PROJETO-DE-PESQUISA).
 * Nomes lidos no menu do Lattes real em 21/10/2026.
 */
const TITLED_LISTS =
  /^(pkg_artigo|pkg_lvr_cap|pkg_texto|pkg_trabalho|pkg_demais|pkg_relatorio|pkg_arte_nova|pkg_patente_registro|pkg_processo|pkg_produto|pkg_projeto|pkg_orient|pkg_banca_|pkg_assessoria_consultoria|pkg_extensao_tecnologica|pkg_licenca|prc_bib_demais_lista|prc_tec_demais_lista|prc_arte_lista)/;

const at = (root: XElement, ...path: string[]): XElement | undefined =>
  path.reduce<XElement | undefined>((el, name) => el && firstChild(el, name), root);

const attr = (el: XElement | undefined, name: string) => (el ? (getAttr(el, name) ?? '') : '');

const childStartingWith = (el: XElement, prefix: string) =>
  childElements(el).find((c) => c.name.startsWith(prefix));

const norm = (text: string) => normalizeTitle(text);

/** Os itens de uma seção; seção ausente na exportação, nenhum item. */
const childrenOf = (el: XElement | undefined) => (el ? childElements(el) : []);

/**
 * O nome primeiro, sempre: sem nome, a chave principal fica vazia e o item não
 * é comparado, em vez de o ano casar com qualquer linha daquele ano.
 */
const nameThenYear = (name: string, year: string) => [norm(name), ...(year ? [year] : [])];

/** O começo do período como a lista o mostra: "01/2011", ou só o ano. */
function period(el: XElement): string {
  const year = attr(el, 'ANO-INICIO');
  const month = attr(el, 'MES-INICIO');
  return month ? `${month.padStart(2, '0')}/${year}` : year;
}

/** As linhas de várias listas, sem repetir o mesmo item (o evento está na geral e na de divulgação). */
function rowsOf(lists: ListSnapshot, test: (key: string) => boolean): ListRow[] {
  const seen = new Set<string>();
  const out: ListRow[] = [];
  for (const [key, rows] of Object.entries(lists)) {
    if (!test(key)) continue;
    for (const row of rows) {
      const id = row.link.replace(/f_cod=[^&]*&?/, '') || row.text;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(row);
    }
  }
  return out;
}

function atuacoes(root: XElement): XElement[] {
  return childrenOf(at(root, 'DADOS-GERAIS', 'ATUACOES-PROFISSIONAIS')).filter(
    (e) => e.name === 'ATUACAO-PROFISSIONAL',
  );
}

/** Os grupos de comparação: cada seção com as suas listas e os seus itens. */
function groupsOf(lists: ListSnapshot, root: XElement, unread: string[]): Group[] {
  const groups: Group[] = [];
  const allUnread = unread.includes('*');
  const add = (
    section: string,
    test: (k: string) => boolean,
    candidates: Candidate[],
    group?: string,
  ) =>
    groups.push({
      candidates,
      // Lida: alguma lista da seção veio, e nenhuma dela falhou.
      read: !allUnread && Object.keys(lists).some(test) && !unread.some(test),
      rows: rowsOf(lists, test),
      section,
      ...(group ? { group } : {}),
    });

  // Atuação: a instituição; e, na página de cada uma, os vínculos e as atividades.
  const work = atuacoes(root);
  add(
    'Atuação',
    (k) => k.startsWith('pkg_ativ.lista'),
    work.map((a) => ({
      item: a,
      keys: [norm(attr(a, 'NOME-INSTITUICAO'))],
      title: attr(a, 'NOME-INSTITUICAO'),
    })),
  );
  for (const a of work) {
    const seq = attr(a, 'SEQUENCIA-ATIVIDADE');
    const name = attr(a, 'NOME-INSTITUICAO');
    const candidates: Candidate[] = [];
    for (const v of childElements(a, 'VINCULOS')) {
      candidates.push({
        item: v,
        keys: [norm(period(v))],
        prefix: true,
        title: `${name}: vínculo de ${period(v)}`,
      });
    }
    for (const group of childElements(a).filter((c) => c.name.startsWith('ATIVIDADES-DE-'))) {
      for (const act of childElements(group)) {
        candidates.push({
          item: act,
          keys: [norm(period(act))],
          title: `${name}: atividade de ${period(act)}`,
        });
      }
    }
    if (candidates.length === 0) continue;
    // O número vem da exportação: só dígitos entram no padrão. Sem número, ou
    // sem a página dele entre as listas, os vínculos e as atividades dela não
    // são comparados, e isso aparece.
    const page = /^\d+$/.test(seq)
      ? new RegExp(`^pkg_ativ\\.cargos_vinculos\\?(.*&)?f_seq_ativ=${seq}(&|$)`)
      : undefined;
    add('Atuação', (k) => !!page && page.test(k), candidates, `Vínculos e atividades: ${name}`);
  }

  // Formação: a instituição e o ano de início.
  const formation = (container: XElement | undefined) =>
    childrenOf(container).map((f) => ({
      item: f,
      keys: nameThenYear(attr(f, 'NOME-INSTITUICAO'), attr(f, 'ANO-DE-INICIO')),
      title: itemMeta(f).title || attr(f, 'NOME-INSTITUICAO'),
    }));
  add(
    'Formação acadêmica',
    (k) => k.startsWith('pkg_formacao.lista'),
    formation(at(root, 'DADOS-GERAIS', 'FORMACAO-ACADEMICA-TITULACAO')),
  );
  add(
    'Formação complementar',
    (k) => k.startsWith('pkg_formacao_compl.lista'),
    formation(at(root, 'DADOS-COMPLEMENTARES', 'FORMACAO-COMPLEMENTAR')),
  );

  // Eventos: o nome do evento e o ano.
  const events = childrenOf(at(root, 'DADOS-COMPLEMENTARES', 'PARTICIPACAO-EM-EVENTOS-CONGRESSOS'));
  add(
    'Eventos',
    (k) => k.startsWith('pkg_evento.lista'),
    events.map((e) => {
      const detail = childStartingWith(e, 'DETALHAMENTO-');
      const basics = childStartingWith(e, 'DADOS-BASICOS-');
      return {
        item: e,
        keys: nameThenYear(attr(detail, 'NOME-DO-EVENTO'), attr(basics, 'ANO')),
        title: attr(detail, 'NOME-DO-EVENTO'),
      };
    }),
  );

  // Prêmios: o nome e o ano. Idiomas: o nome.
  add(
    'Prêmios e títulos',
    (k) => k.startsWith('pkg_premio.lista'),
    childrenOf(at(root, 'DADOS-GERAIS', 'PREMIOS-TITULOS')).map((p) => ({
      item: p,
      keys: nameThenYear(attr(p, 'NOME-DO-PREMIO-OU-TITULO'), attr(p, 'ANO-DA-PREMIACAO')),
      title: attr(p, 'NOME-DO-PREMIO-OU-TITULO'),
    })),
  );
  add(
    'Idiomas',
    (k) => k.startsWith('pkg_idioma.lista'),
    childrenOf(at(root, 'DADOS-GERAIS', 'IDIOMAS')).map((i) => ({
      item: i,
      keys: [norm(attr(i, 'DESCRICAO-DO-IDIOMA'))],
      title: attr(i, 'DESCRICAO-DO-IDIOMA'),
    })),
  );

  // O resto (produções, projetos, orientações, bancas…): o título, nas listas
  // que guardam esses itens. Uma lista fora delas, com linhas, deixa a seção
  // como não comparada em vez de dar as linhas como incluídas.
  const eventItems = new Set(events);
  const titled: Candidate[] = [];
  walk(root, (el) => {
    const produced =
      getAttr(el, 'SEQUENCIA-PRODUCAO') !== undefined && childElements(el).length > 0;
    if ((produced && !eventItems.has(el)) || el.name === 'PROJETO-DE-PESQUISA') {
      const title = itemMeta(el).title || attr(el, 'NOME-DO-PROJETO');
      titled.push({ item: el, keys: [norm(title)], title });
    }
  });
  add('Produção e outras listas', (k) => TITLED_LISTS.test(k), titled);
  const unknown = Object.entries(lists).filter(
    ([k, rows]) => rows.length > 0 && !HANDLED.test(k) && !TITLED_LISTS.test(k) && !IGNORED.test(k),
  );
  if (unknown.length > 0)
    groups.push({ candidates: [], read: false, rows: [], section: 'Outras listas do Lattes' });
  return groups;
}

/** A linha traz as chaves? Palavras inteiras, para "Design" não casar com "Designer". */
function matches(row: string, c: Candidate): boolean {
  const padded = ` ${row} `;
  return c.keys.every((k, i) =>
    c.prefix && i === 0 ? padded.startsWith(` ${k} `) : padded.includes(` ${k} `),
  );
}

export function diffLists(lists: ListSnapshot, root: XElement, unread: string[] = []): EspelhoDiff {
  const onlyInExport: EspelhoDiff['onlyInExport'] = [];
  const onlyInLattes: EspelhoItem[] = [];
  let skipped = 0;
  let compared = 0;
  let found = 0;
  let rowsSeen = 0;
  const notCompared = new Set<string>();
  for (const g of groupsOf(lists, root, unread)) {
    // A lista da seção não foi lida, ou veio vazia com itens na exportação: os
    // itens dela não "sumiram", só não foram vistos. A seção aparece como não
    // comparada, e a pessoa confere no Lattes.
    if (!g.read || (g.rows.length === 0 && g.candidates.length > 0)) {
      if (g.candidates.length > 0 || g.section === 'Outras listas do Lattes') {
        notCompared.add(g.group ?? g.section);
      }
      continue;
    }
    const rows = g.rows.map((r) => norm(r.text));
    rowsSeen += rows.length;
    const used = new Set<number>();
    for (const c of g.candidates) {
      if (c.keys.length === 0 || c.keys[0]!.length < MIN_KEY) {
        skipped++;
        continue;
      }
      compared++;
      const hit = rows.findIndex((r, i) => !used.has(i) && matches(r, c));
      if (hit >= 0) {
        used.add(hit);
        found++;
      } else onlyInExport.push({ item: c.item, title: c.title });
    }
    g.rows.forEach((r, i) => {
      if (!used.has(i))
        onlyInLattes.push({
          ...(g.group ? { group: g.group } : {}),
          section: g.section,
          text: r.text,
        });
    });
  }
  // Nenhuma linha lida, ou nenhum item achado: mais provável o formato das
  // listas ter mudado do que o currículo inteiro ter sido refeito.
  const expected = compared > 0 || notCompared.size > 0;
  if (expected && (rowsSeen === 0 || (compared > 0 && found === 0))) {
    return { onlyInExport: [], onlyInLattes: [], scope: 'listas', skipped, unreadable: true };
  }
  return {
    ...(notCompared.size > 0 ? { notCompared: [...notCompared] } : {}),
    onlyInExport,
    onlyInLattes,
    scope: 'listas',
    skipped,
  };
}

/**
 * A comparação que os painéis mostram: pelas listas quando a extensão as
 * trouxe; senão pela página de conferência, que só vê produções e eventos.
 */
export function compareWithLattes(
  reading: { items?: EspelhoItem[]; lists?: ListSnapshot; listsUnread?: string[] },
  root: XElement,
): EspelhoDiff | undefined {
  if (reading.lists) return diffLists(reading.lists, root, reading.listsUnread);
  return reading.items ? diffEspelho(reading.items, root) : undefined;
}
