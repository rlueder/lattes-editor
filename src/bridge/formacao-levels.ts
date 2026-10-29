// Os campos que o formulário de cada nível da formação acadêmica mostra, pelo
// código de f_nivel (censo de 15/10/2026). formacao-edit.ts confere com eles
// o que uma alteração pode enviar.

export interface Level {
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

/**
 * O campo aparece no formulário do nível. A visibilidade (f_tipo_privacidade,
 * só de tela) está em todos, como o censo de 15/10/2026 leu.
 */
export const shows = (l: Level, field: string) =>
  field === 'f_tipo_privacidade' || l.visible.includes(field);

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
