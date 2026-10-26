// Projetos (PROJETO-DE-PESQUISA, de qualquer natureza). Campos e opções: censo
// de 15/10/2026 (docs/lattes-formularios/, entradas projeto-P a projeto-O) e a
// tabela da seção 17 de docs/lattes_internals.md, lida em 14/10/2026 no
// formulário de inclusão, que é o mesmo da alteração (f_ctr I ou U). O
// currículo de quem capturou não tem projeto: nenhuma ligação foi vista num
// formulário de alteração, e o que segue marcado "Inferido" precisa ser lido
// no Lattes real antes de valer.

import { PARTICIPATION_PERIOD } from '../../atuacao-by-hand.ts';
import { readProvider } from '../grids.ts';
import { byTable } from '../mappers.ts';
import type { ProductionTarget } from '../types.ts';

/** NATUREZA do XML → f_cod_tipo da lista e F_TPO_NATUREZA (rótulos das opções, seção 17). */
const NATURE: Record<string, string> = {
  DESENVOLVIMENTO: 'D',
  ENSINO: 'N',
  EXTENSAO: 'E',
  OUTRA: 'O',
  PESQUISA: 'P',
};

/** SITUACAO do XML → F_TPO_SITUACAO (rótulos das opções, seção 17). */
const SITUATION: Record<string, string> = { CONCLUIDO: 'C', DESATIVADO: 'D', EM_ANDAMENTO: 'A' };

/** Os parâmetros do "Incluir novo item" da lista (seção 17): o link sem nenhum outro é o de inclusão. */
const INCLUSION_PARAMS = new Set([
  'f_cod',
  'f_cod_tipo',
  'f_sta_inovacao',
  'f_tematica',
  'f_tpo_acao_inov',
  'f_tpo_cooperacao',
]);

/**
 * Potencial de inovação, rádio f_sta_inovacao (S/N, seção 17). Com Sim, o
 * check() pede o texto do potencial (f_txt_potencial), que o XML não tem: ir
 * para Sim fica à mão; o Sim de antes só se confere.
 */
const innovation = (v: string, side?: 'after' | 'before'): string | undefined =>
  v === 'NAO' ? 'N' : v === 'SIM' && side === 'before' ? 'S' : v ? undefined : '';

const PROJECT = 'PROJETO-DE-PESQUISA';

/**
 * O f_instituicoes que o configurarInstituicoes() da página monta das
 * instituições do projeto (titularInstProvider), lido em 18/10/2026: sem ele,
 * o Lattes recusava o envio inteiro (ORA-19032).
 */
function projectInstitutions(html: string): Record<string, string> | undefined {
  const rows = readProvider(html, 'titularInstProvider');
  if (!rows) return undefined;
  const items = rows
    .filter((r) => r.l !== undefined)
    .map(
      (r) => `<item><cod>${String(r.c)}</cod><tipo_inst>${String(r.tipoInst)}</tipo_inst></item>`,
    )
    .join('');
  return { f_instituicoes: `<root>${items}</root>` };
}

/**
 * Projeto (GN_PROJETO, POST PKG_PROJETO.FORM). A lista é a da natureza
 * (pkg_projeto.lista com f_cod_tipo P, D, E, N ou O, links do menu observados
 * em 13/10/2026). Inferido: o link de cada linha da lista (a lista do
 * currículo mapeado estava vazia; o conector toma como linha todo link do
 * formulário que não seja o de inclusão e acha a do item pelo nome e pelo ano
 * de início), e que trocar a natureza no formulário mude o projeto de lista.
 */
const PROJETO: ProductionTarget = {
  // O Sim pede o texto do potencial (f_txt_potencial, até 400), que o XML não
  // guarda: o editor o pede ao lado da troca (PlanOptions.extras).
  asks: {
    [`${PROJECT}@FLAG-POTENCIAL-INOVACAO`]: {
      field: 'f_txt_potencial',
      flag: ['f_sta_inovacao', 'S'],
      maxLength: 400,
      reason:
        'Potencial de inovação Sim: escreva no editor qual é o potencial (o Lattes pede o texto, e o currículo não o guarda)',
      when: 'SIM',
    },
  },
  authors: {
    citation: 'NOME-PARA-CITACAO',
    cnpq: 'NRO-ID-CNPQ',
    container: 'EQUIPE-DO-PROJETO',
    element: 'INTEGRANTES-DO-PROJETO',
    label: 'Equipe',
    lead: 'FLAG-RESPONSAVEL',
    name: 'NOME-COMPLETO',
    order: 'ORDEM-DE-INTEGRACAO',
    sent: ['NOME-COMPLETO', 'ORDEM-DE-INTEGRACAO', 'FLAG-RESPONSAVEL'],
  },
  built: projectInstitutions,
  byHand: {
    'FINANCIADOR-DO-PROJETO':
      'Financiador vai à mão: a natureza, a moeda e o valor de cada linha vêm da janela PKG_PROJETO.EDITAR_FINANCIAMENTO, que não foi lida',
    'FINANCIADORES-DO-PROJETO':
      'Financiador vai à mão: a natureza, a moeda e o valor de cada linha vêm da janela PKG_PROJETO.EDITAR_FINANCIAMENTO, que não foi lida',
    ORIENTACAO:
      'Orientação do projeto vai à mão: ela se liga a uma orientação do currículo pela janela de orientações, que não foi lida',
    ORIENTACOES:
      'Orientação do projeto vai à mão: ela se liga a uma orientação do currículo pela janela de orientações, que não foi lida',
    'PRODUCAO-CT-DO-PROJETO':
      'Produção do projeto vai à mão: ela se liga a uma produção do currículo pela janela de produções, que não foi lida',
    'PRODUCOES-CT-DO-PROJETO':
      'Produção do projeto vai à mão: ela se liga a uma produção do currículo pela janela de produções, que não foi lida',
  },
  // O Não do potencial de inovação apaga o texto dele, como a página faz
  // ($("input[name=f_txt_potencial]").val(""), lido em 18/10/2026).
  clears: { 'f_sta_inovacao=N': { f_txt_potencial: '' } },
  element: PROJECT,
  fields: {
    [`${PROJECT}@ANO-FIM`]: 'F_ANO_FIM',
    [`${PROJECT}@ANO-INICIO`]: 'F_ANO_INIC',
    [`${PROJECT}@DESCRICAO-DO-PROJETO-INGLES`]: 'f_ref_en',
    // f_ref está na tabela da seção 17 (14/10/2026), mas não na captura do
    // censo de 15/10/2026, que só tem f_ref_en. Inferido que a alteração o
    // traga; se não trouxer, nada vai (o campo precisa estar na página, apply.ts).
    [`${PROJECT}@DESCRICAO-DO-PROJETO`]: 'f_ref',
    [`${PROJECT}@FLAG-POTENCIAL-INOVACAO`]: {
      field: 'f_sta_inovacao',
      toForm: innovation,
      unmapped:
        'Potencial de inovação Sim vai à mão: o Lattes pede o texto do potencial, que o currículo não guarda',
    },
    [`${PROJECT}@NATUREZA`]: { field: 'F_TPO_NATUREZA', toForm: byTable(NATURE) },
    [`${PROJECT}@NOME-DO-PROJETO-INGLES`]: 'f_titulo_en',
    [`${PROJECT}@NOME-DO-PROJETO`]: 'f_titulo',
    // Graduação: seção 17 (documentado); os outros números pelo rótulo do campo.
    [`${PROJECT}@NUMERO-DOUTORADO`]: 'F_NRO_DOUTORADO',
    [`${PROJECT}@NUMERO-ESPECIALIZACAO`]: 'F_NRO_ESPECIALIZACAO',
    [`${PROJECT}@NUMERO-GRADUACAO`]: 'F_NRO_GRADUACAO',
    [`${PROJECT}@NUMERO-MESTRADO-ACADEMICO`]: 'F_NRO_MESTRADO_ACAD',
    [`${PROJECT}@NUMERO-MESTRADO-PROF`]: 'F_NRO_MESTRADO_PROF',
    [`${PROJECT}@SITUACAO`]: { field: 'F_TPO_SITUACAO', toForm: byTable(SITUATION) },
  },
  form: { action: 'PKG_PROJETO.FORM', name: 'GN_PROJETO' },
  // A equipe usa a grade de autores com as chaves c, l, t, tit e add (seção
  // 21). Inferido: que a página de alteração escreva a equipe no mesmo vetor
  // autorProvider das produções.
  gridKeys: { f_autores_l: ['c', 'l', 't', 'tit', 'add'] },
  grids: ['f_autores_l'],
  id: 'projeto',
  list: {
    formProc: 'PKG_PROJETO.form',
    isRow: (params) => Object.keys(params).some((k) => !INCLUSION_PARAMS.has(k)),
    paramsBy: { attr: 'NATUREZA', child: PROJECT, param: 'f_cod_tipo', values: NATURE },
    proc: 'pkg_projeto.lista',
  },
  // Os ocultos são observados (censo). As tabelas de cada grade, observadas
  // na página de alteração real (18/10/2026), já vêm com as linhas que o
  // servidor escreve. A serialização é a do check() e do criarGrid da página,
  // lida em 20/10/2026 num projeto de teste com um financiador e duas
  // produções ligadas: grid_2 com tagValor 'span' nas quatro primeiras
  // células e cada linha "v0|v1|v2|v3|@"; grid_3 e grid_4 com 'span' só na
  // primeira e "v0@". O sentido de cada valor do financiador não foi lido, e
  // eles mesmos podem ter "|" (026|10,00): vão como estão.
  opaqueGrids: [
    {
      element: 'FINANCIADORES-DO-PROJETO',
      field: 'f_inst_l',
      label: 'financiadores',
      serialize: { cells: 4, end: '|@' },
      table: 'grid2',
    },
    {
      element: 'PRODUCOES-CT-DO-PROJETO',
      field: 'f_producoes_l',
      label: 'produções ligadas',
      serialize: { cells: 1, end: '@' },
      table: 'grid3',
    },
    {
      element: 'ORIENTACOES',
      field: 'f_orientacoes_l',
      label: 'orientações ligadas',
      serialize: { cells: 1, end: '@' },
      table: 'grid4',
    },
  ],
  // O órgão fica na participação, pai do projeto (organ.ts); o período dela
  // não tem campo no formulário.
  organ: { periodReason: PARTICIPATION_PERIOD },
  title: { attr: 'NOME-DO-PROJETO', child: PROJECT },
  year: { attr: 'ANO-INICIO', child: PROJECT, field: 'F_ANO_INIC' },
};

export const PROJETO_TARGETS: ProductionTarget[] = [PROJETO];
