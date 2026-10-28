// Incluir uma formação complementar no Lattes pelo conector, atrás de
// CREATE_COMPL_ENABLED e da capacidade 'complementar-nova'.
//
// Observado: o formulário de inclusão (PKG_FORMACAO_COMPL.form?f_tipo=FA,
// recaptura de 27/10/2026) tem só o nível, a instituição e o curso pelas
// buscas, a carga horária e a situação, com o f_ctr vazio; o check() exige
// nível, curso, situação, carga horária numérica e a instituição (menos no
// nível Outros), e posta para PKG_FORMACAO_COMPL.FORM2 (seção 21). Na edição,
// esse POST não grava: devolve o segundo passo, com os anos, a bolsa, a
// agência, a monografia, o orientador e as grades, e só o POST dele grava
// (seção 18, formacao-compl-steps.ts).
//
// Observado em 28/10/2026 (seção 27): a inclusão segue os mesmos dois passos,
// o segundo com f_ctr I, e as buscas de instituição e curso gravam. Inferido:
// que as grades do segundo passo gravem como as da formação acadêmica. Depois do envio, a lista tem de ter
// uma linha nova só, e a releitura confere o primeiro passo no formulário da
// linha e o segundo refazendo o primeiro passo sem gravar.

import type { Change } from '../model/changes.ts';
import { foldText } from '../model/fold-text.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort } from './apply.ts';
import { mismatches } from './apply-pairs.ts';
import type { FormSpec } from './contract.ts';
import { courseName } from './create-formacao.ts';
import {
  GRID_PARTS,
  newGridPairs,
  newGridProblems,
  type NewItemGrids,
  newItemGrids,
} from './create-grids.ts';
import {
  type CreateOpBase,
  filledChildren,
  getChecked,
  labelIn,
  leftOf,
  mapAttrs,
  type Mapper,
  maybeCreated,
  overLimit,
  type Planned,
  readBack,
  readBackProblem,
  readPairs,
  reasonFrom,
  type Result,
  same,
  sameCode,
  SESSION,
  Stop,
} from './create-shared.ts';
import { COMPL_LEVELS, FORMACAO_COMPL_SPEC } from './edit-lists.ts';
import { encodeLatin1Form, type Pairs, pairValue, setPairs, successfulPairs } from './form.ts';
import { resolveFormacao } from './formacao-lookups.ts';
import { findLinks, isLogonPage, type LattesLink } from './lattes-html.ts';
import type { FieldValues } from './plan.ts';

/** A inclusão da formação complementar. Ligada para o teste ao vivo, antes de um teste acompanhado. */
export const CREATE_COMPL_ENABLED = true;

export interface CreateComplementarOp extends CreateOpBase {
  /** CODIGO-AGENCIA-FINANCIADORA do XML (só o MBA tem agência). */
  agencyCode?: string;
  /** CODIGO-CURSO do XML, sem a letra. */
  courseCode: string;
  /** Palavras-chave, áreas e setores, nas grades do segundo passo. */
  grids?: NewItemGrids;
  kind: 'criar-complementar';
  /** f_nivel: F curta duração, 8 extensão, E MBA, Y outros (seção 5). */
  level: string;
  /** Os campos do segundo passo: anos, bolsa, monografia e orientador. */
  step2: FieldValues;
}

const STATUS: Record<string, string> = { CONCLUIDO: 'S', EM_ANDAMENTO: 'N', INCOMPLETO: 'I' };
const year: Mapper = (v) => (/^\d{4}$/.test(v.trim()) ? v.trim() : undefined);

/** Os campos do primeiro passo (o formulário de inclusão). */
const STEP1: Record<string, [string, Mapper]> = {
  'CARGA-HORARIA': ['f_carga', (v) => (/^\d{1,4}$/.test(v.trim()) ? v.trim() : undefined)],
  'STATUS-DO-CURSO': ['F_STATUS', (v) => STATUS[v]],
};

/** Os campos do segundo passo, como na edição (edit-lists.ts). */
const STEP2: Record<string, [string, Mapper]> = {
  'ANO-DE-CONCLUSAO': ['f_ano_fim', year],
  'ANO-DE-INICIO': ['f_ano_ini', year],
  'ANO-DE-OBTENCAO-DO-TITULO': ['f_ano_obten', year],
  'FLAG-BOLSA': ['F_BOLSA', (v) => ({ NAO: 'N', SIM: 'S' })[v]],
  'NOME-COMPLETO-DO-ORIENTADOR': ['f_orient', same],
  'TITULO-DA-MONOGRAFIA': ['f_titulo', same],
};

/** Do Lattes ou das buscas; o órgão e o nome em inglês ficam fora (o formulário não os tem). */
const HANDLED = new Set([
  'CODIGO-AGENCIA-FINANCIADORA',
  'CODIGO-CURSO',
  'CODIGO-INSTITUICAO',
  'CODIGO-ORGAO',
  'NIVEL',
  'NOME-AGENCIA',
  'NOME-CURSO',
  'NOME-CURSO-INGLES',
  'NOME-INSTITUICAO',
  'NOME-ORGAO',
  'SEQUENCIA-FORMACAO',
]);

/** Os que o formulário não tem nos dois passos. */
const LEFT = ['NOME-CURSO-INGLES', 'NOME-ORGAO'];

/** O item de formação complementar que a mudança inclui, ou undefined. */
export function complementarItem(chain: readonly XElement[]): XElement | undefined {
  const el = chain.at(-1);
  if (!el) return undefined;
  if (el.name in COMPL_LEVELS && chain.at(-2)?.name === 'FORMACAO-COMPLEMENTAR') return el;
  // O contêiner novo com um item só.
  if (el.name !== 'FORMACAO-COMPLEMENTAR') return undefined;
  const kids = el.children.filter((c): c is XElement => c.kind === 'element');
  return kids.length === 1 && kids[0]!.name in COMPL_LEVELS ? kids[0] : undefined;
}

export function planCreateComplementar(
  change: Change,
  el: XElement,
  label: string,
): Planned<CreateComplementarOp> {
  const level = COMPL_LEVELS[el.name]!;
  const institutionCode = getAttr(el, 'CODIGO-INSTITUICAO') ?? '';
  const institutionName = getAttr(el, 'NOME-INSTITUICAO') ?? '';
  if (institutionName && !institutionCode) {
    return { reason: 'Instituição sem código do Lattes: escolha pela busca de instituições' };
  }
  // O check() dispensa a instituição só em Outros (seção 21).
  if (!institutionCode && level !== 'Y') {
    return { reason: 'O Lattes exige a instituição: escolha pela busca de instituições' };
  }
  const courseCode = getAttr(el, 'CODIGO-CURSO') ?? '';
  if (!courseCode) {
    return { reason: 'O Lattes exige o curso, escolhido na lista de cursos do Lattes' };
  }
  const agencyCode = getAttr(el, 'CODIGO-AGENCIA-FINANCIADORA') || undefined;
  if (getAttr(el, 'NOME-AGENCIA') && !agencyCode) {
    return { reason: 'Agência sem código do Lattes: escolha pela lista de agências' };
  }
  const grids = newItemGrids(el);
  if (grids && 'reason' in grids) return grids;
  const first = mapAttrs(change, el, STEP1, new Set([...HANDLED, ...Object.keys(STEP2)]));
  // Os atributos fora das duas tabelas já voltam em first.missing.
  const second = mapAttrs(change, el, STEP2, new Set(Object.keys(STEP1)));
  const reason = reasonFrom([...first.wrong, ...second.wrong]);
  if (reason) return { reason };
  if (!first.set.f_carga) return { reason: 'O Lattes exige a carga horária, em horas' };
  if (!first.set.F_STATUS) return { reason: 'O Lattes exige a situação do curso' };
  // A agência marca a bolsa como Sim na página; com o Não, ela some.
  if (agencyCode && second.set.F_BOLSA === 'N') {
    return {
      reason: 'Com bolsa Não, o Lattes não guarda a agência: tire a agência ou marque a bolsa',
    };
  }
  const left = [
    ...first.missing,
    ...LEFT.filter((attr) => getAttr(el, attr)?.trim()).map((attr) => labelIn(change, attr)),
    ...filledChildren(el, [...GRID_PARTS]).map((c) => labelIn(change, c.name)),
  ];
  return {
    ...(agencyCode ? { agencyCode } : {}),
    courseCode,
    expect: {},
    ...(grids ? { grids } : {}),
    institutionCode,
    institutionName,
    key: change.key,
    kind: 'criar-complementar',
    label,
    ...leftOf([...new Set(left)]),
    level,
    set: first.set,
    step2: second.set,
  };
}

/** O formulário de inclusão, o mesmo da edição com o f_ctr vazio (recaptura de 27/10/2026). */
export const CREATE_COMPLEMENTAR_SPEC: FormSpec & { mode: string; partial: true } = {
  ...FORMACAO_COMPL_SPEC,
  mode: '',
  partial: true,
};

// Lattes ----------------------------------------------------------------------------

const FORM = 'GN_FORMACAO2';
const ACTION = 'PKG_FORMACAO_COMPL.FORM2';
const WHAT = 'A formação complementar pode ter sido criada';

const rows = (html: string): LattesLink[] =>
  findLinks(html, 'PKG_FORMACAO_COMPL.form').filter((l) => l.params.f_seq);

const institutionIn = (pairs: Pairs) =>
  pairValue(pairs, 'f_cod_inst') || pairValue(pairs, 'f_cod_inst2') || '';

/** O caminho do formulário de inclusão: o da recaptura, com o código do currículo. */
export const complementarFormPath = (cv: string) => `PKG_FORMACAO_COMPL.form?f_cod=${cv}&f_tipo=FA`;

/** O segundo passo que o primeiro POST devolve (f_ctr I ou U, inferido na inclusão). */
function secondStepOf(
  port: LattesPort,
  html: string,
): { names: Set<string>; pairs: Pairs } | undefined {
  const controls = port.readForm(html, FORM);
  if (!controls) return undefined;
  const pairs = successfulPairs(controls);
  if (!['I', 'U'].includes(pairValue(pairs, 'f_ctr') ?? '')) return undefined;
  // Um rádio sem nada marcado não vai nos pares, mas está no formulário.
  return { names: new Set(controls.map((c) => c.name)), pairs };
}

export async function applyCreateComplementar(
  op: CreateComplementarOp,
  port: LattesPort,
): Promise<Result> {
  const result = (status: Result['status'], detail: string): Result => ({
    detail,
    key: op.key,
    status,
  });
  try {
    const menu = await port.menuHtml();
    const lista = findLinks(menu, 'pkg_formacao_compl.lista')[0];
    if (!lista?.params.f_cod) {
      throw new Stop('erro', 'Formação complementar não encontrada no menu do Lattes');
    }
    const cv = lista.params.f_cod;
    const before = rows(await getChecked(port, lista.path));
    for (const link of before) {
      const { pairs } = await readPairs(port, link.path, FORM);
      if (
        pairValue(pairs, 'f_nivel') === op.level &&
        (op.institutionCode
          ? sameCode(institutionIn(pairs), op.institutionCode)
          : !institutionIn(pairs)) &&
        sameCode(pairValue(pairs, 'f_cod_curso') || pairValue(pairs, 'f_cod_curso2'), op.courseCode)
      ) {
        return result(
          'divergente',
          'O Lattes já tem essa formação complementar (mesmo nível, instituição e curso)',
        );
      }
    }
    const form = await readPairs(port, complementarFormPath(cv), FORM);
    if (pairValue(form.pairs, 'f_ctr') !== '' || pairValue(form.pairs, 'f_seq')) {
      return result('erro', 'O formulário não é o de inclusão da formação complementar');
    }
    const base = setPairs(form.pairs, { ...op.set, f_nivel: op.level });
    const found = await resolveFormacao(
      {
        course: op.courseCode,
        ...(op.institutionCode
          ? {
              institutions: [
                { before: '', code: op.institutionCode, name: op.institutionName, slot: 'main' },
              ],
            }
          : {}),
      },
      port,
      base,
    );
    if ('status' in found) return result(found.status, found.detail);
    const set = { ...op.set, ...found.set, f_nivel: op.level };
    const limit = overLimit(form.controls, set);
    if (limit) return result('erro', limit);

    const firstResponse = await port.post(ACTION, encodeLatin1Form(setPairs(form.pairs, set)));
    if (isLogonPage(firstResponse)) return result('sessao', SESSION);
    const step2 = secondStepOf(port, firstResponse);
    if (!step2) {
      return result(
        'divergente',
        'O Lattes não mostrou o segundo passo da formação complementar; nada foi gravado. Confira no Lattes',
      );
    }
    const extra: FieldValues = { ...op.step2 };
    if (op.agencyCode) {
      const agency = await resolveFormacao({ agency: op.agencyCode }, port, step2.pairs);
      if ('status' in agency) return result(agency.status, agency.detail);
      Object.assign(extra, agency.set, { F_BOLSA: 'S' });
    }
    if (op.grids) {
      const grids = newGridPairs(op.grids, menu);
      if ('detail' in grids) return result('erro', grids.detail);
      Object.assign(extra, grids.set);
    }
    const absent = Object.keys(op.step2).filter((k) => !step2.names.has(k));
    if (absent.length > 0) {
      return result(
        'divergente',
        `O segundo passo não tem: ${absent.join(', ')}; nada foi gravado. Confira no Lattes`,
      );
    }
    const response = await port.post(ACTION, encodeLatin1Form(setPairs(step2.pairs, extra)));
    if (isLogonPage(response)) return result('sessao', SESSION);
    return await confirmNew(op, port, lista.path, before, { check: found.check, extra, set });
  } catch (err) {
    if (err instanceof Stop) return result(err.status, err.message);
    return result('erro', err instanceof Error ? err.message : 'Falha inesperada');
  }
}

/** Depois do envio: uma linha nova, com os dois passos de volta como foram. */
async function confirmNew(
  op: CreateComplementarOp,
  port: LattesPort,
  listPath: string,
  before: LattesLink[],
  sent: { check: FieldValues; extra: FieldValues; set: FieldValues },
): Promise<Result> {
  try {
    const known = new Set(before.map((l) => l.params.f_seq));
    const created = rows(await getChecked(port, listPath)).filter(
      (l) => !known.has(l.params.f_seq),
    );
    if (created.length !== 1) {
      return maybeCreated(op.key, WHAT, `a lista mostra ${created.length} formações novas`);
    }
    const seq = created[0]!.params.f_seq!;
    const assigned = { 'SEQUENCIA-FORMACAO': seq };
    const saved = await readPairs(port, created[0]!.path, FORM);
    // O curso volta pelo nome, sem o código CAPES do texto da opção.
    const { f_curso_old: course, ...first } = { ...sent.set, ...sent.check };
    const check = readBack(saved, first);
    const savedCourse = pairValue(saved.pairs, 'f_curso_old') ?? '';
    if (course && foldText(courseName(savedCourse)) !== foldText(courseName(course))) {
      check.differ.push('Curso');
    }
    if (op.institutionCode && !sameCode(institutionIn(saved.pairs), op.institutionCode)) {
      check.differ.push('Instituição');
    }
    // O segundo passo se relê refazendo o primeiro, sem gravar.
    const html = await port.post(ACTION, encodeLatin1Form(saved.pairs));
    const second = secondStepOf(port, html);
    if (!second) check.unread.push('anos, bolsa e grades');
    else {
      const { f_agencia: agency, f_area_l: _a, f_plv_l: _p, f_setor_l: _s, ...typed } = sent.extra;
      check.differ.push(...mismatches(second.pairs, typed));
      if (agency && !sameCode(pairValue(second.pairs, 'f_agencia'), op.agencyCode ?? '')) {
        check.differ.push('Agência');
      }
      if (op.grids) check.differ.push(...newGridProblems(html, op.grids));
    }
    const problem = readBackProblem(`Criada no Lattes (formação ${seq})`, check);
    if (problem) return { assigned, detail: problem, key: op.key, status: 'divergente' };
    return {
      assigned,
      detail: `Criada e conferida no Lattes (formação ${seq})`,
      key: op.key,
      status: 'conferido',
    };
  } catch (err) {
    const why = err instanceof Error ? err.message : 'falha inesperada';
    return maybeCreated(op.key, WHAT, `a conferência falhou (${why})`);
  }
}
