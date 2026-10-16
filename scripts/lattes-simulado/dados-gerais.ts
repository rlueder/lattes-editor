// Idiomas, resumo, endereço e identificação no Lattes simulado. Os nomes dos
// formulários, campos, tipos e limites são os de docs/lattes_internals.md,
// seção 5 (observados); a correspondência de cada campo com o atributo do XML
// é a mesma que o conector usa (src/bridge/plan.ts e biographic.ts), em boa
// parte inferida.

import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { applyFields, attr, type Binding, fixed, mapped, renderFields } from './campos.ts';
import type { LattesState } from './estado.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

const LEVEL: Record<string, string> = { BEM: 'B', POUCO: 'P', RAZOAVELMENTE: 'R' };
const SKILLS: [string, string][] = [
  ['LE', 'PROFICIENCIA-DE-LEITURA'],
  ['CONVERSA', 'PROFICIENCIA-DE-FALA'],
  ['ESCREVE', 'PROFICIENCIA-DE-ESCRITA'],
  ['COMPR', 'PROFICIENCIA-DE-COMPREENSAO'],
];
const LEVELS = h.capturedList('L25');

const languageName = (code: string) => h.LANGUAGES.find(([c]) => c === code)?.[1] ?? code;

function idiomas(state: LattesState): XElement[] {
  const container = state.find(['DADOS-GERAIS', 'IDIOMAS']);
  return container ? childElements(container, 'IDIOMA') : [];
}

const privacy = (state: LattesState): Binding => ({
  kind: 'select',
  name: 'f_tipo_privacidade',
  options: h.PRIVACY,
  read: (el) => state.privacy.get(el) ?? '1',
  write: (el, value) => state.privacy.set(el, value || '1'),
});

/** GN_IDIOMA: o rádio diz o nível e a caixa diz que a habilidade foi informada. */
function idiomaBindings(state: LattesState, seq: string, ctr: string, codes: [string, string][]) {
  const list: Binding[] = [
    fixed('f_cod', state.code),
    fixed('f_seq', seq),
    fixed('f_ctr', ctr),
    {
      kind: 'select',
      name: 'F_COD_IDIOMA',
      options: codes,
      read: (el) => getAttr(el, 'IDIOMA') ?? '',
      write: (el, value) => {
        setAttr(el, 'IDIOMA', value);
        setAttr(el, 'DESCRICAO-DO-IDIOMA', languageName(value));
      },
    },
  ];
  for (const [skill, attrName] of SKILLS) {
    list.push(mapped(`F_${skill}`, attrName, 'radio', LEVEL, { options: LEVELS }));
    list.push({
      kind: 'checkbox',
      name: `FC_${skill}`,
      read: (el) => (LEVEL[getAttr(el, attrName) ?? ''] ? 'on' : ''),
      value: 'on',
      // Caixa desmarcada: habilidade não informada, seja qual for o rádio.
      write: (el, value) => {
        if (!value) setAttr(el, attrName, '');
      },
    });
  }
  list.push(privacy(state));
  return list;
}

function idiomaLista(state: LattesState): SimResponse {
  const rows = idiomas(state)
    .map(
      (el) =>
        `<tr><td><a href="#" onclick="self.parent.modalCV2.setarUrl('pkg_idioma.form?f_cod=${state.code}&amp;f_seq=${state.idOf(el)}',true); return false;">${h.esc(getAttr(el, 'DESCRICAO-DO-IDIOMA') ?? '')}</a></td></tr>`,
    )
    .join('\n');
  const novo = `<a href="#" onclick="self.parent.modalCV2.setarUrl('pkg_idioma.form?f_cod=${state.code}',true); return false;">Incluir novo item</a>`;
  return html(h.page('Idiomas', `<table>${rows}</table>\n<p>${novo}</p>`));
}

function idiomaForm(req: SimRequest, state: LattesState): SimResponse {
  const seq = req.get('f_seq');
  const el = seq ? idiomas(state).find((i) => state.idOf(i) === seq) : undefined;
  if (seq && !el) return html(h.page('Idiomas', '<p>Registro não encontrado.</p>'));
  // Inferido da captura de 13/10/2026: a lista da inclusão começa vazia e não
  // traz os idiomas já cadastrados.
  const taken = new Set(idiomas(state).map((i) => getAttr(i, 'IDIOMA')));
  const codes: [string, string][] = el
    ? h.LANGUAGES
    : [['', ''], ...h.LANGUAGES.filter(([c]) => !taken.has(c))];
  const bindings = idiomaBindings(state, seq ?? '', el ? 'U' : 'I', codes);
  const body = `<form name="GN_IDIOMA" method="post" action="PKG_IDIOMA.FORM">
${renderFields(bindings, el)}
${h.formButtons(Boolean(el))}
</form>
${h.formScripts('GN_IDIOMA', el ? '\n\nVocê realmente deseja excluir este Idioma?\n\n' : undefined)}`;
  return html(h.page('Idioma', body));
}

function idiomaPost(req: SimRequest, state: LattesState): SimResponse {
  const ctr = req.get('f_ctr');
  const back = h.savedScript(`pkg_idioma.lista?f_cod=${state.code}`);
  if (ctr === 'I') {
    // A página só oferece idiomas ainda não cadastrados; um envio montado fora
    // dela com código vazio ou repetido é recusado sem gravar (inferido).
    const code = req.get('F_COD_IDIOMA') ?? '';
    const known = h.LANGUAGES.some(([c]) => c === code);
    if (!known || idiomas(state).some((i) => getAttr(i, 'IDIOMA') === code)) {
      return html('<script>alert("Escolha um idioma ainda não cadastrado.");</script>');
    }
    const container = state.ensurePath(['DADOS-GERAIS', 'IDIOMAS']);
    const el = element('IDIOMA');
    container.children.push(el);
    container.selfClosing = false;
    applyFields(idiomaBindings(state, '', 'I', h.LANGUAGES), el, req);
    state.touch();
    return html(back);
  }
  const el = idiomas(state).find((i) => state.idOf(i) === req.get('f_seq'));
  if (!el) return html(h.page('Idiomas', '<p>Registro não encontrado.</p>'));
  if (ctr === 'E') state.remove(state.find(['DADOS-GERAIS', 'IDIOMAS'])!, el);
  else if (ctr === 'U') applyFields(idiomaBindings(state, '', 'U', h.LANGUAGES), el, req);
  else return html(back);
  state.touch();
  return html(back);
}

// ---------------------------------------------------------------- resumo

function resumoBindings(state: LattesState): Binding[] {
  return [
    attr('F_TEXTO', 'TEXTO-RESUMO-CV-RH', 'textarea', { maxLength: 4000 }),
    attr('F_TEXTO_EN', 'TEXTO-RESUMO-CV-RH-EN', 'textarea', { maxLength: 4000 }),
    fixed('f_resume_auto', ''),
    fixed('f_resume_auto_en', ''),
    fixed('f_cod', state.code),
    fixed('f_ret', ''),
    fixed('f_ctr', 'U'),
  ];
}

const resumo = (state: LattesState) => state.ensure(state.general, 'RESUMO-CV');

function resumoForm(_req: SimRequest, state: LattesState): SimResponse {
  const body = `<form name="RES" method="post" action="PKG_RESUME.FORM">
${renderFields(resumoBindings(state), resumo(state))}
${h.formButtons(false)}
</form>${h.formScripts('RES')}`;
  return html(h.page('Resumo', body));
}

function resumoPost(req: SimRequest, state: LattesState): SimResponse {
  if (req.get('f_ctr') !== 'U') return html(h.savedScript('pkg_resume.prc_resume'));
  applyFields(resumoBindings(state), resumo(state), req);
  state.touch();
  return html(h.savedScript(`pkg_resume.prc_resume?f_cod=${state.code}`));
}

// ---------------------------------------------------------------- endereço

const ADDRESS: [string, string][] = [
  ['_i', 'ENDERECO-PROFISSIONAL'],
  ['_r', 'ENDERECO-RESIDENCIAL'],
];

/** Campo → atributo, sem o sufixo; o logradouro tem um nome em cada elemento. */
const ADDRESS_FIELDS: [string, string, number?][] = [
  ['f_cep', 'CEP', 15],
  ['f_bairro', 'BAIRRO', 255],
  ['f_munic', 'CIDADE', 45],
  ['f_estado', 'UF', 10],
  ['f_ddd', 'DDD', 5],
  ['f_fone', 'TELEFONE', 10],
  ['f_ramal', 'RAMAL', 5],
  ['f_fax', 'FAX', 10],
  ['f_caixa', 'CAIXA-POSTAL', 10],
  ['f_email', 'E-MAIL', 70],
  ['f_homepage', 'HOME-PAGE', 250],
];

function addressBindings(suffix: string, element: string): Binding[] {
  const street = element === 'ENDERECO-PROFISSIONAL' ? 'LOGRADOURO-COMPLEMENTO' : 'LOGRADOURO';
  return [
    attr(`f_rua${suffix}`, street, 'text', { maxLength: 180 }),
    ...ADDRESS_FIELDS.map(([field, attrName, max]) =>
      attr(`${field}${suffix}`, attrName, 'text', max ? { maxLength: max } : {}),
    ),
  ];
}

const PRIVACY: [string, string][] = [
  ['1', 'Público'],
  ['2', 'Privado'],
];

/**
 * Os controles do formulário que o simulado não liga ao XML, como o censo de
 * 15/10/2026 os leu: o país, o celular, a visibilidade, o endereço de
 * correspondência e os campos de controle da página.
 */
function addressExtras(suffix: string): string {
  return [
    h.select(`f_pais${suffix}`, [['BRA', 'Brasil']], 'BRA'),
    h.text(`f_ddd_cel${suffix}`, '', { maxLength: 5 }),
    h.text(`f_fone_cel${suffix}`, '', { maxLength: 10 }),
    h.select(`f_priv_email${suffix}`, PRIVACY, '1'),
    ...['f_cidade', 'f_cod_munic'].map((n) => h.hidden(`${n}${suffix}`, '')),
    ...['f_munic', 'f_estado', 'f_pais'].map((n) => h.hidden(`${n}${suffix}_old`, '')),
  ].join('\n');
}

const FORM_EXTRAS = [
  h.radios(
    'f_end_corr',
    [
      ['R', 'utilizar este endereço para correspondência'],
      ['I', 'utilizar este endereço para correspondência'],
    ],
    'I',
  ),
  h.select('f_priv_residencial', PRIVACY, '2', { disabled: true }),
  h.select('f_priv_profissional', PRIVACY, '1'),
  h.text('f_inst', '', { disabled: true, maxLength: 75 }),
  h.text('f_orgao', '', { disabled: true }),
  ...[
    'modal2',
    'f_dados_grid',
    'f_dados_grid_contatos',
    'f_origem',
    'f_cod',
    'f_cod_inst',
    'f_cod_inst2',
    'f_codorgao',
    'f_codorgao2',
    'f_inst_old',
    'f_orgao_old',
  ].map((n) => h.hidden(n, '')),
].join('\n');

function enderecoForm(_req: SimRequest, state: LattesState): SimResponse {
  const container = state.find(['DADOS-GERAIS', 'ENDERECO']);
  const blocks = ADDRESS.map(([suffix, name]) => {
    const el = container && childElements(container, name)[0];
    return `<fieldset><legend>${suffix === '_i' ? 'Profissional' : 'Residencial'}</legend>${renderFields(addressBindings(suffix, name), el ?? element(name))}\n${addressExtras(suffix)}</fieldset>`;
  }).join('\n');
  const body = `<form name="GN_ENDERECO" method="post" action="PRC_ENDERECO">
${blocks}
${FORM_EXTRAS}
${h.hidden('f_ctr', 'U')}
${h.formButtons(false)}
</form>${h.formScripts('GN_ENDERECO')}`;
  return html(h.page('Endereço', body));
}

function enderecoPost(req: SimRequest, state: LattesState): SimResponse {
  if (req.get('f_ctr') !== 'U') return html(h.savedScript('prc_endereco'));
  for (const [suffix, name] of ADDRESS) {
    const bindings = addressBindings(suffix, name);
    const container = state.find(['DADOS-GERAIS', 'ENDERECO']);
    let el = container && childElements(container, name)[0];
    // Bloco que não existe no XML e veio vazio continua sem existir.
    if (!el && bindings.every((b) => !req.get(b.name))) continue;
    el ??= state.ensure(state.ensurePath(['DADOS-GERAIS', 'ENDERECO']), name);
    applyFields(bindings, el, req);
  }
  state.touch();
  return html(h.savedScript(`prc_endereco?f_cod=${state.code}`));
}

// ---------------------------------------------------------------- identificação

/**
 * Só os campos com nome lido no HTML (seção 5): o nome, a nacionalidade, que
 * a página preenche por JavaScript, e f_ctr. Os outros (CPF, nome em
 * citações, nascimento, documentos) existem no Lattes com nomes não anotados e
 * ficam de fora do simulado.
 */
function identBindings(): Binding[] {
  return [
    attr('f_nome', 'NOME-COMPLETO', 'text', { maxLength: 60 }),
    attr('f_nacionalidade', 'NACIONALIDADE', 'hidden'),
    fixed('f_ctr', 'U'),
  ];
}

/**
 * Os outros controles da identificação, como o censo de 15/10/2026 os leu,
 * vazios: o simulado não os liga ao XML. A caixa f_pcd vem antes do oculto de
 * mesmo nome, como no Lattes.
 */
const IDENT_EXTRAS = [
  ...['f_priv_foto', 'f_pais_nacio', 'f_priv_nacionalidade', 'fnro_id_raca_cor', 'f_priv_cor'],
  ...['f_pais_nasc', 'f_uf_nasc', 'f_priv_nascimento', 'f_uf_rg', 'f_priv_identidade'],
  ...['fpaispassaporte', 'f_priv_passaporte', 'f_priv_pcd'],
]
  .map((n) => h.select(n, PRIVACY, '1'))
  .concat(
    h.radios('f_nome_social_r', [['N', 'Não']], 'N'),
    h.text('f_nome_social', '', { maxLength: 60 }),
    h.radios('f_sexo', [['M', 'Masculino']], ''),
    h.text('f_cidade_nasc', '', { maxLength: 30 }),
    h.text('f_dta_nasc', '', { maxLength: 10 }),
    h.text('f_rg_nro', '', { maxLength: 15 }),
    h.text('f_orgao_rg', '', { maxLength: 8 }),
    h.text('f_dta_rg', '', { maxLength: 10 }),
    h.text('f_passaporte', '', { maxLength: 20 }),
    h.text('f_dta_val_passaporte', '', { maxLength: 10 }),
    h.text('f_dta_emissao_doc', '', { maxLength: 10 }),
    h.radios('f_pcd_r', [['N', 'Não']], 'N'),
    h.checkbox('f_pcd', 'S', false),
    ...['f_dados_grid', 'f_nome_citacao', 'f_nome_citacao_h', 'fdados_new', 'f_cpf'].map((n) =>
      h.hidden(n, ''),
    ),
    ...['f_nome_pai', 'f_nome_mae', 'f_pcd', 'f_cod', 'f_nme_old'].map((n) => h.hidden(n, '')),
  )
  .join('\n');

function identForm(_req: SimRequest, state: LattesState): SimResponse {
  const body = `<form name="GN_IDENT" method="post" action="PRC_IDENT">
${renderFields(identBindings(), state.general)}
${IDENT_EXTRAS}
${h.formButtons(false)}
</form>${h.formScripts('GN_IDENT')}`;
  return html(h.page('Identificação', body));
}

function identPost(req: SimRequest, state: LattesState): SimResponse {
  if (req.get('f_ctr') === 'U') {
    applyFields(identBindings(), state.general, req);
    state.touch();
  }
  return html(h.savedScript(`prc_ident?f_cod=${state.code}`));
}

export const DADOS_GERAIS_ROUTES: Routes = {
  'pkg_idioma.form': (req, state) =>
    req.method === 'POST' ? idiomaPost(req, state) : idiomaForm(req, state),
  'pkg_idioma.lista': (_req, state) => idiomaLista(state),
  'pkg_resume.form': (req, state) =>
    req.method === 'POST' ? resumoPost(req, state) : resumoForm(req, state),
  'pkg_resume.prc_resume': resumoForm,
  prc_endereco: (req, state) =>
    req.method === 'POST' ? enderecoPost(req, state) : enderecoForm(req, state),
  prc_ident: (req, state) =>
    req.method === 'POST' ? identPost(req, state) : identForm(req, state),
};
