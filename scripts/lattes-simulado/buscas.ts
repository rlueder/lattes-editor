// As buscas do Lattes simulado: instituição (PRC_INST_FORM), curso
// (prc_curso_form), agência (prc_agencia) e a tabela de áreas do menu
// (areaDP), na forma de docs/lattes_internals.md, seção 18. Os nomes são de
// instituições e agências reais; todos os códigos de instituição, curso e
// agência são sintéticos, no formato observado. As áreas são só as nove
// grandes áreas, com os códigos observados.

import type { Institution, LattesState } from './estado.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

/** Uma letra e 12 dígitos; V vai em f_cod_inst, as outras letras em f_cod_inst2. */
export const INSTITUTIONS: Institution[] = [
  { code: 'V000000000001', name: 'Universidade Federal do Rio Grande do Sul', uf: 'RS' },
  { code: 'V000000000002', name: 'Universidade de São Paulo', uf: 'SP' },
  { code: 'V000000000003', name: 'Universidade Estadual de Campinas', uf: 'SP' },
  { code: 'M000000000004', name: 'Empresa Brasileira de Pesquisa Agropecuária', uf: 'DF' },
];

/** As instituições da busca: as do simulado e as que o teste acrescentou. */
export const institutionsOf = (state: LattesState) => [...INSTITUTIONS, ...state.institutions];

/**
 * A letra que a busca mostra na frente do código (seção 18), pelo código sem
 * ela, como o XML o guarda; D quando a instituição não está na busca
 * (inferido).
 */
export function withLetter(state: LattesState, code: string): string {
  if (!code || /^[A-Z]/.test(code)) return code;
  return institutionsOf(state).find((i) => i.code.slice(1) === code)?.code ?? `D${code}`;
}

/** Cursos por instituição: o valor é uma letra e 8 dígitos, com espaço no fim (observado). */
export const COURSES: Record<string, [string, string][]> = {
  V000000000001: [
    ['V00000001 ', 'Genética e Biologia Molecular'],
    ['V00000002 ', 'Botânica'],
  ],
  V000000000002: [['V00000003 ', 'Ecologia']],
  V000000000003: [['V00000004 ', 'Genética e Biologia Molecular']],
};

/**
 * Órgãos por instituição (código sem a letra), com as unidades de cada um:
 * códigos sintéticos de 12 dígitos no formato da janela de órgãos do projeto
 * (pkg_projeto.pp_orgao_cargo, lida em 18/10/2026).
 */
export const ORGANS: Record<string, { code: string; name: string; units: [string, string][] }[]> = {
  '000000000001': [
    {
      code: '000001000008',
      name: 'Instituto de Biociências',
      units: [
        ['000001001004', 'Departamento de Genética'],
        ['000001002000', 'Departamento de Botânica'],
      ],
    },
    { code: '000002000004', name: 'Instituto de Informática', units: [] },
  ],
};

export const AGENCIES: [string, string][] = [
  ['000000000001', 'Conselho Nacional de Desenvolvimento Científico e Tecnológico'],
  ['000000000002', 'Coordenação de Aperfeiçoamento de Pessoal de Nível Superior'],
  ['000000000003', 'Fundação de Amparo à Pesquisa do Estado de São Paulo'],
];

/** As grandes áreas, com os códigos observados no areaDP do menu. */
export const AREAS: [string, string][] = [
  ['10000003', 'Ciências Exatas e da Terra'],
  ['20000006', 'Ciências Biológicas'],
  ['30000009', 'Engenharias'],
  ['40000001', 'Ciências da Saúde'],
  ['50000004', 'Ciências Agrárias'],
  ['60000007', 'Ciências Sociais Aplicadas'],
  ['70000000', 'Ciências Humanas'],
  ['80000002', 'Lingüística, Letras e Artes'],
  ['90000005', 'Outra'],
];

/** O script do menu com a tabela de áreas (só as grandes áreas). */
export function areaScript(): string {
  const nodes = AREAS.map(([c, l]) => `{l:"${l}",n:1,c:"${c}"}`).join(',');
  return `<script>var areaDP = [${nodes}];</script>`;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function institutions(req: SimRequest, state: LattesState): SimResponse {
  const query = (req.get('f_nome') ?? '').replace(/%/g, '').trim();
  const form = `<form name="instituicaoForm" method="post" action="PRC_INST_FORM">
${h.hidden('F_CTR', 'C')}${h.hidden('F_COD', state.code)}${h.hidden('F_NIVEL', req.get('f_nivel') ?? '')}${h.hidden('F_STA_OUTRA', req.get('f_sta_outra') ?? 'N')}
${h.text('f_nome', query)} <input type="button" value="Buscar" onclick="recuperaInstMacro()">
</form>
<script>var dc = document.forms['instituicaoForm'];
function recuperaInstMacro(){ dc.f_nome.value = dc.f_nome.value.replace(/%/g, ''); if (dc.f_nome.value.length < 2) { alert('Informe ao menos duas letras.'); return; } dc.submit(); }
function seleciona(codigo, nome){ alert('Escolhida: ' + nome + ' (' + codigo + ')'); }</script>`;
  if (req.get('f_ctr') !== 'C' || query.length < 2) return html(h.page('Instituição', form));
  const hits = institutionsOf(state).filter((i) => fold(i.name).includes(fold(query)));
  const results = hits
    .map(
      (i) =>
        `<a href="javascript:seleciona('${i.code}','${h.jsString(i.name)}')">${h.esc(i.name.toUpperCase())} (${i.uf})</a><br>`,
    )
    .join('\n');
  return html(
    h.page(
      'Instituição',
      `${form}\n${results}\n<p>Foram encontrados ${hits.length} registros.</p>`,
    ),
  );
}

function courses(req: SimRequest, state: LattesState): SimResponse {
  const inst = req.get('f_inst') ?? '';
  const options = COURSES[inst] ?? [];
  const body = `<form name="GN_CURSO_FORM" method="post" action="PRC_CURSO_FORM">
${h.hidden('f_sta_area', 'S')}${h.hidden('f_cod_inst', inst)}${h.hidden('f_nme_inst', institutionsOf(state).find((i) => i.code === inst)?.name ?? '')}${h.hidden('f_cod', state.code)}
<p>${h.select('f_curso', options, '')}</p>
</form>`;
  return html(h.page('Curso', body));
}

function agencies(): SimResponse {
  const links = AGENCIES.map(
    ([code, name]) =>
      `<a href="javascript:atribuir('${code}','${h.jsString(name)}')">${h.esc(name)}</a><br>`,
  ).join('\n');
  return html(h.page('Agência de fomento', links));
}

/** Orientandos com currículo no Lattes simulado: nome → identificador (sintéticos). */
export const STUDENTS: Record<string, { id: string; seq: string }> = {
  'Aluna Sintética de Exemplo': { id: '0000000000000001', seq: '1' },
};

/**
 * A validação do nome do orientando (pkg_orient.valida_orientador_ajax), na
 * forma da resposta real de 18/10/2026. O f_nme chega como o escape() da
 * página o deixou.
 */
function studentCheck(req: SimRequest): SimResponse {
  const name = (req.get('f_nme') ?? '').replace(/%([0-9A-F]{2})/gi, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  const hit = STUDENTS[name.trim()];
  const body = hit
    ? `{"sta_validado":true ,"mensagem":"","idOrientado":"${hit.id}","seqFormOrientado":"${hit.seq}"}`
    : '{"sta_validado":false ,"mensagem":"Orientador não encontrado","idOrientado":"","seqFormOrientado":""}';
  return { contentType: 'application/json', html: body, status: 200 };
}

export const BUSCAS_ROUTES: Routes = {
  'pkg_orient.valida_orientador_ajax': studentCheck,
  prc_agencia: () => agencies(),
  prc_curso_form: courses,
  prc_inst_form: institutions,
};
