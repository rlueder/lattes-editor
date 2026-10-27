// Incluir um projeto no Lattes pelo conector (LAT-52), atrás de
// CREATE_ITEMS_ENABLED (create.ts). Lista, formulário e a janela das
// instituições das atuações: docs/lattes_internals.md, seção 17. Inferido até
// o teste acompanhado: a resposta do POST, o servidor pendurar o projeto na
// atuação da instituição escolhida e o projeto novo aparecer na lista. A
// equipe leva a própria pessoa como coordenadora (seção 22).

import type { Change } from '../model/changes.ts';
import { childElements, firstChild, getAttr, walk, type XElement } from '../model/xml.ts';
import type { LattesPort, OpResult } from './apply.ts';
import {
  NO_OWNER_NAME,
  ownerAuthor,
  ownerGridRow,
  type OwnerNames,
  ownerNamesOf,
  serializeGrid,
  TEAM_KEYS,
} from './author-grid.ts';
import type { FormSpec } from './contract.ts';
import { CREATE_FIELD_LABELS } from './create-labels.ts';
import {
  absentFields,
  type CreateOpBase,
  filledChildren,
  getChecked,
  hidden,
  jsCalls,
  labelIn,
  mapAttrs,
  type Mapper,
  maybeCreated,
  overLimit,
  type Planned,
  radio,
  readBack,
  readBackProblem,
  readPairs,
  reasonFrom,
  type Result,
  same,
  sameCode,
  select,
  SESSION,
  Stop,
  text,
} from './create-shared.ts';
import { encodeLatin1Form, pairValue, setPairs } from './form.ts';
import { foldText } from './html-text.ts';
import { findLinks, isLogonPage, type LattesLink } from './lattes-html.ts';
import { organsPath } from './organ-windows.ts';
import type { FieldValues } from './plan.ts';
import { ORGAN_PARTS, organLoose, resolveOrgan } from './production/organ.ts';

export interface CreateProjetoOp extends CreateOpBase {
  kind: 'criar-projeto';
  /** f_cod_tipo da lista e do formulário: P pesquisa, D desenvolvimento… */
  nature: string;
  /**
   * O órgão ou a unidade escolhidos na janela de órgãos (OrganField no
   * editor), com o órgão de cima de uma unidade: o check() da inclusão o exige.
   */
  organ?: { code: string; parent?: string };
  /** O nome completo e as citações do currículo, para conferir a linha de autor do menu. */
  owner: OwnerNames;
}

// Projeto -------------------------------------------------------------------------

/** NATUREZA do XML → f_cod_tipo da lista e F_TPO_NATUREZA do formulário (pelos rótulos). */
const PROJECT_NATURE: Record<string, string> = {
  DESENVOLVIMENTO: 'D',
  ENSINO: 'N',
  EXTENSAO: 'E',
  OUTRA: 'O',
  PESQUISA: 'P',
};

/** SITUACAO do XML → F_TPO_SITUACAO (pelos rótulos). */
const PROJECT_SITUATION: Record<string, string> = {
  CONCLUIDO: 'C',
  DESATIVADO: 'D',
  EM_ANDAMENTO: 'A',
};

/** Atributo do PROJETO-DE-PESQUISA → campo do GN_PROJETO (tabela da seção 17). */
const PROJECT_FIELDS: Record<string, [string, Mapper]> = {
  'ANO-FIM': ['F_ANO_FIM', same],
  'ANO-INICIO': ['F_ANO_INIC', same],
  'DESCRICAO-DO-PROJETO': ['f_ref', same],
  'DESCRICAO-DO-PROJETO-INGLES': ['f_ref_en', same],
  // Com SIM, o formulário pede o texto do potencial (f_txt_potencial), que o XML não tem.
  'FLAG-POTENCIAL-INOVACAO': ['f_sta_inovacao', (v) => (v === 'NAO' ? 'N' : undefined)],
  NATUREZA: ['F_TPO_NATUREZA', (v) => PROJECT_NATURE[v]],
  'NOME-DO-PROJETO': ['f_titulo', same],
  'NOME-DO-PROJETO-INGLES': ['f_titulo_en', same],
  'NUMERO-DOUTORADO': ['F_NRO_DOUTORADO', same],
  'NUMERO-ESPECIALIZACAO': ['F_NRO_ESPECIALIZACAO', same],
  'NUMERO-GRADUACAO': ['F_NRO_GRADUACAO', same],
  'NUMERO-MESTRADO-ACADEMICO': ['F_NRO_MESTRADO_ACAD', same],
  'NUMERO-MESTRADO-PROF': ['F_NRO_MESTRADO_PROF', same],
  SITUACAO: ['F_TPO_SITUACAO', (v) => PROJECT_SITUATION[v]],
};

const PROJECT_HANDLED = new Set(['FORMATO-DATA-CERTIFICACAO', 'SEQUENCIA-PROJETO']);

/**
 * O que o editor põe na participação nova a partir do projeto
 * (src/model/general-items.ts), e o órgão e a unidade escolhidos na lista.
 */
const PARTICIPATION_FROM_PROJECT = new Set([
  'ANO-FIM',
  'ANO-INICIO',
  'FLAG-PERIODO',
  'SEQUENCIA-FUNCAO-ATIVIDADE',
  ...Object.values(ORGAN_PARTS.organ),
  ...Object.values(ORGAN_PARTS.unit),
]);

/**
 * Projeto novo com o órgão pelo conector: só a uma extensão com
 * 'projeto-novo-orgao'. Uma mais antiga mandaria a inclusão sem ele.
 */
export const CREATE_PROJECT_ORGAN_ENABLED = true;

/** Mudanças "novo" que trazem um projeto: o próprio, a participação ou o contêiner dela. */
export const PROJECT_CARRIERS = new Set([
  'ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO',
  'PARTICIPACAO-EM-PROJETO',
  'PROJETO-DE-PESQUISA',
]);

/** A equipe tem só o dono do currículo (pelo ID Lattes ou, sem ele, pelo nome)? */
function onlyOwner(projeto: XElement, root: XElement | undefined): boolean {
  const equipe = firstChild(projeto, 'EQUIPE-DO-PROJETO');
  const members = equipe ? childElements(equipe, 'INTEGRANTES-DO-PROJETO') : [];
  if (members.length === 0) return true;
  if (members.length > 1 || !root) return false;
  const member = members[0]!;
  const ownerId = getAttr(root, 'NUMERO-IDENTIFICADOR') ?? '';
  const memberId = getAttr(member, 'NRO-ID-CNPQ') ?? '';
  if (ownerId && memberId) return ownerId === memberId;
  const dg = firstChild(root, 'DADOS-GERAIS');
  const ownerName = (dg && getAttr(dg, 'NOME-COMPLETO')) ?? '';
  return (
    foldText(ownerName) !== '' &&
    foldText(ownerName) === foldText(getAttr(member, 'NOME-COMPLETO') ?? '')
  );
}

/** Por que o projeto criado fica divergente: a equipe não é relida. */
export const TEAM_UNREAD =
  'Criado no Lattes, com os campos conferidos; confira a equipe no Lattes, que o conector não relê';

/** Por que o projeto novo vai à mão sem o órgão (seções 21 e 22 de docs/lattes_internals.md). */
export const TEAM_BY_HAND =
  'O Lattes exige o órgão ou unidade na inclusão do projeto: escolha na lista do Lattes, em Órgão';

/**
 * Um projeto novo como inclusão; o motivo, quando vai à mão. O check() do
 * formulário exige, na inclusão, o órgão ou unidade (a janela
 * pp_orgao_cargo), escolhido no editor pela lista do Lattes. A equipe leva a
 * própria pessoa como coordenadora, pela linha dela no autorDP do menu
 * (seção 22).
 */
export function planCreateProjeto(
  change: Change,
  chain: XElement[],
  label: string,
): Planned<CreateProjetoOp> {
  const op = projetoOp(change, chain, label);
  if ('reason' in op) return op;
  return op.organ ? op : { reason: TEAM_BY_HAND };
}

/**
 * Um projeto novo como operação de inclusão. `chain` vai da raiz ao elemento
 * novo; o projeto entra pela atuação dele, como o Lattes faz pela instituição
 * escolhida no formulário (seção 17).
 */
export function projetoOp(
  change: Change,
  chain: XElement[],
  label: string,
): Planned<CreateProjetoOp> {
  const el = chain.at(-1)!;
  // Cada projeto com o caminho inteiro desde a raiz: a mudança pode ser o
  // contêiner das participações, e aí a participação fica abaixo dela.
  const projetos: { node: XElement; path: XElement[] }[] = [];
  walk(el, (node, ancestors) => {
    if (node.name === 'PROJETO-DE-PESQUISA') {
      projetos.push({ node, path: [...chain.slice(0, -1), ...ancestors] });
    }
  });
  if (projetos.length !== 1) return { reason: 'A inclusão pelo conector leva um projeto por vez' };
  const { node: projeto, path } = projetos[0]!;
  const atuacao = chain.find((c) => c.name === 'ATUACAO-PROFISSIONAL');
  const institutionCode = atuacao && getAttr(atuacao, 'CODIGO-INSTITUICAO');
  const institutionName = atuacao && getAttr(atuacao, 'NOME-INSTITUICAO');
  if (!institutionCode || !institutionName) {
    return { reason: 'A atuação do projeto não tem o código da instituição do Lattes' };
  }
  const nature = PROJECT_NATURE[getAttr(projeto, 'NATUREZA') ?? ''];
  if (!nature) return { reason: 'Escolha a natureza do projeto' };
  if (!onlyOwner(projeto, chain[0])) {
    return {
      reason: 'Equipe além de você ainda vai à mão: o conector não monta a grade da equipe',
    };
  }
  if (filledChildren(projeto, ['EQUIPE-DO-PROJETO']).length > 0) {
    return { reason: 'Financiadores, produções e orientações do projeto ainda vão à mão' };
  }
  // A participação que embrulha o projeto: o editor só põe nela o número, o
  // período em ano e se é atual, que seguem o projeto. Órgão, unidade e meses
  // não têm lugar no formulário de projeto e não podem sumir sem aviso.
  const participacao = path.find((c) => c.name === 'PARTICIPACAO-EM-PROJETO');
  const extra = (participacao?.attrs ?? []).filter(
    (a) => a.value.trim() && !PARTICIPATION_FROM_PROJECT.has(a.name),
  );
  if (extra.length > 0) {
    return {
      reason: `A participação no projeto tem campos que o formulário não leva: ${extra.map((a) => labelIn(change, a.name)).join(', ')}`,
    };
  }
  const { missing, set, wrong } = mapAttrs(change, projeto, PROJECT_FIELDS, PROJECT_HANDLED);
  const reason = reasonFrom(missing, wrong);
  if (reason) return { reason };
  // Sem ano de fim (projeto em andamento), o campo vai vazio: senão ficaria o
  // fim do vínculo, que preencherOpener copia para F_ANO_FIM.
  set.F_ANO_FIM = getAttr(projeto, 'ANO-FIM') ?? '';
  if (!set.f_titulo || !set.F_ANO_INIC || !set.F_TPO_SITUACAO) {
    return { reason: 'O projeto precisa de nome, situação e ano de início' };
  }
  const owner = ownerNamesOf(chain[0]);
  if (!owner) return { reason: NO_OWNER_NAME };
  // O órgão, ou a unidade com o órgão de cima, como a lista do editor os grava.
  const part = (attr: string) => (participacao && getAttr(participacao, attr)?.trim()) ?? '';
  const organCode = part(ORGAN_PARTS.organ.code);
  const unitCode = part(ORGAN_PARTS.unit.code);
  if (!organCode && (part(ORGAN_PARTS.organ.name) || part(ORGAN_PARTS.unit.name))) {
    return { reason: 'Órgão e unidade: escolha pela lista do Lattes, que grava o código junto' };
  }
  const organ = organCode
    ? unitCode && unitCode !== organCode
      ? { code: unitCode, parent: organCode }
      : { code: organCode }
    : undefined;
  return {
    expect: {},
    institutionCode,
    institutionName,
    key: change.key,
    kind: 'criar-projeto',
    label,
    nature,
    ...(organ ? { organ } : {}),
    owner,
    set,
  };
}

/** O formulário de inclusão do projeto (tabela da seção 17). */
export const CREATE_PROJETO_SPEC: FormSpec & { mode: string; partial: true } = {
  action: 'PKG_PROJETO.FORM',
  fields: {
    F_ANO_FIM: text(4),
    F_ANO_INIC: text(4),
    f_autores_l: hidden,
    f_carga: hidden,
    f_cod: hidden,
    f_cod_inst: hidden,
    f_cod_inst2: hidden,
    f_cod_tipo: hidden,
    f_codinst: hidden,
    f_codorgao: hidden,
    f_codorgao2: hidden,
    f_ctr: hidden,
    f_enqua: hidden,
    f_inst: text(75),
    f_inst_l: hidden,
    f_inst_old: hidden,
    f_instituicoes: hidden,
    f_instold: hidden,
    F_NRO_DOUTORADO: text(2),
    F_NRO_ESPECIALIZACAO: text(2),
    F_NRO_GRADUACAO: text(2),
    F_NRO_MESTRADO_ACAD: text(2),
    F_NRO_MESTRADO_PROF: text(2),
    f_orgao_old: hidden,
    f_ref: { maxLength: 3900, type: 'textarea' },
    f_ref_en: { maxLength: 3900, type: 'textarea' },
    f_regime: hidden,
    f_seq_ativ: hidden,
    f_seq_funcao: hidden,
    f_seq_proj: hidden,
    f_sta_inovacao: radio,
    f_stavinc: hidden,
    f_tipo_privacidade: select,
    f_titulo: text(255),
    f_titulo_en: text(255),
    F_TPO_NATUREZA: select,
    F_TPO_SITUACAO: select,
    f_txt_potencial: text(400),
    f_vinc: hidden,
  },
  mode: 'I',
  name: 'GN_PROJETO',
  partial: true,
};

// Projeto no Lattes ------------------------------------------------------------------

const PROJETO_FORM = 'GN_PROJETO';

/** Os parâmetros do link "Incluir novo item" da lista de projetos (seção 17). */
const INCLUSION_PARAMS = new Set([
  'f_cod',
  'f_cod_tipo',
  'f_sta_inovacao',
  'f_tematica',
  'f_tpo_acao_inov',
  'f_tpo_cooperacao',
]);

/**
 * O link de inclusão tem só esses parâmetros; uma linha de projeto existente
 * traz algo a mais (a sequência). Como é esse algo não foi visto: a lista do
 * currículo mapeado estava vazia.
 */
export const isInclusion = (l: LattesLink) =>
  Object.keys(l.params).every((k) => INCLUSION_PARAMS.has(k));

const projectRows = (html: string) =>
  findLinks(html, 'PKG_PROJETO.form').filter((l) => !isInclusion(l));

/**
 * As instituições das atuações que a janela pp_lista_inst oferece: cada uma
 * chama preencherOpener(enqua, regime, stavinc, ano_inic, ano_fim, carga,
 * vinc, código, nome), que copia o vínculo para os ocultos (seção 17).
 */
export function vinculoChoices(html: string) {
  return jsCalls(html, 'preencherOpener')
    .filter((a) => a.length === 9)
    .map(([enqua, regime, stavinc, anoInic, anoFim, carga, vinc, code, name]) => ({
      anoFim: anoFim!,
      anoInic: anoInic!,
      carga: carga!,
      code: code!,
      enqua: enqua!,
      name: name!,
      regime: regime!,
      stavinc: stavinc!,
      vinc: vinc!,
    }));
}

export async function applyCreateProjeto(op: CreateProjetoOp, port: LattesPort): Promise<Result> {
  const result = (status: OpResult['status'], detail: string): Result => ({
    detail,
    key: op.key,
    status,
  });
  try {
    const menu = await port.menuHtml();
    const lista = findLinks(menu, 'pkg_projeto.lista').find(
      (l) => (l.params.f_cod_tipo ?? '').toUpperCase() === op.nature,
    );
    if (!lista?.params.f_cod) {
      throw new Stop('erro', 'A lista de projetos dessa natureza não está no menu do Lattes');
    }
    const cv = lista.params.f_cod;
    const listaHtml = await getChecked(port, lista.path);
    const inclusion = findLinks(listaHtml, 'PKG_PROJETO.form').find(isInclusion);
    if (!inclusion) throw new Stop('erro', 'Inclusão de projeto não encontrada na lista do Lattes');
    const before = projectRows(listaHtml);
    for (const row of before) {
      const { pairs } = await readPairs(port, row.path, PROJETO_FORM);
      if (foldText(pairValue(pairs, 'f_titulo') ?? '') === foldText(op.set.f_titulo ?? '')) {
        return result('divergente', 'O Lattes já tem um projeto com esse nome');
      }
    }

    const form = await readPairs(port, inclusion.path, PROJETO_FORM);
    if (
      pairValue(form.pairs, 'f_ctr') !== 'I' ||
      (pairValue(form.pairs, 'f_cod_tipo') ?? '').toUpperCase() !== op.nature
    ) {
      return result('erro', 'O formulário não é o de inclusão desta natureza');
    }
    const absent = absentFields(form.controls, op.set);
    if (absent.length > 0) {
      return result(
        'erro',
        `O formulário de projeto não tem: ${absent.map((f) => CREATE_FIELD_LABELS[f] ?? f).join(', ')}`,
      );
    }

    // A instituição sai da janela das atuações do currículo. O código vai sem a
    // letra: em f_cod_inst quando a letra é V, em f_cod_inst2 nos outros casos.
    const choices = vinculoChoices(
      await getChecked(port, `PKG_PROJETO.pp_lista_inst?f_pgm=INSTVINCULO&f_cod=${cv}`),
    ).filter((c) => sameCode(c.code, op.institutionCode));
    if (choices.length !== 1) {
      return result(
        'erro',
        `A atuação do projeto não está na lista do Lattes (${choices.length} achadas com o código)`,
      );
    }
    const v = choices[0]!;
    // Os anos do vínculo que preencherOpener copia ficam por baixo dos do projeto.
    const set: FieldValues = {
      F_ANO_FIM: v.anoFim,
      F_ANO_INIC: v.anoInic,
      f_carga: v.carga,
      f_enqua: v.enqua,
      f_inst: v.name,
      f_inst_old: v.name,
      f_regime: v.regime,
      f_stavinc: v.stavinc,
      f_vinc: v.vinc,
      [v.code.startsWith('V') ? 'f_cod_inst' : 'f_cod_inst2']: v.code.slice(1),
      ...op.set,
    };
    const limit = overLimit(form.controls, set);
    if (limit) return result('erro', limit);
    // O órgão pela janela de órgãos da instituição escolhida, como o orgao() e
    // o atribuir() da página (lidos em 27/10/2026): o código em f_codorgao (ou
    // f_codorgao2) e o texto em f_orgao_old. Fica fora do set: a página de
    // alteração traz esses ocultos vazios e mostra o órgão só em f_orgao.
    let organ: { set: FieldValues; shown?: string } = { set: {} };
    if (op.organ) {
      const resolved = await resolveOrgan(
        { before: '', beforeText: '', ...op.organ },
        port,
        form.pairs,
        '',
        { institution: v.code, path: organsPath },
      );
      if ('status' in resolved) return result(resolved.status, resolved.detail);
      organ = { set: resolved.set, shown: resolved.shown };
    }
    // A própria pessoa na equipe, como coordenadora (tit "s"): o check() exige
    // a pessoa e um coordenador, e a inclusão abre a grade vazia (seção 22).
    const owner = ownerAuthor(menu, op.owner);
    if ('reason' in owner) return result('erro', owner.reason);
    const team = serializeGrid([ownerGridRow(owner.owner, { tit: 's' })], TEAM_KEYS);
    const response = await port.post(
      CREATE_PROJETO_SPEC.action,
      encodeLatin1Form(setPairs(form.pairs, { ...set, ...organ.set, f_autores_l: team })),
    );
    if (isLogonPage(response)) return result('sessao', SESSION);

    try {
      const known = new Set(before.map((l) => l.path));
      const created = projectRows(await getChecked(port, lista.path)).filter(
        (l) => !known.has(l.path),
      );
      if (created.length !== 1) {
        return maybeCreated(
          op.key,
          'O projeto pode ter sido criado',
          `a lista mostra ${created.length} projetos novos`,
        );
      }
      // O nome do parâmetro da sequência no link é inferido do oculto f_seq_proj.
      const seq = created[0]!.params.f_seq_proj;
      const assigned = seq ? { 'SEQUENCIA-PROJETO': seq } : undefined;
      const saved = await readPairs(port, created[0]!.path, PROJETO_FORM);
      // Tudo o que foi enviado, com a instituição e o vínculo da atuação: se o
      // Lattes pendurar o projeto em outra atuação, a releitura acusa.
      const problem = readBackProblem('Criado no Lattes', readBack(saved, set));
      if (problem) return { ...result('divergente', problem), assigned };
      // O órgão volta só no texto de f_orgao, desabilitado (18/10/2026).
      const organNow = saved.controls.find((c) => c.name === 'f_orgao')?.value;
      if (organ.shown !== undefined && organLoose(organNow) !== organLoose(organ.shown)) {
        return { ...result('divergente', 'Criado no Lattes, mas o órgão não confere'), assigned };
      }
      // A equipe volta no script da página, não num campo, e fica sem reler: o
      // resto conferiu, e o aviso vai no registro do enviado.
      return { ...result('conferido', TEAM_UNREAD), assigned, partial: true };
    } catch (err) {
      return maybeCreated(
        op.key,
        'O projeto pode ter sido criado',
        `a conferência falhou (${err instanceof Error ? err.message : 'falha inesperada'})`,
      );
    }
  } catch (err) {
    if (err instanceof Stop) return result(err.status, err.message);
    return result('erro', err instanceof Error ? err.message : 'Falha inesperada');
  }
}
