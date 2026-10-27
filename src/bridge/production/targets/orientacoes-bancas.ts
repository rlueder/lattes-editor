// Orientações e participações em banca. Campos e opções: censo de 15/10/2026
// (docs/lattes-formularios/), formulário de inclusão de cada lista, e a
// captura das listas de 13/10/2026 (docs/lattes-listas/), que tem o f_ref e
// os caminhos das listas. O currículo do censo não tinha orientação nem
// banca: nada aqui foi visto em modo de alteração. Inferido, então, para
// todos os tipos: que a lista leve ao formulário com f_seq e f_ctr U, como o
// trabalho técnico, e que cada campo guarde o atributo do mesmo sentido (pelo
// rótulo do censo).
//
// À mão, com o motivo em manual (o plano o mostra):
// - instituição e curso: f_inst e f_curso vêm desabilitados e são preenchidos
//   pelas buscas prc_inst_form e prc_curso_form, que gravam os códigos em
//   ocultos (f_cod_inst, f_cod_curso);
// - agência: o texto f_nme_agencia anda junto do código oculto f_agencia, que
//   sai da busca prc_agencia; trocar só o nome deixaria o código antigo;
// - instituição da banca julgadora: o f_inst é texto, mas com o código oculto
//   f_cod_inst ao lado, pelo mesmo motivo;
// - natureza, onde o elemento do XML a fixa (mestrado, doutorado, as bancas):
//   a natureza é o tipo do item, e trocá-la é incluir o item de novo no tipo
//   certo. Nas outras orientações concluídas, que têm mais de uma, a troca
//   entre aperfeiçoamento, graduação e iniciação científica vai pelo conector
//   (nature.ts); de ou para outra natureza, fica à mão;
// - tipo da orientação de outra natureza (o prompt() do atribui_ot);
// - identificador do orientando: o oculto f_id_orientado (inferido pelo nome).
// Sem campo no formulário (o plano diz "não tem"): DOI, órgão, número de
// páginas, nome do curso em inglês e o tipo de outra banca.

import { lattesSchema } from '../../../schema/lattes.ts';
import { BANCA_PARTICIPANTS } from '../grids.ts';
import type { LookupSpec } from '../lookups.ts';
import { byTable, country, language, yesNo } from '../mappers.ts';
import type { FieldMap, GridField, ProductionTarget } from '../types.ts';
import { masterKind } from './orientacao-tipo.ts';

/**
 * Nível da lista de cursos pela natureza, como o retnivel() de cada página
 * (pkg_orient.form e PKG_BANCA_TRAB.form, lidas em 18/10/2026); o mestrado
 * profissional (f_sub_prod 30, 37 ou "35 ") pede o 9. As naturezas que a
 * página marca com f_sta_area=N são as do terceiro e do quarto rádio.
 */
const ORIENT_COURSE = {
  done: {
    level: { '41': '3', '42': '4', '43': '2', '44': '1', '45': '1', '49': '1' },
    noArea: ['43', '44'],
    optional: ['45', '46', '49'],
    professional: { nature: '41', subProd: '30' },
  },
  ongoing: {
    level: { A41: '3', A42: '4', A43: '2', A44: '1', A45: '1', A49: '1' },
    noArea: ['A43', 'A44'],
    optional: ['A45', 'A46', 'A49'],
    professional: { nature: 'A41', subProd: '37' },
  },
};
// A banca de trabalho escolhe o nível das buscas pelo índice do rádio da
// natureza, e um script da página, na carga, põe a qualificação de mestrado
// (A16) logo depois da de doutorado (A13): a ordem viva é A11, A12, A13, A16,
// A14, A15. Os níveis abaixo são os que o sele_inst() e o curso() da própria
// página montaram com cada natureza marcada, numa página carregada em
// 27/10/2026, sem enviar.
const BOARD_COURSE = {
  level: { A11: '3', A12: '4', A13: '4', A14: '2', A15: '1', A16: '3' },
  noArea: ['A13', 'A16'],
  professional: { nature: 'A11', subProd: '35 ' },
};
/** O f_nivel da busca de instituição da banca de trabalho, pela natureza (sele_inst() da página). */
const BOARD_INSTITUTION_LEVEL = {
  A11: 'GM',
  A12: 'GD',
  A13: 'GD',
  A14: 'GG',
  A15: 'GE',
  A16: 'AP',
};

/** Só os pares que o XSD tem no filho. */
function specIn(spec: LookupSpec): LookupSpec {
  const has = (attr: string) =>
    lattesSchema.elements[spec.child]?.attributes.some((a) => a.name === attr) ?? false;
  const keep = <T extends { code: string; name: string }>(p?: T) =>
    p && has(p.code) && has(p.name) ? p : undefined;
  const course = keep(spec.course);
  const agency = keep(spec.agency);
  return {
    child: spec.child,
    institution: spec.institution,
    ...(course ? { course } : {}),
    ...(agency ? { agency } : {}),
    ...(spec.institutionLevel ? { institutionLevel: spec.institutionLevel } : {}),
  };
}

const ORIENT_GRIDS: GridField[] = ['f_plv_l', 'f_setor_l', 'f_area_l'];
const BANCA_GRIDS: GridField[] = ['f_autores_l', 'f_plv_l', 'f_setor_l', 'f_area_l'];

/** f_tpo_orient: O "Orientador principal", C "coorientador" (lista L57). */
const ADVISOR_ROLE = byTable({ CO_ORIENTADOR: 'C', ORIENTADOR_PRINCIPAL: 'O' });

/**
 * f_sub_prod da banca, "(apenas para mestrado)": 34 Acadêmico, 35
 * Profissional, com o espaço no fim do valor como o censo registrou.
 * Inferido pelo rótulo.
 */
const MASTERS_KIND = byTable({ ACADEMICO: '34 ', NAO_INFORMADO: '', PROFISSIONALIZANTE: '35 ' });

/**
 * O rótulo de cada natureza no rádio F_COD_PROD (censo de 15/10/2026); as
 * orientações em andamento usam os mesmos com A na frente do código.
 */
const NATURE_LABELS: Record<string, string> = {
  '41': 'Dissertação de mestrado',
  '42': 'Tese de doutorado',
  '43': 'Monografia de conclusão de curso de aperfeiçoamento/especialização',
  '44': 'Trabalho de conclusão de curso de graduação',
  '45': 'Iniciação Científica',
  '46': 'Supervisão de pós-doutorado',
  '49': 'Orientação de outra natureza',
  A11: 'Mestrado',
  A12: 'Doutorado',
  A14: 'Curso de aperfeiçoamento/especialização',
  A15: 'Graduação',
  A21: 'Professor titular',
  A22: 'Concurso público',
  A23: 'Livre-docência',
  A24: 'Avaliação de cursos',
  A29: 'Outra',
};
const natureLabel = (code: string) => NATURE_LABELS[code] ?? NATURE_LABELS[code.slice(1)] ?? code;

const BACK = 'troque no Lattes';
const WHY = {
  agency: `a agência sai de uma busca do Lattes, que grava o código dela num campo oculto; ${BACK}`,
  course: `o curso sai de uma busca do Lattes, que grava o código dele num campo oculto; ${BACK}`,
  institution: `a instituição sai de uma busca do Lattes, que grava o código dela num campo oculto; ${BACK}`,
  judgingInstitution: `o Lattes guarda o código da instituição num campo oculto ao lado do nome, e trocar só o nome deixaria o código antigo; ${BACK}`,
  /** O tipo do mestrado (e, inferido, o de outra natureza): f_sub_prod, do atribui() da janela. */
  kind: `o tipo sai de uma janela do Lattes que grava o código num campo oculto, e os códigos dela não foram lidos; ${BACK}`,
  /**
   * Natureza que o elemento do XML fixa: no Lattes a natureza é o tipo do item,
   * e o XML guarda cada tipo num elemento.
   */
  nature: (code: string) =>
    `${natureLabel(code)} é o tipo do item no Lattes; para trocar, inclua o item de novo no tipo certo`,
  /** A banca de outras participações: o rádio do formulário de inclusão não tem a opção. */
  otherBoard: `o rádio da natureza da banca não tem opção para outras participações, e a página de uma delas não foi lida; ${BACK}`,
  /** De ou para 49: o atribui() da janela de outra natureza escreve f_sub_prod e f_dsc_outra. */
  otherNature: `a orientação de outra natureza pede o subtipo numa janela do Lattes que não foi lida; ${BACK}`,
  /**
   * Pós-doutorado: curso() responde "Não informe o curso para natureza
   * Supervisão de pós-doutorado", e testa_nivel() limpa os códigos do curso
   * (lattes_internals.md, seção 18).
   */
  postdocCourse:
    'O formulário de orientação do Lattes não aceita curso na supervisão de pós-doutorado: a página pede para não informar e limpa o curso',
  studentId: 'o Lattes guarda o identificador num campo oculto que só a página dele preenche',
};

/** Os atributos à mão de um tipo: atributo do filho → motivo. */
const manualOf = (entries: [string, string[], string][]): Record<string, string> =>
  inSchema(
    Object.fromEntries(
      entries.flatMap(([child, attrs, why]) => attrs.map((a) => [`${child}@${a}`, why])),
    ),
  );

const INSTITUTION = ['CODIGO-INSTITUICAO', 'NOME-DA-INSTITUICAO', 'NOME-INSTITUICAO'];
const COURSE = ['CODIGO-CURSO', 'NOME-CURSO', 'NOME-DO-CURSO'];

/** Só as chaves cujo atributo o XSD tem no elemento (o andamento não tem FLAG-RELEVANCIA). */
function inSchema<T>(fields: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(fields).filter(([key]) => {
      const [child, attr] = key.split('@') as [string, string];
      return lattesSchema.elements[child]?.attributes.some((a) => a.name === attr) ?? false;
    }),
  );
}

/** Os campos que as quatro telas têm iguais: título, ano, país, idioma, home page, inglês e f_ref. */
function common(basics: string, title: string): Record<string, FieldMap | string> {
  return {
    [`${basics}@${title}-INGLES`]: 'f_titulo_en',
    [`${basics}@${title}`]: 'f_titulo',
    [`${basics}@ANO`]: 'f_ano',
    [`${basics}@HOME-PAGE`]: 'f_homepage',
    [`${basics}@IDIOMA`]: { field: 'F_IDIOMA', toForm: language },
    [`${basics}@PAIS`]: { field: 'f_pais', toForm: country },
    'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS': 'f_ref',
    'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES': 'f_ref_en',
  };
}

interface Orientation {
  /** Sufixo dos filhos (PARA-MESTRADO, DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO...). */
  basics: string;
  detail: string;
  element: string;
  id: string;
  nature: string[];
  /** Com mais de uma natureza: o F_COD_PROD de cada NATUREZA do XML (lookups.ts). */
  natures?: Record<string, string>;
  /** Mestrado e doutorado: o rádio f_tpo_orient. */
  role?: boolean;
}

/**
 * Uma orientação (PKG_ORIENT, POST PKG_ORIENT.FORM): a lista
 * pkg_orient.lista com f_tipo C (concluídas) ou A (em andamento), observada
 * no menu em 13/10/2026; o formulário pkg_orient.form com o mesmo f_tipo.
 * A natureza é o rádio F_COD_PROD (listas L56 e L58).
 */
function orientation(o: Orientation, done: boolean): ProductionTarget {
  const title = done ? 'TITULO' : 'TITULO-DO-TRABALHO';
  const student = done ? 'NOME-DO-ORIENTADO' : 'NOME-DO-ORIENTANDO';
  const studentId = done ? 'NUMERO-ID-ORIENTADO' : 'NUMERO-ID-ORIENTANDO';
  const fields: Record<string, FieldMap | string> = {
    ...common(o.basics, title),
    // A natureza que se escolhe no elemento (outras orientações concluídas).
    ...(o.natures
      ? { [`${o.basics}@NATUREZA`]: { field: 'F_COD_PROD', toForm: byTable(o.natures) } }
      : {}),
    [`${o.basics}@FLAG-RELEVANCIA`]: { field: 'F_RELEV', toForm: yesNo },
    [`${o.detail}@${student}`]: 'f_nme_orient',
    [`${o.detail}@FLAG-BOLSA`]: { field: 'F_BOLSA', toForm: yesNo },
  };
  if (o.role)
    fields[`${o.detail}@TIPO-DE-ORIENTACAO`] = { field: 'f_tpo_orient', toForm: ADVISOR_ROLE };
  const tipo = done ? 'C' : 'A';
  const da = done ? 'DA-' : '';
  const doo = done ? 'DO-' : '';
  const postdoc = o.nature.some((n) => n.endsWith('46'));
  const lookups = specIn({
    agency: { code: 'CODIGO-AGENCIA-FINANCIADORA', name: 'NOME-DA-AGENCIA' },
    child: o.detail,
    // "Não informe o curso para natureza Supervisão de pós-doutorado" (curso() da página).
    ...(postdoc
      ? {}
      : {
          course: {
            code: 'CODIGO-CURSO',
            name: `NOME-${doo}CURSO`,
            ...ORIENT_COURSE[done ? 'done' : 'ongoing'],
            ...(o.natures ? { natures: o.natures } : {}),
          },
        }),
    institution: { code: 'CODIGO-INSTITUICAO', name: `NOME-${da}INSTITUICAO` },
  });
  return {
    element: o.element,
    fields: inSchema(fields),
    form: { action: 'PKG_ORIENT.FORM', name: 'PKG_ORIENT' },
    grids: [...ORIENT_GRIDS],
    id: o.id,
    list: { formProc: 'pkg_orient.form', params: { f_tipo: tipo }, proc: 'pkg_orient.lista' },
    lookups,
    manual: manualOf([
      ...(o.natures
        ? []
        : [[o.basics, ['NATUREZA'], WHY.nature(o.nature[0]!)] as [string, string[], string]]),
      [o.basics, ['TIPO'], WHY.kind],
      [o.detail, INSTITUTION, WHY.institution],
      [o.detail, COURSE, postdoc ? WHY.postdocCourse : WHY.course],
      [o.detail, ['CODIGO-AGENCIA-FINANCIADORA', 'NOME-DA-AGENCIA'], WHY.agency],
      [o.detail, ['NUMERO-ID-ORIENTADO', 'NUMERO-ID-ORIENTANDO'], WHY.studentId],
    ]),
    nature: { field: 'F_COD_PROD', values: o.nature },
    ...(['41', 'A41'].includes(o.nature[0]!)
      ? { partFields: { [o.basics]: masterKind(done) } }
      : {}),
    // testa_nivel(): f_dsc_outra sempre, e f_sub_prod, que segue a natureza
    // (lido em 20/10/2026); a outra natureza pede a janela do subtipo.
    ...(o.natures
      ? {
          natureSwap: {
            byHand: { [o.nature.find((n) => n.endsWith('49'))!]: WHY.otherNature },
            clears: ['f_dsc_outra', 'f_sub_prod'],
            key: `${o.basics}@NATUREZA`,
          },
        }
      : {}),
    // O identificador do orientando sai da validação do nome (student.ts).
    ...(lattesSchema.elements[o.detail]?.attributes.some((a) => a.name === studentId)
      ? { student: { child: o.detail, idAttr: studentId } }
      : {}),
    title: { attr: title, child: o.basics },
    year: { attr: 'ANO', child: o.basics },
  };
}

const CONCLUDED: ProductionTarget[] = (
  [
    ['PARA-MESTRADO', 'mestrado', ['41'], true],
    ['PARA-DOUTORADO', 'doutorado', ['42'], true],
    ['PARA-POS-DOUTORADO', 'pos-doutorado', ['46'], false],
  ] as const
)
  .map(([suffix, id, nature, role]) =>
    orientation(
      {
        basics: `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-${suffix}`,
        detail: `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-${suffix}`,
        element: `ORIENTACOES-CONCLUIDAS-${suffix}`,
        id: `orientacao-concluida-${id}`,
        nature: [...nature],
        role,
      },
      true,
    ),
  )
  .concat(
    // Aperfeiçoamento, graduação, iniciação científica e outra natureza
    // concluídas ficam todas neste elemento (o NATUREZA do XML diz qual).
    orientation(
      {
        basics: 'DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS',
        detail: 'DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS',
        element: 'OUTRAS-ORIENTACOES-CONCLUIDAS',
        id: 'orientacao-concluida-outra',
        nature: ['43', '44', '45', '49'],
        // NATUREZA ↔ F_COD_PROD: uma ligação por natureza no censo de
        // 18/10/2026 (censo-2026-10-18-ligacoes.json, 4 itens de teste, sem conflito).
        natures: {
          INICIACAO_CIENTIFICA: '45',
          MONOGRAFIA_DE_CONCLUSAO_DE_CURSO_APERFEICOAMENTO_E_ESPECIALIZACAO: '43',
          'ORIENTACAO-DE-OUTRA-NATUREZA': '49',
          TRABALHO_DE_CONCLUSAO_DE_CURSO_GRADUACAO: '44',
        },
      },
      true,
    ),
  );

const ONGOING: ProductionTarget[] = (
  [
    ['MESTRADO', 'mestrado', 'A41', true],
    ['DOUTORADO', 'doutorado', 'A42', true],
    ['POS-DOUTORADO', 'pos-doutorado', 'A46', false],
    ['APERFEICOAMENTO-ESPECIALIZACAO', 'aperfeicoamento', 'A43', false],
    ['GRADUACAO', 'graduacao', 'A44', false],
    ['INICIACAO-CIENTIFICA', 'iniciacao-cientifica', 'A45', false],
  ] as const
)
  .map(([suffix, id, nature, role]) =>
    orientation(
      {
        basics: `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-${suffix}`,
        detail: `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-${suffix}`,
        element: `ORIENTACAO-EM-ANDAMENTO-DE-${suffix}`,
        id: `orientacao-andamento-${id}`,
        nature: [nature],
        role,
      },
      false,
    ),
  )
  .concat(
    orientation(
      {
        basics: 'DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO',
        detail: 'DETALHAMENTO-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO',
        element: 'OUTRAS-ORIENTACOES-EM-ANDAMENTO',
        id: 'orientacao-andamento-outra',
        nature: ['A49'],
      },
      false,
    ),
  );

/**
 * Banca de trabalho de conclusão (PKG_BANCA_TRAB, POST PKG_BANCA_TRAB.FORM),
 * da lista pkg_banca_trab.lista; o candidato é f_nme_orient, os
 * participantes vão na grade f_autores_l. A natureza é o rádio F_COD_PROD
 * (lista L60), que não tem opção para "outras participações": esse tipo se
 * acha só pelo título e pelo ano.
 */
function thesisBoard(
  suffix: string,
  id: string,
  nature?: string[],
  natures?: Record<string, string>,
): ProductionTarget {
  const de =
    suffix === 'OUTRAS'
      ? 'DE-OUTRAS-PARTICIPACOES-EM-BANCA'
      : `DA-PARTICIPACAO-EM-BANCA-DE-${suffix}`;
  const basics = `DADOS-BASICOS-${de}`;
  return {
    authors: BANCA_PARTICIPANTS,
    element:
      suffix === 'OUTRAS' ? 'OUTRAS-PARTICIPACOES-EM-BANCA' : `PARTICIPACAO-EM-BANCA-DE-${suffix}`,
    fields: inSchema({
      ...common(basics, 'TITULO'),
      // O TIPO do mestrado; o das outras participações é texto sem campo.
      ...(suffix === 'MESTRADO'
        ? { [`${basics}@TIPO`]: { field: 'f_sub_prod', toForm: MASTERS_KIND } }
        : {}),
      // A natureza que se escolhe no elemento (qualificação de mestrado ou doutorado).
      ...(natures
        ? { [`${basics}@NATUREZA`]: { field: 'F_COD_PROD', toForm: byTable(natures) } }
        : {}),
      [`DETALHAMENTO-${de}@NOME-DO-CANDIDATO`]: 'f_nme_orient',
    }),
    form: { action: 'PKG_BANCA_TRAB.FORM', name: 'PKG_BANCA_TRAB' },
    grids: [...BANCA_GRIDS],
    id: `banca-trabalho-${id}`,
    list: { formProc: 'PKG_BANCA_TRAB.form', proc: 'pkg_banca_trab.lista' },
    lookups: specIn({
      child: `DETALHAMENTO-${de}`,
      course: {
        code: 'CODIGO-CURSO',
        name: 'NOME-CURSO',
        ...BOARD_COURSE,
        ...(natures ? { natures } : {}),
      },
      institution: { code: 'CODIGO-INSTITUICAO', name: 'NOME-INSTITUICAO' },
      institutionLevel: BOARD_INSTITUTION_LEVEL,
    }),
    manual: manualOf([
      ...(natures
        ? []
        : [
            [basics, ['NATUREZA'], !nature ? WHY.otherBoard : WHY.nature(nature[0]!)] as [
              string,
              string[],
              string,
            ],
          ]),
      [`DETALHAMENTO-${de}`, INSTITUTION, WHY.institution],
      [`DETALHAMENTO-${de}`, COURSE, WHY.course],
    ]),
    ...(nature ? { nature: { field: 'F_COD_PROD', values: nature } } : {}),
    // testa_nivel() da banca (lido em 27/10/2026, sem enviar): com a instituição
    // preenchida, a troca do tipo limpa os códigos e os textos da instituição e
    // do curso e pede os dois de novo; nada mais. As buscas os escolhem de novo
    // com o nível da natureza nova (nature.ts).
    ...(natures ? { natureSwap: { byHand: {}, clears: [], key: `${basics}@NATUREZA` } } : {}),
    title: { attr: 'TITULO', child: basics },
    year: { attr: 'ANO', child: basics },
  };
}

const THESIS_BOARDS: ProductionTarget[] = [
  thesisBoard('MESTRADO', 'mestrado', ['A11']),
  thesisBoard('DOUTORADO', 'doutorado', ['A12']),
  // Qualificação de doutorado (A13) e de mestrado (A16) são o mesmo elemento.
  // A NATUREZA da qualificação é o rótulo do rádio (censo de 18/10/2026,
  // escrita "rotulo", 2 itens de teste; listas-producao.json).
  thesisBoard('EXAME-QUALIFICACAO', 'qualificacao', ['A13', 'A16'], {
    'Exame de qualificação de doutorado': 'A13',
    'Exame de qualificação de mestrado': 'A16',
  }),
  thesisBoard('APERFEICOAMENTO-ESPECIALIZACAO', 'aperfeicoamento', ['A14']),
  thesisBoard('GRADUACAO', 'graduacao', ['A15']),
  thesisBoard('OUTRAS', 'outra'),
];

/**
 * Banca julgadora (PKG_BANCA_JULG, POST PKG_BANCA_JULG.FORM), da lista
 * pkg_banca_julg.lista; a natureza é o rádio F_COD_PROD (lista L61).
 */
function judgingBoard(suffix: string, id: string, nature: string): ProductionTarget {
  const outras = suffix === 'OUTRAS';
  const de = outras ? 'DE-OUTRAS-BANCAS-JULGADORAS' : `DA-BANCA-JULGADORA-PARA-${suffix}`;
  const basics = `DADOS-BASICOS-${de}`;
  const detail = `DETALHAMENTO-${de}`;
  return {
    authors: BANCA_PARTICIPANTS,
    element: outras ? 'OUTRAS-BANCAS-JULGADORAS' : `BANCA-JULGADORA-PARA-${suffix}`,
    fields: inSchema(common(basics, 'TITULO')),
    form: { action: 'PKG_BANCA_JULG.FORM', name: 'PKG_BANCA_JULG' },
    grids: [...BANCA_GRIDS],
    id: `banca-julgadora-${id}`,
    list: { formProc: 'PKG_BANCA_JULG.form', proc: 'pkg_banca_julg.lista' },
    lookups: {
      child: detail,
      institution: { code: 'CODIGO-INSTITUICAO', name: 'NOME-INSTITUICAO' },
    },
    manual: manualOf([
      [basics, ['NATUREZA'], WHY.nature(nature)],
      [detail, INSTITUTION, WHY.judgingInstitution],
    ]),
    nature: { field: 'F_COD_PROD', values: [nature] },
    title: { attr: 'TITULO', child: basics },
    year: { attr: 'ANO', child: basics },
  };
}

const JUDGING_BOARDS: ProductionTarget[] = [
  judgingBoard('PROFESSOR-TITULAR', 'professor-titular', 'A21'),
  judgingBoard('CONCURSO-PUBLICO', 'concurso-publico', 'A22'),
  judgingBoard('LIVRE-DOCENCIA', 'livre-docencia', 'A23'),
  judgingBoard('AVALIACAO-CURSOS', 'avaliacao-cursos', 'A24'),
  judgingBoard('OUTRAS', 'outra', 'A29'),
];

export const ORIENTACOES_BANCAS_TARGETS: ProductionTarget[] = [
  ...CONCLUDED,
  ...ONGOING,
  ...THESIS_BOARDS,
  ...JUDGING_BOARDS,
];
