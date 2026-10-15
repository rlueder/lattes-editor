// Nomes e valores dos campos dos formulários de inclusão de formação, projeto
// e registros (src/bridge/create-items.ts), como a pessoa os conhece. Entram em
// field-labels.ts; ficam aqui para o módulo da inclusão não depender dele.

export const CREATE_FIELD_LABELS: Record<string, string> = {
  f_ano: 'Ano',
  f_ano_fim: 'Ano de fim',
  F_ANO_FIM: 'Ano de fim',
  f_ano_ini: 'Ano de início',
  F_ANO_INIC: 'Ano de início',
  f_ano_obten: 'Ano de obtenção do título',
  F_BOLSA: 'Bolsa',
  f_carga: 'Carga horária',
  f_cod_reg: 'Número do registro',
  f_coorient: 'Coorientador',
  f_finalidade: 'Finalidade',
  f_home_page: 'Home page',
  f_inst: 'Instituição',
  f_inst_financ: 'Instituição financiadora',
  f_natureza: 'Natureza',
  f_nro_deposito_pct: 'Número do depósito PCT',
  F_NRO_DOUTORADO: 'Alunos de doutorado',
  F_NRO_ESPECIALIZACAO: 'Alunos de especialização',
  F_NRO_GRADUACAO: 'Alunos de graduação',
  F_NRO_MESTRADO_ACAD: 'Alunos de mestrado acadêmico',
  F_NRO_MESTRADO_PROF: 'Alunos de mestrado profissional',
  f_orient: 'Orientador',
  f_pais: 'País',
  f_ref: 'Descrição',
  f_ref_en: 'Descrição (inglês)',
  f_sta_inovacao: 'Potencial de inovação',
  F_STATUS: 'Situação do curso',
  f_tipo: 'Tipo',
  f_titulo: 'Título',
  f_titulo_en: 'Título (inglês)',
  f_tpo_doutorado: 'Tipo',
  F_TPO_NATUREZA: 'Natureza',
  F_TPO_SITUACAO: 'Situação',
};

/** Os códigos de rádio e de lista, com o texto dos formulários (docs/lattes_internals.md, seções 5 e 17). */
export const CREATE_VALUE_LABELS: Record<string, Record<string, string>> = {
  F_BOLSA: { N: 'Não', S: 'Sim' },
  f_sta_inovacao: { N: 'Não', S: 'Sim' },
  F_STATUS: { I: 'Incompleto', N: 'Em andamento', S: 'Concluído' },
  // Patente (seção 17) e marca (censo de 15/10/2026).
  f_tipo: {
    MCL: 'Coletiva',
    MCT: 'Certificação',
    MPD: 'de Produto',
    MSV: 'de Serviço',
    MU: 'Patente de Modelo de Utilidade',
    PI: 'Patente de Invenção',
  },
  f_tpo_doutorado: { N: 'Normal', S: 'Sanduíche' },
  F_TPO_NATUREZA: {
    D: 'Desenvolvimento',
    E: 'Extensão',
    N: 'Ensino',
    O: 'Outra',
    P: 'Pesquisa',
  },
  F_TPO_SITUACAO: { A: 'Em andamento', C: 'Concluído', D: 'Desativado' },
};
