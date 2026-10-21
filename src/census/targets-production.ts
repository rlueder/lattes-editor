// Os formulários de produção do censo (LAT-55): bibliográfica, técnica,
// artística, orientações, bancas e eventos. Os endereços são os da captura de
// 13/10/2026 (docs/lattes-listas/) e da seção 17 de lattes_internals.md; a
// ligação de cada formulário com o elemento do XML é pelo nome do tipo de
// produção, inferida, menos onde a seção 16 a conferiu.

import { BASE_TARGETS, type CensusTarget, type Locate, type Provenance } from './targets.ts';

const CAPTURE = 'captura de 13/10/2026 (docs/lattes-listas/)';

function production(
  id: string,
  label: string,
  locate: Locate,
  elements: string[],
  listProc: string | undefined,
  extra: Partial<CensusTarget> = {},
): CensusTarget {
  const listPath = listProc?.split('?');
  const params = Object.fromEntries(
    (listPath?.[1] ?? '')
      .split('&')
      .filter(Boolean)
      .map((p) => p.split('=') as [string, string]),
  );
  return {
    elements,
    elementsProvenance: 'inferido',
    id,
    itemKey: 'f_seq',
    label,
    list: listPath ? { params, proc: listPath[0]! } : undefined,
    locate,
    provenance: locate.kind === 'fixed' ? 'observado' : 'inferido',
    source: CAPTURE,
    ...extra,
  };
}

const at = (proc: string, params: Record<string, string> = {}, noCode = false): Locate => ({
  kind: 'fixed',
  params,
  proc,
  ...(noCode ? { noCode } : {}),
});

/** prc_tec_demais_lista: um procedimento por tipo (seção 17), elemento pelo nome do tipo. */
const TECH_OTHERS: [string, string, string, string, Provenance][] = [
  ['2J', 'prc_tec_apres', 'Apresentação de trabalho', 'APRESENTACAO-DE-TRABALHO', 'inferido'],
  ['2A', 'prc_tec_carta', 'Carta, mapa ou similar', 'CARTA-MAPA-OU-SIMILAR', 'inferido'],
  [
    '2B',
    'prc_tec_curso',
    'Curso de curta duração',
    'CURSO-DE-CURTA-DURACAO-MINISTRADO',
    'inferido',
  ],
  [
    '2C',
    'prc_tec_desen',
    'Material didático',
    'DESENVOLVIMENTO-DE-MATERIAL-DIDATICO-OU-INSTRUCIONAL',
    'inferido',
  ],
  ['2D', 'prc_tec_edit', 'Editoração', 'EDITORACAO', 'observado'],
  [
    '2E',
    'prc_tec_manut',
    'Manutenção de obra artística',
    'MANUTENCAO-DE-OBRA-ARTISTICA',
    'inferido',
  ],
  ['2F', 'prc_tec_maquete', 'Maquete', 'MAQUETE', 'inferido'],
  ['2G', 'prc_tec_org', 'Organização de evento', 'ORGANIZACAO-DE-EVENTO', 'inferido'],
  ['2H', 'prc_tec_radiotv', 'Programa de rádio ou TV', 'PROGRAMA-DE-RADIO-OU-TV', 'inferido'],
  ['2I', 'prc_tec_relat', 'Relatório de pesquisa', 'RELATORIO-DE-PESQUISA', 'inferido'],
  [
    '2L',
    'prc_midias_sociais',
    'Redes sociais, sites e blogs',
    'MIDIA-SOCIAL-WEBSITE-BLOG',
    'inferido',
  ],
  ['2Z', 'prc_tec_outraprod', 'Outra produção técnica', 'OUTRA-PRODUCAO-TECNICA', 'inferido'],
];

/**
 * PKG_PATENTE_REGISTRO.form por f_cod_tipo (seção 17), e o programa de
 * computador registrado (PC com f_reg=S).
 */
const REGISTRIES: [string, string, string, string, Provenance][] = [
  ['PC', 'N', 'Programa de computador', 'SOFTWARE', 'observado'],
  // Registrado: a lista de PC abre a janela prévia com ftipo=PC e depois o
  // formulário com f_reg=S (recaptura de 15/10/2026).
  ['PC-S', 'S', 'Programa de computador registrado', 'SOFTWARE', 'observado'],
  ['CP', '', 'Cultivar protegida', 'CULTIVAR-PROTEGIDA', 'observado'],
  ['CR', '', 'Cultivar registrada', 'CULTIVAR-REGISTRADA', 'observado'],
  // DI, MR e TC: o endereço montado por analogia abriu o formulário certo nas
  // capturas de 15/10/2026 (censo e recaptura).
  ['DI', '', 'Desenho industrial', 'DESENHO-INDUSTRIAL', 'observado'],
  ['MR', '', 'Marca', 'MARCA', 'observado'],
  ['TC', '', 'Topografia de circuito integrado', 'TOPOGRAFIA-DE-CIRCUITO-INTEGRADO', 'observado'],
];

const ARTS: [string, string, string][] = [
  ['AC', 'Artes cênicas', 'ARTES-CENICAS'],
  ['MU', 'Música', 'MUSICA'],
  ['AV', 'Artes visuais', 'ARTES-VISUAIS'],
  ['OU', 'Outra produção artística', 'OUTRA-PRODUCAO-ARTISTICA-CULTURAL'],
];

const EVENT_ELEMENTS = [
  'CONGRESSO',
  'SEMINARIO',
  'SIMPOSIO',
  'OFICINA',
  'ENCONTRO',
  'OLIMPIADA',
  'FEIRA',
  'EXPOSICAO',
].map((n) => `PARTICIPACAO-EM-${n}`);

const BIBLIOGRAPHIC: CensusTarget[] = [
  production(
    'artigo-publicado',
    'Artigos completos publicados',
    // A lista oferece três entradas: por DOI (F_COD_DOI), por periódico
    // (F_ID_PERIOD) e à mão (F_ORIGEM_WS=F), que abre o formulário (recaptura
    // de 15/10/2026).
    at('PKG_ARTIGO.form', {
      F_ORIGEM_WS: 'F',
      f_sta_divulgacao_cientifica: '',
      F_TITULO_PERIODICO: '',
    }),
    ['ARTIGO-PUBLICADO'],
    'pkg_artigo.lista',
    { source: 'recaptura de 15/10/2026 (links da lista de artigos)' },
  ),
  production(
    'artigo-aceito',
    'Artigos aceitos para publicação',
    at('PKG_ARTIGO_PR.form', { F_STA_DIVULGACAO_CIENTIFICA: '' }),
    ['ARTIGO-ACEITO-PARA-PUBLICACAO'],
    'pkg_artigo_pr.lista',
  ),
  production(
    'livro-capitulo',
    'Livros e capítulos',
    { kind: 'list', proc: 'pkg_lvr_cap.' },
    ['LIVRO-PUBLICADO-OU-ORGANIZADO', 'CAPITULO-DE-LIVRO-PUBLICADO'],
    'pkg_lvr_cap.lista',
    { source: 'lattes_internals.md, seção 17 (lacuna: inclusão por função da página)' },
  ),
  production(
    'capitulo',
    'Capítulo de livro',
    at('PKG_LVR_CAP.FORM_CAP'),
    ['CAPITULO-DE-LIVRO-PUBLICADO'],
    'pkg_lvr_cap.lista',
    { source: 'escolha "Capitulo" da lista de livros e capítulos, lida em 18/10/2026' },
  ),
  production(
    'trabalho-em-eventos',
    'Trabalhos em anais',
    at('pkg_trabalho.form', { f_seq_ev: '', F_STA_DIVULGACAO_CIENTIFICA: '' }),
    ['TRABALHO-EM-EVENTOS'],
    'pkg_trabalho.lista',
  ),
  production(
    'texto-jornal',
    'Textos em jornais ou revistas',
    at('pkg_texto.form', { f_sta_divulgacao_cientifica: '' }),
    ['TEXTO-EM-JORNAL-OU-REVISTA'],
    'pkg_texto.lista',
  ),
  production(
    'traducao',
    'Tradução',
    at('prc_bib_traducao'),
    ['TRADUCAO'],
    'prc_bib_demais_lista?f_cod_tipo=1A',
  ),
  production(
    'partitura',
    'Partitura musical',
    at('prc_bib_partitura'),
    ['PARTITURA-MUSICAL'],
    'prc_bib_demais_lista?f_cod_tipo=1B',
  ),
  production(
    'prefacio',
    'Prefácio, posfácio',
    at('prc_bib_prefacio'),
    ['PREFACIO-POSFACIO'],
    'prc_bib_demais_lista?f_cod_tipo=1C',
    { source: 'menu "Prefácio, posfácio" e o "Incluir novo item" da lista, lidos em 18/10/2026' },
  ),
  production(
    'prefacio-outras',
    'Outra produção bibliográfica',
    { kind: 'unknown', note: 'prc_bib_demais_lista com f_cod_tipo=1Z; a inclusão não foi lida' },
    ['OUTRA-PRODUCAO-BIBLIOGRAFICA'],
    undefined,
    { source: 'reconhecimento de 10/10/2026, catálogo de menus' },
  ),
];

const TECHNICAL: CensusTarget[] = [
  production(
    'patente-janela',
    'Patente: janela "Incluir nova patente"',
    // Aberta por $.win sem f_cod (seção 17); com f_cod, 404.
    at('pkg_patente_registro.informar_dados_patente', { ftipo: 'PP' }, true),
    [],
    undefined,
    { source: 'lattes_internals.md, seção 17' },
  ),
  production(
    'patente',
    'Patente',
    at('pkg_patente_registro.form', { f_cod_tipo: 'PP', f_sta_inovacao: '' }),
    ['PATENTE'],
    'PKG_PATENTE_REGISTRO.LISTA?f_cod_tipo=PP',
    { elementsProvenance: 'observado', source: 'lattes_internals.md, seção 17' },
  ),
  ...REGISTRIES.map(([type, reg, label, element, prov]) =>
    production(
      `registro-${type}`,
      label,
      at('PKG_PATENTE_REGISTRO.form', {
        f_cod_tipo: type.slice(0, 2),
        f_reg: reg,
        F_STA_DIVULGACAO_CIENTIFICA: '',
      }),
      [element],
      `PKG_PATENTE_REGISTRO.LISTA?f_cod_tipo=${type.slice(0, 2)}`,
      prov === 'inferido'
        ? { provenance: 'inferido', source: 'lattes_internals.md, seção 17' }
        : {},
    ),
  ),
  production(
    'produto',
    'Produtos tecnológicos',
    at('pkg_produto.form', { F_sta_inovacao: '' }),
    ['PRODUTO-TECNOLOGICO'],
    'pkg_produto.lista',
  ),
  production(
    'processo',
    'Processos ou técnicas',
    at('pkg_processo.form', { F_sta_inovacao: '' }),
    ['PROCESSOS-OU-TECNICAS'],
    'pkg_processo.lista',
  ),
  production(
    'trabalho-tecnico',
    'Trabalhos técnicos',
    at('pkg_relatorio.form'),
    ['TRABALHO-TECNICO'],
    'pkg_relatorio.lista',
    { elementsProvenance: 'observado', source: `lattes_internals.md, seção 16; ${CAPTURE}` },
  ),
  production(
    'assessoria',
    'Assessoria e consultoria',
    at('PKG_ASSESSORIA_CONSULTORIA.form'),
    [],
    'PKG_ASSESSORIA_CONSULTORIA.lista',
  ),
  production(
    'extensao-tecnologica',
    'Extensão tecnológica',
    at('PKG_EXTENSAO_TECNOLOGICA.form'),
    [],
    'PKG_EXTENSAO_TECNOLOGICA.lista',
  ),
  ...TECH_OTHERS.map(([type, proc, label, element, prov]) =>
    production(
      `tec-${type}`,
      label,
      at(proc),
      [element],
      `prc_tec_demais_lista?f_cod_tipo=${type}`,
      {
        elementsProvenance: prov,
      },
    ),
  ),
];

const OTHERS: CensusTarget[] = [
  ...ARTS.map(([type, label, element]) =>
    production(
      `arte-${type}`,
      label,
      at('pkg_arte_nova.form', { F_TIPO: type }),
      [element],
      `pkg_arte_nova.lista?f_cod_tipo=${type}`,
    ),
  ),
  production(
    'orientacao-concluida',
    'Orientações concluídas',
    at('pkg_orient.form', { f_tipo: 'C' }),
    [
      'ORIENTACOES-CONCLUIDAS-PARA-MESTRADO',
      'ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO',
      'ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO',
      'OUTRAS-ORIENTACOES-CONCLUIDAS',
    ],
    'pkg_orient.lista?f_tipo=C',
  ),
  production(
    'orientacao-andamento',
    'Orientações em andamento',
    at('pkg_orient.form', { f_tipo: 'A' }),
    [
      'ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO',
      'ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO',
      'ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO',
      'ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO',
      'ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO',
      'ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA',
      'OUTRAS-ORIENTACOES-EM-ANDAMENTO',
    ],
    'pkg_orient.lista?f_tipo=A',
  ),
  production(
    'banca-trabalho',
    'Bancas de trabalhos de conclusão',
    at('PKG_BANCA_TRAB.form'),
    [
      'PARTICIPACAO-EM-BANCA-DE-MESTRADO',
      'PARTICIPACAO-EM-BANCA-DE-DOUTORADO',
      'PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO',
      'PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO',
      'PARTICIPACAO-EM-BANCA-DE-GRADUACAO',
      'OUTRAS-PARTICIPACOES-EM-BANCA',
    ],
    'pkg_banca_trab.lista',
  ),
  production(
    'banca-julgadora',
    'Bancas julgadoras',
    at('PKG_BANCA_JULG.form'),
    [
      'BANCA-JULGADORA-PARA-PROFESSOR-TITULAR',
      'BANCA-JULGADORA-PARA-CONCURSO-PUBLICO',
      'BANCA-JULGADORA-PARA-LIVRE-DOCENCIA',
      'BANCA-JULGADORA-PARA-AVALIACAO-CURSOS',
      'OUTRAS-BANCAS-JULGADORAS',
    ],
    'pkg_banca_julg.lista',
  ),
  production(
    'evento',
    'Participação em eventos',
    at('PKG_EVENTO.form', { F_STA_DIVULGACAO_CIENTIFICA: '' }),
    [...EVENT_ELEMENTS, 'OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS'],
    'pkg_evento.lista',
    { elementsProvenance: 'observado', source: `lattes_internals.md, seção 16; ${CAPTURE}` },
  ),
  production(
    'demais-trabalhos',
    'Demais trabalhos',
    { kind: 'list', proc: 'pkg_demais.' },
    ['DEMAIS-TRABALHOS'],
    'pkg_demais.lista',
    { source: 'reconhecimento de 10/10/2026, catálogo de menus' },
  ),
];

/**
 * Entradas cujos formulários de edição a passada de edição de 15/10/2026
 * casou com itens da exportação (docs/lattes-formularios/censo-2026-10-15.json,
 * linkSummary): a ligação do formulário com esses elementos é observada.
 */
const LINKED_ON_2026_10_15 = new Set([
  'areas-de-atuacao',
  'endereco',
  'evento',
  'formacao-complementar',
  'formacao-FA-1',
  'formacao-FA-3',
  'formacao-FA-7',
  'identificacao',
  'idioma',
  'outras-informacoes',
  'premio',
  'resumo',
  'tec-2D',
  'trabalho-tecnico',
  'vinculo',
]);

const observed = (t: CensusTarget): CensusTarget =>
  LINKED_ON_2026_10_15.has(t.id)
    ? {
        ...t,
        elementsProvenance: 'observado',
        source: `${t.source}; ligação com o XML observada em 15/10/2026`,
      }
    : t;

/** Todos os formulários do censo, na ordem do menu do Lattes. */
export const CENSUS_TARGETS: CensusTarget[] = [
  ...BASE_TARGETS,
  ...BIBLIOGRAPHIC,
  ...TECHNICAL,
  ...OTHERS,
].map(observed);
