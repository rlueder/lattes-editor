// Inventário da inclusão (LAT-57): cada tipo de item que o currículo guarda
// numa lista, como ele é criado hoje (conector, Importar ou nenhum caminho),
// se o editor oferece criá-lo, e o formulário de inclusão do Lattes que o
// censo (LAT-55) conhece para ele. A tabela de docs/inclusao_por_tipo.md é
// conferida contra estas funções em tests/create-inventory.test.ts, para o
// documento não descrever um caminho que o código não tem.
//
// Só é usado por testes e documentação; o editor não importa este módulo.

import type { CensusFile, EntryStatus } from '../census/run.ts';
import { CENSUS_TARGETS } from '../census/targets-production.ts';
import { CREATED_WITH, generalTypes } from '../model/general-items.ts';
import { productionType } from '../model/production.ts';
import type { LattesSchema } from '../schema/types.ts';
import { CONNECTOR_CREATES } from './create-items.ts';

/**
 * Itens de lista sem SEQUENCIA-*: o Lattes os identifica pelo conteúdo
 * (o idioma pelo código, a licença e o prêmio pela posição na lista).
 */
const WITHOUT_SEQUENCE = ['IDIOMA', 'LICENCA', 'PREMIO-TITULO'];

/** As seções do editor com item novo fora da produção (NEW_GENERAL_LABELS). */
const GENERAL_SECTIONS = ['formacao', 'atuacao', 'projetos', 'patentes', 'dados-gerais'];

export type CreateRoute = 'conector' | 'importar' | 'nenhum';

/**
 * Os elementos que são um item de lista: todo elemento com um atributo de
 * sequência (o Lattes numera cada item que inclui) e os três itens de lista
 * que não têm.
 */
export function listItemElements(schema: LattesSchema): string[] {
  const withSequence = Object.entries(schema.elements)
    .filter(([, spec]) => spec.attributes.some((a) => a.name.startsWith('SEQUENCIA-')))
    .map(([name]) => name);
  return [...withSequence, ...WITHOUT_SEQUENCE.filter((n) => schema.elements[n])];
}

/** Pai de cada elemento no schema (o primeiro, quando há mais de um). */
function parents(schema: LattesSchema): Map<string, string> {
  const out = new Map<string, string>();
  for (const [name, spec] of Object.entries(schema.elements)) {
    for (const child of spec.children) if (!out.has(child.name)) out.set(child.name, name);
  }
  return out;
}

/**
 * O item de lista de que este faz parte (o vínculo é da atuação, a disciplina
 * é da atividade de ensino), ou undefined quando o item está numa lista do
 * próprio currículo.
 */
export function partOf(schema: LattesSchema, name: string): string | undefined {
  const items = new Set(listItemElements(schema));
  const up = parents(schema);
  const seen = new Set<string>();
  let current = up.get(name);
  while (current && !seen.has(current)) {
    if (items.has(current)) return current;
    seen.add(current);
    current = up.get(current);
  }
  return undefined;
}

/** Como um item novo deste tipo chega ao Lattes hoje. */
export function createRoute(schema: LattesSchema, name: string): CreateRoute {
  if (CONNECTOR_CREATES.has(name)) return 'conector';
  if (productionType(schema, name)) return 'importar';
  return 'nenhum';
}

/**
 * O editor oferece criar o tipo: no "Novo item" da produção, no botão da seção
 * ou junto com outro item (a participação nasce com o projeto).
 */
export function editorCreates(schema: LattesSchema, name: string): boolean {
  if (productionType(schema, name)) return true;
  const host = CREATED_WITH[name];
  if (host) return editorCreates(schema, host);
  return GENERAL_SECTIONS.some((s) =>
    generalTypes(schema, s, (n) => n).some((t) => t.itemName === name),
  );
}

/** As entradas do censo cujo formulário grava este elemento. */
export function censusTargetsFor(name: string): string[] {
  return CENSUS_TARGETS.filter((t) => t.elements.includes(name)).map((t) => t.id);
}

/** Como a tabela do documento diz o resultado da captura de cada formulário. */
const CAPTURE_LABELS: Record<EntryStatus, string> = {
  desconhecido: 'endereço desconhecido',
  erro: 'erro',
  'nao-encontrado': 'página não encontrada',
  'nao-lido': 'não lido',
  ok: 'lido',
  'sem-formulario': 'sem formulário',
  'sem-link': 'sem link',
};

/**
 * As células de uma linha da tabela de docs/inclusao_por_tipo.md, menos o
 * rótulo: elemento, faz parte de, editor cria, caminho hoje, formulários do
 * censo, resultado da captura mais recente e procedência (endereço/ligação).
 */
export function inventoryRow(
  schema: LattesSchema,
  name: string,
  census: CensusFile | undefined,
): string[] {
  const code = (s: string) => `\`${s}\``;
  const ids = censusTargetsFor(name);
  const targets = ids.map((id) => CENSUS_TARGETS.find((t) => t.id === id)!);
  const status = (id: string) => census?.entries.find((e) => e.id === id)?.status;
  const parent = partOf(schema, name);
  return [
    code(name),
    parent ? code(parent) : '',
    editorCreates(schema, name) ? 'sim' : 'não',
    createRoute(schema, name),
    ids.length > 0 ? ids.map(code).join(', ') : 'nenhum',
    ids.map((id) => CAPTURE_LABELS[status(id) ?? 'nao-lido']).join(', '),
    targets.map((t) => `${t.provenance}/${t.elementsProvenance}`).join(', '),
  ];
}
