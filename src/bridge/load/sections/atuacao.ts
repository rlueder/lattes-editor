// Atuação profissional: a lista pkg_ativ.lista e, para cada atuação, a tela
// de cargos e vínculos (PKG_ATIV.cargos_vinculos, lida com as listas), com um
// link por vínculo (PKG_ATIV.vinculos, GN_ATIV_VINC) e por atividade
// (pkg_ativ.cargo, GN_ATIV_CARGO). Depois, as linhas de pesquisa
// (pkg_linhapesq.lista) e os projetos (pkg_projeto.lista), que ficam dentro
// de uma atividade da atuação pelos números do link (F_SEQ_ATIV,
// F_SEQ_FUNCAO). Os campos voltam ao XML pelas tabelas do conector (plan.ts,
// edit-atividade.ts) e pelas especificações das produções
// (production/targets/), ao contrário.
//
// O nome da instituição é a primeira célula da linha da lista (as outras são
// a sigla e o período; observado em 28/10/2026). Inferidos: a
// SEQUENCIA-IMPORTANCIA pela ordem da lista; o
// texto do órgão como a página o mostra ("/ Órgão", "/Unidade" ou
// "órgão/\nunidade", production/organ.ts), com o código em f_codorgao.

import { emptyAttrs } from '../../../model/production.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../../model/xml.ts';
import { lattesSchema } from '../../../schema/lattes.ts';
import { screenTable } from '../../../schema/screen-fields.ts';
import { VINCULO_TEXT } from '../../create.ts';
import { ACTIVITY_TYPES, PERIOD } from '../../edit-atividade.ts';
import { TEACHING_LEVELS } from '../../ensino-curso.ts';
import { decodeHtmlEntities } from '../../html-text.ts';
import { findLinks, type LattesLink } from '../../lattes-html.ts';
import { parseAreaTree } from '../../lattes-lists.ts';
import { VINCULO_FIELDS } from '../../plan.ts';
import { FUNDER_NATURE } from '../../production/financiador.ts';
import { type GridRow, readProvider } from '../../production/grids.ts';
import { tableBody } from '../../production/opaque.ts';
import { PRODUCTION_TARGETS } from '../../production/targets/index.ts';
import type { ProductionTarget } from '../../production/types.ts';
import { applyReading } from '../../refresh/apply-reading.ts';
import { schemaPathWithin } from '../../refresh/from-form.ts';
import type { FormReading } from '../../refresh/read.ts';
import { flagFromStavinc } from '../../vinculo-flag.ts';
import { fillEmptyChoices } from '../fill.ts';
import { applyItemGrids } from '../grids.ts';
import type { LoadContext, LoadSection } from '../loader.ts';
import { readTable } from '../reverse.ts';
import { ensurePath, formIn, listsOf, place, rowLinks } from './common.ts';

const SECTION = 'Atuação profissional';

const withoutLetter = (code: string) => code.trim().replace(/^[A-Za-z]/, '');

const param = (link: LattesLink, name: string) =>
  link.params[name.toLowerCase()] ?? link.params[name] ?? '';

const NATURE_OF = Object.fromEntries(
  Object.entries(ACTIVITY_TYPES).map(([el, t]) => [t.natur, el]),
);
const TEACHING_OF = Object.fromEntries(Object.entries(TEACHING_LEVELS).map(([x, c]) => [c, x]));
const VINCULO_OF = Object.fromEntries(Object.entries(VINCULO_TEXT).map(([x, t]) => [t, x]));

/** O elemento novo com os atributos do XSD, vazios. */
const blank = (name: string) => element(name, emptyAttrs(lattesSchema, name));

/** Atributo que o elemento tem no XSD. */
const owns = (el: XElement, attr: string) =>
  lattesSchema.elements[el.name]?.attributes.some((a) => a.name === attr) ?? false;

const setOwn = (el: XElement, attr: string, value: string) => {
  if (owns(el, attr)) setAttr(el, attr, value);
};

const cellText = (html: string) =>
  decodeHtmlEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

/**
 * O nome de cada linha da lista, pelo link dela. No Lattes real (28/10/2026) a
 * linha clicável tem três células: o nome, a sigla e o período; o nome é a
 * primeira. Sem essa forma, o texto do link (o Lattes simulado).
 */
function rowTexts(html: string): { link: string; text: string }[] {
  const rows = [...html.matchAll(/<tr[^>]*onclick="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => ({
    link: /(?:setarUrl|abreUrlModal)\('([^']+)'/.exec(m[1]!.replace(/&amp;/g, '&'))?.[1] ?? '',
    text: cellText(/<td\b[^>]*>([\s\S]*?)<\/td>/i.exec(m[2]!)?.[1] ?? ''),
  }));
  if (rows.length > 0) return rows;
  return [
    ...html.matchAll(/<a[^>]*(?:setarUrl|abreUrlModal)\('([^']+)'[^>]*>([\s\S]*?)<\/a>/gi),
  ].map((m) => ({
    link: m[1]!.replace(/&amp;/g, '&'),
    text: m[2]!
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  }));
}

/** O órgão e a unidade pelo texto que a página mostra em f_orgao, e o código escolhido. */
function setOrgan(el: XElement, text: string | undefined, code: string | undefined): void {
  const t = (text ?? '').replace(/\r/g, '');
  if (!t.trim()) return;
  let organ = '';
  let unit = '';
  if (t.includes('/\n')) [organ = '', unit = ''] = t.split('/\n');
  else if (t.startsWith('/ ')) organ = t.slice(2);
  else if (t.startsWith('/')) unit = t.slice(1);
  else organ = t;
  if (organ.trim()) setOwn(el, 'NOME-ORGAO', organ.trim());
  if (unit.trim()) setOwn(el, 'NOME-UNIDADE', unit.trim());
  if (code) setOwn(el, unit.trim() ? 'CODIGO-UNIDADE' : 'CODIGO-ORGAO', code);
}

/** O contêiner do tipo dentro da atuação (ATIVIDADES-DE-…), na ordem do schema. */
function activityHolder(atuacao: XElement, name: string): XElement {
  return ensurePath(atuacao, schemaPathWithin('ATUACAO-PROFISSIONAL', name) ?? []);
}

function vinculo(v: Record<string, string>, seq: string, ctx: LoadContext): XElement {
  const el = blank('VINCULOS');
  setAttr(el, 'SEQUENCIA-HISTORICO', seq);
  const table = Object.fromEntries(
    Object.entries(VINCULO_FIELDS).filter(
      ([attr]) => attr !== 'FLAG-DEDICACAO-EXCLUSIVA' && attr !== 'FLAG-VINCULO-EMPREGATICIO',
    ),
  );
  const unread = readTable(el, table, v);
  if (unread.length > 0) ctx.gap(SECTION, `vínculo: valor sem opção (${unread.join(', ')})`);
  // A caixa f_regime com valor 3 é a dedicação exclusiva; f_stavinc é invertido.
  if ('f_regime' in v) setAttr(el, 'FLAG-DEDICACAO-EXCLUSIVA', v.f_regime === '3' ? 'SIM' : 'NAO');
  if ('f_stavinc' in v) setAttr(el, 'FLAG-VINCULO-EMPREGATICIO', flagFromStavinc(v.f_stavinc));
  // O texto que não é uma das opções conhecidas vai como LIVRE, com o texto
  // em OUTRO-VINCULO-INFORMADO; o enquadramento digitado, também LIVRE (como a
  // exportação do dono, observado em 28/10/2026).
  const text = (v.f_vinc ?? v.f_vinculo ?? '').trim();
  if (text) {
    const code = VINCULO_OF[text];
    setAttr(el, 'TIPO-DE-VINCULO', code ?? 'LIVRE');
    setAttr(el, 'OUTRO-VINCULO-INFORMADO', code ? '' : text);
  }
  if ((v.f_enqua ?? '').trim()) setAttr(el, 'ENQUADRAMENTO-FUNCIONAL', 'LIVRE');
  return el;
}

/** A grade de descrições da atividade (providerDetAtiv): os filhos, ou o texto da descrição. */
function description(el: XElement, rows: GridRow[] | undefined): void {
  const labeled = (rows ?? []).filter((r) => typeof r.l === 'string' && String(r.l).trim());
  if (el.name === 'ENSINO' || el.name === 'TREINAMENTO-MINISTRADO') {
    const child = el.name === 'ENSINO' ? 'DISCIPLINA' : 'TREINAMENTO';
    for (const r of labeled) {
      el.children.push(
        element(child, { 'SEQUENCIA-ESPECIFICACAO': String(r.c ?? '') }, [
          { kind: 'text', value: String(r.l) },
        ]),
      );
    }
    return;
  }
  if (el.name === 'PESQUISA-E-DESENVOLVIMENTO') {
    for (const r of labeled) {
      const linha = blank('LINHA-DE-PESQUISA');
      setAttr(linha, 'SEQUENCIA-LINHA', String(r.c ?? ''));
      setAttr(linha, 'TITULO-DA-LINHA-DE-PESQUISA', String(r.l));
      place(el, linha);
    }
    return;
  }
  const attr = ACTIVITY_TYPES[el.name]?.description;
  if (attr) setAttr(el, attr, labeled.map((r) => String(r.l)).join('\n'));
}

function activity(name: string, reading: FormReading, html: string, seq: string): XElement {
  const v = reading.values ?? {};
  const el = blank(name);
  setAttr(el, 'SEQUENCIA-FUNCAO-ATIVIDADE', seq);
  readTable(el, PERIOD, v, { labels: { 'FLAG-PERIODO': ['ANTERIOR', 'ATUAL'] } });
  setOrgan(el, v.f_orgao, v.f_codorgao);
  if (name === 'ENSINO') {
    setAttr(el, 'TIPO-ENSINO', TEACHING_OF[v.f_nivel ?? ''] ?? '');
    setAttr(el, 'NOME-CURSO', v.f_curso ?? '');
    setAttr(el, 'CODIGO-CURSO', v.f_cod_curso ?? '');
  }
  description(el, readProvider(html, 'providerDetAtiv'));
  return el;
}

/** As atuações, com vínculos e atividades; devolve cada uma pelo f_seq_ativ. */
async function atuacoes(ctx: LoadContext): Promise<Map<string, XElement>> {
  const byAtiv = new Map<string, XElement>();
  const list = listsOf(ctx, 'pkg_ativ.lista');
  const rows = list.flatMap((p) => rowTexts(p.html));
  const screens = listsOf(ctx, 'pkg_ativ.cargos_vinculos');
  if (screens.length === 0) return byAtiv;
  const container = ensurePath(ctx.root, ['DADOS-GERAIS', 'ATUACOES-PROFISSIONAIS']);
  const work: { atuacao: XElement; links: LattesLink[]; kind: 'vinculo' | 'atividade' }[] = [];
  screens.forEach((screen, i) => {
    const url = findLinks(screen.url, 'pkg_ativ.cargos_vinculos')[0];
    const seqAtiv = url ? param(url, 'f_seq_ativ') : '';
    const codinst = url ? param(url, 'f_codinst') : '';
    const row = rows.find((r) => new RegExp(`[?&]f_seq_ativ=${seqAtiv}(&|$)`, 'i').test(r.link));
    const atuacao = element('ATUACAO-PROFISSIONAL', {
      'CODIGO-INSTITUICAO': withoutLetter(codinst),
      'NOME-INSTITUICAO': row?.text ?? '',
      'SEQUENCIA-ATIVIDADE': seqAtiv,
      'SEQUENCIA-IMPORTANCIA': String(i + 1),
    });
    if (!row) ctx.gap(SECTION, 'o nome da instituição não veio na lista');
    place(container, atuacao);
    byAtiv.set(seqAtiv, atuacao);
    work.push({
      atuacao,
      kind: 'vinculo',
      links: findLinks(screen.html, 'PKG_ATIV.vinculos').filter((l) => param(l, 'f_seq_hist')),
    });
    work.push({
      atuacao,
      kind: 'atividade',
      links: findLinks(screen.html, 'pkg_ativ.cargo').filter((l) => param(l, 'f_seq_funcao')),
    });
  });
  const pages = await ctx.fetch(work.flatMap((w) => w.links.map((l) => l.path)));
  for (const { atuacao, kind, links } of work) {
    for (const link of links) {
      const html = pages.get(link.path);
      const form = kind === 'vinculo' ? 'GN_ATIV_VINC' : 'GN_ATIV_CARGO';
      const reading = formIn(ctx, html, link.path, [form]);
      if (!html || !reading?.values) {
        ctx.gap(SECTION, `o formulário do ${kind} não abriu`);
        continue;
      }
      if (kind === 'vinculo') {
        place(atuacao, vinculo(reading.values, param(link, 'f_seq_hist'), ctx));
        continue;
      }
      const natur = (reading.values.f_natur_ativ || param(link, 'f_natur_ativ')).toUpperCase();
      const name = NATURE_OF[natur];
      if (!name) {
        ctx.gap(SECTION, 'a natureza da atividade não foi reconhecida');
        continue;
      }
      place(
        activityHolder(atuacao, name),
        activity(name, reading, html, param(link, 'f_seq_funcao')),
      );
    }
  }
  return byAtiv;
}

const target = (id: string) => PRODUCTION_TARGETS.find((t) => t.id === id) as ProductionTarget;

/** A atividade de um tipo, pelo número, na atuação; criada quando a tela não a listou. */
function activityIn(atuacao: XElement, name: string, seq: string): XElement {
  const holder = activityHolder(atuacao, name);
  const found = childElements(holder, name).find(
    (a) => getAttr(a, 'SEQUENCIA-FUNCAO-ATIVIDADE') === seq,
  );
  if (found) return found;
  const el = blank(name);
  setAttr(el, 'SEQUENCIA-FUNCAO-ATIVIDADE', seq);
  place(holder, el);
  return el;
}

/** As linhas de pesquisa, cada uma na atividade de pesquisa e desenvolvimento dela. */
async function linhas(ctx: LoadContext, byAtiv: Map<string, XElement>): Promise<void> {
  const t = target('linha-de-pesquisa');
  const links = rowLinks(listsOf(ctx, t.list.proc), t.list.formProc, t.list.isRow);
  if (links.length === 0) return;
  const tree = parseAreaTree(ctx.menu) ?? [];
  const pages = await ctx.fetch(links.map((l) => l.path));
  for (const link of links) {
    const reading = formIn(ctx, pages.get(link.path), link.path, [t.form.name]);
    const atuacao = byAtiv.get(param(link, 'F_SEQ_ATIV'));
    if (!reading?.values || !atuacao) {
      ctx.gap('Linhas de pesquisa', 'a linha não abriu, ou a atuação dela não foi lida');
      continue;
    }
    const act = activityIn(atuacao, 'PESQUISA-E-DESENVOLVIMENTO', param(link, 'F_SEQ_FUNCAO'));
    const seq = param(link, 'F_SEQ_LINHA');
    let linha = childElements(act, 'LINHA-DE-PESQUISA').find(
      (l) => getAttr(l, 'SEQUENCIA-LINHA') === seq,
    );
    if (!linha) {
      linha = blank('LINHA-DE-PESQUISA');
      setAttr(linha, 'SEQUENCIA-LINHA', seq);
      place(act, linha);
    }
    applyReading(t, linha, reading, { fresh: true });
    fillEmptyChoices(t, linha, reading.values);
    const outside = applyItemGrids(linha, reading.grids ?? {}, tree);
    if (outside.length > 0)
      ctx.gap('Linhas de pesquisa', 'área fora da árvore de áreas do Lattes', outside.length);
  }
}

/** A equipe do projeto pela grade autorProvider (c, l, t, tit), na ordem da página. */
function team(projeto: XElement, rows: GridRow[] | undefined): void {
  const members = (rows ?? []).filter((r) => typeof r.l === 'string' && String(r.l).trim());
  if (members.length === 0) return;
  const equipe = ensurePath(projeto, ['EQUIPE-DO-PROJETO']);
  members.forEach((r, i) => {
    const m = blank('INTEGRANTES-DO-PROJETO');
    setAttr(m, 'NOME-COMPLETO', String(r.l));
    setAttr(m, 'NOME-PARA-CITACAO', String(r.t ?? ''));
    setAttr(m, 'ORDEM-DE-INTEGRACAO', String(i + 1));
    setAttr(m, 'FLAG-RESPONSAVEL', String(r.tit ?? '').toLowerCase() === 's' ? 'SIM' : 'NAO');
    setOwn(m, 'NRO-ID-CNPQ', String(r.c ?? ''));
    place(equipe, m);
  });
}

const cellsOf = (row: string) =>
  [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => {
    const html = m[1] ?? '';
    const span = /<span\b[^>]*>([\s\S]*?)<\/span>/i.exec(html)?.[1] ?? '';
    const shown = html.replace(/<span\b[\s\S]*?<\/span>/gi, '').replace(/<[^>]+>/g, '');
    return { shown: decodeHtmlEntities(shown).trim(), value: decodeHtmlEntities(span).trim() };
  });

const tableRowsOf = (html: string, id: string) =>
  [...(tableBody(html, id) ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    cellsOf(m[1] ?? ''),
  );

const NATURE_OF_FUNDER = Object.fromEntries(Object.entries(FUNDER_NATURE).map(([x, l]) => [l, x]));

/**
 * As tabelas da página do projeto (seção 21): os financiadores (grid2: o nome
 * da instituição com o código e a letra da busca, e a natureza pela letra) e
 * as produções e orientações ligadas (grid3 e grid4: o título com o número, e
 * o tipo), que a exportação de 27/10/2026 trouxe em PRODUCOES-CT-DO-PROJETO.
 */
function projectTables(projeto: XElement, html: string): void {
  const funders = tableRowsOf(html, 'grid2');
  if (funders.length > 0) {
    const box = ensurePath(projeto, ['FINANCIADORES-DO-PROJETO']);
    funders.forEach((cells, i) => {
      const f = blank('FINANCIADOR-DO-PROJETO');
      setAttr(f, 'SEQUENCIA-FINANCIADOR', String(i + 1));
      setAttr(f, 'NOME-INSTITUICAO', cells[0]?.shown ?? '');
      setAttr(f, 'CODIGO-INSTITUICAO', withoutLetter(cells[0]?.value ?? ''));
      setAttr(f, 'NATUREZA', NATURE_OF_FUNDER[cells[3]?.value ?? ''] ?? 'NAO_INFORMADO');
      place(box, f);
    });
  }
  const linked = [...tableRowsOf(html, 'grid3'), ...tableRowsOf(html, 'grid4')];
  if (linked.length > 0) {
    const box = ensurePath(projeto, ['PRODUCOES-CT-DO-PROJETO']);
    for (const cells of linked) {
      const p = blank('PRODUCAO-CT-DO-PROJETO');
      setAttr(p, 'SEQUENCIA-PRODUCAO-CT', cells[0]?.value ?? '');
      setAttr(p, 'TITULO-DA-PRODUCAO-CT', cells[0]?.shown ?? '');
      setAttr(p, 'TIPO-PRODUCAO-CT', cells[2]?.shown ?? '');
      place(box, p);
    }
  }
}

/** Os projetos, cada um na participação em projeto da atuação. */
async function projetos(ctx: LoadContext, byAtiv: Map<string, XElement>): Promise<void> {
  const t = target('projeto');
  const links = rowLinks(listsOf(ctx, t.list.proc), t.list.formProc, t.list.isRow).filter((l) =>
    param(l, 'f_seq_proj'),
  );
  if (links.length === 0) return;
  const pages = await ctx.fetch(links.map((l) => l.path));
  for (const link of links) {
    const html = pages.get(link.path);
    const reading = formIn(ctx, html, link.path, [t.form.name]);
    const atuacao = byAtiv.get(param(link, 'f_seq_ativ'));
    if (!html || !reading?.values || !atuacao) {
      ctx.gap('Projetos', 'o projeto não abriu, ou a atuação dele não foi lida');
      continue;
    }
    const part = activityIn(atuacao, 'PARTICIPACAO-EM-PROJETO', param(link, 'f_seq_funcao'));
    setOrgan(part, reading.values.f_orgao, reading.values.f_codorgao);
    const projeto = blank('PROJETO-DE-PESQUISA');
    setAttr(projeto, 'SEQUENCIA-PROJETO', param(link, 'f_seq_proj'));
    applyReading(t, projeto, reading, { fresh: true });
    readTable(projeto, screenTable(projeto.name), reading.values);
    fillEmptyChoices(t, projeto, reading.values);
    team(projeto, reading.grids?.f_autores_l);
    projectTables(projeto, html);
    place(part, projeto);
  }
  ctx.gap('Projetos', 'o período da participação no projeto, que o formulário não mostra');
}

async function load(ctx: LoadContext): Promise<void> {
  const byAtiv = await atuacoes(ctx);
  await linhas(ctx, byAtiv);
  await projetos(ctx, byAtiv);
}

export const ATUACAO: LoadSection = { id: 'atuacao', load };
