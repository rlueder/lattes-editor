// Prêmios e títulos e formação complementar no Lattes simulado.
//
// Prêmios (docs/lattes_internals.md, seções 15 e 16): lista pkg_premio.lista,
// formulário GN_PREMIO, POST pkg_premio.form com f_ctr U, E e I. Os campos são
// os observados; a correspondência com o XML (PREMIO-TITULO) é inferida, e a
// exportação não numera o prêmio: o f_seq é um id do simulado.
//
// Formação complementar (seções 5 e 15): lista pkg_formacao_compl.lista,
// formulário GN_FORMACAO2 aberto por PKG_FORMACAO_COMPL.form e postado para
// PKG_FORMACAO_COMPL.FORM2, com f_ctr sem valor. Os campos são os do censo de
// 15/10/2026 (observados: nomes, tipos, limites e opções; a passada de edição
// viu f_carga, F_STATUS, f_curso_old e f_inst_old com os valores do XML). A
// gravação de carga e status pelo FORM2 é inferida, e a inclusão (sem f_seq)
// está em censo.ts. Instituição e curso vêm dos ocultos que as buscas
// escrevem, como na formação acadêmica (observado em 20/10/2026: f_cod_inst
// com a letra, f_cod_curso2 sem ela); que o FORM2 os grave é inferido.

import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import { withLetter } from './buscas.ts';
import { applyFields, attr, type Binding, fixed, mapped, renderFields } from './campos.ts';
import { complementaryInclusion, isComplementaryInclusion } from './censo.ts';
import type { LattesState } from './estado.ts';
import { courseLetter, deleteScript, setaUltimoPublico } from './formacao.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

// ---------------------------------------------------------------- prêmios

function premios(state: LattesState): XElement[] {
  const container = state.find(['DADOS-GERAIS', 'PREMIOS-TITULOS']);
  return container ? childElements(container, 'PREMIO-TITULO') : [];
}

function premioBindings(state: LattesState, seq: string, ctr: string): Binding[] {
  return [
    attr('f_titulo', 'NOME-DO-PREMIO-OU-TITULO', 'text', { maxLength: 200 }),
    attr('f_agencia', 'NOME-DA-ENTIDADE-PROMOTORA', 'text', { maxLength: 100 }),
    attr('f_ano', 'ANO-DA-PREMIACAO', 'text', { maxLength: 4 }),
    {
      kind: 'select',
      name: 'f_tipo_privacidade',
      options: h.PRIVACY,
      read: (el) => state.privacy.get(el) ?? '1',
      write: (el, value) => state.privacy.set(el, value || '1'),
    },
    fixed('f_ctr', ctr),
    fixed('f_cod', state.code),
    fixed('f_seq', seq),
  ];
}

function premioLista(state: LattesState): SimResponse {
  const rows = premios(state)
    .map(
      (el) =>
        `<tr><td><a href="#" onclick="self.parent.modalCV2.setarUrl('pkg_premio.form?f_cod=${state.code}&amp;f_seq=${state.idOf(el)}',true); return false;">${h.esc(getAttr(el, 'NOME-DO-PREMIO-OU-TITULO') ?? '')}, ${h.esc(getAttr(el, 'ANO-DA-PREMIACAO') ?? '')}</a></td></tr>`,
    )
    .join('\n');
  // Inferido: o "Incluir novo item" é o mesmo formulário sem f_seq, como nas outras listas.
  const novo = `<a href="#" onclick="self.parent.modalCV2.setarUrl('pkg_premio.form?f_cod=${state.code}',true); return false;">Incluir novo item</a>`;
  return html(h.page('Prêmios e títulos', `<table>${rows}</table>\n<p>${novo}</p>`));
}

function premioForm(req: SimRequest, state: LattesState): SimResponse {
  const seq = req.get('f_seq');
  const el = seq ? premios(state).find((p) => state.idOf(p) === seq) : undefined;
  if (seq && !el) return html(h.page('Prêmio', '<p>Registro não encontrado.</p>'));
  const body = `<form name="GN_PREMIO" method="post" action="pkg_premio.form">
${renderFields(premioBindings(state, seq ?? '', el ? 'U' : 'I'), el)}
${h.formButtons(Boolean(el))}
</form>
${h.formScripts('GN_PREMIO', el ? 'Você realmente deseja excluir este Prêmio/Titulo?' : undefined)}`;
  return html(h.page('Prêmios e títulos', body));
}

function premioPost(req: SimRequest, state: LattesState): SimResponse {
  const ctr = req.get('f_ctr');
  const back = h.savedScript(`pkg_premio.lista?f_cod=${state.code}`);
  if (ctr === 'I') {
    const container = state.ensurePath(['DADOS-GERAIS', 'PREMIOS-TITULOS']);
    const el = element('PREMIO-TITULO');
    container.children.push(el);
    container.selfClosing = false;
    applyFields(premioBindings(state, '', 'I'), el, req);
    state.touch();
    return html(back);
  }
  const el = premios(state).find((p) => state.idOf(p) === req.get('f_seq'));
  if (!el) return html(h.page('Prêmio', '<p>Registro não encontrado.</p>'));
  if (ctr === 'E') state.remove(state.find(['DADOS-GERAIS', 'PREMIOS-TITULOS'])!, el);
  else if (ctr === 'U') applyFields(premioBindings(state, '', 'U'), el, req);
  else return html(back);
  state.touch();
  return html(back);
}

// ---------------------------------------------------------------- formação complementar

/** f_nivel → elemento (seção 5: o f_nivel é o NIVEL do XML nesses itens). */
const COMPL_LEVELS: Record<string, string> = {
  '8': 'FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA',
  E: 'MBA',
  F: 'FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO',
  Y: 'OUTROS',
};

function complementares(state: LattesState): XElement[] {
  const container = state.find(['DADOS-COMPLEMENTARES', 'FORMACAO-COMPLEMENTAR']);
  return container ? childElements(container) : [];
}

const complBySeq = (state: LattesState, seq: string | undefined) =>
  complementares(state).find((el) => getAttr(el, 'SEQUENCIA-FORMACAO') === seq);

function complLista(state: LattesState): SimResponse {
  const rows = complementares(state)
    .map(
      (el) =>
        `<tr><td><a href="#" onclick="self.parent.modalCV2.setarUrl('PKG_FORMACAO_COMPL.form?f_cod=${state.code}&amp;f_seq=${getAttr(el, 'SEQUENCIA-FORMACAO')}',true); return false;">${h.esc(getAttr(el, 'NOME-CURSO') ?? el.name)}</a></td></tr>`,
    )
    .join('\n');
  return html(h.page('Formação complementar', `<table>${rows}</table>`));
}

/**
 * Os campos do formulário de edição. Instituição e curso vêm desabilitados,
 * escolhidos pelas buscas; os nomes voltam nos ocultos *_old e os códigos nos
 * ocultos da letra: a instituição com ela (V em f_cod_inst, as outras em
 * f_cod_inst2) e o curso sem ela (V em f_cod_curso, as outras em
 * f_cod_curso2), como a página de 20/10/2026 os trouxe.
 */
function complBindings(state: LattesState, el: XElement): Binding[] {
  const inst = (x: XElement) => withLetter(state, getAttr(x, 'CODIGO-INSTITUICAO') ?? '');
  const instWrite = (x: XElement, v: string) => {
    if (v) setAttr(x, 'CODIGO-INSTITUICAO', v.replace(/^[A-Za-z]/, ''));
  };
  const courseWrite = (x: XElement, v: string) => {
    if (v) setAttr(x, 'CODIGO-CURSO', v);
  };
  const course = (x: XElement, letter: boolean) =>
    (courseLetter(x) === 'V') === letter ? (getAttr(x, 'CODIGO-CURSO') ?? '') : '';
  const hidden = (name: string, read: (x: XElement) => string, write: Binding['write']) =>
    ({ kind: 'hidden', name, read, write }) as Binding;
  return [
    {
      kind: 'select',
      name: 'f_nivel',
      options: h.capturedList('L26'),
      read: (x) => getAttr(x, 'NIVEL') ?? '',
    },
    attr('f_inst', 'NOME-INSTITUICAO', 'text', { disabled: true, maxLength: 75 }),
    attr('f_curso', 'NOME-CURSO', 'text', { disabled: true, maxLength: 50 }),
    attr('f_carga', 'CARGA-HORARIA', 'text', { maxLength: 4 }),
    mapped(
      'F_STATUS',
      'STATUS-DO-CURSO',
      'radio',
      { CONCLUIDO: 'S', EM_ANDAMENTO: 'N', INCOMPLETO: 'I' },
      { options: h.capturedList('L27') },
    ),
    // O f_ctr deste formulário vem sem valor (seção 15, observado).
    fixed('f_ctr', ''),
    fixed('f_cod', state.code),
    fixed('f_seq', getAttr(el, 'SEQUENCIA-FORMACAO') ?? ''),
    hidden('f_cod_inst', (x) => (inst(x).startsWith('V') ? inst(x) : ''), instWrite),
    hidden('f_cod_curso', (x) => course(x, true), courseWrite),
    hidden('f_cod_inst2', (x) => (inst(x).startsWith('V') ? '' : inst(x)), instWrite),
    hidden('f_cod_curso2', (x) => course(x, false), courseWrite),
    hidden(
      'f_inst_old',
      (x) => getAttr(x, 'NOME-INSTITUICAO') ?? '',
      (x, v) => setAttr(x, 'NOME-INSTITUICAO', v),
    ),
    // O nome do curso sem o código CAPES do texto da opção, como na formação.
    hidden(
      'f_curso_old',
      (x) => getAttr(x, 'NOME-CURSO') ?? '',
      (x, v) => setAttr(x, 'NOME-CURSO', v.replace(/\s*\([^()]*\)\s*$/, '').trim()),
    ),
    // FA, como no formulário capturado no censo de 15/10/2026 (a inclusão); que
    // a edição traga o mesmo é inferido.
    fixed('f_tipo', 'FA'),
  ];
}

function complForm(req: SimRequest, state: LattesState): SimResponse {
  if (isComplementaryInclusion(req)) return complementaryInclusion(state);
  const el = complBySeq(state, req.get('f_seq'));
  if (!el) return html(h.page('Formação complementar', '<p>Registro não encontrado.</p>'));
  const body = `<form name="GN_FORMACAO2" method="post" action="PKG_FORMACAO_COMPL.FORM2">
${renderFields(complBindings(state, el), el)}
${h.formButtons(true)}
</form>
${h.formScripts('GN_FORMACAO2')}${deleteScript(state, el, 'PKG_FORMACAO_COMPL.SETA_ULTIMO_PUBLICO', 'Você realmente deseja excluir esta formação acadêmica?')}`;
  return html(h.page('Formação complementar', body));
}

/**
 * Os campos do segundo passo, lidos em 27/10/2026 num curso "Outros": os
 * anos, a bolsa e, ocultos ali, a monografia e o orientador. Só os que o
 * elemento tem no XSD.
 */
function complStep2Bindings(el: XElement): Binding[] {
  const has = (a: string) =>
    lattesSchema.elements[el.name]?.attributes.some((x) => x.name === a) ?? false;
  const all: [string, Binding][] = [
    ['ANO-DE-INICIO', attr('f_ano_ini', 'ANO-DE-INICIO', 'text', { maxLength: 4 })],
    ['ANO-DE-CONCLUSAO', attr('f_ano_fim', 'ANO-DE-CONCLUSAO', 'text', { maxLength: 4 })],
    [
      'ANO-DE-OBTENCAO-DO-TITULO',
      attr('f_ano_obten', 'ANO-DE-OBTENCAO-DO-TITULO', 'text', { maxLength: 4 }),
    ],
    [
      'FLAG-BOLSA',
      mapped(
        'F_BOLSA',
        'FLAG-BOLSA',
        'radio',
        { NAO: 'N', SIM: 'S' },
        {
          options: [
            ['S', 'Sim'],
            ['N', 'Não'],
          ],
        },
      ),
    ],
    ['TITULO-DA-MONOGRAFIA', attr('f_titulo', 'TITULO-DA-MONOGRAFIA', 'hidden')],
    ['NOME-COMPLETO-DO-ORIENTADOR', attr('f_orient', 'NOME-COMPLETO-DO-ORIENTADOR', 'hidden')],
  ];
  return all.filter(([a]) => has(a)).map(([, b]) => b);
}

/**
 * O segundo passo (observado em 27/10/2026): o mesmo GN_FORMACAO2, com f_ctr
 * U, os valores do primeiro passo em ocultos e os campos do segundo.
 */
function complStep2(req: SimRequest, el: XElement): SimResponse {
  const first = req.pairs
    .filter(([k]) => !['f_ctr', 'f_inst', 'f_curso'].includes(k))
    .map(([k, v]) => h.hidden(k, v))
    .join('\n');
  const body = `<form name="GN_FORMACAO2" method="post" action="PKG_FORMACAO_COMPL.FORM2">
${first}
${h.hidden('f_inst', '')}${h.hidden('f_curso', '')}
${renderFields(complStep2Bindings(el), el)}
${h.hidden('f_ctr', 'U')}${h.hidden('f_tipo_privacidade', '1')}
${h.hidden('f_plv_l', '')}${h.hidden('f_setor_l', '')}${h.hidden('f_area_l', '')}
${h.formButtons(true)}
</form>`;
  return html(h.page('Formação complementar', body));
}

/**
 * FORM2: f_ctr=E exclui. Sem valor (o do formulário de edição), devolve o
 * segundo passo sem gravar nada; U grava o primeiro e o segundo passo e
 * responde com a mensagem de sucesso (observado em 27/10/2026).
 */
function complPost(req: SimRequest, state: LattesState): SimResponse {
  const el = complBySeq(state, req.get('f_seq'));
  const back = h.savedScript(`pkg_formacao_compl.lista?f_cod=${state.code}`);
  if (!el) return html(h.page('Formação complementar', '<p>Registro não encontrado.</p>'));
  const ctr = req.get('f_ctr') ?? '';
  if (ctr === 'E') {
    state.remove(state.find(['DADOS-COMPLEMENTARES', 'FORMACAO-COMPLEMENTAR'])!, el);
    state.touch();
    return html(back);
  }
  if (ctr === '') return complStep2(req, el);
  if (ctr !== 'U') return html(back);
  const nivel = req.get('f_nivel') ?? '';
  const name = COMPL_LEVELS[nivel];
  if (!name) return html('<script>alert("Informe o nível.");</script>');
  el.name = name;
  el.attrs = el.attrs.map((a) => (a.name === 'NIVEL' ? { ...a, value: nivel } : a));
  applyFields(complBindings(state, el), el, req);
  applyFields(complStep2Bindings(el), el, req);
  state.touch();
  return html(h.eventSavedScript());
}

export const PREMIOS_COMPLEMENTAR_ROUTES: Routes = {
  'pkg_formacao_compl.form': complForm,
  'pkg_formacao_compl.form2': complPost,
  'pkg_formacao_compl.lista': (_req, state) => complLista(state),
  'pkg_formacao_compl.seta_ultimo_publico': setaUltimoPublico,
  'pkg_premio.form': (req, state) =>
    req.method === 'POST' ? premioPost(req, state) : premioForm(req, state),
  'pkg_premio.lista': (_req, state) => premioLista(state),
};
