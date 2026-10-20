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
import type { XElement } from '../model/xml.ts';
import listas from '../schema/listas-lattes.json' with { type: 'json' };
import type { FieldSpec, FormSpec } from './contract.ts';
import {
  CURRICULO_REASON,
  ENDERECO_SUFFIX,
  type EnderecoOp,
  type IdentificacaoOp,
  type OutrasInformacoesOp,
  planEnderecoEdit,
  planIdentificacaoEdit,
  planOutrasInformacoes,
} from './dados-gerais-edit.ts';
import { countryName } from './edit-items.ts';
import { type FormacaoOp, type FormationList, planFormacaoEdit } from './formacao-edit.ts';
import { findLinks } from './lattes-html.ts';
import type { BridgeOp } from './plan.ts';

export type { EnderecoOp, IdentificacaoOp, OutrasInformacoesOp } from './dados-gerais-edit.ts';
export type { FormacaoOp } from './formacao-edit.ts';

/**
 * Ligada para o teste ao vivo, antes de um teste acompanhado num Lattes real.
 * O plano só a usa com a capacidade `alterar-dados-gerais` da extensão
 * (plan.ts). Desligada, o planejamento manda essas mudanças para o caminho à
 * mão e o contrato não confere esses formulários.
 */
export const BIOGRAPHIC_OPS_ENABLED = true;

/**
 * O que a LAT-58 acrescentou e uma extensão mais antiga gravaria errado ou não
 * saberia achar: a formação com instituição, curso ou agência pelas buscas (a
 * extensão antiga mandaria o formulário sem eles e conferiria assim mesmo), a
 * lista de pós-doutorado e livre-docência, e as outras informações relevantes.
 * Ligada para o teste ao vivo; o app só manda essas operações a uma extensão
 * que anuncia 'alterar-dados-gerais-completo' (plan.ts, GATED_EDITS).
 */
export const BIOGRAPHIC_FULL_ENABLED = true;

/** A operação precisa de BIOGRAPHIC_FULL_ENABLED dos dois lados. */
export function needsFullBiographic(op: BiographicOp): boolean {
  return (
    op.kind === 'outras-informacoes' ||
    (op.kind === 'formacao' && (op.lookups !== undefined || op.list === 'AP'))
  );
}

export type BiographicOp = EnderecoOp | FormacaoOp | IdentificacaoOp | OutrasInformacoesOp;

export type BiographicKind = BiographicOp['kind'];

const KINDS: ReadonlySet<string> = new Set<BiographicKind>([
  'endereco',
  'formacao',
  'identificacao',
  'outras-informacoes',
]);

export function isBiographicKind(kind: string): kind is BiographicKind {
  return KINDS.has(kind);
}

export function isBiographicOp(op: BridgeOp): op is BiographicOp {
  return isBiographicKind(op.kind);
}

/**
 * Os itens das listas de formação (pkg_formacao.lista): f_tipo=FA, e
 * pós-doutorado e livre-docência em f_tipo=AP (formacao-edit.ts).
 */
export const FORMACAO_ELEMENTS = new Set([
  'APERFEICOAMENTO',
  'LIVRE-DOCENCIA',
  'POS-DOUTORADO',
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
 * Planeja uma alteração nos dados gerais. undefined quando o elemento não é
 * de formação, endereço ou identificação (o planejamento segue adiante).
 * `chain` é o caminho resolvido na cópia de trabalho, da raiz ao elemento.
 */
export function planBiographic(
  change: Change,
  chain: XElement[],
  label: string,
  full = false,
): BiographicOp | undefined | { reason: string } {
  const planned = planBiographicOp(change, chain, label);
  if (!full && planned && 'kind' in planned && needsFullBiographic(planned)) {
    return {
      reason:
        'Instituição, curso e agência pelas buscas, pós-doutorado, livre-docência e outras informações relevantes pedem a extensão do conector atualizada',
    };
  }
  return planned;
}

function planBiographicOp(
  change: Change,
  chain: XElement[],
  label: string,
): BiographicOp | undefined | { reason: string } {
  const el = chain.at(-1);
  if (!el || el.name !== change.element || change.kind !== 'alterado') return undefined;
  if (FORMACAO_ELEMENTS.has(el.name) && chain.at(-2)?.name === 'FORMACAO-ACADEMICA-TITULACAO') {
    return planFormacaoEdit(change, el, label);
  }
  if (ENDERECO_SUFFIX[el.name] || el.name === 'ENDERECO') {
    return planEnderecoEdit(change, el.name, label);
  }
  if (el.name === 'DADOS-GERAIS') return planIdentificacaoEdit(change, el, label);
  if (el.name === 'OUTRAS-INFORMACOES-RELEVANTES') return planOutrasInformacoes(change, label);
  if (el.name === 'CURRICULO-VITAE') return { reason: CURRICULO_REASON };
  return undefined;
}

// ---------------------------------------------------------------- contrato

const text = (maxLength?: number): FieldSpec =>
  maxLength ? { maxLength, type: 'text' } : { type: 'text' };
const hidden: FieldSpec = { type: 'hidden' };

const select: FieldSpec = { type: 'select-one' };

/** Os campos de um dos dois endereços, pelo censo de 15/10/2026. */
function enderecoFields(suffix: string): Record<string, FieldSpec> {
  return {
    [`f_bairro${suffix}`]: text(255),
    [`f_caixa${suffix}`]: text(10),
    [`f_cep${suffix}`]: text(15),
    [`f_cidade${suffix}`]: hidden,
    [`f_cod_munic${suffix}`]: hidden,
    [`f_ddd_cel${suffix}`]: text(5),
    [`f_ddd${suffix}`]: text(5),
    [`f_email${suffix}`]: text(70),
    [`f_estado${suffix}_old`]: hidden,
    [`f_estado${suffix}`]: text(10),
    [`f_fax${suffix}`]: text(10),
    [`f_fone_cel${suffix}`]: text(10),
    [`f_fone${suffix}`]: text(10),
    [`f_homepage${suffix}`]: text(250),
    [`f_munic${suffix}_old`]: hidden,
    [`f_munic${suffix}`]: text(45),
    [`f_pais${suffix}_old`]: hidden,
    [`f_pais${suffix}`]: select,
    [`f_priv_email${suffix}`]: select,
    [`f_ramal${suffix}`]: text(5),
    [`f_rua${suffix}`]: text(180),
  };
}

/**
 * O resto do formulário de endereço: instituição, visibilidade, endereço de
 * correspondência e os campos de controle da página.
 */
const ENDERECO_EXTRA: Record<string, FieldSpec> = {
  f_cod: hidden,
  f_cod_inst: hidden,
  f_cod_inst2: hidden,
  f_codorgao: hidden,
  f_codorgao2: hidden,
  f_ctr: hidden,
  f_dados_grid: hidden,
  f_dados_grid_contatos: hidden,
  f_end_corr: { type: 'radio' },
  f_inst: text(75),
  f_inst_old: hidden,
  f_orgao: text(),
  f_orgao_old: hidden,
  f_origem: hidden,
  f_priv_profissional: select,
  f_priv_residencial: select,
  modal2: hidden,
};

/**
 * O formulário de identificação inteiro, como o censo de 15/10/2026 o leu.
 * f_pcd aparece duas vezes, como caixa e como oculto; a impressão digital fica
 * com o primeiro, que na página é o oculto: a verificação de 16/10/2026 no
 * Lattes real acusou "f_pcd era checkbox, agora hidden".
 */
const IDENT_FIELDS: Record<string, FieldSpec> = {
  f_cidade_nasc: text(30),
  f_cod: hidden,
  f_cpf: hidden,
  f_ctr: hidden,
  f_dados_grid: hidden,
  f_dta_emissao_doc: text(10),
  f_dta_nasc: text(10),
  f_dta_rg: text(10),
  f_dta_val_passaporte: text(10),
  f_nacionalidade: hidden,
  f_nme_old: hidden,
  f_nome: text(60),
  f_nome_citacao: hidden,
  f_nome_citacao_h: hidden,
  f_nome_mae: hidden,
  f_nome_pai: hidden,
  f_nome_social: text(60),
  f_nome_social_r: { type: 'radio' },
  f_orgao_rg: text(8),
  f_pais_nacio: select,
  f_pais_nasc: select,
  f_passaporte: text(20),
  f_pcd: hidden,
  f_pcd_r: { type: 'radio' },
  f_priv_cor: select,
  f_priv_foto: select,
  f_priv_identidade: select,
  f_priv_nacionalidade: select,
  f_priv_nascimento: select,
  f_priv_passaporte: select,
  f_priv_pcd: select,
  f_rg_nro: text(15),
  f_sexo: { type: 'radio' },
  f_uf_nasc: select,
  f_uf_rg: select,
  fdados_new: hidden,
  fnro_id_raca_cor: select,
  fpaispassaporte: select,
};

/**
 * Os três formulários, com os campos que as operações gravam e os de
 * controle. Os nomes e limites vêm de docs/lattes_internals.md (seção 5) e do
 * reconhecimento (seção 4.2); o tipo "text" dos campos sem tipo anotado ali é
 * inferido. O endereço tem o formulário inteiro, como o censo de 15/10/2026 o
 * leu (docs/lattes-formularios/), e a identificação também; um teste confere
 * os dois. Na formação, os campos que não estão aqui aparecem como "campo
 * novo" na verificação, que só avisa.
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
    fields: { ...enderecoFields('_i'), ...enderecoFields('_r'), ...ENDERECO_EXTRA },
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
    // Só estes campos vão no envio; os outros do formulário seguem como estão.
    partial: true,
  },
  identificacao: {
    action: 'PRC_IDENT',
    fields: IDENT_FIELDS,
    name: 'GN_IDENT',
  },
  // O formulário inteiro, como o censo de 15/10/2026 o leu.
  'outras-informacoes': {
    action: 'PRC_OUTRAS_INF',
    fields: { f_cod: hidden, f_ctr: hidden, F_TEXTO: { maxLength: 2000, type: 'textarea' } },
    name: 'GN_OUTRA_INF_RELEV',
  },
};

/** Procedimentos do menu que as operações usam. */
export const BIOGRAPHIC_MENU = [
  'pkg_formacao.lista',
  'prc_endereco',
  'prc_ident',
  'prc_outras_inf',
];

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
  'outras-informacoes': 'prc_outras_inf',
};

/** Links de alteração de uma das listas de formação (os que têm f_seq). */
async function formacaoLinks(menu: string, get: Get, list: FormationList = 'FA') {
  const lista = findLinks(menu, MENU_PROC.formacao).find(
    (l) => l.params.f_tipo?.toUpperCase() === list,
  );
  if (!lista) return undefined;
  return findLinks(await get(lista.path), 'pkg_formacao.form').filter(
    (l) => l.params.f_seq && (l.params.f_tipo ?? list).toUpperCase() === list,
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
  'outras-informacoes': 'Formulário de outras informações relevantes',
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
  const forms = await formacaoLinks(menu, get, op.list);
  if (!forms) {
    throw new Error(
      op.list === 'AP'
        ? 'Pós-doutorado e livre-docência não encontrados no menu do Lattes'
        : 'Formação acadêmica não encontrada no menu do Lattes',
    );
  }
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
  f_cidade_nasc: 'Cidade de nascimento',
  f_cod_inst_dout: 'Instituição do sanduíche',
  f_cod_inst2_dout: 'Instituição do sanduíche',
  f_curso_old: 'Curso',
  f_dta_nasc: 'Data de nascimento',
  f_dta_rg: 'Data de emissão da identidade',
  f_end_corr: 'Endereço para correspondência',
  f_inst_old: 'Instituição',
  f_nacionalidade: 'Nacionalidade',
  f_nivel: 'Nível',
  f_nome: 'Nome completo',
  f_nome_citacao: 'Nome em citações bibliográficas',
  f_nome_citacao_h: 'Nome em citações bibliográficas (cópia oculta)',
  f_orgao_rg: 'Órgão emissor',
  f_orient_dout: 'Orientador no sanduíche',
  f_orient_dout_ct: 'Orientador na cotutela',
  f_orient_dout_sw: 'Orientador do sanduíche',
  f_pais_i: 'País (profissional)',
  f_pais_nacio: 'País de nacionalidade',
  f_pais_nasc: 'País de nascimento',
  f_pais_r: 'País (residencial)',
  f_passaporte: 'Número do passaporte',
  f_rg_nro: 'Número da identidade',
  f_sexo: 'Sexo',
  F_STATUS: 'Situação do curso',
  f_titulo: 'Título do trabalho',
  f_uf_nasc: 'UF de nascimento',
  f_uf_rg: 'UF do órgão emissor',
  fnro_id_raca_cor: 'Cor ou raça',
};

/** Rótulos que dependem do formulário (field-labels.ts, KIND_FIELD_LABELS). */
export const BIOGRAPHIC_KIND_FIELD_LABELS: Record<string, Record<string, string>> = {
  'outras-informacoes': { F_TEXTO: 'Outras informações relevantes' },
};

const COUNTRIES = Object.fromEntries(
  Object.values(listas.codigosDosPaises).map((code) => [code, countryName(code) ?? code]),
);

export const BIOGRAPHIC_VALUE_LABELS: Record<string, Record<string, string>> = {
  f_end_corr: { I: 'Profissional', R: 'Residencial' },
  f_pais_i: COUNTRIES,
  f_pais_nacio: COUNTRIES,
  f_pais_nasc: COUNTRIES,
  f_pais_r: COUNTRIES,
  f_sexo: { F: 'Feminino', M: 'Masculino' },
  F_STATUS: { I: 'Incompleto', N: 'Em andamento', S: 'Concluído' },
  // As opções de fnro_id_raca_cor (censo de 15/10/2026).
  fnro_id_raca_cor: {
    '1': 'Branca',
    '2': 'Preta',
    '3': 'Parda',
    '4': 'Indígena',
    '5': 'Amarela',
    '6': 'Não desejo declarar',
  },
};
