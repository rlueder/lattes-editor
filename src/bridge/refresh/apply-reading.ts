// Um formulário lido (read.ts) aplicado a um item do XML: os campos pela
// especificação do tipo (from-form.ts), as grades de autores, palavras-chave
// e setores, e os ocultos das buscas de instituição, curso e agência. O valor
// que o formulário mostra igual ao do item deixa o item como está, para a
// leitura não trocar a grafia da exportação.
//
// Fica como está, sem leitura: as áreas do conhecimento (a grade traz só o
// nome mais fundo e o código, e montar as quatro partes do XML pede a árvore
// de áreas) e as grades que o conector não monta.

import { foldText } from '../../model/fold-text.ts';
import { emptyAttrs, readKeywords, setKeywords } from '../../model/production.ts';
import { insertInSchemaOrder } from '../../model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../model/xml.ts';
import { lattesSchema } from '../../schema/lattes.ts';
import { decodeHtmlEntities } from '../html-text.ts';
import { AUTHOR_PART, type GridRow } from '../production/grids.ts';
import type { AuthorPart, ProductionTarget } from '../production/types.ts';
import { partOf, writeFields } from './from-form.ts';
import type { FormReading } from './read.ts';

const same = (a: string, b: string) =>
  foldText(decodeHtmlEntities(a).trim()) === foldText(decodeHtmlEntities(b).trim());

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => same(x, b[i]!));

/** As linhas de uma grade com rótulo (o objeto vazio do fim fica de fora). */
const labeled = (rows: readonly GridRow[] = []) =>
  rows.filter((r) => typeof r.l === 'string' && r.l.trim() !== '');

const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

const order = (part: AuthorPart) => (el: XElement) => Number(getAttr(el, part.order) ?? 0);

/**
 * Os autores (ou participantes da banca) pela grade autorProvider: l o nome,
 * t a citação e c o ID CNPq (inferido pela grade que o simulado monta). A
 * mesma lista de nomes, na mesma ordem, deixa os autores como estão.
 */
function applyAuthors(item: XElement, rows: GridRow[], part: AuthorPart): void {
  const current = childElements(item, part.element).sort((a, b) => order(part)(a) - order(part)(b));
  const names = labeled(rows).map((r) => text(r.l));
  const before = current.map((a) => getAttr(a, part.name) ?? '');
  if (sameList(names, before)) return;
  item.children = item.children.filter((c) => c.kind !== 'element' || c.name !== part.element);
  labeled(rows).forEach((row, i) => {
    const kept = current.find((a) => same(getAttr(a, part.name) ?? '', text(row.l)));
    const el = kept
      ? structuredClone(kept)
      : element(part.element, emptyAttrs(lattesSchema, part.element));
    if (!kept) {
      setAttr(el, part.name, decodeHtmlEntities(text(row.l)));
      setAttr(el, part.citation, decodeHtmlEntities(text(row.t)));
      if (el.attrs.some((a) => a.name === part.cnpq)) setAttr(el, part.cnpq, text(row.c));
    }
    setAttr(el, part.order, String(i + 1));
    insertInSchemaOrder(lattesSchema, item, el);
  });
}

const SETOR_ATTRS = ['SETOR-DE-ATIVIDADE-1', 'SETOR-DE-ATIVIDADE-2', 'SETOR-DE-ATIVIDADE-3'];

/** Os setores de atividade pelos rótulos da grade (o XML guarda o rótulo, planSetorList). */
export function applySetores(item: XElement, rows: GridRow[]): void {
  const labels = labeled(rows).map((r) => text(r.l));
  const container = childElements(item, 'SETORES-DE-ATIVIDADE')[0];
  const now = SETOR_ATTRS.map((a) => (container && getAttr(container, a)) ?? '').filter(Boolean);
  if (sameList(labels, now)) return;
  item.children = item.children.filter((c) => c !== container);
  if (labels.length === 0) return;
  const el = element('SETORES-DE-ATIVIDADE', emptyAttrs(lattesSchema, 'SETORES-DE-ATIVIDADE'));
  SETOR_ATTRS.forEach((a, i) => setAttr(el, a, labels[i] ?? ''));
  insertInSchemaOrder(lattesSchema, item, el);
}

/** Um código com a letra da busca (V, D…) sem ela, como o XML guarda. */
const withoutLetter = (code: string) => code.trim().replace(/^[A-Za-z]/, '');

/** Código e nome de uma busca, trocados só quando o código mudou. */
function setPair(
  part: XElement,
  attrs: { code: string; name: string },
  code: string,
  name: string,
) {
  if ((getAttr(part, attrs.code) ?? '') === code) return;
  setAttr(part, attrs.code, code);
  setAttr(part, attrs.name, name);
}

/**
 * Instituição, curso e agência pelos ocultos das buscas (lidos nas páginas de
 * orientação e banca em 18/10/2026): o código com a letra em f_cod_inst ou
 * f_cod_inst2, o nome em f_inst_old; o curso em f_cod_curso ou f_cod_curso2
 * e f_curso_old; a agência em f_agencia e f_nme_agencia.
 */
function applyLookups(t: ProductionTarget, item: XElement, v: Record<string, string>): void {
  const spec = t.lookups;
  if (!spec) return;
  const pick = (a: string, b: string) => (a in v || b in v ? v[a] || v[b] || '' : undefined);
  let part = partOf(item, spec.child);
  const ensure = () => {
    if (!part) {
      part = element(spec.child, emptyAttrs(lattesSchema, spec.child));
      insertInSchemaOrder(lattesSchema, item, part);
    }
    return part;
  };
  const inst = pick('f_cod_inst', 'f_cod_inst2');
  if (inst !== undefined && (inst || part)) {
    setPair(ensure(), spec.institution, withoutLetter(inst), v.f_inst_old ?? v.f_inst ?? '');
  }
  const course = spec.course && pick('f_cod_curso', 'f_cod_curso2');
  if (spec.course && course !== undefined && (course || part)) {
    const name = (v.f_curso_old ?? '').replace(/\s*\([^()]*\)\s*$/, '').trim();
    setPair(ensure(), spec.course, course.trim(), name);
  }
  if (spec.agency && 'f_agencia' in v && (v.f_agencia || part)) {
    setPair(ensure(), spec.agency, v.f_agencia ?? '', v.f_nme_agencia ?? '');
  }
}

/**
 * O formulário lido, aplicado ao item (que muda no lugar). fresh: o item é
 * novo, montado só pelo formulário ("Carregar do Lattes", src/bridge/load/),
 * e todo campo que veio é gravado, vazio também.
 */
export function applyReading(
  t: ProductionTarget,
  item: XElement,
  reading: FormReading,
  { fresh = false } = {},
): void {
  const v = reading.values ?? {};
  writeFields(t, item, (field) => v[field], { keepEquivalent: !fresh });
  const grids = reading.grids ?? {};
  if (t.grids.includes('f_autores_l') && grids.f_autores_l && !t.authors?.container) {
    applyAuthors(item, grids.f_autores_l, t.authors ?? AUTHOR_PART);
  }
  if (t.grids.includes('f_plv_l') && grids.f_plv_l) {
    const words = labeled(grids.f_plv_l).map((r) => decodeHtmlEntities(text(r.l)));
    if (!sameList(words, readKeywords(item))) setKeywords(lattesSchema, item, words);
  }
  if (t.grids.includes('f_setor_l') && grids.f_setor_l) applySetores(item, grids.f_setor_l);
  applyLookups(t, item, v);
  // O identificador do orientando, no oculto f_id_orientado (inferido pelo nome).
  const holder = t.student && partOf(item, t.student.child);
  const id = v.f_id_orientado;
  if (t.student && holder && id !== undefined) {
    const now = getAttr(holder, t.student.idAttr);
    if (now !== id && (now !== undefined || id !== '')) setAttr(holder, t.student.idAttr, id);
  }
}
