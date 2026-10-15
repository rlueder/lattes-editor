// Os gráficos do Panorama: nome no menu, a pergunta que cada um responde, de
// onde vêm os dados e o que fica de fora. A ordem é a do menu lateral.

export type FilterKind = 'grupo' | 'janela' | 'laco' | 'nivel' | 'periodo' | 'repetidos' | 'vista';

export interface ChartInfo {
  filters: FilterKind[];
  /** O que fica de fora sem dado externo. */
  gaps: string;
  id: string;
  label: string;
  /** Uma frase sob o título, como a nota de uma seção. */
  question: string;
  /** Campos do XML usados. */
  sources: string;
}

export const CHARTS: ChartInfo[] = [
  {
    filters: ['periodo'],
    gaps: 'Citações e índice h precisam de dado externo por produção e ficam de fora.',
    id: 'em-resumo',
    label: 'Em resumo',
    question: 'O que este currículo tem, numa tela, no período escolhido.',
    sources:
      'Nome, vínculo atual (sem ano de fim), doutorado, área de atuação e a contagem de cada lista.',
  },
  {
    filters: ['periodo', 'grupo'],
    gaps: 'Achar o DOI que falta pede consulta ao Crossref; aqui só se conta o que está vazio.',
    id: 'saude-do-curriculo',
    label: 'Saúde do currículo',
    question:
      'O que falta preencher para o currículo aparecer completo nas buscas, nos relatórios e nas exportações.',
    sources:
      'DOI, ISSN, ISBN, volume, páginas, palavras-chave, títulos em inglês, ID CNPq dos coautores, agência das orientações, ORCID iD e resumo em inglês.',
  },
  {
    filters: ['periodo', 'grupo'],
    gaps: 'Saber se um ano vazio é item faltando ou ano sem publicação pede comparar com o OpenAlex pelo ORCID iD.',
    id: 'producoes-por-ano',
    label: 'Produções por ano',
    question: 'Em que anos saiu o quê, e onde há um ano vazio que pode ser item faltando.',
    sources:
      'O tipo de cada produção e o ano dos dados básicos. A faixa de baixo usa a formação e os vínculos da atuação.',
  },
  {
    filters: ['janela'],
    gaps: 'Pontuação por estrato Qualis exige a tabela da CAPES, que não está no XML.',
    id: 'quadrienios',
    label: 'Quadriênios',
    question:
      'Quanto saiu em cada janela que um edital ou a avaliação da CAPES pede, por tipo de item.',
    sources: 'Ano das produções, orientações, bancas, eventos, projetos e prêmios.',
  },
  {
    filters: ['periodo'],
    gaps: 'Orientação concluída só traz o ano de conclusão: vira ponto, não barra.',
    id: 'linha-do-tempo',
    label: 'Linha do tempo',
    question:
      'Como formação, vínculos, projetos, orientações e prêmios se encaixam ao longo dos anos.',
    sources:
      'Anos de início e conclusão da formação, início e fim dos vínculos e projetos, ano das orientações e dos prêmios.',
  },
  {
    filters: ['periodo', 'laco', 'vista'],
    gaps: 'Instituição e país dos coautores não estão no XML. Variações do mesmo nome contam como pessoas diferentes.',
    id: 'pessoas',
    label: 'Pessoas',
    question:
      'Com quem você mais trabalha, e de que forma: coautoria, orientação, banca ou projeto.',
    sources:
      'Autores das produções, participantes das bancas, equipe dos projetos, nomes dos orientandos e dos orientadores da formação.',
  },
  {
    filters: ['periodo', 'grupo'],
    gaps: 'A convenção de ordem muda por área (em algumas, alfabética), e o XML não diz qual vale.',
    id: 'posicao-de-autoria',
    label: 'Posição de autoria',
    question: 'Em que posição da lista de autores você aparece, e como isso mudou com os anos.',
    sources:
      'Ordem de autoria de cada produção, comparada ao seu nome e aos seus nomes em citações.',
  },
  {
    filters: ['periodo', 'nivel'],
    gaps: 'Tempo de titulação não sai: a orientação concluída não traz o ano de início.',
    id: 'orientacoes-e-bancas',
    label: 'Orientações e bancas',
    question:
      'Quantas pessoas você formou, em que nível, quem está em andamento, e as bancas por ano.',
    sources:
      'Orientações concluídas e em andamento (nível, ano, agência) e participações em bancas.',
  },
  {
    filters: ['periodo'],
    gaps: 'Estrato Qualis e fator de impacto são dados externos. Um mapa pediria uma tabela de municípios embutida.',
    id: 'onde-publica',
    label: 'Onde publica',
    question:
      'Em que periódicos, idiomas, países e eventos o trabalho aparece, e que eventos se repetem.',
    sources:
      'Periódico e ISSN dos artigos, idioma e país das produções, nome, cidade e classificação dos eventos.',
  },
  {
    filters: ['periodo', 'repetidos'],
    gaps: 'Sinônimos e traduções ("fluxo gênico", "gene flow") não se juntam sem um vocabulário.',
    id: 'temas',
    label: 'Temas',
    question: 'Sobre o que você escreve, e como os assuntos mudaram de um período para outro.',
    sources: 'Palavras-chave de cada produção, com o ano, e as áreas de atuação declaradas.',
  },
];

export const DEFAULT_CHART = CHARTS[0]!.id;

export function chartById(id: string | undefined): ChartInfo {
  return CHARTS.find((c) => c.id === id) ?? CHARTS[0]!;
}
