// Produções, bancas, eventos e orientações do currículo de demonstração.

import type { XElement } from '../../src/model/xml.ts';
import listas from '../../src/schema/listas-lattes.json' with { type: 'json' };
import { ANA, authors, COAUTHORS, el, keywords, nextSeq } from './build.ts';

interface Article {
  authors: string[];
  /**
   * País de publicação do periódico, como a lista de países do Lattes o
   * escreve (src/schema/listas-lattes.json), conferido no OpenAlex pelo ISSN.
   */
  country: string;
  doi: string;
  issn: string;
  journal: string;
  keywords: string[];
  language: string;
  pages: [string, string];
  title: string;
  volume: string;
  year: string;
}

const ARTICLES: Article[] = [
  {
    authors: ['ana', 'oliveira', 'ferreira', 'vieira'],
    country: 'Grã-Bretanha',
    doi: '10.5555/demo.2024.001',
    issn: '0962-1083',
    journal: 'Molecular Ecology',
    keywords: ['genômica de paisagem', 'adaptação local', 'Butia odorata', 'Pampa'],
    language: 'Inglês',
    pages: ['1', '16'],
    title: 'Landscape genomics reveals adaptive divergence in Butia odorata across the Pampa',
    volume: '33',
    year: '2024',
  },
  {
    authors: ['ana', 'rocha', 'nascimento'],
    country: 'Brasil',
    doi: '10.5555/demo.2023.002',
    issn: '0370-6583',
    journal: 'Rodriguésia',
    keywords: ['conservação', 'palmeiras', 'diversidade genética'],
    language: 'Português',
    pages: ['1', '14'],
    title: 'Diversidade genética e conservação de palmeiras nativas do Rio Grande do Sul',
    volume: '74',
    year: '2023',
  },
  {
    authors: ['oliveira', 'ana', 'vieira'],
    country: 'Holanda',
    doi: '10.5555/demo.2022.003',
    issn: '1566-0621',
    journal: 'Conservation Genetics',
    keywords: ['Euterpe edulis', 'fragmentação', 'fluxo gênico'],
    language: 'Inglês',
    pages: ['701', '714'],
    title: 'Population structure of Euterpe edulis in Atlantic Forest fragments',
    volume: '23',
    year: '2022',
  },
  {
    authors: ['ana', 'ferreira', 'mendes'],
    country: 'Brasil',
    doi: '10.5555/demo.2021.004',
    issn: '1415-4757',
    journal: 'Genetics and Molecular Biology',
    keywords: ['SNP', 'monitoramento genético', 'Butia'],
    language: 'Inglês',
    pages: ['1', '9'],
    title: 'A SNP panel for genetic monitoring of Butia species in southern Brazil',
    volume: '44',
    year: '2021',
  },
  {
    authors: ['ana', 'vieira'],
    country: 'Suíça',
    doi: '10.5555/demo.2019.005',
    issn: '1664-462X',
    journal: 'Frontiers in Plant Science',
    keywords: ['genoma de cloroplasto', 'filogenia', 'Arecaceae'],
    language: 'Inglês',
    pages: ['1', '12'],
    title: 'The complete chloroplast genome of Butia eriospatha and its phylogenetic placement',
    volume: '10',
    year: '2019',
  },
  {
    authors: ['ana', 'mendes', 'vieira'],
    country: 'Brasil',
    doi: '10.5555/demo.2017.006',
    issn: '0102-3306',
    journal: 'Acta Botanica Brasilica',
    keywords: ['Syagrus romanzoffiana', 'fluxo gênico', 'Mata Atlântica'],
    language: 'Português',
    pages: ['456', '466'],
    title: 'Fluxo gênico entre populações de Syagrus romanzoffiana na Mata Atlântica',
    volume: '31',
    year: '2017',
  },
];

function article(a: Article): XElement {
  if (!listas.paises.includes(a.country)) {
    throw new Error(`${a.journal}: país fora da lista do Lattes: ${a.country}`);
  }
  return el('ARTIGO-PUBLICADO', { 'SEQUENCIA-PRODUCAO': nextSeq() }, [
    el('DADOS-BASICOS-DO-ARTIGO', {
      'ANO-DO-ARTIGO': a.year,
      DOI: a.doi,
      'FLAG-RELEVANCIA': a.year >= '2022' ? 'SIM' : 'NAO',
      IDIOMA: a.language,
      'MEIO-DE-DIVULGACAO': 'MEIO_DIGITAL',
      NATUREZA: 'COMPLETO',
      'PAIS-DE-PUBLICACAO': a.country,
      'TITULO-DO-ARTIGO': a.title,
    }),
    el('DETALHAMENTO-DO-ARTIGO', {
      ISSN: a.issn,
      'PAGINA-FINAL': a.pages[1],
      'PAGINA-INICIAL': a.pages[0],
      'TITULO-DO-PERIODICO-OU-REVISTA': a.journal,
      VOLUME: a.volume,
    }),
    ...authors(a.authors),
    keywords(a.keywords),
  ]);
}

function eventPaper(
  title: string,
  year: string,
  event: string,
  city: string,
  coauthors: string[],
): XElement {
  return el('TRABALHO-EM-EVENTOS', { 'SEQUENCIA-PRODUCAO': nextSeq() }, [
    el('DADOS-BASICOS-DO-TRABALHO', {
      'ANO-DO-TRABALHO': year,
      IDIOMA: 'Português',
      'MEIO-DE-DIVULGACAO': 'MEIO_DIGITAL',
      NATUREZA: 'RESUMO',
      'PAIS-DO-EVENTO': 'Brasil',
      'TITULO-DO-TRABALHO': title,
    }),
    el('DETALHAMENTO-DO-TRABALHO', {
      'ANO-DE-REALIZACAO': year,
      'CIDADE-DO-EVENTO': city,
      'CLASSIFICACAO-DO-EVENTO': 'NACIONAL',
      'NOME-DO-EVENTO': event,
      'TITULO-DOS-ANAIS-OU-PROCEEDINGS': `Anais do ${event}`,
    }),
    ...authors(coauthors),
  ]);
}

export function bibliography(): XElement {
  return el('PRODUCAO-BIBLIOGRAFICA', {}, [
    el('TRABALHOS-EM-EVENTOS', {}, [
      eventPaper(
        'Assinaturas de seleção em populações de Butia odorata ao longo de um gradiente climático',
        '2023',
        '68º Congresso Brasileiro de Genética',
        'Águas de Lindóia',
        ['ana', 'oliveira'],
      ),
      eventPaper(
        'Diversidade genética de Euterpe edulis em fragmentos urbanos de Porto Alegre',
        '2022',
        '73º Congresso Nacional de Botânica',
        'Florianópolis',
        ['ferreira', 'ana'],
      ),
      eventPaper(
        'Bancos de germoplasma de palmeiras nativas: o que a genômica pode dizer',
        '2021',
        '4º Simpósio Sul-Brasileiro de Recursos Genéticos',
        'Pelotas',
        ['ana'],
      ),
    ]),
    el('ARTIGOS-PUBLICADOS', {}, ARTICLES.map(article)),
    el('LIVROS-E-CAPITULOS', {}, [
      el('CAPITULOS-DE-LIVROS-PUBLICADOS', {}, [
        el('CAPITULO-DE-LIVRO-PUBLICADO', { 'SEQUENCIA-PRODUCAO': nextSeq() }, [
          el('DADOS-BASICOS-DO-CAPITULO', {
            ANO: '2020',
            IDIOMA: 'Português',
            'MEIO-DE-DIVULGACAO': 'IMPRESSO',
            'PAIS-DE-PUBLICACAO': 'Brasil',
            TIPO: 'Capítulo de livro publicado',
            'TITULO-DO-CAPITULO-DO-LIVRO': 'Genética da conservação de palmeiras nativas',
          }),
          el('DETALHAMENTO-DO-CAPITULO', {
            'CIDADE-DA-EDITORA': 'Porto Alegre',
            'NOME-DA-EDITORA': 'Editora da UFRGS',
            'NUMERO-DA-EDICAO-REVISAO': '1',
            ORGANIZADORES: 'Mendes, P. R.; Vieira, H. C.',
            'PAGINA-FINAL': '112',
            'PAGINA-INICIAL': '89',
            'TITULO-DO-LIVRO': 'Conservação de plantas nativas do Sul do Brasil',
          }),
          ...authors(['ana', 'mendes']),
        ]),
      ]),
    ]),
  ]);
}

function congress(
  title: string,
  year: string,
  event: string,
  city: string,
  form: string,
  type: string,
): XElement {
  return el('PARTICIPACAO-EM-CONGRESSO', { 'SEQUENCIA-PRODUCAO': nextSeq() }, [
    el('DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO', {
      ANO: year,
      'FORMA-PARTICIPACAO': form,
      IDIOMA: 'Português',
      'MEIO-DE-DIVULGACAO': 'NAO_INFORMADO',
      NATUREZA: 'Congresso',
      PAIS: 'Brasil',
      'TIPO-PARTICIPACAO': type,
      TITULO: title,
    }),
    el('DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO', {
      'CIDADE-DO-EVENTO': city,
      'NOME-DO-EVENTO': event,
    }),
  ]);
}

function mastersCommittee(title: string, year: string, candidate: string): XElement {
  return el('PARTICIPACAO-EM-BANCA-DE-MESTRADO', { 'SEQUENCIA-PRODUCAO': nextSeq() }, [
    el('DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO', {
      ANO: year,
      IDIOMA: 'Português',
      NATUREZA: 'Dissertação',
      PAIS: 'Brasil',
      TIPO: 'ACADEMICO',
      TITULO: title,
    }),
    el('DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO', {
      'NOME-CURSO': 'Genética e Biologia Molecular',
      'NOME-DO-CANDIDATO': candidate,
      'NOME-INSTITUICAO': 'Universidade Federal do Rio Grande do Sul',
    }),
    el('PARTICIPANTE-BANCA', {
      'NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA': ANA.name,
      'NOME-PARA-CITACAO-DO-PARTICIPANTE-DA-BANCA': ANA.cite,
      'ORDEM-PARTICIPANTE': '1',
    }),
    el('PARTICIPANTE-BANCA', {
      'NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA': COAUTHORS.mendes!.name,
      'NOME-PARA-CITACAO-DO-PARTICIPANTE-DA-BANCA': COAUTHORS.mendes!.cite,
      'ORDEM-PARTICIPANTE': '2',
    }),
  ]);
}

export function complementary(): XElement {
  return el('DADOS-COMPLEMENTARES', {}, [
    el('PARTICIPACAO-EM-BANCA-TRABALHOS-CONCLUSAO', {}, [
      mastersCommittee(
        'Variação genética em populações de Araucaria angustifolia no Planalto Sul',
        '2024',
        'Camila Fernandes Rosa',
      ),
      mastersCommittee(
        'Marcadores moleculares para identificação de variedades de erva-mate',
        '2022',
        'Rodrigo Teixeira Bastos',
      ),
    ]),
    el('PARTICIPACAO-EM-EVENTOS-CONGRESSOS', {}, [
      congress(
        'Assinaturas de seleção em populações de Butia odorata',
        '2023',
        '68º Congresso Brasileiro de Genética',
        'Águas de Lindóia',
        'Participante',
        'Apresentação oral',
      ),
      congress(
        'Genômica de palmeiras em fragmentos urbanos',
        '2022',
        '73º Congresso Nacional de Botânica',
        'Florianópolis',
        'Participante',
        'Poster / Painel',
      ),
      congress(
        'Genômica da conservação: da coleta ao manejo',
        '2024',
        '69º Congresso Brasileiro de Genética',
        'Águas de Lindóia',
        'Convidado',
        'Conferencista',
      ),
    ]),
    el('ORIENTACOES-EM-ANDAMENTO', {}, [
      el('ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO', { 'SEQUENCIA-PRODUCAO': nextSeq() }, [
        el('DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO', {
          ANO: '2022',
          IDIOMA: 'Português',
          NATUREZA: 'Tese de doutorado',
          PAIS: 'Brasil',
          'TITULO-DO-TRABALHO':
            'Adaptação local e mudanças climáticas em palmeiras do gênero Butia',
        }),
        el('DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO', {
          'FLAG-BOLSA': 'SIM',
          'NOME-CURSO': 'Genética e Biologia Molecular',
          'NOME-DA-AGENCIA': 'Conselho Nacional de Desenvolvimento Científico e Tecnológico',
          'NOME-DO-ORIENTANDO': COAUTHORS.oliveira!.name,
          'NOME-INSTITUICAO': 'Universidade Federal do Rio Grande do Sul',
          'TIPO-DE-ORIENTACAO': 'ORIENTADOR_PRINCIPAL',
        }),
      ]),
    ]),
  ]);
}

function supervision(title: string, year: string, student: string, pages: string): XElement {
  return el('ORIENTACOES-CONCLUIDAS-PARA-MESTRADO', { 'SEQUENCIA-PRODUCAO': nextSeq() }, [
    el('DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO', {
      ANO: year,
      IDIOMA: 'Português',
      NATUREZA: 'Dissertação de mestrado',
      PAIS: 'Brasil',
      TIPO: 'ACADEMICO',
      TITULO: title,
    }),
    el('DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO', {
      'FLAG-BOLSA': 'SIM',
      'NOME-DA-AGENCIA': 'Coordenação de Aperfeiçoamento de Pessoal de Nível Superior',
      'NOME-DA-INSTITUICAO': 'Universidade Federal do Rio Grande do Sul',
      'NOME-DO-CURSO': 'Genética e Biologia Molecular',
      'NOME-DO-ORIENTADO': student,
      'NUMERO-DE-PAGINAS': pages,
      'TIPO-DE-ORIENTACAO': 'ORIENTADOR_PRINCIPAL',
    }),
  ]);
}

export function otherProduction(): XElement {
  return el('OUTRA-PRODUCAO', {}, [
    el('ORIENTACOES-CONCLUIDAS', {}, [
      supervision(
        'Diversidade genética de Euterpe edulis em fragmentos urbanos de Porto Alegre',
        '2023',
        COAUTHORS.ferreira!.name,
        '87',
      ),
      supervision(
        'Estrutura genética de Butia catarinensis no litoral de Santa Catarina',
        '2021',
        COAUTHORS.nascimento!.name,
        '102',
      ),
    ]),
  ]);
}
