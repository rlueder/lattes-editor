// A ligação campo do formulário ↔ atributo do XML quando a passada de edição
// (link.ts) ainda não a observou: primeiro o que docs/lattes_internals.md
// registra, depois um palpite pelo nome do campo. O relatório marca de onde
// veio cada uma: "documentado" é a tabela da seção com a coluna XML, sem a
// marca de inferido; o resto é "inferido".

import type { Provenance } from './targets.ts';

export type LinkSource = 'documentado' | Provenance;

export interface KnownLink {
  /** Atributo, com o elemento quando o nome se repete no item (ELEMENTO@ATRIBUTO). */
  attribute: string;
  field: string;
  source: LinkSource;
}

const doc = (field: string, attribute: string): KnownLink => ({
  attribute,
  field,
  source: 'documentado',
});
const guess = (field: string, attribute: string): KnownLink => ({
  attribute,
  field,
  source: 'inferido',
});
/** Confirmada pela passada de edição de 15/10/2026 (docs/lattes-formularios/). */
const seen = (field: string, attribute: string): KnownLink => ({
  attribute,
  field,
  source: 'observado',
});

/** Os do endereço residencial que a passada de edição de 15/10/2026 confirmou. */
const RESIDENTIAL_SEEN = new Set([
  'f_bairro',
  'f_ddd',
  'f_estado',
  'f_fone',
  'f_homepage',
  'f_munic',
]);

/**
 * Endereço (seção 19): sufixo _i no profissional, _r no residencial; ligação
 * inferida, menos a confirmada em 15/10/2026.
 */
function address(): KnownLink[] {
  const pairs: [string, string][] = [
    ['f_cep', 'CEP'],
    ['f_bairro', 'BAIRRO'],
    ['f_munic', 'CIDADE'],
    ['f_estado', 'UF'],
    ['f_ddd', 'DDD'],
    ['f_fone', 'TELEFONE'],
    ['f_ramal', 'RAMAL'],
    ['f_fax', 'FAX'],
    ['f_caixa', 'CAIXA-POSTAL'],
    ['f_email', 'E-MAIL'],
    ['f_homepage', 'HOME-PAGE'],
  ];
  return [
    ...pairs.flatMap(([f, a]) => [
      (f === 'f_email' ? seen : guess)(`${f}_i`, `ENDERECO-PROFISSIONAL@${a}`),
      (RESIDENTIAL_SEEN.has(f) ? seen : guess)(`${f}_r`, `ENDERECO-RESIDENCIAL@${a}`),
    ]),
    guess('f_rua_i', 'ENDERECO-PROFISSIONAL@LOGRADOURO-COMPLEMENTO'),
    seen('f_rua_r', 'ENDERECO-RESIDENCIAL@LOGRADOURO'),
    seen('f_pais_r', 'ENDERECO-RESIDENCIAL@PAIS'),
    guess('f_inst', 'ENDERECO-PROFISSIONAL@NOME-INSTITUICAO-EMPRESA'),
    guess('f_orgao', 'ENDERECO-PROFISSIONAL@NOME-ORGAO'),
  ];
}

/** Formação acadêmica e pós-doutorado (seções 5, 17 e 19). */
const FORMATION: KnownLink[] = [
  doc('F_STATUS', 'STATUS-DO-CURSO'),
  doc('f_tpo_doutorado', 'TIPO-MESTRADO'),
  guess('f_tpo_doutorado', 'TIPO-DOUTORADO'),
  seen('f_ano_ini', 'ANO-DE-INICIO'),
  seen('f_ano_fim', 'ANO-DE-CONCLUSAO'),
  guess('f_ano_obten', 'ANO-DE-OBTENCAO-DO-TITULO'),
  seen('f_inst', 'NOME-INSTITUICAO'),
  seen('f_curso', 'NOME-CURSO'),
  guess('f_nme_agencia', 'NOME-AGENCIA'),
  seen('F_BOLSA', 'FLAG-BOLSA'),
  guess('f_titulo', 'TITULO-DA-DISSERTACAO-TESE'),
  seen('f_titulo', 'TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO'),
  guess('f_titulo', 'TITULO-DA-MONOGRAFIA'),
  seen('f_orient', 'NOME-COMPLETO-DO-ORIENTADOR'),
  seen('f_orient', 'NOME-DO-ORIENTADOR'),
  guess('f_coorient', 'NOME-DO-CO-ORIENTADOR'),
];

/**
 * Por entrada (id, ou prefixo seguido de "-"). Seções 5, 16, 17 e 19 de
 * lattes_internals.md.
 */
export const KNOWN_LINKS: Record<string, KnownLink[]> = {
  endereco: address(),
  evento: [
    seen('F_FORMA', 'FORMA-PARTICIPACAO'),
    guess('F_TPO', 'TIPO-PARTICIPACAO'),
    doc('f_nme_evento', 'NOME-DO-EVENTO'),
    doc('f_ano', 'ANO'),
    seen('f_cidade', 'CIDADE-DO-EVENTO'),
    doc('f_pais', 'PAIS'),
    doc('f_homepage', 'HOME-PAGE-DO-TRABALHO'),
    doc('f_titulo', 'TITULO'),
    doc('F_STA_DIVULGACAO_CIENTIFICA', 'FLAG-DIVULGACAO-CIENTIFICA'),
    doc('f_titulo_en', 'TITULO-INGLES'),
  ],
  'formacao-AP': FORMATION,
  'formacao-complementar': [doc('f_nivel', 'NIVEL')],
  'formacao-FA': FORMATION,
  identificacao: [guess('f_nome', 'NOME-COMPLETO'), doc('f_nacionalidade', 'NACIONALIDADE')],
  idioma: [
    doc('F_COD_IDIOMA', 'IDIOMA'),
    doc('F_LE', 'PROFICIENCIA-DE-LEITURA'),
    doc('F_CONVERSA', 'PROFICIENCIA-DE-FALA'),
    doc('F_ESCREVE', 'PROFICIENCIA-DE-ESCRITA'),
    doc('F_COMPR', 'PROFICIENCIA-DE-COMPREENSAO'),
  ],
  projeto: [
    doc('f_titulo', 'PROJETO-DE-PESQUISA@NOME-DO-PROJETO'),
    doc('f_titulo_en', 'PROJETO-DE-PESQUISA@NOME-DO-PROJETO-INGLES'),
    doc('f_ref', 'PROJETO-DE-PESQUISA@DESCRICAO-DO-PROJETO'),
    doc('f_ref_en', 'PROJETO-DE-PESQUISA@DESCRICAO-DO-PROJETO-INGLES'),
    doc('F_TPO_NATUREZA', 'PROJETO-DE-PESQUISA@NATUREZA'),
    doc('F_TPO_SITUACAO', 'PROJETO-DE-PESQUISA@SITUACAO'),
    doc('F_ANO_INIC', 'PROJETO-DE-PESQUISA@ANO-INICIO'),
    doc('F_ANO_FIM', 'PROJETO-DE-PESQUISA@ANO-FIM'),
    doc('F_NRO_GRADUACAO', 'PROJETO-DE-PESQUISA@NUMERO-GRADUACAO'),
    guess('F_NRO_ESPECIALIZACAO', 'PROJETO-DE-PESQUISA@NUMERO-ESPECIALIZACAO'),
    guess('F_NRO_MESTRADO_ACAD', 'PROJETO-DE-PESQUISA@NUMERO-MESTRADO-ACADEMICO'),
    guess('F_NRO_MESTRADO_PROF', 'PROJETO-DE-PESQUISA@NUMERO-MESTRADO-PROF'),
    guess('F_NRO_DOUTORADO', 'PROJETO-DE-PESQUISA@NUMERO-DOUTORADO'),
    doc('f_sta_inovacao', 'PROJETO-DE-PESQUISA@FLAG-POTENCIAL-INOVACAO'),
  ],
  resumo: [doc('F_TEXTO', 'TEXTO-RESUMO-CV-RH'), doc('F_TEXTO_EN', 'TEXTO-RESUMO-CV-RH-EN')],
  vinculo: [
    doc('f_vinc', 'TIPO-DE-VINCULO'),
    doc('f_stavinc', 'FLAG-VINCULO-EMPREGATICIO'),
    doc('f_enqua', 'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO'),
    doc('f_enqua_en', 'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO-INGLES'),
    doc('f_carga', 'CARGA-HORARIA-SEMANAL'),
    doc('f_regime', 'FLAG-DEDICACAO-EXCLUSIVA'),
    doc('f_mes_ini', 'MES-INICIO'),
    doc('f_ano_ini', 'ANO-INICIO'),
    doc('f_mes_fim', 'MES-FIM'),
    doc('f_ano_fim', 'ANO-FIM'),
    doc('f_outras_inf', 'OUTRAS-INFORMACOES'),
    doc('f_outras_inf_en', 'OUTRAS-INFORMACOES-INGLES'),
  ],
};

/** As ligações conhecidas de uma entrada (pelo id ou pelo prefixo). */
export function knownLinks(targetId: string): KnownLink[] {
  return Object.entries(KNOWN_LINKS)
    .filter(([key]) => targetId === key || targetId.startsWith(`${key}-`))
    .flatMap(([, links]) => links);
}

/**
 * As grades das produções viram um oculto cada (seção 16): os nomes dos
 * ocultos são observados; que cada um grave esse elemento é inferido.
 */
export const GRID_FIELDS: Record<string, string> = {
  'AREA-DO-CONHECIMENTO-1': 'f_area_l',
  'AREA-DO-CONHECIMENTO-2': 'f_area_l',
  'AREA-DO-CONHECIMENTO-3': 'f_area_l',
  AUTORES: 'f_autores_l',
  'PALAVRAS-CHAVE': 'f_plv_l',
  'SETORES-DE-ATIVIDADE': 'f_setor_l',
};

/** Abreviações dos nomes de campo do Lattes → partes do nome do atributo. */
const SYNONYMS: Record<string, string[]> = {
  caixa: ['CAIXA', 'POSTAL'],
  coorient: ['CO', 'ORIENTADOR'],
  disp: ['DISPONIBILIDADE'],
  email: ['E', 'MAIL'],
  en: ['INGLES'],
  estado: ['UF'],
  fone: ['TELEFONE'],
  homepage: ['HOME', 'PAGE'],
  ini: ['INICIO'],
  inic: ['INICIO'],
  munic: ['CIDADE'],
  nme: ['NOME'],
  nro: ['NUMERO'],
  plv: ['PALAVRA'],
  ref: ['DESCRICAO'],
  relev: ['RELEVANCIA'],
  rua: ['LOGRADOURO'],
  sta: ['FLAG'],
  tpo: ['TIPO'],
};

/** Palavras do nome do atributo que não dizem nada sozinhas. */
const STOP = new Set(['A', 'DA', 'DAS', 'DE', 'DO', 'DOS', 'E', 'EM', 'O', 'OU', 'PARA']);

/** Campos de controle: nunca ligados pelo nome. */
const CONTROL = /^f_(cod|ctr|seq\w*|ret|tipo_privacidade|priv\w*)$/i;

const attrTokens = (attr: string) =>
  attr
    .replace(/-(EN)$/, '-INGLES')
    .split(/[-_]/)
    .filter((t) => t && !STOP.has(t));

function fieldTokens(field: string): string[] | undefined {
  const parts = field.toLowerCase().split('_').filter(Boolean);
  if (parts[0] === 'f' || parts[0] === 'fc') parts.shift();
  if (!parts.length) return undefined;
  return parts.flatMap((p) => SYNONYMS[p] ?? [p.toUpperCase()]);
}

/**
 * O atributo que o nome do campo sugere, entre os do item: todas as partes do
 * campo precisam aparecer no atributo (por prefixo, de 3 letras ou mais), e
 * ganha o atributo com menos partes sobrando. Empate não liga.
 */
export function guessByName(field: string, attributes: readonly string[]): string | undefined {
  if (CONTROL.test(field)) return undefined;
  const want = fieldTokens(field);
  if (!want) return undefined;
  const english = want.includes('INGLES');
  let best: { attr: string; extra: number } | undefined;
  let tie = false;
  for (const attr of attributes) {
    const have = attrTokens(attr);
    if (english !== have.includes('INGLES')) continue;
    const used = new Set<number>();
    const ok = want.every((w) => {
      const i = have.findIndex(
        (h, k) => !used.has(k) && (h === w || (w.length >= 3 && h.startsWith(w))),
      );
      if (i < 0) return false;
      used.add(i);
      return true;
    });
    if (!ok) continue;
    const extra = have.length - used.size;
    if (!best || extra < best.extra) {
      best = { attr, extra };
      tie = false;
    } else if (extra === best.extra) tie = true;
  }
  return best && !tie ? best.attr : undefined;
}
