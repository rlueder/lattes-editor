// Alterar no lugar um item de uma lista do Lattes (LAT-58) cuja linha não se
// acha pelo número: o prêmio não tem número na exportação, e o f_seq da
// formação complementar não bateu com SEQUENCIA-FORMACAO num dos itens do
// censo de 15/10/2026. A operação abre o formulário de edição de cada linha
// da lista (o link da própria linha, nunca um f_seq montado) e fica com o
// único cujos valores são os do item no editor. Depois segue o caminho dos
// outros: confere o "antes", envia o formulário como veio com só os campos
// alterados trocados, e lê de volta (apply.ts).
//
// Cada tipo tem chave própria, desligada até um teste acompanhado no Lattes
// real. Depois do envio, apply.ts conta de novo as linhas da lista (o f_ctr
// não distingue sempre incluir de alterar) e confere os campos desabilitados
// que identificam o item (LIST_EDIT_WATCH). O que se sabe de cada um, e o que conferir no teste, está na seção 16
// de docs/lattes_internals.md.
//
// Prêmios e títulos (GN_PREMIO, POST pkg_premio.form). Observado: os campos,
// os limites e as ligações f_titulo ↔ NOME-DO-PREMIO-OU-TITULO, f_agencia ↔
// NOME-DA-ENTIDADE-PROMOTORA e f_ano ↔ ANO-DA-PREMIACAO (censo, 5 itens sem
// divergência). Inferido: que o POST com f_ctr=U grave (o formulário é o
// mesmo da exclusão, seção 15). O formulário não tem o nome em inglês.
//
// Formação complementar (GN_FORMACAO2, POST PKG_FORMACAO_COMPL.FORM2).
// Observado: o f_ctr do formulário vem sem valor (seção 15), e as ligações
// f_carga ↔ CARGA-HORARIA, F_STATUS ↔ STATUS-DO-CURSO (concluído),
// f_curso_old ↔ NOME-CURSO e f_inst_old ↔ NOME-INSTITUICAO (censo). Inferido:
// que FORM2 grave com o f_ctr vazio que a página traz; que "em andamento" e
// "incompleto" gravem EM_ANDAMENTO e INCOMPLETO (pelo rótulo); que f_nivel
// seja o NIVEL do XML. O formulário não tem os anos, o órgão nem o nome do
// curso em inglês.
//
// Instituição e curso só mudam pelas buscas do Lattes. Observado em 20/10/2026,
// na página de edição de um curso de curta duração: sele_inst() abre
// prc_inst_form?f_cod=…&f_nivel=<f_nivel> e curso() abre
// prc_curso_form?f_cod=…&f_pgm=FORM&f_nivel=<f_nivel>&f_inst=<f_cod_inst ou
// f_cod_inst2>, as mesmas da formação acadêmica; os ocultos vieram com
// f_cod_inst=V577000000000 (com a letra), f_cod_inst2 vazio, f_cod_curso
// vazio e f_cod_curso2=90000005 (sem a letra), e f_inst desabilitado. A
// operação leva o código novo e apply.ts faz as buscas na hora de gravar,
// com as regras de formacao-edit.ts e formacao-lookups.ts; uma extensão só
// as recebe com a capacidade buscas-complementar-endereco
// (COMPL_ENDERECO_LOOKUPS_ENABLED). Inferido: que FORM2 grave os ocultos que
// as buscas escrevem, como pkg_formacao.FORM grava os da formação.
//
// Ficam à mão, sem caminho ainda:
// - áreas de atuação (prc_area_atuacao): a grade vai serializada em
//   f_area_l, e o sentido das chaves r e p não foi lido (seção 16);
// - atividades da atuação: o link de edição é montado por JavaScript na tela
//   de cargos e vínculos (seção 8), e o censo não o achou; a recaptura em
//   docs/lattes-formularios/recaptura-edicao.md mostra onde ele está;
// - idiomas: as quatro proficiências já vão (plan.ts); o código do idioma é
//   do sistema no editor e o nome segue o código, então não há o que mais
//   enviar.

import type { Change } from '../model/changes.ts';
import { foldText } from '../model/fold-text.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import type { FieldSpec, FormSpec } from './contract.ts';
import { type Pairs, pairValue } from './form.ts';
import { type FormacaoLookups, type Level, type LookupRow, planLookups } from './formacao-edit.ts';
import { findLinks } from './lattes-html.ts';
import type { BridgeOp, FieldValues, OpBase } from './plan.ts';

/** Alteração de prêmio e título. Ligada para o teste ao vivo, antes de um teste acompanhado. */
export const EDIT_PREMIO_ENABLED = true;

/** Alteração de formação complementar. Ligada para o teste ao vivo, antes de um teste acompanhado. */
export const EDIT_FORMACAO_COMPL_ENABLED = true;

/**
 * Instituição e curso da formação complementar e a instituição e o órgão do
 * endereço profissional pelas buscas do Lattes (endereco-buscas.ts). Ligada para o
 * teste ao vivo; nada disso foi gravado num Lattes real. O app só manda essas
 * operações a uma extensão que anuncia 'buscas-complementar-endereco'.
 */
export const COMPL_ENDERECO_LOOKUPS_ENABLED = true;

export type ListEditKind = 'formacao-complementar' | 'premio';

export interface ListEditOp extends OpBase {
  kind: ListEditKind;
  /** As trocas que as buscas fazem, só para mostrar. */
  lookupRows?: LookupRow[];
  /** Instituição e curso pelas buscas, na formação complementar (formacao-lookups.ts). */
  lookups?: FormacaoLookups;
  /**
   * Valores que acham a linha, além do "antes" (expect): os campos do item
   * que a operação não troca. Comparados sem acento nem caixa, só para achar;
   * a conferência estrita é a do expect.
   */
  match: FieldValues;
}

const KINDS = new Set<string>(['formacao-complementar', 'premio']);

export function isListEditOp(op: BridgeOp): op is ListEditOp {
  return KINDS.has(op.kind);
}

export function isListEditKind(kind: string): kind is ListEditKind {
  return KINDS.has(kind);
}

type Mapper = (value: string) => string | undefined;
const same: Mapper = (v) => v;

/** Rádio F_STATUS: S concluído (observado), N em andamento e I incompleto (pelo rótulo). */
const STATUS: Record<string, string> = { CONCLUIDO: 'S', EM_ANDAMENTO: 'N', INCOMPLETO: 'I' };
const status: Mapper = (v) => STATUS[v];

/** Carga horária: campo de 4 caracteres, em horas; só dígitos (inferido). */
const hours: Mapper = (v) => (/^\d*$/.test(v.trim()) ? v.trim() : undefined);

interface Target {
  /** Atributos que o formulário não tem. */
  absent: Record<string, string>;
  /** Atributos do item → campo e conversão. */
  fields: Record<string, [string, Mapper]>;
  /** Procedimento do link de edição em cada linha da lista. */
  form: string;
  /** Atributos que só mudam por outro caminho, com o porquê para a pessoa. */
  hand?: Record<string, string>;
  /**
   * Campos que identificam a linha e sempre vão em match, com os valores de
   * antes (`before` dá o do atributo antes da mudança).
   */
  identity(before: (attr: string) => string): FieldValues;
  /** O item da operação, pelo elemento alterado e o pai. */
  is(el: XElement, parent: XElement | undefined): boolean;
  /** Lista do menu. */
  list: string;
  /** Os campos de busca que o formulário mostra, para as regras de formacao-edit.ts. */
  lookup?: Level;
  /** Campos que o check() do formulário exige. */
  required: string[];
  spec: FormSpec;
}

const text = (maxLength: number): FieldSpec => ({ maxLength, type: 'text' });
const hidden: FieldSpec = { type: 'hidden' };
const select: FieldSpec = { type: 'select-one' };
const radio: FieldSpec = { type: 'radio' };

/** O formulário de prêmios do censo de 15/10/2026. */
export const PREMIO_SPEC: FormSpec = {
  action: 'pkg_premio.form',
  fields: {
    f_agencia: text(100),
    f_ano: text(4),
    f_cod: hidden,
    f_ctr: hidden,
    f_seq: hidden,
    f_tipo_privacidade: select,
    f_titulo: text(200),
  },
  name: 'GN_PREMIO',
};

/**
 * O formulário de formação complementar do censo de 15/10/2026 (a inclusão;
 * a passada de edição viu os mesmos campos com valor). O f_ctr vem vazio.
 */
export const FORMACAO_COMPL_SPEC: FormSpec = {
  action: 'PKG_FORMACAO_COMPL.FORM2',
  fields: {
    f_carga: text(4),
    f_cod: hidden,
    f_cod_curso: hidden,
    f_cod_curso2: hidden,
    f_cod_inst: hidden,
    f_cod_inst2: hidden,
    f_ctr: hidden,
    f_curso: text(50),
    f_curso_old: hidden,
    f_inst: text(75),
    f_inst_old: hidden,
    f_nivel: select,
    f_seq: hidden,
    F_STATUS: radio,
    f_tipo: hidden,
  },
  mode: '',
  name: 'GN_FORMACAO2',
};

/** As buscas da formação complementar e do endereço numa montagem ou extensão sem elas. */
export const LOOKUPS_OFF =
  'Instituição, curso e órgão pelas buscas do Lattes: desligado nesta montagem';

/** Elementos da formação complementar → f_nivel (lista do formulário, censo de 15/10/2026). */
export const COMPL_LEVELS: Record<string, string> = {
  'FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO': 'F',
  'FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA': '8',
  MBA: 'E',
  OUTROS: 'Y',
};

/** Instituição e curso: os campos vêm desabilitados e só mudam pelas buscas. */
const COMPL_LOOKUP_ATTRS = new Set([
  'CODIGO-CURSO',
  'CODIGO-INSTITUICAO',
  'NOME-CURSO',
  'NOME-INSTITUICAO',
]);

const TARGETS: Record<ListEditKind, Target> = {
  'formacao-complementar': {
    absent: {
      'ANO-DE-CONCLUSAO': 'os anos',
      'ANO-DE-INICIO': 'os anos',
      'ANO-DE-OBTENCAO-DO-TITULO': 'os anos',
      'CODIGO-ORGAO': 'o órgão',
      'FLAG-BOLSA': 'a bolsa',
      'NOME-AGENCIA': 'a agência',
      'NOME-COMPLETO-DO-ORIENTADOR': 'o orientador',
      'NOME-CURSO-INGLES': 'o nome do curso em inglês',
      'NOME-ORGAO': 'o órgão',
      'TITULO-DA-MONOGRAFIA': 'a monografia',
    },
    fields: {
      'CARGA-HORARIA': ['f_carga', hours],
      'STATUS-DO-CURSO': ['F_STATUS', status],
    },
    form: 'PKG_FORMACAO_COMPL.form',
    hand: {
      NIVEL:
        'O nível é o tipo da formação complementar no Lattes: para trocar, inclua de novo no nível certo',
    },
    identity: (before) => ({
      f_curso_old: before('NOME-CURSO'),
      f_inst_old: before('NOME-INSTITUICAO'),
    }),
    is: (el, parent) => parent?.name === 'FORMACAO-COMPLEMENTAR' && el.name in COMPL_LEVELS,
    list: 'pkg_formacao_compl.lista',
    lookup: { name: 'formação complementar', visible: ['f_inst', 'f_curso'] },
    required: [],
    spec: FORMACAO_COMPL_SPEC,
  },
  premio: {
    absent: { 'NOME-DO-PREMIO-OU-TITULO-INGLES': 'o nome em inglês' },
    fields: {
      'ANO-DA-PREMIACAO': ['f_ano', same],
      'NOME-DA-ENTIDADE-PROMOTORA': ['f_agencia', same],
      'NOME-DO-PREMIO-OU-TITULO': ['f_titulo', same],
    },
    form: 'pkg_premio.form',
    identity: () => ({}),
    is: (el) => el.name === 'PREMIO-TITULO',
    list: 'pkg_premio.lista',
    required: ['f_titulo', 'f_ano'],
    spec: PREMIO_SPEC,
  },
};

/** O nome do tipo, para os motivos. */
const NAMES: Record<ListEditKind, string> = {
  'formacao-complementar': 'formação complementar',
  premio: 'prêmios e títulos',
};

/**
 * Uma alteração de prêmio ou de formação complementar como operação no
 * formulário de edição; undefined quando o item não é desses tipos ou a chave
 * dele está desligada (segue para os outros caminhos do plano).
 */
export function planListEdit(
  change: Change,
  chain: XElement[],
  label: string,
  enabled: ReadonlySet<ListEditKind>,
  /** COMPL_ENDERECO_LOOKUPS_ENABLED com a capacidade da extensão. */
  lookups = false,
): ListEditOp | { reason: string } | undefined {
  if (change.kind !== 'alterado') return undefined;
  const el = chain.at(-1);
  if (!el) return undefined;
  const kind = (Object.keys(TARGETS) as ListEditKind[]).find((k) =>
    TARGETS[k].is(el, chain.at(-2)),
  );
  if (!kind || !enabled.has(kind)) return undefined;
  const t = TARGETS[kind];

  const set: FieldValues = {};
  const expect: FieldValues = {};
  const missing: string[] = [];
  const invalid: string[] = [];
  const absent = new Set<string>();
  for (const f of change.fields) {
    const hand = t.hand?.[f.attr];
    if (hand) return { reason: hand };
    if (t.lookup && COMPL_LOOKUP_ATTRS.has(f.attr)) continue;
    const entry = t.fields[f.attr];
    if (!entry) {
      if (t.absent[f.attr]) absent.add(t.absent[f.attr]!);
      else missing.push(f.label);
      continue;
    }
    const [field, map] = entry;
    const after = map(f.after);
    const before = map(f.before);
    if (after === undefined || before === undefined) {
      invalid.push(f.attr === 'CARGA-HORARIA' ? `${f.label} (em horas, só com dígitos)` : f.label);
      continue;
    }
    if (t.required.includes(field) && !after.trim()) {
      return { reason: `O Lattes não aceita ${f.label.toLowerCase()} vazio` };
    }
    // O ano do prêmio vai com quatro dígitos (inferido do check() dos outros
    // formulários com ano, como o de eventos; o campo tem 4 caracteres).
    if (field === 'f_ano' && kind === 'premio' && !/^\d{4}$/.test(after.trim())) {
      return { reason: `O Lattes exige ${f.label.toLowerCase()} com quatro dígitos` };
    }
    set[field] = after;
    expect[field] = before;
  }
  if (absent.size > 0) {
    return { reason: `O formulário de ${NAMES[kind]} do Lattes não tem ${[...absent].join(', ')}` };
  }
  if (missing.length > 0) {
    return { reason: `Campos não suportados ainda: ${missing.join(', ')}` };
  }
  if (invalid.length > 0) {
    return {
      reason: `Valor que o formulário de ${NAMES[kind]} do Lattes não aceita: ${invalid.join(', ')}`,
    };
  }

  // Instituição e curso pelas buscas, com as regras da formação acadêmica.
  const planned = t.lookup ? planLookups(change, el, t.lookup) : undefined;
  if (planned && 'reason' in planned) return planned;
  const found = planned && Object.keys(planned.lookups).length > 0 ? planned : undefined;
  // Uma extensão sem as buscas mandaria o formulário sem os ocultos, e a
  // releitura acharia tudo igual: nunca vai a ela.
  if (found && !lookups) return { reason: LOOKUPS_OFF };

  // O que acha a linha: os campos do item que a operação não troca, e os de
  // identidade com o valor de antes.
  const changed = new Map(change.fields.map((f) => [f.attr, f.before]));
  const before = (attr: string) => changed.get(attr) ?? getAttr(el, attr) ?? '';
  const match: FieldValues = { ...t.identity(before) };
  for (const [attr, [field, map]] of Object.entries(t.fields)) {
    if (field in set) continue;
    const value = map(getAttr(el, attr) ?? '');
    if (value !== undefined) match[field] = value;
  }
  if (kind === 'formacao-complementar') {
    // O nível é o tipo do item: confere estrito, como a natureza do evento.
    expect.f_nivel = getAttr(el, 'NIVEL') || COMPL_LEVELS[el.name]!;
  }
  return {
    expect,
    key: change.key,
    kind,
    label,
    match,
    set,
    ...(found ? { lookupRows: found.rows, lookups: found.lookups } : {}),
  };
}

// ---------------------------------------------------------------- contrato

/** Os formulários com a chave ligada, para o contrato (contract.ts). */
export function listEditContract(enabled: ReadonlySet<ListEditKind> = enabledListEdits()): {
  forms: Partial<Record<ListEditKind, FormSpec>>;
  menu: string[];
} {
  const kinds = [...enabled].sort();
  return {
    forms: Object.fromEntries(kinds.map((k) => [k, TARGETS[k].spec])),
    menu: kinds.map((k) => TARGETS[k].list),
  };
}

/** As chaves ligadas no código. */
export function enabledListEdits(): Set<ListEditKind> {
  const out = new Set<ListEditKind>();
  if (EDIT_PREMIO_ENABLED) out.add('premio');
  if (EDIT_FORMACAO_COMPL_ENABLED) out.add('formacao-complementar');
  return out;
}

export function listEditSpec(kind: ListEditKind): FormSpec {
  return TARGETS[kind].spec;
}

// ---------------------------------------------------------------- caminho

type Get = (path: string) => Promise<string>;
type Read = (path: string) => Promise<Pairs>;

/** Os links de edição da lista: os que levam f_seq. */
async function editLinks(
  kind: ListEditKind,
  menu: string,
  get: Get,
): Promise<string[] | undefined> {
  const t = TARGETS[kind];
  const list = findLinks(menu, t.list)[0];
  if (!list) return undefined;
  return findLinks(await get(list.path), t.form)
    .filter((l) => l.params.f_seq)
    .map((l) => l.path);
}

/** Um exemplar do formulário, para o contrato conferir só lendo. */
export async function listEditSample(
  kind: ListEditKind,
  menu: string,
  get: Get,
): Promise<{ link: string } | { none: string } | { path: string }> {
  const links = await editLinks(kind, menu, get);
  if (!links) return { link: TARGETS[kind].list };
  return links[0] ? { path: links[0] } : { none: `O currículo não tem ${NAMES[kind]}` };
}

const folded = (v: string | null) => (v === null ? null : foldText(v.trim()));

/** Quantas linhas a lista tem (links de edição), para saber se um envio incluiu em vez de alterar. */
export async function countListEdits(kind: ListEditKind, menu: string, get: Get): Promise<number> {
  const links = await editLinks(kind, menu, get);
  if (!links) throw new Error(`Lista de ${NAMES[kind]} não encontrada no menu do Lattes`);
  return links.length;
}

/**
 * O formulário de edição da linha cujos valores são os do item: abre o de
 * cada linha da lista e exige exatamente um. Devolve também quantas linhas a
 * lista tinha. Não achar lança um Error com o motivo; `get` e `read` já param
 * quando a sessão caiu.
 *
 * Primeiro com o "antes" e os valores que acham a linha (match). Sem nenhum
 * achado, tenta só com match: a linha certa cujo "antes" mudou no Lattes
 * volta, e a conferência estrita de apply.ts a acusa como divergente, em vez
 * de "não encontrado".
 */
export async function locateListEdit(
  op: ListEditOp,
  menu: string,
  get: Get,
  read: Read,
): Promise<{ listed: number; path: string }> {
  const links = await editLinks(op.kind, menu, get);
  if (!links) throw new Error(`Lista de ${NAMES[op.kind]} não encontrada no menu do Lattes`);
  const read_: { pairs: Pairs; path: string }[] = [];
  const matching = (pairs: Pairs, values: FieldValues) =>
    Object.entries(values).every(([k, v]) => folded(pairValue(pairs, k)) === folded(v));
  const hits: string[] = [];
  // Lê todas as linhas para provar que só uma é a do item, mas para no
  // segundo achado: aí já não há como seguir, e o resto seria pedido à toa.
  for (const path of links) {
    const pairs = await read(path);
    read_.push({ pairs, path });
    if (matching(pairs, { ...op.match, ...op.expect })) hits.push(path);
    if (hits.length > 1) {
      throw new Error(`Mais de um item de ${NAMES[op.kind]} igual no Lattes`);
    }
  }
  if (hits.length === 1) return { listed: links.length, path: hits[0]! };
  // Nenhuma com o antes: a lista inteira já foi lida, sem novo pedido.
  const loose = read_.filter((r) => matching(r.pairs, op.match));
  if (loose.length === 1) return { listed: links.length, path: loose[0]!.path };
  throw new Error(`Item de ${NAMES[op.kind]} não encontrado no Lattes`);
}

/**
 * Campos desabilitados que identificam o item e não vão no envio (o navegador
 * não manda campo desabilitado): a releitura confere que não mudaram.
 */
export const LIST_EDIT_WATCH: Record<ListEditKind, string[]> = {
  'formacao-complementar': ['f_inst', 'f_curso'],
  premio: [],
};

// ---------------------------------------------------------------- rótulos

/** Rótulos do formulário de cada tipo (os da página, censo de 15/10/2026). */
export const LIST_EDIT_FIELD_LABELS: Record<ListEditKind, Record<string, string>> = {
  'formacao-complementar': {
    f_carga: 'Carga horária',
    f_curso: 'Curso',
    f_curso_old: 'Curso',
    f_inst: 'Instituição',
    f_inst_old: 'Instituição',
    f_nivel: 'Nível',
    F_STATUS: 'Status do curso',
  },
  premio: {
    f_agencia: 'Entidade promotora',
    f_ano: 'Ano da premiação ou do título',
    f_titulo: 'Nome do prêmio ou título',
  },
};

export const LIST_EDIT_VALUE_LABELS: Record<
  ListEditKind,
  Record<string, Record<string, string>>
> = {
  'formacao-complementar': {
    f_nivel: { '8': 'Extensão universitária', E: 'MBA', F: 'Curso de curta duração', Y: 'Outros' },
    F_STATUS: { I: 'Incompleto', N: 'Em andamento', S: 'Concluído' },
  },
  premio: {},
};
