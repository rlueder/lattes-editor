// Rótulos pt-BR para elementos, atributos e valores de enum.
//
// pt-BR.json tem os rótulos escritos à mão (os nomes de seção e de módulo do
// próprio Lattes). O resto sai do nome XML: "TITULO-DO-TRABALHO" vira
// "Título do trabalho". O XML não tem acentos, então um dicionário de palavras
// devolve a grafia correta; palavra fora do dicionário sai sem acento.

import labels from './pt-BR.json' with { type: 'json' };

const ELEMENTS: Record<string, string> = labels.elements;
const ATTRIBUTES: Record<string, string> = labels.attributes;
const ENUMS: Record<string, string> = labels.enums;

const ACCENTED: Record<string, string> = {
  academica: 'acadêmica',
  adicionais: 'adicionais',
  administracao: 'administração',
  agencia: 'agência',
  agrarias: 'agrárias',
  ambito: 'âmbito',
  aperfeicoamento: 'aperfeiçoamento',
  apresentacao: 'apresentação',
  area: 'área',
  areas: 'áreas',
  artistica: 'artística',
  artistico: 'artístico',
  atuacao: 'atuação',
  atuacoes: 'atuações',
  avaliacao: 'avaliação',
  basicos: 'básicos',
  bibliografica: 'bibliográfica',
  biologicas: 'biológicas',
  capitulo: 'capítulo',
  capitulos: 'capítulos',
  cenicas: 'cênicas',
  ciencias: 'ciências',
  cientifica: 'científica',
  cientifico: 'científico',
  citacao: 'citação',
  citacoes: 'citações',
  classificacao: 'classificação',
  codigo: 'código',
  comissao: 'comissão',
  compreensao: 'compreensão',
  concessao: 'concessão',
  concluida: 'concluída',
  concluidas: 'concluídas',
  concluido: 'concluído',
  conclusao: 'conclusão',
  conferencia: 'conferência',
  deposito: 'depósito',
  descricao: 'descrição',
  didatico: 'didático',
  direcao: 'direção',
  divulgacao: 'divulgação',
  docencia: 'docência',
  duracao: 'duração',
  economica: 'econômica',
  edicao: 'edição',
  editoracao: 'editoração',
  eletronico: 'eletrônico',
  emissao: 'emissão',
  endereco: 'endereço',
  especializacao: 'especialização',
  estagio: 'estágio',
  exposicao: 'exposição',
  extensao: 'extensão',
  fasciculo: 'fascículo',
  formacao: 'formação',
  graduacao: 'graduação',
  horaria: 'horária',
  identificacao: 'identificação',
  informacao: 'informação',
  informacoes: 'informações',
  ingles: 'inglês',
  inicio: 'início',
  inovacao: 'inovação',
  instituicao: 'instituição',
  instituicoes: 'instituições',
  licenca: 'licença',
  licencas: 'licenças',
  linguistica: 'linguística',
  localizacao: 'localização',
  mae: 'mãe',
  medio: 'médio',
  mes: 'mês',
  midia: 'mídia',
  musica: 'música',
  nao: 'não',
  nivel: 'nível',
  numero: 'número',
  olimpiada: 'olimpíada',
  orgao: 'órgão',
  orientacao: 'orientação',
  orientacoes: 'orientações',
  pagina: 'página',
  paginas: 'páginas',
  pais: 'país',
  participacao: 'participação',
  participacoes: 'participações',
  periodico: 'periódico',
  periodo: 'período',
  permissao: 'permissão',
  portugues: 'português',
  pos: 'pós',
  posfacio: 'posfácio',
  prefacio: 'prefácio',
  preferencia: 'preferência',
  premios: 'prêmios',
  producao: 'produção',
  producoes: 'produções',
  proficiencia: 'proficiência',
  publicacao: 'publicação',
  publico: 'público',
  qualificacao: 'qualificação',
  raca: 'raça',
  radio: 'rádio',
  realizacao: 'realização',
  relevancia: 'relevância',
  responsavel: 'responsável',
  sanduiche: 'sanduíche',
  saude: 'saúde',
  seminario: 'seminário',
  sequencia: 'sequência',
  serie: 'série',
  servico: 'serviço',
  simposio: 'simpósio',
  situacao: 'situação',
  tecnica: 'técnica',
  tecnicas: 'técnicas',
  tecnico: 'técnico',
  tecnicos: 'técnicos',
  tecnologica: 'tecnológica',
  tecnologico: 'tecnológico',
  titulacao: 'titulação',
  titulo: 'título',
  titulos: 'títulos',
  traducao: 'tradução',
  varios: 'vários',
  veiculo: 'veículo',
  vinculo: 'vínculo',
  vinculos: 'vínculos',
};

const ACRONYMS: Record<string, string> = {
  cep: 'CEP',
  cnpq: 'CNPq',
  cpf: 'CPF',
  doi: 'DOI',
  id: 'ID',
  isbn: 'ISBN',
  issn: 'ISSN',
  oasisbr: 'OasisBR',
  orcid: 'ORCID',
  pcd: 'PcD',
  uf: 'UF',
  url: 'URL',
  xml: 'XML',
};

/**
 * Sufixos regulares do português, para palavras fora do dicionário:
 * organizacao → organização, sessoes → sessões, extensao → extensão,
 * frequencia → frequência, relevancia → relevância.
 */
function accentSuffix(word: string): string {
  return word
    .replace(/cao$/, 'ção')
    .replace(/coes$/, 'ções')
    .replace(/sao$/, 'são')
    .replace(/soes$/, 'sões')
    .replace(/encia$/, 'ência')
    .replace(/encias$/, 'ências')
    .replace(/ancia$/, 'ância')
    .replace(/ancias$/, 'âncias');
}

function humanize(xmlName: string): string {
  const words = xmlName.toLowerCase().split(/[-_]/).filter(Boolean);
  const out = words.map((w) => ACRONYMS[w] ?? ACCENTED[w] ?? accentSuffix(w));
  if (out.length === 0) return xmlName;
  const first = out[0]!;
  out[0] = ACRONYMS[words[0]!] ? first : first.charAt(0).toUpperCase() + first.slice(1);
  return out.join(' ');
}

export function elementLabel(name: string): string {
  return ELEMENTS[name] ?? humanize(name);
}

export function attributeLabel(name: string): string {
  // "Flag bolsa" diz menos que "Bolsa"; o campo já aparece como sim/não.
  return ATTRIBUTES[name] ?? humanize(name.replace(/^FLAG-/, ''));
}

export function enumLabel(value: string): string {
  // Código curto sem rótulo conhecido (NIVEL-CURSO="OT") fica cru: humanizar
  // daria "Ot", que parece palavra e não diz nada.
  if (!ENUMS[value] && /^[A-Z]{1,3}$/.test(value) && !ACRONYMS[value.toLowerCase()]) return value;
  return ENUMS[value] ?? humanize(value);
}

/** Remove acentos e caixa, para busca. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Trecho de URL legível: "Artigos completos publicados" → "artigos-completos-publicados". */
export function slugify(text: string): string {
  return fold(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Rótulo de um atributo dentro de um elemento, para os nomes que mudam de
 * sentido conforme o lugar: IDIOMA é o código no bloco de idiomas e o nome
 * do idioma numa produção.
 */
const IN_ELEMENT: Record<string, string> = {
  'IDIOMA IDIOMA': 'Código do idioma',
};

export function attributeLabelIn(element: string, name: string): string {
  return IN_ELEMENT[`${element} ${name}`] ?? attributeLabel(name);
}
