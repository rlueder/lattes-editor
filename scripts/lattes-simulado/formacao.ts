// Formação acadêmica no Lattes simulado: a lista (pkg_formacao.lista, com
// f_tipo), o formulário GN_FORMACAO2 de alteração e de inclusão, e o POST
// pkg_formacao.FORM com f_ctr U, I ou E. Campos da seção 17 de
// docs/lattes_internals.md (observados no mestrado); o simulado usa os mesmos
// campos em todos os níveis, o que o Lattes não faz (a tabela da seção 17
// mostra o que muda por nível).

import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import { AGENCIES, COURSES, withLetter } from './buscas.ts';
import { applyFields, attr, type Binding, fixed, mapped, renderFields } from './campos.ts';
import type { LattesState } from './estado.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, notFound, type Routes, type SimResponse } from './tipos.ts';

/** f_nivel → elemento do XML, com os códigos do reconhecimento (seção 4.2). */
export const LEVELS: Record<string, string> = {
  '1': 'GRADUACAO',
  '2': 'ESPECIALIZACAO',
  '3': 'MESTRADO',
  '4': 'DOUTORADO',
  '7': 'CURSO-TECNICO-PROFISSIONALIZANTE',
  '9': 'MESTRADO-PROFISSIONALIZANTE',
  B: 'ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU',
  C: 'ENSINO-MEDIO-SEGUNDO-GRAU',
  D: 'RESIDENCIA-MEDICA',
  X: 'APERFEICOAMENTO',
};

/** Pós-doutorado e livre-docência ficam na lista f_tipo=AP. */
const AP_ELEMENTS = new Set(['LIVRE-DOCENCIA', 'POS-DOUTORADO']);

const TITLES = [
  'TITULO-DA-DISSERTACAO-TESE',
  'TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO',
  'TITULO-DA-MONOGRAFIA',
  'TITULO-DA-RESIDENCIA-MEDICA',
];
const ADVISORS = ['NOME-COMPLETO-DO-ORIENTADOR', 'NOME-DO-ORIENTADOR'];

/** O atributo que o elemento tem, entre os candidatos, pelo schema. */
function attrOf(el: XElement, candidates: string[]): string | undefined {
  const names = new Set(lattesSchema.elements[el.name]?.attributes.map((a) => a.name));
  return candidates.find((c) => names.has(c));
}

function oneOf(
  name: string,
  candidates: string[],
  max?: number,
  kind: Binding['kind'] = 'text',
): Binding {
  return {
    kind,
    maxLength: max,
    name,
    read: (el) => {
      const a = attrOf(el, candidates);
      return a ? (getAttr(el, a) ?? '') : '';
    },
    write: (el, value) => {
      const a = attrOf(el, candidates);
      if (a) setAttr(el, a, value);
    },
  };
}

/** O atributo, se o elemento o tem pelo schema; senão a gravação é ignorada. */
function setIfKnown(el: XElement, name: string, value: string): void {
  if (value && attrOf(el, [name])) setAttr(el, name, value);
}

/** A letra do curso na lista do simulado (buscas.ts), pelo código sem ela. */
function courseLetter(el: XElement): string {
  const code = getAttr(el, 'CODIGO-CURSO') ?? '';
  const hit = Object.values(COURSES)
    .flat()
    .find(([value]) => value.trim().slice(1) === code);
  return hit?.[0][0] ?? 'D';
}

const hiddenFrom = (name: string, read: (el: XElement) => string, write?: Binding['write']) =>
  ({ kind: 'hidden', name, read, write }) as Binding;

/** Os campos de GN_FORMACAO2 (seção 17) e a ligação de cada um com o XML (inferida). */
function bindings(state: LattesState, ids: Record<string, string>): Binding[] {
  const none = (name: string, kind: Binding['kind'] = 'hidden'): Binding => ({
    kind,
    name,
    read: () => '',
  });
  const inst = (el: XElement) => withLetter(state, getAttr(el, 'CODIGO-INSTITUICAO') ?? '');
  const instWrite: Binding['write'] = (el, value) =>
    setIfKnown(el, 'CODIGO-INSTITUICAO', value.replace(/^[A-Za-z]/, ''));
  return [
    {
      ...oneOf('f_tpo_doutorado', ['TIPO-MESTRADO', 'TIPO-DOUTORADO'], undefined, 'radio'),
      options: [
        ['N', 'Normal'],
        ['S', 'Sanduíche'],
        ['C', 'Co-tutela'],
        ['CS', 'Co-tutela/sanduíche'],
      ],
    },
    attr('f_inst', 'NOME-INSTITUICAO', 'text', { disabled: true, maxLength: 75 }),
    attr('f_curso', 'NOME-CURSO', 'text', { disabled: true, maxLength: 75 }),
    mapped(
      'F_STATUS',
      'STATUS-DO-CURSO',
      'radio',
      { CONCLUIDO: 'S', EM_ANDAMENTO: 'N', INCOMPLETO: 'I' },
      { options: h.capturedList('L27') },
    ),
    attr('f_ano_ini', 'ANO-DE-INICIO', 'text', { maxLength: 4 }),
    attr('f_ano_fim', 'ANO-DE-CONCLUSAO', 'text', { maxLength: 4 }),
    none('f_mes_obten', 'text'),
    attr('f_ano_obten', 'ANO-DE-OBTENCAO-DO-TITULO', 'text', { maxLength: 4 }),
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
    attr('f_nme_agencia', 'NOME-AGENCIA', 'text', { disabled: true, maxLength: 75 }),
    oneOf('f_titulo', TITLES, 254),
    oneOf('f_orient', ADVISORS, 60),
    attr('f_coorient', 'NOME-DO-CO-ORIENTADOR', 'text', { maxLength: 60 }),
    none('f_plv_l'),
    none('f_setor_l'),
    none('f_area_l'),
    {
      kind: 'select',
      name: 'f_tipo_privacidade',
      options: h.PRIVACY,
      read: (el) => state.privacy.get(el) ?? '1',
      write: (el, value) => state.privacy.set(el, value || '1'),
    },
    // A busca grava o código com a letra: V em f_cod_inst, as outras em f_cod_inst2.
    hiddenFrom('f_cod_inst', (el) => (inst(el).startsWith('V') ? inst(el) : ''), instWrite),
    hiddenFrom('f_cod_inst2', (el) => (inst(el).startsWith('V') ? '' : inst(el)), instWrite),
    hiddenFrom(
      'f_inst_old',
      (el) => getAttr(el, 'NOME-INSTITUICAO') ?? '',
      (el, v) => setIfKnown(el, 'NOME-INSTITUICAO', v),
    ),
    // O curso vai sem a letra: V em f_cod_curso, as outras em f_cod_curso2
    // (seção 18). A letra vem da lista de cursos do simulado; sem ela, D.
    hiddenFrom(
      'f_cod_curso',
      (el) => (courseLetter(el) === 'V' ? (getAttr(el, 'CODIGO-CURSO') ?? '') : ''),
      (el, v) => setIfKnown(el, 'CODIGO-CURSO', v),
    ),
    hiddenFrom(
      'f_cod_curso2',
      (el) => (courseLetter(el) === 'V' ? '' : (getAttr(el, 'CODIGO-CURSO') ?? '')),
      (el, v) => setIfKnown(el, 'CODIGO-CURSO', v),
    ),
    hiddenFrom(
      'f_curso_old',
      (el) => getAttr(el, 'NOME-CURSO') ?? '',
      (el, v) => setIfKnown(el, 'NOME-CURSO', v),
    ),
    // atribuir() grava o código; o nome, o servidor tira da lista (inferido).
    hiddenFrom(
      'f_agencia',
      (el) => getAttr(el, 'CODIGO-AGENCIA-FINANCIADORA') ?? '',
      (el, v) => {
        setIfKnown(el, 'CODIGO-AGENCIA-FINANCIADORA', v);
        setIfKnown(el, 'NOME-AGENCIA', AGENCIES.find(([c]) => c === v)?.[1] ?? '');
      },
    ),
    none('f_id_orientador'),
    none('f_seq_orientacao'),
    hiddenFrom(
      'f_carga',
      (el) => getAttr(el, 'CARGA-HORARIA') ?? '',
      (el, v) => setIfKnown(el, 'CARGA-HORARIA', v),
    ),
    fixed('f_ctr', ids.f_ctr ?? 'U'),
    fixed('f_cod', state.code),
    fixed('f_seq', ids.f_seq ?? ''),
    fixed('f_tipo', ids.f_tipo ?? 'FA'),
    fixed('f_nivel', ids.f_nivel ?? ''),
  ];
}

function items(state: LattesState, tipo: string): XElement[] {
  const container = state.find(['DADOS-GERAIS', 'FORMACAO-ACADEMICA-TITULACAO']);
  if (!container) return [];
  return childElements(container).filter((el) => AP_ELEMENTS.has(el.name) === (tipo === 'AP'));
}

const bySeq = (state: LattesState, seq: string | undefined) =>
  ['FA', 'AP']
    .flatMap((t) => items(state, t))
    .find((el) => getAttr(el, 'SEQUENCIA-FORMACAO') === seq);

function lista(req: SimRequest, state: LattesState): SimResponse {
  // Sem f_tipo, o gateway responde 404: a assinatura manda (seção 1).
  const tipo = req.get('f_tipo')?.toUpperCase();
  if (!tipo) return notFound(req.proc);
  const rows = items(state, tipo)
    .map(
      (el) =>
        `<tr><td><a href="#" onclick="self.parent.modalCV2.setarUrl('pkg_formacao.form?f_cod=${state.code}&amp;f_seq=${getAttr(el, 'SEQUENCIA-FORMACAO')}&amp;f_tipo=${tipo}',true); return false;">${h.esc(getAttr(el, 'NOME-CURSO') || getAttr(el, 'NOME-INSTITUICAO') || el.name)}</a></td></tr>`,
    )
    .join('\n');
  // selecionarNivel(): um combo do caixaMsg com a URL do formulário de cada nível.
  const levels = Object.keys(LEVELS)
    .map((n) => `'pkg_formacao.form?f_cod=${state.code}&f_tipo=FA&f_nivel=${n}'`)
    .join(',');
  const script = `<script>var niveis = [${levels}]; function selecionarNivel(){ var n = prompt('Nível (${Object.keys(LEVELS).join(', ')})'); var i = ${JSON.stringify(Object.keys(LEVELS))}.indexOf(n); if (i >= 0) self.parent.modalCV2.setarUrl(niveis[i], true); }</script>`;
  return html(
    h.page(
      'Formação acadêmica/titulação',
      `<table>${rows}</table>\n<p><a href="#" onclick="selecionarNivel(); return false;">Incluir novo item</a></p>${script}`,
    ),
  );
}

function form(req: SimRequest, state: LattesState): SimResponse {
  const seq = req.get('f_seq');
  const el = seq ? bySeq(state, seq) : undefined;
  if (seq && !el) return html(h.page('Formação', '<p>Registro não encontrado.</p>'));
  const nivel = el ? (getAttr(el, 'NIVEL') ?? '') : (req.get('f_nivel') ?? '');
  const ids = {
    f_ctr: el ? 'U' : 'I',
    f_nivel: nivel,
    f_seq: seq ?? '',
    f_tipo: req.get('f_tipo') ?? 'FA',
  };
  const body = `<form name="GN_FORMACAO2" method="post" action="pkg_formacao.FORM">
${renderFields(bindings(state, ids), el)}
<p><a href="#" onclick="self.parent.modalCV3.setarUrl('prc_inst_form?f_cod=${state.code}&amp;f_nivel=${nivel}',true); return false;">Buscar instituição</a></p>
${h.formButtons(Boolean(el))}
</form>
${h.formScripts('GN_FORMACAO2')}${el ? deleteScript(state, el, 'PKG_FORMACAO.SETA_ULTIMO_PUBLICO', 'Deseja realmente excluir esta formação acadêmica?') : ''}`;
  return html(h.page('Formação acadêmica/titulação', body));
}

/**
 * O del() das duas formações (seção 15, observado no código): com contPriv
 * "0", antes de excluir, um POST síncrono a SETA_ULTIMO_PUBLICO com f_op=E;
 * SETOU vira o aviso de que outra formação ficou pública, ULTIMO segue sem
 * aviso e outra resposta para com "Ocorreu um erro!". contPriv é aqui o
 * número das outras formações públicas (inferido).
 */
export function deleteScript(
  state: LattesState,
  el: XElement,
  seta: string,
  confirmText: string,
): string {
  const others = publicOthers(state, el).length;
  return `<script>var contPriv = "${others}";
function del(){ if (!confirm('${h.jsString(confirmText)}')) return;
  if (contPriv == "0") { var x = new XMLHttpRequest(); x.open('POST', '${seta}', false);
    x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    x.send('f_cod=' + dc.f_cod.value + '&f_seq=' + dc.f_seq.value + '&f_tipo=' + dc.f_tipo.value + '&f_op=E');
    var r = x.responseText.trim();
    if (r == 'SETOU') alert('É necessário que pelo menos uma formação acadêmica tenha visibilidade Público. Sua última formação acadêmica concluída foi alterada para Público.');
    else if (r != 'ULTIMO') { alert('Ocorreu um erro!'); return; } }
  dc.f_ctr.value = 'E'; enviar(); }</script>`;
}

/** As outras formações (acadêmicas e complementares) com visibilidade pública. */
function allFormations(state: LattesState): XElement[] {
  const fa = state.find(['DADOS-GERAIS', 'FORMACAO-ACADEMICA-TITULACAO']);
  const fc = state.find(['DADOS-COMPLEMENTARES', 'FORMACAO-COMPLEMENTAR']);
  return [...(fa ? childElements(fa) : []), ...(fc ? childElements(fc) : [])];
}

function publicOthers(state: LattesState, el: XElement): XElement[] {
  return allFormations(state).filter((f) => f !== el && (state.privacy.get(f) ?? '1') === '1');
}

/**
 * SETA_ULTIMO_PUBLICO com f_op=E (inferido além do nome e das respostas):
 * sem outra formação pública, a concluída mais recente entre as outras fica
 * pública e a resposta é SETOU; sem outra concluída, ULTIMO.
 */
export function setaUltimoPublico(req: SimRequest, state: LattesState): SimResponse {
  const el = allFormations(state).find(
    (f) => getAttr(f, 'SEQUENCIA-FORMACAO') === req.get('f_seq'),
  );
  if (!el || req.get('f_op') !== 'E') return { contentType: 'text/plain', html: 'ERRO' };
  if (publicOthers(state, el).length > 0) return { contentType: 'text/plain', html: 'ULTIMO' };
  const concluded = allFormations(state)
    .filter((f) => f !== el && getAttr(f, 'STATUS-DO-CURSO') === 'CONCLUIDO')
    .sort(
      (a, b) => Number(getAttr(b, 'ANO-DE-CONCLUSAO')) - Number(getAttr(a, 'ANO-DE-CONCLUSAO')),
    );
  const last = concluded[0];
  if (!last) return { contentType: 'text/plain', html: 'ULTIMO' };
  state.privacy.set(last, '1');
  return { contentType: 'text/plain', html: 'SETOU' };
}

function post(req: SimRequest, state: LattesState): SimResponse {
  const ctr = req.get('f_ctr');
  const back = h.savedScript(`pkg_formacao.lista?f_cod=${state.code}&f_tipo=FA`);
  const container = state.ensurePath(['DADOS-GERAIS', 'FORMACAO-ACADEMICA-TITULACAO']);
  if (ctr === 'I') {
    const nivel = req.get('f_nivel') ?? '';
    const name = LEVELS[nivel];
    if (!name) return html('<script>alert("Nível não informado.");</script>');
    const seq = String(
      Math.max(
        0,
        ...childElements(container).map((c) => Number(getAttr(c, 'SEQUENCIA-FORMACAO')) || 0),
      ) + 1,
    );
    // A instituição, o curso e a agência vêm das buscas, pelos ocultos.
    const el = element(name, { NIVEL: nivel, 'SEQUENCIA-FORMACAO': seq });
    applyFields(bindings(state, {}), el, req);
    insertInSchemaOrder(lattesSchema, container, el);
    state.touch();
    return html(back);
  }
  const el = bySeq(state, req.get('f_seq'));
  if (!el) return html(h.page('Formação', '<p>Registro não encontrado.</p>'));
  if (ctr === 'E') state.remove(container, el);
  else if (ctr === 'U') applyFields(bindings(state, {}), el, req);
  else return html(back);
  state.touch();
  return html(back);
}

export const FORMACAO_ROUTES: Routes = {
  'pkg_formacao.form': (req, state) =>
    req.method === 'POST' ? post(req, state) : form(req, state),
  'pkg_formacao.lista': lista,
  'pkg_formacao.seta_ultimo_publico': setaUltimoPublico,
};
