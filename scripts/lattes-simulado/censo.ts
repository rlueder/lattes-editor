// Formulários que só entram no simulado para o censo (LAT-55): trabalhos
// técnicos (lista, inclusão e edição), a inclusão da formação complementar e
// a de licenças. Só GET: o censo nunca envia, e um POST aqui responde que não
// é simulado. A exceção é a alteração de trabalho técnico, que grava as
// grades (grades.ts) para o conector de palavras-chave.
//
// Nomes, tipos, limites e opções dos campos são os observados: a seção 16 de
// docs/lattes_internals.md e a captura de 13/10/2026 (docs/lattes-listas/).
// Inferido, e marcado no README: os rótulos ao lado de cada campo, o desenho
// em tabela, a ordem dos campos da formação complementar e da licença, e a
// ligação de cada campo do trabalho técnico com o atributo do XML.

import { childElements, getAttr, type XElement } from '../../src/model/xml.ts';
import { availabilityToForm } from '../../src/schema/availability.ts';
import type { LattesState } from './estado.ts';
import { GRID_HIDDEN, gridScripts, techWorkPost } from './grades.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

export const TECH_WORK_PATH = ['PRODUCAO-TECNICA'];

/** Um campo numa linha da tabela, com o rótulo à esquerda (desenho inferido). */
const row = (label: string, control: string) =>
  `<tr><td class="rotulo">${h.esc(label)}:</td><td>${control}</td></tr>`;

export function techWorks(state: LattesState): XElement[] {
  const container = state.find(TECH_WORK_PATH);
  return container ? childElements(container, 'TRABALHO-TECNICO') : [];
}

const part = (item: XElement | undefined, name: string) =>
  item ? childElements(item, name)[0] : undefined;

const value = (el: XElement | undefined, attr: string) => (el && getAttr(el, attr)) ?? '';

/** F_COD_PROD (captura, lista L41) → NATUREZA do XML (inferido pelo rótulo). */
const NATURE_CODES: Record<string, string> = {
  ELABORACAO_DE_PROJETO: '244',
  EXTENSAO_TECNOLOGICA: '247',
  OUTRA: '249',
  PARECER: '243',
  RELATORIO_TECNICO: '245',
  SERVICOS_NA_AREA_DA_SAUDE: '246',
};

/** f_meio (captura, lista L2) → MEIO-DE-DIVULGACAO (inferido pelo rótulo). */
const MEDIA_CODES: Record<string, string> = {
  FILME: 'F',
  HIPERTEXTO: 'H',
  IMPRESSO: 'I',
  MEIO_DIGITAL: 'D',
  MEIO_MAGNETICO: 'M',
  OUTRO: 'O',
  VARIOS: 'V',
};

const languageCode = (name: string) =>
  h.LANGUAGES.find(([, label]) => label.toLowerCase() === name.toLowerCase())?.[0] ?? '';

/** Trabalhos técnicos, GN_RELATORIO (seção 16), na ordem da tabela da seção. */
function techWorkForm(req: SimRequest, state: LattesState): SimResponse {
  const seq = req.get('f_seq');
  const item = seq
    ? techWorks(state).find((t) => getAttr(t, 'SEQUENCIA-PRODUCAO') === seq)
    : undefined;
  if (seq && !item) return html(h.page('Trabalhos técnicos', '<p>Registro não encontrado.</p>'));
  const b = part(item, 'DADOS-BASICOS-DO-TRABALHO-TECNICO');
  const d = part(item, 'DETALHAMENTO-DO-TRABALHO-TECNICO');
  const info = part(item, 'INFORMACOES-ADICIONAIS');
  const rows = [
    row(
      'Natureza',
      h.radios('F_COD_PROD', h.capturedList('L41'), NATURE_CODES[value(b, 'NATUREZA')] ?? ''),
    ),
    row('Título', h.text('f_titulo', value(b, 'TITULO-DO-TRABALHO-TECNICO'), { maxLength: 400 })),
    row('Ano', h.text('f_ano', value(b, 'ANO'), { maxLength: 4 })),
    row('País', h.select('f_pais', h.COUNTRIES, h.countryCode(value(b, 'PAIS')))),
    row('Idioma', h.select('F_IDIOMA', h.LANGUAGES, languageCode(value(b, 'IDIOMA')))),
    row(
      'Meio de divulgação',
      h.select('f_meio', h.capturedList('L2'), MEDIA_CODES[value(b, 'MEIO-DE-DIVULGACAO')] ?? ''),
    ),
    row('Home page', h.text('f_homepage', value(b, 'HOME-PAGE-DO-TRABALHO'), { maxLength: 250 })),
    row(
      'Relevância',
      h.radios('F_RELEV', h.capturedList('L6'), value(b, 'FLAG-RELEVANCIA') === 'SIM' ? 'S' : 'N'),
    ),
    row('Finalidade', h.text('f_finalidade', value(d, 'FINALIDADE'), { maxLength: 255 })),
    row('Duração em meses', h.text('f_duracao', value(d, 'DURACAO-EM-MESES'), { maxLength: 5 })),
    row('Número de páginas', h.text('f_paginas', value(d, 'NUMERO-DE-PAGINAS'), { maxLength: 5 })),
    row(
      'Disponibilidade',
      h.select(
        'f_disp',
        h.capturedList('L3'),
        availabilityToForm(value(d, 'DISPONIBILIDADE')) ?? '',
      ),
    ),
    row('Cidade', h.text('f_cidade', value(d, 'CIDADE-DO-TRABALHO'), { maxLength: 255 })),
    row(
      'Instituição promotora',
      h.text('f_inst', value(d, 'INSTITUICAO-FINANCIADORA'), { maxLength: 255 }),
    ),
    row(
      'Informações adicionais',
      h.textarea('f_ref', value(info, 'DESCRICAO-INFORMACOES-ADICIONAIS'), { maxLength: 3950 }),
    ),
    row(
      'Título em inglês',
      h.text('f_titulo_en', value(b, 'TITULO-DO-TRABALHO-TECNICO-INGLES'), { maxLength: 400 }),
    ),
    row(
      'Informações adicionais em inglês',
      h.textarea('f_ref_en', value(info, 'DESCRICAO-INFORMACOES-ADICIONAIS-INGLES'), {
        maxLength: 3800,
      }),
    ),
    row('Visibilidade', h.select('f_tipo_privacidade', h.PRIVACY, '1')),
  ].join('\n');
  const hidden = [
    h.hidden('f_ctr', item ? 'U' : 'I'),
    h.hidden('f_cod', state.code),
    h.hidden('f_seq', seq ?? ''),
    GRID_HIDDEN,
  ].join('');
  const body = `<form name="GN_RELATORIO" method="post" action="PKG_RELATORIO.FORM">
<table>${rows}</table>
${hidden}
${h.formButtons(Boolean(item))}
</form>
${gridScripts(item)}
${h.formScripts('GN_RELATORIO', item ? 'Deseja realmente excluir esta produção?' : undefined)}`;
  return html(h.page('Trabalhos técnicos', body));
}

function techWorkList(state: LattesState): SimResponse {
  const rows = techWorks(state)
    .map((t) => {
      const seq = getAttr(t, 'SEQUENCIA-PRODUCAO') ?? '';
      const title = value(
        part(t, 'DADOS-BASICOS-DO-TRABALHO-TECNICO'),
        'TITULO-DO-TRABALHO-TECNICO',
      );
      const year = value(part(t, 'DADOS-BASICOS-DO-TRABALHO-TECNICO'), 'ANO');
      // A linha inteira abre o formulário, como nas listas reais (producao.ts).
      return `<tr onclick="self.parent.modalCV2.setarUrl('pkg_relatorio.form?f_cod=${state.code}&amp;f_seq=${seq}',true)"><td>${h.esc(title)}</td><td>${h.esc(year)}</td></tr>`;
    })
    .join('\n');
  const novo = `<a href="#" onclick="self.parent.modalCV2.setarUrl('pkg_relatorio.form?f_cod=${state.code}',true); return false;">Incluir novo item</a>`;
  return html(h.page('Trabalhos técnicos', `<table>${rows}</table>\n<p>${novo}</p>`));
}

/**
 * Inclusão da formação complementar: os campos da recaptura de 27/10/2026
 * (o curso desabilitado, só pela busca, e os ocultos que as buscas escrevem).
 */
function complementaryInclusion(state: LattesState): SimResponse {
  const rows = [
    row('Nível', h.select('f_nivel', h.capturedList('L26'), '')),
    row('Instituição', h.text('f_inst', '', { disabled: true, maxLength: 75 })),
    row('Curso', h.text('f_curso', '', { disabled: true, maxLength: 50 })),
    row('Carga horária', h.text('f_carga', '', { maxLength: 4 })),
    row('Situação', h.radios('F_STATUS', h.capturedList('L27'), '')),
  ].join('\n');
  // f_tipo=FA vem da URL da captura; o valor do oculto é inferido.
  const body = `<form name="GN_FORMACAO2" method="post" action="PKG_FORMACAO_COMPL.FORM2">
<table>${rows}</table>
${h.hidden('f_ctr', '')}${h.hidden('f_cod', state.code)}${h.hidden('f_seq', '')}
${['f_cod_inst', 'f_cod_curso', 'f_cod_inst2', 'f_cod_curso2', 'f_inst_old', 'f_curso_old'].map((n) => h.hidden(n, '')).join('')}${h.hidden('f_tipo', 'FA')}
${h.formButtons(false)}
</form>`;
  return html(h.page('Formação complementar', body));
}

export const notSimulated = () =>
  html(
    h.page('Não simulado', '<p>O simulado só mostra este formulário; o envio não é simulado.</p>'),
  );

/** A formação complementar sem f_seq abre a inclusão; com ele, a edição de premios-complementar.ts. */
export function isComplementaryInclusion(req: SimRequest): boolean {
  return req.method === 'GET' && !req.get('f_seq');
}

export { complementaryInclusion };

export const CENSO_ROUTES: Routes = {
  'pkg_relatorio.form': (req, state) =>
    req.method === 'POST' ? techWorkPost(req, state) : techWorkForm(req, state),
  'pkg_relatorio.lista': (_req, state) => techWorkList(state),
};
