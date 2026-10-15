// Incluir no Lattes, pelo conector, os itens dos dados gerais e um vínculo
// numa atuação que já existe (LAT-57), atrás de CREATE_ITEMS_ENABLED
// (create.ts), no molde das inclusões da LAT-52: plano, recusa de duplicata,
// envio, releitura da lista e conferência campo a campo.
//
// - Idioma: GN_IDIOMA, POST PKG_IDIOMA.FORM (seção 5). A ligação dos campos
//   com o XML é observada (a alteração usa a mesma, e o censo de 15/10/2026 a
//   casou em 3 idiomas); a inclusão pelo link sem f_seq também (seção 5).
// - Prêmio ou título: GN_PREMIO, POST pkg_premio.form (seção 16), ligação
//   observada em 5 prêmios no censo.
// - Vínculo: GN_ATIV_VINC, POST PKG_ATIV.VINCULOS (seção 5), aberto pelo
//   "Incluir vínculo" da tela de cargos e vínculos da atuação; ligação
//   observada em 8 vínculos no censo, e o vínculo empregatício invertido
//   (vinculo-flag.ts).
//
// Inferido até o teste acompanhado: a resposta do POST de inclusão e o item
// novo aparecer na lista com um f_seq (ou f_seq_hist) novo.
//
// Fica à mão, com o motivo de GENERAL_BY_HAND (recaptura de 15/10/2026,
// seção 21): licença (o Lattes exige a data de nascimento ou adoção, que o
// XML não guarda), áreas de atuação (a chave r da grade), formação
// complementar (o passo depois de FORM2), atividades de uma atuação, disciplina
// e treinamento (os formulários de cada natureza ainda não foram lidos), linha
// de pesquisa (sem inclusão na lista) e financiador, produção e orientação do
// projeto (janelas não lidas).

import type { Change } from '../model/changes.ts';
import { foldText } from '../model/fold-text.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort, OpResult } from './apply.ts';
import { vinculoFields } from './create.ts';
import { CREATE_FIELD_LABELS } from './create-labels.ts';
import {
  absentFields,
  getChecked,
  maybeCreated,
  overLimit,
  type Planned,
  readBack,
  readBackProblem,
  readPairs,
  type Result,
  selectEntries,
  Stop,
} from './create-shared.ts';
import { encodeLatin1Form, pairValue, setPairs, successfulPairs } from './form.ts';
import { IDIOMA_SKILLS, LEVEL } from './idioma-skills.ts';
import { findLinks, isLogonPage, type LattesLink } from './lattes-html.ts';
import type { FieldValues } from './plan.ts';

/** Os formulários dos dados gerais que o conector sabe incluir. */
export type GeneralForm = 'idioma' | 'premio';

export interface CreateGeneralOp {
  expect: FieldValues;
  form: GeneralForm;
  key: string;
  kind: 'criar-dado';
  label: string;
  set: FieldValues;
}

export interface CreateVinculoOp {
  /** CODIGO-INSTITUICAO da atuação, para achar a linha certa da lista. */
  codInst?: string;
  expect: FieldValues;
  key: string;
  kind: 'criar-vinculo';
  label: string;
  /** SEQUENCIA-ATIVIDADE da atuação que recebe o vínculo. */
  seqAtiv: string;
  set: FieldValues;
}

/** Elementos novos que viram inclusão aqui, e os que ficam à mão com o motivo. */
export const GENERAL_CREATES = new Set(['IDIOMA', 'PREMIO-TITULO', 'VINCULOS']);

/** Por que cada um vai à mão (seção 21 de docs/lattes_internals.md). */
export const GENERAL_BY_HAND: Record<string, string> = {
  'AREA-DE-ATUACAO':
    'Área de atuação vai à mão: a grade de áreas (f_area_l) tem a chave r, de sentido não lido',
  ATIVIDADE:
    'Atividade vai à mão: os campos do formulário de cada natureza ainda não foram lidos no Lattes',
  DISCIPLINA:
    'Disciplina vai à mão: ela entra pela grade da atividade de ensino, de formato não observado',
  'FINANCIADOR-DO-PROJETO':
    'Financiador vai à mão: os valores de cada linha da grade de financiadores vêm de uma janela que não foi lida',
  FORMACAO_COMPLEMENTAR:
    'Formação complementar vai à mão: o formulário de inclusão não tem os anos, e o passo depois dele só se vê enviando',
  LICENCA:
    'Licença vai à mão: o Lattes exige a data de nascimento ou adoção, que o currículo não guarda',
  'LINHA-DE-PESQUISA':
    'Linha de pesquisa vai à mão: a lista de linhas não tem inclusão, e a atividade de pesquisa e desenvolvimento ainda não foi lida',
  ORIENTACAO:
    'Orientação do projeto vai à mão: ela se liga a uma orientação do currículo pela janela de orientações, que não foi lida',
  'PRODUCAO-CT-DO-PROJETO':
    'Produção do projeto vai à mão: ela se liga a uma produção do currículo pela janela de produções, que não foi lida',
  TREINAMENTO:
    'Treinamento vai à mão: ele entra pela grade da atividade de treinamento, de formato não observado',
};

/** O motivo de ir à mão para um elemento novo, ou undefined quando não é destes. */
export function byHandReason(name: string): string | undefined {
  if (GENERAL_BY_HAND[name]) return GENERAL_BY_HAND[name];
  if (
    [
      'FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO',
      'FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA',
      'MBA',
      'OUTROS',
    ].includes(name)
  ) {
    return GENERAL_BY_HAND.FORMACAO_COMPLEMENTAR;
  }
  if (ACTIVITIES.has(name)) return GENERAL_BY_HAND.ATIVIDADE;
  return undefined;
}

const ACTIVITIES = new Set([
  'CONSELHO-COMISSAO-E-CONSULTORIA',
  'DIRECAO-E-ADMINISTRACAO',
  'ENSINO',
  'ESTAGIO',
  'EXTENSAO-UNIVERSITARIA',
  'OUTRA-ATIVIDADE-TECNICO-CIENTIFICA',
  'PESQUISA-E-DESENVOLVIMENTO',
  'SERVICO-TECNICO-ESPECIALIZADO',
  'TREINAMENTO-MINISTRADO',
]);

// Plano ------------------------------------------------------------------------------

/** Um idioma novo: o código e cada proficiência como caixa e nível (seção 5). */
function planIdioma(change: Change, el: XElement, label: string): Planned<CreateGeneralOp> {
  const code = getAttr(el, 'IDIOMA');
  if (!code) return { reason: 'Escolha o idioma' };
  const set: FieldValues = { F_COD_IDIOMA: code };
  let any = false;
  for (const [attr, field] of Object.entries(IDIOMA_SKILLS)) {
    const level = LEVEL[getAttr(el, attr) ?? ''];
    set[`FC_${field}`] = level ? 'on' : null;
    if (level) {
      set[`F_${field}`] = level;
      any = true;
    }
  }
  if (!any) return { reason: 'O Lattes exige ao menos uma proficiência informada' };
  return { expect: {}, form: 'idioma', key: change.key, kind: 'criar-dado', label, set };
}

/** Um prêmio novo: nome, entidade e ano (seção 16); o nome em inglês não tem campo. */
function planPremio(change: Change, el: XElement, label: string): Planned<CreateGeneralOp> {
  if (getAttr(el, 'NOME-DO-PREMIO-OU-TITULO-INGLES')?.trim()) {
    return { reason: 'Campos que o formulário de inclusão não tem: Nome em inglês' };
  }
  const set: FieldValues = {
    f_agencia: getAttr(el, 'NOME-DA-ENTIDADE-PROMOTORA') ?? '',
    f_ano: getAttr(el, 'ANO-DA-PREMIACAO') ?? '',
    f_titulo: getAttr(el, 'NOME-DO-PREMIO-OU-TITULO') ?? '',
  };
  // check() do formulário exige nome e ano (seção 16).
  if (!set.f_titulo || !set.f_ano) return { reason: 'O prêmio precisa do nome e do ano' };
  return { expect: {}, form: 'premio', key: change.key, kind: 'criar-dado', label, set };
}

/** Um vínculo novo numa atuação que já está no Lattes (com SEQUENCIA-ATIVIDADE). */
function planVinculo(
  change: Change,
  chain: XElement[],
  el: XElement,
  label: string,
): Planned<CreateVinculoOp> {
  const atuacao = chain.at(-2);
  const seqAtiv = atuacao && getAttr(atuacao, 'SEQUENCIA-ATIVIDADE');
  if (atuacao?.name !== 'ATUACAO-PROFISSIONAL' || !seqAtiv) {
    return { reason: 'A atuação do vínculo ainda não está no Lattes' };
  }
  const fields = vinculoFields(el, true);
  if ('reason' in fields) return fields;
  return {
    codInst: getAttr(atuacao, 'CODIGO-INSTITUICAO') || undefined,
    expect: {},
    key: change.key,
    kind: 'criar-vinculo',
    label,
    seqAtiv,
    set: fields.set,
  };
}

/** Planeja a inclusão de um item destes, ou undefined quando o elemento não é deles. */
export function planCreateGeneral(
  change: Change,
  chain: XElement[],
  label: string,
): Planned<CreateGeneralOp | CreateVinculoOp> | undefined {
  const el = chain.at(-1);
  if (!el) return undefined;
  // O contêiner novo com um item só (a primeira lista de idiomas, por exemplo).
  const item = GENERAL_CREATES.has(el.name) || byHandReason(el.name) ? el : soleChild(el);
  if (!item) return undefined;
  const itemChain = item === el ? chain : [...chain, item];
  if (item.name === 'IDIOMA') return planIdioma(change, item, label);
  if (item.name === 'PREMIO-TITULO') return planPremio(change, item, label);
  if (item.name === 'VINCULOS') return planVinculo(change, itemChain, item, label);
  const reason = byHandReason(item.name);
  return reason ? { reason } : undefined;
}

/** O único filho de um contêiner novo, quando é um dos itens deste módulo. */
function soleChild(el: XElement): XElement | undefined {
  const kids = el.children.filter((c): c is XElement => c.kind === 'element');
  const only = kids.length === 1 ? kids[0] : undefined;
  return only && (GENERAL_CREATES.has(only.name) || byHandReason(only.name)) ? only : undefined;
}

// Lattes ----------------------------------------------------------------------------

interface SimpleForm {
  action: string;
  /** O item já está no Lattes: a linha da lista lida tem o mesmo valor. */
  duplicate: (pairs: [string, string][], set: FieldValues) => boolean;
  list: string;
  name: string;
  proc: string;
  what: string;
}

const SIMPLE: Record<GeneralForm, SimpleForm> = {
  idioma: {
    action: 'PKG_IDIOMA.FORM',
    duplicate: (pairs, set) => pairValue(pairs, 'F_COD_IDIOMA') === set.F_COD_IDIOMA,
    list: 'pkg_idioma.lista',
    name: 'GN_IDIOMA',
    proc: 'pkg_idioma.form',
    what: 'idioma',
  },
  premio: {
    action: 'pkg_premio.form',
    duplicate: (pairs, set) =>
      foldText(pairValue(pairs, 'f_titulo') ?? '') === foldText(set.f_titulo ?? '') &&
      pairValue(pairs, 'f_ano') === set.f_ano,
    list: 'pkg_premio.lista',
    name: 'GN_PREMIO',
    proc: 'pkg_premio.form',
    what: 'prêmio',
  },
};

const rows = (html: string, proc: string) => findLinks(html, proc).filter((l) => l.params.f_seq);

const resultOf =
  (key: string) =>
  (status: OpResult['status'], detail: string): Result => ({ detail, key, status });

export async function applyCreateGeneral(op: CreateGeneralOp, port: LattesPort): Promise<Result> {
  const result = resultOf(op.key);
  const spec = SIMPLE[op.form];
  try {
    const lista = findLinks(await port.menuHtml(), spec.list)[0];
    if (!lista) throw new Stop('erro', `A lista de ${spec.what} não está no menu do Lattes`);
    const listaHtml = await getChecked(port, lista.path);
    const before = rows(listaHtml, spec.proc);
    for (const row of before) {
      const { pairs } = await readPairs(port, row.path, spec.name);
      if (spec.duplicate(pairs, op.set)) {
        return result('divergente', `O Lattes já tem esse ${spec.what}`);
      }
    }
    const inclusion = findLinks(listaHtml, spec.proc).find((l) => !l.params.f_seq);
    if (!inclusion) throw new Stop('erro', 'Inclusão não encontrada na lista do Lattes');
    const formHtml = await getChecked(port, inclusion.path);
    const controls = port.readForm(formHtml, spec.name);
    if (!controls) throw new Stop('erro', `Formulário ${spec.name} não encontrado`);
    const form = { controls, pairs: successfulPairs(controls) };
    if (pairValue(form.pairs, 'f_ctr') !== 'I') {
      return result('erro', 'O formulário não está em modo de inclusão');
    }
    // A inclusão de idioma só oferece os idiomas ainda não cadastrados (seção 5).
    if (
      op.form === 'idioma' &&
      !selectEntries(formHtml, 'F_COD_IDIOMA').some((o) => o.value === op.set.F_COD_IDIOMA)
    ) {
      return result('erro', 'O Lattes não oferece esse idioma na inclusão');
    }
    const absent = absentFields(form.controls, op.set);
    if (absent.length > 0) {
      return result(
        'erro',
        `O formulário não tem: ${absent.map((f) => CREATE_FIELD_LABELS[f] ?? f).join(', ')}`,
      );
    }
    const limit = overLimit(form.controls, op.set);
    if (limit) return result('erro', limit);
    const response = await port.post(spec.action, encodeLatin1Form(setPairs(form.pairs, op.set)));
    if (isLogonPage(response)) return result('sessao', 'A sessão do Lattes caiu; entre de novo');
    return await confirmNew(op.key, port, lista.path, before, spec, op.set);
  } catch (err) {
    if (err instanceof Stop) return result(err.status, err.message);
    return result('erro', err instanceof Error ? err.message : 'Falha inesperada');
  }
}

/** Depois do envio: uma linha nova só na lista, com os campos de volta iguais. */
async function confirmNew(
  key: string,
  port: LattesPort,
  listPath: string,
  before: LattesLink[],
  spec: SimpleForm,
  set: FieldValues,
): Promise<Result> {
  const result = resultOf(key);
  const mayExist = `O ${spec.what} pode ter sido criado`;
  try {
    const known = new Set(before.map((l) => l.params.f_seq));
    const created = rows(await getChecked(port, listPath), spec.proc).filter(
      (l) => !known.has(l.params.f_seq),
    );
    if (created.length !== 1) {
      return maybeCreated(key, mayExist, `a lista mostra ${created.length} itens novos`);
    }
    const saved = await readPairs(port, created[0]!.path, spec.name);
    const problem = readBackProblem('Criado no Lattes', false, readBack(saved, set));
    return problem
      ? result('divergente', problem)
      : result('conferido', 'Criado e conferido no Lattes');
  } catch (err) {
    const why = err instanceof Error ? err.message : 'falha inesperada';
    return maybeCreated(key, mayExist, `a conferência falhou (${why})`);
  }
}

/** A tela de cargos e vínculos da atuação, pelo f_seq_ativ (e a instituição, quando há). */
async function vinculosGrid(op: CreateVinculoOp, port: LattesPort) {
  const lista = findLinks(await port.menuHtml(), 'pkg_ativ.lista')[0];
  if (!lista) throw new Stop('erro', 'Atuação profissional não encontrada no menu do Lattes');
  const grids = findLinks(await getChecked(port, lista.path), 'pkg_ativ.cargos_vinculos').filter(
    (l) =>
      l.params.f_seq_ativ === op.seqAtiv &&
      (!op.codInst ||
        (l.params.f_codinst ?? '').replace(/^[A-Za-z]/, '') ===
          op.codInst.replace(/^[A-Za-z]/, '')),
  );
  if (grids.length !== 1) {
    throw new Stop(
      'erro',
      `Atuação ${op.seqAtiv} não encontrada no Lattes (${grids.length} achadas)`,
    );
  }
  return grids[0]!.path;
}

const vinculoRows = (html: string) =>
  findLinks(html, 'pkg_ativ.vinculos').filter((l) => l.params.f_seq_hist);

export async function applyCreateVinculo(op: CreateVinculoOp, port: LattesPort): Promise<Result> {
  const result = resultOf(op.key);
  try {
    const gridPath = await vinculosGrid(op, port);
    const gridHtml = await getChecked(port, gridPath);
    const before = vinculoRows(gridHtml);
    for (const row of before) {
      const { controls, pairs } = await readPairs(port, row.path, 'GN_ATIV_VINC');
      if (
        pairValue(pairs, 'f_ano_ini') === op.set.f_ano_ini &&
        (pairValue(pairs, 'f_mes_ini') ?? '') === (op.set.f_mes_ini ?? '') &&
        // Na alteração o tipo fica num campo desabilitado, fora dos pares (seção 5).
        foldText(controls.find((c) => c.name === 'f_vinc')?.value ?? '') ===
          foldText(op.set.f_vinc ?? '')
      ) {
        return result('divergente', 'A atuação já tem esse vínculo (mesmo tipo e início)');
      }
    }
    const inclusion = findLinks(gridHtml, 'pkg_ativ.vinculos').find((l) => !l.params.f_seq_hist);
    if (!inclusion) throw new Stop('erro', 'Inclusão de vínculo não encontrada no Lattes');
    const form = await readPairs(port, inclusion.path, 'GN_ATIV_VINC');
    if (pairValue(form.pairs, 'f_ctr') !== 'I') {
      return result('erro', 'O formulário não está em modo de inclusão');
    }
    // f_vinculo é oculto: check() copia nele o texto de f_vinc (seção 5).
    const { f_vinculo: _hidden, ...typed } = op.set;
    const absent = absentFields(form.controls, typed);
    if (absent.length > 0) {
      return result(
        'erro',
        `O formulário do vínculo não tem: ${absent.map((f) => CREATE_FIELD_LABELS[f] ?? f).join(', ')}`,
      );
    }
    const limit = overLimit(form.controls, op.set);
    if (limit) return result('erro', limit);
    const response = await port.post(
      'PKG_ATIV.VINCULOS',
      encodeLatin1Form(setPairs(form.pairs, op.set)),
    );
    if (isLogonPage(response)) return result('sessao', 'A sessão do Lattes caiu; entre de novo');
    const mayExist = 'O vínculo pode ter sido criado';
    try {
      const known = new Set(before.map((l) => l.params.f_seq_hist));
      const created = vinculoRows(await getChecked(port, gridPath)).filter(
        (l) => !known.has(l.params.f_seq_hist),
      );
      if (created.length !== 1) {
        return maybeCreated(op.key, mayExist, `a atuação mostra ${created.length} vínculos novos`);
      }
      const seq = created[0]!.params.f_seq_hist!;
      const assigned = { 'SEQUENCIA-HISTORICO': seq };
      const saved = await readPairs(port, created[0]!.path, 'GN_ATIV_VINC');
      // f_vinculo é cópia de f_vinc feita por check(): confere-se o f_vinc.
      const { f_vinculo: _copy, ...checked } = op.set;
      const problem = readBackProblem(
        `Criado no Lattes (vínculo ${seq})`,
        false,
        readBack(saved, checked),
      );
      if (problem) return { ...result('divergente', problem), assigned };
      return { ...result('conferido', `Criado e conferido no Lattes (vínculo ${seq})`), assigned };
    } catch (err) {
      const why = err instanceof Error ? err.message : 'falha inesperada';
      return maybeCreated(op.key, mayExist, `a conferência falhou (${why})`);
    }
  } catch (err) {
    if (err instanceof Stop) return result(err.status, err.message);
    return result('erro', err instanceof Error ? err.message : 'Falha inesperada');
  }
}
