// O que a página de uma patente ou registro mostra em grades, de volta para o
// XML (docs/lattes_internals.md, seção 17; registros.ts):
//
// - os depositantes ou titulares (titularPessoaProvider, titularInstProvider):
//   a exportação de 20/10/2026 guardou a pessoa em NOME-DO-DEPOSITANTE, e a de
//   27/10/2026 pôs ali também a instituição titular. Como ela junta mais de um
//   depositante não foi visto: vai o primeiro, e os outros ficam no que não
//   foi lido. A cópia que a exportação faz do depositante nos AUTORES não
//   entra: a página não a mostra entre os autores.
// - as datas da patente (providerContatos: contato é a situação, endereco a
//   data): cada linha é um HISTORICO-SITUACOES-PATENTE e a data do
//   REGISTRO-OU-PATENTE da mesma situação (PATENT_DATE_CODES), como na
//   exportação de 20/10/2026. STATUS-SITUACAO-PATENTE veio "SIM" ali, com o
//   sentido não visto; vai "SIM".

import { patentDateAttrOf } from '../../model/patent-dates.ts';
import { emptyAttrs } from '../../model/production.ts';
import { element, setAttr, type XElement } from '../../model/xml.ts';
import { lattesSchema } from '../../schema/lattes.ts';
import { decodeHtmlEntities } from '../html-text.ts';
import { readProvider } from '../production/grids.ts';
import type { ProductionTarget } from '../production/types.ts';
import { ensurePart, schemaPathWithin } from '../refresh/from-form.ts';
import { ensurePath, place } from './sections/common.ts';

const REG = 'REGISTRO-OU-PATENTE';
const HISTORY = 'HISTORICO-SITUACOES-PATENTE';

const named = (rows: ReturnType<typeof readProvider>) =>
  (rows ?? []).filter((r) => typeof r.l === 'string' && String(r.l).trim());

/** Os depositantes; devolve quantos ficaram de fora. */
export function readHolders(t: ProductionTarget, item: XElement, html: string): number {
  if (!t.holders) return 0;
  const people = named(readProvider(html, 'titularPessoaProvider'));
  const institutions = named(readProvider(html, 'titularInstProvider'));
  const all = [...people, ...institutions].map((r) => decodeHtmlEntities(String(r.l)).trim());
  if (all.length === 0) return 0;
  setAttr(ensurePart(item, t.holders.child), t.holders.attr, all[0]!);
  return all.length - 1;
}

const toXmlDate = (v: string) => v.trim().replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$1$2$3');

/** As situações e datas da patente; devolve as situações sem data conhecida. */
export function readPatentDates(item: XElement, html: string): string[] {
  const rows = (readProvider(html, 'providerContatos') ?? []).filter(
    (r) => typeof r.contato === 'string' && String(r.contato).trim(),
  );
  const unknown: string[] = [];
  for (const r of rows) {
    const label = decodeHtmlEntities(String(r.contato)).trim();
    const date = toXmlDate(String(r.endereco ?? ''));
    const history = element(HISTORY, emptyAttrs(lattesSchema, HISTORY));
    setAttr(history, 'DESCRICAO-SITUACAO-PATENTE', label);
    setAttr(history, 'DATA-SITUACAO-PATENTE', date);
    setAttr(history, 'STATUS-SITUACAO-PATENTE', 'SIM');
    place(ensurePath(item, schemaPathWithin(item.name, HISTORY) ?? []), history);
    const reg = ensurePart(item, REG);
    const attr = patentDateAttrOf(label);
    if (attr) setAttr(reg, attr, date);
    else unknown.push(label);
  }
  return unknown;
}
