// Formação acadêmica e titulação (pkg_formacao.lista com f_tipo FA e AP,
// pkg_formacao.form, GN_FORMACAO2): o tipo do item pelo f_nivel oculto, que é
// o NIVEL da exportação (observado no mestrado, na graduação e no curso
// técnico; inferido nos outros níveis), os campos pela tabela do conector
// (formacao-edit.ts) ao contrário, e instituição, curso e agência pelos
// ocultos que as buscas preenchem (formacao-lookups.ts): o código com a letra
// da busca em f_cod_inst ou f_cod_inst2, sem ela no XML.

import { emptyAttrs } from '../../../model/production.ts';
import { element, setAttr, type XElement } from '../../../model/xml.ts';
import { lattesSchema } from '../../../schema/lattes.ts';
import { AP_LEVELS, FORMATION_LEVELS } from '../../create-formacao.ts';
import { FORMACAO_FIELDS } from '../../formacao-edit.ts';
import { parseAreaTree } from '../../lattes-lists.ts';
import { applyItemGrids } from '../grids.ts';
import type { LoadContext, LoadSection } from '../loader.ts';
import { readTable } from '../reverse.ts';
import { ensurePath, formIn, listsOf, place, rowLinks } from './common.ts';

const SECTION = 'Formação acadêmica';

const ELEMENT_OF: Record<string, string> = Object.fromEntries(
  Object.entries({ ...FORMATION_LEVELS, ...AP_LEVELS }).map(([el, code]) => [code, el]),
);

/** As opções de STATUS-DO-CURSO, para os níveis em que o XSD não as enumera. */
const STATUS = ['CONCLUIDO', 'EM_ANDAMENTO', 'INCOMPLETO'];

const withoutLetter = (code: string) => code.trim().replace(/^[A-Za-z]/, '');

/** Código e nome de uma busca, nos atributos que o elemento tem. */
function setLookup(el: XElement, pairs: [string, string | undefined][]): void {
  const own = new Set(lattesSchema.elements[el.name]?.attributes.map((a) => a.name));
  for (const [attr, value] of pairs) {
    if (own.has(attr) && value !== undefined) setAttr(el, attr, value);
  }
}

export function lookups(el: XElement, v: Record<string, string>): void {
  const code = (a: string, b: string) =>
    a in v || b in v ? withoutLetter(v[a] || v[b] || '') : undefined;
  setLookup(el, [
    ['CODIGO-INSTITUICAO', code('f_cod_inst', 'f_cod_inst2')],
    // O nome gravado está no oculto *_old (observado na passada de edição do
    // censo); o campo visível pode trazer o texto da opção da busca.
    ['NOME-INSTITUICAO', v.f_inst_old ?? v.f_inst],
    // O curso vai sem letra (formacao-lookups.ts); o nome sem o código CAPES.
    ['CODIGO-CURSO', v.f_cod_curso || v.f_cod_curso2 || undefined],
    ['NOME-CURSO', v.f_curso_old ?? v.f_curso?.replace(/\s*\([^()]*\)\s*$/, '').trim()],
    ['CODIGO-AGENCIA-FINANCIADORA', v.f_agencia],
    ['NOME-AGENCIA', v.f_nme_agencia],
  ]);
  // O doutorado e a graduação de antes, no bloco do sanduíche (f_inst_dout).
  const dout = code('f_cod_inst_dout', 'f_cod_inst2_dout');
  setLookup(el, [
    ['CODIGO-INSTITUICAO-DOUT', dout],
    ['CODIGO-INSTITUICAO-GRAD', dout],
    ['NOME-INSTITUICAO-DOUT', v.f_inst_dout],
    ['NOME-INSTITUICAO-GRAD', v.f_inst_dout],
  ]);
}

async function load(ctx: LoadContext): Promise<void> {
  const tree = parseAreaTree(ctx.menu) ?? [];
  const links = rowLinks(listsOf(ctx, 'pkg_formacao.lista'), 'pkg_formacao.form');
  if (links.length === 0) return;
  const pages = await ctx.fetch(links.map((l) => l.path));
  for (const link of links) {
    const reading = formIn(ctx, pages.get(link.path), link.path, ['GN_FORMACAO2']);
    const v = reading?.values;
    if (!reading || !v) {
      ctx.gap(SECTION, 'o formulário do item não abriu');
      continue;
    }
    const name = ELEMENT_OF[v.f_nivel ?? ''];
    if (!name) {
      ctx.gap(SECTION, 'o nível do item não foi reconhecido');
      continue;
    }
    const el = element(name, emptyAttrs(lattesSchema, name));
    setAttr(el, 'SEQUENCIA-FORMACAO', v.f_seq || link.params.f_seq || '');
    setAttr(el, 'NIVEL', v.f_nivel ?? '');
    const unread = readTable(el, FORMACAO_FIELDS, v, { labels: { 'STATUS-DO-CURSO': STATUS } });
    if (unread.length > 0) ctx.gap(SECTION, `valor sem opção (${unread.join(', ')})`);
    lookups(el, v);
    const outside = applyItemGrids(el, reading.grids ?? {}, tree);
    if (outside.length > 0)
      ctx.gap(SECTION, 'área fora da árvore de áreas do Lattes', outside.length);
    place(ensurePath(ctx.root, ['DADOS-GERAIS', 'FORMACAO-ACADEMICA-TITULACAO']), el);
  }
}

export const FORMACAO: LoadSection = { id: 'formacao', load };
