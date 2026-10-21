// Os endereços das janelas de órgãos do Lattes: a do projeto e a da
// atividade da atuação, que também serve o órgão do endereço profissional.
// Só montam o caminho; a leitura é readOrgans (lattes-lists.ts) e a escolha
// no envio, resolveOrgan (production/organ.ts).

/** De qual janela de órgãos vem a lista: a do projeto (sem valor) ou a da atividade. */
export type OrganWindowKind = 'atividade';

/** A letra do código de um órgão no link da janela: V para o tipo 0, D para os outros (inferido). */
export const organLetter = (kind: string) => (kind === '0' ? 'V' : 'D');

/**
 * A janela de órgãos de uma instituição (código com a letra, como o orgao()
 * da página do projeto monta), no topo ou aberta num órgão (código com a
 * letra). É o mesmo endereço que o "Expandir itens" da janela abre.
 */
export const organsPath = (cv: string, institution: string, parent = '') =>
  `pkg_projeto.pp_orgao_cargo?f_origem=&f_modal_cv=2&f_cod=${cv}&f_cod_inst=${encodeURIComponent(institution)}&f_cod_inst2=${encodeURIComponent(parent)}`;

/**
 * A janela de órgãos de uma atividade da atuação (prc_orgao_cargo, lida em
 * 20/10/2026): as mesmas linhas atribuir() da do projeto. A instituição vai
 * como o f_codinst da página, com a letra.
 */
export const activityOrgansPath = (cv: string, institution: string, parent = '') =>
  `prc_orgao_cargo?f_origem=&f_modal_cv=9&f_cod=${cv}&f_cod_inst=${encodeURIComponent(institution)}&f_cod_inst2=${encodeURIComponent(parent)}`;

/**
 * As atividades cujo formulário tem o órgão, escolhido na janela de órgãos da
 * atividade. O ensino guarda órgão no XML, mas o formulário dele não tem; a
 * pesquisa e desenvolvimento e o treinamento vão inteiros à mão.
 */
export const ACTIVITY_ORGAN_ELEMENTS: ReadonlySet<string> = new Set([
  'CONSELHO-COMISSAO-E-CONSULTORIA',
  'DIRECAO-E-ADMINISTRACAO',
  'ESTAGIO',
  'EXTENSAO-UNIVERSITARIA',
  'OUTRA-ATIVIDADE-TECNICO-CIENTIFICA',
  'SERVICO-TECNICO-ESPECIALIZADO',
]);

/** O caminho da janela pedida. */
export const organWindowPath = (organWindow?: OrganWindowKind) =>
  organWindow === 'atividade' ? activityOrgansPath : organsPath;
