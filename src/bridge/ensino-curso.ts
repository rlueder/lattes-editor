// O nível e o curso da atividade de ensino (GN_ATIV_CARGO, natureza 4), na
// inclusão (create-atividade.ts) e na alteração (edit-atividade.ts).
//
// Observado (lote 3 da recaptura de 15/10/2026): o nível f_nivel (401
// graduação a 409 outro) e a busca de curso prc_curso_form com f_pgm=ATIV,
// a instituição do link da atuação (f_codinst, com a letra) e o nível do
// curso tirado do nível da atividade (401 → 1, 402 → 5, 403 e 404 → 2). Lido
// em 27/10/2026: a lista com f_pgm=ATIV é a mesma da formação (f_pgm=FORM),
// opção a opção, nos três níveis, numa universidade com 171 cursos de
// graduação. O curso escolhido vai sem a letra em f_cod_curso (letra V) ou
// f_cod_curso2, com o texto em f_curso e f_curso_old, como na formação.
// Inferido: que a alteração grave o curso como a inclusão.

import type { LattesPort } from './apply.ts';
import { getChecked, sameCode, selectEntries } from './create-shared.ts';
import type { FieldValues } from './plan.ts';

/** TIPO-ENSINO do XML → f_nivel, pelo rótulo da opção (inferido). */
export const TEACHING_LEVELS: Record<string, string> = {
  APERFEICOAMENTO: '404',
  'ENSINO-FUNDAMENTAL': '405',
  'ENSINO-MEDIO': '406',
  ESPECIALIZACAO: '403',
  GRADUACAO: '401',
  OUTRO: '409',
  'POS-GRADUACAO': '402',
};

/** O nível do curso na busca, pelo nível da atividade (curso() da página, observado). */
export const COURSE_LEVELS: Record<string, string> = {
  '401': '1',
  '402': '5',
  '403': '2',
  '404': '2',
};

/** O nível da lista de cursos pelo TIPO-ENSINO do XML; undefined quando o nível não tem curso. */
export const courseLevelOf = (tipo: string): string | undefined =>
  COURSE_LEVELS[TEACHING_LEVELS[tipo] ?? ''];

/**
 * Os campos do curso escolhido, achado pelo código na lista de cursos da
 * instituição (código com a letra) no nível da atividade; o motivo, quando a
 * lista não o traz uma vez só.
 */
export async function teachingCourse(
  port: LattesPort,
  cv: string,
  institution: string,
  nivel: string,
  code: string,
): Promise<{ set: FieldValues } | { reason: string }> {
  const level = COURSE_LEVELS[nivel];
  if (!level) return { reason: 'O Lattes não aceita curso neste nível de ensino' };
  const courses = selectEntries(
    await getChecked(
      port,
      `prc_curso_form?f_cod=${cv}&f_inst=${institution}&f_nivel=${level}&f_pgm=ATIV`,
    ),
    'f_curso',
  ).filter((o) => sameCode(o.value, code));
  if (courses.length !== 1) {
    return { reason: `Curso não encontrado na lista do Lattes (${courses.length} achados)` };
  }
  const course = courses[0]!;
  return {
    set: {
      [course.value.startsWith('V') ? 'f_cod_curso' : 'f_cod_curso2']: course.value.slice(1),
      f_curso: course.text,
      f_curso_old: course.text,
    },
  };
}
