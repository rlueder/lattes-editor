// Itens novos fora da produção (LAT-52): formação acadêmica, atuação
// profissional, projeto, patente e os outros registros (LAT-57). O Importar do
// Lattes não lê nenhuma dessas seções (src/import-export/importable.ts), então
// o item novo fica na cópia de trabalho e vai ao Lattes como as outras
// alterações: pelo conector, quando ele souber incluir aquele tipo, ou à mão.
//
// Cada item nasce como o novo item de produção: atributos do schema na ordem
// dele, vazios, e os filhos que o formulário precisa. O número de sequência só
// é dado ao salvar e nunca reaproveita um que a exportação já usou.

import type { LattesSchema } from '../schema/types.ts';
import type { GeneralType } from './general-types.ts';
import { type Author, emptyAttrs, nextSequencia, readAuthor, SEQ_ATTR } from './production.ts';
import { insertInSchemaOrder } from './schema-order.ts';
import {
  childElements,
  element,
  firstChild,
  getAttr,
  setAttr,
  walk,
  type XDocument,
  type XElement,
} from './xml.ts';

export { CREATED_WITH, type GeneralKind, type GeneralType, generalTypes } from './general-types.ts';

/** Elemento vazio com os atributos do schema e as partes estruturais que o schema lista. */
function blank(schema: LattesSchema, name: string): XElement {
  return element(name, emptyAttrs(schema, name));
}

/** Insere um filho vazio na ordem do schema e o devolve. */
function addPart(schema: LattesSchema, parent: XElement, name: string): XElement {
  const part = blank(schema, name);
  insertInSchemaOrder(schema, parent, part);
  return part;
}

/**
 * O item vazio, sem número de sequência (sai no salvar). A atuação já vem com
 * um vínculo, como o formulário de inclusão do Lattes (que cria a atuação e o
 * primeiro vínculo juntos); a patente e cada registro com dados básicos,
 * detalhamento, um registro e o dono como primeiro autor; o projeto com o dono na equipe, que o
 * Lattes exige.
 */
export function newGeneralItem(schema: LattesSchema, type: GeneralType, owner?: Author): XElement {
  const item = blank(schema, type.itemName);
  if (type.kind === 'atuacao') {
    setAttr(addPart(schema, item, 'VINCULOS'), 'SEQUENCIA-HISTORICO', '1');
  }
  if (type.kind === 'patente') {
    // Os nomes das partes mudam por tipo (DADOS-BASICOS-DA-CULTIVAR,
    // DETALHAMENTO-DA-MARCA…); o schema diz quais são.
    const parts = schema.elements[type.itemName]?.children.map((c) => c.name) ?? [];
    const basics = parts.find((n) => n.startsWith('DADOS-BASICOS-'));
    const detail = parts.find((n) => n.startsWith('DETALHAMENTO-'));
    if (basics) addPart(schema, item, basics);
    if (detail) addPart(schema, addPart(schema, item, detail), 'REGISTRO-OU-PATENTE');
    if (owner) setAuthorsOf(schema, item, 'AUTORES', [owner]);
  }
  if (type.kind === 'projeto' && owner) setTeam(schema, item, [owner]);
  return item;
}

// Equipe do projeto ---------------------------------------------------------------

/** A equipe do projeto (INTEGRANTES-DO-PROJETO, dentro de EQUIPE-DO-PROJETO), na ordem. */
export function readTeam(projeto: XElement): Author[] {
  const equipe = firstChild(projeto, 'EQUIPE-DO-PROJETO');
  if (!equipe) return [];
  const order = (el: XElement) =>
    Number.parseInt(getAttr(el, 'ORDEM-DE-INTEGRACAO') ?? '', 10) || 0;
  return childElements(equipe, 'INTEGRANTES-DO-PROJETO')
    .sort((a, b) => order(a) - order(b))
    .map(readAuthor);
}

/** Pessoas num elemento de autoria (AUTORES, INTEGRANTES-DO-PROJETO), sem CPF, com a ordem. */
function people(schema: LattesSchema, name: string, list: Author[]): XElement[] {
  const spec = schema.elements[name];
  if (!spec) throw new Error(`Elemento desconhecido: ${name}`);
  return list.map((person, i) =>
    element(
      name,
      spec.attributes
        .filter((a) => !a.name.startsWith('CPF'))
        .map((a) => {
          const flag = a.name.startsWith('FLAG-') && a.enum?.includes('NAO');
          if (a.name.startsWith('ORDEM')) return { name: a.name, value: String(i + 1) };
          if (a.name.startsWith('NOME-COMPLETO')) return { name: a.name, value: person.name };
          if (a.name.startsWith('NOME-PARA-CITACAO')) {
            return { name: a.name, value: person.citation };
          }
          if (a.name === 'NRO-ID-CNPQ') return { name: a.name, value: person.lattesId };
          return { name: a.name, value: a.default ?? (flag ? 'NAO' : '') };
        }),
    ),
  );
}

function setAuthorsOf(schema: LattesSchema, item: XElement, name: string, list: Author[]): void {
  item.children = item.children.filter((c) => c.kind !== 'element' || c.name !== name);
  for (const person of people(schema, name, list)) insertInSchemaOrder(schema, item, person);
}

/**
 * Troca a equipe do projeto. Quem já estava mantém o que o editor não mostra
 * (responsável pelo projeto), pelo nome; sem ninguém, o bloco sai.
 */
export function setTeam(schema: LattesSchema, projeto: XElement, team: Author[]): void {
  const old = firstChild(projeto, 'EQUIPE-DO-PROJETO');
  const before = new Map(
    (old ? childElements(old, 'INTEGRANTES-DO-PROJETO') : []).map((el) => [
      readAuthor(el).name.trim().toLowerCase(),
      getAttr(el, 'FLAG-RESPONSAVEL'),
    ]),
  );
  projeto.children = projeto.children.filter(
    (c) => c.kind !== 'element' || c.name !== 'EQUIPE-DO-PROJETO',
  );
  const members = team.filter((p) => p.name.trim());
  if (members.length === 0) return;
  const equipe = element('EQUIPE-DO-PROJETO');
  for (const el of people(schema, 'INTEGRANTES-DO-PROJETO', members)) {
    const flag = before.get(readAuthor(el).name.trim().toLowerCase());
    if (flag) setAttr(el, 'FLAG-RESPONSAVEL', flag);
    insertInSchemaOrder(schema, equipe, el);
  }
  insertInSchemaOrder(schema, projeto, equipe);
}

// Atuação do projeto -------------------------------------------------------------

export interface AtuacaoChoice {
  el: XElement;
  /** SEQUENCIA-ATIVIDADE, que identifica a atuação; sem ela, a posição ("#2"). */
  key: string;
  label: string;
}

/** As atuações do currículo onde um projeto pode entrar, pelo nome da instituição. */
export function atuacaoChoices(doc: XDocument): AtuacaoChoice[] {
  const out: AtuacaoChoice[] = [];
  walk(doc.root, (el) => {
    if (el.name !== 'ATUACAO-PROFISSIONAL') return;
    const seq = getAttr(el, 'SEQUENCIA-ATIVIDADE') ?? '';
    const name = getAttr(el, 'NOME-INSTITUICAO')?.trim();
    const key = seq || `#${out.length + 1}`;
    out.push({ el, key, label: name || `Atuação ${key}` });
  });
  return out;
}

// Sequência e inserção ------------------------------------------------------------

/** Maior valor numérico de um atributo de sequência nas árvores dadas. */
function maxOf(roots: XElement[], attr: string): number {
  let max = 0;
  for (const root of roots) {
    walk(root, (el) => {
      const n = Number.parseInt(getAttr(el, attr) ?? '', 10);
      if (Number.isFinite(n) && n > max) max = n;
    });
  }
  return max;
}

/**
 * Próximo número de uma sequência biográfica (formação, atividade, projeto):
 * acima do maior da cópia de trabalho e da exportação carregada, para nunca
 * repetir um número que o Lattes já deu. Que o Lattes respeite o número na
 * inclusão não se sabe: o conector devolve o que o Lattes deu
 * (OpResult.assigned).
 */
export function nextGeneralSequence(roots: XElement[], attr: string): number {
  return maxOf(roots, attr) + 1;
}

/**
 * Os itens do currículo que podem receber um item do tipo (`GeneralType.host`):
 * as atuações pelo nome da instituição, as atividades com a instituição e o
 * período, os projetos pelo nome.
 */
export function hostChoices(doc: XDocument, host: string): AtuacaoChoice[] {
  if (host === 'ATUACAO-PROFISSIONAL') return atuacaoChoices(doc);
  const out: AtuacaoChoice[] = [];
  walk(doc.root, (el, ancestors) => {
    if (el.name !== host) return;
    const atuacao = ancestors.find((a) => a.name === 'ATUACAO-PROFISSIONAL');
    const inst = (atuacao && getAttr(atuacao, 'NOME-INSTITUICAO')?.trim()) || '';
    const start = getAttr(el, 'ANO-INICIO') ?? '';
    const end = getAttr(el, 'ANO-FIM') ?? '';
    const period = start ? ` (${start}${end ? `–${end}` : ', atual'})` : '';
    const name =
      getAttr(el, 'NOME-DO-PROJETO') ||
      getAttr(el, 'NOME-CURSO') ||
      getAttr(el, 'NOME-ORGAO') ||
      '';
    const label = [inst, name].filter(Boolean).join(' · ') || `${host} ${out.length + 1}`;
    out.push({ el, key: `#${out.length + 1}`, label: `${label}${period}` });
  });
  return out;
}

export interface InsertContext {
  /** Projeto: a atuação onde ele entra. */
  atuacao?: XElement;
  /** Tipo com `host`: o item que recebe o novo (a atuação do vínculo, a atividade da disciplina…). */
  host?: XElement;
  /** Exportação carregada: os números dela nunca se repetem. */
  original?: XElement;
  /** Contador salvo do SEQUENCIA-PRODUCAO (WorkingCopy.nextSequencia). */
  productionCounter: number;
}

/** Cria (ou acha) a cadeia de contêineres a partir de `start`, na ordem do schema. */
function ensurePath(schema: LattesSchema, start: XElement, names: string[]): XElement {
  let parent = start;
  for (const name of names) {
    let next = firstChild(parent, name);
    if (!next) {
      next = element(name);
      insertInSchemaOrder(schema, parent, next);
    }
    parent = next;
  }
  return parent;
}

/**
 * Dá o número de sequência e insere o item no documento, na ordem do schema.
 * O projeto entra numa participação nova dentro da atuação escolhida, com o
 * período do próprio projeto: a ligação que o Lattes faz pela instituição
 * escolhida no formulário (docs/lattes_internals.md, seção 17). Devolve o
 * próximo contador de SEQUENCIA-PRODUCAO (muda só com a patente).
 */
export function insertGeneralItem(
  schema: LattesSchema,
  doc: XDocument,
  type: GeneralType,
  item: XElement,
  ctx: InsertContext,
): number {
  const roots = ctx.original ? [doc.root, ctx.original] : [doc.root];
  let counter = ctx.productionCounter;
  if (type.seqAttr === SEQ_ATTR) {
    const seq = nextSequencia(doc, counter);
    setAttr(item, SEQ_ATTR, String(seq));
    counter = seq + 1;
  } else if (type.seqAttr) {
    setAttr(item, type.seqAttr, String(nextGeneralSequence(roots, type.seqAttr)));
  }
  // Atividade: atual sem ano de fim, como a participação do projeto.
  if (type.kind === 'atividade') {
    setAttr(item, 'FLAG-PERIODO', getAttr(item, 'ANO-FIM') ? 'ANTERIOR' : 'ATUAL');
  }

  if (type.kind === 'projeto') {
    const atuacao = ctx.atuacao;
    if (!atuacao) throw new Error('O projeto precisa de uma atuação');
    const container = ensurePath(schema, atuacao, ['ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO']);
    const participacao = blank(schema, 'PARTICIPACAO-EM-PROJETO');
    const fim = getAttr(item, 'ANO-FIM') ?? '';
    // Se o número é por atuação ou do currículo inteiro não se sabe: acima do
    // maior do currículo (cópia e exportação) vale nos dois casos.
    setAttr(
      participacao,
      'SEQUENCIA-FUNCAO-ATIVIDADE',
      String(nextGeneralSequence(roots, 'SEQUENCIA-FUNCAO-ATIVIDADE')),
    );
    setAttr(participacao, 'FLAG-PERIODO', fim ? 'ANTERIOR' : 'ATUAL');
    setAttr(participacao, 'ANO-INICIO', getAttr(item, 'ANO-INICIO') ?? '');
    setAttr(participacao, 'ANO-FIM', fim);
    insertInSchemaOrder(schema, participacao, item);
    insertInSchemaOrder(schema, container, participacao);
    return counter;
  }

  if (type.host) {
    if (ctx.host?.name !== type.host)
      throw new Error(`O item precisa de onde entrar (${type.host})`);
    insertInSchemaOrder(schema, ensurePath(schema, ctx.host, type.containerPath), item);
    return counter;
  }
  insertInSchemaOrder(schema, ensurePath(schema, doc.root, type.containerPath), item);
  return counter;
}
