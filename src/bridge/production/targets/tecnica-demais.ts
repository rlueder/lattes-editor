// Demais tipos de produção técnica: a lista prc_tec_demais_lista com um
// f_cod_tipo por tipo e um procedimento de formulário por tipo (seção 17 de
// docs/lattes_internals.md), todos com o <form> GN_TEC e o POST para o
// procedimento em maiúsculas. Campos e opções: censo de 15/10/2026, formulário
// de inclusão de cada tipo.
//
// Observado só na editoração (seção 16): a linha da lista abre
// prc_tec_edit?f_cod=…&f_seq=N, e a passada de edição ligou oito itens campo a
// campo. Nos outros tipos, inferido por analogia: o link de cada linha (o
// procedimento do formulário com f_seq) e a ligação de cada campo com o
// atributo, pelo nome e pelo rótulo do campo. As naturezas e os tipos (rádio
// F_COD_PROD, lista F_SUB_PROD) se ligam ao enumerado pelo rótulo da opção.

import { byTable } from '../mappers.ts';
import type { FieldMap, ProductionTarget } from '../types.ts';
import {
  ALL_GRIDS,
  basics,
  checkbox,
  INFO,
  MEDIA,
  oneOf,
  OUTREACH,
  slashDate,
  under,
} from './comum-tecnica-artistica.ts';

interface Spec {
  /** O f_cod_tipo da lista. */
  code: string;
  /** Os atributos do DETALHAMENTO-… que o formulário tem. */
  details: Record<string, FieldMap | string>;
  /** O filho DETALHAMENTO-… do item. */
  detailsChild: string;
  element: string;
  /** Os atributos do DADOS-BASICOS-… além dos de basics(). */
  extra?: Record<string, FieldMap | string>;
  id: string;
  /** O filho DADOS-BASICOS-… do item, com o título e o ano. */
  main: string;
  /** O procedimento do formulário (a linha da lista o abre com f_seq). */
  proc: string;
}

function demais(s: Spec): ProductionTarget {
  return {
    element: s.element,
    fields: {
      ...under(s.main, { ...basics('TITULO', 'TITULO-INGLES'), ...s.extra }),
      ...under(s.detailsChild, s.details),
      ...INFO,
    },
    form: { action: s.proc.toUpperCase(), name: 'GN_TEC' },
    grids: [...ALL_GRIDS],
    id: s.id,
    list: { formProc: s.proc, params: { f_cod_tipo: s.code }, proc: 'prc_tec_demais_lista' },
    title: { attr: 'TITULO', child: s.main },
    year: { attr: 'ANO', child: s.main },
  };
}

const nature = (table: Record<string, string>): FieldMap => ({
  field: 'F_COD_PROD',
  toForm: byTable(table),
});

const APRESENTACAO = demais({
  code: '2J',
  details: {
    'CIDADE-DA-APRESENTACAO': 'f_cidade',
    'INSTITUICAO-PROMOTORA': 'f_inst',
    'LOCAL-DA-APRESENTACAO': 'f_local',
    'NOME-DO-EVENTO': 'f_nme_evento',
  },
  detailsChild: 'DETALHAMENTO-DA-APRESENTACAO-DE-TRABALHO',
  element: 'APRESENTACAO-DE-TRABALHO',
  extra: {
    'FLAG-DIVULGACAO-CIENTIFICA': OUTREACH,
    NATUREZA: nature({
      COMUNICACAO: '2J1',
      CONFERENCIA: '2J2',
      CONGRESSO: '2J3',
      OUTRA: '2J9',
      SEMINARIO: '2J4',
      SIMPOSIO: '2J5',
    }),
  },
  id: 'tec-2J',
  main: 'DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO',
  proc: 'prc_tec_apres',
});

const CARTA = demais({
  code: '2A',
  details: {
    'AREA-REPRESENTADA': 'f_area',
    FINALIDADE: 'f_finalidade',
    'INSTITUICAO-FINANCIADORA': 'f_inst',
    'TECNICA-UTILIZADA': 'f_tecnica',
    'TEMA-DA-CARTA-MAPA-OU-SIMILAR': 'f_tema',
  },
  detailsChild: 'DETALHAMENTO-DE-CARTA-MAPA-OU-SIMILAR',
  element: 'CARTA-MAPA-OU-SIMILAR',
  extra: {
    'HOME-PAGE-DO-TRABALHO': 'f_homepage',
    'MEIO-DE-DIVULGACAO': MEDIA,
    NATUREZA: nature({
      AEROFOTOGRAMA: '2A1',
      CARTA: '2A2',
      FOTOGRAMA: '2A3',
      MAPA: '2A4',
      OUTRA: '2A9',
    }),
  },
  id: 'tec-2A',
  main: 'DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR',
  proc: 'prc_tec_carta',
});

/** O nível do curso é o rádio F_COD_PROD ("Nível do curso"). */
const CURSO = demais({
  code: '2B',
  details: {
    CIDADE: 'f_cidade',
    DURACAO: 'f_duracao',
    'INSTITUICAO-PROMOTORA-DO-CURSO': 'f_inst',
    'LOCAL-DO-CURSO': 'f_local',
    'PARTICIPACAO-DOS-AUTORES': {
      field: 'f_participacao',
      toForm: byTable({
        DOCENTE: 'Docente',
        NAO_INFORMADO: '',
        ORGANIZADOR: 'Organizador',
        OUTRA: 'Outra',
      }),
    },
    UNIDADE: { field: 'f_unidade', toForm: oneOf(['horas', 'dias', 'semanas']) },
  },
  detailsChild: 'DETALHAMENTO-DE-CURSOS-CURTA-DURACAO-MINISTRADO',
  element: 'CURSO-DE-CURTA-DURACAO-MINISTRADO',
  extra: {
    'FLAG-DIVULGACAO-CIENTIFICA': OUTREACH,
    'MEIO-DE-DIVULGACAO': MEDIA,
    'NIVEL-DO-CURSO': nature({
      APERFEICOAMENTO: '2B2',
      ESPECIALIZACAO: '2B3',
      EXTENSAO: '2B1',
      OUTRA: '2B9',
    }),
  },
  id: 'tec-2B',
  main: 'DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO',
  proc: 'prc_tec_curso',
});

/** A natureza é texto livre (f_natureza, 100). */
const MATERIAL_DIDATICO = demais({
  code: '2C',
  details: { FINALIDADE: 'f_finalidade' },
  detailsChild: 'DETALHAMENTO-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL',
  element: 'DESENVOLVIMENTO-DE-MATERIAL-DIDATICO-OU-INSTRUCIONAL',
  extra: {
    'FLAG-DIVULGACAO-CIENTIFICA': OUTREACH,
    'HOME-PAGE-DO-TRABALHO': 'f_homepage',
    'MEIO-DE-DIVULGACAO': MEDIA,
    NATUREZA: 'f_natureza',
  },
  id: 'tec-2C',
  main: 'DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL',
  proc: 'prc_tec_desen',
});

/**
 * Editoração: lista, link e ligações observados (seção 16 e passada de edição
 * de 15/10/2026, oito itens). Inferidos: o título em inglês e as naturezas
 * além de LIVRO (2D1) e PERIODICO (2D6), as duas vistas nos itens; 2D9 é
 * "Outro" (pendencias.json).
 */
const EDITORACAO = demais({
  code: '2D',
  details: {
    CIDADE: 'f_cidade',
    EDITORA: 'f_editora',
    'INSTITUICAO-PROMOTORA': 'f_inst',
    'NUMERO-DE-PAGINAS': 'f_paginas',
  },
  detailsChild: 'DETALHAMENTO-DE-EDITORACAO',
  element: 'EDITORACAO',
  extra: {
    'HOME-PAGE-DO-TRABALHO': 'f_homepage',
    'MEIO-DE-DIVULGACAO': MEDIA,
    NATUREZA: nature({
      ANAIS: '2D2',
      CATALOGO: '2D3',
      COLETANEA: '2D4',
      ENCICLOPEDIA: '2D5',
      LIVRO: '2D1',
      OUTRA: '2D9',
      PERIODICO: '2D6',
    }),
  },
  id: 'tec-2D',
  main: 'DADOS-BASICOS-DE-EDITORACAO',
  proc: 'prc_tec_edit',
});

/** O tipo é o rádio F_COD_PROD e a natureza a lista F_SUB_PROD. */
const MANUTENCAO = demais({
  code: '2E',
  details: {
    ACERVO: {
      field: 'f_acervo',
      toForm: byTable({ NAO_INFORMADO: '', PRIVADO: 'Privado', PUBLICO: 'Público' }),
    },
    'ANO-DA-OBRA': 'f_ano_obra',
    'AUTOR-DA-OBRA': 'f_autor_obra',
    CIDADE: 'f_cidade',
    LOCAL: 'f_local',
    'NOME-DA-OBRA': 'f_obra',
  },
  detailsChild: 'DETALHAMENTO-DE-MANUTENCAO-DE-OBRA-ARTISTICA',
  element: 'MANUTENCAO-DE-OBRA-ARTISTICA',
  extra: {
    NATUREZA: {
      field: 'F_SUB_PROD',
      toForm: byTable({
        ARQUITETURA: '17',
        DESENHO: '18',
        ESCULTURA: '19',
        FOTOGRAFIA: '20',
        GRAVURA: '21',
        NAO_INFORMADO: '',
        OUTRA: '23',
        PINTURA: '22',
      }),
    },
    TIPO: nature({ CONSERVACAO: '2E1', OUTRO: '2E9', RESTAURACAO: '2E2' }),
  },
  id: 'tec-2E',
  main: 'DADOS-BASICOS-DE-MANUTENCAO-DE-OBRA-ARTISTICA',
  proc: 'prc_tec_manut',
});

const MAQUETE = demais({
  code: '2F',
  details: {
    FINALIDADE: 'f_finalidade',
    'INSTITUICAO-FINANCIADORA': 'f_inst',
    'MATERIAL-UTILIZADO': 'f_material',
    'OBJETO-REPRESENTADO': 'f_objeto',
  },
  detailsChild: 'DETALHAMENTO-DA-MAQUETE',
  element: 'MAQUETE',
  extra: { 'MEIO-DE-DIVULGACAO': MEDIA },
  id: 'tec-2F',
  main: 'DADOS-BASICOS-DA-MAQUETE',
  proc: 'prc_tec_maquete',
});

/**
 * O tipo é o rádio F_COD_PROD e a natureza a lista F_SUB_PROD; itinerante e
 * catálogo são caixas de marcar.
 */
const ORGANIZACAO_EVENTO = demais({
  code: '2G',
  details: {
    CIDADE: 'f_cidade',
    'DURACAO-EM-SEMANAS': 'f_duracao',
    'FLAG-CATALOGO': { field: 'f_catalogo', toForm: checkbox },
    'FLAG-EVENTO-ITINERANTE': { field: 'f_itinerante', toForm: checkbox },
    'INSTITUICAO-PROMOTORA': 'f_inst',
    LOCAL: 'f_local',
  },
  detailsChild: 'DETALHAMENTO-DA-ORGANIZACAO-DE-EVENTO',
  element: 'ORGANIZACAO-DE-EVENTO',
  extra: {
    'FLAG-DIVULGACAO-CIENTIFICA': OUTREACH,
    'MEIO-DE-DIVULGACAO': MEDIA,
    NATUREZA: {
      field: 'F_SUB_PROD',
      toForm: byTable({
        CURADORIA: '24',
        MONTAGEM: '25',
        MUSEOLOGIA: '27',
        NAO_INFORMADO: '',
        ORGANIZACAO: '26',
      }),
    },
    TIPO: nature({
      CONCERTO: '2G1',
      CONCURSO: '2G2',
      CONGRESSO: '2G3',
      EXPOSICAO: '2G4',
      FEIRA: '2G6',
      FESTIVAL: '2G5',
      OLIMPIADA: '2G7',
      OUTRO: '2G9',
    }),
  },
  id: 'tec-2G',
  main: 'DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO',
  proc: 'prc_tec_org',
});

/**
 * A data de realização (f_data, texto 10) é dd/mm/aaaa. O meio de divulgação
 * tem opções próprias (I, M, W Web, O), ligadas ao enumerado pelo rótulo.
 * Fica à mão o campo f_emissora: pelo nome seria a EMISSORA, pelo rótulo
 * ("Veículo de divulgação") o VEICULO-DE-DIVULGACAO, e o XML tem os dois.
 */
const RADIO_TV = demais({
  code: '2H',
  details: {
    'DATA-DA-APRESENTACAO': { field: 'f_data', toForm: slashDate },
    'DURACAO-EM-MINUTOS': 'f_duracao',
    TEMA: 'f_tema',
  },
  detailsChild: 'DETALHAMENTO-DO-PROGRAMA-DE-RADIO-OU-TV',
  element: 'PROGRAMA-DE-RADIO-OU-TV',
  extra: {
    'FLAG-DIVULGACAO-CIENTIFICA': OUTREACH,
    'HOME-PAGE': 'F_HOMEPAGE',
    'MEIO-DE-DIVULGACAO': {
      field: 'f_meio',
      toForm: byTable({
        IMPRESSO: 'I',
        MEIO_MAGNETICO: 'M',
        NAO_INFORMADO: '',
        OUTRO: 'O',
        WEB: 'W',
      }),
    },
    NATUREZA: nature({
      COMENTARIO: '2H3',
      ENTREVISTA: '2H1',
      MESA_REDONDA: '2H2',
      OUTRA: '2H9',
      PROGRAMA: '2H4',
    }),
  },
  id: 'tec-2H',
  main: 'DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV',
  proc: 'prc_tec_radiotv',
});

const RELATORIO_PESQUISA = demais({
  code: '2I',
  details: {
    DISPONIBILIDADE: { field: 'f_disp', toForm: oneOf(['Restrita', 'Irrestrita']) },
    'INSTITUICAO-FINANCIADORA': 'f_inst',
    'NOME-DO-PROJETO': 'f_projeto',
    'NUMERO-DE-PAGINAS': 'f_paginas',
  },
  detailsChild: 'DETALHAMENTO-DO-RELATORIO-DE-PESQUISA',
  element: 'RELATORIO-DE-PESQUISA',
  extra: { 'MEIO-DE-DIVULGACAO': MEDIA },
  id: 'tec-2I',
  main: 'DADOS-BASICOS-DO-RELATORIO-DE-PESQUISA',
  proc: 'prc_tec_relat',
});

const MIDIA_SOCIAL = demais({
  code: '2L',
  details: { TEMA: 'f_tema' },
  detailsChild: 'DETALHAMENTO-DA-MIDIA-SOCIAL-WEBSITE-BLOG',
  element: 'MIDIA-SOCIAL-WEBSITE-BLOG',
  extra: {
    'FLAG-DIVULGACAO-CIENTIFICA': OUTREACH,
    'HOME-PAGE': 'F_HOMEPAGE',
    NATUREZA: nature({ BLOG: '2L3', FORUM: '2L2', REDE_SOCIAL: '2L1', SITE: '2L4' }),
  },
  id: 'tec-2L',
  main: 'DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG',
  proc: 'prc_midias_sociais',
});

/** A natureza é texto livre (f_natureza, 100). */
const OUTRA_TECNICA = demais({
  code: '2Z',
  details: {
    CIDADE: 'f_cidade',
    FINALIDADE: 'f_finalidade',
    'INSTITUICAO-PROMOTORA': 'f_inst',
    LOCAL: 'f_local',
  },
  detailsChild: 'DETALHAMENTO-DE-OUTRA-PRODUCAO-TECNICA',
  element: 'OUTRA-PRODUCAO-TECNICA',
  extra: {
    'FLAG-DIVULGACAO-CIENTIFICA': OUTREACH,
    'MEIO-DE-DIVULGACAO': MEDIA,
    NATUREZA: 'f_natureza',
  },
  id: 'tec-2Z',
  main: 'DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA',
  proc: 'prc_tec_outraprod',
});

export const TECNICA_DEMAIS_TARGETS: ProductionTarget[] = [
  APRESENTACAO,
  CARTA,
  CURSO,
  MATERIAL_DIDATICO,
  EDITORACAO,
  MANUTENCAO,
  MAQUETE,
  ORGANIZACAO_EVENTO,
  RADIO_TV,
  RELATORIO_PESQUISA,
  MIDIA_SOCIAL,
  OUTRA_TECNICA,
];
