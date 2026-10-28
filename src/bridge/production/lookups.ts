// Instituição, curso e agência de orientações e bancas pelas buscas do Lattes
// (docs/lattes_internals.md, seção 18). O editor escolhe na lista do Lattes, e
// a escolha traz o código e o nome juntos; na hora de gravar, o conector
// refaz a mesma busca, fica com o único resultado de mesmo código e escreve
// os ocultos que o seleciona() e o atribuir() da página escreveriam. Nenhuma
// busca grava nada.
//
// Os parâmetros saem das páginas lidas em 18/10/2026: pkg_orient.form,
// PKG_BANCA_TRAB.form e PKG_BANCA_JULG.form (funções inst(), curso(),
// retnivel() e agencia()). Nada disso foi visto em modo de alteração.

import type { Change } from '../../model/changes.ts';
import { getAttr, type XElement } from '../../model/xml.ts';
import type { LattesPort, ResultStatus } from '../apply.ts';
import { institutionResults } from '../create.ts';
import { courseName } from '../create-formacao.ts';
import { getChecked, jsCalls, sameCode, selectEntries, Stop } from '../create-shared.ts';
import { encodeLatin1Form, type Pairs, pairValue } from '../form.ts';
import type { FieldValues } from '../plan.ts';

/** Onde ficam, no XML, o código e o nome de uma escolha. */
export interface CodeName {
  code: string;
  name: string;
}

/** Os atributos que um tipo escolhe pelas buscas, e os parâmetros das buscas. */
export interface LookupSpec {
  agency?: CodeName;
  /** O filho do item que guarda os três (DETALHAMENTO-...). */
  child: string;
  course?: CodeName & {
    /** f_nivel da lista de cursos pela natureza (retnivel() da página). */
    level: Record<string, string>;
    /** Natureza de mestrado e o f_sub_prod do profissional, que leva o nível 9. */
    professional?: { nature: string; subProd: string };
    /** As naturezas que pedem f_sta_area=N. */
    noArea: string[];
    /**
     * As naturezas em que o check() da página não exige o curso (pós-doutorado,
     * iniciação científica e outra natureza, lido em 18/10/2026).
     */
    optional?: string[];
    /**
     * Num tipo com mais de uma natureza, o F_COD_PROD de cada NATUREZA do XML,
     * para o editor achar a lista de cursos do item (o envio lê a natureza na
     * própria página).
     */
    natures?: Record<string, string>;
  };
  institution: CodeName;
  /** O F_NIVEL da busca de instituição pela natureza; sem a tabela, vazio. */
  institutionLevel?: Record<string, string>;
}

/** O que a mudança escolheu: o código de antes (para conferir) e o novo. */
export interface ProductionLookups {
  agency?: { before: string; code: string; name: string };
  course?: { before: string; code: string };
  institution?: { before: string; code: string; name: string };
  /**
   * A natureza nova (F_COD_PROD), quando a troca dela faz a página pedir de
   * novo a instituição e o curso (testa_nivel(), nature.ts): a instituição e
   * o curso são os de antes, escolhidos de novo com o nível dela.
   */
  nature?: string;
  /**
   * O tipo novo do mestrado (f_sub_prod), quando a troca muda o nível da busca
   * de curso (retnivel()): o curso de antes, escolhido de novo com o nível dele.
   */
  subProd?: string;
}

const field = (change: Change, attr: string) => change.fields.find((f) => f.attr === attr);

/** Os atributos da escolha que a mudança mexe. */
export function lookupAttrs(spec: LookupSpec): string[] {
  return [spec.institution, spec.course, spec.agency].flatMap((p) => (p ? [p.code, p.name] : []));
}

/**
 * As escolhas de uma mudança no filho das buscas. Nome trocado sem o código
 * é texto digitado, e o Lattes não tem onde gravá-lo: fica à mão com o motivo.
 */
export function planLookups(
  change: Change,
  spec: LookupSpec,
  el: XElement,
):
  | {
      lookups: ProductionLookups;
      rows: { after: string; before: string; label: string; name: string }[];
    }
  | { reason: string } {
  const lookups: ProductionLookups = {};
  const rows: { after: string; before: string; label: string; name: string }[] = [];
  const pick = (pair: CodeName, what: string) => {
    const code = field(change, pair.code);
    const name = field(change, pair.name);
    if (!code && !name) return undefined;
    if (!code) {
      return `${name!.label}: escolha ${what} pela lista do Lattes, que grava o código junto`;
    }
    rows.push({
      after: getAttr(el, pair.name) ?? '',
      before: name ? name.before : (getAttr(el, pair.name) ?? ''),
      label: name?.label ?? code.label,
      name: pair.code,
    });
    return { before: code.before, code: code.after, name: getAttr(el, pair.name) ?? '' };
  };
  const inst = pick(spec.institution, 'a instituição');
  if (typeof inst === 'string') return { reason: inst };
  if (inst) {
    if (!inst.code) return { reason: 'A instituição não pode ficar vazia no Lattes' };
    lookups.institution = inst;
  }
  if (spec.course) {
    const course = pick(spec.course, 'o curso');
    if (typeof course === 'string') return { reason: course };
    if (course) lookups.course = { before: course.before, code: course.code };
  }
  if (spec.agency) {
    const agency = pick(spec.agency, 'a agência');
    if (typeof agency === 'string') return { reason: agency };
    if (agency) lookups.agency = agency;
  }
  return { lookups, rows };
}

export type Resolved =
  | {
      /** O que a releitura espera, quando difere do enviado (o curso sem o código CAPES). */
      check: FieldValues;
      set: FieldValues;
    }
  | { detail: string; status: ResultStatus };

const codeIn = (pairs: Pairs, a: string, b: string) =>
  pairValue(pairs, a) || pairValue(pairs, b) || '';

/** O valor marcado de um rádio, nos pares que o formulário envia. */
const checked = (pairs: Pairs, name: string) => pairValue(pairs, name)?.trim() ?? '';

/**
 * Os ocultos das escolhas, para juntar ao set da operação. Antes de buscar,
 * confere que o Lattes tem os códigos que o editor tinha; um campo visível
 * (f_inst da banca julgadora, f_nme_agencia) só vai se a página o envia.
 */
export async function resolveLookups(
  lookups: ProductionLookups,
  spec: LookupSpec,
  port: LattesPort,
  pairs: Pairs,
): Promise<Resolved> {
  try {
    return await resolve(lookups, spec, port, pairs);
  } catch (err) {
    if (err instanceof Stop) return { detail: err.message, status: err.status };
    throw err;
  }
}

async function resolve(
  lookups: ProductionLookups,
  spec: LookupSpec,
  port: LattesPort,
  pairs: Pairs,
): Promise<Resolved> {
  const cv = pairValue(pairs, 'f_cod') ?? '';
  // Com a natureza trocada, o nível é o dela, e o f_sub_prod vai limpo (nature.ts).
  const renatured = lookups.nature !== undefined;
  const nature = lookups.nature ?? checked(pairs, 'F_COD_PROD');
  const subProd = lookups.subProd ?? (renatured ? '' : pairValue(pairs, 'f_sub_prod'));
  const has = (name: string) => pairs.some(([k]) => k === name);
  const set: FieldValues = {};
  const check: FieldValues = {};
  const differs = (label: string): Resolved => ({
    detail: `O Lattes não está como o editor espera: ${label}`,
    status: 'divergente',
  });
  let institution = codeIn(pairs, 'f_cod_inst', 'f_cod_inst2');

  if (lookups.institution) {
    const want = lookups.institution;
    if (want.before ? !sameCode(institution, want.before) : institution !== '') {
      return differs('Instituição');
    }
    const search = encodeLatin1Form([
      ['F_CTR', 'C'],
      ['F_COD', cv],
      ['F_NIVEL', spec.institutionLevel?.[nature] ?? ''],
      ['F_STA_OUTRA', 'N'],
      ['f_nome', want.name],
    ]);
    const found = institutionResults(await getChecked(port, `PRC_INST_FORM?${search}`)).filter(
      (r) => sameCode(r.code, want.code),
    );
    if (found.length !== 1) {
      return {
        detail: `Instituição não encontrada na busca do Lattes (${found.length} resultados com o código)`,
        status: 'erro',
      };
    }
    const hit = found[0]!;
    const v = hit.code.startsWith('V');
    set.f_cod_inst = v ? hit.code : '';
    set.f_cod_inst2 = v ? '' : hit.code;
    set.f_inst_old = hit.name;
    if (has('f_inst')) set.f_inst = hit.name;
    institution = hit.code;
  }

  if (lookups.course && spec.course) {
    const want = lookups.course;
    const now = codeIn(pairs, 'f_cod_curso', 'f_cod_curso2');
    // Com a instituição trocada, o curso de antes já não vale (o editor o limpa).
    // Com a natureza trocada, a instituição é a mesma (conferida acima pelo
    // antes, como sempre) e o curso também se confere: outro curso no Lattes é
    // divergente, e não falta na lista do nível novo.
    if (
      (!lookups.institution || renatured) &&
      (want.before ? !sameCode(now, want.before) : now !== '')
    ) {
      return differs('Curso');
    }
    if (!want.code) {
      Object.assign(set, { f_cod_curso: '', f_cod_curso2: '', f_curso_old: '' });
    } else {
      const pro = spec.course.professional;
      const level =
        pro && nature === pro.nature && subProd === pro.subProd ? '9' : spec.course.level[nature];
      if (!level) return { detail: 'Natureza sem nível de curso conhecido', status: 'erro' };
      const area = spec.course.noArea.includes(nature) ? 'N' : '';
      const courses = selectEntries(
        await getChecked(
          port,
          `prc_curso_form?f_pgm=TESE&f_cod=${cv}&f_inst=${institution}&f_nivel=${level}&f_sta_area=${area}`,
        ),
        'f_curso',
      ).filter((o) => sameCode(o.value, want.code));
      if (courses.length !== 1) {
        return {
          detail: renatured
            ? `Com a natureza nova, o curso do item não está na lista do Lattes (${courses.length} achados): troque a natureza no Lattes e escolha o curso pela lista dele; nada foi enviado`
            : `Curso não encontrado na lista do Lattes (${courses.length} achados)`,
          status: 'erro',
        };
      }
      const course = courses[0]!;
      const v = course.value.startsWith('V');
      set.f_cod_curso = v ? course.value.slice(1) : '';
      set.f_cod_curso2 = v ? '' : course.value.slice(1);
      set.f_curso_old = course.text;
      check.f_curso_old = courseName(course.text);
    }
  } else if (lookups.institution && spec.course) {
    // Instituição nova sem curso escolhido: o curso de antes não é dela.
    Object.assign(set, { f_cod_curso: '', f_cod_curso2: '', f_curso_old: '' });
  }

  if (lookups.agency) {
    const want = lookups.agency;
    const now = pairValue(pairs, 'f_agencia') ?? '';
    if (want.before ? !sameCode(now, want.before) : now !== '') return differs('Agência');
    if (!want.code) {
      set.f_agencia = '';
      if (has('f_nme_agencia')) set.f_nme_agencia = '';
    } else {
      const agencies = jsCalls(
        await getChecked(port, `prc_agencia?f_cod=${cv}`),
        'atribuir',
      ).filter((args) => sameCode(args[0], want.code));
      if (agencies.length !== 1) {
        return {
          detail: `Agência não encontrada na lista do Lattes (${agencies.length} achadas)`,
          status: 'erro',
        };
      }
      set.f_agencia = agencies[0]![0]!;
      if (has('f_nme_agencia')) set.f_nme_agencia = agencies[0]![1] ?? want.name;
    }
  }
  return { check, set };
}
