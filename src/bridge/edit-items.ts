// Alterar no lugar um item de produção que já está no Lattes (LAT-51). Por
// enquanto só a participação em eventos como ouvinte, pelo formulário GN_TEC
// (PKG_EVENTO.form, POST PKG_EVENTO.FORM), cujos campos estão em
// docs/lattes_internals.md, seção 16. Segue o caminho do vínculo e do idioma:
// a operação traz o "antes" de cada campo (expect) e o valor novo (set), e
// apply.ts acha o formulário, confere, envia só esses campos trocados e lê de
// volta.
//
// LIGADO desde o teste acompanhado de 14/10/2026, no currículo do dono: um
// evento de ouvinte de teste alterado por POST direto ao PKG_EVENTO.FORM,
// com a resposta de sucesso, a releitura (só f_titulo mudou) e a pendência
// acesa no menu (seção 16). Que F_FORMA e F_COD_PROD correspondam à forma e
// ao elemento continua inferido; por isso os dois entram na conferência do
// "antes", e um palpite errado faz a operação parar sem enviar nada. O app só
// manda essas operações a uma extensão que anuncia 'alterar-evento'
// (compat.ts): uma extensão mais antiga não confere o formulário de eventos.
//
// A chave cobre só o evento de ouvinte. Um caminho novo de alteração
// (convidado, participante, outros tipos de produção) entra com chave
// própria, desligada até o teste acompanhado dele.
//
// Fica à mão:
// - eventos com forma Convidado ou Participante: só se viu a edição de
//   ouvinte, e não se sabe como o formulário marca o tipo já gravado (F_TPO);
// - forma, tipo e natureza do evento, e a cidade (o campo f_cidade existe, mas
//   a correspondência com CIDADE-DO-EVENTO não foi conferida);
// - o que o formulário não tem: idioma, meio de divulgação, relevância, DOI,
//   nome do evento em inglês, local, instituição promotora, palavras-chave,
//   áreas, setores, participantes e informações adicionais;
// - os outros tipos de produção: trabalhos técnicos e editoração foram lidos,
//   mas têm grades de autores e palavras-chave que este caminho ainda não
//   monta; prêmios foram lidos, mas a correspondência dos campos com o XML não
//   foi conferida; artigos e livros não foram lidos.

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
 * Participação em evento: o formulário se abre pelo link da lista com f_seq =
 * SEQUENCIA-PRODUCAO, e a conferência do "antes" diz se é mesmo o item (o
 * f_seq sozinho não basta; ver planEvento).
 */
export interface EventoOp extends OpBase {
  kind: 'evento';
  seq: string;
}

export function isEventoOp(op: BridgeOp): op is EventoOp {
  return op.kind === 'evento';
}

/**
 * Elemento do XML → opção de F_COD_PROD. Os rótulos das opções foram lidos no
 * formulário (A31 Congresso … A39 Outra); a correspondência com o elemento é
 * pelo nome, inferida.
 */
const EVENT_CODES: Record<string, string> = {
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
  siblings: readonly Change[] = [],
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

  const basics = childElements(item, basicsOf(item.name))[0];
  const forma = basics ? (getAttr(basics, 'FORMA-PARTICIPACAO') ?? '') : '';
  if (forma !== OUVINTE_XML) {
    return {
      reason: `Pelo conector, só a participação como ouvinte; a edição como ${forma || 'forma não informada'} não foi lida no Lattes`,
    };
  }

  const table = isBasics ? BASICS_FIELDS : DETAIL_FIELDS;
  const set: FieldValues = {};
  const expect: FieldValues = {};
  const missing: string[] = [];
  const absent: string[] = [];
  for (const f of change.fields) {
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

  // Conferência de identidade: a linha do Lattes com esse f_seq precisa ser
  // de ouvinte, do mesmo tipo de evento, e ter o mesmo ano, nome do evento e
  // cidade, qualquer que seja a parte alterada. O f_seq sozinho não basta: no
  // censo de 15/10/2026, o f_seq de 3 de 8 trabalhos técnicos não era o
  // SEQUENCIA-PRODUCAO do item, e o Importar dá números do servidor. Com só a
  // forma, a natureza e o ano, um congresso podia ser gravado no lugar de
  // outro do mesmo ano. O formulário GN_TEC tem os campos das duas partes.
  expect.F_FORMA = OUVINTE;
  expect.F_COD_PROD = EVENT_CODES[item.name]!;
  //
  // A outra parte do item pode ter alteração própria na mesma fila (o ano nos
  // dados básicos e a cidade no detalhamento): um campo dela que muda fica de
  // fora daqui, porque o Lattes pode estar com o antes ou com o depois,
  // conforme a ordem dos envios. A operação da outra parte confere esse campo.
  const pending = new Set(
    siblings
      .filter((c) => c !== change && c.kind === 'alterado' && c.element !== el.name)
      .filter((c) => c.path.slice(0, -1).join('/') === change.path.slice(0, -1).join('/'))
      .flatMap((c) => c.fields.map((f) => `${c.element}@${f.attr}`)),
  );
  const identity = (part: XElement | undefined, attr: string, field: string) => {
    if (field in expect || !part || pending.has(`${part.name}@${attr}`)) return;
    expect[field] = getAttr(part, attr) ?? '';
  };
  const detail = isDetail ? el : childElements(item, detailOf(item.name))[0];
  identity(isBasics ? el : basics, 'ANO', 'f_ano');
  identity(detail, 'NOME-DO-EVENTO', 'f_nme_evento');
  identity(detail, 'CIDADE-DO-EVENTO', 'f_cidade');
  return { expect, key: change.key, kind: 'evento', label, seq, set };
}

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
export function editContract(enabled: boolean = EDIT_OUVINTE_ENABLED): {
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
  f_homepage: 'Home page',
  f_nme_evento: 'Nome do evento',
  f_pais: 'País',
  F_STA_DIVULGACAO_CIENTIFICA: 'Divulgação científica',
  f_titulo: 'Título',
  f_titulo_en: 'Título em inglês',
};

export const EDIT_VALUE_LABELS: Record<string, Record<string, string>> = {
  f_pais: Object.fromEntries(COUNTRY_NAMES),
  F_STA_DIVULGACAO_CIENTIFICA: { N: 'Não', S: 'Sim' },
};
