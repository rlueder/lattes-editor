// As grades de patentes e registros no Lattes simulado, na edição de um item
// (lido em 19/10/2026 no Lattes real, com itens de teste de cada tipo): as
// quatro de produção (grades.ts), os depositantes ou titulares
// (titularPessoaProvider, titularInstProvider) e, na patente, as datas na
// grade de situações (providerContatos, com o id sem aspas e com zero à
// esquerda, como a página escreve).
//
// Inferido, como em grades.ts: que o servidor grave cada grade como chegou no
// oculto. Um envio com a grade de depositantes vazia apaga os depositantes,
// e é isso que o teste do conector precisa ver acontecer quando o envio erra.

import { PATENT_DATE_CODES } from '../../src/bridge/create-registro-rules.ts';
import { childElements, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { applyGrids, gridScripts } from './grades.ts';
import type { SimRequest } from './pedido.ts';

type Row = Record<string, string | boolean>;

/** Os depositantes de cada item: o XML do simulado não guarda a grade. */
const holders = new WeakMap<XElement, { inst: Row[]; pessoa: Row[] }>();

const holdersOf = (item: XElement) => {
  let h = holders.get(item);
  if (!h) {
    h = { inst: [], pessoa: [] };
    holders.set(item, h);
  }
  return h;
};

/** Um depositante pessoa como a página o traz (entrada do dicionário: l, c, t). */
export function seedHolder(item: XElement, name: string, citation: string, code: string): void {
  holdersOf(item).pessoa = [
    Object.fromEntries([
      ['l', name],
      ['c', code],
      ['t', citation],
      ['editable', false],
      ['deletable', true],
      ['staValidado', 'N'],
    ]),
  ];
}

/** Os nomes dos depositantes pessoas guardados para o item. */
export const storedHolders = (item: XElement): string[] =>
  holdersOf(item).pessoa.map((r) => String(r.l));

const provider = (decl: string, rows: Row[]) =>
  `<script>\n${decl} = \n${JSON.stringify([...rows, {}])};\n</script>`;

const registryOf = (item: XElement): XElement | undefined => {
  for (const c of childElements(item)) {
    const reg = childElements(c, 'REGISTRO-OU-PATENTE')[0];
    if (reg) return reg;
  }
  return undefined;
};

const slash = (xml: string) =>
  /^\d{8}$/.test(xml) ? `${xml.slice(0, 2)}/${xml.slice(2, 4)}/${xml.slice(4)}` : '';

/** A grade de situações da patente, no formato da página (id: 01, sem aspas). */
function dateScript(item: XElement | undefined): string {
  const reg = item && registryOf(item);
  const rows = Object.entries(PATENT_DATE_CODES)
    .map(([attr, [code, label]]) => ({
      code,
      date: slash((reg && getAttr(reg, attr)) ?? ''),
      label,
    }))
    .filter((r) => r.date)
    .map(
      (r) =>
        ` {\n id: ${r.code.padStart(2, '0')},\n contato: "${r.label}",\n endereco: "${r.date}","editable":"true","deletable":"true"\n }`,
    );
  return `<script>\nvar providerContatos = [${[...rows, '{}'].join(',')}];\n</script>`;
}

/** Os vetores da edição de um registro: produção, depositantes e (na patente) as datas. */
export function registryGridScripts(
  item: XElement | undefined,
  { dates = false, withHolders = true } = {},
): string {
  const h = item ? holdersOf(item) : { inst: [], pessoa: [] };
  return [
    gridScripts(item),
    ...(withHolders
      ? [
          provider('var titularPessoaProvider', h.pessoa),
          provider('var titularInstProvider', h.inst),
        ]
      : []),
    ...(dates ? [dateScript(item)] : []),
  ].join('\n');
}

const rowsOf = (grid: string) =>
  grid
    .split('@')
    .filter(Boolean)
    .map((r) => r.split('|'));

/** Grava as grades do POST no item, como chegaram. */
export function applyRegistryGrids(
  item: XElement,
  req: SimRequest,
  { dates = false, withHolders = true } = {},
): void {
  applyGrids(item, req);
  if (withHolders) {
    // c|l|t|staValidado, a ordem das chaves do titularPessoaProvider.
    holdersOf(item).pessoa = rowsOf(req.get('f_depositante_pessoa_l') ?? '').map(
      ([l = '', c = '', t = '']) =>
        Object.fromEntries([
          ['l', l],
          ['c', c],
          ['t', t],
          ['editable', false],
          ['deletable', true],
          ['staValidado', 'N'],
        ]),
    );
  }
  if (dates) {
    const reg = registryOf(item);
    const xml = req.get('f_dados_grid_datas') ?? '';
    if (!reg) return;
    for (const [attr, [code]] of Object.entries(PATENT_DATE_CODES)) {
      const m = new RegExp(
        `<item>\\s*<id>${Number(code)}</id>\\s*<contato>[^<]*</contato>\\s*<endereco>(\\d{2})/(\\d{2})/(\\d{4})</endereco>`,
      ).exec(xml);
      setAttr(reg, attr, m ? `${m[1]}${m[2]}${m[3]}` : '');
    }
  }
}
