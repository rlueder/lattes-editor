// As grades de patentes e registros no Lattes simulado, na edição de um item
// (lido em 19/10/2026 no Lattes real, com itens de teste de cada tipo): as
// quatro de produção (grades.ts), os depositantes ou titulares
// (titularPessoaProvider, titularInstProvider) e, na patente, as datas na
// grade de situações (providerContatos, com o id sem aspas e com zero à
// esquerda, como a página escreve).
//
// A exportação da patente de teste (20/10/2026) guarda a pessoa depositante em
// NOME-DO-DEPOSITANTE, copia essa pessoa também nos AUTORES (com a ordem
// contada à parte) e tem um HISTORICO-SITUACOES-PATENTE por linha da grade de
// situações; o autorProvider da página não tem o depositante. O simulado faz
// o mesmo: a página deixa de fora o autor que é depositante, e o envio grava o
// NOME-DO-DEPOSITANTE, a cópia nos autores e o histórico.
//
// Inferido, como em grades.ts: que o servidor grave cada grade como chegou no
// oculto. Um envio com a grade de depositantes vazia apaga os depositantes,
// e é isso que o teste do conector precisa ver acontecer quando o envio erra.
// Também inferidos: como a exportação junta mais de um depositante (aqui com
// "; ") e o STATUS-SITUACAO-PATENTE de uma linha gravada (aqui SIM, como veio).

import { PATENT_DATE_CODES } from '../../src/bridge/create-registro-rules.ts';
import { foldText } from '../../src/model/fold-text.ts';
import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import { INSTITUTIONS } from './buscas.ts';
import { applyGrids, gridScripts } from './grades.ts';
import type { SimRequest } from './pedido.ts';

type Row = Record<string, string | boolean>;

/** Os depositantes de cada item: o XML do simulado não guarda a grade. */
const holders = new WeakMap<XElement, { inst: Row[]; pessoa: Row[] }>();

/** Uma linha de depositante pessoa como a página a traz (entrada do dicionário: l, c, t). */
const holderRow = (name: string, citation: string, code: string): Row =>
  Object.fromEntries([
    ['l', name],
    ['c', code],
    ['t', citation],
    ['editable', false],
    ['deletable', true],
    ['staValidado', 'N'],
  ]);

const registryOf = (item: XElement): XElement | undefined => {
  for (const c of childElements(item)) {
    const reg = childElements(c, 'REGISTRO-OU-PATENTE')[0];
    if (reg) return reg;
  }
  return undefined;
};

/**
 * Sem grade guardada, a do NOME-DO-DEPOSITANTE do XML, com a citação do autor
 * de mesmo nome. A entrada do dicionário não está no XML: c 0, o que a página
 * dá a uma pessoa digitada na hora (observado em 19/10/2026).
 */
function holdersFromXml(item: XElement): Row[] {
  const reg = registryOf(item);
  const name = ((reg && getAttr(reg, 'NOME-DO-DEPOSITANTE')) ?? '').trim();
  // Uma instituição da busca do simulado é titular instituição (institutionsFromXml).
  if (!name || isInstitution(name)) return [];
  const copy = childElements(item, 'AUTORES').find(
    (a) => foldText(getAttr(a, 'NOME-COMPLETO-DO-AUTOR') ?? '') === foldText(name),
  );
  return [holderRow(name, (copy && getAttr(copy, 'NOME-PARA-CITACAO')) ?? '', '0')];
}

/**
 * Uma linha de titular instituição na ordem do seleciona() da janela de
 * titulares (lido em 27/10/2026): l, c sem a letra, tipoInst a letra.
 * Inferido: que a edição traga as linhas gravadas na mesma ordem.
 */
const institutionRow = (name: string, code: string, letter: string): Row =>
  Object.fromEntries([
    ['l', name],
    ['c', code],
    ['tipoInst', letter],
    ['deletable', true],
    ['editable', false],
  ]);

const isInstitution = (name: string) =>
  INSTITUTIONS.some((i) => foldText(i.name) === foldText(name.trim()));

/**
 * Sem grade guardada, a instituição do NOME-DO-DEPOSITANTE do XML, com o
 * código da busca do simulado: a exportação de 27/10/2026 pôs a instituição
 * titular nesse atributo, e não em NOME-DO-TITULAR.
 */
function institutionsFromXml(item: XElement): Row[] {
  const reg = registryOf(item);
  const name = ((reg && getAttr(reg, 'NOME-DO-DEPOSITANTE')) ?? '').trim();
  if (!name || !isInstitution(name)) return [];
  const hit = INSTITUTIONS.find((i) => foldText(i.name) === foldText(name))!;
  return [institutionRow(hit.name, hit.code.slice(1), hit.code.slice(0, 1))];
}

const holdersOf = (item: XElement) => {
  let h = holders.get(item);
  if (!h) {
    h = { inst: institutionsFromXml(item), pessoa: holdersFromXml(item) };
    holders.set(item, h);
  }
  return h;
};

/** Um depositante pessoa como a página o traz (entrada do dicionário: l, c, t). */
export function seedHolder(item: XElement, name: string, citation: string, code: string): void {
  holdersOf(item).pessoa = [holderRow(name, citation, code)];
}

/** Põe mais um depositante pessoa no item. */
export function addHolder(item: XElement, name: string, citation: string, code: string): void {
  holdersOf(item).pessoa.push(holderRow(name, citation, code));
}

/** Os nomes dos depositantes pessoas guardados para o item. */
export const storedHolders = (item: XElement): string[] =>
  holdersOf(item).pessoa.map((r) => String(r.l));

/** O autor do XML que é a cópia de um depositante: a página não o mostra. */
const isHolderCopy = (item: XElement) => {
  const names = new Set(storedHolders(item).map((n) => foldText(n.trim())));
  return (author: XElement) =>
    names.has(foldText((getAttr(author, 'NOME-COMPLETO-DO-AUTOR') ?? '').trim()));
};

const provider = (decl: string, rows: Row[]) =>
  `<script>\n${decl} = \n${JSON.stringify([...rows, {}])};\n</script>`;

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
    gridScripts(item, undefined, item && withHolders ? isHolderCopy(item) : undefined),
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

/**
 * Os depositantes no XML, como a exportação os escreve: NOME-DO-DEPOSITANTE
 * e uma cópia de cada um nos AUTORES, antes dos autores e com a ordem contada
 * à parte (observado em 20/10/2026).
 */
function writeHolders(item: XElement): void {
  const names = storedHolders(item);
  const reg = registryOf(item);
  // Pessoas e instituições no mesmo atributo (exportação de 27/10/2026, com
  // uma instituição só); NOME-DO-TITULAR fica vazio. Como várias se juntam é
  // inferido.
  const institutions = holdersOf(item).inst.map((r) => String(r.l));
  if (reg) setAttr(reg, 'NOME-DO-DEPOSITANTE', [...names, ...institutions].join('; '));
  if (reg && getAttr(reg, 'NOME-DO-TITULAR') !== undefined) setAttr(reg, 'NOME-DO-TITULAR', '');
  const authors = childElements(item, 'AUTORES');
  item.children = item.children.filter((c) => !authors.includes(c as XElement));
  holdersOf(item).pessoa.forEach((r, i) => {
    insertInSchemaOrder(
      lattesSchema,
      item,
      element('AUTORES', {
        'NOME-COMPLETO-DO-AUTOR': String(r.l),
        'NOME-PARA-CITACAO': String(r.t),
        'NRO-ID-CNPQ': '',
        'ORDEM-DE-AUTORIA': String(i + 1),
      }),
    );
  });
  for (const a of authors) insertInSchemaOrder(lattesSchema, item, a);
}

/**
 * O histórico de situações da patente a partir da grade postada: um
 * HISTORICO-SITUACOES-PATENTE por linha, com o rótulo e a data
 * (observado na exportação de 20/10/2026).
 */
function writeHistory(reg: XElement, item: XElement, xml: string): void {
  const detail = childElements(item).find((c) => childElements(c).includes(reg));
  if (!detail) return;
  detail.children = detail.children.filter(
    (c) => c.kind !== 'element' || c.name !== 'HISTORICO-SITUACOES-PATENTE',
  );
  const re =
    /<item>\s*<id>\d+<\/id>\s*<contato>([^<]*)<\/contato>\s*<endereco>(\d{2})\/(\d{2})\/(\d{4})<\/endereco>/g;
  for (const m of xml.matchAll(re)) {
    insertInSchemaOrder(
      lattesSchema,
      detail,
      element('HISTORICO-SITUACOES-PATENTE', {
        'DATA-SITUACAO-PATENTE': `${m[2]}${m[3]}${m[4]}`,
        'DESCRICAO-SITUACAO-PATENTE': m[1]!,
        'STATUS-SITUACAO-PATENTE': 'SIM',
      }),
    );
  }
}

/** Os depositantes ou titulares do POST, pessoas e instituições. */
export function applyRegistryHolders(item: XElement, req: SimRequest): void {
  // l|c|t|staValidado: o check() escreve as chaves na ordem da linha do
  // titularPessoaProvider ({l, c, t, …}); GRID_SPECS lista quais chaves
  // vão, não a ordem (serializeGrid).
  holdersOf(item).pessoa = rowsOf(req.get('f_depositante_pessoa_l') ?? '').map(
    ([l = '', c = '', t = '']) => holderRow(l, t, c),
  );
  // l|c|tipoInst, na ordem da linha do seleciona().
  holdersOf(item).inst = rowsOf(req.get('f_depositante_inst_l') ?? '').map(
    ([l = '', c = '', letter = '']) => institutionRow(l, c, letter),
  );
  writeHolders(item);
}

/** Grava as grades do POST no item, como chegaram. */
export function applyRegistryGrids(
  item: XElement,
  req: SimRequest,
  { dates = false, withHolders = true } = {},
): void {
  applyGrids(item, req);
  if (withHolders) applyRegistryHolders(item, req);
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
    writeHistory(reg, item, xml);
  }
}
