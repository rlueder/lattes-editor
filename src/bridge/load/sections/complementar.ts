// Formação complementar (pkg_formacao_compl.lista, PKG_FORMACAO_COMPL.form,
// GN_FORMACAO2), em dois passos como a página: o formulário de edição traz o
// nível, a instituição, o curso, a carga horária e a situação; o resto (anos,
// bolsa, agência, monografia, orientador e as grades) está no segundo
// formulário, que só abre pelo POST de leitura do primeiro, com o f_ctr vazio
// (pages.ts; formacao-compl-steps.ts). Os campos voltam ao XML pela tabela do
// conector (edit-lists.ts) ao contrário.

import { emptyAttrs } from '../../../model/production.ts';
import { element, setAttr } from '../../../model/xml.ts';
import { lattesSchema } from '../../../schema/lattes.ts';
import { COMPL_LEVELS, listEditFields } from '../../edit-lists.ts';
import { encodeLatin1Form, successfulPairs, withScriptValues } from '../../form.ts';
import { parseAreaTree } from '../../lattes-lists.ts';
import { applyItemGrids } from '../grids.ts';
import type { LoadContext, LoadSection } from '../loader.ts';
import { pageKey } from '../pages.ts';
import { readTable } from '../reverse.ts';
import { ensurePath, formIn, listsOf, place, rowLinks } from './common.ts';
import { lookups } from './formacao.ts';

const SECTION = 'Formação complementar';
const FORM = 'GN_FORMACAO2';
const STEP2 = 'PKG_FORMACAO_COMPL.FORM2';
const STATUS = ['CONCLUIDO', 'EM_ANDAMENTO', 'INCOMPLETO'];

const ELEMENT_OF = Object.fromEntries(Object.entries(COMPL_LEVELS).map(([el, c]) => [c, el]));

async function load(ctx: LoadContext): Promise<void> {
  const tree = parseAreaTree(ctx.menu) ?? [];
  const links = rowLinks(listsOf(ctx, 'pkg_formacao_compl.lista'), 'pkg_formacao_compl.form');
  if (links.length === 0) return;
  const pages = await ctx.fetch(links.map((l) => l.path));
  const items = links.flatMap((link) => {
    const html = pages.get(link.path);
    const reading = formIn(ctx, html, link.path, [FORM]);
    const controls = html ? withScriptValues(html, ctx.readForm(html, FORM)) : undefined;
    if (!reading?.values || !controls) {
      ctx.gap(SECTION, 'o formulário do item não abriu');
      return [];
    }
    // O segundo passo, pelo envio que a página faria com o f_ctr vazio.
    const body = encodeLatin1Form(successfulPairs(controls));
    return [{ link, step2: { body, path: STEP2 }, values: reading.values }];
  });
  const second = await ctx.fetch(items.map((i) => i.step2));
  const container = ensurePath(ctx.root, ['DADOS-COMPLEMENTARES', 'FORMACAO-COMPLEMENTAR']);
  for (const { link, step2, values } of items) {
    const name = ELEMENT_OF[values.f_nivel ?? ''];
    if (!name) {
      ctx.gap(SECTION, 'o nível do item não foi reconhecido');
      continue;
    }
    const el = element(name, emptyAttrs(lattesSchema, name));
    setAttr(el, 'SEQUENCIA-FORMACAO', values.f_seq || link.params.f_seq || '');
    setAttr(el, 'NIVEL', values.f_nivel ?? '');
    lookups(el, values);
    const fields = listEditFields('formacao-complementar');
    const labels = { labels: { 'STATUS-DO-CURSO': STATUS } };
    const unread = readTable(el, fields, values, labels);
    const html = second.get(pageKey(step2));
    const next = html ? formIn(ctx, html, link.path, [FORM]) : undefined;
    if (next?.values) {
      unread.push(...readTable(el, fields, next.values, labels));
      // A agência: o código no oculto f_agencia, o nome no campo desabilitado.
      if (next.values.f_agencia !== undefined && el.attrs.some((a) => a.name === 'NOME-AGENCIA')) {
        setAttr(el, 'CODIGO-AGENCIA-FINANCIADORA', next.values.f_agencia);
        setAttr(el, 'NOME-AGENCIA', next.values.f_nme_agencia ?? '');
      }
      const outside = applyItemGrids(el, next.grids ?? {}, tree);
      if (outside.length > 0)
        ctx.gap(SECTION, 'área fora da árvore de áreas do Lattes', outside.length);
    } else ctx.gap(SECTION, 'o segundo formulário (anos, bolsa, orientador) não abriu');
    if (unread.length > 0) ctx.gap(SECTION, `valor sem opção (${[...new Set(unread)].join(', ')})`);
    place(container, el);
  }
}

export const COMPLEMENTAR: LoadSection = { id: 'complementar', load };
