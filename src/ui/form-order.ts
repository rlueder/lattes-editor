// Ordem dos campos nos formulários do editor, tirada dos formulários do
// próprio Lattes quando ela é conhecida (docs/lattes_internals.md, seções 5,
// 16 e 17), para quem vem do Lattes achar cada campo onde espera. Os grupos
// saem dessa ordem: cada um é um trecho seguido do formulário do Lattes, com
// um título nosso. Um campo do XML que o formulário do Lattes não tem vai
// para "Outros dados", e nunca para um grupo por semelhança de nome.
//
// A ligação entre o campo do formulário e o atributo do XML vem das tabelas
// das seções 5, 16 e 17 quando elas têm a coluna XML (evento, vínculo,
// idioma, projeto). Na formação, no prêmio, no endereço e na identificação,
// as seções listam os campos do formulário sem essa coluna, e a ligação é
// pelo nome (f_inst e NOME-INSTITUICAO, f_ano e ANO-DA-PREMIACAO); fica
// marcada como inferida em cada uma.

export interface FormGroup {
  attrs: string[];
  label: string;
}

/** Grupo dos campos do XML que o formulário do Lattes não tem. */
export const OTHER_DATA = 'Outros dados';

/** As versões em inglês que o formulário do Lattes não tem, à parte de "Outros dados". */
export const IN_ENGLISH = 'Em inglês';

/** Versão em inglês de outro campo (TITULO-DO-TRABALHO-INGLES, TEXTO-RESUMO-CV-RH-EN). */
export function isEnglishAttr(attr: string): boolean {
  return /-(INGLES|EN)$/.test(attr);
}

/**
 * Participação em evento, GN_TEC / PKG_EVENTO.FORM (seção 16): forma,
 * tipo, nome do evento, ano, classificação (sem atributo no XSD), natureza,
 * cidade, país, página, título, divulgação científica, título em inglês.
 * A natureza do XML fica onde o formulário pede a natureza (F_COD_PROD),
 * que lá escolhe o tipo de evento: posição inferida.
 */
const EVENT: FormGroup[] = [
  {
    attrs: ['FORMA-PARTICIPACAO', 'TIPO-PARTICIPACAO', 'NOME-DO-EVENTO', 'ANO', 'NATUREZA'],
    label: 'Principal',
  },
  { attrs: ['CIDADE-DO-EVENTO', 'PAIS'], label: 'Local' },
  {
    attrs: ['HOME-PAGE-DO-TRABALHO', 'TITULO', 'FLAG-DIVULGACAO-CIENTIFICA', 'TITULO-INGLES'],
    label: 'Trabalho apresentado',
  },
];

/**
 * Formação acadêmica, pkg_formacao.FORM (seção 17, base do mestrado):
 * tipo, instituição, curso, situação, início, fim, obtenção do título,
 * bolsa, agência, título do trabalho, orientador, coorientador, e os campos
 * do sanduíche e da cotutela. Ligação pelo nome do campo: inferida, menos
 * situação e tipo do mestrado (seção 5).
 */
const FORMATION: FormGroup[] = [
  {
    attrs: [
      'TIPO-MESTRADO',
      'TIPO-DOUTORADO',
      'TIPO-GRADUACAO',
      'NOME-INSTITUICAO',
      'NOME-ORGAO',
      'NOME-CURSO',
      // Especialização e aperfeiçoamento: no Lattes a carga horária vem logo
      // depois do curso (censo de 18/10/2026).
      'CARGA-HORARIA',
    ],
    label: 'Curso',
  },
  {
    attrs: [
      'STATUS-DO-CURSO',
      'STATUS-DO-ESTAGIO',
      'ANO-DE-INICIO',
      'ANO-DE-CONCLUSAO',
      'ANO-DE-OBTENCAO-DO-TITULO',
    ],
    label: 'Situação e período',
  },
  { attrs: ['FLAG-BOLSA', 'NOME-AGENCIA'], label: 'Bolsa' },
  {
    attrs: [
      'TITULO-DA-DISSERTACAO-TESE',
      'TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO',
      'TITULO-DA-MONOGRAFIA',
      'TITULO-DO-TRABALHO',
      'NOME-COMPLETO-DO-ORIENTADOR',
      'NOME-DO-ORIENTADOR',
      'NOME-DO-CO-ORIENTADOR',
    ],
    label: 'Trabalho e orientação',
  },
  {
    attrs: [
      'NOME-INSTITUICAO-DOUT',
      'NOME-INSTITUICAO-OUTRA-DOUT',
      'NOME-ORIENTADOR-DOUT',
      'NOME-INSTITUICAO-GRAD',
      'NOME-INSTITUICAO-OUTRA-GRAD',
      'NOME-ORIENTADOR-GRAD',
      'NOME-DO-ORIENTADOR-SANDUICHE',
      'NOME-DO-ORIENTADOR-CO-TUTELA',
    ],
    label: 'Sanduíche e cotutela',
  },
];

/** Prêmios e títulos, pkg_premio.form (seção 16): título, entidade promotora, ano. Inferida pelo nome. */
const PRIZE: FormGroup[] = [
  {
    attrs: ['NOME-DO-PREMIO-OU-TITULO', 'NOME-DA-ENTIDADE-PROMOTORA', 'ANO-DA-PREMIACAO'],
    label: 'Principal',
  },
];

/** Idioma, PKG_IDIOMA.FORM (seção 5): idioma, lê, fala, escreve, compreende. */
const LANGUAGE: FormGroup[] = [
  { attrs: ['DESCRICAO-DO-IDIOMA', 'IDIOMA'], label: 'Idioma' },
  {
    attrs: [
      'PROFICIENCIA-DE-LEITURA',
      'PROFICIENCIA-DE-FALA',
      'PROFICIENCIA-DE-ESCRITA',
      'PROFICIENCIA-DE-COMPREENSAO',
    ],
    label: 'Proficiência',
  },
];

/**
 * Endereço, PRC_ENDERECO (seção 5): instituição e órgão do institucional,
 * depois país, CEP, rua, bairro, município, estado, DDD, telefone, ramal,
 * fax, caixa postal, página e e-mail. Inferida pelo nome do campo.
 */
const ADDRESS: FormGroup[] = [
  { attrs: ['NOME-INSTITUICAO-EMPRESA', 'NOME-ORGAO', 'NOME-UNIDADE'], label: 'Instituição' },
  {
    attrs: ['PAIS', 'CEP', 'LOGRADOURO-COMPLEMENTO', 'LOGRADOURO', 'BAIRRO', 'CIDADE', 'UF'],
    label: 'Localização',
  },
  {
    attrs: ['DDD', 'TELEFONE', 'RAMAL', 'FAX', 'CAIXA-POSTAL', 'HOME-PAGE', 'E-MAIL'],
    label: 'Contato',
  },
];

/** Bloco ENDERECO: preferência de correspondência (f_end_corr) e contatos. */
const ADDRESS_BLOCK: FormGroup[] = [
  { attrs: ['FLAG-DE-PREFERENCIA'], label: 'Preferência' },
  { attrs: ['ELETRONICO', 'REDE-SOCIAL', 'OUTRA-FORMA-DE-CONTATO'], label: 'Contatos' },
];

/**
 * Identificação, PRC_IDENT: a ordem da página no censo LAT-55
 * (docs/lattes-formularios/): nome, nascimento, RG, nacionalidade e CPF,
 * pais. Os campos que o censo não liga (sexo, raça ou cor, passaporte,
 * deficiência) ficam junto do assunto deles.
 */
const IDENTIFICATION: FormGroup[] = [
  {
    attrs: ['NOME-COMPLETO', 'NOME-EM-CITACOES-BIBLIOGRAFICAS', 'SEXO', 'RACA-OU-COR'],
    label: 'Identificação',
  },
  {
    attrs: ['PAIS-DE-NASCIMENTO', 'UF-NASCIMENTO', 'CIDADE-NASCIMENTO', 'DATA-NASCIMENTO'],
    label: 'Nascimento',
  },
  {
    attrs: ['NUMERO-IDENTIDADE', 'ORGAO-EMISSOR', 'UF-ORGAO-EMISSOR', 'DATA-DE-EMISSAO'],
    label: 'Documentos',
  },
  {
    attrs: ['NACIONALIDADE', 'PAIS-DE-NACIONALIDADE', 'CPF', 'NUMERO-DO-PASSAPORTE'],
    label: 'Nacionalidade',
  },
  { attrs: ['NOME-DO-PAI', 'NOME-DA-MAE'], label: 'Filiação' },
  { attrs: ['PCD'], label: 'Deficiência' },
];

/**
 * Vínculo de uma atuação, PKG_ATIV.VINCULOS (seção 5, com a coluna XML); as
 * versões em inglês no fim, como na página capturada no censo LAT-55.
 */
const BOND: FormGroup[] = [
  {
    attrs: [
      'TIPO-DE-VINCULO',
      'OUTRO-VINCULO-INFORMADO',
      'FLAG-VINCULO-EMPREGATICIO',
      'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO',
      'CARGA-HORARIA-SEMANAL',
      'FLAG-DEDICACAO-EXCLUSIVA',
    ],
    label: 'Vínculo',
  },
  { attrs: ['MES-INICIO', 'ANO-INICIO', 'MES-FIM', 'ANO-FIM'], label: 'Período' },
  { attrs: ['OUTRAS-INFORMACOES'], label: 'Outras informações' },
  {
    attrs: ['OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO-INGLES', 'OUTRAS-INFORMACOES-INGLES'],
    label: 'Em inglês',
  },
];

/**
 * Projeto de pesquisa, PKG_PROJETO.FORM (seção 17, com a coluna XML), na
 * ordem da página capturada no censo LAT-55: nome, natureza, situação, anos,
 * inovação, alunos e, por fim, as versões em inglês.
 */
const PROJECT: FormGroup[] = [
  { attrs: ['NOME-DO-PROJETO', 'DESCRICAO-DO-PROJETO'], label: 'Projeto' },
  { attrs: ['NATUREZA', 'SITUACAO', 'ANO-INICIO', 'ANO-FIM'], label: 'Situação e período' },
  { attrs: ['FLAG-POTENCIAL-INOVACAO'], label: 'Inovação' },
  {
    attrs: [
      'NUMERO-GRADUACAO',
      'NUMERO-ESPECIALIZACAO',
      'NUMERO-MESTRADO-ACADEMICO',
      'NUMERO-MESTRADO-PROF',
      'NUMERO-DOUTORADO',
    ],
    label: 'Alunos envolvidos',
  },
  { attrs: ['NOME-DO-PROJETO-INGLES', 'DESCRICAO-DO-PROJETO-INGLES'], label: 'Em inglês' },
];

/** Resumo, PKG_RESUME.FORM (seção 5): o texto e o texto em inglês. */
const RESUME: FormGroup[] = [
  { attrs: ['TEXTO-RESUMO-CV-RH', 'TEXTO-RESUMO-CV-RH-EN'], label: 'Resumo' },
];

/**
 * Os campos que o formulário do Lattes mostra, nos formulários em que essa
 * lista foi conferida campo a campo. Os outros atributos do XML desses
 * elementos não aparecem no editor enquanto estão vazios.
 *
 * Pós-doutorado: pkg_formacao.form com f_tipo=AP e f_nivel=5, lido em
 * 15/10/2026. Título do trabalho e ano de obtenção vão ocultos no formulário;
 * status do estágio e as versões em inglês não existem nele.
 */
const FORM_FIELDS: Record<string, ReadonlySet<string>> = {
  'POS-DOUTORADO': new Set([
    'NOME-INSTITUICAO',
    'STATUS-DO-CURSO',
    'ANO-DE-INICIO',
    'ANO-DE-CONCLUSAO',
    'FLAG-BOLSA',
    'NOME-AGENCIA',
  ]),
};

/** Atributo fora do formulário do Lattes, num formulário conferido: some quando vazio. */
export function offForm(element: string, attr: string): boolean {
  const fields = FORM_FIELDS[element];
  return fields !== undefined && !fields.has(attr);
}

const FORMATION_LEVELS =
  /^(GRADUACAO|ESPECIALIZACAO|MESTRADO|DOUTORADO|POS-DOUTORADO|LIVRE-DOCENCIA|CURSO-TECNICO-PROFISSIONALIZANTE|MESTRADO-PROFISSIONALIZANTE|ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU|ENSINO-MEDIO-SEGUNDO-GRAU|RESIDENCIA-MEDICA|APERFEICOAMENTO)$/;

/** O formulário do Lattes que corresponde a um elemento, se a ordem dele é conhecida. */
export function formLayout(element: string): FormGroup[] | undefined {
  if (/^(DADOS-BASICOS|DETALHAMENTO)-DA-PARTICIPACAO-EM-(?!BANCA)/.test(element)) return EVENT;
  if (FORMATION_LEVELS.test(element)) return FORMATION;
  switch (element) {
    case 'PREMIO-TITULO':
      return PRIZE;
    case 'IDIOMA':
      return LANGUAGE;
    case 'ENDERECO-PROFISSIONAL':
    case 'ENDERECO-RESIDENCIAL':
      return ADDRESS;
    case 'ENDERECO':
      return ADDRESS_BLOCK;
    case 'DADOS-GERAIS':
      return IDENTIFICATION;
    case 'VINCULOS':
      return BOND;
    case 'PROJETO-DE-PESQUISA':
      return PROJECT;
    case 'RESUMO-CV':
      return RESUME;
    default:
      return undefined;
  }
}

/** Grupo e posição de um campo no formulário do Lattes; undefined fora dele. */
export function formSlot(
  element: string,
  attr: string,
): { label: string; rank: number } | undefined {
  const layout = formLayout(element);
  if (!layout) return undefined;
  let rank = 0;
  for (const group of layout) {
    const i = group.attrs.indexOf(attr);
    if (i >= 0) return { label: group.label, rank: rank + i };
    rank += group.attrs.length;
  }
  return undefined;
}

/** Os tipos que o formulário da formação usa para mostrar o sanduíche e a cotutela. */
const FORMATION_TYPES = ['TIPO-GRADUACAO', 'TIPO-MESTRADO', 'TIPO-DOUTORADO'];

/**
 * Campos que o formulário do Lattes mostra ou esconde por outro campo: na
 * formação, o tipo (f_tpo_doutorado: normal, sanduíche, cotutela) abre os
 * campos do sanduíche e da cotutela (seção 17, blocos lblDoutorado,
 * lblMesesSW1, lblDoutoradoCT). Devolve [campo que decide, campos que ele
 * abre].
 */
export function formSwitches(element: string): [string, string[]][] {
  if (!FORMATION_LEVELS.test(element)) return [];
  const switched = FORMATION.find((g) => g.label === 'Sanduíche e cotutela')!.attrs;
  return FORMATION_TYPES.map((t) => [t, switched]);
}
