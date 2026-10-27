// Patentes e registros (PKG_PATENTE_REGISTRO.form, POST
// PKG_PATENTE_REGISTRO.FORM). Lido em 19/10/2026 no Lattes real: a edição de
// uma patente de teste e de um item de teste de cada registro (programa de
// computador com e sem registro, cultivar protegida e registrada, desenho
// industrial, marca, topografia de circuito integrado), todos com f_ctr U,
// f_seq e o f_cod_tipo do tipo. Os campos de cada tipo são os dessas páginas;
// a ligação com o atributo do XML é pelo nome e pelo rótulo do campo, e é
// inferida até uma exportação com esses itens (docs/lattes_internals.md,
// seção 17).
//
// O check() das páginas refaz no envio, além das quatro grades de produção,
// os depositantes ou titulares (titularPessoaProvider, titularInstProvider:
// f_depositante_pessoa_l, f_depositante_inst_l), a coluna tit dos autores, as
// datas da patente (providerContatos → f_dados_grid_datas) e o ambiente do
// programa de computador (programaProvider → f_ambiente). O motor manda todas
// como a página as trouxe, e troca só o que a alteração mexe.
//
// Exportação e edição da mesma patente de teste, lidas em 20/10/2026
// (docs/lattes_internals.md, seção 17): o NOME-DO-DEPOSITANTE do
// REGISTRO-OU-PATENTE é a pessoa de titularPessoaProvider; a exportação copia
// essa pessoa também nos AUTORES, e o autorProvider da página não a tem; cada
// HISTORICO-SITUACOES-PATENTE é uma linha de providerContatos, com a
// descrição como rótulo e a data em DDMMAAAA. Que os outros registros com a
// grade de depositantes guardem a pessoa no mesmo atributo é inferido: a
// exportação do programa de computador de teste não trouxe o
// REGISTRO-OU-PATENTE.

import { foldText } from '../../../model/fold-text.ts';
import { PATENT_DATE_CODES } from '../../create-registro-rules.ts';
import { byTable, country, yesNo } from '../mappers.ts';
import type { FieldMap, GridField, ProductionTarget } from '../types.ts';
import { ALL_GRIDS, INFO, slashDate, under } from './comum-tecnica-artistica.ts';
import { HISTORY, historyFields, registryDateFields } from './patente-historico.ts';
import {
  dateKey,
  PATENT_DATES,
  patentBuilt,
  softwareBuilt,
  yearFromDate,
} from './registros-paginas.ts';

const LIST = { formProc: 'pkg_patente_registro.form', proc: 'pkg_patente_registro.lista' };
const FORM = { action: 'PKG_PATENTE_REGISTRO.FORM', name: 'PKG_PATENTE_REGISTRO' };
const REG = 'REGISTRO-OU-PATENTE';

/** Os autores levam a coluna tit (titular sim ou não) no check() destas páginas. */
const AUTHOR_KEYS = { f_autores_l: ['c', 'l', 't', 'pais', 'add', 'tit'] } as const;

const HOLDERS: GridField[] = ['f_depositante_pessoa_l', 'f_depositante_inst_l'];

/** Rótulo de opção cujo valor é o próprio texto, comparado sem acento, caixa nem separador. */
const label =
  (options: readonly string[]) =>
  (v: string): string | undefined => {
    const key = (x: string) => foldText(x).replace(/[^a-z0-9]/g, '');
    return v ? options.find((o) => key(o) === key(v)) : '';
  };

/** Potencial de inovação, como no projeto: o Sim pede o texto (asks), o Não o apaga (clears). */
const innovation = (v: string, side?: 'after' | 'before'): string | undefined =>
  v === 'NAO' ? 'N' : v === 'SIM' && side === 'before' ? 'S' : v ? undefined : '';

const INNOVATION: FieldMap = {
  field: 'f_sta_inovacao',
  toForm: innovation,
  unmapped:
    'Potencial de inovação Sim vai à mão: o Lattes pede o texto do potencial, que o currículo não guarda',
};

const asksFor = (basics: string) => ({
  [`${basics}@FLAG-POTENCIAL-INOVACAO`]: {
    field: 'f_txt_potencial',
    flag: ['f_sta_inovacao', 'S'] as [string, string],
    maxLength: 400,
    reason:
      'Potencial de inovação Sim: escreva no editor qual é o potencial (o Lattes pede o texto, e o currículo não o guarda)',
    when: 'SIM',
  },
});

const CLEARS = { 'f_sta_inovacao=N': { f_txt_potencial: '' } };

/** A pessoa depositante ou titular, na grade f_depositante_pessoa_l (plan.ts). */
const HOLDER = { attr: 'NOME-DO-DEPOSITANTE', child: REG };

/**
 * NOME-DO-TITULAR: na exportação de 27/10/2026, a instituição titular veio em
 * NOME-DO-DEPOSITANTE, e este atributo, vazio. O que o Lattes grava nele não
 * foi visto.
 */
const TITULAR_REASON =
  'O Lattes põe a instituição titular em "Depositante" na exportação, e deixa este campo vazio; troque o depositante';

/** O que o registro tem em comum entre os tipos: número, instituição, título e quem é o titular. */
const registry = (): Record<string, FieldMap | string> =>
  under(REG, {
    'CODIGO-DO-REGISTRO-OU-PATENTE': 'f_cod_reg',
    'INSTITUICAO-DEPOSITO-REGISTRO': 'f_inst',
    'TITULO-PATENTE': 'f_titulo',
  });

const registryManual = (fixedType?: string, holders = true): Record<string, string> => {
  const none = `O formulário de ${fixedType ?? 'marca'} do Lattes não tem campo para o titular nem para o depositante`;
  return {
    // Com a grade, o depositante pessoa vai por ela (HOLDER, plan.ts).
    ...(holders ? {} : { [`${REG}@NOME-DO-DEPOSITANTE`]: none }),
    [`${REG}@NOME-DO-TITULAR`]: holders ? TITULAR_REASON : none,
    ...(fixedType
      ? {
          [`${REG}@TIPO-PATENTE`]: `O formulário de ${fixedType} do Lattes não tem campo para o tipo: ele é sempre ${fixedType}`,
        }
      : {}),
  };
};

// Os tipos -------------------------------------------------------------------------

const PATENTE_BASICS = 'DADOS-BASICOS-DA-PATENTE';

/** Patente (f_cod_tipo PP): as datas na grade de situações, o ano tirado delas. */
const PATENTE: ProductionTarget = {
  asks: asksFor(PATENTE_BASICS),
  built: patentBuilt,
  clears: CLEARS,
  element: 'PATENTE',
  fields: {
    ...under(PATENTE_BASICS, {
      'FLAG-POTENCIAL-INOVACAO': INNOVATION,
      'HOME-PAGE': 'f_home_page',
      PAIS: { field: 'f_pais', toForm: country },
      TITULO: 'f_titulo',
      'TITULO-INGLES': 'f_titulo_en',
    }),
    ...under('DETALHAMENTO-DA-PATENTE', {
      CATEGORIA: {
        field: 'f_natureza',
        toForm: label(['Produto', 'Processo', 'Produto e Processo', 'Outra']),
      },
      FINALIDADE: 'f_finalidade',
      'INSTITUICAO-FINANCIADORA': 'f_inst_financ',
    }),
    ...registry(),
    ...under(REG, {
      ...Object.fromEntries(
        Object.entries(PATENT_DATE_CODES).map(([attr, [code]]) => [
          attr,
          { field: dateKey(code), toForm: slashDate },
        ]),
      ),
      'NUMERO-DEPOSITO-PCT': 'f_nro_deposito_pct',
      'TIPO-PATENTE': {
        field: 'f_tipo',
        toForm: byTable({ MODELO_DE_UTILIDADE_MU: 'MU', PRIVILEGIO_DE_INOVACAO_PI: 'PI' }),
      },
    }),
    ...INFO,
  },
  form: FORM,
  gridKeys: AUTHOR_KEYS,
  grids: [...ALL_GRIDS, ...HOLDERS],
  holders: HOLDER,
  id: 'patente',
  list: { ...LIST, params: { f_cod_tipo: 'PP' } },
  manual: {
    [`${PATENTE_BASICS}@ANO-DESENVOLVIMENTO`]:
      'O formulário de patente do Lattes não tem campo para o ano: ele sai da data de depósito; troque a data',
    ...registryManual(),
  },
  partFields: { [HISTORY]: historyFields, [REG]: registryDateFields },
  title: { attr: 'TITULO', child: PATENTE_BASICS },
  virtual: PATENT_DATES,
  year: { attr: 'ANO-DESENVOLVIMENTO', child: PATENTE_BASICS },
};

const SOFTWARE_BASICS = 'DADOS-BASICOS-DO-SOFTWARE';

/**
 * Programa de computador (f_cod_tipo PC). A mesma lista tem duas: f_reg=N sem
 * registro, f_reg=S com registro (o número e as datas só nesta).
 */
const SOFTWARE: ProductionTarget = {
  asks: asksFor(SOFTWARE_BASICS),
  built: softwareBuilt,
  clears: CLEARS,
  element: 'SOFTWARE',
  fields: {
    ...under(SOFTWARE_BASICS, {
      ANO: 'f_ano',
      'FLAG-DIVULGACAO-CIENTIFICA': { field: 'F_STA_DIVULGACAO_CIENTIFICA', toForm: yesNo },
      'FLAG-POTENCIAL-INOVACAO': INNOVATION,
      'FLAG-RELEVANCIA': { field: 'F_RELEV', toForm: yesNo },
      NATUREZA: { field: 'f_natureza', toForm: label(['Computacional', 'Multimídia', 'Outro']) },
      PAIS: { field: 'f_pais', toForm: country },
      'TITULO-DO-SOFTWARE': 'f_titulo',
      'TITULO-DO-SOFTWARE-INGLES': 'f_titulo_en',
    }),
    ...under('DETALHAMENTO-DO-SOFTWARE', {
      FINALIDADE: 'f_finalidade',
      'INSTITUICAO-FINANCIADORA': 'f_inst_financ',
      PLATAFORMA: 'f_plataforma',
    }),
    ...registry(),
    ...under(REG, {
      'DATA-DE-CONCESSAO': { field: 'f_dta_conc', toForm: slashDate },
      'DATA-PEDIDO-DE-DEPOSITO': { field: 'f_dta_dep', toForm: slashDate },
    }),
    ...INFO,
  },
  form: FORM,
  gridKeys: AUTHOR_KEYS,
  grids: [...ALL_GRIDS, ...HOLDERS],
  holders: HOLDER,
  id: 'registro-PC',
  list: {
    ...LIST,
    params: { f_cod_tipo: 'PC' },
    paramsBy: {
      attr: 'CODIGO-DO-REGISTRO-OU-PATENTE',
      child: REG,
      param: 'f_reg',
      // No menu, a lista com registro é a de PC sem f_reg (lido em 19/10/2026).
      values: (code) => (code.trim() ? '' : 'N'),
    },
  },
  manual: {
    'DETALHAMENTO-DO-SOFTWARE@AMBIENTE':
      'O ambiente sai da lista de ambientes da página, numa grade que o conector manda como está; troque no Lattes',
    ...registryManual('programa de computador'),
  },
  title: { attr: 'TITULO-DO-SOFTWARE', child: SOFTWARE_BASICS },
  year: { attr: 'ANO', child: SOFTWARE_BASICS, fallback: 'f_dta_dep' },
};

const CULTIVAR_BASICS = 'DADOS-BASICOS-DA-CULTIVAR';

/** Cultivar protegida (CP, com depósito e concessão) e registrada (CR, só depósito). */
const cultivar = (element: string, tipo: 'CP' | 'CR', name: string): ProductionTarget => ({
  asks: asksFor(CULTIVAR_BASICS),
  built: yearFromDate,
  clears: CLEARS,
  element,
  fields: {
    ...under(CULTIVAR_BASICS, {
      ...(tipo === 'CR' ? { 'ANO-SOLICITACAO': 'f_ano' } : {}),
      DENOMINACAO: 'f_titulo',
      'DENOMINACAO-INGLES': 'f_titulo_en',
      'FLAG-POTENCIAL-INOVACAO': INNOVATION,
      PAIS: { field: 'f_pais', toForm: country },
    }),
    ...registry(),
    ...under(REG, {
      ...(tipo === 'CP' ? { 'DATA-DE-CONCESSAO': { field: 'f_dta_conc', toForm: slashDate } } : {}),
      'DATA-PEDIDO-DE-DEPOSITO': { field: 'f_dta_dep', toForm: slashDate },
    }),
    ...INFO,
  },
  form: FORM,
  gridKeys: AUTHOR_KEYS,
  grids: [...ALL_GRIDS, ...HOLDERS],
  holders: HOLDER,
  id: `registro-${tipo}`,
  list: { ...LIST, params: { f_cod_tipo: tipo } },
  manual: {
    ...(tipo === 'CP'
      ? {
          [`${CULTIVAR_BASICS}@ANO-SOLICITACAO`]:
            'O formulário de cultivar protegida do Lattes não tem campo para o ano: ele sai da data do depósito; troque a data',
        }
      : {}),
    ...registryManual(name),
  },
  title: { attr: 'DENOMINACAO', child: CULTIVAR_BASICS },
  year: { attr: 'ANO-SOLICITACAO', child: CULTIVAR_BASICS },
});

/**
 * Desenho industrial, marca e topografia de circuito integrado: título, ano,
 * país e título em inglês nos dados básicos, finalidade e financiadora no
 * detalhamento quando a página tem.
 */
function design(
  element: string,
  tipo: 'DI' | 'MR' | 'TC',
  basicsEl: string,
  detailEl: string,
  name: string,
): ProductionTarget {
  const derivedYear = tipo === 'DI';
  return {
    asks: asksFor(basicsEl),
    built: yearFromDate,
    clears: CLEARS,
    element,
    fields: {
      ...under(basicsEl, {
        ...(derivedYear ? {} : { 'ANO-DESENVOLVIMENTO': 'f_ano' }),
        'FLAG-POTENCIAL-INOVACAO': INNOVATION,
        PAIS: { field: 'f_pais', toForm: country },
        TITULO: 'f_titulo',
        'TITULO-INGLES': 'f_titulo_en',
      }),
      ...under(
        detailEl,
        tipo === 'MR'
          ? {
              NATUREZA: {
                field: 'f_natureza',
                toForm: label(['Figurativa', 'Nominativa', 'Mista', 'Tridimensional']),
              },
            }
          : { FINALIDADE: 'f_finalidade', 'INSTITUICAO-FINANCIADORA': 'f_inst_financ' },
      ),
      ...registry(),
      ...under(
        REG,
        tipo === 'DI'
          ? {
              'DATA-DE-CONCESSAO': { field: 'f_dta_conc', toForm: slashDate },
              'DATA-PEDIDO-DE-DEPOSITO': { field: 'f_dta_dep', toForm: slashDate },
            }
          : tipo === 'MR'
            ? {
                'TIPO-PATENTE': {
                  field: 'f_tipo',
                  toForm: byTable({
                    MARCA_REGISTRADA_COLETIVA_MCL: 'MCL',
                    MARCA_REGISTRADA_DE_CERTIFICACAO_MCT: 'MCT',
                    MARCA_REGISTRADA_DE_PRODUTO_MPD: 'MPD',
                    MARCA_REGISTRADA_DE_SERVICO_MSV: 'MSV',
                  }),
                },
              }
            : {},
      ),
      ...INFO,
    },
    form: FORM,
    gridKeys: AUTHOR_KEYS,
    // Marca e topografia não têm grade de titulares na página.
    grids: tipo === 'DI' ? [...ALL_GRIDS, ...HOLDERS] : [...ALL_GRIDS],
    ...(tipo === 'DI' ? { holders: HOLDER } : {}),
    id: `registro-${tipo}`,
    list: { ...LIST, params: { f_cod_tipo: tipo } },
    manual: {
      ...(derivedYear
        ? {
            [`${basicsEl}@ANO-DESENVOLVIMENTO`]:
              'O formulário de desenho industrial do Lattes não tem campo para o ano: ele sai da data do registro; troque a data',
          }
        : {}),
      ...(tipo === 'MR'
        ? {
            [`${REG}@NOME-DO-DEPOSITANTE`]:
              'O formulário de marca do Lattes não tem campo para o titular nem para o depositante',
            [`${REG}@NOME-DO-TITULAR`]:
              'O formulário de marca do Lattes não tem campo para o titular nem para o depositante',
          }
        : registryManual(name, tipo === 'DI')),
    },
    title: { attr: 'TITULO', child: basicsEl },
    year: {
      attr: 'ANO-DESENVOLVIMENTO',
      child: basicsEl,
      ...(derivedYear ? { fallback: 'f_dta_dep' } : {}),
    },
  };
}

export const REGISTRO_TARGETS: ProductionTarget[] = [
  PATENTE,
  SOFTWARE,
  cultivar('CULTIVAR-PROTEGIDA', 'CP', 'cultivar protegida'),
  cultivar('CULTIVAR-REGISTRADA', 'CR', 'cultivar registrada'),
  design(
    'DESENHO-INDUSTRIAL',
    'DI',
    'DADOS-BASICOS-DO-DESENHO-INDUSTRIAL',
    'DETALHAMENTO-DO-DESENHO-INDUSTRIAL',
    'desenho industrial',
  ),
  design('MARCA', 'MR', 'DADOS-BASICOS-DA-MARCA', 'DETALHAMENTO-DA-MARCA', 'marca'),
  design(
    'TOPOGRAFIA-DE-CIRCUITO-INTEGRADO',
    'TC',
    'DADOS-BASICOS-DA-TOPOGRAFIA-DE-CIRCUITO-INTEGRADO',
    'DETALHAMENTO-DA-TOPOGRAFIA-DE-CIRCUITO-INTEGRADO',
    'topografia de circuito integrado',
  ),
];
