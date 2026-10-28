// Endereço (prc_endereco, GN_ENDERECO): o profissional (_i) e o residencial
// (_r) pela tabela com que o conector grava (dados-gerais-edit.ts), o endereço
// de correspondência pelo rádio f_end_corr, a instituição e o órgão do
// profissional pelos campos que a busca preenche, e os contatos pelas duas
// grades da página (provider, providerContatos; endereco-contatos.ts).
//
// Inferidos: o código da instituição em f_cod_inst ou f_cod_inst2 na página
// (endereco-buscas.ts); o ELETRONICO montado dos dois e-mails com a letra do
// sufixo (I: o profissional, R: o residencial; model/contacts.ts); e o número
// de cada rede em REDE-SOCIAL, que a página não mostra e aqui é o id do tipo
// de rede da linha.

import { childElements, getAttr, setAttr, type XElement } from '../../../model/xml.ts';
import {
  ENDERECO_FIELDS,
  ENDERECO_STREET,
  ENDERECO_SUFFIX,
  PREFERENCE,
} from '../../dados-gerais-edit.ts';
import { readContactGrids } from '../../endereco-contatos.ts';
import { findLinks } from '../../lattes-html.ts';
import type { GridRow } from '../../production/grids.ts';
import type { LoadContext, LoadSection } from '../loader.ts';
import { readTable } from '../reverse.ts';
import { ensurePath, formIn } from './common.ts';

const SECTION = 'Endereço';

const same = (v: string) => v;

/** As linhas de uma grade de contato no formato da exportação (model/contacts.ts). */
function contactText(rows: readonly GridRow[], nameKey: string): string {
  return rows
    .filter((r) => r.id !== undefined && r.id !== '')
    .map(
      (r) =>
        `ID Rede Social: ${String(r.id)}, Nome Rede Social: ${String(r[nameKey] ?? '')}, Endereço: ${String(r.endereco ?? '')}`,
    )
    .join('');
}

function address(holder: XElement, name: string, values: Record<string, string>, ctx: LoadContext) {
  const suffix = ENDERECO_SUFFIX[name]!;
  const table = { ...ENDERECO_FIELDS, [ENDERECO_STREET[name]!]: ['f_rua', same] as const };
  // Bloco sem nenhum campo preenchido fica de fora, como na exportação.
  const filled = Object.values(table).some(([field]) => values[`${field}${suffix}`]?.trim());
  if (!filled) return undefined;
  const el = ensurePath(holder, [name]);
  const unread = readTable(el, table, values, { suffix });
  // A página mostra o CEP com o traço (99999-999); a exportação o guarda só com
  // os dígitos (observado em 28/10/2026).
  const cep = getAttr(el, 'CEP') ?? '';
  if (/^\d{5}-\d{3}$/.test(cep)) setAttr(el, 'CEP', cep.replace('-', ''));
  if (unread.length > 0) ctx.gap(SECTION, `valor sem opção (${unread.join(', ')})`);
  return el;
}

async function load(ctx: LoadContext): Promise<void> {
  const link = findLinks(ctx.menu, 'prc_endereco')[0];
  if (!link) {
    ctx.gap(SECTION, 'o menu não tem o endereço');
    return;
  }
  const html = (await ctx.fetch([link.path])).get(link.path);
  const reading = formIn(ctx, html, link.path, ['GN_ENDERECO']);
  if (!html || !reading?.values) {
    ctx.gap(SECTION, 'o formulário não abriu');
    return;
  }
  const values = reading.values;
  const general = ensurePath(ctx.root, ['DADOS-GERAIS']);
  const holder = ensurePath(general, ['ENDERECO']);
  const professional = address(holder, 'ENDERECO-PROFISSIONAL', values, ctx);
  address(holder, 'ENDERECO-RESIDENCIAL', values, ctx);
  if (professional) {
    const institution = values.f_inst ?? values.f_inst_old ?? '';
    if (institution) setAttr(professional, 'NOME-INSTITUICAO-EMPRESA', institution);
    const code = values.f_cod_inst || values.f_cod_inst2 || '';
    if (code) setAttr(professional, 'CODIGO-INSTITUICAO-EMPRESA', code);
    if (values.f_orgao) setAttr(professional, 'NOME-ORGAO', values.f_orgao);
  }
  readTable(holder, PREFERENCE, values);
  const emails = (
    [
      ['I', 'ENDERECO-PROFISSIONAL'],
      ['R', 'ENDERECO-RESIDENCIAL'],
    ] as const
  )
    .map(([letter, name]) => {
      const el = childElements(holder, name)[0];
      const email = el ? (getAttr(el, 'E-MAIL') ?? '') : '';
      return email ? `${letter}: ${email}` : '';
    })
    .filter(Boolean);
  if (emails.length > 0) setAttr(holder, 'ELETRONICO', emails.join(', '));
  const grids = readContactGrids(html);
  if (!grids) {
    ctx.gap(SECTION, 'as grades de redes sociais e outros contatos não vieram na página');
    return;
  }
  const social = contactText(grids.social, 'redeSocial');
  if (social) setAttr(holder, 'REDE-SOCIAL', social);
  const others = contactText(grids.contacts, 'contato');
  if (others) setAttr(holder, 'OUTRA-FORMA-DE-CONTATO', others);
}

export const ENDERECO: LoadSection = { id: 'endereco', load };
