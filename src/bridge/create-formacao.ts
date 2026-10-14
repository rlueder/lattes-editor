// Incluir uma formação acadêmica no Lattes pelo conector (LAT-52), atrás de
// CREATE_ITEMS_ENABLED (create.ts). Formulário, níveis e buscas de
// instituição, curso e agência: docs/lattes_internals.md, seções 17 e 18.
// Inferido até o teste acompanhado: a resposta do POST, o item novo aparecer
// na lista com um f_seq novo, e a correspondência entre atributo e campo pelo
// nome (a situação do curso foi conferida na seção 5).

import type { Change } from '../model/changes.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort, OpResult } from './apply.ts';
import type { FormSpec } from './contract.ts';
import { institutionResults } from './create.ts';
import { CREATE_FIELD_LABELS } from './create-labels.ts';
import {
  absentFields,
  type CreateOpBase,
  filledChildren,
  getChecked,
  hidden,
  jsCalls,
  mapAttrs,
  type Mapper,
  maybeCreated,
  notSaved,
  overLimit,
  type Planned,
  radio,
  readPairs,
  reasonFrom,
  type Result,
  same,
  sameCode,
  select,
  selectEntries,
  SESSION,
  Stop,
  text,
} from './create-shared.ts';
import { encodeLatin1Form, type Pairs, pairValue, setPairs } from './form.ts';
import { findLinks, isLogonPage, type LattesLink } from './lattes-html.ts';
import type { FieldValues } from './plan.ts';

export interface CreateFormacaoOp extends CreateOpBase {
  /** CODIGO-AGENCIA-FINANCIADORA do XML, quando há bolsa. */
  agencyCode?: string;
  /** CODIGO-CURSO do XML, nos níveis que têm curso. */
  courseCode?: string;
  kind: 'criar-formacao';
  /** f_nivel do formulário: 4 doutorado, 3 mestrado… */
  level: string;
}

// Formação ------------------------------------------------------------------------

/**
 * Elemento do XML → f_nivel do "Incluir novo item" (reconhecimento de
 * 10/10/2026, seção 4.2; seção 17). O XML guarda o mesmo código em NIVEL no
 * mestrado (3), na graduação (1) e no técnico (7); nos outros, a ligação é
 * pelo nome do nível.
 */
export const FORMATION_LEVELS: Record<string, string> = {
  APERFEICOAMENTO: 'X',
  'CURSO-TECNICO-PROFISSIONALIZANTE': '7',
  DOUTORADO: '4',
  'ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU': 'B',
  'ENSINO-MEDIO-SEGUNDO-GRAU': 'C',
  ESPECIALIZACAO: '2',
  GRADUACAO: '1',
  MESTRADO: '3',
  'MESTRADO-PROFISSIONALIZANTE': '9',
  'RESIDENCIA-MEDICA': 'D',
};

/** STATUS-DO-CURSO → F_STATUS (seção 5, conferido nos rótulos do formulário). */
const COURSE_STATUS: Record<string, string> = {
  CONCLUIDO: 'S',
  EM_ANDAMENTO: 'N',
  INCOMPLETO: 'I',
};

/** Atributo do XML → campo do GN_FORMACAO2, pelo nome (inferido, fora a situação). */
const FORMATION_FIELDS: Record<string, [string, Mapper]> = {
  'ANO-DE-CONCLUSAO': ['f_ano_fim', same],
  'ANO-DE-INICIO': ['f_ano_ini', same],
  'ANO-DE-OBTENCAO-DO-TITULO': ['f_ano_obten', same],
  'CARGA-HORARIA': ['f_carga', same],
  'NOME-COMPLETO-DO-ORIENTADOR': ['f_orient', same],
  'NOME-DO-CO-ORIENTADOR': ['f_coorient', same],
  'NOME-DO-ORIENTADOR': ['f_orient', same],
  'STATUS-DO-CURSO': ['F_STATUS', (v) => COURSE_STATUS[v]],
  // Seção 5: o rádio normal/sanduíche do mestrado é o TIPO-MESTRADO do XML.
  'TIPO-MESTRADO': ['f_tpo_doutorado', (v) => (v === 'N' || v === 'S' ? v : undefined)],
  'TITULO-DA-DISSERTACAO-TESE': ['f_titulo', same],
  'TITULO-DA-MONOGRAFIA': ['f_titulo', same],
  'TITULO-DA-RESIDENCIA-MEDICA': ['f_titulo', same],
  'TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO': ['f_titulo', same],
};

/** Do Lattes (número, nível, códigos que acompanham o curso) ou tratados à parte (buscas). */
const FORMATION_HANDLED = new Set([
  'CODIGO-AGENCIA-FINANCIADORA',
  'CODIGO-AREA-CURSO',
  'CODIGO-CURSO',
  'CODIGO-CURSO-CAPES',
  'CODIGO-INSTITUICAO',
  'FLAG-BOLSA',
  'NIVEL',
  'NOME-AGENCIA',
  'NOME-CURSO',
  'NOME-INSTITUICAO',
  'SEQUENCIA-FORMACAO',
]);

/** Uma formação nova do editor como inclusão; o motivo, quando vai à mão. */
export function planCreateFormacao(
  change: Change,
  el: XElement,
  label: string,
): Planned<CreateFormacaoOp> {
  const level = FORMATION_LEVELS[el.name];
  if (!level) return { reason: 'Este nível não está no "Incluir novo item" da formação' };
  const institutionCode = getAttr(el, 'CODIGO-INSTITUICAO');
  const institutionName = getAttr(el, 'NOME-INSTITUICAO');
  if (!institutionCode || !institutionName) {
    return { reason: 'Instituição sem código do Lattes: escolha pela busca de instituições' };
  }
  const courseCode = getAttr(el, 'CODIGO-CURSO') || undefined;
  if (getAttr(el, 'NOME-CURSO') && !courseCode) {
    return { reason: 'Curso sem código do Lattes: escolha pela lista de cursos' };
  }
  const bolsa = getAttr(el, 'FLAG-BOLSA') ?? '';
  const agencyCode = getAttr(el, 'CODIGO-AGENCIA-FINANCIADORA') || undefined;
  if (getAttr(el, 'NOME-AGENCIA') && !agencyCode) {
    return { reason: 'Agência sem código do Lattes: escolha pela lista de agências' };
  }
  if (agencyCode && bolsa !== 'SIM') return { reason: 'Agência informada sem bolsa' };
  if (bolsa === 'SIM' && !agencyCode) return { reason: 'Bolsa sem a agência do Lattes' };
  const filled = filledChildren(el);
  if (filled.length > 0) {
    return { reason: 'Palavras-chave, áreas e setores da formação ainda vão à mão' };
  }
  const { missing, set, wrong } = mapAttrs(change, el, FORMATION_FIELDS, FORMATION_HANDLED);
  const reason = reasonFrom(missing, wrong);
  if (reason) return { reason };
  if (!set.f_ano_ini) return { reason: 'A formação precisa do ano de início' };
  if (bolsa === 'SIM' || bolsa === 'NAO') set.F_BOLSA = bolsa === 'SIM' ? 'S' : 'N';
  return {
    agencyCode,
    courseCode,
    expect: {},
    institutionCode,
    institutionName,
    key: change.key,
    kind: 'criar-formacao',
    label,
    level,
    set,
  };
}

/**
 * O formulário de inclusão da formação, no mestrado (seção 4.2 do
 * reconhecimento e seção 17). Só os campos cujo tipo o mapa registrou: o
 * contrato confere esses e não acusa os outros (`partial`).
 */
export const CREATE_FORMACAO_SPEC: FormSpec & { mode: string; partial: true } = {
  action: 'pkg_formacao.FORM',
  fields: {
    f_agencia: hidden,
    F_BOLSA: radio,
    f_carga: hidden,
    f_cod: hidden,
    f_cod_curso: hidden,
    f_cod_curso2: hidden,
    f_cod_inst: hidden,
    f_cod_inst2: hidden,
    f_coorient: text(60),
    f_ctr: hidden,
    f_curso: text(75),
    f_curso_old: hidden,
    f_inst: text(75),
    f_inst_old: hidden,
    f_nivel: hidden,
    f_nme_agencia: text(75),
    f_orient: text(60),
    f_seq: hidden,
    F_STATUS: radio,
    f_tipo: hidden,
    f_tipo_privacidade: select,
    f_titulo: text(254),
    f_tpo_doutorado: radio,
  },
  mode: 'I',
  name: 'GN_FORMACAO2',
  partial: true,
};

// Formação no Lattes -----------------------------------------------------------------

const FORMACAO_FORM = 'GN_FORMACAO2';

/** As formações da lista: links de alteração, com f_seq (seção 5). */
const formacoes = (html: string): LattesLink[] =>
  findLinks(html, 'pkg_formacao.form').filter((l) => l.params.f_seq);

/** A instituição gravada num formulário de formação: código com a letra, num dos dois campos. */
const formationInstitution = (pairs: Pairs) =>
  pairValue(pairs, 'f_cod_inst') || pairValue(pairs, 'f_cod_inst2');

export async function applyCreateFormacao(op: CreateFormacaoOp, port: LattesPort): Promise<Result> {
  const result = (status: OpResult['status'], detail: string): Result => ({
    detail,
    key: op.key,
    status,
  });
  try {
    const menu = await port.menuHtml();
    const listas = findLinks(menu, 'pkg_formacao.lista');
    const lista = listas.find((l) => (l.params.f_tipo ?? '').toUpperCase() === 'FA');
    if (!lista?.params.f_cod) {
      throw new Stop('erro', 'Formação acadêmica não encontrada no menu do Lattes');
    }
    const cv = lista.params.f_cod;
    const before = formacoes(await getChecked(port, lista.path));
    // Duplicata: mesmo nível, mesma instituição e mesmo início.
    for (const link of before) {
      const { pairs } = await readPairs(port, link.path, FORMACAO_FORM);
      if (
        pairValue(pairs, 'f_nivel') === op.level &&
        sameCode(formationInstitution(pairs), op.institutionCode) &&
        pairValue(pairs, 'f_ano_ini') === op.set.f_ano_ini
      ) {
        return result(
          'divergente',
          'O Lattes já tem essa formação (mesmo nível, instituição e início)',
        );
      }
    }

    // O link de cada nível é o que o combo do "Incluir novo item" abre (seção 17).
    const form = await readPairs(
      port,
      `pkg_formacao.form?f_cod=${cv}&f_tipo=FA&f_nivel=${op.level}`,
      FORMACAO_FORM,
    );
    if (
      pairValue(form.pairs, 'f_ctr') !== 'I' ||
      pairValue(form.pairs, 'f_tipo') !== 'FA' ||
      pairValue(form.pairs, 'f_nivel') !== op.level
    ) {
      return result('erro', 'O formulário não é o de inclusão deste nível');
    }
    const absent = absentFields(form.controls, op.set);
    if (absent.length > 0) {
      return result(
        'erro',
        `O formulário deste nível não tem: ${absent.map((f) => CREATE_FIELD_LABELS[f] ?? f).join(', ')}`,
      );
    }

    // Instituição pela busca, por GET (seção 18). O código vai inteiro, com a
    // letra: em f_cod_inst quando começa com V, em f_cod_inst2 nos outros casos.
    const search = encodeLatin1Form([
      ['F_CTR', 'C'],
      ['F_COD', cv],
      ['F_NIVEL', op.level],
      ['F_STA_OUTRA', 'N'],
      ['f_nome', op.institutionName],
    ]);
    const found = institutionResults(await getChecked(port, `PRC_INST_FORM?${search}`)).filter(
      (r) => sameCode(r.code, op.institutionCode),
    );
    if (found.length !== 1) {
      return result(
        'erro',
        `Instituição não encontrada na busca do Lattes (${found.length} resultados com o código)`,
      );
    }
    const inst = found[0]!;
    const lookups: FieldValues = {
      f_inst: inst.name,
      f_inst_old: inst.name,
      [inst.code.startsWith('V') ? 'f_cod_inst' : 'f_cod_inst2']: inst.code,
    };

    // Curso: a lista dos cursos do nível na instituição. O texto da opção vai
    // em f_curso; o código, sem a letra, em f_cod_curso (V) ou f_cod_curso2.
    if (op.courseCode) {
      const courses = selectEntries(
        await getChecked(
          port,
          `prc_curso_form?f_cod=${cv}&f_pgm=FORM&f_nivel=${op.level}&f_inst=${inst.code}`,
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
      lookups[course.value.startsWith('V') ? 'f_cod_curso' : 'f_cod_curso2'] =
        course.value.slice(1);
      lookups.f_curso = course.text;
      lookups.f_curso_old = course.text;
    }

    // Agência: lista fixa, cada uma um atribuir('<código>','<nome>').
    if (op.agencyCode) {
      const agencies = jsCalls(
        await getChecked(port, `prc_agencia?f_cod=${cv}`),
        'atribuir',
      ).filter((args) => sameCode(args[0], op.agencyCode!));
      if (agencies.length !== 1) {
        return result(
          'erro',
          `Agência não encontrada na lista do Lattes (${agencies.length} achadas)`,
        );
      }
      lookups.f_agencia = agencies[0]![0]!;
      lookups.f_nme_agencia = agencies[0]![1] ?? '';
    }

    const set = { ...op.set, ...lookups };
    const limit = overLimit(form.controls, set);
    if (limit) return result('erro', limit);
    const response = await port.post(
      CREATE_FORMACAO_SPEC.action,
      encodeLatin1Form(setPairs(form.pairs, set)),
    );
    if (isLogonPage(response)) return result('sessao', SESSION);

    try {
      const known = new Set(before.map((l) => l.params.f_seq));
      const created = formacoes(await getChecked(port, lista.path)).filter(
        (l) => !known.has(l.params.f_seq),
      );
      if (created.length !== 1) {
        return maybeCreated(
          op.key,
          'A formação pode ter sido criada',
          `a lista mostra ${created.length} formações novas`,
        );
      }
      const seq = created[0]!.params.f_seq!;
      const assigned = { 'SEQUENCIA-FORMACAO': seq };
      const saved = (await readPairs(port, created[0]!.path, FORMACAO_FORM)).pairs;
      const wrong = notSaved(saved, op.set);
      if (!sameCode(formationInstitution(saved), op.institutionCode)) wrong.push('Instituição');
      if (wrong.length > 0) {
        return {
          ...result(
            'divergente',
            `Criada no Lattes (formação ${seq}), mas gravada diferente: ${wrong.join(', ')}`,
          ),
          assigned,
        };
      }
      return { ...result('conferido', `Criada e conferida no Lattes (formação ${seq})`), assigned };
    } catch (err) {
      return maybeCreated(
        op.key,
        'A formação pode ter sido criada',
        `a conferência falhou (${err instanceof Error ? err.message : 'falha inesperada'})`,
      );
    }
  } catch (err) {
    if (err instanceof Stop) return result(err.status, err.message);
    return result('erro', err instanceof Error ? err.message : 'Falha inesperada');
  }
}
