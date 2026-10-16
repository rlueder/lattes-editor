// Alterar no lugar uma formação acadêmica (lista f_tipo=FA), um pós-doutorado
// ou uma livre-docência (lista f_tipo=AP) pelo conector (LAT-23, LAT-58). O
// formulário é o GN_FORMACAO2 de cada nível, POST pkg_formacao.FORM; o que
// cada nível mostra foi lido no censo de 15/10/2026
// (docs/lattes-formularios/, entradas formacao-FA-* e formacao-AP-*), e um
// teste confere esta tabela com a captura.
//
// Campo que o nível mostra vai direto. Campo que o nível traz oculto (o título
// e o ano de obtenção do pós-doutorado, por exemplo) conta como "o formulário
// não tem": a página não deixa a pessoa mudá-lo, e o conector não manda o que
// a página não manda.
//
// Instituição, curso e agência só entram pelas buscas do Lattes (seção 18 de
// docs/lattes_internals.md), como na inclusão (create-formacao.ts): a
// operação leva o código novo, e apply.ts faz a busca na hora de gravar
// (formacao-lookups.ts). Só o nome, sem o código, não tem como ir: o Lattes
// grava o que a busca devolve.
//
// Observado: f_ano_ini, f_ano_fim, F_STATUS, F_BOLSA, f_orient e f_titulo
// (graduação), f_inst_old e f_curso_old, na passada de edição do censo.
// Inferido pelo nome e pelo rótulo do campo, até o teste acompanhado:
// - f_ano_obten ↔ ANO-DE-OBTENCAO-DO-TITULO e f_titulo nos outros níveis;
// - f_coorient ↔ NOME-DO-CO-ORIENTADOR;
// - f_carga ↔ CARGA-HORARIA (especialização e aperfeiçoamento, "Carga Horária");
// - f_tpo_doutorado ↔ TIPO-GRADUACAO ("Tipo de graduação") e TIPO-DOUTORADO
//   (C e CS só pelas opções; N e S vistos em exportações públicas, seção 17);
// - f_orient_dout ↔ NOME-ORIENTADOR-DOUT e NOME-ORIENTADOR-GRAD, f_orient_dout_sw
//   ↔ NOME-DO-ORIENTADOR-SANDUICHE, f_orient_dout_ct ↔
//   NOME-DO-ORIENTADOR-CO-TUTELA (os blocos escondidos que o tipo mostra);
// - f_cod_inst_dout e f_cod_inst2_dout ↔ CODIGO-INSTITUICAO-DOUT e
//   CODIGO-INSTITUICAO-GRAD, pela busca com f_sta_outra=S (seção 18);
// - f_agencia ↔ CODIGO-AGENCIA-FINANCIADORA.

import type { Change } from '../model/changes.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import { AP_LEVELS, FORMATION_LEVELS } from './create-formacao.ts';
import type { FieldValues, OpBase } from './plan.ts';

export type FormationList = 'AP' | 'FA';

/** Onde a busca de instituição grava: a principal ou a do doutorado (f_sta_outra=S). */
export type InstitutionSlot = 'dout' | 'main';

export interface InstitutionLookup {
  /** O código de antes, sem a letra: o Lattes precisa estar com ele. */
  before: string;
  /** O código novo, como o XML guarda (sem a letra). */
  code: string;
  /** O nome novo, que vai na busca. */
  name: string;
  slot: InstitutionSlot;
}

/** O que a gravação resolve nas buscas do Lattes antes de enviar. */
export interface FormacaoLookups {
  /** Código da agência nova; vazio tira a agência. */
  agency?: string;
  /** Código do curso novo, sem a letra. */
  course?: string;
  institutions?: InstitutionLookup[];
}

/** Uma linha "antes → depois" das buscas, para quem confere o envio. */
export interface LookupRow {
  after: string;
  before: string;
  label: string;
  name: string;
}

/**
 * Formação: o formulário se abre pelo link da lista com f_seq =
 * SEQUENCIA-FORMACAO, e a identidade (instituição, curso, ano de início) diz
 * se é mesmo o item.
 */
export interface FormacaoOp extends OpBase {
  kind: 'formacao';
  /** A lista do menu: FA (formação acadêmica) ou AP (pós-doutorado e livre-docência). Sem valor, FA. */
  list?: FormationList;
  /** As trocas que as buscas fazem, só para mostrar. */
  lookupRows?: LookupRow[];
  lookups?: FormacaoLookups;
  seq: string;
}

interface Level {
  name: string;
  /** Opções de f_tpo_doutorado, quando o nível mostra o rádio. */
  types?: readonly string[];
  /** Os campos que o formulário do nível mostra (os outros vêm ocultos ou não existem). */
  visible: readonly string[];
}

const BASE = ['f_inst', 'F_STATUS', 'f_ano_ini', 'f_ano_fim'];
const GRANT = ['F_BOLSA', 'f_nme_agencia'];
/** Os blocos do sanduíche e da cotutela, que f_tpo_doutorado mostra. */
const DOUT_BLOCK = [
  'f_orient_dout',
  'f_inst_dout',
  'f_meses_sw',
  'f_orient_dout_sw',
  'f_inst_dout_sw',
  'f_meses_sw_aux',
  'f_orient_dout_ct',
  'f_inst_dout_ct',
];
const MASTER = [
  'f_tpo_doutorado',
  'f_curso',
  ...BASE,
  'f_mes_obten',
  'f_ano_obten',
  ...GRANT,
  'f_titulo',
  'f_orient',
  'f_coorient',
  ...DOUT_BLOCK,
];
const SPECIALIZATION = ['f_curso', 'f_carga', ...BASE, ...GRANT, 'f_titulo', 'f_orient'];
const SCHOOL = [...BASE];

/** Os campos de cada nível, pelo código de f_nivel (censo de 15/10/2026). */
export const LEVEL_FORMS: Record<string, Level> = {
  '1': {
    name: 'graduação',
    types: ['N', 'S'],
    visible: [
      'f_tpo_doutorado',
      'f_curso',
      ...BASE,
      ...GRANT,
      'f_titulo',
      'f_orient',
      ...DOUT_BLOCK,
    ],
  },
  '2': { name: 'especialização', visible: SPECIALIZATION },
  '3': { name: 'mestrado', types: ['N', 'S'], visible: MASTER },
  '4': { name: 'doutorado', types: ['N', 'S', 'C', 'CS'], visible: MASTER },
  '5': { name: 'pós-doutorado', visible: [...BASE, ...GRANT] },
  '6': { name: 'livre-docência', visible: ['f_inst', 'f_mes_obten', 'f_ano_obten', 'f_titulo'] },
  '7': { name: 'ensino técnico', visible: ['f_curso', ...BASE, ...GRANT] },
  '9': { name: 'mestrado profissional', types: ['N', 'S'], visible: MASTER },
  B: { name: 'ensino fundamental', visible: SCHOOL },
  C: { name: 'ensino médio', visible: SCHOOL },
  D: { name: 'residência médica', visible: [...BASE, ...GRANT, 'f_titulo', 'f_orient'] },
  X: { name: 'aperfeiçoamento', visible: SPECIALIZATION },
};

/** O código de f_nivel e a lista do menu de um elemento de formação. */
export function formationLevel(element: string): { code: string; list: FormationList } | undefined {
  const fa = FORMATION_LEVELS[element];
  if (fa) return { code: fa, list: 'FA' };
  const ap = AP_LEVELS[element];
  return ap ? { code: ap, list: 'AP' } : undefined;
}

type Mapper = (value: string) => string | null | undefined;
const same: Mapper = (v) => v;

/** STATUS-DO-CURSO → F_STATUS (rótulos lidos em 10/10/2026); vazio é nenhum rádio. */
const STATUS: Record<string, string> = { CONCLUIDO: 'S', EM_ANDAMENTO: 'N', INCOMPLETO: 'I' };
const status: Mapper = (v) => (v ? STATUS[v] : null);

/** Rádio S/N; vazio é nenhum rádio marcado. */
const yesNo: Mapper = (v) => (v === 'SIM' ? 'S' : v === 'NAO' ? 'N' : v ? undefined : null);

/** Carga horária: campo de 4 caracteres, em horas, só dígitos (inferido). */
const hours: Mapper = (v) => (/^\d{0,4}$/.test(v.trim()) ? v.trim() : undefined);

/** Atributo → campo do formulário e conversão. */
const FIELDS: Record<string, [string, Mapper]> = {
  'ANO-DE-CONCLUSAO': ['f_ano_fim', same],
  'ANO-DE-INICIO': ['f_ano_ini', same],
  'ANO-DE-OBTENCAO-DO-TITULO': ['f_ano_obten', same],
  'CARGA-HORARIA': ['f_carga', hours],
  'FLAG-BOLSA': ['F_BOLSA', yesNo],
  'NOME-COMPLETO-DO-ORIENTADOR': ['f_orient', same],
  'NOME-DO-CO-ORIENTADOR': ['f_coorient', same],
  'NOME-DO-ORIENTADOR': ['f_orient', same],
  'NOME-DO-ORIENTADOR-CO-TUTELA': ['f_orient_dout_ct', same],
  'NOME-DO-ORIENTADOR-SANDUICHE': ['f_orient_dout_sw', same],
  'NOME-ORIENTADOR-DOUT': ['f_orient_dout', same],
  'NOME-ORIENTADOR-GRAD': ['f_orient_dout', same],
  'STATUS-DO-CURSO': ['F_STATUS', status],
  'TIPO-DOUTORADO': ['f_tpo_doutorado', same],
  'TIPO-GRADUACAO': ['f_tpo_doutorado', same],
  'TIPO-MESTRADO': ['f_tpo_doutorado', same],
  'TITULO-DA-DISSERTACAO-TESE': ['f_titulo', same],
  'TITULO-DA-MONOGRAFIA': ['f_titulo', same],
  'TITULO-DA-RESIDENCIA-MEDICA': ['f_titulo', same],
  'TITULO-DO-TRABALHO': ['f_titulo', same],
  'TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO': ['f_titulo', same],
};

/** Campos de rádio: o "antes" vazio é nenhum rádio marcado (null), não texto vazio. */
const RADIOS = new Set(['F_BOLSA', 'F_STATUS', 'f_tpo_doutorado']);

/**
 * Atributos sem campo em nenhum formulário de formação do censo. O órgão vem
 * junto da instituição, os nomes em inglês e os dados do Oasisbr não aparecem
 * na página, e o número do orientador fica num oculto (f_id_orientador).
 */
const NO_FIELD = new Set([
  'CODIGO-ORGAO',
  'FORMACAO-ACADEMICA-TITULACAO',
  'ID-OASIS',
  'NOME-CURSO-INGLES',
  'NOME-ORGAO',
  'NUMERO-DO-REGISTRO',
  'NUMERO-ID-ORIENTADOR',
  'STATUS-DO-ESTAGIO',
  'STATUS-OASISBR',
  'TITULO-DA-DISSERTACAO-TESE-INGLES',
  'TITULO-DA-MONOGRAFIA-INGLES',
  'TITULO-DA-RESIDENCIA-MEDICA-INGLES',
  'TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO-INGLES',
  'TITULO-DO-TRABALHO-INGLES',
]);

/** A instituição "outra", cadastrada fora da busca: o formulário não tem campo para ela. */
const OTHER_INSTITUTION = /^(CODIGO|NOME)-INSTITUICAO-OUTRA-/;

/** A instituição do sanduíche e a da cotutela: a exportação traz só o código. */
const CODE_ONLY_INSTITUTION = new Set([
  'CODIGO-INSTITUICAO-CO-TUTELA',
  'CODIGO-INSTITUICAO-SANDUICHE',
]);

/** As instituições que se escolhem pela busca: atributos e o campo que o nível precisa mostrar. */
const INSTITUTIONS: { code: string; name: string; shown: string; slot: InstitutionSlot }[] = [
  { code: 'CODIGO-INSTITUICAO', name: 'NOME-INSTITUICAO', shown: 'f_inst', slot: 'main' },
  {
    code: 'CODIGO-INSTITUICAO-DOUT',
    name: 'NOME-INSTITUICAO-DOUT',
    shown: 'f_inst_dout',
    slot: 'dout',
  },
  {
    code: 'CODIGO-INSTITUICAO-GRAD',
    name: 'NOME-INSTITUICAO-GRAD',
    shown: 'f_inst_dout',
    slot: 'dout',
  },
];

const COURSE_ATTRS = ['CODIGO-CURSO', 'NOME-CURSO', 'CODIGO-CURSO-CAPES', 'CODIGO-AREA-CURSO'];
const AGENCY_ATTRS = ['CODIGO-AGENCIA-FINANCIADORA', 'NOME-AGENCIA'];

const LOOKUP_ATTRS = new Set([
  ...INSTITUTIONS.flatMap((i) => [i.code, i.name]),
  ...COURSE_ATTRS,
  ...AGENCY_ATTRS,
]);

type Planned = FormacaoOp | { reason: string };

/** O valor de antes e o de agora de um atributo, com ou sem mudança. */
function values(change: Change, el: XElement) {
  const changed = new Map(change.fields.map((f) => [f.attr, f]));
  return {
    after: (attr: string) => getAttr(el, attr) ?? '',
    before: (attr: string) => changed.get(attr)?.before ?? getAttr(el, attr) ?? '',
    label: (attr: string) => changed.get(attr)?.label ?? attr,
    touched: (attrs: string[]) => attrs.some((a) => changed.has(a)),
  };
}

/** Os campos de texto e rádio: set e expect, ou o motivo de não ir. */
function plainFields(
  change: Change,
  level: Level,
  set: FieldValues,
  expect: FieldValues,
): { reason: string } | undefined {
  const absent: string[] = [];
  const missing: string[] = [];
  for (const f of change.fields) {
    if (LOOKUP_ATTRS.has(f.attr) || f.attr === 'SEQUENCIA-FORMACAO') continue;
    if (f.attr === 'NIVEL') {
      return {
        reason:
          'O nível é o tipo da formação no Lattes: para trocar, inclua a formação de novo no nível certo',
      };
    }
    if (OTHER_INSTITUTION.test(f.attr)) {
      return {
        reason:
          'Instituição cadastrada fora da busca: o formulário de formação do Lattes não tem campo para ela; escolha a instituição pela busca no próprio Lattes',
      };
    }
    if (CODE_ONLY_INSTITUTION.has(f.attr)) {
      return {
        reason:
          'A instituição do sanduíche e a da cotutela só se escolhem pela busca do Lattes, e a exportação traz só o código, sem o nome para buscar',
      };
    }
    const entry = FIELDS[f.attr];
    if (NO_FIELD.has(f.attr) || (entry && !level.visible.includes(entry[0]))) {
      absent.push(f.label);
      continue;
    }
    if (!entry) {
      missing.push(f.label);
      continue;
    }
    const [field, map] = entry;
    if (field in set) {
      // Dois atributos no mesmo campo: um sobrescreveria o outro sem aviso.
      missing.push(f.label);
      continue;
    }
    const after = map(f.after);
    const before = RADIOS.has(field) && f.before === '' ? null : map(f.before);
    if (after === undefined || before === undefined) {
      return { reason: `Valor que o formulário de ${level.name} do Lattes não tem: ${f.label}` };
    }
    if (field === 'f_tpo_doutorado' && after && !level.types?.includes(after)) {
      return { reason: `Tipo que o Lattes não tem para ${level.name}: ${after}` };
    }
    set[field] = RADIOS.has(field) && after === '' ? null : after;
    expect[field] = before;
  }
  if (absent.length > 0) {
    return { reason: `O formulário de ${level.name} do Lattes não tem: ${absent.join(', ')}` };
  }
  if (missing.length > 0) return { reason: `Campos não suportados ainda: ${missing.join(', ')}` };
  return undefined;
}

interface LookupPlan {
  identity: Record<string, string[]>;
  lookups: FormacaoLookups;
  rows: LookupRow[];
}

/** Instituições (a principal e a do doutorado): o código novo vai para a busca. */
function planInstitutions(
  v: ReturnType<typeof values>,
  level: Level,
  out: LookupPlan,
): { reason: string } | undefined {
  for (const slot of INSTITUTIONS) {
    if (!v.touched([slot.code, slot.name])) continue;
    if (!level.visible.includes(slot.shown)) {
      return { reason: `O formulário de ${level.name} do Lattes não tem: ${v.label(slot.name)}` };
    }
    const code = v.after(slot.code);
    const name = v.after(slot.name);
    if (code === v.before(slot.code)) {
      return {
        reason:
          'A instituição só muda pela busca do Lattes, que grava o código e o nome juntos: escolha a instituição pela busca',
      };
    }
    if (!code || !name) {
      return { reason: 'Instituição sem código do Lattes: escolha pela busca de instituições' };
    }
    (out.lookups.institutions ??= []).push({
      before: v.before(slot.code),
      code,
      name,
      slot: slot.slot,
    });
    out.rows.push({
      after: name,
      before: v.before(slot.name),
      label: v.label(slot.name),
      name: slot.code,
    });
    if (slot.slot === 'main') out.identity.f_inst_old = [v.before(slot.name)];
  }
  return undefined;
}

/** Curso: o código novo vai para a lista de cursos da instituição. */
function planCourse(
  v: ReturnType<typeof values>,
  level: Level,
  out: LookupPlan,
): { reason: string } | undefined {
  const institution = out.lookups.institutions?.some((i) => i.slot === 'main') ?? false;
  const touched = v.touched(COURSE_ATTRS);
  if (!level.visible.includes('f_curso')) {
    return touched
      ? { reason: `O formulário de ${level.name} do Lattes não tem: ${v.label('NOME-CURSO')}` }
      : undefined;
  }
  if (!touched && !institution) return undefined;
  const code = v.after('CODIGO-CURSO');
  if (!code && !v.before('CODIGO-CURSO') && !institution) {
    return { reason: 'Curso sem código do Lattes: escolha pela lista de cursos' };
  }
  if (!code) {
    // Inferido: a busca de instituição limpa o curso (seleciona(), seção 18),
    // e sem curso escolhido de novo a formação ficaria sem ele.
    return {
      reason: institution
        ? 'Com a instituição nova, escolha o curso de novo pela lista de cursos do Lattes'
        : 'Tirar o curso pelo conector não foi visto no Lattes: tire no próprio Lattes',
    };
  }
  if (!institution && code === v.before('CODIGO-CURSO')) {
    return {
      reason:
        'O curso só muda pela lista de cursos do Lattes, que grava o código e o nome juntos: escolha o curso pela lista',
    };
  }
  out.lookups.course = code;
  out.identity.f_curso_old = [v.before('NOME-CURSO')];
  out.rows.push({
    after: v.after('NOME-CURSO'),
    before: v.before('NOME-CURSO'),
    label: v.label('NOME-CURSO'),
    name: 'CODIGO-CURSO',
  });
  return undefined;
}

/** Agência e bolsa: as regras da inclusão (create-formacao.ts), mais o tirar a agência. */
function planAgency(
  v: ReturnType<typeof values>,
  level: Level,
  out: LookupPlan,
  expect: FieldValues,
): { reason: string } | undefined {
  const touched = v.touched(AGENCY_ATTRS);
  const bolsa = v.after('FLAG-BOLSA');
  const code = v.after('CODIGO-AGENCIA-FINANCIADORA');
  if (touched && !level.visible.includes('f_nme_agencia')) {
    return {
      reason: `O formulário de ${level.name} do Lattes não tem: ${v.label('NOME-AGENCIA')}`,
    };
  }
  if (!touched && !v.touched(['FLAG-BOLSA'])) return undefined;
  const before = v.before('CODIGO-AGENCIA-FINANCIADORA');
  if (touched && code === before) {
    return {
      reason: code
        ? 'A agência só muda pela lista de agências do Lattes, que grava o código e o nome juntos: escolha a agência pela lista'
        : 'Agência sem código do Lattes: escolha pela lista de agências',
    };
  }
  if ((code || v.after('NOME-AGENCIA')) && bolsa !== 'SIM') {
    return { reason: 'Agência informada sem bolsa: tire a agência junto com a bolsa' };
  }
  if (bolsa === 'SIM' && !code) {
    return { reason: 'Bolsa sem a agência do Lattes: escolha a agência pela lista de agências' };
  }
  if (!touched) return undefined;
  out.lookups.agency = code;
  expect.f_agencia = before;
  out.rows.push({
    after: v.after('NOME-AGENCIA'),
    before: v.before('NOME-AGENCIA'),
    label: v.label('NOME-AGENCIA'),
    name: 'CODIGO-AGENCIA-FINANCIADORA',
  });
  return undefined;
}

/** Uma alteração numa formação já no Lattes como operação; o motivo, quando vai à mão. */
export function planFormacaoEdit(change: Change, el: XElement, label: string): Planned {
  const seq = getAttr(el, 'SEQUENCIA-FORMACAO');
  const found = formationLevel(el.name);
  const level = found && LEVEL_FORMS[found.code];
  if (!seq || !found || !level) return { reason: 'Formação sem número de sequência ou nível' };
  const set: FieldValues = {};
  // O nível e a lista (ocultos no formulário) são o tipo do item: conferem
  // estrito. f_nivel é o NIVEL da exportação nos níveis observados (3, 1 e
  // 7, em 11/10/2026); nos outros, o código do formulário de inclusão.
  const expect: FieldValues = { f_nivel: found.code, f_tipo: found.list };
  const plain = plainFields(change, level, set, expect);
  if (plain) return plain;

  const v = values(change, el);
  const out: LookupPlan = { identity: {}, lookups: {}, rows: [] };
  const lookup =
    planInstitutions(v, level, out) ??
    planCourse(v, level, out) ??
    planAgency(v, level, out, expect);
  if (lookup) return lookup;

  // Conferência de identidade: a instituição, o curso e o ano de início
  // tinham de bater, qualquer que seja o campo alterado. O f_seq sozinho não
  // basta (censo de 15/10/2026: o f_seq de 3 de 8 trabalhos técnicos não era
  // o número do item). Instituição e curso vêm nos ocultos f_inst_old e
  // f_curso_old (ligação observada no censo), comparados sem acento, caixa
  // nem espaço nas pontas. A livre-docência não tem início nem curso.
  const identity: Record<string, string[]> = {
    f_inst_old: [v.before('NOME-INSTITUICAO')],
    ...(level.visible.includes('f_curso') ? { f_curso_old: [v.before('NOME-CURSO')] } : {}),
    ...out.identity,
  };
  if (level.visible.includes('f_ano_ini') && !('f_ano_ini' in expect)) {
    identity.f_ano_ini = [getAttr(el, 'ANO-DE-INICIO') ?? ''];
  }
  const hasLookups = Object.keys(out.lookups).length > 0;
  return {
    expect,
    identity,
    key: change.key,
    kind: 'formacao',
    label,
    ...(found.list === 'AP' ? { list: found.list } : {}),
    ...(hasLookups ? { lookupRows: out.rows, lookups: out.lookups } : {}),
    seq,
    set,
  };
}
