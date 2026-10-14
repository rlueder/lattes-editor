// Arquivo para o Importar do Lattes (guia, 3.3).
//
// O "Baixar arquivo" usa a opção 2: o currículo inteiro com os itens novos. É
// a única forma verificada (10/10/2026). Quem importa precisa desmarcar os
// itens vermelhos no Passo 3, e a lista de passos na tela diz isso.
//
// A opção 1 (só os itens novos, com um DADOS-GERAIS mínimo) é a escolhida para
// o Importar pelo conector (LAT-50), mas ainda não foi testada no Lattes.
// buildMinimalImportFile a monta só para esse caminho, que fica desligado
// (IMPORT_ENABLED, em src/bridge/importar.ts) até o teste acompanhado.

import { encodeCv } from '../model/document.ts';
import { pendingItems } from '../model/production.ts';
import { element, getAttr, setAttr, type XDocument, type XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { IMPORT_MODULES, type ImportModule } from './importable.ts';

export interface ImportFile {
  bytes: Uint8Array;
  fileName: string;
  /** Módulos do Passo 2 que têm itens novos: os únicos a deixar marcados. */
  modules: ImportModule[];
  newItems: number;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** DATA-ATUALIZACAO (DDMMAAAA) e HORA-ATUALIZACAO (HHMMSS), horário local. */
export function lattesTimestamp(now: Date): { date: string; time: string } {
  return {
    date: `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}`,
    time: `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
  };
}

/** Módulo do Passo 2 que lê um item, pelo nome do item e do contêiner pai. */
function moduleFor(itemName: string, parentName: string): ImportModule | undefined {
  return IMPORT_MODULES.find((m) =>
    m.paths.some((path) => {
      const segs = path.split('/');
      const last = segs.at(-1)!;
      const container = segs.at(-2);
      if (last === '*') return container === parentName && !m.exclude?.includes(itemName);
      return last === itemName && (container ?? 'CURRICULO-VITAE') === parentName;
    }),
  );
}

/** Os módulos do Passo 2 que leem os itens, na ordem da tela. */
function modulesOf(root: XElement, items: XElement[]): ImportModule[] {
  // Pai de cada elemento, para achar o módulo.
  const parents = new Map<XElement, string>();
  const visit = (el: XElement) => {
    for (const c of el.children) {
      if (c.kind !== 'element') continue;
      parents.set(c, el.name);
      visit(c);
    }
  };
  visit(root);
  const found = new Set<ImportModule>();
  for (const item of items) {
    const m = moduleFor(item.name, parents.get(item) ?? '');
    if (m) found.add(m);
  }
  return IMPORT_MODULES.filter((m) => found.has(m));
}

/** Data e hora de agora na raiz, e a origem, se faltar. */
function stampRoot(root: XElement, now: Date): void {
  if (getAttr(root, 'SISTEMA-ORIGEM-XML') === undefined) {
    setAttr(root, 'SISTEMA-ORIGEM-XML', 'LATTES_OFFLINE');
  }
  const { date, time } = lattesTimestamp(now);
  setAttr(root, 'DATA-ATUALIZACAO', date);
  setAttr(root, 'HORA-ATUALIZACAO', time);
}

export function buildImportFile(
  doc: XDocument,
  encoding: string,
  loadedMax: number,
  now = new Date(),
): ImportFile {
  const copy: XDocument = structuredClone(doc);
  stampRoot(copy.root, now);
  const pending = pendingItems(copy, loadedMax);
  const id = getAttr(copy.root, 'NUMERO-IDENTIFICADOR');
  return {
    bytes: encodeCv(copy, encoding),
    fileName: `${id ?? 'curriculo'}-importacao.xml`,
    modules: modulesOf(copy.root, pending),
    newItems: pending.length,
  };
}

/** O arquivo da opção 1, com o ano do item novo mais antigo para o filtro do Passo 2. */
export interface MinimalImportFile extends ImportFile {
  /** Menor ano entre os itens novos; undefined se algum item não tiver ano. */
  oldestYear?: number;
}

/** Ano do item: o primeiro ANO ou ANO-DO-* preenchido nos dados básicos, com 4 dígitos. */
export function itemYear(item: XElement): number | undefined {
  const basics = item.children.find(
    (c): c is XElement => c.kind === 'element' && c.name.startsWith('DADOS-BASICOS'),
  );
  const value = basics?.attrs
    .find((a) => /^ANO($|-DO-)/.test(a.name) && a.value.trim())
    ?.value.trim();
  return value && /^\d{4}$/.test(value) ? Number(value) : undefined;
}

/** Atributos de DADOS-GERAIS que vão no arquivo mínimo. */
const GENERAL_ATTRS = new Set([
  'NOME-COMPLETO',
  'NOME-EM-CITACOES-BIBLIOGRAFICAS',
  // O guia pede só os dois nomes, mas o XSD exige também NACIONALIDADE e
  // PERMISSAO-DE-DIVULGACAO; sem eles o arquivo não valida.
  ...(lattesSchema.elements['DADOS-GERAIS']?.attributes ?? [])
    .filter((a) => a.required)
    .map((a) => a.name),
]);

/**
 * Opção 1 do guia (3.3): a raiz com os atributos dela, um DADOS-GERAIS só com
 * os nomes e o que mais o XSD exige, e só os itens novos dentro dos seus
 * contêineres. Nada de CPF, RG, nascimento, endereço ou itens já existentes.
 *
 * A árvore é a do documento podada, então a ordem dos filhos continua a do
 * schema. Se o Lattes aceita esse arquivo não foi testado: só o Importar pelo
 * conector o usa, e ele está desligado (IMPORT_ENABLED).
 */
export function buildMinimalImportFile(
  doc: XDocument,
  encoding: string,
  loadedMax: number,
  now = new Date(),
): MinimalImportFile {
  const pending = new Set(pendingItems(doc, loadedMax));
  const leadsToNew = (el: XElement): boolean =>
    pending.has(el) || el.children.some((c) => c.kind === 'element' && leadsToNew(c));
  // Um contêiner fica só se leva a algum item novo, e só com esses filhos.
  const prune = (el: XElement): XElement =>
    pending.has(el)
      ? structuredClone(el)
      : element(
          el.name,
          structuredClone(el.attrs),
          el.children
            .filter((c): c is XElement => c.kind === 'element' && leadsToNew(c))
            .map(prune),
        );

  const general = doc.root.children.find(
    (c): c is XElement => c.kind === 'element' && c.name === 'DADOS-GERAIS',
  );
  const root = element(doc.root.name, structuredClone(doc.root.attrs), [
    element(
      'DADOS-GERAIS',
      (general?.attrs ?? []).filter((a) => GENERAL_ATTRS.has(a.name)).map((a) => ({ ...a })),
    ),
    ...doc.root.children
      .filter(
        (c): c is XElement => c.kind === 'element' && c.name !== 'DADOS-GERAIS' && leadsToNew(c),
      )
      .map(prune),
  ]);
  stampRoot(root, now);
  const minimal: XDocument = { epilog: doc.epilog, prolog: doc.prolog, root };

  const items = pendingItems(minimal, loadedMax);
  const years = items.map(itemYear).filter((y): y is number => y !== undefined);
  const id = getAttr(root, 'NUMERO-IDENTIFICADOR');
  return {
    bytes: encodeCv(minimal, encoding),
    fileName: `${id ?? 'curriculo'}-itens-novos.xml`,
    modules: modulesOf(root, items),
    newItems: items.length,
    // Um item sem ano deixa o filtro no ano mais antigo da tela (importar.ts).
    oldestYear: years.length > 0 && years.length === items.length ? Math.min(...years) : undefined,
  };
}
