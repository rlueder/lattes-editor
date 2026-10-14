// Formação acadêmica no Lattes simulado: a lista (pkg_formacao.lista, com
// f_tipo), o formulário GN_FORMACAO2 de alteração e de inclusão, e o POST
// pkg_formacao.FORM com f_ctr U, I ou E. Campos da seção 17 de
// docs/lattes_internals.md (observados no mestrado); o simulado usa os mesmos
// campos em todos os níveis, o que o Lattes não faz (a tabela da seção 17
// mostra o que muda por nível).

import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
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

function oneOf(name: string, candidates: string[], max: number): Binding {
  return {
    kind: 'text',
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

function bindings(state: LattesState, ids: Record<string, string>): Binding[] {
  const none = (name: string, kind: Binding['kind'] = 'hidden'): Binding => ({
    kind,
    name,
    read: () => '',
  });
  return [
    {
      ...none('f_tpo_doutorado', 'radio'),
      options: [
        ['N', 'Normal'],
        ['S', 'Sanduíche'],
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
    ...[
      'f_cod_inst',
      'f_cod_inst2',
      'f_inst_old',
      'f_cod_curso',
      'f_cod_curso2',
      'f_curso_old',
      'f_agencia',
      'f_id_orientador',
      'f_seq_orientacao',
      'f_carga',
    ].map((n) => none(n)),
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
${h.formScripts('GN_FORMACAO2', el ? 'Deseja realmente excluir esta formação acadêmica?' : undefined)}`;
  return html(h.page('Formação acadêmica/titulação', body));
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
    // A instituição e o curso vêm das buscas: o código com a letra (seção 18).
    const el = element(name, {
      'CODIGO-CURSO': req.get('f_cod_curso') || req.get('f_cod_curso2') || '',
      'CODIGO-INSTITUICAO': req.get('f_cod_inst') || req.get('f_cod_inst2') || '',
      NIVEL: nivel,
      'NOME-CURSO': req.get('f_curso_old') ?? '',
      'NOME-INSTITUICAO': req.get('f_inst_old') ?? '',
      'SEQUENCIA-FORMACAO': seq,
    });
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
};
