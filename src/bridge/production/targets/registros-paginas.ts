// O que as páginas de patentes e registros montam no check() antes do envio,
// e que o conector monta igual a partir da página lida (lido em 19/10/2026 no
// Lattes real, na edição de itens de teste de cada tipo): as datas da patente
// na grade de situações, o ano que algumas páginas tiram da data e o ambiente
// do programa de computador. Usado por registros.ts.

import { PATENT_DATE_CODES } from '../../create-registro-rules.ts';
import { array2xml } from '../../endereco-contatos.ts';
import { readProvider } from '../grids.ts';

/** As linhas da grade de situações da patente, como a página as escreve (id: 01, sem aspas). */
function readDateRows(html: string): Record<string, string>[] | undefined {
  const m = /var\s+providerContatos\s*=\s*\[([\s\S]*?)\];/.exec(html);
  if (!m) return undefined;
  const rows: Record<string, string>[] = [];
  for (const block of m[1]!.split(/\}\s*,?/)) {
    const id = /\bid\s*:\s*(\d+)/.exec(block)?.[1];
    if (id === undefined) continue;
    const text = (key: string) => new RegExp(`\\b${key}\\s*:\\s*"([^"]*)"`).exec(block)?.[1] ?? '';
    // As chaves na ordem da página; o id é número no JavaScript dela (01 → 1).
    rows.push(
      Object.fromEntries([
        ['id', String(Number(id))],
        ['contato', text('contato')],
        ['endereco', text('endereco')],
        ['editable', 'true'],
        ['deletable', 'true'],
      ]),
    );
  }
  return rows;
}

export const dateKey = (code: string) => `datas:${code}`;

/** Os campos virtuais das datas da patente: datas:1 é o depósito, e assim por diante. */
export const PATENT_DATES = {
  build(html: string, set: Record<string, string>) {
    const rows = readDateRows(html);
    if (!rows) return undefined;
    for (const [key, value] of Object.entries(set)) {
      const code = key.slice('datas:'.length);
      const at = rows.findIndex((r) => r.id === code);
      const contato = Object.values(PATENT_DATE_CODES).find(([c]) => c === code)?.[1] ?? '';
      if (!value) {
        if (at >= 0) rows.splice(at, 1);
      } else if (at >= 0) rows[at]!.endereco = value;
      else {
        rows.push(
          Object.fromEntries([
            ['id', code],
            ['contato', contato],
            ['endereco', value],
            ['editable', 'true'],
            ['deletable', 'true'],
          ]),
        );
      }
    }
    // O check() tira o ano do depósito ou do PCT, o que vier antes.
    const year = (code: string) => rows.find((r) => r.id === code)?.endereco?.slice(6, 10);
    const years = [year('1'), year('2')].filter((y): y is string => !!y);
    const xml = array2xml([...rows, {}]).replace('Não se Aplica', '');
    return {
      f_dados_grid_datas: xml,
      ...(years.length > 0 ? { f_ano: years.sort()[0]! } : {}),
    };
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
export function yearFromDate(html: string, set: Record<string, string>): Record<string, string> {
  if (!/^\s*dc\.f_ano\.value\s*=\s*anoDep;/m.test(html)) return {};
  const shown = /name="f_dta_dep"[^>]*value="([^"]*)"/i.exec(html)?.[1] ?? '';
  const date = set.f_dta_dep ?? shown;
  return date ? { f_ano: date.slice(6, 10) } : {};
}

/** As datas da patente como a página as manda, quando a alteração não mexe nelas. */
export const patentBuilt = (html: string) => {
  const built = PATENT_DATES.build(html, {});
  return built && { f_dados_grid_datas: built.f_dados_grid_datas };
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
  return { f_ambiente: s.slice(0, -1), ...yearFromDate(html, set) };
}
