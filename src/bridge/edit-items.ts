// Alterar no lugar um item de produção que já está no Lattes (LAT-51, LAT-58).
// Aqui, a participação em eventos, pelo formulário GN_TEC (PKG_EVENTO.form,
// POST PKG_EVENTO.FORM), cujos campos estão em docs/lattes_internals.md, seção
// 16. Segue o caminho do vínculo e do idioma: a operação traz o "antes" de cada
// campo (expect) e o valor novo (set), e apply.ts acha o formulário, confere,
// envia só esses campos trocados e lê de volta.
//
// Duas chaves:
//
// - EDIT_OUVINTE_ENABLED, LIGADA desde o teste acompanhado de 14/10/2026, no
//   currículo do dono: um evento de ouvinte de teste alterado por POST direto
//   ao PKG_EVENTO.FORM, com a resposta de sucesso, a releitura (só f_titulo
//   mudou) e a pendência acesa no menu (seção 16). Cobre título, ano, país,
//   home page, divulgação científica, título em inglês e nome do evento, só no
//   evento de ouvinte. O app só manda essas operações a uma extensão que
//   anuncia 'alterar-evento' (compat.ts).
// - EDIT_EVENTO_ENABLED (LAT-58), DESLIGADA até um teste acompanhado: eventos
//   de convidado e participante, e a forma, o tipo, a natureza e a cidade em
//   qualquer evento. Ligada, ela também cobre o que a outra cobre. Trocar a
//   forma de ouvinte para outra fica à mão mesmo com ela ligada (planShape).
//   A extensão confere a chave da própria montagem antes de gravar
//   (apply.ts, ApplyGates).
//
// O que é observado e o que é inferido no caminho da segunda chave:
// - F_FORMA ↔ FORMA-PARTICIPACAO e f_cidade ↔ CIDADE-DO-EVENTO: observados na
//   passada de edição do censo de 15/10/2026 (seis eventos de ouvinte, sem
//   divergência). Só a opção 40 (Ouvinte) foi vista com o valor do XML; que 38
//   e 39 gravem "Convidado" e "Participante" vem do rótulo do rádio (inferido).
// - F_COD_PROD ↔ NATUREZA: observado no censo (o rótulo da opção é o valor da
//   NATUREZA nos congressos e encontros). A natureza segue o elemento do XML
//   (src/schema/typed-choices.ts), e o editor não a deixa trocar: mudar a
//   natureza no Lattes mudaria o elemento na próxima exportação. Por isso ela
//   só entra na conferência do "antes", nunca no envio.
// - F_TPO ↔ TIPO-PARTICIPACAO: inferido (seção 16). A lista nasce vazia no
//   HTML e o valor de cada opção é o próprio rótulo, então o envio leva o
//   texto do tipo direto. Como o formulário de edição de um convidado ou
//   participante marca o tipo já gravado não foi visto (nenhum item assim no
//   currículo do dono). Por isso o tipo vai sempre na conferência do "antes":
//   se a página não mostrar o tipo gravado, a operação para sem enviar nada,
//   em vez de apagar o tipo com F_TPO vazio.
//
// Fica à mão:
// - o que o formulário não tem: idioma, meio de divulgação, relevância, DOI,
//   nome do evento em inglês, local, instituição promotora, palavras-chave,
//   áreas, setores, participantes e informações adicionais;
// - a abrangência (f_classif), que o XSD não tem e o conector manda como veio.

import type { Change } from '../model/changes.ts';
import { foldText } from '../model/fold-text.ts';
import { childElements, getAttr, type XElement } from '../model/xml.ts';
import listas from '../schema/listas-lattes.json' with { type: 'json' };
import type { FieldSpec, FormSpec } from './contract.ts';
import { findLinks } from './lattes-html.ts';
import type { BridgeOp, FieldValues, OpBase } from './plan.ts';

/**
 * Alteração de evento de ouvinte pelo conector: ligada depois do teste de
 * 14/10/2026. Desligada (nos testes, `editOuvinte: false`), o planejamento
 * manda essas mudanças para o caminho à mão e o contrato não confere o
 * formulário de eventos.
 */
export const EDIT_OUVINTE_ENABLED = true;

/**
 * Alteração de evento de convidado e participante, e da forma, do tipo, da
 * natureza e da cidade em qualquer evento (LAT-58). Desligada até um teste
 * acompanhado no Lattes real: o que conferir nele está no começo deste
 * arquivo.
 */
export const EDIT_EVENTO_ENABLED = false;

/**
 * Participação em evento: o formulário se abre pelo link da lista com f_seq =
 * SEQUENCIA-PRODUCAO, e a conferência do "antes" diz se é mesmo o item (o
 * f_seq sozinho não basta; ver planEvento).
 */
export interface EventoOp extends OpBase {
  /**
   * Campos que confirmam que o formulário aberto pelo f_seq é o do item, além
   * do expect: o valor do Lattes, sem acento, caixa nem espaço nas pontas,
   * precisa ser um dos listados (o antes e o depois, quando outra operação da
   * fila troca o campo). Ausente nas operações de antes desta conferência.
   */
  identity?: Record<string, string[]>;
  kind: 'evento';
  seq: string;
}

const folded = (value: string | null) => (value === null ? '' : foldText(value.trim()));

/** Os campos de identidade (EventoOp.identity) que o formulário não confirma. */
export function identityMismatches(op: EventoOp, value: (name: string) => string | null): string[] {
  return Object.entries(op.identity ?? {})
    .filter(([name, ok]) => !ok.some((v) => folded(v) === folded(value(name))))
    .map(([name]) => name);
}

export function isEventoOp(op: BridgeOp): op is EventoOp {
  return op.kind === 'evento';
}

/** Campos que só o caminho de EDIT_EVENTO_ENABLED manda. */
const FULL_FIELDS = ['F_COD_PROD', 'F_FORMA', 'F_TPO', 'f_cidade'];

/**
 * A operação é do caminho de EDIT_EVENTO_ENABLED (convidado, participante,
 * forma, tipo, natureza ou cidade), e não do de ouvinte, já testado.
 */
export function isFullEvento(op: EventoOp): boolean {
  return op.expect.F_FORMA !== OUVINTE || FULL_FIELDS.some((f) => f in op.set);
}

/**
 * Elemento do XML → opção de F_COD_PROD. Os rótulos das opções foram lidos no
 * formulário (A31 Congresso … A39 Outra). A31 e A35 são observados: no censo
 * de 15/10/2026, os congressos e encontros do dono vieram com essas opções
 * (o rótulo é a NATUREZA do XML). Os outros seguem pelo nome, inferidos.
 */
export const EVENT_CODES: Record<string, string> = {
  'OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS': 'A39',
  'PARTICIPACAO-EM-CONGRESSO': 'A31',
  'PARTICIPACAO-EM-ENCONTRO': 'A35',
  'PARTICIPACAO-EM-EXPOSICAO': 'A38',
  'PARTICIPACAO-EM-FEIRA': 'A37',
  'PARTICIPACAO-EM-OFICINA': 'A34',
  'PARTICIPACAO-EM-OLIMPIADA': 'A36',
  'PARTICIPACAO-EM-SEMINARIO': 'A32',
  'PARTICIPACAO-EM-SIMPOSIO': 'A33',
};

/** Rádio F_FORMA: 38 Convidado, 39 Participante, 40 Ouvinte (lido no formulário). */
const OUVINTE = '40';

/** "Ouvinte" no XML: conferido na exportação real (src/schema/typed-choices.ts). */
const OUVINTE_XML = 'Ouvinte';

/**
 * Forma no XML → opção de F_FORMA. Ouvinte observado no censo; Convidado e
 * Participante pelo rótulo do rádio, inferidos.
 */
const FORMA_CODES: Record<string, string> = {
  Convidado: '38',
  Ouvinte: OUVINTE,
  Participante: '39',
};

/** Os dois filhos do evento que têm campos no formulário. */
const basicsOf = (item: string) =>
  item.startsWith('OUTRAS-') ? `DADOS-BASICOS-DE-${item}` : `DADOS-BASICOS-DA-${item}`;
const detailOf = (item: string) =>
  item.startsWith('OUTRAS-') ? `DETALHAMENTO-DE-${item}` : `DETALHAMENTO-DA-${item}`;

type Mapper = (value: string) => string | null | undefined;
const same: Mapper = (v) => v;

/** check() do formulário exige ano e nome do evento: vazio não vai. */
const REQUIRED = new Set(['f_ano', 'f_nme_evento']);

/** Nome do país (como o XML guarda) → código do f_pais, das listas capturadas no Lattes. */
const COUNTRY_CODES = new Map<string, string>();
const COUNTRY_NAMES = new Map<string, string>();
{
  const folded = new Map<string, string[]>();
  for (const [name, code] of Object.entries(listas.codigosDosPaises)) {
    folded.set(foldText(name), [...(folded.get(foldText(name)) ?? []), code]);
    COUNTRY_NAMES.set(code, name);
  }
  // Dois nomes que só diferem no acento, com códigos diferentes: nenhum entra.
  for (const [name, codes] of folded) if (codes.length === 1) COUNTRY_CODES.set(name, codes[0]!);
}

/**
 * O código do f_pais para um nome de país, sem diferença de acento e caixa
 * ("África do Sul" é "África Do Sul", AFS); undefined se o Lattes não tem o
 * nome ou tem mais de um código para ele.
 */
export function countryCode(name: string): string | undefined {
  return COUNTRY_CODES.get(foldText(name));
}

const country: Mapper = countryCode;

/** O nome do país de um código do f_pais, para mostrar a quem confere. */
export function countryName(code: string): string | undefined {
  return COUNTRY_NAMES.get(code);
}

/** Rádio S/N; vazio não tem como ir (o rádio não desmarca). */
const yesNo: Mapper = (v) => (v === 'SIM' ? 'S' : v === 'NAO' ? 'N' : undefined);

/**
 * Atributos dos dados básicos → campos do formulário. A correspondência vem
 * da tabela da seção 16 (as linhas sem "inferido").
 */
const BASICS_FIELDS: Record<string, [string, Mapper]> = {
  ANO: ['f_ano', same],
  'FLAG-DIVULGACAO-CIENTIFICA': ['F_STA_DIVULGACAO_CIENTIFICA', yesNo],
  'HOME-PAGE-DO-TRABALHO': ['f_homepage', same],
  PAIS: ['f_pais', country],
  TITULO: ['f_titulo', same],
  'TITULO-INGLES': ['f_titulo_en', same],
};

const DETAIL_FIELDS: Record<string, [string, Mapper]> = {
  'NOME-DO-EVENTO': ['f_nme_evento', same],
};

/**
 * O que EDIT_EVENTO_ENABLED acrescenta: a cidade (observada no censo). A
 * forma, o tipo e a natureza têm tratamento próprio em planEvento.
 */
const DETAIL_FIELDS_FULL: Record<string, [string, Mapper]> = {
  ...DETAIL_FIELDS,
  'CIDADE-DO-EVENTO': ['f_cidade', same],
};

/** Forma, tipo e natureza: só com EDIT_EVENTO_ENABLED, fora das tabelas. */
const SHAPE_ATTRS = new Set(['FORMA-PARTICIPACAO', 'NATUREZA', 'TIPO-PARTICIPACAO']);

/** Atributos que o formulário de eventos não tem: o porquê fica claro para a pessoa. */
const NO_FIELD = new Set([
  'DOI',
  'FLAG-RELEVANCIA',
  'IDIOMA',
  'LOCAL-DO-EVENTO',
  'MEIO-DE-DIVULGACAO',
  'CODIGO-INSTITUICAO',
  'NOME-INSTITUICAO',
  'NOME-DO-EVENTO-INGLES',
]);

/** O que não deu para planejar, em texto para a pessoa. */
type Planned = EventoOp | { reason: string };

export interface PlanEventoOptions {
  /** EDIT_EVENTO_ENABLED: convidado, participante, forma, tipo, natureza e cidade. */
  full?: boolean;
  /** As outras mudanças da fila (planChanges), para a conferência de identidade. */
  siblings?: readonly Change[];
}

/** Forma e tipo antes e depois da mudança, dos dados básicos do evento. */
function shapeOf(change: Change, basics: XElement | undefined, isBasics: boolean) {
  const now = (attr: string) => (basics ? (getAttr(basics, attr) ?? '') : '');
  const before = (attr: string) => {
    const f = isBasics ? change.fields.find((x) => x.attr === attr) : undefined;
    return f ? f.before : now(attr);
  };
  return {
    formaAfter: now('FORMA-PARTICIPACAO'),
    formaBefore: before('FORMA-PARTICIPACAO'),
    tipoAfter: now('TIPO-PARTICIPACAO'),
    tipoBefore: before('TIPO-PARTICIPACAO'),
  };
}

/**
 * Uma alteração num item de participação em evento como operação no
 * formulário de eventos; undefined quando a mudança não é de evento (segue
 * para os outros caminhos do plano). `chain` vai da raiz até o elemento
 * alterado (resolvePath).
 */
export function planEvento(
  change: Change,
  chain: XElement[],
  label: string,
  { full = false, siblings = [] }: PlanEventoOptions = {},
): Planned | undefined {
  // Só alteração: item novo vai pelo Importar, e a exclusão tem caminho próprio.
  if (change.kind !== 'alterado') return undefined;
  const el = chain.at(-1);
  const item = chain.at(-2);
  if (!el || !item || !(item.name in EVENT_CODES)) return undefined;
  const isBasics = el.name === basicsOf(item.name);
  const isDetail = el.name === detailOf(item.name);
  if (!isBasics && !isDetail) {
    return {
      reason:
        'O formulário de participação em eventos do Lattes não tem palavras-chave, áreas, setores, participantes nem informações adicionais',
    };
  }
  const seq = getAttr(item, 'SEQUENCIA-PRODUCAO');
  if (!seq) return { reason: 'Evento sem número de sequência' };

  const basics = isBasics ? el : childElements(item, basicsOf(item.name))[0];
  const shape = shapeOf(change, basics, isBasics);
  if (!full && shape.formaAfter !== OUVINTE_XML) {
    return {
      reason: `Pelo conector, só a participação como ouvinte; a edição como ${shape.formaAfter || 'forma não informada'} não foi lida no Lattes`,
    };
  }
  const formaCode = (forma: string) => FORMA_CODES[forma];
  if (full) {
    if (!formaCode(shape.formaBefore)) {
      return {
        reason: `Forma de participação que o Lattes não tem: ${shape.formaBefore || 'vazia'}`,
      };
    }
    if (!formaCode(shape.formaAfter)) {
      return {
        reason: `Forma de participação que o Lattes não tem: ${shape.formaAfter || 'vazia'}`,
      };
    }
  }

  const table = isBasics ? BASICS_FIELDS : full ? DETAIL_FIELDS_FULL : DETAIL_FIELDS;
  const set: FieldValues = {};
  const expect: FieldValues = {};
  const missing: string[] = [];
  const absent: string[] = [];
  for (const f of change.fields) {
    if (full && isBasics && SHAPE_ATTRS.has(f.attr)) continue;
    const entry = table[f.attr];
    if (!entry) {
      (NO_FIELD.has(f.attr) ? absent : missing).push(f.label);
      continue;
    }
    const [field, map] = entry;
    const after = map(f.after);
    // O "antes" vazio de um campo opcional também é valor (rádio sem marca = null).
    const before = f.before === '' && map === yesNo ? null : map(f.before);
    if (after === undefined || before === undefined) {
      missing.push(f.label);
      continue;
    }
    if (REQUIRED.has(field) && !after?.trim()) {
      return { reason: `O Lattes não aceita ${f.label.toLowerCase()} vazio` };
    }
    set[field] = after;
    expect[field] = before;
  }
  if (absent.length > 0) {
    return { reason: `O formulário de eventos do Lattes não tem: ${absent.join(', ')}` };
  }
  if (missing.length > 0) {
    return { reason: `Campos não suportados ainda: ${missing.join(', ')}` };
  }
  if (full) {
    const shaped = planShape(change, item, basics, shape, isBasics, set, expect);
    if (shaped) return shaped;
  }

  // Conferência de identidade: a linha do Lattes com esse f_seq precisa ser
  // da mesma forma, do mesmo tipo de evento, e ter o mesmo ano, nome do
  // evento e cidade, qualquer que seja a parte alterada. O f_seq sozinho não
  // basta: no censo de 15/10/2026, o f_seq de 3 de 8 trabalhos técnicos não
  // era o SEQUENCIA-PRODUCAO do item, e o Importar dá números do servidor.
  // Com só a forma, a natureza e o ano, um congresso podia ser gravado no
  // lugar de outro do mesmo ano. O formulário GN_TEC tem os campos das duas
  // partes.
  expect.F_FORMA ??= formaCode(shape.formaBefore) ?? OUVINTE;
  expect.F_COD_PROD = EVENT_CODES[item.name]!;
  //
  // Os campos de identidade que a operação não troca vão em `identity`, e não
  // no expect: comparados sem acento, caixa nem espaço nas pontas (texto
  // livre, como a cidade, pode voltar do Lattes com outra grafia). Quando a
  // outra parte do item tem alteração própria na mesma fila (o ano nos dados
  // básicos e o nome no detalhamento), o Lattes pode estar com o antes ou com
  // o depois, conforme a ordem dos envios, e os dois valem. Assim o campo é
  // sempre conferido, mesmo que a outra operação não vá.
  const pending = new Map<string, string>();
  for (const c of siblings) {
    if (c === change || c.kind !== 'alterado' || c.element === el.name) continue;
    if (c.path.slice(0, -1).join('/') !== change.path.slice(0, -1).join('/')) continue;
    for (const f of c.fields) pending.set(`${c.element}@${f.attr}`, f.before);
  }
  const identity: Record<string, string[]> = {};
  const add = (part: XElement | undefined, attr: string, field: string) => {
    if (field in expect) return;
    const now = (part && getAttr(part, attr)) ?? '';
    const before = part ? pending.get(`${part.name}@${attr}`) : undefined;
    identity[field] = before === undefined || before === now ? [now] : [before, now];
  };
  const detail = isDetail ? el : childElements(item, detailOf(item.name))[0];
  add(basics, 'ANO', 'f_ano');
  add(detail, 'NOME-DO-EVENTO', 'f_nme_evento');
  add(detail, 'CIDADE-DO-EVENTO', 'f_cidade');
  return { expect, identity, key: change.key, kind: 'evento', label, seq, set };
}

/**
 * Forma, tipo e natureza (EDIT_EVENTO_ENABLED): preenche set e expect, ou
 * devolve o motivo de não ir. As regras são as do check() do formulário
 * (seção 16): convidado e participante pedem tipo e título; ouvinte não tem
 * tipo.
 */
function planShape(
  change: Change,
  item: XElement,
  basics: XElement | undefined,
  shape: ReturnType<typeof shapeOf>,
  isBasics: boolean,
  set: FieldValues,
  expect: FieldValues,
): { reason: string } | undefined {
  const label = (attr: string) => change.fields.find((f) => f.attr === attr)?.label ?? attr;
  const changed = (attr: string) => isBasics && change.fields.some((f) => f.attr === attr);

  if (changed('NATUREZA')) {
    const after = basics ? (getAttr(basics, 'NATUREZA') ?? '') : '';
    if (foldText(after) !== foldText(derivedNature(item.name))) {
      return {
        reason: `A natureza segue o tipo de evento (${derivedNature(item.name)}); para trocar, inclua o evento de novo no tipo certo`,
      };
    }
    // O Lattes já guarda a natureza pelo tipo de evento: confere, sem trocar.
    set.F_COD_PROD = EVENT_CODES[item.name]!;
  }

  const ouvinteAfter = shape.formaAfter === OUVINTE_XML;
  const ouvinteBefore = shape.formaBefore === OUVINTE_XML;
  if (ouvinteBefore && !ouvinteAfter) {
    // Na página, a lista F_TPO é montada por script (montaTipoApres(), censo
    // de 15/10/2026: scriptFilled), e o HTML lido de volta não traz o tipo
    // gravado. Depois do envio, a releitura acusaria "não gravou" num evento
    // já trocado, sem desfazer. Fica à mão até o teste acompanhado mostrar
    // como a edição de um convidado traz o tipo.
    return {
      reason: `Trocar a forma de ouvinte para ${shape.formaAfter.toLowerCase()} pelo conector espera o teste acompanhado: o Lattes monta o tipo da participação por script, e a releitura não o vê`,
    };
  }
  // Ouvinte não tem tipo. Um tipo antigo esquecido no XML não impede
  // alterar o resto: só não vai, e a página manda F_TPO vazio como sempre.
  if (ouvinteAfter && shape.tipoAfter && (changed('TIPO-PARTICIPACAO') || !ouvinteBefore)) {
    return { reason: `Ouvinte não tem ${label('TIPO-PARTICIPACAO').toLowerCase()} no Lattes` };
  }
  if (!ouvinteAfter) {
    const types = PARTICIPATION_TYPES[shape.formaAfter] ?? [];
    if (!types.includes(shape.tipoAfter)) {
      return {
        reason: shape.tipoAfter
          ? `Tipo de participação que o Lattes não tem para ${shape.formaAfter}: ${shape.tipoAfter}`
          : `O Lattes exige o tipo de participação de ${shape.formaAfter.toLowerCase()}`,
      };
    }
    const title = basics ? (getAttr(basics, 'TITULO') ?? '') : '';
    if (!title.trim()) {
      return {
        reason: `O Lattes exige o título da apresentação de ${shape.formaAfter.toLowerCase()}`,
      };
    }
  }
  if (changed('FORMA-PARTICIPACAO')) {
    set.F_FORMA = FORMA_CODES[shape.formaAfter]!;
    expect.F_FORMA = FORMA_CODES[shape.formaBefore]!;
  }
  // O tipo vai sempre que a forma, antes ou depois, tem tipo: mandar o F_TPO
  // vazio que a página traz apagaria o tipo gravado.
  if (!ouvinteAfter || !ouvinteBefore) {
    set.F_TPO = shape.tipoAfter;
    expect.F_TPO = shape.tipoBefore;
  }
  return undefined;
}

/**
 * Tipos de participação por forma, como montaTipoApres() do formulário os
 * monta (seção 16, lido em 14/10/2026). O valor de cada opção é o rótulo.
 */
const PARTICIPATION_TYPES: Record<string, readonly string[]> = {
  Convidado: ['Conferencista', 'Simposista', 'Moderador', 'Avaliador', 'Homenageado'],
  Participante: ['Poster / Painel', 'Apresentação oral', 'Outras formas'],
};

/** A natureza que o elemento do evento quer dizer: o rótulo da opção de F_COD_PROD. */
function derivedNature(item: string): string {
  return EVENT_NATURE_LABELS[EVENT_CODES[item]!]!;
}

/** Rótulos de F_COD_PROD, lidos no formulário (censo de 15/10/2026). */
const EVENT_NATURE_LABELS: Record<string, string> = {
  A31: 'Congresso',
  A32: 'Seminário',
  A33: 'Simpósio',
  A34: 'Oficina',
  A35: 'Encontro',
  A36: 'Olimpíada',
  A37: 'Feira',
  A38: 'Exposição',
  A39: 'Outra',
};

// ---------------------------------------------------------------- contrato

const text = (maxLength: number): FieldSpec => ({ maxLength, type: 'text' });
const hidden: FieldSpec = { type: 'hidden' };
const radio: FieldSpec = { type: 'radio' };
const select: FieldSpec = { type: 'select-one' };

/**
 * O formulário de eventos como a seção 16 o descreve (lido em 14/10/2026).
 * f_tipo_privacidade segue o do idioma (select), como nos outros formulários.
 */
export const EVENTO_SPEC: FormSpec = {
  action: 'PKG_EVENTO.FORM',
  fields: {
    f_ano: text(4),
    f_cidade: text(255),
    f_classif: radio,
    f_cod: hidden,
    F_COD_PROD: select,
    f_ctr: hidden,
    F_FORMA: radio,
    f_homepage: text(250),
    f_nme_evento: text(400),
    f_pais: select,
    f_seq: hidden,
    F_STA_DIVULGACAO_CIENTIFICA: radio,
    f_tipo_privacidade: select,
    f_titulo: text(255),
    f_titulo_en: text(400),
    F_TPO: select,
  },
  name: 'GN_TEC',
};

/** A lista de eventos no menu. */
const EVENTO_LIST = 'pkg_evento.lista';

/**
 * O que a alteração de itens acrescenta ao contrato (contract.ts): o
 * formulário e a lista de eventos com a chave ligada, nada com ela desligada.
 */
export function editContract(enabled: boolean = EDIT_OUVINTE_ENABLED || EDIT_EVENTO_ENABLED): {
  forms: Partial<Record<'evento', FormSpec>>;
  menu: string[];
} {
  return enabled
    ? { forms: { evento: EVENTO_SPEC }, menu: [EVENTO_LIST] }
    : { forms: {}, menu: [] };
}

// ---------------------------------------------------------------- caminho

type Get = (path: string) => Promise<string>;

/** Onde está o formulário: o caminho, o link que faltou, ou por que não há exemplar. */
export type SampleLookup = { link: string } | { none: string } | { path: string };

/**
 * Os links de alteração (com f_seq) das listas de eventos do menu. O menu
 * tem a lista inteira e a filtrada por divulgação científica
 * (f_sta_divulgacao_cientifica=S); a inteira vem primeiro, e a filtrada só é
 * lida se a inteira não tiver o que se procura.
 */
async function eventoForms(
  menu: string,
  get: Get,
  wanted?: (seq: string) => boolean,
): Promise<{ path: string; seq: string }[] | undefined> {
  const lists = findLinks(menu, EVENTO_LIST).sort(
    (a, b) =>
      Number(Boolean(a.params.f_sta_divulgacao_cientifica)) -
      Number(Boolean(b.params.f_sta_divulgacao_cientifica)),
  );
  if (lists.length === 0) return undefined;
  const found: { path: string; seq: string }[] = [];
  for (const list of lists) {
    for (const l of findLinks(await get(list.path), 'PKG_EVENTO.form')) {
      if (l.params.f_seq) found.push({ path: l.path, seq: l.params.f_seq });
    }
    if (found.some((f) => (wanted ? wanted(f.seq) : true))) break;
  }
  return found;
}

/** Um exemplar do formulário, para o contrato conferir só lendo. */
export async function eventoSample(menu: string, get: Get): Promise<SampleLookup> {
  const forms = await eventoForms(menu, get);
  if (!forms) return { link: EVENTO_LIST };
  const first = forms[0];
  return first ? { path: first.path } : { none: 'O currículo não tem participação em eventos' };
}

/**
 * Caminho do formulário do evento, seguindo os links do próprio Lattes. Não
 * achar lança um Error com o motivo; `get` já para quando a sessão caiu.
 */
export async function locateEvento(op: EventoOp, menu: string, get: Get): Promise<string> {
  const forms = await eventoForms(menu, get, (seq) => seq === op.seq);
  if (!forms) throw new Error('Participação em eventos não encontrada no menu do Lattes');
  const hit = forms.find((f) => f.seq === op.seq);
  if (!hit) throw new Error(`Evento ${op.seq} não encontrado no Lattes`);
  return hit.path;
}

// ---------------------------------------------------------------- rótulos

/** Nomes dos campos, para a confirmação e o registro do enviado. */
export const EDIT_FIELD_LABELS: Record<string, string> = {
  f_ano: 'Ano',
  f_cidade: 'Cidade',
  F_COD_PROD: 'Natureza',
  F_FORMA: 'Forma de participação',
  f_homepage: 'Home page',
  f_nme_evento: 'Nome do evento',
  f_pais: 'País',
  F_STA_DIVULGACAO_CIENTIFICA: 'Divulgação científica',
  f_titulo: 'Título',
  f_titulo_en: 'Título em inglês',
  F_TPO: 'Tipo de participação',
};

export const EDIT_VALUE_LABELS: Record<string, Record<string, string>> = {
  F_COD_PROD: EVENT_NATURE_LABELS,
  F_FORMA: Object.fromEntries(Object.entries(FORMA_CODES).map(([label, code]) => [code, label])),
  f_pais: Object.fromEntries(COUNTRY_NAMES),
  F_STA_DIVULGACAO_CIENTIFICA: { N: 'Não', S: 'Sim' },
};
