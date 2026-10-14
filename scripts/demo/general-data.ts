// Dados gerais da pesquisadora fictícia do currículo de demonstração.

import type { XElement } from '../../src/model/xml.ts';
import { ANA, COAUTHORS, el } from './build.ts';

export function generalData(): XElement {
  const resumo =
    'Bióloga, professora adjunta do Departamento de Genética da Universidade Federal do Rio Grande do Sul (UFRGS), onde coordena o Laboratório de Genômica da Conservação. Doutora em Genética e Biologia Molecular pela UFRGS (2015), com pós-doutorado na Universidade de São Paulo (2016-2018). Estuda diversidade genética, estrutura de populações e adaptação local de palmeiras nativas do Cerrado, da Mata Atlântica e do Pampa, com marcadores SNP, genomas de cloroplasto e genômica de paisagem. Orienta alunos de iniciação científica, mestrado e doutorado no Programa de Pós-Graduação em Genética e Biologia Molecular. Bolsista de produtividade em pesquisa do CNPq.';
  return el(
    'DADOS-GERAIS',
    {
      'CIDADE-NASCIMENTO': 'Pelotas',
      'DATA-DE-EMISSAO': '12082004',
      'DATA-NASCIMENTO': '03051986',
      NACIONALIDADE: 'B',
      'NOME-COMPLETO': ANA.name,
      'NOME-DA-MAE': 'Marta Regina Souza',
      'NOME-DO-PAI': 'Carlos Alberto Lima',
      'NOME-EM-CITACOES-BIBLIOGRAFICAS': 'LIMA, A. B. S.;LIMA, ANA BEATRIZ SOUZA;SOUZA LIMA, A. B.',
      'NUMERO-IDENTIDADE': '2087654321',
      'ORCID-ID': 'https://orcid.org/0000-0002-1825-0097',
      'ORGAO-EMISSOR': 'SSP',
      'PAIS-DE-NACIONALIDADE': 'Brasil',
      'PAIS-DE-NASCIMENTO': 'Brasil',
      'PERMISSAO-DE-DIVULGACAO': 'NAO',
      SEXO: 'FEMININO',
      'SIGLA-PAIS-NACIONALIDADE': 'BRA',
      'UF-NASCIMENTO': 'RS',
      'UF-ORGAO-EMISSOR': 'RS',
    },
    [
      el('RESUMO-CV', {
        'TEXTO-RESUMO-CV-RH': resumo,
        'TEXTO-RESUMO-CV-RH-EN':
          'Biologist and associate professor at the Department of Genetics of the Federal University of Rio Grande do Sul (UFRGS), where she leads the Conservation Genomics Lab. Her research addresses genetic diversity, population structure and local adaptation of native palms from the Cerrado, the Atlantic Forest and the Pampa.',
      }),
      el('ENDERECO', { 'FLAG-DE-PREFERENCIA': 'ENDERECO_INSTITUCIONAL' }, [
        el('ENDERECO-PROFISSIONAL', {
          BAIRRO: 'Agronomia',
          CEP: '91501970',
          CIDADE: 'Porto Alegre',
          'LOGRADOURO-COMPLEMENTO': 'Avenida Bento Gonçalves, 9500, Prédio 43323',
          'NOME-INSTITUICAO-EMPRESA': 'Universidade Federal do Rio Grande do Sul',
          'NOME-ORGAO': 'Instituto de Biociências',
          'NOME-UNIDADE': 'Departamento de Genética',
          PAIS: 'Brasil',
          UF: 'RS',
        }),
      ]),
      el('FORMACAO-ACADEMICA-TITULACAO', {}, [
        el('GRADUACAO', {
          'ANO-DE-CONCLUSAO': '2008',
          'ANO-DE-INICIO': '2004',
          NIVEL: '1',
          'NOME-CURSO': 'Ciências Biológicas',
          'NOME-DO-ORIENTADOR': COAUTHORS.mendes!.name,
          'NOME-INSTITUICAO': 'Universidade Federal do Rio Grande do Sul',
          'SEQUENCIA-FORMACAO': '1',
          'STATUS-DO-CURSO': 'CONCLUIDO',
          'TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO':
            'Diversidade genética de Butia odorata em populações do Rio Grande do Sul',
        }),
        el('MESTRADO', {
          'ANO-DE-CONCLUSAO': '2011',
          'ANO-DE-INICIO': '2009',
          'ANO-DE-OBTENCAO-DO-TITULO': '2011',
          'FLAG-BOLSA': 'SIM',
          NIVEL: '3',
          'NOME-AGENCIA': 'Coordenação de Aperfeiçoamento de Pessoal de Nível Superior',
          'NOME-COMPLETO-DO-ORIENTADOR': COAUTHORS.mendes!.name,
          'NOME-CURSO': 'Genética e Biologia Molecular',
          'NOME-INSTITUICAO': 'Universidade Federal do Rio Grande do Sul',
          'SEQUENCIA-FORMACAO': '2',
          'STATUS-DO-CURSO': 'CONCLUIDO',
          'TITULO-DA-DISSERTACAO-TESE':
            'Estrutura genética de populações de Butia odorata no bioma Pampa',
        }),
        el('DOUTORADO', {
          'ANO-DE-CONCLUSAO': '2015',
          'ANO-DE-INICIO': '2011',
          'ANO-DE-OBTENCAO-DO-TITULO': '2015',
          'FLAG-BOLSA': 'SIM',
          NIVEL: '4',
          'NOME-AGENCIA': 'Conselho Nacional de Desenvolvimento Científico e Tecnológico',
          'NOME-COMPLETO-DO-ORIENTADOR': COAUTHORS.vieira!.name,
          'NOME-CURSO': 'Genética e Biologia Molecular',
          'NOME-INSTITUICAO': 'Universidade Federal do Rio Grande do Sul',
          'SEQUENCIA-FORMACAO': '3',
          'STATUS-DO-CURSO': 'CONCLUIDO',
          'TITULO-DA-DISSERTACAO-TESE':
            'Genômica de populações de palmeiras do Cerrado e da Mata Atlântica',
        }),
        el('POS-DOUTORADO', {
          'ANO-DE-CONCLUSAO': '2018',
          'ANO-DE-INICIO': '2016',
          'ANO-DE-OBTENCAO-DO-TITULO': '2018',
          'FLAG-BOLSA': 'SIM',
          NIVEL: '5',
          'NOME-AGENCIA': 'Fundação de Amparo à Pesquisa do Estado de São Paulo',
          'NOME-INSTITUICAO': 'Universidade de São Paulo',
          'SEQUENCIA-FORMACAO': '4',
          'STATUS-DO-CURSO': 'CONCLUIDO',
          'TITULO-DO-TRABALHO': 'Genômica de paisagem de Euterpe edulis na Mata Atlântica',
        }),
      ]),
      el('ATUACOES-PROFISSIONAIS', {}, [
        el(
          'ATUACAO-PROFISSIONAL',
          {
            'NOME-INSTITUICAO': 'Universidade Federal do Rio Grande do Sul',
            'SEQUENCIA-ATIVIDADE': '1',
            'SEQUENCIA-IMPORTANCIA': '1',
          },
          [
            el('VINCULOS', {
              'ANO-INICIO': '2019',
              'CARGA-HORARIA-SEMANAL': '40',
              'ENQUADRAMENTO-FUNCIONAL': 'OUTRO',
              'FLAG-DEDICACAO-EXCLUSIVA': 'SIM',
              'FLAG-VINCULO-EMPREGATICIO': 'SIM',
              'MES-INICIO': '3',
              'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO': 'Professora Adjunta',
              'SEQUENCIA-HISTORICO': '1',
              'TIPO-DE-VINCULO': 'SERVIDOR_PUBLICO',
            }),
            el('ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO', {}, [
              el(
                'PARTICIPACAO-EM-PROJETO',
                {
                  'ANO-INICIO': '2020',
                  'FLAG-PERIODO': 'ATUAL',
                  'MES-INICIO': '3',
                  'NOME-ORGAO': 'Instituto de Biociências',
                  'SEQUENCIA-FUNCAO-ATIVIDADE': '1',
                },
                [
                  el(
                    'PROJETO-DE-PESQUISA',
                    {
                      'ANO-INICIO': '2020',
                      'DESCRICAO-DO-PROJETO':
                        'Caracterização da diversidade genética de palmeiras nativas do Sul do Brasil com marcadores SNP, para orientar coleta de sementes, bancos de germoplasma e planos de manejo de populações ameaçadas.',
                      NATUREZA: 'PESQUISA',
                      'NOME-DO-PROJETO':
                        'Genômica da conservação de palmeiras nativas do Sul do Brasil',
                      'NUMERO-DOUTORADO': '2',
                      'NUMERO-GRADUACAO': '3',
                      'NUMERO-MESTRADO-ACADEMICO': '2',
                      'SEQUENCIA-PROJETO': '1',
                      SITUACAO: 'EM_ANDAMENTO',
                    },
                    [
                      el('EQUIPE-DO-PROJETO', {}, [
                        el('INTEGRANTES-DO-PROJETO', {
                          'FLAG-RESPONSAVEL': 'SIM',
                          'NOME-COMPLETO': ANA.name,
                          'NOME-PARA-CITACAO': ANA.cite,
                          'ORDEM-DE-INTEGRACAO': '1',
                        }),
                        el('INTEGRANTES-DO-PROJETO', {
                          'NOME-COMPLETO': COAUTHORS.oliveira!.name,
                          'NOME-PARA-CITACAO': COAUTHORS.oliveira!.cite,
                          'ORDEM-DE-INTEGRACAO': '2',
                        }),
                        el('INTEGRANTES-DO-PROJETO', {
                          'NOME-COMPLETO': COAUTHORS.ferreira!.name,
                          'NOME-PARA-CITACAO': COAUTHORS.ferreira!.cite,
                          'ORDEM-DE-INTEGRACAO': '3',
                        }),
                      ]),
                    ],
                  ),
                ],
              ),
            ]),
          ],
        ),
        el(
          'ATUACAO-PROFISSIONAL',
          {
            'NOME-INSTITUICAO': 'Universidade de São Paulo',
            'SEQUENCIA-ATIVIDADE': '2',
            'SEQUENCIA-IMPORTANCIA': '2',
          },
          [
            el('VINCULOS', {
              'ANO-FIM': '2018',
              'ANO-INICIO': '2016',
              'CARGA-HORARIA-SEMANAL': '40',
              'ENQUADRAMENTO-FUNCIONAL': 'OUTRO',
              'FLAG-DEDICACAO-EXCLUSIVA': 'SIM',
              'FLAG-VINCULO-EMPREGATICIO': 'NAO',
              'MES-FIM': '12',
              'MES-INICIO': '3',
              'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO': 'Pesquisadora de pós-doutorado',
              'OUTRO-VINCULO-INFORMADO': 'Bolsista de pós-doutorado',
              'SEQUENCIA-HISTORICO': '1',
              'TIPO-DE-VINCULO': 'OUTRO',
            }),
          ],
        ),
      ]),
      el('AREAS-DE-ATUACAO', {}, [
        el('AREA-DE-ATUACAO', {
          'NOME-DA-AREA-DO-CONHECIMENTO': 'Genética',
          'NOME-DA-SUB-AREA-DO-CONHECIMENTO': 'Genética Vegetal',
          'NOME-GRANDE-AREA-DO-CONHECIMENTO': 'CIENCIAS_BIOLOGICAS',
          'SEQUENCIA-AREA-DE-ATUACAO': '1',
        }),
        el('AREA-DE-ATUACAO', {
          'NOME-DA-AREA-DO-CONHECIMENTO': 'Ecologia',
          'NOME-DA-SUB-AREA-DO-CONHECIMENTO': 'Ecologia Aplicada',
          'NOME-GRANDE-AREA-DO-CONHECIMENTO': 'CIENCIAS_BIOLOGICAS',
          'SEQUENCIA-AREA-DE-ATUACAO': '2',
        }),
      ]),
      el('IDIOMAS', {}, [
        el('IDIOMA', {
          'DESCRICAO-DO-IDIOMA': 'Inglês',
          IDIOMA: 'EN',
          'PROFICIENCIA-DE-COMPREENSAO': 'BEM',
          'PROFICIENCIA-DE-ESCRITA': 'BEM',
          'PROFICIENCIA-DE-FALA': 'BEM',
          'PROFICIENCIA-DE-LEITURA': 'BEM',
        }),
        el('IDIOMA', {
          'DESCRICAO-DO-IDIOMA': 'Espanhol',
          IDIOMA: 'ES',
          'PROFICIENCIA-DE-COMPREENSAO': 'BEM',
          'PROFICIENCIA-DE-ESCRITA': 'POUCO',
          'PROFICIENCIA-DE-FALA': 'RAZOAVELMENTE',
          'PROFICIENCIA-DE-LEITURA': 'BEM',
        }),
      ]),
      el('PREMIOS-TITULOS', {}, [
        el('PREMIO-TITULO', {
          'ANO-DA-PREMIACAO': '2022',
          'NOME-DA-ENTIDADE-PROMOTORA':
            'Conselho Nacional de Desenvolvimento Científico e Tecnológico',
          'NOME-DO-PREMIO-OU-TITULO': 'Bolsa de Produtividade em Pesquisa, nível 2',
        }),
        el('PREMIO-TITULO', {
          'ANO-DA-PREMIACAO': '2015',
          'NOME-DA-ENTIDADE-PROMOTORA': 'Universidade Federal do Rio Grande do Sul',
          'NOME-DO-PREMIO-OU-TITULO': 'Menção honrosa pela tese de doutorado',
        }),
      ]),
    ],
  );
}
