// Produções técnicas e artísticas. Campos e opções: censo de 15/10/2026
// (docs/lattes-formularios/), formulário de inclusão de cada tipo, que é o
// mesmo da edição (f_ctr I ou U). A ligação de cada campo com o atributo do
// XML é a da seção "Atributos de cada formulário capturado" do relatório do
// censo; "observado" quando o censo comparou com itens do currículo.

import { byTable, country, language, media, yesNo } from '../mappers.ts';
import type { ProductionTarget } from '../types.ts';

const ALL_GRIDS = ['f_autores_l', 'f_plv_l', 'f_setor_l', 'f_area_l'] as const;

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

export const TECNICA_TARGETS: ProductionTarget[] = [TRABALHO_TECNICO];
