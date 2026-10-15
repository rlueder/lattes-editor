// Prêmios e títulos e formação complementar no Lattes simulado.
//
// Prêmios (docs/lattes_internals.md, seções 15 e 16): lista pkg_premio.lista,
// formulário GN_PREMIO, POST pkg_premio.form com f_ctr U, E e I. Os campos são
// os observados; a correspondência com o XML (PREMIO-TITULO) é inferida, e a
// exportação não numera o prêmio: o f_seq é um id do simulado.
//
// Formação complementar (seções 5 e 15): lista pkg_formacao_compl.lista,
// formulário GN_FORMACAO2 aberto por PKG_FORMACAO_COMPL.form e postado para
// PKG_FORMACAO_COMPL.FORM2, com f_ctr sem valor. Do formulário só se anotou a
// lista f_nivel e os ocultos da exclusão; o simulado não tem outros campos, e
// a inclusão (cujo link não foi lido) não existe aqui.

import { childElements, element, getAttr, type XElement } from '../../src/model/xml.ts';
import { applyFields, attr, type Binding, fixed, renderFields } from './campos.ts';
import { complementaryInclusion, isComplementaryInclusion } from './censo.ts';
import type { LattesState } from './estado.ts';
import { deleteScript, setaUltimoPublico } from './formacao.ts';
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

function complForm(req: SimRequest, state: LattesState): SimResponse {
  if (isComplementaryInclusion(req)) return complementaryInclusion(state);
  const el = complBySeq(state, req.get('f_seq'));
  if (!el) return html(h.page('Formação complementar', '<p>Registro não encontrado.</p>'));
  const fields: Binding[] = [
    {
      kind: 'select',
      name: 'f_nivel',
      options: h.capturedList('L26'),
      read: (x) => getAttr(x, 'NIVEL') ?? '',
    },
    // O f_ctr deste formulário vem sem valor (seção 15, observado).
    fixed('f_ctr', ''),
    fixed('f_cod', state.code),
    fixed('f_seq', getAttr(el, 'SEQUENCIA-FORMACAO') ?? ''),
    // O valor de f_tipo aqui não foi anotado (inferido: vazio).
    fixed('f_tipo', ''),
  ];
  const body = `<form name="GN_FORMACAO2" method="post" action="PKG_FORMACAO_COMPL.FORM2">
${renderFields(fields, el)}
${h.formButtons(true)}
</form>
${h.formScripts('GN_FORMACAO2')}${deleteScript(state, el, 'PKG_FORMACAO_COMPL.SETA_ULTIMO_PUBLICO', 'Você realmente deseja excluir esta formação acadêmica?')}`;
  return html(h.page('Formação complementar', body));
}

/** FORM2: f_ctr=E exclui; sem valor (o do formulário) ou U grava o nível (inferido). */
function complPost(req: SimRequest, state: LattesState): SimResponse {
  const el = complBySeq(state, req.get('f_seq'));
  const back = h.savedScript(`pkg_formacao_compl.lista?f_cod=${state.code}`);
  if (!el) return html(h.page('Formação complementar', '<p>Registro não encontrado.</p>'));
  const ctr = req.get('f_ctr') ?? '';
  if (ctr === 'E') {
    state.remove(state.find(['DADOS-COMPLEMENTARES', 'FORMACAO-COMPLEMENTAR'])!, el);
  } else if (ctr === '' || ctr === 'U') {
    const nivel = req.get('f_nivel') ?? '';
    const name = COMPL_LEVELS[nivel];
    if (!name) return html('<script>alert("Informe o nível.");</script>');
    el.name = name;
    el.attrs = el.attrs.map((a) => (a.name === 'NIVEL' ? { ...a, value: nivel } : a));
  } else return html(back);
  state.touch();
  return html(back);
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
