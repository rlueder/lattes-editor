// Os formulários do censo (LAT-55): onde cada um abre no Lattes e que
// elementos do XML ele grava. Tirado de docs/lattes_internals.md (seções 5,
// 13 a 19), do reconhecimento de 10/10/2026 e da captura das listas de
// 13/10/2026 (docs/lattes-listas/), que guardou o endereço de cada "Incluir
// novo item" aberto. Cada entrada diz se o endereço foi visto no Lattes
// (observado) ou montado por analogia (inferido), e o mesmo para a ligação
// com os elementos do XML.
//
// Abrir um formulário de inclusão por GET, sem f_seq, não grava nada no Lattes
// (seção 2): é o que o censo faz com cada entrada.

export type Provenance = 'inferido' | 'observado';

export interface LattesPath {
  /**
   * Abre sem f_cod: a página é chamada assim pelo próprio Lattes, e o gateway
   * PL/SQL responde 404 a um parâmetro que o procedimento não declara (a
   * janela prévia da patente, 404 com f_cod na captura de 15/10/2026).
   */
  noCode?: boolean;
  params: Record<string, string>;
  proc: string;
}

/** Como achar o formulário de inclusão. */
export type Locate =
  /** Endereço conhecido. */
  | ({ kind: 'fixed' } & LattesPath)
  /** O primeiro link do menu para o procedimento (um nome terminado em ponto casa o pacote). */
  | { kind: 'menu'; proc: string }
  /**
   * O link de inclusão numa lista (ou numa tela aberta a partir dela, `via`):
   * o que leva ao procedimento sem o parâmetro do item. `set` troca
   * parâmetros do link (a natureza da atividade, que selecionarNatureza() põe).
   */
  | { kind: 'list'; proc: string; set?: Record<string, string> }
  /** Sabe-se que existe, não se sabe o endereço: entra no relatório como lacuna. */
  | { kind: 'unknown'; note: string };

export interface CensusTarget {
  /** Elementos do XML que o formulário grava (o item; as partes saem do schema). */
  elements: string[];
  elementsProvenance: Provenance;
  id: string;
  /** Parâmetro que identifica um item existente nos links da lista. */
  itemKey: string;
  label: string;
  /** A lista com os itens existentes, de onde sai a passada de edição. */
  list?: LattesPath;
  locate: Locate;
  provenance: Provenance;
  /** Formulário que sempre mostra o registro (identificação, endereço, resumo). */
  singleton?: boolean;
  /** Onde a entrada foi lida: seção de lattes_internals.md, reconhecimento ou captura. */
  source: string;
  /** Tela intermediária entre a lista e o formulário (a de cargos e vínculos da atuação). */
  via?: string;
}

const CAPTURE = 'captura de 13/10/2026 (docs/lattes-listas/)';

const fixed = (proc: string, params: Record<string, string> = {}): Locate => ({
  kind: 'fixed',
  params,
  proc,
});
const list = (proc: string, params: Record<string, string> = {}): LattesPath => ({
  params,
  proc,
});

/** Uma entrada comum: formulário de endereço conhecido, lista com f_seq. */
function form(
  id: string,
  label: string,
  locate: Locate,
  elements: string[],
  extra: Partial<CensusTarget> = {},
): CensusTarget {
  return {
    elements,
    elementsProvenance: 'inferido',
    id,
    itemKey: 'f_seq',
    label,
    locate,
    provenance: locate.kind === 'fixed' || locate.kind === 'menu' ? 'observado' : 'inferido',
    source: CAPTURE,
    ...extra,
  };
}

/**
 * Níveis da formação acadêmica (seção 17 e reconhecimento, seção 4.2). O
 * f_nivel oculto bate com o NIVEL da exportação no mestrado, na graduação e no
 * curso técnico (seção 19); nos outros, o elemento sai do nome do nível.
 */
const ACADEMIC_LEVELS: [string, string, string, Provenance][] = [
  ['4', 'Doutorado', 'DOUTORADO', 'inferido'],
  ['3', 'Mestrado', 'MESTRADO', 'observado'],
  ['9', 'Mestrado profissional', 'MESTRADO-PROFISSIONALIZANTE', 'inferido'],
  ['2', 'Especialização', 'ESPECIALIZACAO', 'inferido'],
  ['D', 'Residência médica', 'RESIDENCIA-MEDICA', 'inferido'],
  ['1', 'Graduação', 'GRADUACAO', 'observado'],
  ['7', 'Ensino técnico', 'CURSO-TECNICO-PROFISSIONALIZANTE', 'observado'],
  ['C', 'Ensino médio', 'ENSINO-MEDIO-SEGUNDO-GRAU', 'inferido'],
  ['B', 'Ensino fundamental', 'ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU', 'inferido'],
  ['X', 'Aperfeiçoamento', 'APERFEICOAMENTO', 'inferido'],
];

/** Pós-doutorado (5) e livre-docência (6), lista f_tipo=AP, lidos em 15/10/2026 (LAT-55). */
const AP_LEVELS: [string, string, string][] = [
  ['5', 'Pós-doutorado', 'POS-DOUTORADO'],
  ['6', 'Livre-docência', 'LIVRE-DOCENCIA'],
];

const FORMATION: CensusTarget[] = [
  ...ACADEMIC_LEVELS.map(([level, name, element, prov]) =>
    form(
      `formacao-FA-${level}`,
      `Formação acadêmica: ${name.toLowerCase()}`,
      fixed('pkg_formacao.form', { f_nivel: level, f_tipo: 'FA' }),
      [element],
      {
        elementsProvenance: prov,
        list: list('pkg_formacao.lista', { f_tipo: 'FA' }),
        source: 'lattes_internals.md, seção 17',
      },
    ),
  ),
  ...AP_LEVELS.map(([level, name, element]) =>
    form(
      `formacao-AP-${level}`,
      `Formação: ${name.toLowerCase()}`,
      fixed('pkg_formacao.form', { f_nivel: level, f_tipo: 'AP' }),
      [element],
      {
        list: list('pkg_formacao.lista', { f_tipo: 'AP' }),
        source: 'LAT-55, lido em 15/10/2026',
      },
    ),
  ),
  form(
    'formacao-complementar',
    'Formação complementar',
    fixed('PKG_FORMACAO_COMPL.form', { f_tipo: 'FA' }),
    [
      'FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO',
      'FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA',
      'MBA',
      'OUTROS',
    ],
    { list: list('pkg_formacao_compl.lista'), source: `${CAPTURE}; níveis na seção 5` },
  ),
];

const GENERAL: CensusTarget[] = [
  form('identificacao', 'Identificação', { kind: 'menu', proc: 'prc_ident' }, ['DADOS-GERAIS'], {
    singleton: true,
    source: 'lattes_internals.md, seção 5',
  }),
  form(
    'endereco',
    'Endereço',
    { kind: 'menu', proc: 'prc_endereco' },
    ['ENDERECO', 'ENDERECO-PROFISSIONAL', 'ENDERECO-RESIDENCIAL'],
    { singleton: true, source: 'lattes_internals.md, seção 5' },
  ),
  form('resumo', 'Resumo', { kind: 'menu', proc: 'pkg_resume.' }, ['RESUMO-CV'], {
    elementsProvenance: 'observado',
    singleton: true,
    source: 'lattes_internals.md, seção 5',
  }),
  form(
    'outras-informacoes',
    'Outras informações relevantes',
    { kind: 'menu', proc: 'prc_outras_inf' },
    ['OUTRAS-INFORMACOES-RELEVANTES'],
    { singleton: true, source: 'reconhecimento de 10/10/2026, catálogo de menus' },
  ),
  form(
    'areas-de-atuacao',
    'Áreas de atuação',
    { kind: 'menu', proc: 'prc_area_atuacao' },
    ['AREAS-DE-ATUACAO', 'AREA-DE-ATUACAO'],
    { singleton: true, source: 'lattes_internals.md, seção 18' },
  ),
  form('idioma', 'Idiomas', fixed('pkg_idioma.form'), ['IDIOMA'], {
    elementsProvenance: 'observado',
    list: list('pkg_idioma.lista'),
  }),
  form('premio', 'Prêmios e títulos', fixed('pkg_premio.form'), ['PREMIO-TITULO'], {
    list: list('pkg_premio.lista'),
  }),
  form('licenca', 'Licenças', fixed('pkg_licenca.form'), ['LICENCA'], {
    list: list('pkg_licenca.lista'),
  }),
];

const ACTIVITIES = [
  'ATIVIDADES-DE-DIRECAO-E-ADMINISTRACAO',
  'ATIVIDADES-DE-PESQUISA-E-DESENVOLVIMENTO',
  'ATIVIDADES-DE-ENSINO',
  'ATIVIDADES-DE-ESTAGIO',
  'ATIVIDADES-DE-SERVICO-TECNICO-ESPECIALIZADO',
  'ATIVIDADES-DE-EXTENSAO-UNIVERSITARIA',
  'ATIVIDADES-DE-TREINAMENTO-MINISTRADO',
  'OUTRAS-ATIVIDADES-TECNICO-CIENTIFICA',
  'ATIVIDADES-DE-CONSELHO-COMISSAO-E-CONSULTORIA',
];

/** Natureza do selecionarNatureza() → elemento do XML, pelo rótulo (inferido). */
const ACTIVITY_NATURES: [string, string, string][] = [
  ['1', 'DIRECAO-E-ADMINISTRACAO', 'direção e administração'],
  ['2', 'PESQUISA-E-DESENVOLVIMENTO', 'pesquisa e desenvolvimento'],
  ['4', 'ENSINO', 'ensino'],
  ['5', 'ESTAGIO', 'estágio'],
  ['6', 'SERVICO-TECNICO-ESPECIALIZADO', 'serviço técnico especializado'],
  ['7', 'EXTENSAO-UNIVERSITARIA', 'extensão universitária'],
  ['8', 'TREINAMENTO-MINISTRADO', 'treinamento'],
  ['9', 'OUTRA-ATIVIDADE-TECNICO-CIENTIFICA', 'outra atividade técnico-científica'],
  ['B', 'CONSELHO-COMISSAO-E-CONSULTORIA', 'conselhos, comissões e consultoria'],
];

const PROJECT_KINDS: [string, string][] = [
  ['P', 'pesquisa'],
  ['D', 'desenvolvimento'],
  ['E', 'extensão'],
  ['N', 'ensino'],
  ['O', 'outros'],
];

const PROFESSIONAL: CensusTarget[] = [
  form('atuacao', 'Atuação profissional', fixed('PKG_ATIV.inclui'), ['ATUACAO-PROFISSIONAL'], {
    elementsProvenance: 'observado',
    list: list('pkg_ativ.lista'),
    source: `reconhecimento de 10/10/2026, seção 4.1; ${CAPTURE}`,
  }),
  form(
    'vinculo',
    'Vínculo de uma atuação',
    { kind: 'list', proc: 'PKG_ATIV.vinculos' },
    ['VINCULOS'],
    {
      elementsProvenance: 'observado',
      itemKey: 'f_seq_hist',
      list: list('pkg_ativ.lista'),
      provenance: 'observado',
      source: 'lattes_internals.md, seção 5',
      via: 'PKG_ATIV.cargos_vinculos',
    },
  ),
  form(
    'atividade',
    'Atividade de uma atuação',
    { kind: 'list', proc: 'pkg_ativ.cargo' },
    ACTIVITIES,
    {
      itemKey: 'f_seq_funcao',
      list: list('pkg_ativ.lista'),
      source: 'lattes_internals.md, seção 17 (o link é montado por selecionarNatureza())',
      via: 'PKG_ATIV.cargos_vinculos',
    },
  ),
  // Uma entrada por natureza, como selecionarNatureza() abre o formulário
  // (seção 17); lidas no lote 3 da recaptura de 15/10/2026 (seção 22).
  ...ACTIVITY_NATURES.map(([natur, element, name]) =>
    form(
      `atividade-${natur}`,
      `Atividade de uma atuação: ${name}`,
      { kind: 'list', proc: 'pkg_ativ.cargo', set: { f_natur_ativ: natur } },
      [element],
      {
        itemKey: 'f_seq_funcao',
        list: list('pkg_ativ.lista'),
        provenance: 'observado',
        source: 'recaptura de 15/10/2026, lote 3 (seção 22)',
        via: 'PKG_ATIV.cargos_vinculos',
      },
    ),
  ),
  ...['MB', 'MA', 'RV', 'RA'].map((natur) =>
    form(
      `revisor-${natur}`,
      `Corpo editorial, revisão e assessoramento (${natur})`,
      fixed('PKG_REVISOR.inclui', { f_natur: natur, f_origem: 'L' }),
      // Lido em 15/10/2026: formulário GN_ATIV, POST PKG_REVISOR.INCLUI, com os
      // ocultos de uma atividade (f_codinst, f_seq_ativ, f_seq_funcao_ativ). Que
      // elemento do XML ele grava não se sabe: o currículo lido não tem item.
      [],
      {
        list: list('pkg_revisor.lista', { f_natur: natur }),
        source: `${CAPTURE}; elemento do XML desconhecido`,
      },
    ),
  ),
  form(
    'linha-de-pesquisa',
    'Linhas de pesquisa',
    { kind: 'list', proc: 'pkg_linhapesq.' },
    ['LINHA-DE-PESQUISA'],
    {
      list: list('pkg_linhapesq.lista'),
      source: 'reconhecimento de 10/10/2026, catálogo de menus',
    },
  ),
  ...PROJECT_KINDS.map(([kind, name]) =>
    form(
      `projeto-${kind}`,
      `Projeto de ${name}`,
      fixed('PKG_PROJETO.form', {
        f_cod_tipo: kind,
        F_sta_inovacao: '',
        f_tematica: 'X',
        f_tpo_acao_inov: 'X',
        f_tpo_cooperacao: 'X',
      }),
      ['PROJETO-DE-PESQUISA'],
      {
        elementsProvenance: 'observado',
        itemKey: 'f_seq_proj',
        list: list('pkg_projeto.lista', { f_cod_tipo: kind }),
        source: `lattes_internals.md, seção 17; ${CAPTURE}`,
      },
    ),
  ),
];

export { ACADEMIC_LEVELS, AP_LEVELS };
export const BASE_TARGETS: CensusTarget[] = [...GENERAL, ...FORMATION, ...PROFESSIONAL];
