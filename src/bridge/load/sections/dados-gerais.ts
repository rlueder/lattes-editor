// Identificação (prc_ident, GN_IDENT), resumo (pkg_resume.prc_resume, RES) e
// outras informações relevantes (prc_outras_inf, GN_OUTRA_INF_RELEV): uma
// página cada, pelo link do menu, de volta para DADOS-GERAIS pelas tabelas com
// que o conector grava (dados-gerais-edit.ts), ao contrário (reverse.ts).
//
// Fora da tabela, pelos campos ocultos que a página traz preenchidos: o nome
// em citações (f_nome_citacao), a nacionalidade (f_nacionalidade, B ou E), o
// CPF e os nomes dos pais (f_cpf, f_nome_pai, f_nome_mae). Inferido: que a
// exportação guarde a cor ou raça pelo nome da opção em maiúsculas (BRANCA) e
// a deficiência pelo rótulo da caixa (observado só "Deficiência Visual").

import { emptyAttrs } from '../../../model/production.ts';
import { firstChild, setAttr, type XElement } from '../../../model/xml.ts';
import { lattesSchema } from '../../../schema/lattes.ts';
import { IDENT_FIELDS } from '../../dados-gerais-edit.ts';
import { countryName } from '../../edit-items.ts';
import { findLinks } from '../../lattes-html.ts';
import { pcdExportOrder } from '../../pcd.ts';
import type { LoadContext, LoadSection } from '../loader.ts';
import { readTable } from '../reverse.ts';
import { ensurePath, formIn } from './common.ts';

const SECTION = 'Dados gerais';

/** Os nomes de opção da cor ou raça, como o conector os aceita (dados-gerais-edit.ts). */
const RACE_LABELS = ['AMARELA', 'BRANCA', 'INDIGENA', 'NAO_DESEJO_DECLARAR', 'PARDA', 'PRETA'];

/** O rótulo de cada caixa de deficiência, pelo código (PCD_LABELS de dados-gerais-edit.ts ao contrário). */
const PCD_NAMES: Record<string, string> = {
  A: 'Deficiência Auditiva',
  E: 'Transtorno do Espectro Autista',
  F: 'Deficiência Física',
  I: 'Deficiência Intelectual',
  M: 'Deficiência Múltipla',
  V: 'Deficiência Visual',
};

/** A página do primeiro link do menu para o procedimento, com o formulário pedido. */
async function menuForm(ctx: LoadContext, proc: string, form: string, label: string) {
  const link = findLinks(ctx.menu, proc)[0];
  if (!link) {
    ctx.gap(SECTION, `o menu não tem ${label}`);
    return undefined;
  }
  const html = await ctx.fetch([link.path]);
  const reading = formIn(ctx, html.get(link.path), link.path, [form]);
  if (!reading?.values) ctx.gap(SECTION, `${label}: o formulário não abriu`);
  return reading;
}

function general(ctx: LoadContext): XElement {
  const existing = firstChild(ctx.root, 'DADOS-GERAIS');
  if (existing) return existing;
  const el = ensurePath(ctx.root, ['DADOS-GERAIS']);
  el.attrs = emptyAttrs(lattesSchema, 'DADOS-GERAIS').map((a) => ({ ...a }));
  return el;
}

function identification(el: XElement, values: Record<string, string>, ctx: LoadContext): void {
  const unread = readTable(el, IDENT_FIELDS, values, { labels: { 'RACA-OU-COR': RACE_LABELS } });
  if (unread.length > 0) ctx.gap(SECTION, `identificação: valor sem opção (${unread.join(', ')})`);
  for (const [field, attr] of [
    ['f_nome_citacao', 'NOME-EM-CITACOES-BIBLIOGRAFICAS'],
    ['f_nacionalidade', 'NACIONALIDADE'],
    ['f_cpf', 'CPF'],
    ['f_nome_pai', 'NOME-DO-PAI'],
    ['f_nome_mae', 'NOME-DA-MAE'],
  ] as const) {
    const v = values[field];
    if (v !== undefined) setAttr(el, attr, v);
  }
  const nation = values.f_pais_nacio;
  if (nation !== undefined) {
    setAttr(el, 'SIGLA-PAIS-NACIONALIDADE', nation);
    setAttr(el, 'PAIS-DE-NACIONALIDADE', nation ? (countryName(nation) ?? '') : '');
  }
  for (const attr of ['DATA-NASCIMENTO', 'DATA-DE-EMISSAO'] as const) {
    const format =
      attr === 'DATA-NASCIMENTO' ? 'FORMATO-DATA-DE-NASCIMENTO' : 'FORMATO-DATA-DE-EMISSAO';
    if (el.attrs.some((a) => a.name === attr && a.value)) setAttr(el, format, 'DDMMAAAA');
  }
  if (values.f_pcd_r === 'S') {
    // As caixas marcadas vêm juntas, por vírgula (refresh/read.ts); a
    // exportação as junta pelo rótulo, com vírgula e espaço, na ordem dos
    // códigos (pcd.ts).
    const names = pcdExportOrder((values.f_pcd ?? '').split(',').filter(Boolean)).map(
      (c) => PCD_NAMES[c],
    );
    if (names.length > 0 && names.every(Boolean)) setAttr(el, 'PCD', names.join(', '));
    else ctx.gap(SECTION, 'identificação: a deficiência marcada não foi reconhecida');
  }
}

/** Um texto só, numa parte de DADOS-GERAIS (RESUMO-CV, OUTRAS-INFORMACOES-RELEVANTES). */
function text(
  el: XElement,
  part: string,
  fields: Record<string, string>,
  values: Record<string, string>,
) {
  const entries = Object.entries(fields).filter(([field]) => values[field]?.trim());
  if (entries.length === 0) return;
  const target = ensurePath(el, [part]);
  for (const [field, attr] of entries) setAttr(target, attr, values[field]!);
}

async function load(ctx: LoadContext): Promise<void> {
  const el = general(ctx);
  const ident = await menuForm(ctx, 'prc_ident', 'GN_IDENT', 'a identificação');
  if (ident?.values) identification(el, ident.values, ctx);
  const resume = await menuForm(ctx, 'pkg_resume.', 'RES', 'o resumo');
  if (resume?.values) {
    text(
      el,
      'RESUMO-CV',
      { F_TEXTO: 'TEXTO-RESUMO-CV-RH', F_TEXTO_EN: 'TEXTO-RESUMO-CV-RH-EN' },
      resume.values,
    );
  }
  const others = await menuForm(
    ctx,
    'prc_outras_inf',
    'GN_OUTRA_INF_RELEV',
    'as outras informações relevantes',
  );
  if (others?.values) {
    text(
      el,
      'OUTRAS-INFORMACOES-RELEVANTES',
      { F_TEXTO: 'OUTRAS-INFORMACOES-RELEVANTES' },
      others.values,
    );
  }
}

export const DADOS_GERAIS: LoadSection = { id: 'dados-gerais', load };
