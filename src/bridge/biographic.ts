// Dados gerais pelo conector (LAT-23): formação acadêmica, endereço e
// identificação, nos formulários que docs/lattes_internals.md descreve na
// seção 5 (e o reconhecimento de 10/10/2026, seção 4.2, para a formação).
// Segue o caminho do vínculo, do resumo e do idioma: a operação traz o "antes"
// de cada campo (expect) e o valor novo (set), e apply.ts acha o formulário,
// confere, envia só esses campos trocados e lê de volta.
//
// DESLIGADO: nada disto foi enviado a um Lattes de verdade. Os nomes dos
// campos vêm do HTML lido; a correspondência com os atributos do XML é
// inferida pelo nome e pelo rótulo, salvo onde o comentário diz que foi
// observada. A chave só liga depois de um teste acompanhado, no currículo do
// dono, com restauração.
//
// Fica de fora o que depende de busca (instituição, curso, agência,
// orientador), de listas cujo código não foi lido (país, nacionalidade, sexo)
// e das grades serializadas do endereço (contatos eletrônicos, redes sociais).

import type { Change } from '../model/changes.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import type { FieldSpec, FormSpec } from './contract.ts';
import { findLinks } from './lattes-html.ts';
import type { BridgeOp, FieldValues, OpBase } from './plan.ts';

/**
 * Fica false até um teste acompanhado num Lattes real. Desligada, o
 * planejamento manda essas mudanças para o caminho à mão e o contrato não
 * confere esses formulários; os testes ligam com `biographicOps: true`.
 */
export const BIOGRAPHIC_OPS_ENABLED = false;

/** Formação acadêmica: a linha da lista se acha por f_seq = SEQUENCIA-FORMACAO. */
export interface FormacaoOp extends OpBase {
  kind: 'formacao';
  seq: string;
}

/** Endereço: um formulário só para o profissional (_i) e o residencial (_r). */
export interface EnderecoOp extends OpBase {
  kind: 'endereco';
}

export interface IdentificacaoOp extends OpBase {
  kind: 'identificacao';
}

export type BiographicOp = EnderecoOp | FormacaoOp | IdentificacaoOp;

export type BiographicKind = BiographicOp['kind'];

const KINDS: ReadonlySet<string> = new Set<BiographicKind>([
  'endereco',
  'formacao',
  'identificacao',
]);

export function isBiographicKind(kind: string): kind is BiographicKind {
  return KINDS.has(kind);
}

export function isBiographicOp(op: BridgeOp): op is BiographicOp {
  return isBiographicKind(op.kind);
}

type Mapper = (value: string) => string | null;
const same: Mapper = (v) => v;

/**
 * STATUS-DO-CURSO → rádio F_STATUS. Rótulos lidos em 10/10/2026
 * (docs/lattes_internals.md, seção 5). Sem valor, nenhum rádio marcado.
 */
const STATUS: Record<string, string> = { CONCLUIDO: 'S', EM_ANDAMENTO: 'N', INCOMPLETO: 'I' };

/**
 * Os itens da lista de formação acadêmica (pkg_formacao.lista, f_tipo=FA).
 * Pós-doutorado e livre-docência ficam em outra lista (f_tipo=AP), não lida.
 */
const FORMACAO_ELEMENTS = new Set([
  'APERFEICOAMENTO',
  'CURSO-TECNICO-PROFISSIONALIZANTE',
  'DOUTORADO',
  'ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU',
  'ENSINO-MEDIO-SEGUNDO-GRAU',
  'ESPECIALIZACAO',
  'GRADUACAO',
  'MESTRADO',
  'MESTRADO-PROFISSIONALIZANTE',
  'RESIDENCIA-MEDICA',
]);

/**
 * Atributo do item → campo do GN_FORMACAO2. Os nomes dos campos foram lidos
 * no formulário do mestrado profissional; nos outros níveis, um campo que
 * não existir faz a conferência do "antes" falhar, e nada é enviado.
 */
const FORMACAO_FIELDS: Record<string, string> = {
  'ANO-DE-CONCLUSAO': 'f_ano_fim',
  'ANO-DE-INICIO': 'f_ano_ini',
  'ANO-DE-OBTENCAO-DO-TITULO': 'f_ano_obten',
  'STATUS-DO-CURSO': 'F_STATUS',
  'TITULO-DA-DISSERTACAO-TESE': 'f_titulo',
  'TITULO-DA-MONOGRAFIA': 'f_titulo',
  'TITULO-DA-RESIDENCIA-MEDICA': 'f_titulo',
  'TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO': 'f_titulo',
};

/**
 * Atributo comum a ENDERECO-PROFISSIONAL e ENDERECO-RESIDENCIAL → campo, sem
 * o sufixo. O logradouro tem um nome em cada elemento (XSD) e entra por
 * ENDERECO_STREET, para nenhum dos dois cair no logradouro do outro.
 */
const ENDERECO_FIELDS: Record<string, string> = {
  BAIRRO: 'f_bairro',
  'CAIXA-POSTAL': 'f_caixa',
  CEP: 'f_cep',
  CIDADE: 'f_munic',
  DDD: 'f_ddd',
  'E-MAIL': 'f_email',
  FAX: 'f_fax',
  'HOME-PAGE': 'f_homepage',
  RAMAL: 'f_ramal',
  TELEFONE: 'f_fone',
  UF: 'f_estado',
};

const ENDERECO_SUFFIX: Record<string, string> = {
  'ENDERECO-PROFISSIONAL': '_i',
  'ENDERECO-RESIDENCIAL': '_r',
};

const ENDERECO_STREET: Record<string, string> = {
  'ENDERECO-PROFISSIONAL': 'LOGRADOURO-COMPLEMENTO',
  'ENDERECO-RESIDENCIAL': 'LOGRADOURO',
};

/** Atributo de DADOS-GERAIS → campo do GN_IDENT. Só o nome tem campo com nome lido. */
const IDENTIFICACAO_FIELDS: Record<string, string> = { 'NOME-COMPLETO': 'f_nome' };

function mapFields(
  change: Change,
  table: Record<string, string>,
  map: (attr: string) => Mapper = () => same,
  suffix = '',
): { expect: FieldValues; missing: string[]; set: FieldValues } {
  const set: FieldValues = {};
  const expect: FieldValues = {};
  const missing: string[] = [];
  for (const f of change.fields) {
    const field = table[f.attr];
    if (!field) {
      missing.push(f.label);
      continue;
    }
    const name = `${field}${suffix}`;
    // Dois atributos no mesmo campo: um sobrescreveria o outro sem aviso.
    if (name in set) {
      missing.push(f.label);
      continue;
    }
    const m = map(f.attr);
    set[name] = m(f.after);
    expect[name] = m(f.before);
  }
  return { expect, missing, set };
}

const notYet = (missing: string[]) => ({
  reason: `Campos não suportados ainda: ${missing.join(', ')}`,
});

const statusMapper: Mapper = (v) => STATUS[v] ?? null;

function planFormacao(
  change: Change,
  el: XElement,
  label: string,
): FormacaoOp | { reason: string } {
  const seq = getAttr(el, 'SEQUENCIA-FORMACAO');
  const nivel = getAttr(el, 'NIVEL');
  if (!seq || !nivel) return { reason: 'Formação sem número de sequência ou nível' };
  for (const f of change.fields) {
    if (f.attr !== 'STATUS-DO-CURSO') continue;
    const unknown = [f.before, f.after].filter((v) => v && !STATUS[v]);
    if (unknown.length) return { reason: `Situação do curso não mapeada: ${unknown.join(', ')}` };
  }
  const { expect, missing, set } = mapFields(change, FORMACAO_FIELDS, (attr) =>
    attr === 'STATUS-DO-CURSO' ? statusMapper : same,
  );
  if (missing.length) return notYet(missing);
  // Conferência de identidade: o nível (oculto no formulário, igual ao NIVEL
  // da exportação: 3 mestrado, 1 graduação, 7 técnico, observado em
  // 11/10/2026) e o ano de início têm de bater.
  expect.f_nivel = nivel;
  if (!('f_ano_ini' in expect)) expect.f_ano_ini = getAttr(el, 'ANO-DE-INICIO') ?? '';
  return { expect, key: change.key, kind: 'formacao', label, seq, set };
}

function planEndereco(
  change: Change,
  element: string,
  label: string,
): EnderecoOp | { reason: string } {
  const table = { ...ENDERECO_FIELDS, [ENDERECO_STREET[element]!]: 'f_rua' };
  const suffix = ENDERECO_SUFFIX[element]!;
  const { expect, missing, set } = mapFields(change, table, undefined, suffix);
  if (missing.length) return notYet(missing);
  return { expect, key: change.key, kind: 'endereco', label, set };
}

function planIdentificacao(
  change: Change,
  el: XElement,
  label: string,
): IdentificacaoOp | { reason: string } {
  const { expect, missing, set } = mapFields(change, IDENTIFICACAO_FIELDS);
  if (missing.length) return notYet(missing);
  // O oculto f_nacionalidade recebe B ou E pelo JavaScript da página (seção
  // 5). Se o GET o trouxer vazio, o envio direto o mandaria vazio e apagaria
  // a nacionalidade: o "antes" tem de trazer o valor do XML, e sem B ou E no
  // XML não há com o que conferir, então segue à mão.
  const nacionalidade = getAttr(el, 'NACIONALIDADE');
  if (nacionalidade !== 'B' && nacionalidade !== 'E') {
    return { reason: 'Nacionalidade sem código B ou E no XML: não dá para conferir' };
  }
  expect.f_nacionalidade = nacionalidade;
  return { expect, key: change.key, kind: 'identificacao', label, set };
}

/**
 * Planeja uma alteração nos dados gerais. undefined quando o elemento não é
 * de formação, endereço ou identificação (o planejamento segue adiante).
 * `chain` é o caminho resolvido na cópia de trabalho, da raiz ao elemento.
 */
export function planBiographic(
  change: Change,
  chain: XElement[],
  label: string,
): BiographicOp | undefined | { reason: string } {
  const el = chain.at(-1);
  if (!el || el.name !== change.element || change.kind !== 'alterado') return undefined;
  if (FORMACAO_ELEMENTS.has(el.name) && chain.at(-2)?.name === 'FORMACAO-ACADEMICA-TITULACAO') {
    return planFormacao(change, el, label);
  }
  if (ENDERECO_SUFFIX[el.name]) return planEndereco(change, el.name, label);
  if (el.name === 'DADOS-GERAIS') return planIdentificacao(change, el, label);
  return undefined;
}

// ---------------------------------------------------------------- contrato

const text = (maxLength?: number): FieldSpec =>
  maxLength ? { maxLength, type: 'text' } : { type: 'text' };
const hidden: FieldSpec = { type: 'hidden' };

function enderecoFields(suffix: string): Record<string, FieldSpec> {
  return {
    [`f_bairro${suffix}`]: text(255),
    [`f_caixa${suffix}`]: text(),
    [`f_cep${suffix}`]: text(15),
    [`f_ddd${suffix}`]: text(),
    [`f_email${suffix}`]: text(70),
    [`f_estado${suffix}`]: text(10),
    [`f_fax${suffix}`]: text(),
    [`f_fone${suffix}`]: text(),
    [`f_homepage${suffix}`]: text(250),
    [`f_munic${suffix}`]: text(45),
    [`f_ramal${suffix}`]: text(),
    [`f_rua${suffix}`]: text(180),
  };
}

/**
 * Os três formulários, com os campos que as operações gravam e os de
 * controle. Parcial de propósito: os nomes e limites vêm de
 * docs/lattes_internals.md (seção 5) e do reconhecimento (seção 4.2); o tipo
 * "text" dos campos sem tipo anotado ali é inferido. Os campos que não estão
 * aqui aparecem como "campo novo" na verificação, que só avisa; o teste
 * acompanhado completa esta lista com o que a verificação mostrar.
 *
 * Na formação, o exemplar é a primeira linha da lista, de qualquer nível, e
 * pelo XSD o ano de obtenção e o título não existem em todos (técnico,
 * ensino médio). Por isso f_ano_obten e f_titulo ficam fora da conferência:
 * na gravação, um campo que não existir no formulário daquele nível faz o
 * "antes" não bater, e nada é enviado.
 */
export const BIOGRAPHIC_SPECS: Record<BiographicKind, FormSpec> = {
  endereco: {
    action: 'PRC_ENDERECO',
    fields: { ...enderecoFields('_i'), ...enderecoFields('_r'), f_ctr: hidden },
    name: 'GN_ENDERECO',
  },
  formacao: {
    action: 'pkg_formacao.FORM',
    fields: {
      f_ano_fim: text(),
      f_ano_ini: text(),
      f_cod: hidden,
      f_ctr: hidden,
      f_nivel: hidden,
      f_seq: hidden,
      F_STATUS: { type: 'radio' },
      f_tipo: hidden,
    },
    name: 'GN_FORMACAO2',
  },
  identificacao: {
    action: 'PRC_IDENT',
    fields: { f_ctr: hidden, f_nacionalidade: hidden, f_nome: text(60) },
    name: 'GN_IDENT',
  },
};

/** Procedimentos do menu que as operações usam. */
export const BIOGRAPHIC_MENU = ['pkg_formacao.lista', 'prc_endereco', 'prc_ident'];

/**
 * O que estes formulários acrescentam ao contrato (contract.ts): nada com a
 * chave desligada; os testes pedem com `enabled: true`.
 */
export function biographicContract(enabled: boolean = BIOGRAPHIC_OPS_ENABLED): {
  forms: Partial<Record<BiographicKind, FormSpec>>;
  menu: string[];
} {
  return enabled ? { forms: BIOGRAPHIC_SPECS, menu: BIOGRAPHIC_MENU } : { forms: {}, menu: [] };
}

// ---------------------------------------------------------------- caminho

type Get = (path: string) => Promise<string>;

/** Onde está o formulário: o caminho, o link que faltou, ou por que não há exemplar. */
export type SampleLookup = { link: string } | { none: string } | { path: string };

const MENU_PROC: Record<BiographicKind, string> = {
  endereco: 'prc_endereco',
  formacao: 'pkg_formacao.lista',
  identificacao: 'prc_ident',
};

/** Links de alteração da lista de formação acadêmica (os que têm f_seq). */
async function formacaoLinks(menu: string, get: Get) {
  const lista = findLinks(menu, MENU_PROC.formacao).find(
    (l) => l.params.f_tipo?.toUpperCase() === 'FA',
  );
  if (!lista) return undefined;
  return findLinks(await get(lista.path), 'pkg_formacao.form').filter(
    (l) => l.params.f_seq && (l.params.f_tipo ?? 'FA').toUpperCase() === 'FA',
  );
}

/** Um exemplar de cada formulário, para o contrato conferir só lendo. */
export async function biographicSample(
  kind: BiographicKind,
  menu: string,
  get: Get,
): Promise<SampleLookup> {
  if (kind !== 'formacao') {
    const link = findLinks(menu, MENU_PROC[kind])[0];
    return link ? { path: link.path } : { link: MENU_PROC[kind] };
  }
  const forms = await formacaoLinks(menu, get);
  if (!forms) return { link: MENU_PROC.formacao };
  const first = forms[0];
  return first ? { path: first.path } : { none: 'O currículo não tem formação acadêmica' };
}

const NAMES: Record<BiographicKind, string> = {
  endereco: 'Endereço',
  formacao: 'Formação acadêmica',
  identificacao: 'Identificação',
};

/**
 * Caminho do formulário da operação, seguindo os links do próprio Lattes. Não
 * achar lança um Error com o motivo; `get` já para quando a sessão caiu.
 */
export async function locateBiographic(op: BiographicOp, menu: string, get: Get): Promise<string> {
  if (op.kind !== 'formacao') {
    const link = findLinks(menu, MENU_PROC[op.kind])[0];
    if (!link) throw new Error(`${NAMES[op.kind]} não encontrado no menu do Lattes`);
    return link.path;
  }
  const forms = await formacaoLinks(menu, get);
  if (!forms) throw new Error('Formação acadêmica não encontrada no menu do Lattes');
  const hits = forms.filter((l) => l.params.f_seq === op.seq);
  if (hits.length !== 1) {
    throw new Error(`Formação ${op.seq} não encontrada no Lattes (${hits.length} achadas)`);
  }
  return hits[0]!.path;
}

// ---------------------------------------------------------------- rótulos

/** Nomes dos campos, para a confirmação e o registro do enviado. */
export const BIOGRAPHIC_FIELD_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries({
      f_bairro: 'Bairro',
      f_caixa: 'Caixa postal',
      f_cep: 'CEP',
      f_ddd: 'DDD',
      f_email: 'E-mail',
      f_estado: 'UF',
      f_fax: 'Fax',
      f_fone: 'Telefone',
      f_homepage: 'Página na internet',
      f_munic: 'Cidade',
      f_ramal: 'Ramal',
      f_rua: 'Logradouro',
    }).flatMap(([name, label]) => [
      [`${name}_i`, `${label} (profissional)`],
      [`${name}_r`, `${label} (residencial)`],
    ]),
  ),
  f_ano_obten: 'Ano de obtenção do título',
  f_nome: 'Nome completo',
  F_STATUS: 'Situação do curso',
  f_titulo: 'Título do trabalho',
};

export const BIOGRAPHIC_VALUE_LABELS: Record<string, Record<string, string>> = {
  F_STATUS: { I: 'Incompleto', N: 'Em andamento', S: 'Concluído' },
};
