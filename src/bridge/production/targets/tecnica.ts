// Produções técnicas e artísticas. Campos e opções: censo de 15/10/2026
// (docs/lattes-formularios/), formulário de inclusão de cada tipo, que é o
// mesmo da edição (f_ctr I ou U). A ligação de cada campo com o atributo do
// XML é a da seção "Atributos de cada formulário capturado" do relatório do
// censo; "observado" quando o censo comparou com itens do currículo.

import { byTable, country, language, media, yesNo } from '../mappers.ts';
import type { ProductionTarget } from '../types.ts';
import { ALL_GRIDS, basics, INFO, MEDIA, oneOf, under } from './comum-tecnica-artistica.ts';
import { TECNICA_DEMAIS_TARGETS } from './tecnica-demais.ts';

/**
 * Trabalho técnico (GN_RELATORIO, POST PKG_RELATORIO.FORM). Observado em
 * 16/10/2026 no Lattes real, só por GET: a lista pkg_relatorio.lista, o
 * formulário de edição pkg_relatorio.form com f_seq, f_ctr U e as quatro
 * grades. A natureza é o rádio F_COD_PROD (lista L41 do censo).
 */
const TRABALHO_TECNICO: ProductionTarget = {
  element: 'TRABALHO-TECNICO',
  fields: {
    'DADOS-BASICOS-DO-TRABALHO-TECNICO@ANO': 'f_ano',
    'DADOS-BASICOS-DO-TRABALHO-TECNICO@FLAG-RELEVANCIA': { field: 'F_RELEV', toForm: yesNo },
    'DADOS-BASICOS-DO-TRABALHO-TECNICO@HOME-PAGE-DO-TRABALHO': 'f_homepage',
    'DADOS-BASICOS-DO-TRABALHO-TECNICO@IDIOMA': { field: 'F_IDIOMA', toForm: language },
    'DADOS-BASICOS-DO-TRABALHO-TECNICO@MEIO-DE-DIVULGACAO': { field: 'f_meio', toForm: media },
    'DADOS-BASICOS-DO-TRABALHO-TECNICO@NATUREZA': {
      field: 'F_COD_PROD',
      toForm: byTable({
        ELABORACAO_DE_PROJETO: '244',
        EXTENSAO_TECNOLOGICA: '247',
        OUTRA: '249',
        PARECER: '243',
        RELATORIO_TECNICO: '245',
        SERVICOS_NA_AREA_DA_SAUDE: '246',
      }),
    },
    'DADOS-BASICOS-DO-TRABALHO-TECNICO@PAIS': { field: 'f_pais', toForm: country },
    'DADOS-BASICOS-DO-TRABALHO-TECNICO@TITULO-DO-TRABALHO-TECNICO': 'f_titulo',
    'DADOS-BASICOS-DO-TRABALHO-TECNICO@TITULO-DO-TRABALHO-TECNICO-INGLES': 'f_titulo_en',
    'DETALHAMENTO-DO-TRABALHO-TECNICO@CIDADE-DO-TRABALHO': 'f_cidade',
    'DETALHAMENTO-DO-TRABALHO-TECNICO@DISPONIBILIDADE': 'f_disp',
    'DETALHAMENTO-DO-TRABALHO-TECNICO@DURACAO-EM-MESES': 'f_duracao',
    'DETALHAMENTO-DO-TRABALHO-TECNICO@FINALIDADE': 'f_finalidade',
    'DETALHAMENTO-DO-TRABALHO-TECNICO@INSTITUICAO-FINANCIADORA': 'f_inst',
    'DETALHAMENTO-DO-TRABALHO-TECNICO@NUMERO-DE-PAGINAS': 'f_paginas',
    'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS': 'f_ref',
    'INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES': 'f_ref_en',
  },
  form: { action: 'PKG_RELATORIO.FORM', name: 'GN_RELATORIO' },
  grids: [...ALL_GRIDS],
  id: 'trabalho-tecnico',
  list: { formProc: 'pkg_relatorio.form', proc: 'pkg_relatorio.lista' },
  title: { attr: 'TITULO-DO-TRABALHO-TECNICO', child: 'DADOS-BASICOS-DO-TRABALHO-TECNICO' },
  year: { attr: 'ANO', child: 'DADOS-BASICOS-DO-TRABALHO-TECNICO' },
};

/** Disponibilidade (f_disp), com o valor de cada opção igual ao rótulo. */
const AVAILABILITY = { field: 'f_disp', toForm: oneOf(['Restrita', 'Irrestrita']) };

/** Potencial de inovação: o rádio f_sta_inovacao, S ou N (os rótulos vieram trocados no censo). */
const INNOVATION = { field: 'f_sta_inovacao', toForm: yesNo };

/**
 * Produto tecnológico (GN_PRODUTO, POST PKG_PRODUTO.FORM, lista
 * pkg_produto.lista). Os campos são os do formulário de inclusão do censo.
 * Inferido: o link de cada linha da lista (pkg_produto.form com f_seq, como
 * no trabalho técnico) e a ligação de cada campo pelo nome e pelo rótulo;
 * F_COD_PROD é o rádio "Tipo" (TIPO-PRODUTO) e F_SUB_PROD a lista
 * "Natureza", ligados ao enumerado pelo rótulo. NAO_INFORMADO não tem opção
 * no rádio, que não desmarca.
 */
const PRODUTO: ProductionTarget = {
  element: 'PRODUTO-TECNOLOGICO',
  fields: {
    ...under('DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO', {
      ...basics('TITULO-DO-PRODUTO', 'TITULO-DO-PRODUTO-INGLES'),
      'FLAG-POTENCIAL-INOVACAO': INNOVATION,
      'HOME-PAGE-DO-TRABALHO': 'f_homepage',
      'MEIO-DE-DIVULGACAO': MEDIA,
      NATUREZA: {
        field: 'F_SUB_PROD',
        toForm: byTable({
          APARELHO: '12',
          EQUIPAMENTO: '14',
          FARMACOS_E_SIMILARES: '15',
          INSTRUMENTO: '13',
          NAO_INFORMADO: '',
          OUTRA: '16',
        }),
      },
      'TIPO-PRODUTO': {
        field: 'F_COD_PROD',
        toForm: byTable({ OUTRO: '229', PILOTO: '221', PROJETO: '222', PROTOTIPO: '223' }),
      },
    }),
    ...under('DETALHAMENTO-DO-PRODUTO-TECNOLOGICO', {
      'CIDADE-DO-PRODUTO': 'f_cidade',
      DISPONIBILIDADE: AVAILABILITY,
      FINALIDADE: 'f_finalidade',
      'INSTITUICAO-FINANCIADORA': 'f_inst',
    }),
    ...INFO,
  },
  form: { action: 'PKG_PRODUTO.FORM', name: 'GN_PRODUTO' },
  grids: [...ALL_GRIDS],
  id: 'produto',
  list: { formProc: 'pkg_produto.form', proc: 'pkg_produto.lista' },
  title: { attr: 'TITULO-DO-PRODUTO', child: 'DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO' },
  year: { attr: 'ANO', child: 'DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO' },
};

/**
 * Processo ou técnica (GN_PROCESSO, POST PKG_PROCESSO.FORM, lista
 * pkg_processo.lista). Inferido como no produto; a natureza é o rádio
 * F_COD_PROD, ligado ao enumerado pelo rótulo.
 */
const PROCESSO: ProductionTarget = {
  element: 'PROCESSOS-OU-TECNICAS',
  fields: {
    ...under('DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS', {
      ...basics('TITULO-DO-PROCESSO', 'TITULO-DO-PROCESSO-INGLES'),
      'FLAG-POTENCIAL-INOVACAO': INNOVATION,
      'HOME-PAGE-DO-TRABALHO': 'f_homepage',
      'MEIO-DE-DIVULGACAO': MEDIA,
      NATUREZA: {
        field: 'F_COD_PROD',
        toForm: byTable({
          ANALITICA: '231',
          INSTRUMENTAL: '232',
          OUTRA: '239',
          PEDAGOGICA: '233',
          PROCESSUAL: '234',
          TERAPEUTICA: '235',
        }),
      },
    }),
    ...under('DETALHAMENTO-DO-PROCESSOS-OU-TECNICAS', {
      'CIDADE-DO-PROCESSO': 'f_cidade',
      DISPONIBILIDADE: AVAILABILITY,
      FINALIDADE: 'f_finalidade',
      'INSTITUICAO-FINANCIADORA': 'f_inst',
    }),
    ...INFO,
  },
  form: { action: 'PKG_PROCESSO.FORM', name: 'GN_PROCESSO' },
  grids: [...ALL_GRIDS],
  id: 'processo',
  list: { formProc: 'pkg_processo.form', proc: 'pkg_processo.lista' },
  title: { attr: 'TITULO-DO-PROCESSO', child: 'DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS' },
  year: { attr: 'ANO', child: 'DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS' },
};

export const TECNICA_TARGETS: ProductionTarget[] = [
  TRABALHO_TECNICO,
  PRODUTO,
  PROCESSO,
  ...TECNICA_DEMAIS_TARGETS,
];
