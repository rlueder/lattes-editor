// O que as páginas de patentes e registros montam no check() antes do envio,
// e que o conector monta igual a partir da página lida (lido em 19/10/2026 no
// Lattes real, na edição de itens de teste de cada tipo): as datas da patente
// na grade de situações, o ano que algumas páginas tiram da data e o ambiente
// do programa de computador. Usado por registros.ts.

import { PATENT_DATE_CODES } from '../../create-registro-rules.ts';
import { array2xml } from '../../endereco-contatos.ts';
import { readProvider } from '../grids.ts';
import type { ProductionTarget } from '../types.ts';

/** As linhas da grade de situações da patente, como a página as escreve (id: 01, sem aspas). */
function readDateRows(html: string): Record<string, string>[] | undefined {
  const m = /var\s+providerContatos\s*=\s*\[([\s\S]*?)\];/.exec(html);
  if (!m) return undefined;
  const rows: Record<string, string>[] = [];
  for (const block of m[1]!.split(/\}\s*,?/)) {
    const id = /\bid\s*:\s*(\d+)/.exec(block)?.[1];
    if (id === undefined) continue;
    const text = (key: string) => new RegExp(`\\b${key}\\s*:\\s*"([^"]*)"`).exec(block)?.[1] ?? '';
    // A página esconde a lixeira da linha com deletable "false" (menos a 3,
    // lido em 26/10/2026); sem a chave, a linha se exclui.
    const flag = (key: string) =>
      new RegExp(`\\b${key}"?\\s*:\\s*"?(true|false)\\b`).exec(block)?.[1] ?? 'true';
    // As chaves na ordem da página; o id é número no JavaScript dela (01 → 1).
    rows.push(
      Object.fromEntries([
        ['id', String(Number(id))],
        ['contato', text('contato')],
        ['endereco', text('endereco')],
        ['editable', flag('editable')],
        ['deletable', flag('deletable')],
      ]),
    );
  }
  return rows;
}

export const dateKey = (code: string) => `datas:${code}`;

/** Os campos virtuais das datas da patente: datas:1 é o depósito, e assim por diante. */
export const PATENT_DATES = {
  build(
    html: string,
    set: Record<string, string>,
  ): Record<string, string> | { reason: string } | undefined {
    const rows = readDateRows(html);
    if (!rows) return undefined;
    for (const [key, value] of Object.entries(set)) {
      const code = key.slice('datas:'.length);
      const at = rows.findIndex((r) => r.id === code);
      const contato = Object.values(PATENT_DATE_CODES).find(([c]) => c === code)?.[1] ?? '';
      if (!value) {
        if (at >= 0 && rows[at]!.deletable === 'false' && code !== '3') {
          return {
            reason: `A situação "${rows[at]!.contato}" da patente não pode ser excluída no Lattes`,
          };
        }
        if (at >= 0) rows.splice(at, 1);
      } else if (at >= 0) rows[at]!.endereco = value;
      else {
        // O "Incluir nova" da página põe a linha no começo, só com as três
        // chaves (unshift, lido em 26/10/2026).
        rows.unshift(
          Object.fromEntries([
            ['id', code],
            ['contato', contato],
            ['endereco', value],
          ]),
        );
      }
    }
    // O check() tira o ano do depósito ou do PCT, o que vier antes.
    const year = (code: string) => rows.find((r) => r.id === code)?.endereco?.slice(6, 10);
    const years = [year('1'), year('2')].filter((y): y is string => !!y);
    const xml = array2xml([...rows, {}]).replace('Não se Aplica', '');
    const out: Record<string, string> = { f_dados_grid_datas: xml };
    if (years.length > 0) out.f_ano = years.sort()[0]!;
    return out;
  },
  read(html: string) {
    const rows = readDateRows(html);
    if (!rows) return undefined;
    return Object.fromEntries(
      Object.values(PATENT_DATE_CODES).map(([code]) => [
        dateKey(code),
        rows.find((r) => r.id === code)?.endereco ?? '',
      ]),
    );
  },
};

/**
 * O ano que o check() tira da data do registro: no desenho industrial, no
 * programa de computador com registro e na cultivar protegida a página põe
 * em f_ano o ano de f_dta_dep antes de enviar (dc.f_ano.value = anoDep, lido
 * em 19/10/2026); sem isso o Lattes não grava nada. Nos outros tipos, o ano
 * vai como está.
 */
export function yearFromDate(
  html: string,
  set: Record<string, string>,
): Record<string, string> | undefined {
  if (!/^\s*dc\.f_ano\.value\s*=\s*anoDep;/m.test(html)) return {};
  // O campo em qualquer ordem de atributos; sem a data o ano não sai, e o
  // Lattes não gravaria nada: nada vai (undefined).
  const tag = /<input\b[^>]*\bname\s*=\s*["']?f_dta_dep\b[^>]*>/i.exec(html)?.[0] ?? '';
  const shown = /\bvalue\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
  const year = (set.f_dta_dep ?? shown).slice(6, 10);
  return /^\d{4}$/.test(year) ? { f_ano: year } : undefined;
}

/** As datas da patente como a página as manda, quando a alteração não mexe nelas. */
export const patentBuilt = (html: string) => {
  const built = PATENT_DATES.build(html, {});
  if (!built || 'reason' in built) return undefined;
  return { f_dados_grid_datas: built.f_dados_grid_datas! };
};

/**
 * O ambiente do programa de computador, como o check() da página o monta de
 * programaProvider (o c de cada linha, um "|" entre elas e o último
 * caractere cortado: copiado da página, com o corte).
 */
export function softwareBuilt(
  html: string,
  set: Record<string, string>,
): Record<string, string> | undefined {
  const rows = readProvider(html, 'programaProvider');
  if (!rows) return undefined;
  let s = '';
  let cn = 0;
  for (const row of rows) {
    if (cn > 1) s += '|';
    for (const [k, v] of Object.entries(row)) {
      if (k === 'c') s += String(v);
      cn++;
    }
  }
  const year = yearFromDate(html, set);
  return year && { f_ambiente: s.slice(0, -1), ...year };
}

/** O campo virtual do ambiente: as linhas de programaProvider, não um controle da página. */
export const AMBIENTE_FIELD = 'ambiente:programa';

/** O programaNumMaxRegistros da página (lido em 27/10/2026). */
const MAX_PROGRAM_TYPES = 3;

/**
 * O ambiente do programa de computador como campo virtual. A exportação de
 * 27/10/2026 trouxe AMBIENTE="Aplicativos|Automação bancária": os c das
 * linhas de programaProvider, unidos por "|", o mesmo que o check() manda em
 * f_ambiente. Cada tipo novo precisa estar no programaDP da página.
 */
export const SOFTWARE_AMBIENTE: NonNullable<ProductionTarget['virtual']> = {
  build(html, set) {
    const wanted = (set[AMBIENTE_FIELD] ?? '')
      .split('|')
      .map((v) => v.trim())
      .filter(Boolean);
    const fail = (reason: string): { reason: string } => ({ reason });
    if (wanted.length === 0) return fail('O Lattes exige ao menos um tipo de programa');
    if (wanted.length > MAX_PROGRAM_TYPES) {
      return fail(`O Lattes aceita até ${MAX_PROGRAM_TYPES} tipos de programa`);
    }
    const known = readProvider(html, 'programaDP');
    if (!known) return undefined;
    const fold = (v: unknown) =>
      String(v ?? '')
        .trim()
        .toLowerCase();
    const missing = wanted.filter((w) => !known.some((k) => fold(k.c) === fold(w)));
    if (missing.length > 0) {
      return fail(`Tipo de programa fora da lista do Lattes: ${missing.join(', ')}`);
    }
    const built: Record<string, string> = { f_ambiente: wanted.join('|') };
    return built;
  },
  read(html) {
    const rows = readProvider(html, 'programaProvider');
    if (!rows) return undefined;
    const values = rows.map((r) => String(r.c ?? '')).filter(Boolean);
    return { [AMBIENTE_FIELD]: values.join('|') };
  },
};
