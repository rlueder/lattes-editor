// Os gráficos do Panorama: nome no menu e a frase sob o título. A ordem é a
// do menu lateral.

export type FilterKind =
  'grupo' | 'janela' | 'laco' | 'nivel' | 'periodo' | 'repetidos' | 'vista' | 'zoom';

export interface ChartInfo {
  filters: FilterKind[];
  id: string;
  label: string;
  /** Uma frase sob o título, como a nota de uma seção. */
  question: string;
}

export const CHARTS: ChartInfo[] = [
  {
    filters: ['periodo'],
    id: 'em-resumo',
    label: 'Em resumo',
    question: 'Os totais do período escolhido.',
  },
  {
    filters: ['periodo', 'grupo'],
    id: 'saude-do-curriculo',
    label: 'Saúde do currículo',
    question: 'Campos vazios que valem preencher: DOI, ISSN, palavras-chave, títulos em inglês.',
  },
  {
    filters: ['periodo', 'grupo'],
    id: 'producoes-por-ano',
    label: 'Produções por ano',
    question: 'Produções de cada ano, por tipo. Um ano vazio pode ser item que falta.',
  },
  {
    filters: ['janela'],
    id: 'quadrienios',
    label: 'Quadriênios',
    question: 'Contagem por tipo nos quadriênios da CAPES e nos últimos cinco anos.',
  },
  {
    filters: ['periodo'],
    id: 'linha-do-tempo',
    label: 'Linha do tempo',
    question: 'Formação, vínculos, projetos, orientações e prêmios ao longo dos anos.',
  },
  {
    filters: ['periodo', 'laco'],
    id: 'pessoas',
    label: 'Pessoas',
    question: 'As pessoas com quem você mais trabalha, em coautoria, orientação, banca ou projeto.',
  },
  {
    filters: ['periodo', 'grupo'],
    id: 'posicao-de-autoria',
    label: 'Posição de autoria',
    question: 'Sua posição na lista de autores, ano a ano.',
  },
  {
    filters: ['periodo', 'nivel'],
    id: 'orientacoes-e-bancas',
    label: 'Orientações e bancas',
    question: 'Orientações por nível, concluídas e em andamento, e bancas por ano.',
  },
  {
    filters: ['periodo'],
    id: 'onde-publica',
    label: 'Onde publica',
    question: 'Periódicos, idiomas, países e eventos em que seu trabalho saiu.',
  },
  {
    filters: ['periodo', 'repetidos'],
    id: 'temas',
    label: 'Temas',
    question: 'Palavras-chave por ano e as áreas de atuação declaradas.',
  },
];

export const DEFAULT_CHART = CHARTS[0]!.id;

export function chartById(id: string | undefined): ChartInfo {
  return CHARTS.find((c) => c.id === id) ?? CHARTS[0]!;
}
