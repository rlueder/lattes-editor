// As listas de DADOS-GERAIS com um formulário por linha: idiomas
// (pkg_idioma.lista, GN_IDIOMA) e prêmios e títulos (pkg_premio.lista,
// GN_PREMIO). Cada linha abre o formulário de alteração, que volta ao XML
// pelas tabelas do conector (idioma-skills.ts, edit-lists.ts), ao contrário.

import { emptyAttrs } from '../../../model/production.ts';
import { element, setAttr, type XElement } from '../../../model/xml.ts';
import { lattesSchema } from '../../../schema/lattes.ts';
import { screenTable } from '../../../schema/screen-fields.ts';
import { listEditFields } from '../../edit-lists.ts';
import { IDIOMA_SKILLS, LEVEL } from '../../idioma-skills.ts';
import type { FormReading } from '../../refresh/read.ts';
import type { LoadContext, LoadSection } from '../loader.ts';
import { readTable } from '../reverse.ts';
import { ensurePath, formIn, listsOf, place, rowLinks } from './common.ts';
import { schemaPath } from './schema-path.ts';

export interface ListSpec {
  element: string;
  /** Os valores da página no item novo; o HTML da página para o que não é campo. */
  fill(
    el: XElement,
    reading: FormReading & { values: Record<string, string> },
    html: string,
    ctx: LoadContext,
  ): void;
  form: string;
  formProc: string;
  list: string;
  section: string;
}

/** Um item por linha das listas do procedimento, na ordem da lista. */
export async function loadList(ctx: LoadContext, spec: ListSpec): Promise<void> {
  const links = rowLinks(listsOf(ctx, spec.list), spec.formProc);
  if (links.length === 0) return;
  const path = schemaPath(spec.element);
  if (!path) return;
  const pages = await ctx.fetch(links.map((l) => l.path));
  for (const link of links) {
    const html = pages.get(link.path);
    const reading = formIn(ctx, html, link.path, [spec.form]);
    if (!html || !reading?.values) {
      ctx.gap(spec.section, 'o formulário do item não abriu');
      continue;
    }
    const el = element(spec.element, emptyAttrs(lattesSchema, spec.element));
    spec.fill(el, { ...reading, values: reading.values }, html, ctx);
    // A visibilidade e os outros campos só de tela (schema/screen-fields.ts).
    readTable(el, screenTable(el.name), reading.values);
    place(ensurePath(ctx.root, path), el);
  }
}

/** O texto da opção escolhida de uma lista, como a página a mostra. */
export function selectedLabel(html: string, name: string): string | undefined {
  const select = new RegExp(`<select[^>]*name="?${name}"?[^>]*>([\\s\\S]*?)</select>`, 'i').exec(
    html,
  );
  if (!select) return undefined;
  const option = /<option[^>]*\bselected\b[^>]*>([^<]*)/i.exec(select[1]!);
  return option?.[1]?.trim();
}

const LEVEL_OF = Object.fromEntries(Object.entries(LEVEL).map(([xml, form]) => [form, xml]));

const IDIOMAS: ListSpec = {
  element: 'IDIOMA',
  fill(el, { values }, html) {
    const code = values.F_COD_IDIOMA ?? '';
    setAttr(el, 'IDIOMA', code);
    setAttr(el, 'DESCRICAO-DO-IDIOMA', selectedLabel(html, 'F_COD_IDIOMA') ?? '');
    // A caixa FC_* desmarcada é a habilidade não informada, seja qual for o rádio.
    for (const [attr, skill] of Object.entries(IDIOMA_SKILLS)) {
      const level = values[`FC_${skill}`] ? LEVEL_OF[values[`F_${skill}`] ?? ''] : undefined;
      setAttr(el, attr, level ?? 'NAO_INFORMADO');
    }
  },
  form: 'GN_IDIOMA',
  formProc: 'pkg_idioma.form',
  list: 'pkg_idioma.lista',
  section: 'Idiomas',
};

const PREMIOS: ListSpec = {
  element: 'PREMIO-TITULO',
  fill(el, { values }, _html, ctx) {
    const unread = readTable(el, listEditFields('premio'), values);
    if (unread.length > 0) ctx.gap('Prêmios e títulos', `valor sem opção (${unread.join(', ')})`);
  },
  form: 'GN_PREMIO',
  formProc: 'pkg_premio.form',
  list: 'pkg_premio.lista',
  section: 'Prêmios e títulos',
};

export const LISTAS: LoadSection = {
  id: 'listas',
  async load(ctx) {
    await loadList(ctx, IDIOMAS);
    await loadList(ctx, PREMIOS);
  },
};
