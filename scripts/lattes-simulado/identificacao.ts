// Identificação (prc_ident, GN_IDENT) e outras informações relevantes
// (prc_outras_inf, GN_OUTRA_INF_RELEV) no Lattes simulado. Os campos, os tipos,
// os limites e as opções são os do censo de 15/10/2026
// (docs/lattes-formularios/). A ligação de cada campo com o atributo do XML é
// a mesma que o conector usa (src/bridge/dados-gerais-edit.ts), escrita aqui
// com mapas literais próprios, para que um confira o outro. Onde ela é
// inferida, o comentário de lá diz.

import { element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { applyFields, attr, type Binding, fixed, mapped, renderFields } from './campos.ts';
import type { LattesState } from './estado.ts';
import { capturedForm, capturedOptions } from './formulario-censo.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

const IDENT = capturedForm('identificacao');

/** As opções de um campo da identificação, como o censo as leu. */
const optionsOf = (name: string): [string, string][] => {
  const field = IDENT.fields.find((f) => f.name === name);
  return field ? capturedOptions(field) : [];
};

const maxOf = (name: string) => IDENT.fields.find((f) => f.name === name)?.maxLength;

const text = (name: string, attrName: string) =>
  attr(name, attrName, 'text', { maxLength: maxOf(name) });

/** País pelo nome no XML, código na lista. */
function countryBinding(name: string, attrName: string): Binding {
  return {
    kind: 'select',
    name,
    options: optionsOf(name),
    read: (el) => h.countryCode(getAttr(el, attrName)),
    write: (el, value) => setAttr(el, attrName, h.countryName(value)),
  };
}

/** Data DDMMAAAA no XML, DD/MM/AAAA no campo. */
function dateBinding(name: string, attrName: string): Binding {
  return {
    kind: 'text',
    maxLength: maxOf(name),
    name,
    read: (el) => (getAttr(el, attrName) ?? '').replace(/^(\d{2})(\d{2})(\d{4})$/, '$1/$2/$3'),
    write: (el, value) => setAttr(el, attrName, value.replace(/\//g, '')),
  };
}

/** O que o XML guarda para cada opção de cor ou raça (o rótulo, inferido). */
const RACE: Record<string, string> = {
  AMARELA: '5',
  BRANCA: '1',
  INDIGENA: '4',
  NAO_DESEJO_DECLARAR: '6',
  PARDA: '3',
  PRETA: '2',
};

/** Os campos ligados ao XML. Os ocultos de CPF e dos pais se leem e não se gravam. */
function identBindings(): Binding[] {
  return [
    text('f_nome', 'NOME-COMPLETO'),
    attr('f_nome_citacao', 'NOME-EM-CITACOES-BIBLIOGRAFICAS', 'hidden'),
    {
      kind: 'hidden',
      name: 'f_nome_citacao_h',
      read: (el) => getAttr(el, 'NOME-EM-CITACOES-BIBLIOGRAFICAS') ?? '',
    },
    attr('f_nacionalidade', 'NACIONALIDADE', 'hidden'),
    {
      kind: 'select',
      name: 'f_pais_nacio',
      options: optionsOf('f_pais_nacio'),
      read: (el) => getAttr(el, 'SIGLA-PAIS-NACIONALIDADE') ?? '',
      write: (el, value) => {
        setAttr(el, 'SIGLA-PAIS-NACIONALIDADE', value);
        setAttr(el, 'PAIS-DE-NACIONALIDADE', h.countryName(value));
      },
    },
    mapped(
      'f_sexo',
      'SEXO',
      'radio',
      { FEMININO: 'F', MASCULINO: 'M' },
      { options: optionsOf('f_sexo') },
    ),
    mapped(
      'fnro_id_raca_cor',
      'RACA-OU-COR',
      'select',
      { '': '', ...RACE },
      {
        options: optionsOf('fnro_id_raca_cor'),
      },
    ),
    countryBinding('f_pais_nasc', 'PAIS-DE-NASCIMENTO'),
    { ...attr('f_uf_nasc', 'UF-NASCIMENTO', 'select'), options: optionsOf('f_uf_nasc') },
    text('f_cidade_nasc', 'CIDADE-NASCIMENTO'),
    dateBinding('f_dta_nasc', 'DATA-NASCIMENTO'),
    text('f_rg_nro', 'NUMERO-IDENTIDADE'),
    text('f_orgao_rg', 'ORGAO-EMISSOR'),
    { ...attr('f_uf_rg', 'UF-ORGAO-EMISSOR', 'select'), options: optionsOf('f_uf_rg') },
    dateBinding('f_dta_rg', 'DATA-DE-EMISSAO'),
    text('f_passaporte', 'NUMERO-DO-PASSAPORTE'),
    ...(
      [
        ['f_cpf', 'CPF'],
        ['f_nome_pai', 'NOME-DO-PAI'],
        ['f_nome_mae', 'NOME-DA-MAE'],
      ] as const
    ).map(([name, attrName]): Binding => ({
      kind: 'hidden',
      name,
      read: (el) => getAttr(el, attrName) ?? '',
    })),
    fixed('f_ctr', 'U'),
  ];
}

const PRIVACY = h.PRIVACY;

/**
 * Os campos da identificação sem atributo no XML (nome social, visibilidade
 * de cada dado, validade e país do passaporte), guardados ao lado de
 * DADOS-GERAIS como o Lattes os guarda fora da exportação. Os valores de
 * partida são os da página no censo de 15/10/2026: público e "Não".
 */
function screenBindings(state: LattesState): Binding[] {
  const stored = (name: string, initial: string) => ({
    read: (el: XElement) => state.formOnly(el)[name] ?? initial,
    write: (el: XElement, value: string) => {
      state.formOnly(el)[name] = value;
    },
  });
  const privacy = (name: string): Binding => ({
    kind: 'select',
    name,
    options: PRIVACY,
    ...stored(name, '1'),
  });
  const text = (name: string): Binding => ({
    kind: 'text',
    maxLength: maxOf(name),
    name,
    ...stored(name, ''),
  });
  return [
    ...['f_priv_foto', 'f_priv_nacionalidade', 'f_priv_cor', 'f_priv_nascimento'].map(privacy),
    privacy('f_priv_identidade'),
    {
      kind: 'select',
      name: 'fpaispassaporte',
      options: optionsOf('fpaispassaporte'),
      ...stored('fpaispassaporte', ''),
    },
    ...['f_priv_passaporte', 'f_priv_pcd'].map(privacy),
    {
      kind: 'radio',
      name: 'f_nome_social_r',
      options: optionsOf('f_nome_social_r'),
      ...stored('f_nome_social_r', 'N'),
    },
    text('f_nome_social'),
    text('f_dta_val_passaporte'),
    text('f_dta_emissao_doc'),
  ];
}

/**
 * Os outros controles da identificação, como o censo de 15/10/2026 os leu.
 * O oculto f_pcd vem antes da caixa de mesmo nome, como no Lattes.
 */
const IDENT_EXTRAS = [
  h.radios('f_pcd_r', optionsOf('f_pcd_r'), 'N'),
  h.hidden('f_pcd', ''),
  h.checkbox('f_pcd', 'S', false),
  ...['f_dados_grid', 'fdados_new', 'f_cod', 'f_nme_old'].map((n) => h.hidden(n, '')),
].join('\n');

/**
 * As grades que o check() da página real serializa (18/10/2026): a do ORCID
 * (provider2, vazia aqui) e a dos nomes em citação (providerDetNmeCit), uma
 * linha por nome de NOME-EM-CITACOES-BIBLIOGRAFICAS.
 */
function identScripts(general: XElement): string {
  const names = (getAttr(general, 'NOME-EM-CITACOES-BIBLIOGRAFICAS') ?? '')
    .split(';')
    .map((n) => n.trim())
    .filter(Boolean)
    .map((l) => ({ c: l, l }));
  return `<script>
var provider2 = [{}];
var providerDetNmeCit =
${JSON.stringify([...names, {}])};
</script>`;
}

function identForm(_req: SimRequest, state: LattesState): SimResponse {
  const body = `<form name="GN_IDENT" method="post" action="PRC_IDENT">
${renderFields([...identBindings(), ...screenBindings(state)], state.general)}
${IDENT_EXTRAS}
${h.formButtons(false)}
</form>${identScripts(state.general)}${h.formScripts('GN_IDENT')}`;
  return html(h.page('Identificação', body));
}

function identPost(req: SimRequest, state: LattesState): SimResponse {
  // Como o Lattes real (18/10/2026): sem o XML da grade do ORCID, recusa tudo.
  if (req.get('f_ctr') === 'U' && !(req.get('f_dados_grid') ?? '').startsWith('<root>')) {
    return html(
      h.page('Identificação', '<p>erro. ORA-19032: Era esperado o identificador de XML</p>'),
    );
  }
  if (req.get('f_ctr') === 'U') {
    applyFields([...identBindings(), ...screenBindings(state)], state.general, req);
    state.touch();
  }
  return html(h.savedScript(`prc_ident?f_cod=${state.code}`));
}

// ---------------------------------------------------------------- outras informações

const others = (state: LattesState): XElement =>
  state.ensure(state.general, 'OUTRAS-INFORMACOES-RELEVANTES');

const othersBindings = (state: LattesState): Binding[] => [
  attr('F_TEXTO', 'OUTRAS-INFORMACOES-RELEVANTES', 'textarea', { maxLength: 2000 }),
  fixed('f_cod', state.code),
  fixed('f_ctr', 'U'),
];

function othersForm(_req: SimRequest, state: LattesState): SimResponse {
  const body = `<form name="GN_OUTRA_INF_RELEV" method="post" action="PRC_OUTRAS_INF">
${renderFields(othersBindings(state), state.find(['DADOS-GERAIS', 'OUTRAS-INFORMACOES-RELEVANTES']) ?? element('OUTRAS-INFORMACOES-RELEVANTES'))}
${h.formButtons(false)}
</form>${h.formScripts('GN_OUTRA_INF_RELEV')}`;
  return html(h.page('Outras informações relevantes', body));
}

function othersPost(req: SimRequest, state: LattesState): SimResponse {
  if (req.get('f_ctr') === 'U') {
    applyFields(othersBindings(state), others(state), req);
    state.touch();
  }
  return html(h.savedScript(`prc_outras_inf?f_cod=${state.code}`));
}

export const IDENTIFICACAO_ROUTES: Routes = {
  prc_ident: (req, state) =>
    req.method === 'POST' ? identPost(req, state) : identForm(req, state),
  prc_outras_inf: (req, state) =>
    req.method === 'POST' ? othersPost(req, state) : othersForm(req, state),
};
