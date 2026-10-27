// Incluir uma atividade de ensino numa atuação que já está no Lattes, com as
// disciplinas (LAT-57), atrás de CREATE_ITEMS_ENABLED (create.ts).
// Formulário GN_ATIV_CARGO, POST PKG_ATIV.cargo, aberto pelo "Incluir
// atividade" da tela de cargos e vínculos com f_natur_ativ=4
// (docs/lattes_internals.md, seções 17 e 22).
//
// Observado (lote 3 da recaptura de 15/10/2026): os campos (nível, curso,
// mês e ano de início e de fim, período), as opções do nível (401 graduação a
// 409 outro) e do período (N anterior, S atual), a busca de curso
// prc_curso_form com f_pgm=ATIV e o nível do curso tirado do nível da
// atividade (401 → 1, 402 → 5, 403 e 404 → 2), o check() (curso obrigatório
// nos níveis 401 a 404, início, período, fim quando anterior e ao menos uma
// disciplina) e a grade das disciplinas em f_espec_l: "<n>@<c>?<nome>!" por
// linha, completada até 8 com "<n>@?!", e a linha digitada com c = 0.
// Inferido: a ligação de cada campo com o atributo do XML (o tipo de ensino
// pelo rótulo do nível), o valor de f_inst na busca de curso (o f_codinst do
// link), a resposta do POST, a atividade nova aparecer na tela com um
// f_seq_funcao novo.
//
// As outras naturezas vão à mão: o check() exige o órgão ou unidade, que
// entra pela busca prc_orgao_cargo, cuja resposta ainda não foi lida.

import type { Change } from '../model/changes.ts';
import { childElements, getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort, OpResult } from './apply.ts';
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
  sameCode,
  selectEntries,
  SESSION,
  Stop,
} from './create-shared.ts';
import { encodeLatin1Form, pairValue, setPairs } from './form.ts';
import { findLinks, isLogonPage, type LattesLink } from './lattes-html.ts';
import { activityOrgansPath } from './organ-windows.ts';
import type { FieldValues } from './plan.ts';
import { organLoose, resolveOrgan } from './production/organ.ts';

export interface CreateAtividadeOp {
  /** CODIGO-INSTITUICAO da atuação, para conferir que a atuação achada é ela (como no vínculo). */
  codInst?: string;
  /** CODIGO-CURSO do XML, quando o nível pede curso. */
  courseCode?: string;
  expect: FieldValues;
  key: string;
  kind: 'criar-atividade';
  label: string;
  /** f_natur_ativ: sem valor, o ensino (4); as outras naturezas em create-cargo.ts. */
  natur?: string;
  /** O órgão ou a unidade da janela de órgãos da atividade, com o órgão de cima de uma unidade. */
  organ?: { code: string; parent?: string };
  /** SEQUENCIA-ATIVIDADE da atuação que recebe a atividade. */
  seqAtiv: string;
  set: FieldValues;
}

/** TIPO-ENSINO do XML → f_nivel, pelo rótulo da opção (inferido). */
const TEACHING_LEVELS: Record<string, string> = {
  APERFEICOAMENTO: '404',
  'ENSINO-FUNDAMENTAL': '405',
  'ENSINO-MEDIO': '406',
  ESPECIALIZACAO: '403',
  GRADUACAO: '401',
  OUTRO: '409',
  'POS-GRADUACAO': '402',
};

/** O nível do curso na busca, pelo nível da atividade (curso() da página, observado). */
const COURSE_LEVELS: Record<string, string> = { '401': '1', '402': '5', '403': '2', '404': '2' };

/** A grade das disciplinas como o check() a monta (seção 22). */
export function specGrid(names: string[]): string {
  let out = '';
  for (let i = 1; i <= Math.max(8, names.length); i++) {
    const name = names[i - 1];
    out += name === undefined ? `${i}@?!` : `${i}@0?${name}!`;
  }
  return out;
}

const text = (el: XElement) =>
  el.children
    .map((c) => (c.kind === 'text' ? c.value : ''))
    .join('')
    .trim();

/** A atividade de ensino que a mudança traz: a própria, ou o contêiner novo com uma só. */
export function teachingItem(el: XElement): XElement | undefined {
  if (el.name === 'ENSINO') return el;
  if (el.name !== 'ATIVIDADES-DE-ENSINO') return undefined;
  const kids = childElements(el);
  return kids.length === 1 && kids[0]!.name === 'ENSINO' ? kids[0] : undefined;
}

const OWN = new Set([
  'ANO-FIM',
  'ANO-INICIO',
  'CODIGO-CURSO',
  'FLAG-PERIODO',
  'MES-FIM',
  'MES-INICIO',
  'NOME-CURSO',
  'SEQUENCIA-FUNCAO-ATIVIDADE',
  'TIPO-ENSINO',
]);

/** Uma atividade de ensino nova como inclusão; o motivo, quando vai à mão. */
export function planCreateAtividade(
  change: Change,
  chain: XElement[],
  item: XElement,
  label: string,
): Planned<CreateAtividadeOp> {
  const atuacao = chain.find((c) => c.name === 'ATUACAO-PROFISSIONAL');
  const seqAtiv = atuacao && getAttr(atuacao, 'SEQUENCIA-ATIVIDADE');
  if (!seqAtiv) return { reason: 'A atuação da atividade ainda não está no Lattes' };
  const extra = item.attrs.filter((a) => a.value.trim() && !OWN.has(a.name)).map((a) => a.name);
  if (extra.length > 0) {
    return { reason: `Campos que o formulário de atividade não tem: ${extra.join(', ')}` };
  }
  const level = TEACHING_LEVELS[getAttr(item, 'TIPO-ENSINO') ?? ''];
  if (!level) return { reason: 'Escolha o tipo de ensino' };
  const courseCode = getAttr(item, 'CODIGO-CURSO') || undefined;
  if (COURSE_LEVELS[level] && !courseCode) {
    return { reason: COURSE_BY_HAND };
  }
  if (!COURSE_LEVELS[level] && getAttr(item, 'NOME-CURSO')) {
    return { reason: 'O Lattes não aceita curso neste nível de ensino' };
  }
  const disciplines = childElements(item, 'DISCIPLINA').map(text).filter(Boolean);
  if (disciplines.length === 0) return { reason: 'O Lattes exige ao menos uma disciplina' };
  // A grade não escapa os separadores (o check() do Lattes junta o nome como
  // está): um nome com @, ? ou ! partiria a linha, e as disciplinas não são
  // relidas para conferir.
  if (disciplines.some((d) => /[@?!]/.test(d))) {
    return { reason: 'Nome de disciplina com @, ? ou !, que a grade do Lattes usa como separador' };
  }
  const start = getAttr(item, 'ANO-INICIO') ?? '';
  const end = getAttr(item, 'ANO-FIM') ?? '';
  if (!start) return { reason: 'A atividade precisa do ano de início' };
  const codInst = getAttr(atuacao, 'CODIGO-INSTITUICAO') || undefined;
  return {
    codInst,
    courseCode: COURSE_LEVELS[level] ? courseCode : undefined,
    expect: {},
    key: change.key,
    kind: 'criar-atividade',
    label,
    seqAtiv,
    set: {
      f_ano_fim: end,
      f_ano_ini: start,
      f_espec_l: specGrid(disciplines),
      f_mes_fim: getAttr(item, 'MES-FIM') ?? '',
      f_mes_ini: getAttr(item, 'MES-INICIO') ?? '',
      f_nivel: level,
      // Período: anterior quando há fim (rótulos do rádio, observado).
      f_status: end ? 'N' : 'S',
    },
  };
}

/**
 * Por que a atividade de ensino de graduação, pós-graduação, especialização ou
 * aperfeiçoamento vai à mão quando o item não traz o código do curso: o Lattes
 * exige o curso da lista dele (prc_curso_form com f_pgm=ATIV e a instituição
 * da atuação, endereço lido no lote 3), e o formulário do editor ainda não
 * oferece essa lista. Ligá-la pede um parâmetro novo no pedido de cursos à
 * extensão, que uma extensão antiga ignoraria, devolvendo a lista da formação.
 */
export const COURSE_BY_HAND =
  'Vai à mão: neste nível o Lattes exige o curso da lista de cursos da instituição, que o editor ainda não oferece na atividade de ensino';

/** Por que a atividade criada fica divergente: as disciplinas não são relidas. */
export const DISCIPLINES_UNREAD =
  'Criada no Lattes, com os campos conferidos; confira as disciplinas no Lattes, que o conector não relê';

/** O mesmo, nas outras naturezas: a grade das descrições não é relida. */
export const DESCRIPTION_UNREAD =
  'Criada no Lattes, com os campos e o órgão conferidos; confira a descrição no Lattes, que o conector não relê';

// Lattes ----------------------------------------------------------------------------

const FORM = 'GN_ATIV_CARGO';

const activityRows = (html: string) =>
  findLinks(html, 'pkg_ativ.cargo').filter((l) => l.params.f_seq_funcao);

/** O link de inclusão da natureza: o "Incluir atividade" com f_natur_ativ trocado. */
function inclusionPath(link: LattesLink, nature: string): string {
  const base = link.path.replace(/([?&])f_natur_ativ=[^&]*/i, '$1').replace(/[?&]$/, '');
  return `${base}${base.includes('?') ? '&' : '?'}f_natur_ativ=${nature}`;
}

export async function applyCreateAtividade(
  op: CreateAtividadeOp,
  port: LattesPort,
): Promise<Result> {
  const result = (status: OpResult['status'], detail: string): Result => ({
    detail,
    key: op.key,
    status,
  });
  try {
    const menu = await port.menuHtml();
    const lista = findLinks(menu, 'pkg_ativ.lista')[0];
    if (!lista?.params.f_cod) {
      throw new Stop('erro', 'Atuação profissional não encontrada no menu do Lattes');
    }
    const cv = lista.params.f_cod;
    // A atuação pelo número e, com o código da instituição no XML, também por ele.
    const sameInst = (code: string | undefined) => sameCode(code, op.codInst ?? '');
    const grids = findLinks(await getChecked(port, lista.path), 'pkg_ativ.cargos_vinculos').filter(
      (l) => l.params.f_seq_ativ === op.seqAtiv && (!op.codInst || sameInst(l.params.f_codinst)),
    );
    if (grids.length !== 1) {
      throw new Stop(
        'erro',
        `Atuação ${op.seqAtiv} não encontrada no Lattes (${grids.length} achadas)`,
      );
    }
    const gridHtml = await getChecked(port, grids[0]!.path);
    const before = activityRows(gridHtml);
    const inclusion = findLinks(gridHtml, 'pkg_ativ.cargo').find((l) => !l.params.f_seq_funcao);
    if (!inclusion) throw new Stop('erro', 'Inclusão de atividade não encontrada no Lattes');
    // Linhas de atividade sem f_seq_funcao (o parâmetro do link é inferido) não
    // entrariam na conferência de duplicata: com elas, nada se envia.
    const unknown = findLinks(gridHtml, 'pkg_ativ.cargo').filter(
      (l) => !l.params.f_seq_funcao && l.path !== inclusion.path,
    );
    if (unknown.length > 0) {
      throw new Stop(
        'erro',
        'A tela de cargos e vínculos tem atividades que o conector não reconhece; nada foi enviado',
      );
    }
    const natur = op.natur ?? '4';
    // Duplicata: atividade da mesma natureza com o mesmo início (no ensino, também o nível).
    // A natureza vem do oculto f_natur_ativ de cada formulário (observado), e
    // não do link da linha, cujos parâmetros são inferidos: assim uma linha sem
    // o parâmetro não escapa da conferência.
    for (const row of before) {
      const { pairs } = await readPairs(port, row.path, FORM);
      if (pairValue(pairs, 'f_natur_ativ') !== natur) continue;
      if (
        (natur !== '4' || pairValue(pairs, 'f_nivel') === op.set.f_nivel) &&
        pairValue(pairs, 'f_ano_ini') === op.set.f_ano_ini
      ) {
        return result('divergente', 'A atuação já tem essa atividade (mesma natureza e início)');
      }
    }
    const form = await readPairs(port, inclusionPath(inclusion, natur), FORM);
    if (pairValue(form.pairs, 'f_ctr') !== 'I' || pairValue(form.pairs, 'f_natur_ativ') !== natur) {
      return result('erro', 'O formulário não é o de inclusão desta natureza de atividade');
    }
    const { f_espec_l: _grid, ...typed } = op.set;
    const absent = absentFields(form.controls, typed);
    if (absent.length > 0) {
      return result(
        'erro',
        `O formulário de atividade não tem: ${absent.map((f) => CREATE_FIELD_LABELS[f] ?? f).join(', ')}`,
      );
    }
    const set: FieldValues = { ...op.set };
    if (op.courseCode) {
      const inst = inclusion.params.f_codinst ?? '';
      const courses = selectEntries(
        await getChecked(
          port,
          `prc_curso_form?f_cod=${cv}&f_inst=${inst}&f_nivel=${COURSE_LEVELS[op.set.f_nivel ?? '']}&f_pgm=ATIV`,
        ),
        'f_curso',
      ).filter((o) => sameCode(o.value, op.courseCode!));
      if (courses.length !== 1) {
        return result(
          'erro',
          `Curso não encontrado na lista do Lattes (${courses.length} achados)`,
        );
      }
      const course = courses[0]!;
      set[course.value.startsWith('V') ? 'f_cod_curso' : 'f_cod_curso2'] = course.value.slice(1);
      set.f_curso = course.text;
      set.f_curso_old = course.text;
    }
    const limit = overLimit(form.controls, set);
    if (limit) return result('erro', limit);
    // O órgão pela janela de órgãos da atividade, com a instituição do link
    // (f_codinst, com a letra), como na alteração (seção 22). Fica fora da
    // releitura dos campos: a página de alteração o mostra só em f_orgao.
    let organ: { set: FieldValues; shown?: string } = { set: {} };
    if (op.organ) {
      const resolved = await resolveOrgan(
        { before: '', beforeText: '', ...op.organ },
        port,
        form.pairs,
        '',
        { institution: inclusion.params.f_codinst ?? '', path: activityOrgansPath },
      );
      if ('status' in resolved) return result(resolved.status, resolved.detail);
      organ = { set: resolved.set, shown: resolved.shown };
    }
    const response = await port.post(
      'PKG_ATIV.cargo',
      encodeLatin1Form(setPairs(form.pairs, { ...set, ...organ.set })),
    );
    if (isLogonPage(response)) return result('sessao', SESSION);
    const mayExist = 'A atividade pode ter sido criada';
    try {
      const known = new Set(before.map((l) => l.params.f_seq_funcao));
      const created = activityRows(await getChecked(port, grids[0]!.path)).filter(
        (l) => !known.has(l.params.f_seq_funcao),
      );
      if (created.length !== 1) {
        return maybeCreated(
          op.key,
          mayExist,
          `a atuação mostra ${created.length} atividades novas`,
        );
      }
      const seq = created[0]!.params.f_seq_funcao!;
      const assigned = { 'SEQUENCIA-FUNCAO-ATIVIDADE': seq };
      const saved = await readPairs(port, created[0]!.path, FORM);
      // As disciplinas voltam no script da página, não num campo: ficam sem reler.
      // f_curso_old só guarda o nome anterior para a página; não é gravado.
      const { f_curso_old: _old, f_espec_l: _spec, ...checked } = set;
      const problem = readBackProblem(
        `Criada no Lattes (atividade ${seq})`,
        readBack(saved, checked),
      );
      if (problem) return { ...result('divergente', problem), assigned };
      const organNow = saved.controls.find((c) => c.name === 'f_orgao')?.value;
      if (organ.shown !== undefined && organLoose(organNow) !== organLoose(organ.shown)) {
        return { ...result('divergente', 'Criada no Lattes, mas o órgão não confere'), assigned };
      }
      // As disciplinas ficam sem reler: o resto conferiu, e o aviso vai no
      // registro do enviado, sem travar a fila nem o envio ao CNPq.
      return {
        ...result(
          'conferido',
          `${natur === '4' ? DISCIPLINES_UNREAD : DESCRIPTION_UNREAD} (atividade ${seq})`,
        ),
        assigned,
        partial: true,
      };
    } catch (err) {
      const why = err instanceof Error ? err.message : 'falha inesperada';
      return maybeCreated(op.key, mayExist, `a conferência falhou (${why})`);
    }
  } catch (err) {
    if (err instanceof Stop) return result(err.status, err.message);
    return result('erro', err instanceof Error ? err.message : 'Falha inesperada');
  }
}

// Contrato ----------------------------------------------------------------------------

const textField = (maxLength: number) => ({ maxLength, type: 'text' });
const hiddenField = { type: 'hidden' };

/** O formulário de atividade (GN_ATIV_CARGO), como o lote 3 o leu. */
export const CREATE_ATIVIDADE_SPEC = {
  action: 'PKG_ATIV.cargo',
  fields: {
    f_ano_fim: textField(4),
    f_ano_ini: textField(4),
    f_cod: hiddenField,
    f_codinst: hiddenField,
    f_ctr: hiddenField,
    f_espec_l: hiddenField,
    f_mes_fim: textField(2),
    f_mes_ini: textField(2),
    f_natur_ativ: hiddenField,
    f_seq_ativ: hiddenField,
    f_seq_funcao: hiddenField,
    f_status: { type: 'radio' },
    f_tipo_privacidade: { type: 'select-one' },
  },
  mode: 'I',
  name: FORM,
  partial: true as const,
};

/** O caminho do formulário de inclusão de atividade, pela primeira atuação da lista. */
export async function atividadeFormPath(
  get: (path: string) => Promise<string>,
  menu: string,
): Promise<{ missing: string } | { path: string }> {
  const lista = findLinks(menu, 'pkg_ativ.lista')[0];
  if (!lista) return { missing: 'pkg_ativ.lista' };
  for (const grid of findLinks(await get(lista.path), 'pkg_ativ.cargos_vinculos')) {
    const inc = findLinks(await get(grid.path), 'pkg_ativ.cargo').find(
      (l) => !l.params.f_seq_funcao,
    );
    if (inc) return { path: inclusionPath(inc, '4') };
  }
  return { missing: 'pkg_ativ.cargo' };
}
