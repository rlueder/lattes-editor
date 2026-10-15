# Censo dos formulários do Lattes: cobertura

Gerado por `pnpm censo:relatorio` a partir das capturas em `docs/lattes-formularios/`
e de `src/schema/lattes.json`. Não editar à mão. Como capturar e o que cada
grupo quer dizer está no `README.md` desta pasta.

Formulários no censo: 77, com captura: 0, sem captura: 77.

## Atributos por grupo

| Grupo              | Atributo por formulário | Atributo distinto |
| ------------------ | ----------------------: | ----------------: |
| com opções         |                       0 |                 0 |
| texto livre        |                       0 |                 0 |
| oculto             |                       0 |                 0 |
| fora do formulário |                       0 |                 0 |
| sem captura        |                    3331 |              1798 |
| total              |                    3331 |              1798 |

## Formulários

"Endereço" diz se o caminho do formulário foi visto no Lattes; "Elementos", se a
ligação do formulário com os elementos do XML foi conferida.

| Formulário                                                            | Como abre             | Endereço  | Elementos | Captura | Opções | Texto | Oculto | Fora |
| --------------------------------------------------------------------- | --------------------- | --------- | --------- | ------- | -----: | ----: | -----: | ---: |
| Identificação (`identificacao`)                                       | link do menu          | observado | inferido  | falta   |        |       |        |      |
| Endereço (`endereco`)                                                 | link do menu          | observado | inferido  | falta   |        |       |        |      |
| Resumo (`resumo`)                                                     | link do menu          | observado | observado | falta   |        |       |        |      |
| Outras informações relevantes (`outras-informacoes`)                  | link do menu          | observado | inferido  | falta   |        |       |        |      |
| Áreas de atuação (`areas-de-atuacao`)                                 | link do menu          | observado | inferido  | falta   |        |       |        |      |
| Idiomas (`idioma`)                                                    | endereço conhecido    | observado | observado | falta   |        |       |        |      |
| Prêmios e títulos (`premio`)                                          | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Licenças (`licenca`)                                                  | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Formação acadêmica: doutorado (`formacao-FA-4`)                       | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Formação acadêmica: mestrado (`formacao-FA-3`)                        | endereço conhecido    | observado | observado | falta   |        |       |        |      |
| Formação acadêmica: mestrado profissional (`formacao-FA-9`)           | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Formação acadêmica: especialização (`formacao-FA-2`)                  | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Formação acadêmica: residência médica (`formacao-FA-D`)               | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Formação acadêmica: graduação (`formacao-FA-1`)                       | endereço conhecido    | observado | observado | falta   |        |       |        |      |
| Formação acadêmica: ensino técnico (`formacao-FA-7`)                  | endereço conhecido    | observado | observado | falta   |        |       |        |      |
| Formação acadêmica: ensino médio (`formacao-FA-C`)                    | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Formação acadêmica: ensino fundamental (`formacao-FA-B`)              | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Formação acadêmica: aperfeiçoamento (`formacao-FA-X`)                 | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Formação: pós-doutorado (`formacao-AP-5`)                             | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Formação: livre-docência (`formacao-AP-6`)                            | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Formação complementar (`formacao-complementar`)                       | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Atuação profissional (`atuacao`)                                      | endereço conhecido    | observado | observado | falta   |        |       |        |      |
| Vínculo de uma atuação (`vinculo`)                                    | link da lista         | observado | observado | falta   |        |       |        |      |
| Atividade de uma atuação (`atividade`)                                | link da lista         | inferido  | inferido  | falta   |        |       |        |      |
| Corpo editorial, revisão e assessoramento (MB) (`revisor-MB`)         | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Corpo editorial, revisão e assessoramento (MA) (`revisor-MA`)         | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Corpo editorial, revisão e assessoramento (RV) (`revisor-RV`)         | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Corpo editorial, revisão e assessoramento (RA) (`revisor-RA`)         | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Linhas de pesquisa (`linha-de-pesquisa`)                              | link da lista         | inferido  | inferido  | falta   |        |       |        |      |
| Projeto de pesquisa (`projeto-P`)                                     | endereço conhecido    | observado | observado | falta   |        |       |        |      |
| Projeto de desenvolvimento (`projeto-D`)                              | endereço conhecido    | observado | observado | falta   |        |       |        |      |
| Projeto de extensão (`projeto-E`)                                     | endereço conhecido    | observado | observado | falta   |        |       |        |      |
| Projeto de ensino (`projeto-N`)                                       | endereço conhecido    | observado | observado | falta   |        |       |        |      |
| Projeto de outros (`projeto-O`)                                       | endereço conhecido    | observado | observado | falta   |        |       |        |      |
| Artigos completos publicados (`artigo-publicado`)                     | link da lista         | inferido  | inferido  | falta   |        |       |        |      |
| Artigos aceitos para publicação (`artigo-aceito`)                     | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Livros e capítulos (`livro-capitulo`)                                 | link da lista         | inferido  | inferido  | falta   |        |       |        |      |
| Trabalhos em anais (`trabalho-em-eventos`)                            | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Textos em jornais ou revistas (`texto-jornal`)                        | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Tradução (`traducao`)                                                 | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Partitura musical (`partitura`)                                       | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Prefácio, posfácio e outra produção bibliográfica (`prefacio-outras`) | endereço desconhecido | inferido  | inferido  | falta   |        |       |        |      |
| Patente: janela "Incluir nova patente" (`patente-janela`)             | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Patente (`patente`)                                                   | endereço conhecido    | observado | observado | falta   |        |       |        |      |
| Programa de computador (`registro-PC`)                                | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Cultivar protegida (`registro-CP`)                                    | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Cultivar registrada (`registro-CR`)                                   | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Desenho industrial (`registro-DI`)                                    | endereço conhecido    | inferido  | inferido  | falta   |        |       |        |      |
| Marca (`registro-MR`)                                                 | endereço conhecido    | inferido  | inferido  | falta   |        |       |        |      |
| Topografia de circuito integrado (`registro-TC`)                      | endereço conhecido    | inferido  | inferido  | falta   |        |       |        |      |
| Produtos tecnológicos (`produto`)                                     | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Processos ou técnicas (`processo`)                                    | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Trabalhos técnicos (`trabalho-tecnico`)                               | endereço conhecido    | observado | observado | falta   |        |       |        |      |
| Assessoria e consultoria (`assessoria`)                               | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Extensão tecnológica (`extensao-tecnologica`)                         | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Apresentação de trabalho (`tec-2J`)                                   | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Carta, mapa ou similar (`tec-2A`)                                     | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Curso de curta duração (`tec-2B`)                                     | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Material didático (`tec-2C`)                                          | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Editoração (`tec-2D`)                                                 | endereço conhecido    | observado | observado | falta   |        |       |        |      |
| Manutenção de obra artística (`tec-2E`)                               | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Maquete (`tec-2F`)                                                    | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Organização de evento (`tec-2G`)                                      | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Programa de rádio ou TV (`tec-2H`)                                    | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Relatório de pesquisa (`tec-2I`)                                      | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Redes sociais, sites e blogs (`tec-2L`)                               | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Outra produção técnica (`tec-2Z`)                                     | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Artes cênicas (`arte-AC`)                                             | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Música (`arte-MU`)                                                    | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Artes visuais (`arte-AV`)                                             | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Outra produção artística (`arte-OU`)                                  | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Orientações concluídas (`orientacao-concluida`)                       | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Orientações em andamento (`orientacao-andamento`)                     | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Bancas de trabalhos de conclusão (`banca-trabalho`)                   | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Bancas julgadoras (`banca-julgadora`)                                 | endereço conhecido    | observado | inferido  | falta   |        |       |        |      |
| Participação em eventos (`evento`)                                    | endereço conhecido    | observado | observado | falta   |        |       |        |      |
| Demais trabalhos (`demais-trabalhos`)                                 | link da lista         | inferido  | inferido  | falta   |        |       |        |      |

## Divergências entre o Lattes capturado e o editor

Nenhuma.

## Lacunas

Formulários sem captura: `identificacao`, `endereco`, `resumo`, `outras-informacoes`, `areas-de-atuacao`, `idioma`, `premio`, `licenca`, `formacao-FA-4`, `formacao-FA-3`, `formacao-FA-9`, `formacao-FA-2`, `formacao-FA-D`, `formacao-FA-1`, `formacao-FA-7`, `formacao-FA-C`, `formacao-FA-B`, `formacao-FA-X`, `formacao-AP-5`, `formacao-AP-6`, `formacao-complementar`, `atuacao`, `vinculo`, `atividade`, `revisor-MB`, `revisor-MA`, `revisor-RV`, `revisor-RA`, `linha-de-pesquisa`, `projeto-P`, `projeto-D`, `projeto-E`, `projeto-N`, `projeto-O`, `artigo-publicado`, `artigo-aceito`, `livro-capitulo`, `trabalho-em-eventos`, `texto-jornal`, `traducao`, `partitura`, `prefacio-outras`, `patente-janela`, `patente`, `registro-PC`, `registro-CP`, `registro-CR`, `registro-DI`, `registro-MR`, `registro-TC`, `produto`, `processo`, `trabalho-tecnico`, `assessoria`, `extensao-tecnologica`, `tec-2J`, `tec-2A`, `tec-2B`, `tec-2C`, `tec-2D`, `tec-2E`, `tec-2F`, `tec-2G`, `tec-2H`, `tec-2I`, `tec-2L`, `tec-2Z`, `arte-AC`, `arte-MU`, `arte-AV`, `arte-OU`, `orientacao-concluida`, `orientacao-andamento`, `banca-trabalho`, `banca-julgadora`, `evento`, `demais-trabalhos`.

Elementos do schema que nenhum formulário do censo cobre: `APRESENTACAO-DE-OBRA-ARTISTICA`, `APRESENTACAO-EM-RADIO-OU-TV`, `ARRANJO-MUSICAL`, `COMPOSICAO-MUSICAL`, `CURRICULO-VITAE`, `CURSO-DE-CURTA-DURACAO`, `DADOS-BASICOS-DA-APRESENTACAO-DE-OBRA-ARTISTICA`, `DADOS-BASICOS-DA-APRESENTACAO-EM-RADIO-OU-TV`, `DADOS-BASICOS-DA-COMPOSICAO-MUSICAL`, `DADOS-BASICOS-DA-OBRA-DE-ARTES-VISUAIS`, `DADOS-BASICOS-DE-SONOPLASTIA`, `DADOS-BASICOS-DO-ARRANJO-MUSICAL`, `DADOS-BASICOS-DO-CURSO-DE-CURTA-DURACAO`, `DETALHAMENTO-DA-APRESENTACAO-DE-OBRA-ARTISTICA`, `DETALHAMENTO-DA-APRESENTACAO-EM-RADIO-OU-TV`, `DETALHAMENTO-DA-COMPOSICAO-MUSICAL`, `DETALHAMENTO-DA-OBRA-DE-ARTES-VISUAIS`, `DETALHAMENTO-DE-SONOPLASTIA`, `DETALHAMENTO-DO-ARRANJO-MUSICAL`, `DETALHAMENTO-DO-CURSO-DE-CURTA-DURACAO`, `INFORMACAO-ADICIONAL-CURSO`, `INFORMACAO-ADICIONAL-INSTITUICAO`, `OBRA-DE-ARTES-VISUAIS`, `SONOPLASTIA`.
