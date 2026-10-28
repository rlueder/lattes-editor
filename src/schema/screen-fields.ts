// Campos que as páginas do Lattes mostram e gravam, mas que a exportação não
// traz e o XSD não tem: nome social, visibilidade de cada dado, celular,
// validade do passaporte. O editor os guarda na própria cópia, como atributos
// do elemento a que pertencem com o prefixo "tela:" (tela:f_nome_social em
// DADOS-GERAIS), lidos dos formulários ao carregar do Lattes e gravados neles
// pelo conector como qualquer outro campo. Nenhum arquivo que sai do editor
// os leva: encodeCv (model/document.ts) os tira do XML salvo, do arquivo do
// Importar e do histórico.
//
// O nome do atributo é o nome do campo na página, sem o sufixo _i ou _r do
// endereço; o rótulo e as opções são os do formulário no censo
// (docs/lattes-formularios/). Onde o censo não achou rótulo para o campo
// (as listas de visibilidade ao lado de um dado), vale o texto que a página
// mostra ao lado delas, "Visibilidade".

import type { XDocument, XElement } from '../model/xml.ts';
import listas from './listas-lattes.json' with { type: 'json' };
import type { Choice } from './typed-choices.ts';

export const SCREEN_PREFIX = 'tela:';

export const isScreenAttr = (name: string): boolean => name.startsWith(SCREEN_PREFIX);

export interface ScreenField {
  /** O atributo na cópia do editor: tela: e o nome do campo. */
  attr: string;
  choices?: readonly Choice[];
  /** O campo do formulário em cada elemento onde ele mora. */
  fields: Readonly<Record<string, string>>;
  /** O rótulo da página do Lattes, no formulário do editor. */
  label: string;
  maxLength?: number;
  /** O valor com que a página vem (público, "Não"): na leitura, não aparece. */
  quiet?: string;
  /**
   * O nome na lista de alterações e na conferência do envio, onde o campo
   * aparece sem o grupo ao lado ("Visibilidade do nascimento"); sem ele, o rótulo.
   */
  review?: string;
}

/** Público ou privado: as listas f_priv_* da identificação e do endereço. */
const VISIBILITY: readonly Choice[] = [
  { label: 'Público', value: '1' },
  { label: 'Privado', value: '2' },
];

const YES_NO: readonly Choice[] = [
  { label: 'Não', value: 'N' },
  { label: 'Sim', value: 'S' },
];

/** A lista de países do Lattes, pelo código (fpaispassaporte, censo de 15/10/2026). */
const COUNTRIES: readonly Choice[] = Object.entries(listas.codigosDosPaises).map(
  ([label, value]) => ({ label, value }),
);

const IDENT = 'DADOS-GERAIS';
const PROJECT = 'PROJETO-DE-PESQUISA';
const WORK = 'ENDERECO-PROFISSIONAL';
const HOME = 'ENDERECO-RESIDENCIAL';

const ident = (
  field: string,
  label: string,
  extra: Partial<ScreenField> = {},
): ScreenField => ({ attr: `${SCREEN_PREFIX}${field}`, fields: { [IDENT]: field }, label, ...extra });

/** Um campo de um tipo de item só. */
const item = (
  element: string,
  field: string,
  label: string,
  extra: Partial<ScreenField> = {},
): ScreenField => ({ attr: `${SCREEN_PREFIX}${field}`, fields: { [element]: field }, label, ...extra });

/** No endereço, o mesmo campo com _i no profissional e _r no residencial. */
const address = (field: string, label: string, extra: Partial<ScreenField> = {}): ScreenField => ({
  attr: `${SCREEN_PREFIX}${field}`,
  fields: { [HOME]: `${field}_r`, [WORK]: `${field}_i` },
  label,
  ...extra,
});

/**
 * Os itens cujo formulário tem a lista f_tipo_privacidade (público ou
 * privado; o rótulo que o censo leu ao lado dela é a nota "Privado: As
 * informações não serão exibidas na consulta pública."), pelos elementos que
 * o censo ligou a cada formulário (docs/lattes-formularios/). Fora daqui, por
 * enquanto, as partes da atuação (atuação, vínculo, atividades), as
 * participações em eventos, o revisor e a assessoria, que o conector ainda
 * não liga a ela.
 */
const PRIVACY_ITEMS = [
  'PREMIO-TITULO',
  'IDIOMA',
  'LICENCA',
  'PROJETO-DE-PESQUISA',
  'ARTIGO-PUBLICADO',
  'ARTIGO-ACEITO-PARA-PUBLICACAO',
  'LIVRO-PUBLICADO-OU-ORGANIZADO',
  'CAPITULO-DE-LIVRO-PUBLICADO',
  'TRABALHO-EM-EVENTOS',
  'TEXTO-EM-JORNAL-OU-REVISTA',
  'TRADUCAO',
  'PARTITURA-MUSICAL',
  'PREFACIO-POSFACIO',
  'PATENTE',
  'SOFTWARE',
  'CULTIVAR-PROTEGIDA',
  'CULTIVAR-REGISTRADA',
  'DESENHO-INDUSTRIAL',
  'MARCA',
  'TOPOGRAFIA-DE-CIRCUITO-INTEGRADO',
  'PRODUTO-TECNOLOGICO',
  'PROCESSOS-OU-TECNICAS',
  'TRABALHO-TECNICO',
  'APRESENTACAO-DE-TRABALHO',
  'CARTA-MAPA-OU-SIMILAR',
  'CURSO-DE-CURTA-DURACAO-MINISTRADO',
  'DESENVOLVIMENTO-DE-MATERIAL-DIDATICO-OU-INSTRUCIONAL',
  'EDITORACAO',
  'MANUTENCAO-DE-OBRA-ARTISTICA',
  'MAQUETE',
  'ORGANIZACAO-DE-EVENTO',
  'PROGRAMA-DE-RADIO-OU-TV',
  'RELATORIO-DE-PESQUISA',
  'MIDIA-SOCIAL-WEBSITE-BLOG',
  'OUTRA-PRODUCAO-TECNICA',
  'ARTES-CENICAS',
  'MUSICA',
  'ARTES-VISUAIS',
  'OUTRA-PRODUCAO-ARTISTICA-CULTURAL',
  'ORIENTACOES-CONCLUIDAS-PARA-MESTRADO',
  'ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO',
  'ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO',
  'OUTRAS-ORIENTACOES-CONCLUIDAS',
  'ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO',
  'ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO',
  'ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO',
  'ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO',
  'ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO',
  'ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA',
  'OUTRAS-ORIENTACOES-EM-ANDAMENTO',
  'PARTICIPACAO-EM-BANCA-DE-MESTRADO',
  'PARTICIPACAO-EM-BANCA-DE-DOUTORADO',
  'PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO',
  'PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO',
  'PARTICIPACAO-EM-BANCA-DE-GRADUACAO',
  'OUTRAS-PARTICIPACOES-EM-BANCA',
  'BANCA-JULGADORA-PARA-PROFESSOR-TITULAR',
  'BANCA-JULGADORA-PARA-CONCURSO-PUBLICO',
  'BANCA-JULGADORA-PARA-LIVRE-DOCENCIA',
  'BANCA-JULGADORA-PARA-AVALIACAO-CURSOS',
  'OUTRAS-BANCAS-JULGADORAS',
  'DEMAIS-TRABALHOS',
  'GRADUACAO',
  'ESPECIALIZACAO',
  'MESTRADO',
  'MESTRADO-PROFISSIONALIZANTE',
  'DOUTORADO',
  'POS-DOUTORADO',
  'LIVRE-DOCENCIA',
  'CURSO-TECNICO-PROFISSIONALIZANTE',
  'ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU',
  'ENSINO-MEDIO-SEGUNDO-GRAU',
  'RESIDENCIA-MEDICA',
  'APERFEICOAMENTO',
];

/**
 * Participação em eventos: os campos ficam nos dados básicos de cada tipo,
 * a parte que o conector altera (edit-items.ts), como os outros do formulário.
 */
const EVENT_BASICS = [
  'CONGRESSO',
  'ENCONTRO',
  'EXPOSICAO',
  'FEIRA',
  'OFICINA',
  'OLIMPIADA',
  'SEMINARIO',
  'SIMPOSIO',
].map((t) => `DADOS-BASICOS-DA-PARTICIPACAO-EM-${t}`);
EVENT_BASICS.push('DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS');

export const SCREEN_FIELDS: readonly ScreenField[] = [
  // Identificação (prc_ident, GN_IDENT).
  ident('f_nome_social_r', 'Deseja utilizar o nome social?', { choices: YES_NO, quiet: 'N' }),
  ident('f_nome_social', 'Nome social', { maxLength: 60 }),
  ident('f_priv_foto', 'Foto de perfil', {
    choices: VISIBILITY,
    quiet: '1',
    review: 'Visibilidade da foto de perfil',
  }),
  ident('f_priv_cor', 'Visibilidade', { choices: VISIBILITY,
    quiet: '1', review: 'Visibilidade da cor ou raça' }),
  ident('f_priv_nascimento', 'Visibilidade', {
    choices: VISIBILITY,
    quiet: '1',
    review: 'Visibilidade do nascimento',
  }),
  ident('f_priv_identidade', 'Visibilidade', {
    choices: VISIBILITY,
    quiet: '1',
    review: 'Visibilidade da identidade',
  }),
  ident('f_priv_nacionalidade', 'Visibilidade', {
    choices: VISIBILITY,
    quiet: '1',
    review: 'Visibilidade da nacionalidade',
  }),
  ident('f_dta_emissao_doc', 'Data de emissão', {
    maxLength: 10,
    review: 'Data de emissão do passaporte',
  }),
  ident('f_dta_val_passaporte', 'Data de validade', {
    maxLength: 10,
    review: 'Validade do passaporte',
  }),
  ident('fpaispassaporte', 'Pais de emissão', {
    choices: COUNTRIES,
    review: 'País de emissão do passaporte',
  }),
  ident('f_priv_passaporte', 'Visibilidade', {
    choices: VISIBILITY,
    quiet: '1',
    review: 'Visibilidade do passaporte',
  }),
  ident('f_priv_pcd', 'Visibilidade', { choices: VISIBILITY,
    quiet: '1', review: 'Visibilidade da deficiência' }),
  // Endereço (prc_endereco, GN_ENDERECO).
  address('f_ddd_cel', 'DDD', { maxLength: 5, review: 'DDD do celular' }),
  address('f_fone_cel', 'Celular', { maxLength: 10 }),
  address('f_priv_email', 'Visibilidade', { choices: VISIBILITY,
    quiet: '1', review: 'Visibilidade do e-mail' }),
  // Cada item de produção, formação, prêmio, idioma e licença.
  {
    attr: `${SCREEN_PREFIX}f_tipo_privacidade`,
    choices: VISIBILITY,
    fields: Object.fromEntries(
      [...PRIVACY_ITEMS, ...EVENT_BASICS].map((el) => [el, 'f_tipo_privacidade']),
    ),
    label: 'Visibilidade',
    quiet: '1',
  },
  // Evento (PKG_EVENTO.FORM): o rádio f_classif, com as opções da lista L33
  // (docs/lattes-listas/captura-2026-10-13.json). O censo não leu rótulo para
  // ele; vale o do mesmo rádio no trabalho em eventos, onde o XSD o tem
  // (CLASSIFICACAO-DO-EVENTO).
  {
    attr: `${SCREEN_PREFIX}f_classif`,
    choices: [
      { label: 'Internacional', value: 'I' },
      { label: 'Nacional', value: 'N' },
      { label: 'Regional', value: 'R' },
      { label: 'Local', value: 'L' },
    ],
    fields: Object.fromEntries(EVENT_BASICS.map((el) => [el, 'f_classif'])),
    label: 'Classificação do evento',
  },
  // Projeto (pkg_projeto.form): a cooperação com empresa e os dados dela.
  item(PROJECT, 'f_tpo_pesq_emp', 'É um projeto de cooperação instituição de pesquisa e empresa?', {
    choices: [
      { label: 'Sim', value: 'S' },
      { label: 'Não', value: 'N' },
    ],
    quiet: 'N',
    review: 'Cooperação com empresa',
  }),
  item(PROJECT, 'f_cnpj_empresa', 'CNPJ da empresa', { maxLength: 18 }),
  item(PROJECT, 'f_txt_nme_empresa', 'Nome da empresa', { maxLength: 400 }),
  item(PROJECT, 'f_txt_email_institucional', 'E-mail Institucional', {
    maxLength: 400,
    review: 'E-mail institucional da empresa',
  }),
  item(PROJECT, 'f_txt_setor', 'Setor', { maxLength: 400, review: 'Setor da empresa' }),
  // Licença (pkg_licenca.form).
  item('LICENCA', 'f_dta_nasc_adoc', 'Data de nascimento/adoção', { maxLength: 10 }),
  // A do residencial é fixa em privado: a página a traz desabilitada.
  {
    attr: `${SCREEN_PREFIX}f_priv_profissional`,
    choices: VISIBILITY,
    fields: { [WORK]: 'f_priv_profissional' },
    label: 'Visibilidade',
    quiet: '1',
    review: 'Visibilidade do endereço',
  },
];

const byElement = new Map<string, ScreenField[]>();
for (const f of SCREEN_FIELDS) {
  for (const el of Object.keys(f.fields)) byElement.set(el, [...(byElement.get(el) ?? []), f]);
}

/** Os campos só de tela de um elemento, na ordem do registro. */
export const screenFieldsOf = (element: string): readonly ScreenField[] =>
  byElement.get(element) ?? [];

export const screenField = (element: string, attr: string): ScreenField | undefined =>
  byElement.get(element)?.find((f) => f.attr === attr);

/**
 * Campo só de tela que a cópia não tinha (vinda de uma exportação, que não o
 * traz): o editor não sabe o que o Lattes tem nele, e o plano não confere o
 * antes.
 */
export const unknownBefore = (f: { attr: string; before: string }): boolean =>
  isScreenAttr(f.attr) && f.before === '';

/** O rótulo do campo só de tela no formulário; o mesmo em todo elemento. */
export const screenLabel = (attr: string): string | undefined =>
  SCREEN_FIELDS.find((f) => f.attr === attr)?.label;

/** O valor com que a página do Lattes vem: a leitura o deixa de fora. */
export const isQuietScreenValue = (element: string, attr: string, value: string): boolean =>
  screenField(element, attr)?.quiet === value;

/** O nome do campo só de tela fora do formulário (lista de alterações, conferência). */
export function screenReviewLabel(attr: string): string | undefined {
  const f = SCREEN_FIELDS.find((x) => x.attr === attr);
  return f && (f.review ?? f.label);
}

/** O valor de um campo só de tela como se lê ("Privado" no lugar de 2). */
export function screenValueLabel(element: string, attr: string, value: string): string {
  return screenField(element, attr)?.choices?.find((c) => c.value === value)?.label ?? value;
}

/** Campo do formulário → nome e opções, para a conferência do envio (field-labels.ts). */
export const SCREEN_FORM_LABELS: Record<string, string> = {};
export const SCREEN_FORM_VALUES: Record<string, Record<string, string>> = {};
for (const f of SCREEN_FIELDS) {
  for (const field of Object.values(f.fields)) {
    SCREEN_FORM_LABELS[field] = f.review ?? f.label;
    if (f.choices && f.choices !== COUNTRIES) {
      SCREEN_FORM_VALUES[field] = Object.fromEntries(f.choices.map((c) => [c.value, c.label]));
    }
  }
}

/** Atributo → [campo, conversor] de um elemento, para as tabelas do conector. */
export function screenTable(element: string): Record<string, [string, (v: string) => string]> {
  return Object.fromEntries(
    screenFieldsOf(element).map((f) => [f.attr, [f.fields[element]!, (v: string) => v]]),
  );
}

/**
 * Campos só de tela que outro campo abre: o nome social só com "Deseja
 * utilizar o nome social?" em Sim, como na página.
 */
export const SCREEN_SWITCHES: Readonly<Record<string, [string, string[]][]>> = {
  [IDENT]: [[`${SCREEN_PREFIX}f_nome_social_r`, [`${SCREEN_PREFIX}f_nome_social`]]],
  // Os dados da empresa só com a cooperação marcada (inferido pelos rótulos).
  [PROJECT]: [
    [
      `${SCREEN_PREFIX}f_tpo_pesq_emp`,
      ['f_cnpj_empresa', 'f_txt_nme_empresa', 'f_txt_email_institucional', 'f_txt_setor'].map(
        (f) => `${SCREEN_PREFIX}${f}`,
      ),
    ],
  ],
};

function strip(el: XElement): void {
  el.attrs = el.attrs.filter((a) => !isScreenAttr(a.name));
  for (const c of el.children) if (c.kind === 'element') strip(c);
}

/** Uma cópia do documento sem os campos só de tela: o que sai do editor. */
export function withoutScreenAttrs(doc: XDocument): XDocument {
  const copy = structuredClone(doc);
  strip(copy.root);
  return copy;
}
