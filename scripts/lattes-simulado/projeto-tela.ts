// Os campos do projeto sem atributo no XSD (a cooperação com empresa, as
// caixas do projeto de ensino), guardados ao lado do projeto como o Lattes os
// guarda fora da exportação. O projeto de ensino tem as caixas; os outros, a
// empresa (censo de 27/10/2026).

import type { Binding } from './campos.ts';
import type { LattesState } from './estado.ts';

export function projectScreenBindings(
  state: LattesState,
  teaching: boolean,
  yesNo: [string, string][],
): Binding[] {
  const stored = (name: string, kind: Binding['kind'], max?: number): Binding => ({
    kind,
    maxLength: max,
    name,
    read: (el) => state.formOnly(el)[name] ?? '',
    write: (el, value) => {
      state.formOnly(el)[name] = value;
    },
  });
  return [
    { ...stored('f_tpo_pesq_emp', 'radio'), options: yesNo },
    ...(teaching
      ? (
          [
            ['f_tpo_cooperacao', ['IE', 'AF', 'EM']],
            ['f_tpo_acao_inov', ['EF', 'EM', 'GR', 'ES', 'GM', 'MP', 'GD']],
            ['f_tematica', ['EA', 'AP', 'PC', 'FI', 'IT', 'AI', 'IS', 'PI', 'MI', 'A', 'G', 'O']],
          ] as const
        ).map(([name, codes]): Binding => ({
          ...stored(name, 'checkboxes'),
          options: codes.map((c): [string, string] => [c, c]),
        }))
      : [
          stored('f_cnpj_empresa', 'text', 18),
          stored('f_txt_nme_empresa', 'text', 400),
          stored('f_txt_email_institucional', 'text', 400),
          stored('f_txt_setor', 'text', 400),
        ]),
  ];
}
