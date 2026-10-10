// Os 17 módulos do Passo 2 do Importar do Lattes e onde cada um lê no XML
// (guia de implementação, seção 3.4). Um caminho terminado em "*" cobre todos
// os filhos do contêiner.

export interface ImportModule {
  /** Nomes de item excluídos de um caminho com "*". */
  exclude?: string[];
  id: string;
  /** Rótulo exato da caixa de seleção no Passo 2. */
  label: string;
  /** Caminhos a partir de CURRICULO-VITAE, separados por "/". */
  paths: string[];
}

export const IMPORT_MODULES: ImportModule[] = [
  {
    id: 'artigos',
    label: 'Artigos completos publicados',
    paths: ['PRODUCAO-BIBLIOGRAFICA/ARTIGOS-PUBLICADOS/ARTIGO-PUBLICADO'],
  },
  {
    id: 'artigos-aceitos',
    label: 'Artigos aceitos para publicação',
    paths: ['PRODUCAO-BIBLIOGRAFICA/ARTIGOS-ACEITOS-PARA-PUBLICACAO/ARTIGO-ACEITO-PARA-PUBLICACAO'],
  },
  {
    id: 'livros-capitulos',
    label: 'Livros e capítulos',
    paths: [
      'PRODUCAO-BIBLIOGRAFICA/LIVROS-E-CAPITULOS/LIVROS-PUBLICADOS-OU-ORGANIZADOS/LIVRO-PUBLICADO-OU-ORGANIZADO',
      'PRODUCAO-BIBLIOGRAFICA/LIVROS-E-CAPITULOS/CAPITULOS-DE-LIVROS-PUBLICADOS/CAPITULO-DE-LIVRO-PUBLICADO',
    ],
  },
  {
    id: 'anais',
    label: 'Trabalhos publicados em anais de eventos',
    paths: ['PRODUCAO-BIBLIOGRAFICA/TRABALHOS-EM-EVENTOS/TRABALHO-EM-EVENTOS'],
  },
  {
    id: 'textos-jornal',
    label: 'Texto em jornal ou revista',
    paths: ['PRODUCAO-BIBLIOGRAFICA/TEXTOS-EM-JORNAIS-OU-REVISTAS/TEXTO-EM-JORNAL-OU-REVISTA'],
  },
  {
    id: 'apresentacao',
    label: 'Apresentação de Trabalho',
    paths: ['PRODUCAO-TECNICA/DEMAIS-TIPOS-DE-PRODUCAO-TECNICA/APRESENTACAO-DE-TRABALHO'],
  },
  {
    id: 'outras-bibliograficas',
    label: 'Outras produções bibliográficas',
    paths: ['PRODUCAO-BIBLIOGRAFICA/DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA/*'],
  },
  { id: 'softwares', label: 'Softwares', paths: ['PRODUCAO-TECNICA/SOFTWARE'] },
  { id: 'produtos', label: 'Produtos', paths: ['PRODUCAO-TECNICA/PRODUTO-TECNOLOGICO'] },
  { id: 'processos', label: 'Processos', paths: ['PRODUCAO-TECNICA/PROCESSOS-OU-TECNICAS'] },
  {
    id: 'trabalhos-tecnicos',
    label: 'Trabalhos técnicos',
    paths: ['PRODUCAO-TECNICA/TRABALHO-TECNICO'],
  },
  {
    exclude: ['APRESENTACAO-DE-TRABALHO'],
    id: 'outras-tecnicas',
    label: 'Outras produções técnicas',
    paths: ['PRODUCAO-TECNICA/DEMAIS-TIPOS-DE-PRODUCAO-TECNICA/*'],
  },
  {
    id: 'artistica',
    label: 'Produção artística/cultural',
    paths: ['OUTRA-PRODUCAO/PRODUCAO-ARTISTICA-CULTURAL/*'],
  },
  {
    id: 'orientacoes',
    label: 'Orientações e Supervisões',
    paths: [
      'OUTRA-PRODUCAO/ORIENTACOES-CONCLUIDAS/*',
      'DADOS-COMPLEMENTARES/ORIENTACOES-EM-ANDAMENTO/*',
    ],
  },
  // O guia diz OUTRA-PRODUCAO/DEMAIS-TRABALHOS/DEMAIS-TRABALHOS, mas no XSD o
  // item repetido é o próprio DEMAIS-TRABALHOS, filho direto de OUTRA-PRODUCAO.
  { id: 'demais-trabalhos', label: 'Demais Trabalhos', paths: ['OUTRA-PRODUCAO/DEMAIS-TRABALHOS'] },
  {
    id: 'eventos',
    label: 'Eventos',
    paths: ['DADOS-COMPLEMENTARES/PARTICIPACAO-EM-EVENTOS-CONGRESSOS/*'],
  },
  {
    id: 'bancas',
    label: 'Bancas',
    paths: [
      'DADOS-COMPLEMENTARES/PARTICIPACAO-EM-BANCA-TRABALHOS-CONCLUSAO/*',
      'DADOS-COMPLEMENTARES/PARTICIPACAO-EM-BANCA-JULGADORA/*',
    ],
  },
];
