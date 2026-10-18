# Censo dos formulários do Lattes: cobertura

Gerado por `pnpm censo:relatorio` a partir das capturas em `docs/lattes-formularios/`
e de `src/schema/lattes.json`. Não editar à mão. Como capturar e o que cada
grupo quer dizer está no `README.md` desta pasta.

Formulários no censo: 87, com captura: 85, sem captura: 2.

## Atributos por grupo

| Grupo              | Atributo por formulário | Atributo distinto |
| ------------------ | ----------------------: | ----------------: |
| com opções         |                     343 |               320 |
| texto livre        |                     738 |               606 |
| oculto             |                    1297 |               193 |
| fora do formulário |                     920 |               635 |
| sem captura        |                      93 |                44 |
| total              |                    3391 |              1798 |

## Formulários

"Endereço" diz se o caminho do formulário foi visto no Lattes; "Elementos", se a
ligação do formulário com os elementos do XML foi conferida.

| Formulário                                                                   | Como abre             | Endereço  | Elementos | Captura    | Opções | Texto | Oculto | Fora |
| ---------------------------------------------------------------------------- | --------------------- | --------- | --------- | ---------- | -----: | ----: | -----: | ---: |
| Identificação (`identificacao`)                                              | link do menu          | observado | observado | 2026-10-15 |      5 |     5 |      4 |   14 |
| Endereço (`endereco`)                                                        | link do menu          | observado | observado | 2026-10-15 |      1 |    26 |      1 |    8 |
| Resumo (`resumo`)                                                            | link do menu          | observado | observado | 2026-10-15 |      0 |     2 |      0 |    0 |
| Outras informações relevantes (`outras-informacoes`)                         | link do menu          | observado | observado | 2026-10-15 |      0 |     0 |      0 |    1 |
| Áreas de atuação (`areas-de-atuacao`)                                        | link do menu          | observado | observado | 2026-10-15 |      0 |     0 |      0 |    5 |
| Idiomas (`idioma`)                                                           | endereço conhecido    | observado | observado | 2026-10-15 |      5 |     0 |      0 |    1 |
| Prêmios e títulos (`premio`)                                                 | endereço conhecido    | observado | observado | 2026-10-15 |      0 |     3 |      0 |    1 |
| Licenças (`licenca`)                                                         | endereço conhecido    | observado | inferido  | 2026-10-15 |      1 |     0 |      0 |    4 |
| Formação acadêmica: doutorado (`formacao-FA-4`)                              | endereço conhecido    | observado | inferido  | 2026-10-15 |      3 |    12 |     28 |   13 |
| Formação acadêmica: mestrado (`formacao-FA-3`)                               | endereço conhecido    | observado | observado | 2026-10-15 |      3 |    10 |     28 |   11 |
| Formação acadêmica: mestrado profissional (`formacao-FA-9`)                  | endereço conhecido    | observado | inferido  | 2026-10-15 |      2 |     9 |     27 |    6 |
| Formação acadêmica: especialização (`formacao-FA-2`)                         | endereço conhecido    | observado | inferido  | 2026-10-15 |      2 |     8 |      5 |    4 |
| Formação acadêmica: residência médica (`formacao-FA-D`)                      | endereço conhecido    | observado | inferido  | 2026-10-15 |      2 |     6 |     25 |    1 |
| Formação acadêmica: graduação (`formacao-FA-1`)                              | endereço conhecido    | observado | observado | 2026-10-15 |      2 |     8 |      7 |   11 |
| Formação acadêmica: ensino técnico (`formacao-FA-7`)                         | endereço conhecido    | observado | observado | 2026-10-15 |      2 |     5 |      5 |    3 |
| Formação acadêmica: ensino médio (`formacao-FA-C`)                           | endereço conhecido    | observado | inferido  | 2026-10-15 |      1 |     3 |      3 |    0 |
| Formação acadêmica: ensino fundamental (`formacao-FA-B`)                     | endereço conhecido    | observado | inferido  | 2026-10-15 |      1 |     3 |      3 |    0 |
| Formação acadêmica: aperfeiçoamento (`formacao-FA-X`)                        | endereço conhecido    | observado | inferido  | 2026-10-15 |      2 |     8 |      5 |    5 |
| Formação: pós-doutorado (`formacao-AP-5`)                                    | endereço conhecido    | observado | inferido  | 2026-10-15 |      2 |     4 |     28 |    4 |
| Formação: livre-docência (`formacao-AP-6`)                                   | endereço conhecido    | observado | inferido  | 2026-10-15 |      0 |     3 |     24 |    1 |
| Formação complementar (`formacao-complementar`)                              | endereço conhecido    | observado | observado | 2026-10-15 |      8 |     6 |      9 |   56 |
| Atuação profissional (`atuacao`)                                             | endereço conhecido    | observado | observado | 2026-10-15 |      0 |     4 |      1 |    9 |
| Vínculo de uma atuação (`vinculo`)                                           | link da lista         | observado | observado | 2026-10-15 |      2 |    10 |      0 |    3 |
| Atividade de uma atuação (`atividade`)                                       | link da lista         | inferido  | inferido  | 2026-10-15 |      0 |     0 |      0 |    0 |
| Atividade de uma atuação: direção e administração (`atividade-1`)            | link da lista         | observado | inferido  | 2026-10-15 |      0 |     4 |      0 |    9 |
| Atividade de uma atuação: pesquisa e desenvolvimento (`atividade-2`)         | link da lista         | observado | inferido  | 2026-10-15 |      0 |     4 |      0 |    6 |
| Atividade de uma atuação: ensino (`atividade-4`)                             | link da lista         | observado | inferido  | 2026-10-15 |      0 |     4 |      1 |    8 |
| Atividade de uma atuação: estágio (`atividade-5`)                            | link da lista         | observado | inferido  | 2026-10-15 |      0 |     4 |      0 |    7 |
| Atividade de uma atuação: serviço técnico especializado (`atividade-6`)      | link da lista         | observado | inferido  | 2026-10-15 |      0 |     4 |      0 |    7 |
| Atividade de uma atuação: extensão universitária (`atividade-7`)             | link da lista         | observado | inferido  | 2026-10-15 |      0 |     4 |      0 |    7 |
| Atividade de uma atuação: treinamento (`atividade-8`)                        | link da lista         | observado | inferido  | 2026-10-15 |      0 |     4 |      0 |    7 |
| Atividade de uma atuação: outra atividade técnico-científica (`atividade-9`) | link da lista         | observado | inferido  | 2026-10-15 |      0 |     4 |      0 |    7 |
| Atividade de uma atuação: conselhos, comissões e consultoria (`atividade-B`) | link da lista         | observado | inferido  | 2026-10-15 |      0 |     4 |      0 |    7 |
| Corpo editorial, revisão e assessoramento (MB) (`revisor-MB`)                | endereço conhecido    | observado | inferido  | 2026-10-15 |      0 |     0 |      0 |    0 |
| Corpo editorial, revisão e assessoramento (MA) (`revisor-MA`)                | endereço conhecido    | observado | inferido  | 2026-10-15 |      0 |     0 |      0 |    0 |
| Corpo editorial, revisão e assessoramento (RV) (`revisor-RV`)                | endereço conhecido    | observado | inferido  | 2026-10-15 |      0 |     0 |      0 |    0 |
| Corpo editorial, revisão e assessoramento (RA) (`revisor-RA`)                | endereço conhecido    | observado | inferido  | 2026-10-15 |      0 |     0 |      0 |    0 |
| Linhas de pesquisa (`linha-de-pesquisa`)                                     | link da lista         | inferido  | inferido  | falta      |        |       |        |      |
| Projeto de pesquisa (`projeto-P`)                                            | endereço conhecido    | observado | observado | 2026-10-15 |      3 |    14 |      2 |   18 |
| Projeto de desenvolvimento (`projeto-D`)                                     | endereço conhecido    | observado | observado | 2026-10-15 |      3 |    15 |      1 |   18 |
| Projeto de extensão (`projeto-E`)                                            | endereço conhecido    | observado | observado | 2026-10-15 |      3 |    14 |      2 |   18 |
| Projeto de ensino (`projeto-N`)                                              | endereço conhecido    | observado | observado | 2026-10-15 |      3 |    14 |      2 |   18 |
| Projeto de outros (`projeto-O`)                                              | endereço conhecido    | observado | observado | 2026-10-15 |      3 |    14 |      2 |   18 |
| Artigos completos publicados (`artigo-publicado`)                            | endereço conhecido    | observado | inferido  | 2026-10-15 |      4 |    10 |     27 |    8 |
| Artigos aceitos para publicação (`artigo-aceito`)                            | endereço conhecido    | observado | inferido  | 2026-10-15 |      3 |     6 |     27 |   12 |
| Livros e capítulos (`livro-capitulo`)                                        | link da lista         | inferido  | inferido  | 2026-10-15 |     11 |    19 |     27 |   13 |
| Trabalhos em anais (`trabalho-em-eventos`)                                   | endereço conhecido    | observado | inferido  | 2026-10-15 |      7 |    14 |     27 |    6 |
| Textos em jornais ou revistas (`texto-jornal`)                               | endereço conhecido    | observado | inferido  | 2026-10-15 |      6 |    10 |     27 |    5 |
| Tradução (`traducao`)                                                        | endereço conhecido    | observado | inferido  | 2026-10-15 |      5 |    15 |     27 |    3 |
| Partitura musical (`partitura`)                                              | endereço conhecido    | observado | inferido  | 2026-10-15 |      5 |    10 |     27 |    2 |
| Prefácio, posfácio e outra produção bibliográfica (`prefacio-outras`)        | endereço desconhecido | inferido  | inferido  | falta      |        |       |        |      |
| Patente: janela "Incluir nova patente" (`patente-janela`)                    | endereço conhecido    | observado | inferido  | 2026-10-15 |      0 |     0 |      0 |    0 |
| Patente (`patente`)                                                          | endereço conhecido    | observado | observado | 2026-10-15 |      3 |     9 |     27 |   19 |
| Programa de computador (`registro-PC`)                                       | endereço conhecido    | observado | inferido  | 2026-10-15 |      5 |     8 |     28 |   19 |
| Programa de computador registrado (`registro-PC-S`)                          | endereço conhecido    | observado | inferido  | 2026-10-15 |      5 |     9 |     28 |   18 |
| Cultivar protegida (`registro-CP`)                                           | endereço conhecido    | observado | inferido  | 2026-10-15 |      2 |     7 |     27 |   15 |
| Cultivar registrada (`registro-CR`)                                          | endereço conhecido    | observado | inferido  | 2026-10-15 |      2 |     7 |     27 |   15 |
| Desenho industrial (`registro-DI`)                                           | endereço conhecido    | observado | inferido  | 2026-10-15 |      2 |     8 |     28 |   13 |
| Marca (`registro-MR`)                                                        | endereço conhecido    | observado | inferido  | 2026-10-15 |      4 |     7 |     27 |   13 |
| Topografia de circuito integrado (`registro-TC`)                             | endereço conhecido    | observado | inferido  | 2026-10-15 |      2 |     9 |     27 |   13 |
| Produtos tecnológicos (`produto`)                                            | endereço conhecido    | observado | inferido  | 2026-10-15 |      8 |    10 |     27 |   14 |
| Processos ou técnicas (`processo`)                                           | endereço conhecido    | observado | inferido  | 2026-10-15 |      7 |    10 |     27 |   14 |
| Trabalhos técnicos (`trabalho-tecnico`)                                      | endereço conhecido    | observado | observado | 2026-10-15 |      6 |    10 |     27 |    3 |
| Assessoria e consultoria (`assessoria`)                                      | endereço conhecido    | observado | inferido  | 2026-10-15 |      0 |     0 |      0 |    0 |
| Extensão tecnológica (`extensao-tecnologica`)                                | endereço conhecido    | observado | inferido  | 2026-10-15 |      0 |     0 |      0 |    0 |
| Apresentação de trabalho (`tec-2J`)                                          | endereço conhecido    | observado | inferido  | 2026-10-15 |      5 |     8 |     27 |    3 |
| Carta, mapa ou similar (`tec-2A`)                                            | endereço conhecido    | observado | inferido  | 2026-10-15 |      5 |    10 |     27 |    3 |
| Curso de curta duração (`tec-2B`)                                            | endereço conhecido    | observado | inferido  | 2026-10-15 |      8 |     8 |     27 |    4 |
| Material didático (`tec-2C`)                                                 | endereço conhecido    | observado | inferido  | 2026-10-15 |      5 |     7 |     27 |    4 |
| Editoração (`tec-2D`)                                                        | endereço conhecido    | observado | observado | 2026-10-15 |      5 |     9 |     27 |    2 |
| Manutenção de obra artística (`tec-2E`)                                      | endereço conhecido    | observado | inferido  | 2026-10-15 |      5 |     8 |     27 |    4 |
| Maquete (`tec-2F`)                                                           | endereço conhecido    | observado | inferido  | 2026-10-15 |      4 |     8 |     27 |    4 |
| Organização de evento (`tec-2G`)                                             | endereço conhecido    | observado | inferido  | 2026-10-15 |      9 |     8 |     27 |    3 |
| Programa de rádio ou TV (`tec-2H`)                                           | endereço conhecido    | observado | inferido  | 2026-10-15 |      6 |     9 |     27 |    5 |
| Relatório de pesquisa (`tec-2I`)                                             | endereço conhecido    | observado | inferido  | 2026-10-15 |      5 |     7 |     27 |    3 |
| Redes sociais, sites e blogs (`tec-2L`)                                      | endereço conhecido    | observado | inferido  | 2026-10-15 |      5 |     6 |     27 |    2 |
| Outra produção técnica (`tec-2Z`)                                            | endereço conhecido    | observado | inferido  | 2026-10-15 |      5 |    11 |     27 |   16 |
| Artes cênicas (`arte-AC`)                                                    | endereço conhecido    | observado | inferido  | 2026-10-15 |      8 |    15 |     28 |    4 |
| Música (`arte-MU`)                                                           | endereço conhecido    | observado | inferido  | 2026-10-15 |      8 |    16 |     27 |    5 |
| Artes visuais (`arte-AV`)                                                    | endereço conhecido    | observado | inferido  | 2026-10-15 |      7 |    10 |     27 |    1 |
| Outra produção artística (`arte-OU`)                                         | endereço conhecido    | observado | inferido  | 2026-10-15 |      5 |    11 |     27 |    3 |
| Orientações concluídas (`orientacao-concluida`)                              | endereço conhecido    | observado | inferido  | 2026-10-15 |     17 |    20 |     37 |   48 |
| Orientações em andamento (`orientacao-andamento`)                            | endereço conhecido    | observado | inferido  | 2026-10-15 |     21 |    36 |     37 |   80 |
| Bancas de trabalhos de conclusão (`banca-trabalho`)                          | endereço conhecido    | observado | inferido  | 2026-10-15 |     13 |    28 |     34 |   58 |
| Bancas julgadoras (`banca-julgadora`)                                        | endereço conhecido    | observado | inferido  | 2026-10-15 |     10 |    21 |     26 |   28 |
| Participação em eventos (`evento`)                                           | endereço conhecido    | observado | observado | 2026-10-15 |     37 |    54 |      1 |  116 |
| Demais trabalhos (`demais-trabalhos`)                                        | link da lista         | inferido  | inferido  | 2026-10-15 |      4 |     8 |     27 |    3 |

## Divergências entre o Lattes capturado e o editor

- DADOS-BASICOS-DA-MUSICA@NATUREZA: opções do Lattes sem valor conhecido no XSD (10 valores): 3B1 (Apresentação de Obra (para compositores)), 3B4 (Composição (estréia)) (aceita: os itens de teste de 18/10/2026 deram dois valores para 3B1 (APRESENTACAO_DE_OBRA e COMPOSICAO) no cruzamento pelo índice da variante; sem um valor firme, o editor fica com o XSD)
- DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@NATUREZA: novas no Lattes: Mestrado, Doutorado, Curso de aperfeiçoamento/especialização, Graduação (aceita: o F_COD_PROD da banca reúne todas as naturezas; só A13 e A16 são exame de qualificação, e as outras vão para os elementos de banca de mestrado, doutorado, aperfeiçoamento e graduação)
- DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@NATUREZA: opções do Lattes sem valor conhecido no XSD (4 valores): 41 (Dissertação de mestrado), 42 (Tese de doutorado), 43 (Monografia de conclusão de curso de aperfeiçoamento/especialização), 44 (Trabalho de conclusão de curso de graduação), 46 (Supervisão de pós-doutorado) e mais 1 (aceita: 41, 42 e 46 vão para os elementos de orientação de mestrado, doutorado e pós-doutorado; 43, 44, 45 e 49 batem com o XSD pelo rótulo nos itens de teste de 18/10/2026, mas o mapa das que não bateram se perdia (link.ts, corrigido))
- DADOS-BASICOS-DA-PARTITURA@NATUREZA: opções do Lattes sem valor conhecido no XSD (5 valores): 1B3 (Orquestral), 1B9 (Outra) (aceita: a ligação por valor bateu em todos os itens de teste de 18/10/2026, sem contradição, mas o mapa das opções que não bateram pelo rótulo se perdia (link.ts só guardava o mapa nas ligações por enumeração; corrigido): o valor exato fica para a próxima passada)
- DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR@NATUREZA: opções do Lattes sem valor conhecido no XSD (6 valores): 2A9 (Outro) (aceita: a ligação por valor bateu em todos os itens de teste de 18/10/2026, sem contradição, mas o mapa das opções que não bateram pelo rótulo se perdia (link.ts só guardava o mapa nas ligações por enumeração; corrigido): o valor exato fica para a próxima passada)
- DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO@NIVEL-DO-CURSO: opções do Lattes sem valor conhecido no XSD (5 valores): 2B9 (Outro) (aceita: a ligação por valor bateu em todos os itens de teste de 18/10/2026, sem contradição, mas o mapa das opções que não bateram pelo rótulo se perdia (link.ts só guardava o mapa nas ligações por enumeração; corrigido): o valor exato fica para a próxima passada)
- DADOS-BASICOS-DE-EDITORACAO@NATUREZA: opções do Lattes sem valor conhecido no XSD (8 valores): 2D9 (Outro) (aceita: 2D9 é "Outro" no Lattes e o XSD tem OUTRA; nenhum item com 2D9 mostrou o valor gravado)
- DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO@NATUREZA: opções do Lattes sem valor conhecido no XSD (5 valores): 28 (Outra) (aceita: o XSD não tem valor para 28 (Outra); a ligação por valor bateu nos itens de teste, mas o valor gravado não ficou registrado (link.ts, corrigido))
- DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO@NATUREZA: opções do Lattes sem valor conhecido no XSD (7 valores): 2J2 (Conferência ou palestra) (aceita: a ligação por valor bateu em todos os itens de teste de 18/10/2026, sem contradição, mas o mapa das opções que não bateram pelo rótulo se perdia (link.ts só guardava o mapa nas ligações por enumeração; corrigido): o valor exato fica para a próxima passada)
- DADOS-BASICOS-DA-TRADUCAO@NATUREZA: opções do Lattes sem valor conhecido no XSD (4 valores): 1A9 (Outra) (aceita: a ligação por valor bateu em todos os itens de teste de 18/10/2026, sem contradição, mas o mapa das opções que não bateram pelo rótulo se perdia (link.ts só guardava o mapa nas ligações por enumeração; corrigido): o valor exato fica para a próxima passada)
- DETALHAMENTO-DA-MUSICA@TIPO-DE-EVENTO: o campo f_tpo_evento tem opções no Lattes e o editor mostra texto livre (aceita: nos itens de teste de 18/10/2026 o texto só bateu sem acento e caixa em 4 de 7, com 3 contradições: a grafia exata do XML não está firme para virar lista)
- DETALHAMENTO-DO-PROCESSOS-OU-TECNICAS@DISPONIBILIDADE: o campo f_disp tem opções no Lattes e o editor mostra texto livre (aceita: o XML guarda o texto da opção (Restrita, Irrestrita), mas nos itens de teste de 18/10/2026 só bateu sem acento e caixa: a grafia exata não está firme para virar lista)
- DETALHAMENTO-DO-PRODUTO-TECNOLOGICO@DISPONIBILIDADE: o campo f_disp tem opções no Lattes e o editor mostra texto livre (aceita: o XML guarda o texto da opção (Restrita, Irrestrita), mas nos itens de teste de 18/10/2026 só bateu sem acento e caixa: a grafia exata não está firme para virar lista)
- DETALHAMENTO-DO-RELATORIO-DE-PESQUISA@DISPONIBILIDADE: o campo f_disp tem opções no Lattes e o editor mostra texto livre (aceita: o XML guarda o texto da opção (Restrita, Irrestrita), mas nos itens de teste de 18/10/2026 só bateu sem acento e caixa: a grafia exata não está firme para virar lista)
- DETALHAMENTO-DO-TRABALHO-TECNICO@DISPONIBILIDADE: o campo f_disp tem opções no Lattes e o editor mostra texto livre (aceita: o XML guarda o texto da opção (Restrita, Irrestrita), mas a grafia exata não foi registrada na captura de 15/10/2026; a próxima registra em spelling)

## Lacunas prováveis de opções (ligação inferida)

O mesmo conferido acima, para campos ligados ao atributo só pelo nome. O teste
não cobra estas até a passada de edição observar a ligação.

- DADOS-GERAIS@PAIS-DE-NACIONALIDADE: novas no Lattes: República Tcheca, República Tcheca
- DADOS-GERAIS@SEXO: opções do Lattes sem valor conhecido no XSD (2 valores): M (), F ()
- LICENCA@TIPO-LICENCA: opções do Lattes sem valor conhecido no XSD (1 valores): P (Paternidade), A (Adoção)
- DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV@MEIO-DE-DIVULGACAO: opções do Lattes sem valor conhecido no XSD (9 valores): O (Outrooutro)
- DADOS-GERAIS@PCD: o campo f_pcd tem opções no Lattes e o editor mostra texto livre

## Lacunas

Formulários sem captura: `linha-de-pesquisa`, `prefacio-outras`.

Elementos do schema que nenhum formulário do censo cobre: `APRESENTACAO-DE-OBRA-ARTISTICA`, `APRESENTACAO-EM-RADIO-OU-TV`, `ARRANJO-MUSICAL`, `COMPOSICAO-MUSICAL`, `CURRICULO-VITAE`, `CURSO-DE-CURTA-DURACAO`, `DADOS-BASICOS-DA-APRESENTACAO-DE-OBRA-ARTISTICA`, `DADOS-BASICOS-DA-APRESENTACAO-EM-RADIO-OU-TV`, `DADOS-BASICOS-DA-COMPOSICAO-MUSICAL`, `DADOS-BASICOS-DA-OBRA-DE-ARTES-VISUAIS`, `DADOS-BASICOS-DE-SONOPLASTIA`, `DADOS-BASICOS-DO-ARRANJO-MUSICAL`, `DADOS-BASICOS-DO-CURSO-DE-CURTA-DURACAO`, `DETALHAMENTO-DA-APRESENTACAO-DE-OBRA-ARTISTICA`, `DETALHAMENTO-DA-APRESENTACAO-EM-RADIO-OU-TV`, `DETALHAMENTO-DA-COMPOSICAO-MUSICAL`, `DETALHAMENTO-DA-OBRA-DE-ARTES-VISUAIS`, `DETALHAMENTO-DE-SONOPLASTIA`, `DETALHAMENTO-DO-ARRANJO-MUSICAL`, `DETALHAMENTO-DO-CURSO-DE-CURTA-DURACAO`, `INFORMACAO-ADICIONAL-CURSO`, `INFORMACAO-ADICIONAL-INSTITUICAO`, `OBRA-DE-ARTES-VISUAIS`, `SONOPLASTIA`.

## Atributos de cada formulário capturado

<details><summary>Identificação (identificacao)</summary>

**com opções**

- `DADOS-GERAIS@PAIS-DE-NASCIMENTO` ← `f_pais_nasc` (inferido)
- `DADOS-GERAIS@UF-NASCIMENTO` ← `f_uf_nasc` (inferido)
- `DADOS-GERAIS@SEXO` ← `f_sexo` (inferido)
- `DADOS-GERAIS@PAIS-DE-NACIONALIDADE` ← `f_pais_nacio` (inferido)
- `DADOS-GERAIS@PCD` ← `f_pcd` (inferido)

**texto livre**

- `DADOS-GERAIS@NOME-COMPLETO` ← `f_nome_social` (observado)
- `DADOS-GERAIS@NUMERO-DO-PASSAPORTE` ← `f_passaporte` (inferido)
- `DADOS-GERAIS@CIDADE-NASCIMENTO` ← `f_cidade_nasc` (observado)
- `DADOS-GERAIS@NUMERO-IDENTIDADE` ← `f_rg_nro` (observado)
- `DADOS-GERAIS@ORGAO-EMISSOR` ← `f_orgao_rg` (observado)

**oculto**

- `DADOS-GERAIS@NACIONALIDADE` ← `f_nacionalidade` (documentado)
- `DADOS-GERAIS@CPF` ← `f_cpf` (observado)
- `DADOS-GERAIS@NOME-DO-PAI` ← `f_nome_pai` (observado)
- `DADOS-GERAIS@NOME-DA-MAE` ← `f_nome_mae` (observado)

**fora do formulário**

- `DADOS-GERAIS@NOME-EM-CITACOES-BIBLIOGRAFICAS`
- `DADOS-GERAIS@FORMATO-DATA-DE-NASCIMENTO`
- `DADOS-GERAIS@DATA-NASCIMENTO`
- `DADOS-GERAIS@UF-ORGAO-EMISSOR`
- `DADOS-GERAIS@FORMATO-DATA-DE-EMISSAO`
- `DADOS-GERAIS@DATA-DE-EMISSAO`
- `DADOS-GERAIS@PERMISSAO-DE-DIVULGACAO`
- `DADOS-GERAIS@NOME-DO-ARQUIVO-DE-FOTO`
- `DADOS-GERAIS@TEXTO-RESUMO-CV-RH`
- `DADOS-GERAIS@OUTRAS-INFORMACOES-RELEVANTES`
- `DADOS-GERAIS@DATA-FALECIMENTO`
- `DADOS-GERAIS@SIGLA-PAIS-NACIONALIDADE`
- `DADOS-GERAIS@RACA-OU-COR`
- `DADOS-GERAIS@ORCID-ID`

</details>

<details><summary>Endereço (endereco)</summary>

**com opções**

- `ENDERECO-RESIDENCIAL@PAIS` ← `f_pais_r` (observado)

**texto livre**

- `ENDERECO-PROFISSIONAL@NOME-INSTITUICAO-EMPRESA` ← `f_inst` (inferido)
- `ENDERECO-PROFISSIONAL@NOME-ORGAO` ← `f_orgao` (inferido)
- `ENDERECO-PROFISSIONAL@LOGRADOURO-COMPLEMENTO` ← `f_rua_i` (inferido)
- `ENDERECO-PROFISSIONAL@UF` ← `f_estado_i` (inferido)
- `ENDERECO-PROFISSIONAL@CEP` ← `f_cep_i` (inferido)
- `ENDERECO-PROFISSIONAL@CIDADE` ← `f_munic_i` (inferido)
- `ENDERECO-PROFISSIONAL@BAIRRO` ← `f_bairro_i` (inferido)
- `ENDERECO-PROFISSIONAL@DDD` ← `f_ddd_i` (inferido)
- `ENDERECO-PROFISSIONAL@TELEFONE` ← `f_fone_i` (inferido)
- `ENDERECO-PROFISSIONAL@RAMAL` ← `f_ramal_i` (inferido)
- `ENDERECO-PROFISSIONAL@FAX` ← `f_fax_i` (inferido)
- `ENDERECO-PROFISSIONAL@CAIXA-POSTAL` ← `f_caixa_i` (inferido)
- `ENDERECO-PROFISSIONAL@E-MAIL` ← `f_email_i` (observado)
- `ENDERECO-PROFISSIONAL@HOME-PAGE` ← `f_homepage_i` (inferido)
- `ENDERECO-RESIDENCIAL@LOGRADOURO` ← `f_rua_r` (observado)
- `ENDERECO-RESIDENCIAL@UF` ← `f_estado_r` (observado)
- `ENDERECO-RESIDENCIAL@CEP` ← `f_cep_r` (inferido)
- `ENDERECO-RESIDENCIAL@CIDADE` ← `f_munic_r` (observado)
- `ENDERECO-RESIDENCIAL@BAIRRO` ← `f_bairro_r` (observado)
- `ENDERECO-RESIDENCIAL@DDD` ← `f_ddd_r` (observado)
- `ENDERECO-RESIDENCIAL@TELEFONE` ← `f_fone_r` (observado)
- `ENDERECO-RESIDENCIAL@RAMAL` ← `f_ramal_r` (inferido)
- `ENDERECO-RESIDENCIAL@FAX` ← `f_fax_r` (inferido)
- `ENDERECO-RESIDENCIAL@CAIXA-POSTAL` ← `f_caixa_r` (inferido)
- `ENDERECO-RESIDENCIAL@E-MAIL` ← `f_email_r` (inferido)
- `ENDERECO-RESIDENCIAL@HOME-PAGE` ← `f_homepage_r` (observado)

**oculto**

- `ENDERECO-PROFISSIONAL@CODIGO-INSTITUICAO-EMPRESA` ← `f_cod_inst` (inferido)

**fora do formulário**

- `ENDERECO@FLAG-DE-PREFERENCIA`
- `ENDERECO@REDE-SOCIAL`
- `ENDERECO@ELETRONICO`
- `ENDERECO@OUTRA-FORMA-DE-CONTATO`
- `ENDERECO-PROFISSIONAL@CODIGO-ORGAO`
- `ENDERECO-PROFISSIONAL@CODIGO-UNIDADE`
- `ENDERECO-PROFISSIONAL@NOME-UNIDADE`
- `ENDERECO-PROFISSIONAL@PAIS`

</details>

<details><summary>Resumo (resumo)</summary>

**texto livre**

- `RESUMO-CV@TEXTO-RESUMO-CV-RH` ← `F_TEXTO` (observado)
- `RESUMO-CV@TEXTO-RESUMO-CV-RH-EN` ← `F_TEXTO_EN` (observado)

</details>

<details><summary>Outras informações relevantes (outras-informacoes)</summary>

**fora do formulário**

- `OUTRAS-INFORMACOES-RELEVANTES@OUTRAS-INFORMACOES-RELEVANTES`

</details>

<details><summary>Áreas de atuação (areas-de-atuacao)</summary>

**fora do formulário**

- `AREA-DE-ATUACAO@SEQUENCIA-AREA-DE-ATUACAO`
- `AREA-DE-ATUACAO@NOME-GRANDE-AREA-DO-CONHECIMENTO`
- `AREA-DE-ATUACAO@NOME-DA-AREA-DO-CONHECIMENTO`
- `AREA-DE-ATUACAO@NOME-DA-SUB-AREA-DO-CONHECIMENTO`
- `AREA-DE-ATUACAO@NOME-DA-ESPECIALIDADE`

</details>

<details><summary>Idiomas (idioma)</summary>

**com opções**

- `IDIOMA@IDIOMA` ← `F_COD_IDIOMA` (documentado)
- `IDIOMA@PROFICIENCIA-DE-LEITURA` ← `F_LE` (documentado)
- `IDIOMA@PROFICIENCIA-DE-FALA` ← `F_CONVERSA` (documentado)
- `IDIOMA@PROFICIENCIA-DE-ESCRITA` ← `F_ESCREVE` (documentado)
- `IDIOMA@PROFICIENCIA-DE-COMPREENSAO` ← `F_COMPR` (documentado)

**fora do formulário**

- `IDIOMA@DESCRICAO-DO-IDIOMA`

</details>

<details><summary>Prêmios e títulos (premio)</summary>

**texto livre**

- `PREMIO-TITULO@NOME-DO-PREMIO-OU-TITULO` ← `f_titulo` (observado)
- `PREMIO-TITULO@NOME-DA-ENTIDADE-PROMOTORA` ← `f_agencia` (observado)
- `PREMIO-TITULO@ANO-DA-PREMIACAO` ← `f_ano` (observado)

**fora do formulário**

- `PREMIO-TITULO@NOME-DO-PREMIO-OU-TITULO-INGLES`

</details>

<details><summary>Licenças (licenca)</summary>

**com opções**

- `LICENCA@TIPO-LICENCA` ← `f_tipo_licenca` (inferido)

**fora do formulário**

- `LICENCA@FORMATO-DATA-INICIO-LICENCA`
- `LICENCA@DATA-INICIO-LICENCA`
- `LICENCA@FORMATO-DATA-FIM-LICENCA`
- `LICENCA@DATA-FIM-LICENCA`

</details>

<details><summary>Formação acadêmica: doutorado (formacao-FA-4)</summary>

**com opções**

- `DOUTORADO@STATUS-DO-CURSO` ← `F_STATUS` (observado)
- `DOUTORADO@FLAG-BOLSA` ← `F_BOLSA` (observado)
- `DOUTORADO@TIPO-DOUTORADO` ← `f_tpo_doutorado` (observado)

**texto livre**

- `DOUTORADO@NOME-INSTITUICAO` ← `f_inst` (observado)
- `DOUTORADO@NOME-CURSO` ← `f_curso` (observado)
- `DOUTORADO@ANO-DE-INICIO` ← `f_ano_ini` (observado)
- `DOUTORADO@ANO-DE-CONCLUSAO` ← `f_ano_fim` (observado)
- `DOUTORADO@NOME-AGENCIA` ← `f_nme_agencia` (inferido)
- `DOUTORADO@ANO-DE-OBTENCAO-DO-TITULO` ← `f_ano_obten` (inferido)
- `DOUTORADO@TITULO-DA-DISSERTACAO-TESE` ← `f_titulo` (observado)
- `DOUTORADO@NOME-COMPLETO-DO-ORIENTADOR` ← `f_orient` (observado)
- `DOUTORADO@NOME-ORIENTADOR-DOUT` ← `f_orient_dout` (observado)
- `DOUTORADO@NOME-DO-ORIENTADOR-CO-TUTELA` ← `f_orient_dout_ct` (observado)
- `DOUTORADO@NOME-DO-ORIENTADOR-SANDUICHE` ← `f_orient_dout_sw` (observado)
- `DOUTORADO@NOME-DO-CO-ORIENTADOR` ← `f_coorient` (observado)

**oculto**

- `DOUTORADO@SEQUENCIA-FORMACAO` ← `f_seq` (observado)
- `DOUTORADO@NIVEL` ← `f_nivel` (inferido)
- `DOUTORADO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DOUTORADO@CODIGO-CURSO` ← `f_cod_curso` (observado)
- `DOUTORADO@CODIGO-AGENCIA-FINANCIADORA` ← `f_agencia` (observado)
- `DOUTORADO@CODIGO-INSTITUICAO-DOUT` ← `f_cod_inst_dout` (inferido)
- `DOUTORADO@NUMERO-ID-ORIENTADOR` ← `f_id_orientador` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DOUTORADO@CODIGO-ORGAO`
- `DOUTORADO@NOME-ORGAO`
- `DOUTORADO@CODIGO-AREA-CURSO`
- `DOUTORADO@NOME-INSTITUICAO-DOUT`
- `DOUTORADO@CODIGO-INSTITUICAO-OUTRA-DOUT`
- `DOUTORADO@NOME-INSTITUICAO-OUTRA-DOUT`
- `DOUTORADO@CODIGO-CURSO-CAPES`
- `DOUTORADO@TITULO-DA-DISSERTACAO-TESE-INGLES`
- `DOUTORADO@NOME-CURSO-INGLES`
- `DOUTORADO@CODIGO-INSTITUICAO-OUTRA-CO-TUTELA`
- `DOUTORADO@CODIGO-INSTITUICAO-CO-TUTELA`
- `DOUTORADO@CODIGO-INSTITUICAO-OUTRA-SANDUICHE`
- `DOUTORADO@CODIGO-INSTITUICAO-SANDUICHE`

</details>

<details><summary>Formação acadêmica: mestrado (formacao-FA-3)</summary>

**com opções**

- `MESTRADO@STATUS-DO-CURSO` ← `F_STATUS` (observado)
- `MESTRADO@FLAG-BOLSA` ← `F_BOLSA` (observado)
- `MESTRADO@TIPO-MESTRADO` ← `f_tpo_doutorado` (documentado)

**texto livre**

- `MESTRADO@NOME-INSTITUICAO` ← `f_inst` (observado)
- `MESTRADO@NOME-CURSO` ← `f_curso` (observado)
- `MESTRADO@ANO-DE-INICIO` ← `f_ano_ini` (observado)
- `MESTRADO@ANO-DE-CONCLUSAO` ← `f_ano_fim` (observado)
- `MESTRADO@NOME-AGENCIA` ← `f_nme_agencia` (inferido)
- `MESTRADO@ANO-DE-OBTENCAO-DO-TITULO` ← `f_ano_obten` (inferido)
- `MESTRADO@TITULO-DA-DISSERTACAO-TESE` ← `f_titulo` (observado)
- `MESTRADO@NOME-COMPLETO-DO-ORIENTADOR` ← `f_orient` (observado)
- `MESTRADO@NOME-DO-CO-ORIENTADOR` ← `f_coorient` (observado)
- `MESTRADO@NOME-ORIENTADOR-DOUT` ← `f_orient_dout` (observado)

**oculto**

- `MESTRADO@SEQUENCIA-FORMACAO` ← `f_seq` (observado)
- `MESTRADO@NIVEL` ← `f_nivel` (inferido)
- `MESTRADO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `MESTRADO@CODIGO-CURSO` ← `f_cod_curso` (observado)
- `MESTRADO@CODIGO-AGENCIA-FINANCIADORA` ← `f_agencia` (observado)
- `MESTRADO@NUMERO-ID-ORIENTADOR` ← `f_id_orientador` (inferido)
- `MESTRADO@CODIGO-INSTITUICAO-DOUT` ← `f_cod_inst_dout` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `MESTRADO@CODIGO-ORGAO`
- `MESTRADO@NOME-ORGAO`
- `MESTRADO@CODIGO-AREA-CURSO`
- `MESTRADO@CODIGO-CURSO-CAPES`
- `MESTRADO@TITULO-DA-DISSERTACAO-TESE-INGLES`
- `MESTRADO@NOME-CURSO-INGLES`
- `MESTRADO@NOME-INSTITUICAO-DOUT`
- `MESTRADO@CODIGO-INSTITUICAO-OUTRA-DOUT`
- `MESTRADO@NOME-INSTITUICAO-OUTRA-DOUT`
- `MESTRADO@ID-OASIS`
- `MESTRADO@STATUS-OASISBR`

</details>

<details><summary>Formação acadêmica: mestrado profissional (formacao-FA-9)</summary>

**com opções**

- `MESTRADO-PROFISSIONALIZANTE@STATUS-DO-CURSO` ← `F_STATUS` (observado)
- `MESTRADO-PROFISSIONALIZANTE@FLAG-BOLSA` ← `F_BOLSA` (observado)

**texto livre**

- `MESTRADO-PROFISSIONALIZANTE@NOME-INSTITUICAO` ← `f_inst` (observado)
- `MESTRADO-PROFISSIONALIZANTE@NOME-CURSO` ← `f_curso` (observado)
- `MESTRADO-PROFISSIONALIZANTE@ANO-DE-INICIO` ← `f_ano_ini` (observado)
- `MESTRADO-PROFISSIONALIZANTE@ANO-DE-CONCLUSAO` ← `f_ano_fim` (observado)
- `MESTRADO-PROFISSIONALIZANTE@NOME-AGENCIA` ← `f_nme_agencia` (inferido)
- `MESTRADO-PROFISSIONALIZANTE@ANO-DE-OBTENCAO-DO-TITULO` ← `f_ano_obten` (inferido)
- `MESTRADO-PROFISSIONALIZANTE@TITULO-DA-DISSERTACAO-TESE` ← `f_titulo` (observado)
- `MESTRADO-PROFISSIONALIZANTE@NOME-COMPLETO-DO-ORIENTADOR` ← `f_orient` (observado)
- `MESTRADO-PROFISSIONALIZANTE@NOME-DO-CO-ORIENTADOR` ← `f_coorient` (observado)

**oculto**

- `MESTRADO-PROFISSIONALIZANTE@SEQUENCIA-FORMACAO` ← `f_seq` (observado)
- `MESTRADO-PROFISSIONALIZANTE@NIVEL` ← `f_nivel` (inferido)
- `MESTRADO-PROFISSIONALIZANTE@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `MESTRADO-PROFISSIONALIZANTE@CODIGO-CURSO` ← `f_cod_curso` (observado)
- `MESTRADO-PROFISSIONALIZANTE@CODIGO-AGENCIA-FINANCIADORA` ← `f_agencia` (observado)
- `MESTRADO-PROFISSIONALIZANTE@NUMERO-ID-ORIENTADOR` ← `f_id_orientador` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `MESTRADO-PROFISSIONALIZANTE@CODIGO-ORGAO`
- `MESTRADO-PROFISSIONALIZANTE@NOME-ORGAO`
- `MESTRADO-PROFISSIONALIZANTE@CODIGO-AREA-CURSO`
- `MESTRADO-PROFISSIONALIZANTE@CODIGO-CURSO-CAPES`
- `MESTRADO-PROFISSIONALIZANTE@TITULO-DA-DISSERTACAO-TESE-INGLES`
- `MESTRADO-PROFISSIONALIZANTE@NOME-CURSO-INGLES`

</details>

<details><summary>Formação acadêmica: especialização (formacao-FA-2)</summary>

**com opções**

- `ESPECIALIZACAO@STATUS-DO-CURSO` ← `F_STATUS` (observado)
- `ESPECIALIZACAO@FLAG-BOLSA` ← `F_BOLSA` (observado)

**texto livre**

- `ESPECIALIZACAO@TITULO-DA-MONOGRAFIA` ← `f_titulo` (observado)
- `ESPECIALIZACAO@NOME-DO-ORIENTADOR` ← `f_orient` (observado)
- `ESPECIALIZACAO@NOME-INSTITUICAO` ← `f_inst` (observado)
- `ESPECIALIZACAO@NOME-CURSO` ← `f_curso` (observado)
- `ESPECIALIZACAO@ANO-DE-INICIO` ← `f_ano_ini` (observado)
- `ESPECIALIZACAO@ANO-DE-CONCLUSAO` ← `f_ano_fim` (observado)
- `ESPECIALIZACAO@NOME-AGENCIA` ← `f_nme_agencia` (inferido)
- `ESPECIALIZACAO@CARGA-HORARIA` ← `f_carga` (observado)

**oculto**

- `ESPECIALIZACAO@SEQUENCIA-FORMACAO` ← `f_seq` (observado)
- `ESPECIALIZACAO@NIVEL` ← `f_nivel` (inferido)
- `ESPECIALIZACAO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `ESPECIALIZACAO@CODIGO-CURSO` ← `f_cod_curso` (observado)
- `ESPECIALIZACAO@CODIGO-AGENCIA-FINANCIADORA` ← `f_agencia` (observado)

**fora do formulário**

- `ESPECIALIZACAO@CODIGO-ORGAO`
- `ESPECIALIZACAO@NOME-ORGAO`
- `ESPECIALIZACAO@TITULO-DA-MONOGRAFIA-INGLES`
- `ESPECIALIZACAO@NOME-CURSO-INGLES`

</details>

<details><summary>Formação acadêmica: residência médica (formacao-FA-D)</summary>

**com opções**

- `RESIDENCIA-MEDICA@STATUS-DO-CURSO` ← `F_STATUS` (observado)
- `RESIDENCIA-MEDICA@FLAG-BOLSA` ← `F_BOLSA` (observado)

**texto livre**

- `RESIDENCIA-MEDICA@NOME-INSTITUICAO` ← `f_inst` (observado)
- `RESIDENCIA-MEDICA@ANO-DE-INICIO` ← `f_ano_ini` (observado)
- `RESIDENCIA-MEDICA@ANO-DE-CONCLUSAO` ← `f_ano_fim` (observado)
- `RESIDENCIA-MEDICA@NOME-AGENCIA` ← `f_nme_agencia` (inferido)
- `RESIDENCIA-MEDICA@TITULO-DA-RESIDENCIA-MEDICA` ← `f_titulo` (observado)
- `RESIDENCIA-MEDICA@NUMERO-DO-REGISTRO` ← `f_orient` (observado)

**oculto**

- `RESIDENCIA-MEDICA@SEQUENCIA-FORMACAO` ← `f_seq` (observado)
- `RESIDENCIA-MEDICA@NIVEL` ← `f_nivel` (inferido)
- `RESIDENCIA-MEDICA@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `RESIDENCIA-MEDICA@CODIGO-AGENCIA-FINANCIADORA` ← `f_agencia` (observado)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `RESIDENCIA-MEDICA@TITULO-DA-RESIDENCIA-MEDICA-INGLES`

</details>

<details><summary>Formação acadêmica: graduação (formacao-FA-1)</summary>

**com opções**

- `GRADUACAO@STATUS-DO-CURSO` ← `F_STATUS` (observado)
- `GRADUACAO@FLAG-BOLSA` ← `F_BOLSA` (observado)

**texto livre**

- `GRADUACAO@TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO` ← `f_titulo` (observado)
- `GRADUACAO@NOME-DO-ORIENTADOR` ← `f_orient` (observado)
- `GRADUACAO@NOME-INSTITUICAO` ← `f_inst` (observado)
- `GRADUACAO@NOME-CURSO` ← `f_curso` (observado)
- `GRADUACAO@ANO-DE-INICIO` ← `f_ano_ini` (observado)
- `GRADUACAO@ANO-DE-CONCLUSAO` ← `f_ano_fim` (observado)
- `GRADUACAO@NOME-AGENCIA` ← `f_nme_agencia` (inferido)
- `GRADUACAO@NOME-ORIENTADOR-GRAD` ← `f_orient_dout` (observado)

**oculto**

- `GRADUACAO@SEQUENCIA-FORMACAO` ← `f_seq` (observado)
- `GRADUACAO@NIVEL` ← `f_nivel` (inferido)
- `GRADUACAO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `GRADUACAO@CODIGO-CURSO` ← `f_cod_curso` (observado)
- `GRADUACAO@CODIGO-AGENCIA-FINANCIADORA` ← `f_agencia` (observado)
- `GRADUACAO@NUMERO-ID-ORIENTADOR` ← `f_id_orientador` (inferido)
- `GRADUACAO@TIPO-GRADUACAO` ← `f_tipo` (inferido)

**fora do formulário**

- `GRADUACAO@CODIGO-ORGAO`
- `GRADUACAO@NOME-ORGAO`
- `GRADUACAO@CODIGO-AREA-CURSO`
- `GRADUACAO@CODIGO-CURSO-CAPES`
- `GRADUACAO@TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO-INGLES`
- `GRADUACAO@NOME-CURSO-INGLES`
- `GRADUACAO@FORMACAO-ACADEMICA-TITULACAO`
- `GRADUACAO@CODIGO-INSTITUICAO-GRAD`
- `GRADUACAO@NOME-INSTITUICAO-GRAD`
- `GRADUACAO@CODIGO-INSTITUICAO-OUTRA-GRAD`
- `GRADUACAO@NOME-INSTITUICAO-OUTRA-GRAD`

</details>

<details><summary>Formação acadêmica: ensino técnico (formacao-FA-7)</summary>

**com opções**

- `CURSO-TECNICO-PROFISSIONALIZANTE@STATUS-DO-CURSO` ← `F_STATUS` (observado)
- `CURSO-TECNICO-PROFISSIONALIZANTE@FLAG-BOLSA` ← `F_BOLSA` (observado)

**texto livre**

- `CURSO-TECNICO-PROFISSIONALIZANTE@NOME-INSTITUICAO` ← `f_inst` (observado)
- `CURSO-TECNICO-PROFISSIONALIZANTE@NOME-CURSO` ← `f_curso` (observado)
- `CURSO-TECNICO-PROFISSIONALIZANTE@ANO-DE-INICIO` ← `f_ano_ini` (observado)
- `CURSO-TECNICO-PROFISSIONALIZANTE@ANO-DE-CONCLUSAO` ← `f_ano_fim` (observado)
- `CURSO-TECNICO-PROFISSIONALIZANTE@NOME-AGENCIA` ← `f_nme_agencia` (inferido)

**oculto**

- `CURSO-TECNICO-PROFISSIONALIZANTE@SEQUENCIA-FORMACAO` ← `f_seq` (observado)
- `CURSO-TECNICO-PROFISSIONALIZANTE@NIVEL` ← `f_nivel` (inferido)
- `CURSO-TECNICO-PROFISSIONALIZANTE@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `CURSO-TECNICO-PROFISSIONALIZANTE@CODIGO-CURSO` ← `f_cod_curso` (observado)
- `CURSO-TECNICO-PROFISSIONALIZANTE@CODIGO-AGENCIA-FINANCIADORA` ← `f_agencia` (observado)

**fora do formulário**

- `CURSO-TECNICO-PROFISSIONALIZANTE@CODIGO-ORGAO`
- `CURSO-TECNICO-PROFISSIONALIZANTE@NOME-ORGAO`
- `CURSO-TECNICO-PROFISSIONALIZANTE@NOME-CURSO-INGLES`

</details>

<details><summary>Formação acadêmica: ensino médio (formacao-FA-C)</summary>

**com opções**

- `ENSINO-MEDIO-SEGUNDO-GRAU@STATUS-DO-CURSO` ← `F_STATUS` (observado)

**texto livre**

- `ENSINO-MEDIO-SEGUNDO-GRAU@NOME-INSTITUICAO` ← `f_inst` (observado)
- `ENSINO-MEDIO-SEGUNDO-GRAU@ANO-DE-INICIO` ← `f_ano_ini` (observado)
- `ENSINO-MEDIO-SEGUNDO-GRAU@ANO-DE-CONCLUSAO` ← `f_ano_fim` (observado)

**oculto**

- `ENSINO-MEDIO-SEGUNDO-GRAU@SEQUENCIA-FORMACAO` ← `f_seq` (observado)
- `ENSINO-MEDIO-SEGUNDO-GRAU@NIVEL` ← `f_nivel` (inferido)
- `ENSINO-MEDIO-SEGUNDO-GRAU@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)

</details>

<details><summary>Formação acadêmica: ensino fundamental (formacao-FA-B)</summary>

**com opções**

- `ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU@STATUS-DO-CURSO` ← `F_STATUS` (observado)

**texto livre**

- `ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU@NOME-INSTITUICAO` ← `f_inst` (observado)
- `ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU@ANO-DE-INICIO` ← `f_ano_ini` (observado)
- `ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU@ANO-DE-CONCLUSAO` ← `f_ano_fim` (observado)

**oculto**

- `ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU@SEQUENCIA-FORMACAO` ← `f_seq` (observado)
- `ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU@NIVEL` ← `f_nivel` (inferido)
- `ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)

</details>

<details><summary>Formação acadêmica: aperfeiçoamento (formacao-FA-X)</summary>

**com opções**

- `APERFEICOAMENTO@STATUS-DO-CURSO` ← `F_STATUS` (observado)
- `APERFEICOAMENTO@FLAG-BOLSA` ← `F_BOLSA` (observado)

**texto livre**

- `APERFEICOAMENTO@TITULO-DA-MONOGRAFIA` ← `f_titulo` (observado)
- `APERFEICOAMENTO@NOME-DO-ORIENTADOR` ← `f_orient` (observado)
- `APERFEICOAMENTO@NOME-INSTITUICAO` ← `f_inst` (observado)
- `APERFEICOAMENTO@NOME-CURSO` ← `f_curso` (observado)
- `APERFEICOAMENTO@ANO-DE-INICIO` ← `f_ano_ini` (observado)
- `APERFEICOAMENTO@ANO-DE-CONCLUSAO` ← `f_ano_fim` (observado)
- `APERFEICOAMENTO@NOME-AGENCIA` ← `f_nme_agencia` (inferido)
- `APERFEICOAMENTO@CARGA-HORARIA` ← `f_carga` (observado)

**oculto**

- `APERFEICOAMENTO@SEQUENCIA-FORMACAO` ← `f_seq` (observado)
- `APERFEICOAMENTO@NIVEL` ← `f_nivel` (inferido)
- `APERFEICOAMENTO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `APERFEICOAMENTO@CODIGO-CURSO` ← `f_cod_curso` (observado)
- `APERFEICOAMENTO@CODIGO-AGENCIA-FINANCIADORA` ← `f_agencia` (observado)

**fora do formulário**

- `APERFEICOAMENTO@CODIGO-ORGAO`
- `APERFEICOAMENTO@NOME-ORGAO`
- `APERFEICOAMENTO@CODIGO-AREA-CURSO`
- `APERFEICOAMENTO@TITULO-DA-MONOGRAFIA-INGLES`
- `APERFEICOAMENTO@NOME-CURSO-INGLES`

</details>

<details><summary>Formação: pós-doutorado (formacao-AP-5)</summary>

**com opções**

- `POS-DOUTORADO@FLAG-BOLSA` ← `F_BOLSA` (observado)
- `POS-DOUTORADO@STATUS-DO-CURSO` ← `F_STATUS` (observado)

**texto livre**

- `POS-DOUTORADO@NOME-INSTITUICAO` ← `f_inst` (observado)
- `POS-DOUTORADO@ANO-DE-INICIO` ← `f_ano_ini` (observado)
- `POS-DOUTORADO@ANO-DE-CONCLUSAO` ← `f_ano_fim` (observado)
- `POS-DOUTORADO@NOME-AGENCIA` ← `f_nme_agencia` (inferido)

**oculto**

- `POS-DOUTORADO@SEQUENCIA-FORMACAO` ← `f_seq` (observado)
- `POS-DOUTORADO@NIVEL` ← `f_nivel` (inferido)
- `POS-DOUTORADO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `POS-DOUTORADO@ANO-DE-OBTENCAO-DO-TITULO` ← `f_ano_obten` (inferido)
- `POS-DOUTORADO@CODIGO-AGENCIA-FINANCIADORA` ← `f_agencia` (observado)
- `POS-DOUTORADO@CODIGO-CURSO-CAPES` ← `f_cod_curso` (inferido)
- `POS-DOUTORADO@TITULO-DO-TRABALHO` ← `f_titulo` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `POS-DOUTORADO@STATUS-DO-ESTAGIO`
- `POS-DOUTORADO@NUMERO-ID-ORIENTADOR`
- `POS-DOUTORADO@TITULO-DO-TRABALHO-INGLES`
- `POS-DOUTORADO@NOME-CURSO-INGLES`

</details>

<details><summary>Formação: livre-docência (formacao-AP-6)</summary>

**texto livre**

- `LIVRE-DOCENCIA@NOME-INSTITUICAO` ← `f_inst` (observado)
- `LIVRE-DOCENCIA@ANO-DE-OBTENCAO-DO-TITULO` ← `f_ano_obten` (observado)
- `LIVRE-DOCENCIA@TITULO-DO-TRABALHO` ← `f_titulo` (observado)

**oculto**

- `LIVRE-DOCENCIA@SEQUENCIA-FORMACAO` ← `f_seq` (observado)
- `LIVRE-DOCENCIA@NIVEL` ← `f_nivel` (inferido)
- `LIVRE-DOCENCIA@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `LIVRE-DOCENCIA@TITULO-DO-TRABALHO-INGLES`

</details>

<details><summary>Formação complementar (formacao-complementar)</summary>

**com opções**

- `FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO@NIVEL` ← `f_nivel` (documentado)
- `FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO@STATUS-DO-CURSO` ← `F_STATUS` (inferido)
- `FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA@NIVEL` ← `f_nivel` (documentado)
- `FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA@STATUS-DO-CURSO` ← `F_STATUS` (inferido)
- `MBA@NIVEL` ← `f_nivel` (documentado)
- `MBA@STATUS-DO-CURSO` ← `F_STATUS` (inferido)
- `OUTROS@NIVEL` ← `f_nivel` (documentado)
- `OUTROS@STATUS-DO-CURSO` ← `F_STATUS` (observado)

**texto livre**

- `FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO@CARGA-HORARIA` ← `f_carga` (inferido)
- `FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA@CARGA-HORARIA` ← `f_carga` (inferido)
- `MBA@CARGA-HORARIA` ← `f_carga` (inferido)
- `OUTROS@CARGA-HORARIA` ← `f_carga` (observado)
- `OUTROS@NOME-INSTITUICAO` ← `f_inst` (observado)
- `OUTROS@NOME-CURSO` ← `f_curso` (observado)

**oculto**

- `FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `MBA@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `MBA@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `OUTROS@SEQUENCIA-FORMACAO` ← `f_seq` (observado)
- `OUTROS@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `OUTROS@CODIGO-CURSO` ← `f_cod_curso2` (observado)

**fora do formulário**

- `FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO@SEQUENCIA-FORMACAO`
- `FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO@NOME-INSTITUICAO`
- `FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO@CODIGO-ORGAO`
- `FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO@NOME-ORGAO`
- `FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO@NOME-CURSO`
- `FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO@ANO-DE-INICIO`
- `FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO@ANO-DE-CONCLUSAO`
- `FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO@NOME-CURSO-INGLES`
- `FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA@SEQUENCIA-FORMACAO`
- `FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA@NOME-INSTITUICAO`
- `FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA@CODIGO-ORGAO`
- `FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA@NOME-ORGAO`
- `FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA@NOME-CURSO`
- `FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA@ANO-DE-INICIO`
- `FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA@ANO-DE-CONCLUSAO`
- `FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA@NOME-CURSO-INGLES`
- `MBA@SEQUENCIA-FORMACAO`
- `MBA@NOME-INSTITUICAO`
- `MBA@CODIGO-ORGAO`
- `MBA@NOME-ORGAO`
- `MBA@NOME-CURSO`
- `MBA@ANO-DE-INICIO`
- `MBA@ANO-DE-CONCLUSAO`
- `MBA@ANO-DE-OBTENCAO-DO-TITULO`
- `MBA@FLAG-BOLSA`
- `MBA@CODIGO-AGENCIA-FINANCIADORA`
- `MBA@NOME-AGENCIA`
- `MBA@TITULO-DA-MONOGRAFIA`
- `MBA@NOME-COMPLETO-DO-ORIENTADOR`
- `MBA@NOME-CURSO-INGLES`
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1`
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2`
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3`
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4`
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5`
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6`
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE`
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE`
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE`
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1`
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2`
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3`
- `OUTROS@CODIGO-ORGAO`
- `OUTROS@NOME-ORGAO`
- `OUTROS@ANO-DE-INICIO`
- `OUTROS@ANO-DE-CONCLUSAO`
- `OUTROS@NOME-CURSO-INGLES`

</details>

<details><summary>Atuação profissional (atuacao)</summary>

**texto livre**

- `PARTICIPACAO-EM-PROJETO@MES-INICIO` ← `f_mes_ini` (inferido)
- `PARTICIPACAO-EM-PROJETO@ANO-INICIO` ← `f_ano_ini` (inferido)
- `PARTICIPACAO-EM-PROJETO@MES-FIM` ← `f_mes_fim` (inferido)
- `PARTICIPACAO-EM-PROJETO@ANO-FIM` ← `f_ano_fim` (inferido)

**oculto**

- `ATUACAO-PROFISSIONAL@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)

**fora do formulário**

- `ATUACAO-PROFISSIONAL@NOME-INSTITUICAO`
- `ATUACAO-PROFISSIONAL@SEQUENCIA-ATIVIDADE`
- `ATUACAO-PROFISSIONAL@SEQUENCIA-IMPORTANCIA`
- `PARTICIPACAO-EM-PROJETO@SEQUENCIA-FUNCAO-ATIVIDADE`
- `PARTICIPACAO-EM-PROJETO@FLAG-PERIODO`
- `PARTICIPACAO-EM-PROJETO@CODIGO-ORGAO`
- `PARTICIPACAO-EM-PROJETO@NOME-ORGAO`
- `PARTICIPACAO-EM-PROJETO@CODIGO-UNIDADE`
- `PARTICIPACAO-EM-PROJETO@NOME-UNIDADE`

</details>

<details><summary>Vínculo de uma atuação (vinculo)</summary>

**com opções**

- `VINCULOS@FLAG-DEDICACAO-EXCLUSIVA` ← `f_regime` (documentado)
- `VINCULOS@FLAG-VINCULO-EMPREGATICIO` ← `f_stavinc` (documentado)

**texto livre**

- `VINCULOS@TIPO-DE-VINCULO` ← `f_vinc` (observado)
- `VINCULOS@ENQUADRAMENTO-FUNCIONAL` ← `f_enqua` (inferido)
- `VINCULOS@CARGA-HORARIA-SEMANAL` ← `f_carga` (observado)
- `VINCULOS@MES-INICIO` ← `f_mes_ini` (observado)
- `VINCULOS@ANO-INICIO` ← `f_ano_ini` (observado)
- `VINCULOS@MES-FIM` ← `f_mes_fim` (observado)
- `VINCULOS@ANO-FIM` ← `f_ano_fim` (observado)
- `VINCULOS@OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO` ← `f_enqua` (observado)
- `VINCULOS@OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO-INGLES` ← `f_enqua_en` (documentado)
- `VINCULOS@OUTRAS-INFORMACOES-INGLES` ← `f_outras_inf_en` (documentado)

**fora do formulário**

- `VINCULOS@SEQUENCIA-HISTORICO`
- `VINCULOS@OUTRAS-INFORMACOES`
- `VINCULOS@OUTRO-VINCULO-INFORMADO`

</details>

<details><summary>Atividade de uma atuação (atividade)</summary>

</details>

<details><summary>Atividade de uma atuação: direção e administração (atividade-1)</summary>

**texto livre**

- `DIRECAO-E-ADMINISTRACAO@MES-INICIO` ← `f_mes_ini` (inferido)
- `DIRECAO-E-ADMINISTRACAO@ANO-INICIO` ← `f_ano_ini` (inferido)
- `DIRECAO-E-ADMINISTRACAO@MES-FIM` ← `f_mes_fim` (inferido)
- `DIRECAO-E-ADMINISTRACAO@ANO-FIM` ← `f_ano_fim` (inferido)

**fora do formulário**

- `DIRECAO-E-ADMINISTRACAO@SEQUENCIA-FUNCAO-ATIVIDADE`
- `DIRECAO-E-ADMINISTRACAO@FLAG-PERIODO`
- `DIRECAO-E-ADMINISTRACAO@CODIGO-ORGAO`
- `DIRECAO-E-ADMINISTRACAO@NOME-ORGAO`
- `DIRECAO-E-ADMINISTRACAO@CODIGO-UNIDADE`
- `DIRECAO-E-ADMINISTRACAO@FORMATO-CARGO-OU-FUNCAO`
- `DIRECAO-E-ADMINISTRACAO@CARGO-OU-FUNCAO`
- `DIRECAO-E-ADMINISTRACAO@NOME-UNIDADE`
- `DIRECAO-E-ADMINISTRACAO@CARGO-OU-FUNCAO-INGLES`

</details>

<details><summary>Atividade de uma atuação: pesquisa e desenvolvimento (atividade-2)</summary>

**texto livre**

- `PESQUISA-E-DESENVOLVIMENTO@MES-INICIO` ← `f_mes_ini` (inferido)
- `PESQUISA-E-DESENVOLVIMENTO@ANO-INICIO` ← `f_ano_ini` (inferido)
- `PESQUISA-E-DESENVOLVIMENTO@MES-FIM` ← `f_mes_fim` (inferido)
- `PESQUISA-E-DESENVOLVIMENTO@ANO-FIM` ← `f_ano_fim` (inferido)

**fora do formulário**

- `PESQUISA-E-DESENVOLVIMENTO@SEQUENCIA-FUNCAO-ATIVIDADE`
- `PESQUISA-E-DESENVOLVIMENTO@FLAG-PERIODO`
- `PESQUISA-E-DESENVOLVIMENTO@CODIGO-ORGAO`
- `PESQUISA-E-DESENVOLVIMENTO@NOME-ORGAO`
- `PESQUISA-E-DESENVOLVIMENTO@CODIGO-UNIDADE`
- `PESQUISA-E-DESENVOLVIMENTO@NOME-UNIDADE`

</details>

<details><summary>Atividade de uma atuação: ensino (atividade-4)</summary>

**texto livre**

- `ENSINO@MES-INICIO` ← `f_mes_ini` (inferido)
- `ENSINO@ANO-INICIO` ← `f_ano_ini` (inferido)
- `ENSINO@MES-FIM` ← `f_mes_fim` (inferido)
- `ENSINO@ANO-FIM` ← `f_ano_fim` (inferido)

**oculto**

- `ENSINO@CODIGO-CURSO` ← `f_cod_curso` (inferido)

**fora do formulário**

- `ENSINO@SEQUENCIA-FUNCAO-ATIVIDADE`
- `ENSINO@FLAG-PERIODO`
- `ENSINO@TIPO-ENSINO`
- `ENSINO@CODIGO-ORGAO`
- `ENSINO@NOME-ORGAO`
- `ENSINO@NOME-CURSO`
- `ENSINO@NOME-CURSO-INGLES`
- `DISCIPLINA@SEQUENCIA-ESPECIFICACAO`

</details>

<details><summary>Atividade de uma atuação: estágio (atividade-5)</summary>

**texto livre**

- `ESTAGIO@MES-INICIO` ← `f_mes_ini` (inferido)
- `ESTAGIO@ANO-INICIO` ← `f_ano_ini` (inferido)
- `ESTAGIO@MES-FIM` ← `f_mes_fim` (inferido)
- `ESTAGIO@ANO-FIM` ← `f_ano_fim` (inferido)

**fora do formulário**

- `ESTAGIO@SEQUENCIA-FUNCAO-ATIVIDADE`
- `ESTAGIO@FLAG-PERIODO`
- `ESTAGIO@CODIGO-ORGAO`
- `ESTAGIO@NOME-ORGAO`
- `ESTAGIO@CODIGO-UNIDADE`
- `ESTAGIO@NOME-UNIDADE`
- `ESTAGIO@ESTAGIO-REALIZADO`

</details>

<details><summary>Atividade de uma atuação: serviço técnico especializado (atividade-6)</summary>

**texto livre**

- `SERVICO-TECNICO-ESPECIALIZADO@MES-INICIO` ← `f_mes_ini` (inferido)
- `SERVICO-TECNICO-ESPECIALIZADO@ANO-INICIO` ← `f_ano_ini` (inferido)
- `SERVICO-TECNICO-ESPECIALIZADO@MES-FIM` ← `f_mes_fim` (inferido)
- `SERVICO-TECNICO-ESPECIALIZADO@ANO-FIM` ← `f_ano_fim` (inferido)

**fora do formulário**

- `SERVICO-TECNICO-ESPECIALIZADO@SEQUENCIA-FUNCAO-ATIVIDADE`
- `SERVICO-TECNICO-ESPECIALIZADO@FLAG-PERIODO`
- `SERVICO-TECNICO-ESPECIALIZADO@CODIGO-ORGAO`
- `SERVICO-TECNICO-ESPECIALIZADO@NOME-ORGAO`
- `SERVICO-TECNICO-ESPECIALIZADO@CODIGO-UNIDADE`
- `SERVICO-TECNICO-ESPECIALIZADO@NOME-UNIDADE`
- `SERVICO-TECNICO-ESPECIALIZADO@SERVICO-REALIZADO`

</details>

<details><summary>Atividade de uma atuação: extensão universitária (atividade-7)</summary>

**texto livre**

- `EXTENSAO-UNIVERSITARIA@MES-INICIO` ← `f_mes_ini` (inferido)
- `EXTENSAO-UNIVERSITARIA@ANO-INICIO` ← `f_ano_ini` (inferido)
- `EXTENSAO-UNIVERSITARIA@MES-FIM` ← `f_mes_fim` (inferido)
- `EXTENSAO-UNIVERSITARIA@ANO-FIM` ← `f_ano_fim` (inferido)

**fora do formulário**

- `EXTENSAO-UNIVERSITARIA@SEQUENCIA-FUNCAO-ATIVIDADE`
- `EXTENSAO-UNIVERSITARIA@FLAG-PERIODO`
- `EXTENSAO-UNIVERSITARIA@CODIGO-ORGAO`
- `EXTENSAO-UNIVERSITARIA@NOME-ORGAO`
- `EXTENSAO-UNIVERSITARIA@CODIGO-UNIDADE`
- `EXTENSAO-UNIVERSITARIA@NOME-UNIDADE`
- `EXTENSAO-UNIVERSITARIA@ATIVIDADE-DE-EXTENSAO-REALIZADA`

</details>

<details><summary>Atividade de uma atuação: treinamento (atividade-8)</summary>

**texto livre**

- `TREINAMENTO-MINISTRADO@MES-INICIO` ← `f_mes_ini` (inferido)
- `TREINAMENTO-MINISTRADO@ANO-INICIO` ← `f_ano_ini` (inferido)
- `TREINAMENTO-MINISTRADO@MES-FIM` ← `f_mes_fim` (inferido)
- `TREINAMENTO-MINISTRADO@ANO-FIM` ← `f_ano_fim` (inferido)

**fora do formulário**

- `TREINAMENTO-MINISTRADO@SEQUENCIA-FUNCAO-ATIVIDADE`
- `TREINAMENTO-MINISTRADO@FLAG-PERIODO`
- `TREINAMENTO-MINISTRADO@CODIGO-ORGAO`
- `TREINAMENTO-MINISTRADO@NOME-ORGAO`
- `TREINAMENTO-MINISTRADO@CODIGO-UNIDADE`
- `TREINAMENTO-MINISTRADO@NOME-UNIDADE`
- `TREINAMENTO@SEQUENCIA-ESPECIFICACAO`

</details>

<details><summary>Atividade de uma atuação: outra atividade técnico-científica (atividade-9)</summary>

**texto livre**

- `OUTRA-ATIVIDADE-TECNICO-CIENTIFICA@MES-INICIO` ← `f_mes_ini` (inferido)
- `OUTRA-ATIVIDADE-TECNICO-CIENTIFICA@ANO-INICIO` ← `f_ano_ini` (inferido)
- `OUTRA-ATIVIDADE-TECNICO-CIENTIFICA@MES-FIM` ← `f_mes_fim` (inferido)
- `OUTRA-ATIVIDADE-TECNICO-CIENTIFICA@ANO-FIM` ← `f_ano_fim` (inferido)

**fora do formulário**

- `OUTRA-ATIVIDADE-TECNICO-CIENTIFICA@SEQUENCIA-FUNCAO-ATIVIDADE`
- `OUTRA-ATIVIDADE-TECNICO-CIENTIFICA@FLAG-PERIODO`
- `OUTRA-ATIVIDADE-TECNICO-CIENTIFICA@CODIGO-ORGAO`
- `OUTRA-ATIVIDADE-TECNICO-CIENTIFICA@NOME-ORGAO`
- `OUTRA-ATIVIDADE-TECNICO-CIENTIFICA@CODIGO-UNIDADE`
- `OUTRA-ATIVIDADE-TECNICO-CIENTIFICA@ATIVIDADE-REALIZADA`
- `OUTRA-ATIVIDADE-TECNICO-CIENTIFICA@NOME-UNIDADE`

</details>

<details><summary>Atividade de uma atuação: conselhos, comissões e consultoria (atividade-B)</summary>

**texto livre**

- `CONSELHO-COMISSAO-E-CONSULTORIA@MES-INICIO` ← `f_mes_ini` (inferido)
- `CONSELHO-COMISSAO-E-CONSULTORIA@ANO-INICIO` ← `f_ano_ini` (inferido)
- `CONSELHO-COMISSAO-E-CONSULTORIA@MES-FIM` ← `f_mes_fim` (inferido)
- `CONSELHO-COMISSAO-E-CONSULTORIA@ANO-FIM` ← `f_ano_fim` (inferido)

**fora do formulário**

- `CONSELHO-COMISSAO-E-CONSULTORIA@SEQUENCIA-FUNCAO-ATIVIDADE`
- `CONSELHO-COMISSAO-E-CONSULTORIA@FLAG-PERIODO`
- `CONSELHO-COMISSAO-E-CONSULTORIA@CODIGO-ORGAO`
- `CONSELHO-COMISSAO-E-CONSULTORIA@NOME-ORGAO`
- `CONSELHO-COMISSAO-E-CONSULTORIA@CODIGO-UNIDADE`
- `CONSELHO-COMISSAO-E-CONSULTORIA@NOME-UNIDADE`
- `CONSELHO-COMISSAO-E-CONSULTORIA@ESPECIFICACAO`

</details>

<details><summary>Corpo editorial, revisão e assessoramento (MB) (revisor-MB)</summary>

</details>

<details><summary>Corpo editorial, revisão e assessoramento (MA) (revisor-MA)</summary>

</details>

<details><summary>Corpo editorial, revisão e assessoramento (RV) (revisor-RV)</summary>

</details>

<details><summary>Corpo editorial, revisão e assessoramento (RA) (revisor-RA)</summary>

</details>

<details><summary>Projeto de pesquisa (projeto-P)</summary>

**com opções**

- `PROJETO-DE-PESQUISA@SITUACAO` ← `F_TPO_SITUACAO` (observado)
- `PROJETO-DE-PESQUISA@NATUREZA` ← `F_TPO_NATUREZA` (observado)
- `PROJETO-DE-PESQUISA@FLAG-POTENCIAL-INOVACAO` ← `f_sta_inovacao` (documentado)

**texto livre**

- `PROJETO-DE-PESQUISA@ANO-INICIO` ← `F_ANO_INIC` (observado)
- `PROJETO-DE-PESQUISA@ANO-FIM` ← `F_ANO_FIM` (documentado)
- `PROJETO-DE-PESQUISA@NOME-DO-PROJETO` ← `f_titulo` (observado)
- `PROJETO-DE-PESQUISA@NUMERO-GRADUACAO` ← `F_NRO_GRADUACAO` (documentado)
- `PROJETO-DE-PESQUISA@NUMERO-ESPECIALIZACAO` ← `F_NRO_ESPECIALIZACAO` (inferido)
- `PROJETO-DE-PESQUISA@NUMERO-MESTRADO-ACADEMICO` ← `F_NRO_MESTRADO_ACAD` (inferido)
- `PROJETO-DE-PESQUISA@NUMERO-MESTRADO-PROF` ← `F_NRO_MESTRADO_PROF` (inferido)
- `PROJETO-DE-PESQUISA@NUMERO-DOUTORADO` ← `F_NRO_DOUTORADO` (inferido)
- `PROJETO-DE-PESQUISA@DESCRICAO-DO-PROJETO-INGLES` ← `f_ref_en` (observado)
- `PROJETO-DE-PESQUISA@NOME-DO-PROJETO-INGLES` ← `f_titulo_en` (observado)
- `PRODUCAO-CT-DO-PROJETO@TITULO-DA-PRODUCAO-CT` ← `f_titulo` (inferido)
- `PRODUCAO-CT-DO-PROJETO@TITULO-DA-PRODUCAO-CT-INGLES` ← `f_titulo_en` (inferido)
- `ORIENTACAO@TITULO-ORIENTACAO` ← `f_titulo` (inferido)
- `ORIENTACAO@TITULO-ORIENTACAO-INGLES` ← `f_titulo_en` (inferido)

**oculto**

- `PROJETO-DE-PESQUISA@NUMERO_TECNICO_NIVEL_MEDIO` ← `f_nro_tec_nivel_medio` (inferido)
- `FINANCIADOR-DO-PROJETO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)

**fora do formulário**

- `PROJETO-DE-PESQUISA@SEQUENCIA-PROJETO`
- `PROJETO-DE-PESQUISA@DESCRICAO-DO-PROJETO`
- `PROJETO-DE-PESQUISA@IDENTIFICADOR-PROJETO`
- `PROJETO-DE-PESQUISA@NOME-COORDENADOR-CERTIFICACAO`
- `PROJETO-DE-PESQUISA@FORMATO-DATA-CERTIFICACAO`
- `PROJETO-DE-PESQUISA@DATA-CERTIFICACAO`
- `INTEGRANTES-DO-PROJETO@NOME-COMPLETO`
- `INTEGRANTES-DO-PROJETO@NOME-PARA-CITACAO`
- `INTEGRANTES-DO-PROJETO@ORDEM-DE-INTEGRACAO`
- `INTEGRANTES-DO-PROJETO@FLAG-RESPONSAVEL`
- `INTEGRANTES-DO-PROJETO@NRO-ID-CNPQ`
- `FINANCIADOR-DO-PROJETO@SEQUENCIA-FINANCIADOR`
- `FINANCIADOR-DO-PROJETO@NOME-INSTITUICAO`
- `FINANCIADOR-DO-PROJETO@NATUREZA`
- `PRODUCAO-CT-DO-PROJETO@SEQUENCIA-PRODUCAO-CT`
- `PRODUCAO-CT-DO-PROJETO@TIPO-PRODUCAO-CT`
- `ORIENTACAO@SEQUENCIA-ORIENTACAO`
- `ORIENTACAO@TIPO-ORIENTACAO`

</details>

<details><summary>Projeto de desenvolvimento (projeto-D)</summary>

**com opções**

- `PROJETO-DE-PESQUISA@SITUACAO` ← `F_TPO_SITUACAO` (observado)
- `PROJETO-DE-PESQUISA@NATUREZA` ← `F_TPO_NATUREZA` (observado)
- `PROJETO-DE-PESQUISA@FLAG-POTENCIAL-INOVACAO` ← `f_sta_inovacao` (documentado)

**texto livre**

- `PROJETO-DE-PESQUISA@ANO-INICIO` ← `F_ANO_INIC` (observado)
- `PROJETO-DE-PESQUISA@ANO-FIM` ← `F_ANO_FIM` (documentado)
- `PROJETO-DE-PESQUISA@NOME-DO-PROJETO` ← `f_titulo` (observado)
- `PROJETO-DE-PESQUISA@NUMERO-GRADUACAO` ← `F_NRO_GRADUACAO` (documentado)
- `PROJETO-DE-PESQUISA@NUMERO-ESPECIALIZACAO` ← `F_NRO_ESPECIALIZACAO` (inferido)
- `PROJETO-DE-PESQUISA@NUMERO-MESTRADO-ACADEMICO` ← `F_NRO_MESTRADO_ACAD` (inferido)
- `PROJETO-DE-PESQUISA@NUMERO-MESTRADO-PROF` ← `F_NRO_MESTRADO_PROF` (inferido)
- `PROJETO-DE-PESQUISA@NUMERO-DOUTORADO` ← `F_NRO_DOUTORADO` (inferido)
- `PROJETO-DE-PESQUISA@DESCRICAO-DO-PROJETO-INGLES` ← `f_ref_en` (observado)
- `PROJETO-DE-PESQUISA@NOME-DO-PROJETO-INGLES` ← `f_titulo_en` (observado)
- `PROJETO-DE-PESQUISA@NUMERO_TECNICO_NIVEL_MEDIO` ← `F_NRO_TEC_NIVEL_MEDIO` (inferido)
- `PRODUCAO-CT-DO-PROJETO@TITULO-DA-PRODUCAO-CT` ← `f_titulo` (inferido)
- `PRODUCAO-CT-DO-PROJETO@TITULO-DA-PRODUCAO-CT-INGLES` ← `f_titulo_en` (inferido)
- `ORIENTACAO@TITULO-ORIENTACAO` ← `f_titulo` (inferido)
- `ORIENTACAO@TITULO-ORIENTACAO-INGLES` ← `f_titulo_en` (inferido)

**oculto**

- `FINANCIADOR-DO-PROJETO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)

**fora do formulário**

- `PROJETO-DE-PESQUISA@SEQUENCIA-PROJETO`
- `PROJETO-DE-PESQUISA@DESCRICAO-DO-PROJETO`
- `PROJETO-DE-PESQUISA@IDENTIFICADOR-PROJETO`
- `PROJETO-DE-PESQUISA@NOME-COORDENADOR-CERTIFICACAO`
- `PROJETO-DE-PESQUISA@FORMATO-DATA-CERTIFICACAO`
- `PROJETO-DE-PESQUISA@DATA-CERTIFICACAO`
- `INTEGRANTES-DO-PROJETO@NOME-COMPLETO`
- `INTEGRANTES-DO-PROJETO@NOME-PARA-CITACAO`
- `INTEGRANTES-DO-PROJETO@ORDEM-DE-INTEGRACAO`
- `INTEGRANTES-DO-PROJETO@FLAG-RESPONSAVEL`
- `INTEGRANTES-DO-PROJETO@NRO-ID-CNPQ`
- `FINANCIADOR-DO-PROJETO@SEQUENCIA-FINANCIADOR`
- `FINANCIADOR-DO-PROJETO@NOME-INSTITUICAO`
- `FINANCIADOR-DO-PROJETO@NATUREZA`
- `PRODUCAO-CT-DO-PROJETO@SEQUENCIA-PRODUCAO-CT`
- `PRODUCAO-CT-DO-PROJETO@TIPO-PRODUCAO-CT`
- `ORIENTACAO@SEQUENCIA-ORIENTACAO`
- `ORIENTACAO@TIPO-ORIENTACAO`

</details>

<details><summary>Projeto de extensão (projeto-E)</summary>

**com opções**

- `PROJETO-DE-PESQUISA@SITUACAO` ← `F_TPO_SITUACAO` (observado)
- `PROJETO-DE-PESQUISA@NATUREZA` ← `F_TPO_NATUREZA` (observado)
- `PROJETO-DE-PESQUISA@FLAG-POTENCIAL-INOVACAO` ← `f_sta_inovacao` (documentado)

**texto livre**

- `PROJETO-DE-PESQUISA@ANO-INICIO` ← `F_ANO_INIC` (documentado)
- `PROJETO-DE-PESQUISA@ANO-FIM` ← `F_ANO_FIM` (documentado)
- `PROJETO-DE-PESQUISA@NOME-DO-PROJETO` ← `f_titulo` (observado)
- `PROJETO-DE-PESQUISA@NUMERO-GRADUACAO` ← `F_NRO_GRADUACAO` (documentado)
- `PROJETO-DE-PESQUISA@NUMERO-ESPECIALIZACAO` ← `F_NRO_ESPECIALIZACAO` (inferido)
- `PROJETO-DE-PESQUISA@NUMERO-MESTRADO-ACADEMICO` ← `F_NRO_MESTRADO_ACAD` (inferido)
- `PROJETO-DE-PESQUISA@NUMERO-MESTRADO-PROF` ← `F_NRO_MESTRADO_PROF` (inferido)
- `PROJETO-DE-PESQUISA@NUMERO-DOUTORADO` ← `F_NRO_DOUTORADO` (inferido)
- `PROJETO-DE-PESQUISA@DESCRICAO-DO-PROJETO-INGLES` ← `f_ref_en` (observado)
- `PROJETO-DE-PESQUISA@NOME-DO-PROJETO-INGLES` ← `f_titulo_en` (observado)
- `PRODUCAO-CT-DO-PROJETO@TITULO-DA-PRODUCAO-CT` ← `f_titulo` (inferido)
- `PRODUCAO-CT-DO-PROJETO@TITULO-DA-PRODUCAO-CT-INGLES` ← `f_titulo_en` (inferido)
- `ORIENTACAO@TITULO-ORIENTACAO` ← `f_titulo` (inferido)
- `ORIENTACAO@TITULO-ORIENTACAO-INGLES` ← `f_titulo_en` (inferido)

**oculto**

- `PROJETO-DE-PESQUISA@NUMERO_TECNICO_NIVEL_MEDIO` ← `f_nro_tec_nivel_medio` (inferido)
- `FINANCIADOR-DO-PROJETO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)

**fora do formulário**

- `PROJETO-DE-PESQUISA@SEQUENCIA-PROJETO`
- `PROJETO-DE-PESQUISA@DESCRICAO-DO-PROJETO`
- `PROJETO-DE-PESQUISA@IDENTIFICADOR-PROJETO`
- `PROJETO-DE-PESQUISA@NOME-COORDENADOR-CERTIFICACAO`
- `PROJETO-DE-PESQUISA@FORMATO-DATA-CERTIFICACAO`
- `PROJETO-DE-PESQUISA@DATA-CERTIFICACAO`
- `INTEGRANTES-DO-PROJETO@NOME-COMPLETO`
- `INTEGRANTES-DO-PROJETO@NOME-PARA-CITACAO`
- `INTEGRANTES-DO-PROJETO@ORDEM-DE-INTEGRACAO`
- `INTEGRANTES-DO-PROJETO@FLAG-RESPONSAVEL`
- `INTEGRANTES-DO-PROJETO@NRO-ID-CNPQ`
- `FINANCIADOR-DO-PROJETO@SEQUENCIA-FINANCIADOR`
- `FINANCIADOR-DO-PROJETO@NOME-INSTITUICAO`
- `FINANCIADOR-DO-PROJETO@NATUREZA`
- `PRODUCAO-CT-DO-PROJETO@SEQUENCIA-PRODUCAO-CT`
- `PRODUCAO-CT-DO-PROJETO@TIPO-PRODUCAO-CT`
- `ORIENTACAO@SEQUENCIA-ORIENTACAO`
- `ORIENTACAO@TIPO-ORIENTACAO`

</details>

<details><summary>Projeto de ensino (projeto-N)</summary>

**com opções**

- `PROJETO-DE-PESQUISA@SITUACAO` ← `F_TPO_SITUACAO` (observado)
- `PROJETO-DE-PESQUISA@NATUREZA` ← `F_TPO_NATUREZA` (observado)
- `PROJETO-DE-PESQUISA@FLAG-POTENCIAL-INOVACAO` ← `f_sta_inovacao` (documentado)

**texto livre**

- `PROJETO-DE-PESQUISA@ANO-INICIO` ← `F_ANO_INIC` (observado)
- `PROJETO-DE-PESQUISA@ANO-FIM` ← `F_ANO_FIM` (documentado)
- `PROJETO-DE-PESQUISA@NOME-DO-PROJETO` ← `f_titulo` (observado)
- `PROJETO-DE-PESQUISA@NUMERO-GRADUACAO` ← `F_NRO_GRADUACAO` (documentado)
- `PROJETO-DE-PESQUISA@NUMERO-ESPECIALIZACAO` ← `F_NRO_ESPECIALIZACAO` (inferido)
- `PROJETO-DE-PESQUISA@NUMERO-MESTRADO-ACADEMICO` ← `F_NRO_MESTRADO_ACAD` (inferido)
- `PROJETO-DE-PESQUISA@NUMERO-MESTRADO-PROF` ← `F_NRO_MESTRADO_PROF` (inferido)
- `PROJETO-DE-PESQUISA@NUMERO-DOUTORADO` ← `F_NRO_DOUTORADO` (inferido)
- `PROJETO-DE-PESQUISA@DESCRICAO-DO-PROJETO-INGLES` ← `f_ref_en` (observado)
- `PROJETO-DE-PESQUISA@NOME-DO-PROJETO-INGLES` ← `f_titulo_en` (observado)
- `PRODUCAO-CT-DO-PROJETO@TITULO-DA-PRODUCAO-CT` ← `f_titulo` (inferido)
- `PRODUCAO-CT-DO-PROJETO@TITULO-DA-PRODUCAO-CT-INGLES` ← `f_titulo_en` (inferido)
- `ORIENTACAO@TITULO-ORIENTACAO` ← `f_titulo` (inferido)
- `ORIENTACAO@TITULO-ORIENTACAO-INGLES` ← `f_titulo_en` (inferido)

**oculto**

- `PROJETO-DE-PESQUISA@NUMERO_TECNICO_NIVEL_MEDIO` ← `f_nro_tec_nivel_medio` (inferido)
- `FINANCIADOR-DO-PROJETO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)

**fora do formulário**

- `PROJETO-DE-PESQUISA@SEQUENCIA-PROJETO`
- `PROJETO-DE-PESQUISA@DESCRICAO-DO-PROJETO`
- `PROJETO-DE-PESQUISA@IDENTIFICADOR-PROJETO`
- `PROJETO-DE-PESQUISA@NOME-COORDENADOR-CERTIFICACAO`
- `PROJETO-DE-PESQUISA@FORMATO-DATA-CERTIFICACAO`
- `PROJETO-DE-PESQUISA@DATA-CERTIFICACAO`
- `INTEGRANTES-DO-PROJETO@NOME-COMPLETO`
- `INTEGRANTES-DO-PROJETO@NOME-PARA-CITACAO`
- `INTEGRANTES-DO-PROJETO@ORDEM-DE-INTEGRACAO`
- `INTEGRANTES-DO-PROJETO@FLAG-RESPONSAVEL`
- `INTEGRANTES-DO-PROJETO@NRO-ID-CNPQ`
- `FINANCIADOR-DO-PROJETO@SEQUENCIA-FINANCIADOR`
- `FINANCIADOR-DO-PROJETO@NOME-INSTITUICAO`
- `FINANCIADOR-DO-PROJETO@NATUREZA`
- `PRODUCAO-CT-DO-PROJETO@SEQUENCIA-PRODUCAO-CT`
- `PRODUCAO-CT-DO-PROJETO@TIPO-PRODUCAO-CT`
- `ORIENTACAO@SEQUENCIA-ORIENTACAO`
- `ORIENTACAO@TIPO-ORIENTACAO`

</details>

<details><summary>Projeto de outros (projeto-O)</summary>

**com opções**

- `PROJETO-DE-PESQUISA@SITUACAO` ← `F_TPO_SITUACAO` (observado)
- `PROJETO-DE-PESQUISA@NATUREZA` ← `F_TPO_NATUREZA` (observado)
- `PROJETO-DE-PESQUISA@FLAG-POTENCIAL-INOVACAO` ← `f_sta_inovacao` (documentado)

**texto livre**

- `PROJETO-DE-PESQUISA@ANO-INICIO` ← `F_ANO_INIC` (documentado)
- `PROJETO-DE-PESQUISA@ANO-FIM` ← `F_ANO_FIM` (documentado)
- `PROJETO-DE-PESQUISA@NOME-DO-PROJETO` ← `f_titulo` (observado)
- `PROJETO-DE-PESQUISA@NUMERO-GRADUACAO` ← `F_NRO_GRADUACAO` (documentado)
- `PROJETO-DE-PESQUISA@NUMERO-ESPECIALIZACAO` ← `F_NRO_ESPECIALIZACAO` (inferido)
- `PROJETO-DE-PESQUISA@NUMERO-MESTRADO-ACADEMICO` ← `F_NRO_MESTRADO_ACAD` (inferido)
- `PROJETO-DE-PESQUISA@NUMERO-MESTRADO-PROF` ← `F_NRO_MESTRADO_PROF` (inferido)
- `PROJETO-DE-PESQUISA@NUMERO-DOUTORADO` ← `F_NRO_DOUTORADO` (inferido)
- `PROJETO-DE-PESQUISA@DESCRICAO-DO-PROJETO-INGLES` ← `f_ref_en` (observado)
- `PROJETO-DE-PESQUISA@NOME-DO-PROJETO-INGLES` ← `f_titulo_en` (observado)
- `PRODUCAO-CT-DO-PROJETO@TITULO-DA-PRODUCAO-CT` ← `f_titulo` (inferido)
- `PRODUCAO-CT-DO-PROJETO@TITULO-DA-PRODUCAO-CT-INGLES` ← `f_titulo_en` (inferido)
- `ORIENTACAO@TITULO-ORIENTACAO` ← `f_titulo` (inferido)
- `ORIENTACAO@TITULO-ORIENTACAO-INGLES` ← `f_titulo_en` (inferido)

**oculto**

- `PROJETO-DE-PESQUISA@NUMERO_TECNICO_NIVEL_MEDIO` ← `f_nro_tec_nivel_medio` (inferido)
- `FINANCIADOR-DO-PROJETO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)

**fora do formulário**

- `PROJETO-DE-PESQUISA@SEQUENCIA-PROJETO`
- `PROJETO-DE-PESQUISA@DESCRICAO-DO-PROJETO`
- `PROJETO-DE-PESQUISA@IDENTIFICADOR-PROJETO`
- `PROJETO-DE-PESQUISA@NOME-COORDENADOR-CERTIFICACAO`
- `PROJETO-DE-PESQUISA@FORMATO-DATA-CERTIFICACAO`
- `PROJETO-DE-PESQUISA@DATA-CERTIFICACAO`
- `INTEGRANTES-DO-PROJETO@NOME-COMPLETO`
- `INTEGRANTES-DO-PROJETO@NOME-PARA-CITACAO`
- `INTEGRANTES-DO-PROJETO@ORDEM-DE-INTEGRACAO`
- `INTEGRANTES-DO-PROJETO@FLAG-RESPONSAVEL`
- `INTEGRANTES-DO-PROJETO@NRO-ID-CNPQ`
- `FINANCIADOR-DO-PROJETO@SEQUENCIA-FINANCIADOR`
- `FINANCIADOR-DO-PROJETO@NOME-INSTITUICAO`
- `FINANCIADOR-DO-PROJETO@NATUREZA`
- `PRODUCAO-CT-DO-PROJETO@SEQUENCIA-PRODUCAO-CT`
- `PRODUCAO-CT-DO-PROJETO@TIPO-PRODUCAO-CT`
- `ORIENTACAO@SEQUENCIA-ORIENTACAO`
- `ORIENTACAO@TIPO-ORIENTACAO`

</details>

<details><summary>Artigos completos publicados (artigo-publicado)</summary>

**com opções**

- `DADOS-BASICOS-DO-ARTIGO@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DO-ARTIGO@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DO-ARTIGO@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DO-ARTIGO@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)

**texto livre**

- `DADOS-BASICOS-DO-ARTIGO@TITULO-DO-ARTIGO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DO-ARTIGO@ANO-DO-ARTIGO` ← `f_ano` (observado)
- `DADOS-BASICOS-DO-ARTIGO@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DO-ARTIGO@TITULO-DO-ARTIGO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DO-ARTIGO@TITULO-DO-PERIODICO-OU-REVISTA` ← `f_titulo_periodico` (observado)
- `DETALHAMENTO-DO-ARTIGO@ISSN` ← `f_issn` (inferido)
- `DETALHAMENTO-DO-ARTIGO@VOLUME` ← `f_volume` (inferido)
- `DETALHAMENTO-DO-ARTIGO@SERIE` ← `f_serie` (inferido)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS` ← `f_ref` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `ARTIGO-PUBLICADO@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `ARTIGO-PUBLICADO@ORDEM-IMPORTANCIA`
- `DADOS-BASICOS-DO-ARTIGO@NATUREZA`
- `DADOS-BASICOS-DO-ARTIGO@PAIS-DE-PUBLICACAO`
- `DADOS-BASICOS-DO-ARTIGO@DOI`
- `DETALHAMENTO-DO-ARTIGO@FASCICULO`
- `DETALHAMENTO-DO-ARTIGO@PAGINA-INICIAL`
- `DETALHAMENTO-DO-ARTIGO@PAGINA-FINAL`
- `DETALHAMENTO-DO-ARTIGO@LOCAL-DE-PUBLICACAO`

</details>

<details><summary>Artigos aceitos para publicação (artigo-aceito)</summary>

**com opções**

- `DADOS-BASICOS-DO-ARTIGO@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DO-ARTIGO@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DO-ARTIGO@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)

**texto livre**

- `DADOS-BASICOS-DO-ARTIGO@TITULO-DO-ARTIGO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DO-ARTIGO@ANO-DO-ARTIGO` ← `f_ano` (observado)
- `DADOS-BASICOS-DO-ARTIGO@TITULO-DO-ARTIGO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DO-ARTIGO@TITULO-DO-PERIODICO-OU-REVISTA` ← `f_titulo_periodico` (observado)
- `DETALHAMENTO-DO-ARTIGO@ISSN` ← `f_issn` (inferido)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `ARTIGO-ACEITO-PARA-PUBLICACAO@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DO-ARTIGO@NATUREZA`
- `DADOS-BASICOS-DO-ARTIGO@PAIS-DE-PUBLICACAO`
- `DADOS-BASICOS-DO-ARTIGO@MEIO-DE-DIVULGACAO`
- `DADOS-BASICOS-DO-ARTIGO@HOME-PAGE-DO-TRABALHO`
- `DADOS-BASICOS-DO-ARTIGO@DOI`
- `DETALHAMENTO-DO-ARTIGO@VOLUME`
- `DETALHAMENTO-DO-ARTIGO@FASCICULO`
- `DETALHAMENTO-DO-ARTIGO@SERIE`
- `DETALHAMENTO-DO-ARTIGO@PAGINA-INICIAL`
- `DETALHAMENTO-DO-ARTIGO@PAGINA-FINAL`
- `DETALHAMENTO-DO-ARTIGO@LOCAL-DE-PUBLICACAO`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Livros e capítulos (livro-capitulo)</summary>

**com opções**

- `DADOS-BASICOS-DO-LIVRO@TIPO` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DO-LIVRO@PAIS-DE-PUBLICACAO` ← `f_pais` (observado)
- `DADOS-BASICOS-DO-LIVRO@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DO-LIVRO@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DO-LIVRO@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DO-LIVRO@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)
- `DADOS-BASICOS-DO-CAPITULO@PAIS-DE-PUBLICACAO` ← `f_pais` (inferido)
- `DADOS-BASICOS-DO-CAPITULO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DADOS-BASICOS-DO-CAPITULO@MEIO-DE-DIVULGACAO` ← `f_meio` (inferido)
- `DADOS-BASICOS-DO-CAPITULO@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DO-CAPITULO@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)

**texto livre**

- `DADOS-BASICOS-DO-LIVRO@TITULO-DO-LIVRO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DO-LIVRO@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DO-LIVRO@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (observado)
- `DADOS-BASICOS-DO-LIVRO@TITULO-DO-LIVRO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DO-LIVRO@NUMERO-DE-PAGINAS` ← `f_paginas` (inferido)
- `DETALHAMENTO-DO-LIVRO@ISBN` ← `f_isbn` (observado)
- `DETALHAMENTO-DO-LIVRO@NUMERO-DA-EDICAO-REVISAO` ← `f_edicao` (inferido)
- `DETALHAMENTO-DO-LIVRO@NUMERO-DA-SERIE` ← `f_serie` (inferido)
- `DETALHAMENTO-DO-LIVRO@CIDADE-DA-EDITORA` ← `f_cidade_ed` (observado)
- `DETALHAMENTO-DO-LIVRO@NOME-DA-EDITORA` ← `f_editora` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)
- `DADOS-BASICOS-DO-CAPITULO@TITULO-DO-CAPITULO-DO-LIVRO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DO-CAPITULO@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DO-CAPITULO@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DO-CAPITULO@TITULO-DO-CAPITULO-DO-LIVRO-INGLES` ← `f_titulo_en` (inferido)
- `DETALHAMENTO-DO-CAPITULO@TITULO-DO-LIVRO` ← `f_titulo` (inferido)
- `DETALHAMENTO-DO-CAPITULO@ISBN` ← `f_isbn` (inferido)
- `DETALHAMENTO-DO-CAPITULO@NUMERO-DA-EDICAO-REVISAO` ← `f_edicao` (inferido)
- `DETALHAMENTO-DO-CAPITULO@NUMERO-DA-SERIE` ← `f_serie` (inferido)

**oculto**

- `LIVRO-PUBLICADO-OU-ORGANIZADO@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DO-LIVRO@NATUREZA`
- `DADOS-BASICOS-DO-LIVRO@DOI`
- `DETALHAMENTO-DO-LIVRO@NUMERO-DE-VOLUMES`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`
- `CAPITULO-DE-LIVRO-PUBLICADO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DO-CAPITULO@TIPO`
- `DADOS-BASICOS-DO-CAPITULO@DOI`
- `DETALHAMENTO-DO-CAPITULO@NUMERO-DE-VOLUMES`
- `DETALHAMENTO-DO-CAPITULO@PAGINA-INICIAL`
- `DETALHAMENTO-DO-CAPITULO@PAGINA-FINAL`
- `DETALHAMENTO-DO-CAPITULO@ORGANIZADORES`
- `DETALHAMENTO-DO-CAPITULO@CIDADE-DA-EDITORA`
- `DETALHAMENTO-DO-CAPITULO@NOME-DA-EDITORA`

</details>

<details><summary>Trabalhos em anais (trabalho-em-eventos)</summary>

**com opções**

- `DADOS-BASICOS-DO-TRABALHO@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DO-TRABALHO@PAIS-DO-EVENTO` ← `f_pais` (observado)
- `DADOS-BASICOS-DO-TRABALHO@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DO-TRABALHO@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DO-TRABALHO@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DO-TRABALHO@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)
- `DETALHAMENTO-DO-TRABALHO@CLASSIFICACAO-DO-EVENTO` ← `f_tipo_evento` (observado)

**texto livre**

- `DADOS-BASICOS-DO-TRABALHO@TITULO-DO-TRABALHO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DO-TRABALHO@ANO-DO-TRABALHO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DO-TRABALHO@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DO-TRABALHO@TITULO-DO-TRABALHO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DO-TRABALHO@NOME-DO-EVENTO` ← `f_evento` (observado)
- `DETALHAMENTO-DO-TRABALHO@CIDADE-DO-EVENTO` ← `f_cidade_evento` (inferido)
- `DETALHAMENTO-DO-TRABALHO@ANO-DE-REALIZACAO` ← `f_ano` (inferido)
- `DETALHAMENTO-DO-TRABALHO@TITULO-DOS-ANAIS-OU-PROCEEDINGS` ← `f_titulo_pub` (observado)
- `DETALHAMENTO-DO-TRABALHO@VOLUME` ← `f_volume` (inferido)
- `DETALHAMENTO-DO-TRABALHO@FASCICULO` ← `f_fasciculo` (inferido)
- `DETALHAMENTO-DO-TRABALHO@SERIE` ← `f_serie` (inferido)
- `DETALHAMENTO-DO-TRABALHO@ISBN` ← `f_isbn` (observado)
- `DETALHAMENTO-DO-TRABALHO@NOME-DA-EDITORA` ← `f_editora` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `TRABALHO-EM-EVENTOS@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DO-TRABALHO@DOI`
- `DETALHAMENTO-DO-TRABALHO@PAGINA-INICIAL`
- `DETALHAMENTO-DO-TRABALHO@PAGINA-FINAL`
- `DETALHAMENTO-DO-TRABALHO@CIDADE-DA-EDITORA`
- `DETALHAMENTO-DO-TRABALHO@NOME-DO-EVENTO-INGLES`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Textos em jornais ou revistas (texto-jornal)</summary>

**com opções**

- `DADOS-BASICOS-DO-TEXTO@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DO-TEXTO@PAIS-DE-PUBLICACAO` ← `f_pais` (observado)
- `DADOS-BASICOS-DO-TEXTO@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DO-TEXTO@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DO-TEXTO@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DO-TEXTO@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)

**texto livre**

- `DADOS-BASICOS-DO-TEXTO@TITULO-DO-TEXTO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DO-TEXTO@ANO-DO-TEXTO` ← `f_ano` (observado)
- `DADOS-BASICOS-DO-TEXTO@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (observado)
- `DADOS-BASICOS-DO-TEXTO@TITULO-DO-TEXTO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DO-TEXTO@TITULO-DO-JORNAL-OU-REVISTA` ← `f_titulo_periodico` (observado)
- `DETALHAMENTO-DO-TEXTO@ISSN` ← `f_issn` (observado)
- `DETALHAMENTO-DO-TEXTO@DATA-DE-PUBLICACAO` ← `f_data` (inferido)
- `DETALHAMENTO-DO-TEXTO@VOLUME` ← `f_volume` (inferido)
- `DETALHAMENTO-DO-TEXTO@LOCAL-DE-PUBLICACAO` ← `f_local` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `TEXTO-EM-JORNAL-OU-REVISTA@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DO-TEXTO@DOI`
- `DETALHAMENTO-DO-TEXTO@FORMATO-DATA-DE-PUBLICACAO`
- `DETALHAMENTO-DO-TEXTO@PAGINA-INICIAL`
- `DETALHAMENTO-DO-TEXTO@PAGINA-FINAL`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Tradução (traducao)</summary>

**com opções**

- `DADOS-BASICOS-DA-TRADUCAO@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DA-TRADUCAO@PAIS-DE-PUBLICACAO` ← `f_pais` (observado)
- `DADOS-BASICOS-DA-TRADUCAO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DADOS-BASICOS-DA-TRADUCAO@MEIO-DE-DIVULGACAO` ← `f_meio` (inferido)
- `DADOS-BASICOS-DA-TRADUCAO@FLAG-RELEVANCIA` ← `F_RELEV` (observado)

**texto livre**

- `DADOS-BASICOS-DA-TRADUCAO@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DA-TRADUCAO@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DA-TRADUCAO@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (observado)
- `DADOS-BASICOS-DA-TRADUCAO@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DA-TRADUCAO@NOME-DO-AUTOR-TRADUZIDO` ← `f_autor_trad` (observado)
- `DETALHAMENTO-DA-TRADUCAO@TITULO-DA-OBRA-ORIGINAL` ← `f_tit_obra` (observado)
- `DETALHAMENTO-DA-TRADUCAO@ISSN-ISBN` ← `f_issn` (observado)
- `DETALHAMENTO-DA-TRADUCAO@EDITORA-DA-TRADUCAO` ← `f_editora` (observado)
- `DETALHAMENTO-DA-TRADUCAO@CIDADE-DA-EDITORA` ← `f_cidade` (observado)
- `DETALHAMENTO-DA-TRADUCAO@NUMERO-DE-PAGINAS` ← `f_paginas` (inferido)
- `DETALHAMENTO-DA-TRADUCAO@NUMERO-DA-EDICAO-REVISAO` ← `f_edicao` (inferido)
- `DETALHAMENTO-DA-TRADUCAO@VOLUME` ← `f_volume` (inferido)
- `DETALHAMENTO-DA-TRADUCAO@FASCICULO` ← `f_fasciculo` (inferido)
- `DETALHAMENTO-DA-TRADUCAO@SERIE` ← `f_serie` (inferido)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `TRADUCAO@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DA-TRADUCAO@DOI`
- `DETALHAMENTO-DA-TRADUCAO@IDIOMA-DA-OBRA-ORIGINAL`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Partitura musical (partitura)</summary>

**com opções**

- `DADOS-BASICOS-DA-PARTITURA@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DA-PARTITURA@PAIS-DE-PUBLICACAO` ← `f_pais` (observado)
- `DADOS-BASICOS-DA-PARTITURA@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DA-PARTITURA@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DA-PARTITURA@FLAG-RELEVANCIA` ← `F_RELEV` (observado)

**texto livre**

- `DADOS-BASICOS-DA-PARTITURA@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DA-PARTITURA@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DA-PARTITURA@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (observado)
- `DADOS-BASICOS-DA-PARTITURA@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DA-PARTITURA@FORMACAO-INSTRUMENTAL` ← `f_formacao` (observado)
- `DETALHAMENTO-DA-PARTITURA@EDITORA` ← `f_editora` (observado)
- `DETALHAMENTO-DA-PARTITURA@CIDADE-DA-EDITORA` ← `f_cidade` (observado)
- `DETALHAMENTO-DA-PARTITURA@NUMERO-DE-PAGINAS` ← `f_paginas` (observado)
- `DETALHAMENTO-DA-PARTITURA@NUMERO-DO-CATALOGO` ← `f_issn` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (inferido)

**oculto**

- `PARTITURA-MUSICAL@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DA-PARTITURA@DOI`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Patente: janela "Incluir nova patente" (patente-janela)</summary>

</details>

<details><summary>Patente (patente)</summary>

**com opções**

- `DADOS-BASICOS-DA-PATENTE@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DA-PATENTE@FLAG-POTENCIAL-INOVACAO` ← `f_sta_inovacao` (inferido)
- `REGISTRO-OU-PATENTE@TIPO-PATENTE` ← `f_tipo` (inferido)

**texto livre**

- `DADOS-BASICOS-DA-PATENTE@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-PATENTE@HOME-PAGE` ← `f_home_page` (inferido)
- `DADOS-BASICOS-DA-PATENTE@TITULO-INGLES` ← `f_titulo_en` (inferido)
- `DETALHAMENTO-DA-PATENTE@FINALIDADE` ← `f_finalidade` (inferido)
- `REGISTRO-OU-PATENTE@CODIGO-DO-REGISTRO-OU-PATENTE` ← `f_cod_reg` (inferido)
- `REGISTRO-OU-PATENTE@TITULO-PATENTE` ← `f_titulo` (inferido)
- `REGISTRO-OU-PATENTE@INSTITUICAO-DEPOSITO-REGISTRO` ← `f_inst` (inferido)
- `REGISTRO-OU-PATENTE@NUMERO-DEPOSITO-PCT` ← `f_nro_deposito_pct` (inferido)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (inferido)

**oculto**

- `DADOS-BASICOS-DA-PATENTE@ANO-DESENVOLVIMENTO` ← `f_ano` (inferido)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `PATENTE@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-PATENTE@MEIO-DE-DIVULGACAO`
- `DADOS-BASICOS-DA-PATENTE@FLAG-RELEVANCIA`
- `DETALHAMENTO-DA-PATENTE@INSTITUICAO-FINANCIADORA`
- `DETALHAMENTO-DA-PATENTE@FINALIDADE-INGLES`
- `DETALHAMENTO-DA-PATENTE@CATEGORIA`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-PEDIDO`
- `REGISTRO-OU-PATENTE@DATA-PEDIDO-DE-DEPOSITO`
- `REGISTRO-OU-PATENTE@DATA-DE-PEDIDO-DE-EXAME`
- `REGISTRO-OU-PATENTE@DATA-DE-CONCESSAO`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@NOME-DO-TITULAR`
- `REGISTRO-OU-PATENTE@NOME-DO-DEPOSITANTE`
- `HISTORICO-SITUACOES-PATENTE@DESCRICAO-SITUACAO-PATENTE`
- `HISTORICO-SITUACOES-PATENTE@FORMATO-DATA-SITUACAO-PATENTE`
- `HISTORICO-SITUACOES-PATENTE@DATA-SITUACAO-PATENTE`
- `HISTORICO-SITUACOES-PATENTE@STATUS-SITUACAO-PATENTE`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Programa de computador (registro-PC)</summary>

**com opções**

- `DADOS-BASICOS-DO-SOFTWARE@NATUREZA` ← `f_natureza` (inferido)
- `DADOS-BASICOS-DO-SOFTWARE@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DO-SOFTWARE@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DO-SOFTWARE@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)
- `DADOS-BASICOS-DO-SOFTWARE@FLAG-POTENCIAL-INOVACAO` ← `f_sta_inovacao` (inferido)

**texto livre**

- `DADOS-BASICOS-DO-SOFTWARE@TITULO-DO-SOFTWARE` ← `f_titulo` (observado)
- `DADOS-BASICOS-DO-SOFTWARE@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DO-SOFTWARE@TITULO-DO-SOFTWARE-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DO-SOFTWARE@FINALIDADE` ← `f_finalidade` (observado)
- `DETALHAMENTO-DO-SOFTWARE@PLATAFORMA` ← `f_plataforma` (observado)
- `DETALHAMENTO-DO-SOFTWARE@INSTITUICAO-FINANCIADORA` ← `f_inst_financ` (observado)
- `REGISTRO-OU-PATENTE@TITULO-PATENTE` ← `f_titulo` (inferido)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `SOFTWARE@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `DETALHAMENTO-DO-SOFTWARE@AMBIENTE` ← `f_ambiente` (inferido)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DO-SOFTWARE@IDIOMA`
- `DADOS-BASICOS-DO-SOFTWARE@MEIO-DE-DIVULGACAO`
- `DADOS-BASICOS-DO-SOFTWARE@HOME-PAGE-DO-TRABALHO`
- `DADOS-BASICOS-DO-SOFTWARE@DOI`
- `DETALHAMENTO-DO-SOFTWARE@DISPONIBILIDADE`
- `DETALHAMENTO-DO-SOFTWARE@FINALIDADE-INGLES`
- `REGISTRO-OU-PATENTE@TIPO-PATENTE`
- `REGISTRO-OU-PATENTE@CODIGO-DO-REGISTRO-OU-PATENTE`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-PEDIDO`
- `REGISTRO-OU-PATENTE@DATA-PEDIDO-DE-DEPOSITO`
- `REGISTRO-OU-PATENTE@DATA-DE-PEDIDO-DE-EXAME`
- `REGISTRO-OU-PATENTE@DATA-DE-CONCESSAO`
- `REGISTRO-OU-PATENTE@INSTITUICAO-DEPOSITO-REGISTRO`
- `REGISTRO-OU-PATENTE@NUMERO-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@NOME-DO-TITULAR`
- `REGISTRO-OU-PATENTE@NOME-DO-DEPOSITANTE`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Programa de computador registrado (registro-PC-S)</summary>

**com opções**

- `DADOS-BASICOS-DO-SOFTWARE@NATUREZA` ← `f_natureza` (inferido)
- `DADOS-BASICOS-DO-SOFTWARE@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DO-SOFTWARE@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DO-SOFTWARE@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)
- `DADOS-BASICOS-DO-SOFTWARE@FLAG-POTENCIAL-INOVACAO` ← `f_sta_inovacao` (inferido)

**texto livre**

- `DADOS-BASICOS-DO-SOFTWARE@TITULO-DO-SOFTWARE` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DO-SOFTWARE@TITULO-DO-SOFTWARE-INGLES` ← `f_titulo_en` (inferido)
- `DETALHAMENTO-DO-SOFTWARE@FINALIDADE` ← `f_finalidade` (inferido)
- `DETALHAMENTO-DO-SOFTWARE@PLATAFORMA` ← `f_plataforma` (inferido)
- `REGISTRO-OU-PATENTE@CODIGO-DO-REGISTRO-OU-PATENTE` ← `f_cod_reg` (inferido)
- `REGISTRO-OU-PATENTE@TITULO-PATENTE` ← `f_titulo` (inferido)
- `REGISTRO-OU-PATENTE@INSTITUICAO-DEPOSITO-REGISTRO` ← `f_inst` (inferido)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS` ← `f_ref` (inferido)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (inferido)

**oculto**

- `DADOS-BASICOS-DO-SOFTWARE@ANO` ← `f_ano` (inferido)
- `DETALHAMENTO-DO-SOFTWARE@AMBIENTE` ← `f_ambiente` (inferido)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `SOFTWARE@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DO-SOFTWARE@IDIOMA`
- `DADOS-BASICOS-DO-SOFTWARE@MEIO-DE-DIVULGACAO`
- `DADOS-BASICOS-DO-SOFTWARE@HOME-PAGE-DO-TRABALHO`
- `DADOS-BASICOS-DO-SOFTWARE@DOI`
- `DETALHAMENTO-DO-SOFTWARE@DISPONIBILIDADE`
- `DETALHAMENTO-DO-SOFTWARE@INSTITUICAO-FINANCIADORA`
- `DETALHAMENTO-DO-SOFTWARE@FINALIDADE-INGLES`
- `REGISTRO-OU-PATENTE@TIPO-PATENTE`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-PEDIDO`
- `REGISTRO-OU-PATENTE@DATA-PEDIDO-DE-DEPOSITO`
- `REGISTRO-OU-PATENTE@DATA-DE-PEDIDO-DE-EXAME`
- `REGISTRO-OU-PATENTE@DATA-DE-CONCESSAO`
- `REGISTRO-OU-PATENTE@NUMERO-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@NOME-DO-TITULAR`
- `REGISTRO-OU-PATENTE@NOME-DO-DEPOSITANTE`

</details>

<details><summary>Cultivar protegida (registro-CP)</summary>

**com opções**

- `DADOS-BASICOS-DA-CULTIVAR@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DA-CULTIVAR@FLAG-POTENCIAL-INOVACAO` ← `f_sta_inovacao` (inferido)

**texto livre**

- `DADOS-BASICOS-DA-CULTIVAR@ANO-SOLICITACAO` ← `f_ano` (observado)
- `DADOS-BASICOS-DA-CULTIVAR@DENOMINACAO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DA-CULTIVAR@INSTITUICAO-FINANCIADORA` ← `f_inst` (inferido)
- `REGISTRO-OU-PATENTE@CODIGO-DO-REGISTRO-OU-PATENTE` ← `f_cod_reg` (inferido)
- `REGISTRO-OU-PATENTE@TITULO-PATENTE` ← `f_titulo` (inferido)
- `REGISTRO-OU-PATENTE@INSTITUICAO-DEPOSITO-REGISTRO` ← `f_inst` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `CULTIVAR-PROTEGIDA@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DA-CULTIVAR@DENOMINACAO`
- `DADOS-BASICOS-DA-CULTIVAR@FLAG-RELEVANCIA`
- `DETALHAMENTO-DA-CULTIVAR@FINALIDADE`
- `DETALHAMENTO-DA-CULTIVAR@FINALIDADE-INGLES`
- `REGISTRO-OU-PATENTE@TIPO-PATENTE`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-PEDIDO`
- `REGISTRO-OU-PATENTE@DATA-PEDIDO-DE-DEPOSITO`
- `REGISTRO-OU-PATENTE@DATA-DE-PEDIDO-DE-EXAME`
- `REGISTRO-OU-PATENTE@DATA-DE-CONCESSAO`
- `REGISTRO-OU-PATENTE@NUMERO-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@NOME-DO-TITULAR`
- `REGISTRO-OU-PATENTE@NOME-DO-DEPOSITANTE`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Cultivar registrada (registro-CR)</summary>

**com opções**

- `DADOS-BASICOS-DA-CULTIVAR@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DA-CULTIVAR@FLAG-POTENCIAL-INOVACAO` ← `f_sta_inovacao` (inferido)

**texto livre**

- `DADOS-BASICOS-DA-CULTIVAR@ANO-SOLICITACAO` ← `f_ano` (observado)
- `DADOS-BASICOS-DA-CULTIVAR@DENOMINACAO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DA-CULTIVAR@INSTITUICAO-FINANCIADORA` ← `f_inst` (inferido)
- `REGISTRO-OU-PATENTE@CODIGO-DO-REGISTRO-OU-PATENTE` ← `f_cod_reg` (observado)
- `REGISTRO-OU-PATENTE@TITULO-PATENTE` ← `f_titulo` (inferido)
- `REGISTRO-OU-PATENTE@INSTITUICAO-DEPOSITO-REGISTRO` ← `f_inst` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `CULTIVAR-REGISTRADA@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DA-CULTIVAR@DENOMINACAO`
- `DADOS-BASICOS-DA-CULTIVAR@FLAG-RELEVANCIA`
- `DETALHAMENTO-DA-CULTIVAR@FINALIDADE`
- `DETALHAMENTO-DA-CULTIVAR@FINALIDADE-INGLES`
- `REGISTRO-OU-PATENTE@TIPO-PATENTE`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-PEDIDO`
- `REGISTRO-OU-PATENTE@DATA-PEDIDO-DE-DEPOSITO`
- `REGISTRO-OU-PATENTE@DATA-DE-PEDIDO-DE-EXAME`
- `REGISTRO-OU-PATENTE@DATA-DE-CONCESSAO`
- `REGISTRO-OU-PATENTE@NUMERO-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@NOME-DO-TITULAR`
- `REGISTRO-OU-PATENTE@NOME-DO-DEPOSITANTE`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Desenho industrial (registro-DI)</summary>

**com opções**

- `DADOS-BASICOS-DO-DESENHO-INDUSTRIAL@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DO-DESENHO-INDUSTRIAL@FLAG-POTENCIAL-INOVACAO` ← `f_sta_inovacao` (inferido)

**texto livre**

- `DADOS-BASICOS-DO-DESENHO-INDUSTRIAL@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DO-DESENHO-INDUSTRIAL@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DO-DESENHO-INDUSTRIAL@FINALIDADE` ← `f_finalidade` (observado)
- `DETALHAMENTO-DO-DESENHO-INDUSTRIAL@INSTITUICAO-FINANCIADORA` ← `f_inst_financ` (observado)
- `REGISTRO-OU-PATENTE@CODIGO-DO-REGISTRO-OU-PATENTE` ← `f_cod_reg` (observado)
- `REGISTRO-OU-PATENTE@TITULO-PATENTE` ← `f_titulo` (inferido)
- `REGISTRO-OU-PATENTE@INSTITUICAO-DEPOSITO-REGISTRO` ← `f_inst` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `DESENHO-INDUSTRIAL@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `DADOS-BASICOS-DO-DESENHO-INDUSTRIAL@ANO-DESENVOLVIMENTO` ← `f_ano` (inferido)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DO-DESENHO-INDUSTRIAL@FLAG-RELEVANCIA`
- `DETALHAMENTO-DO-DESENHO-INDUSTRIAL@FINALIDADE-INGLES`
- `REGISTRO-OU-PATENTE@TIPO-PATENTE`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-PEDIDO`
- `REGISTRO-OU-PATENTE@DATA-PEDIDO-DE-DEPOSITO`
- `REGISTRO-OU-PATENTE@DATA-DE-PEDIDO-DE-EXAME`
- `REGISTRO-OU-PATENTE@DATA-DE-CONCESSAO`
- `REGISTRO-OU-PATENTE@NUMERO-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@NOME-DO-TITULAR`
- `REGISTRO-OU-PATENTE@NOME-DO-DEPOSITANTE`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Marca (registro-MR)</summary>

**com opções**

- `DADOS-BASICOS-DA-MARCA@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DA-MARCA@FLAG-POTENCIAL-INOVACAO` ← `f_sta_inovacao` (inferido)
- `DETALHAMENTO-DA-MARCA@NATUREZA` ← `f_natureza` (observado)
- `REGISTRO-OU-PATENTE@TIPO-PATENTE` ← `f_tipo` (observado)

**texto livre**

- `DADOS-BASICOS-DA-MARCA@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-MARCA@ANO-DESENVOLVIMENTO` ← `f_ano` (observado)
- `DADOS-BASICOS-DA-MARCA@TITULO-INGLES` ← `f_titulo_en` (observado)
- `REGISTRO-OU-PATENTE@CODIGO-DO-REGISTRO-OU-PATENTE` ← `f_cod_reg` (observado)
- `REGISTRO-OU-PATENTE@TITULO-PATENTE` ← `f_titulo` (inferido)
- `REGISTRO-OU-PATENTE@INSTITUICAO-DEPOSITO-REGISTRO` ← `f_inst` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `MARCA@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DA-MARCA@FLAG-RELEVANCIA`
- `DETALHAMENTO-DA-MARCA@FINALIDADE`
- `DETALHAMENTO-DA-MARCA@FINALIDADE-INGLES`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-PEDIDO`
- `REGISTRO-OU-PATENTE@DATA-PEDIDO-DE-DEPOSITO`
- `REGISTRO-OU-PATENTE@DATA-DE-PEDIDO-DE-EXAME`
- `REGISTRO-OU-PATENTE@DATA-DE-CONCESSAO`
- `REGISTRO-OU-PATENTE@NUMERO-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@NOME-DO-TITULAR`
- `REGISTRO-OU-PATENTE@NOME-DO-DEPOSITANTE`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Topografia de circuito integrado (registro-TC)</summary>

**com opções**

- `DADOS-BASICOS-DA-TOPOGRAFIA-DE-CIRCUITO-INTEGRADO@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DA-TOPOGRAFIA-DE-CIRCUITO-INTEGRADO@FLAG-POTENCIAL-INOVACAO` ← `f_sta_inovacao` (inferido)

**texto livre**

- `DADOS-BASICOS-DA-TOPOGRAFIA-DE-CIRCUITO-INTEGRADO@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-TOPOGRAFIA-DE-CIRCUITO-INTEGRADO@ANO-DESENVOLVIMENTO` ← `f_ano` (observado)
- `DADOS-BASICOS-DA-TOPOGRAFIA-DE-CIRCUITO-INTEGRADO@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DA-TOPOGRAFIA-DE-CIRCUITO-INTEGRADO@FINALIDADE` ← `f_finalidade` (observado)
- `DETALHAMENTO-DA-TOPOGRAFIA-DE-CIRCUITO-INTEGRADO@INSTITUICAO-FINANCIADORA` ← `f_inst_financ` (observado)
- `REGISTRO-OU-PATENTE@CODIGO-DO-REGISTRO-OU-PATENTE` ← `f_cod_reg` (observado)
- `REGISTRO-OU-PATENTE@TITULO-PATENTE` ← `f_titulo` (inferido)
- `REGISTRO-OU-PATENTE@INSTITUICAO-DEPOSITO-REGISTRO` ← `f_inst` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `TOPOGRAFIA-DE-CIRCUITO-INTEGRADO@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DA-TOPOGRAFIA-DE-CIRCUITO-INTEGRADO@FLAG-RELEVANCIA`
- `DETALHAMENTO-DA-TOPOGRAFIA-DE-CIRCUITO-INTEGRADO@FINALIDADE-INGLES`
- `REGISTRO-OU-PATENTE@TIPO-PATENTE`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-PEDIDO`
- `REGISTRO-OU-PATENTE@DATA-PEDIDO-DE-DEPOSITO`
- `REGISTRO-OU-PATENTE@DATA-DE-PEDIDO-DE-EXAME`
- `REGISTRO-OU-PATENTE@DATA-DE-CONCESSAO`
- `REGISTRO-OU-PATENTE@NUMERO-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@NOME-DO-TITULAR`
- `REGISTRO-OU-PATENTE@NOME-DO-DEPOSITANTE`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Produtos tecnológicos (produto)</summary>

**com opções**

- `DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO@TIPO-PRODUTO` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO@NATUREZA` ← `F_SUB_PROD` (observado)
- `DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO@FLAG-POTENCIAL-INOVACAO` ← `f_sta_inovacao` (inferido)
- `DETALHAMENTO-DO-PRODUTO-TECNOLOGICO@DISPONIBILIDADE` ← `f_disp` (observado)

**texto livre**

- `DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO@TITULO-DO-PRODUTO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (observado)
- `DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO@TITULO-DO-PRODUTO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DO-PRODUTO-TECNOLOGICO@FINALIDADE` ← `f_finalidade` (observado)
- `DETALHAMENTO-DO-PRODUTO-TECNOLOGICO@CIDADE-DO-PRODUTO` ← `f_cidade` (observado)
- `DETALHAMENTO-DO-PRODUTO-TECNOLOGICO@INSTITUICAO-FINANCIADORA` ← `f_inst` (observado)
- `REGISTRO-OU-PATENTE@TITULO-PATENTE` ← `f_titulo` (inferido)
- `REGISTRO-OU-PATENTE@INSTITUICAO-DEPOSITO-REGISTRO` ← `f_inst` (inferido)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `PRODUTO-TECNOLOGICO@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO@DOI`
- `DETALHAMENTO-DO-PRODUTO-TECNOLOGICO@FINALIDADE-INGLES`
- `REGISTRO-OU-PATENTE@TIPO-PATENTE`
- `REGISTRO-OU-PATENTE@CODIGO-DO-REGISTRO-OU-PATENTE`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-PEDIDO`
- `REGISTRO-OU-PATENTE@DATA-PEDIDO-DE-DEPOSITO`
- `REGISTRO-OU-PATENTE@DATA-DE-PEDIDO-DE-EXAME`
- `REGISTRO-OU-PATENTE@DATA-DE-CONCESSAO`
- `REGISTRO-OU-PATENTE@NUMERO-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@NOME-DO-TITULAR`
- `REGISTRO-OU-PATENTE@NOME-DO-DEPOSITANTE`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Processos ou técnicas (processo)</summary>

**com opções**

- `DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS@FLAG-POTENCIAL-INOVACAO` ← `f_sta_inovacao` (inferido)
- `DETALHAMENTO-DO-PROCESSOS-OU-TECNICAS@DISPONIBILIDADE` ← `f_disp` (observado)

**texto livre**

- `DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS@TITULO-DO-PROCESSO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (observado)
- `DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS@TITULO-DO-PROCESSO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DO-PROCESSOS-OU-TECNICAS@FINALIDADE` ← `f_finalidade` (observado)
- `DETALHAMENTO-DO-PROCESSOS-OU-TECNICAS@INSTITUICAO-FINANCIADORA` ← `f_inst` (observado)
- `DETALHAMENTO-DO-PROCESSOS-OU-TECNICAS@CIDADE-DO-PROCESSO` ← `f_cidade` (observado)
- `REGISTRO-OU-PATENTE@TITULO-PATENTE` ← `f_titulo` (inferido)
- `REGISTRO-OU-PATENTE@INSTITUICAO-DEPOSITO-REGISTRO` ← `f_inst` (inferido)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `PROCESSOS-OU-TECNICAS@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS@DOI`
- `DETALHAMENTO-DO-PROCESSOS-OU-TECNICAS@FINALIDADE-INGLES`
- `REGISTRO-OU-PATENTE@TIPO-PATENTE`
- `REGISTRO-OU-PATENTE@CODIGO-DO-REGISTRO-OU-PATENTE`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-PEDIDO`
- `REGISTRO-OU-PATENTE@DATA-PEDIDO-DE-DEPOSITO`
- `REGISTRO-OU-PATENTE@DATA-DE-PEDIDO-DE-EXAME`
- `REGISTRO-OU-PATENTE@DATA-DE-CONCESSAO`
- `REGISTRO-OU-PATENTE@NUMERO-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@NOME-DO-TITULAR`
- `REGISTRO-OU-PATENTE@NOME-DO-DEPOSITANTE`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Trabalhos técnicos (trabalho-tecnico)</summary>

**com opções**

- `DADOS-BASICOS-DO-TRABALHO-TECNICO@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DO-TRABALHO-TECNICO@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DO-TRABALHO-TECNICO@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DO-TRABALHO-TECNICO@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DO-TRABALHO-TECNICO@FLAG-RELEVANCIA` ← `F_RELEV` (observado)
- `DETALHAMENTO-DO-TRABALHO-TECNICO@DISPONIBILIDADE` ← `f_disp` (observado)

**texto livre**

- `DADOS-BASICOS-DO-TRABALHO-TECNICO@TITULO-DO-TRABALHO-TECNICO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DO-TRABALHO-TECNICO@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DO-TRABALHO-TECNICO@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (observado)
- `DADOS-BASICOS-DO-TRABALHO-TECNICO@TITULO-DO-TRABALHO-TECNICO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DO-TRABALHO-TECNICO@FINALIDADE` ← `f_finalidade` (observado)
- `DETALHAMENTO-DO-TRABALHO-TECNICO@DURACAO-EM-MESES` ← `f_duracao` (inferido)
- `DETALHAMENTO-DO-TRABALHO-TECNICO@NUMERO-DE-PAGINAS` ← `f_paginas` (inferido)
- `DETALHAMENTO-DO-TRABALHO-TECNICO@INSTITUICAO-FINANCIADORA` ← `f_inst` (observado)
- `DETALHAMENTO-DO-TRABALHO-TECNICO@CIDADE-DO-TRABALHO` ← `f_cidade` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `TRABALHO-TECNICO@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DO-TRABALHO-TECNICO@DOI`
- `DETALHAMENTO-DO-TRABALHO-TECNICO@FINALIDADE-INGLES`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Assessoria e consultoria (assessoria)</summary>

</details>

<details><summary>Extensão tecnológica (extensao-tecnologica)</summary>

</details>

<details><summary>Apresentação de trabalho (tec-2J)</summary>

**com opções**

- `DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)

**texto livre**

- `DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DA-APRESENTACAO-DE-TRABALHO@NOME-DO-EVENTO` ← `f_nme_evento` (observado)
- `DETALHAMENTO-DA-APRESENTACAO-DE-TRABALHO@INSTITUICAO-PROMOTORA` ← `f_inst` (observado)
- `DETALHAMENTO-DA-APRESENTACAO-DE-TRABALHO@LOCAL-DA-APRESENTACAO` ← `f_local` (observado)
- `DETALHAMENTO-DA-APRESENTACAO-DE-TRABALHO@CIDADE-DA-APRESENTACAO` ← `f_cidade` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `APRESENTACAO-DE-TRABALHO@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO@DOI`
- `DETALHAMENTO-DA-APRESENTACAO-DE-TRABALHO@NOME-DO-EVENTO-INGLES`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Carta, mapa ou similar (tec-2A)</summary>

**com opções**

- `DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR@FLAG-RELEVANCIA` ← `F_RELEV` (observado)

**texto livre**

- `DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (observado)
- `DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DE-CARTA-MAPA-OU-SIMILAR@TEMA-DA-CARTA-MAPA-OU-SIMILAR` ← `f_tema` (observado)
- `DETALHAMENTO-DE-CARTA-MAPA-OU-SIMILAR@TECNICA-UTILIZADA` ← `f_tecnica` (observado)
- `DETALHAMENTO-DE-CARTA-MAPA-OU-SIMILAR@FINALIDADE` ← `f_finalidade` (observado)
- `DETALHAMENTO-DE-CARTA-MAPA-OU-SIMILAR@AREA-REPRESENTADA` ← `f_area` (observado)
- `DETALHAMENTO-DE-CARTA-MAPA-OU-SIMILAR@INSTITUICAO-FINANCIADORA` ← `f_inst` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `CARTA-MAPA-OU-SIMILAR@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR@DOI`
- `DETALHAMENTO-DE-CARTA-MAPA-OU-SIMILAR@FINALIDADE-INGLES`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Curso de curta duração (tec-2B)</summary>

**com opções**

- `DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO@NIVEL-DO-CURSO` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)
- `DETALHAMENTO-DE-CURSOS-CURTA-DURACAO-MINISTRADO@PARTICIPACAO-DOS-AUTORES` ← `f_participacao` (observado)
- `DETALHAMENTO-DE-CURSOS-CURTA-DURACAO-MINISTRADO@UNIDADE` ← `f_unidade` (observado)

**texto livre**

- `DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DE-CURSOS-CURTA-DURACAO-MINISTRADO@INSTITUICAO-PROMOTORA-DO-CURSO` ← `f_inst` (observado)
- `DETALHAMENTO-DE-CURSOS-CURTA-DURACAO-MINISTRADO@LOCAL-DO-CURSO` ← `f_local` (observado)
- `DETALHAMENTO-DE-CURSOS-CURTA-DURACAO-MINISTRADO@CIDADE` ← `f_cidade` (observado)
- `DETALHAMENTO-DE-CURSOS-CURTA-DURACAO-MINISTRADO@DURACAO` ← `f_duracao` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `CURSO-DE-CURTA-DURACAO-MINISTRADO@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO@HOME-PAGE-DO-TRABALHO`
- `DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO@DOI`
- `DETALHAMENTO-DE-CURSOS-CURTA-DURACAO-MINISTRADO@UNIDADE-INGLES`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Material didático (tec-2C)</summary>

**com opções**

- `DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)

**texto livre**

- `DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL@NATUREZA` ← `f_natureza` (observado)
- `DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (observado)
- `DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL@FINALIDADE` ← `f_finalidade` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `DESENVOLVIMENTO-DE-MATERIAL-DIDATICO-OU-INSTRUCIONAL@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL@DOI`
- `DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL@NATUREZA-INGLES`
- `DETALHAMENTO-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL@FINALIDADE-INGLES`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Editoração (tec-2D)</summary>

**com opções**

- `DADOS-BASICOS-DE-EDITORACAO@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DE-EDITORACAO@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DE-EDITORACAO@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DE-EDITORACAO@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DE-EDITORACAO@FLAG-RELEVANCIA` ← `F_RELEV` (observado)

**texto livre**

- `DADOS-BASICOS-DE-EDITORACAO@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DE-EDITORACAO@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DE-EDITORACAO@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (observado)
- `DADOS-BASICOS-DE-EDITORACAO@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DE-EDITORACAO@NUMERO-DE-PAGINAS` ← `f_paginas` (observado)
- `DETALHAMENTO-DE-EDITORACAO@INSTITUICAO-PROMOTORA` ← `f_inst` (observado)
- `DETALHAMENTO-DE-EDITORACAO@EDITORA` ← `f_editora` (observado)
- `DETALHAMENTO-DE-EDITORACAO@CIDADE` ← `f_cidade` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `EDITORACAO@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DE-EDITORACAO@DOI`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Manutenção de obra artística (tec-2E)</summary>

**com opções**

- `DADOS-BASICOS-DE-MANUTENCAO-DE-OBRA-ARTISTICA@NATUREZA` ← `F_SUB_PROD` (observado)
- `DADOS-BASICOS-DE-MANUTENCAO-DE-OBRA-ARTISTICA@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DE-MANUTENCAO-DE-OBRA-ARTISTICA@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DE-MANUTENCAO-DE-OBRA-ARTISTICA@FLAG-RELEVANCIA` ← `F_RELEV` (observado)
- `DETALHAMENTO-DE-MANUTENCAO-DE-OBRA-ARTISTICA@ACERVO` ← `f_acervo` (inferido)

**texto livre**

- `DADOS-BASICOS-DE-MANUTENCAO-DE-OBRA-ARTISTICA@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DE-MANUTENCAO-DE-OBRA-ARTISTICA@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DE-MANUTENCAO-DE-OBRA-ARTISTICA@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DE-MANUTENCAO-DE-OBRA-ARTISTICA@NOME-DA-OBRA` ← `f_obra` (observado)
- `DETALHAMENTO-DE-MANUTENCAO-DE-OBRA-ARTISTICA@AUTOR-DA-OBRA` ← `f_autor_obra` (observado)
- `DETALHAMENTO-DE-MANUTENCAO-DE-OBRA-ARTISTICA@LOCAL` ← `f_local` (observado)
- `DETALHAMENTO-DE-MANUTENCAO-DE-OBRA-ARTISTICA@CIDADE` ← `f_cidade` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `MANUTENCAO-DE-OBRA-ARTISTICA@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DE-MANUTENCAO-DE-OBRA-ARTISTICA@TIPO`
- `DADOS-BASICOS-DE-MANUTENCAO-DE-OBRA-ARTISTICA@DOI`
- `DETALHAMENTO-DE-MANUTENCAO-DE-OBRA-ARTISTICA@ANO-DA-OBRA`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Maquete (tec-2F)</summary>

**com opções**

- `DADOS-BASICOS-DA-MAQUETE@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DA-MAQUETE@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DA-MAQUETE@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DA-MAQUETE@FLAG-RELEVANCIA` ← `F_RELEV` (observado)

**texto livre**

- `DADOS-BASICOS-DA-MAQUETE@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DA-MAQUETE@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DA-MAQUETE@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DA-MAQUETE@FINALIDADE` ← `f_finalidade` (observado)
- `DETALHAMENTO-DA-MAQUETE@OBJETO-REPRESENTADO` ← `f_objeto` (observado)
- `DETALHAMENTO-DA-MAQUETE@MATERIAL-UTILIZADO` ← `f_material` (observado)
- `DETALHAMENTO-DA-MAQUETE@INSTITUICAO-FINANCIADORA` ← `f_inst` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `MAQUETE@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DA-MAQUETE@HOME-PAGE-DO-TRABALHO`
- `DADOS-BASICOS-DA-MAQUETE@DOI`
- `DETALHAMENTO-DA-MAQUETE@FINALIDADE-INGLES`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Organização de evento (tec-2G)</summary>

**com opções**

- `DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO@TIPO` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO@NATUREZA` ← `F_SUB_PROD` (observado)
- `DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)
- `DETALHAMENTO-DA-ORGANIZACAO-DE-EVENTO@FLAG-EVENTO-ITINERANTE` ← `f_itinerante` (inferido)
- `DETALHAMENTO-DA-ORGANIZACAO-DE-EVENTO@FLAG-CATALOGO` ← `f_catalogo` (inferido)

**texto livre**

- `DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DA-ORGANIZACAO-DE-EVENTO@INSTITUICAO-PROMOTORA` ← `f_inst` (observado)
- `DETALHAMENTO-DA-ORGANIZACAO-DE-EVENTO@DURACAO-EM-SEMANAS` ← `f_duracao` (observado)
- `DETALHAMENTO-DA-ORGANIZACAO-DE-EVENTO@LOCAL` ← `f_local` (observado)
- `DETALHAMENTO-DA-ORGANIZACAO-DE-EVENTO@CIDADE` ← `f_cidade` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `ORGANIZACAO-DE-EVENTO@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO@HOME-PAGE-DO-TRABALHO`
- `DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO@DOI`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Programa de rádio ou TV (tec-2H)</summary>

**com opções**

- `DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV@MEIO-DE-DIVULGACAO` ← `f_meio` (inferido)
- `DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)

**texto livre**

- `DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV@HOME-PAGE` ← `F_HOMEPAGE` (observado)
- `DETALHAMENTO-DO-PROGRAMA-DE-RADIO-OU-TV@EMISSORA` ← `f_emissora` (observado)
- `DETALHAMENTO-DO-PROGRAMA-DE-RADIO-OU-TV@TEMA` ← `f_tema` (observado)
- `DETALHAMENTO-DO-PROGRAMA-DE-RADIO-OU-TV@DATA-DA-APRESENTACAO` ← `f_data` (inferido)
- `DETALHAMENTO-DO-PROGRAMA-DE-RADIO-OU-TV@DURACAO-EM-MINUTOS` ← `f_duracao` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `PROGRAMA-DE-RADIO-OU-TV@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV@DOI`
- `DETALHAMENTO-DO-PROGRAMA-DE-RADIO-OU-TV@FORMATO-DATA-DA-APRESENTACAO`
- `DETALHAMENTO-DO-PROGRAMA-DE-RADIO-OU-TV@CIDADE`
- `DETALHAMENTO-DO-PROGRAMA-DE-RADIO-OU-TV@VEICULO-DE-DIVULGACAO`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Relatório de pesquisa (tec-2I)</summary>

**com opções**

- `DADOS-BASICOS-DO-RELATORIO-DE-PESQUISA@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DO-RELATORIO-DE-PESQUISA@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DO-RELATORIO-DE-PESQUISA@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DO-RELATORIO-DE-PESQUISA@FLAG-RELEVANCIA` ← `F_RELEV` (observado)
- `DETALHAMENTO-DO-RELATORIO-DE-PESQUISA@DISPONIBILIDADE` ← `f_disp` (observado)

**texto livre**

- `DADOS-BASICOS-DO-RELATORIO-DE-PESQUISA@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DO-RELATORIO-DE-PESQUISA@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DO-RELATORIO-DE-PESQUISA@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DO-RELATORIO-DE-PESQUISA@NOME-DO-PROJETO` ← `f_projeto` (observado)
- `DETALHAMENTO-DO-RELATORIO-DE-PESQUISA@NUMERO-DE-PAGINAS` ← `f_paginas` (observado)
- `DETALHAMENTO-DO-RELATORIO-DE-PESQUISA@INSTITUICAO-FINANCIADORA` ← `f_inst` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `RELATORIO-DE-PESQUISA@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DO-RELATORIO-DE-PESQUISA@HOME-PAGE-DO-TRABALHO`
- `DADOS-BASICOS-DO-RELATORIO-DE-PESQUISA@DOI`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Redes sociais, sites e blogs (tec-2L)</summary>

**com opções**

- `DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)

**texto livre**

- `DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG@HOME-PAGE` ← `F_HOMEPAGE` (observado)
- `DETALHAMENTO-DA-MIDIA-SOCIAL-WEBSITE-BLOG@TEMA` ← `f_tema` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `MIDIA-SOCIAL-WEBSITE-BLOG@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG@NATUREZA-INGLES`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Outra produção técnica (tec-2Z)</summary>

**com opções**

- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)

**texto livre**

- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA@NATUREZA` ← `f_natureza` (observado)
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DE-OUTRA-PRODUCAO-TECNICA@FINALIDADE` ← `f_finalidade` (observado)
- `DETALHAMENTO-DE-OUTRA-PRODUCAO-TECNICA@INSTITUICAO-PROMOTORA` ← `f_inst` (observado)
- `DETALHAMENTO-DE-OUTRA-PRODUCAO-TECNICA@LOCAL` ← `f_local` (observado)
- `DETALHAMENTO-DE-OUTRA-PRODUCAO-TECNICA@CIDADE` ← `f_cidade` (observado)
- `REGISTRO-OU-PATENTE@TITULO-PATENTE` ← `f_titulo` (inferido)
- `REGISTRO-OU-PATENTE@INSTITUICAO-DEPOSITO-REGISTRO` ← `f_inst` (inferido)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `OUTRA-PRODUCAO-TECNICA@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA@HOME-PAGE-DO-TRABALHO`
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA@DOI`
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA@NATUREZA-INGLES`
- `DETALHAMENTO-DE-OUTRA-PRODUCAO-TECNICA@FINALIDADE-INGLES`
- `REGISTRO-OU-PATENTE@TIPO-PATENTE`
- `REGISTRO-OU-PATENTE@CODIGO-DO-REGISTRO-OU-PATENTE`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-PEDIDO`
- `REGISTRO-OU-PATENTE@DATA-PEDIDO-DE-DEPOSITO`
- `REGISTRO-OU-PATENTE@DATA-DE-PEDIDO-DE-EXAME`
- `REGISTRO-OU-PATENTE@DATA-DE-CONCESSAO`
- `REGISTRO-OU-PATENTE@NUMERO-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@FORMATO-DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@DATA-DEPOSITO-PCT`
- `REGISTRO-OU-PATENTE@NOME-DO-TITULAR`
- `REGISTRO-OU-PATENTE@NOME-DO-DEPOSITANTE`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Artes cênicas (arte-AC)</summary>

**com opções**

- `DADOS-BASICOS-DE-ARTES-CENICAS@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DE-ARTES-CENICAS@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DE-ARTES-CENICAS@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DE-ARTES-CENICAS@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DE-ARTES-CENICAS@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DE-ARTES-CENICAS@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)
- `DETALHAMENTO-DE-ARTES-CENICAS@TIPO-DE-EVENTO` ← `f_tpo_evento` (observado)
- `DETALHAMENTO-DE-ARTES-CENICAS@ATIVIDADE-DOS-AUTORES` ← `f_tpo_ativ` (observado)

**texto livre**

- `DADOS-BASICOS-DE-ARTES-CENICAS@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DE-ARTES-CENICAS@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DE-ARTES-CENICAS@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DADOS-BASICOS-DE-ARTES-CENICAS@HOME-PAGE` ← `f_homepage` (observado)
- `DETALHAMENTO-DE-ARTES-CENICAS@LOCAL-DE-ESTREIA` ← `f_local_estreia` (observado)
- `DETALHAMENTO-DE-ARTES-CENICAS@PREMIACAO` ← `f_premiacao` (observado)
- `DETALHAMENTO-DE-ARTES-CENICAS@INSTITUICAO-PROMOTORA-DO-PREMIO` ← `f_inst_premio` (observado)
- `DETALHAMENTO-DE-ARTES-CENICAS@OBRA-DE-REFERENCIA` ← `F_EXPOSICAO` (observado)
- `DETALHAMENTO-DE-ARTES-CENICAS@AUTOR-DA-OBRA-DE-REFERENCIA` ← `f_autor_obra` (observado)
- `DETALHAMENTO-DE-ARTES-CENICAS@DURACAO` ← `f_duracao` (observado)
- `DETALHAMENTO-DE-ARTES-CENICAS@TEMPORADA` ← `f_temporada` (observado)
- `DETALHAMENTO-DE-ARTES-CENICAS@INSTITUICAO-PROMOTORA-DO-EVENTO` ← `f_inst` (observado)
- `DETALHAMENTO-DE-ARTES-CENICAS@LOCAL-DO-EVENTO` ← `f_local` (observado)
- `DETALHAMENTO-DE-ARTES-CENICAS@CIDADE-DO-EVENTO` ← `f_cidade` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `ARTES-CENICAS@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `DETALHAMENTO-DE-ARTES-CENICAS@FLAG-ITINERANTE` ← `f_itinerante` (inferido)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DETALHAMENTO-DE-ARTES-CENICAS@DATA-ESTREIA`
- `DETALHAMENTO-DE-ARTES-CENICAS@DATA-ENCERRAMENTO`
- `DETALHAMENTO-DE-ARTES-CENICAS@ANO-DA-OBRA-DE-REFERENCIA`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Música (arte-MU)</summary>

**com opções**

- `DADOS-BASICOS-DA-MUSICA@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DA-MUSICA@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DA-MUSICA@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DA-MUSICA@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DA-MUSICA@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DA-MUSICA@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)
- `DETALHAMENTO-DA-MUSICA@TIPO-DE-EVENTO` ← `f_tpo_evento` (observado)
- `DETALHAMENTO-DA-MUSICA@ATIVIDADE-DOS-AUTORES` ← `f_tpo_ativ` (observado)

**texto livre**

- `DADOS-BASICOS-DA-MUSICA@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DA-MUSICA@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DA-MUSICA@HOME-PAGE` ← `f_homepage` (observado)
- `DADOS-BASICOS-DA-MUSICA@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DA-MUSICA@FORMACAO-INSTRUMENTAL` ← `f_form_instr` (observado)
- `DETALHAMENTO-DA-MUSICA@LOCAL-DE-ESTREIA` ← `f_local_estreia` (observado)
- `DETALHAMENTO-DA-MUSICA@PREMIACAO` ← `f_premiacao` (observado)
- `DETALHAMENTO-DA-MUSICA@INSTITUICAO-PROMOTORA-DO-PREMIO` ← `f_inst_premio` (observado)
- `DETALHAMENTO-DA-MUSICA@OBRA-DE-REFERENCIA` ← `F_EXPOSICAO` (observado)
- `DETALHAMENTO-DA-MUSICA@AUTOR-DA-OBRA-DE-REFERENCIA` ← `f_autor_obra` (observado)
- `DETALHAMENTO-DA-MUSICA@DURACAO` ← `f_duracao` (observado)
- `DETALHAMENTO-DA-MUSICA@TEMPORADA` ← `f_temporada` (observado)
- `DETALHAMENTO-DA-MUSICA@INSTITUICAO-PROMOTORA-DO-EVENTO` ← `f_inst` (observado)
- `DETALHAMENTO-DA-MUSICA@LOCAL-DO-EVENTO` ← `f_local` (observado)
- `DETALHAMENTO-DA-MUSICA@CIDADE-DO-EVENTO` ← `f_cidade` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `MUSICA@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DETALHAMENTO-DA-MUSICA@FLAG-INEDITISMO-DA-OBRA`
- `DETALHAMENTO-DA-MUSICA@DATA-ESTREIA`
- `DETALHAMENTO-DA-MUSICA@DATA-ENCERRAMENTO`
- `DETALHAMENTO-DA-MUSICA@ANO-DA-OBRA-DE-REFERENCIA`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Artes visuais (arte-AV)</summary>

**com opções**

- `DADOS-BASICOS-DE-ARTES-VISUAIS@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DE-ARTES-VISUAIS@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DE-ARTES-VISUAIS@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DE-ARTES-VISUAIS@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DE-ARTES-VISUAIS@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DE-ARTES-VISUAIS@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)
- `DETALHAMENTO-DE-ARTES-VISUAIS@ATIVIDADE-DOS-AUTORES` ← `f_tpo_ativ` (observado)

**texto livre**

- `DADOS-BASICOS-DE-ARTES-VISUAIS@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DE-ARTES-VISUAIS@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DE-ARTES-VISUAIS@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DADOS-BASICOS-DE-ARTES-VISUAIS@HOME-PAGE` ← `f_homepage` (observado)
- `DETALHAMENTO-DE-ARTES-VISUAIS@PREMIACAO` ← `f_premiacao` (observado)
- `DETALHAMENTO-DE-ARTES-VISUAIS@INSTITUICAO-PROMOTORA-DO-EVENTO` ← `f_inst` (observado)
- `DETALHAMENTO-DE-ARTES-VISUAIS@LOCAL-DO-EVENTO` ← `f_local` (observado)
- `DETALHAMENTO-DE-ARTES-VISUAIS@CIDADE-DO-EVENTO` ← `f_cidade` (observado)
- `DETALHAMENTO-DE-ARTES-VISUAIS@TEMPORADA` ← `f_temporada` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `ARTES-VISUAIS@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Outra produção artística (arte-OU)</summary>

**com opções**

- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (inferido)

**texto livre**

- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@NATUREZA` ← `f_natureza` (observado)
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@HOME-PAGE` ← `f_homepage` (observado)
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@INSTITUICAO-PROMOTORA-DO-EVENTO` ← `f_inst` (observado)
- `DETALHAMENTO-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@LOCAL-DO-EVENTO` ← `f_local` (observado)
- `DETALHAMENTO-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@CIDADE` ← `f_cidade` (observado)
- `DETALHAMENTO-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@EXPOSICAO` ← `F_EXPOSICAO` (observado)
- `DETALHAMENTO-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@PREMIACAO` ← `f_premiacao` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)

**oculto**

- `OUTRA-PRODUCAO-ARTISTICA-CULTURAL@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@DOI`
- `DADOS-BASICOS-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL@NATUREZA-INGLES`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>

<details><summary>Orientações concluídas (orientacao-concluida)</summary>

**com opções**

- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@FLAG-BOLSA` ← `F_BOLSA` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@FLAG-BOLSA` ← `F_BOLSA` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@FLAG-RELEVANCIA` ← `F_RELEV` (inferido)
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@FLAG-BOLSA` ← `F_BOLSA` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@FLAG-RELEVANCIA` ← `F_RELEV` (observado)
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@FLAG-BOLSA` ← `F_BOLSA` (inferido)

**texto livre**

- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@TITULO-INGLES` ← `f_titulo_en` (inferido)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@TITULO-INGLES` ← `f_titulo_en` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@TITULO-INGLES` ← `f_titulo_en` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@HOME-PAGE` ← `f_homepage` (observado)
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@NOME-DO-ORIENTADO` ← `f_nme_orient` (observado)
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@NOME-DA-INSTITUICAO` ← `f_inst` (observado)
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@NOME-DO-CURSO` ← `f_curso` (observado)

**oculto**

- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@TIPO` ← `f_tipo` (inferido)
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@NUMERO-ID-ORIENTADO` ← `f_id_orientado` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@NUMERO-ID-ORIENTADO` ← `f_id_orientado` (inferido)
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@NUMERO-ID-ORIENTADO` ← `f_id_orientado` (inferido)
- `OUTRAS-ORIENTACOES-CONCLUIDAS@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@TIPO` ← `f_tipo` (inferido)
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@CODIGO-CURSO` ← `f_cod_curso` (observado)
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@CODIGO-AGENCIA-FINANCIADORA` ← `f_agencia` (observado)
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@NUMERO-ID-ORIENTADO` ← `f_id_orientado` (inferido)

**fora do formulário**

- `ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@NATUREZA`
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@DOI`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@TIPO-DE-ORIENTACAO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@NOME-DO-ORIENTADO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@NOME-DA-INSTITUICAO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@CODIGO-ORGAO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@NOME-ORGAO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@NOME-DO-CURSO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@CODIGO-AGENCIA-FINANCIADORA`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@NOME-DA-AGENCIA`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@NUMERO-DE-PAGINAS`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO@NOME-DO-CURSO-INGLES`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`
- `ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@NATUREZA`
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@DOI`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@TIPO-DE-ORIENTACAO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@NOME-DO-ORIENTADO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@NOME-DA-INSTITUICAO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@CODIGO-ORGAO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@NOME-ORGAO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@NOME-DO-CURSO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@CODIGO-AGENCIA-FINANCIADORA`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@NOME-DA-AGENCIA`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@NUMERO-DE-PAGINAS`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO@NOME-DO-CURSO-INGLES`
- `ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@NATUREZA`
- `DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@DOI`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@TIPO-DE-ORIENTACAO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@NOME-DO-ORIENTADO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@NOME-DA-INSTITUICAO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@CODIGO-ORGAO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@NOME-ORGAO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@NOME-DO-CURSO`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@CODIGO-AGENCIA-FINANCIADORA`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@NOME-DA-AGENCIA`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@NUMERO-DE-PAGINAS`
- `DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO@NOME-DO-CURSO-INGLES`
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@DOI`
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@TIPO-INGLES`
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@CODIGO-ORGAO`
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@NOME-ORGAO`
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@NOME-DA-AGENCIA`
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@TIPO-DE-ORIENTACAO-CONCLUIDA`
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@NUMERO-DE-PAGINAS`
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS@NOME-DO-CURSO-INGLES`

</details>

<details><summary>Orientações em andamento (orientacao-andamento)</summary>

**com opções**

- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@FLAG-BOLSA` ← `F_BOLSA` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@FLAG-BOLSA` ← `F_BOLSA` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@FLAG-BOLSA` ← `F_BOLSA` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@FLAG-BOLSA` ← `F_BOLSA` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@FLAG-BOLSA` ← `F_BOLSA` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@IDIOMA` ← `F_IDIOMA` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@FLAG-BOLSA` ← `F_BOLSA` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@FLAG-BOLSA` ← `F_BOLSA` (inferido)

**texto livre**

- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@TITULO-DO-TRABALHO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@TITULO-DO-TRABALHO-INGLES` ← `f_titulo_en` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@NOME-DO-ORIENTANDO` ← `f_nme_orient` (inferido)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@TITULO-DO-TRABALHO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@TITULO-DO-TRABALHO-INGLES` ← `f_titulo_en` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@NOME-DO-ORIENTANDO` ← `f_nme_orient` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@TITULO-DO-TRABALHO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@TITULO-DO-TRABALHO-INGLES` ← `f_titulo_en` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@NOME-DO-ORIENTANDO` ← `f_nme_orient` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@TITULO-DO-TRABALHO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@TITULO-DO-TRABALHO-INGLES` ← `f_titulo_en` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@NOME-DO-ORIENTANDO` ← `f_nme_orient` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@TITULO-DO-TRABALHO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@TITULO-DO-TRABALHO-INGLES` ← `f_titulo_en` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@NOME-DO-ORIENTANDO` ← `f_nme_orient` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@TITULO-DO-TRABALHO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@TITULO-DO-TRABALHO-INGLES` ← `f_titulo_en` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@NOME-DO-ORIENTANDO` ← `f_nme_orient` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@TITULO-DO-TRABALHO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@TITULO-DO-TRABALHO-INGLES` ← `f_titulo_en` (inferido)
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@NOME-DO-ORIENTANDO` ← `f_nme_orient` (inferido)

**oculto**

- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@TIPO` ← `f_tipo` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@NUMERO-ID-ORIENTADO` ← `f_id_orientado` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@CODIGO-CURSO` ← `f_cod_curso` (inferido)

**fora do formulário**

- `ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@NATUREZA`
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@DOI`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@TIPO-DE-ORIENTACAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@CODIGO-ORGAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@NOME-ORGAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@NOME-CURSO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@CODIGO-AGENCIA-FINANCIADORA`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@NOME-DA-AGENCIA`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO@NOME-CURSO-INGLES`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`
- `ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@NATUREZA`
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@DOI`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@TIPO-DE-ORIENTACAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@CODIGO-ORGAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@NOME-ORGAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@NOME-CURSO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@CODIGO-AGENCIA-FINANCIADORA`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@NOME-DA-AGENCIA`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@NUMERO-ID-ORIENTANDO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO@NOME-CURSO-INGLES`
- `ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@NATUREZA`
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@DOI`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@TIPO-DE-ORIENTACAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@CODIGO-ORGAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@NOME-ORGAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@NOME-CURSO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@CODIGO-AGENCIA-FINANCIADORA`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@NOME-DA-AGENCIA`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@NUMERO-ID-ORIENTANDO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO@NOME-CURSO-INGLES`
- `ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@NATUREZA`
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@DOI`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@CODIGO-ORGAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@NOME-ORGAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@NOME-CURSO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@CODIGO-AGENCIA-FINANCIADORA`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@NOME-DA-AGENCIA`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@NUMERO-ID-ORIENTANDO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO@NOME-CURSO-INGLES`
- `ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@NATUREZA`
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@DOI`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@CODIGO-ORGAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@NOME-ORGAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@NOME-CURSO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@CODIGO-AGENCIA-FINANCIADORA`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@NOME-DA-AGENCIA`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@NUMERO-ID-ORIENTANDO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO@NOME-CURSO-INGLES`
- `ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@NATUREZA`
- `DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@DOI`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@CODIGO-ORGAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@NOME-ORGAO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@NOME-CURSO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@CODIGO-AGENCIA-FINANCIADORA`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@NOME-DA-AGENCIA`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@NUMERO-ID-ORIENTANDO`
- `DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA@NOME-CURSO-INGLES`
- `OUTRAS-ORIENTACOES-EM-ANDAMENTO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@NATUREZA`
- `DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@DOI`
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@NOME-INSTITUICAO`
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@CODIGO-ORGAO`
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@NOME-ORGAO`
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@NOME-CURSO`
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@CODIGO-AGENCIA-FINANCIADORA`
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@NOME-DA-AGENCIA`
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@NUMERO-ID-ORIENTANDO`
- `DETALHAMENTO-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO@NOME-CURSO-INGLES`

</details>

<details><summary>Bancas de trabalhos de conclusão (banca-trabalho)</summary>

**com opções**

- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-BANCA@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-BANCA@IDIOMA` ← `F_IDIOMA` (inferido)

**texto livre**

- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@TITULO-INGLES` ← `f_titulo_en` (inferido)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@TITULO-INGLES` ← `f_titulo_en` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@HOME-PAGE` ← `f_homepage` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@NOME-DO-CANDIDATO` ← `f_nme_orient` (observado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@NOME-INSTITUICAO` ← `f_inst` (observado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@NOME-CURSO` ← `f_curso` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@TITULO-INGLES` ← `f_titulo_en` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@TITULO-INGLES` ← `f_titulo_en` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-BANCA@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-BANCA@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-BANCA@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-BANCA@TITULO-INGLES` ← `f_titulo_en` (inferido)

**oculto**

- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@CODIGO-CURSO` ← `f_cod_curso` (observado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@CODIGO-CURSO` ← `f_cod_curso` (inferido)
- `DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-BANCA@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-BANCA@CODIGO-CURSO` ← `f_cod_curso` (inferido)

**fora do formulário**

- `PARTICIPACAO-EM-BANCA-DE-MESTRADO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@NATUREZA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@TIPO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@DOI`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@NOME-DO-CANDIDATO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@CODIGO-ORGAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@NOME-ORGAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@NOME-CURSO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO@NOME-CURSO-INGLES`
- `PARTICIPANTE-BANCA@NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA`
- `PARTICIPANTE-BANCA@NOME-PARA-CITACAO-DO-PARTICIPANTE-DA-BANCA`
- `PARTICIPANTE-BANCA@ORDEM-PARTICIPANTE`
- `PARTICIPANTE-BANCA@CPF-DO-PARTICIPANTE-DA-BANCA`
- `PARTICIPANTE-BANCA@NRO-ID-CNPQ`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`
- `PARTICIPACAO-EM-BANCA-DE-DOUTORADO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@NATUREZA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@DOI`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@NOME-DO-CANDIDATO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@CODIGO-ORGAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@NOME-ORGAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@NOME-CURSO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO@NOME-CURSO-INGLES`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@DOI`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@CODIGO-ORGAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@NOME-ORGAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO@NOME-CURSO-INGLES`
- `PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@NATUREZA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@DOI`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@NOME-DO-CANDIDATO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@CODIGO-ORGAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@NOME-ORGAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@NOME-CURSO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO@NOME-CURSO-INGLES`
- `PARTICIPACAO-EM-BANCA-DE-GRADUACAO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@NATUREZA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@DOI`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@NOME-DO-CANDIDATO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@CODIGO-ORGAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@NOME-ORGAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@NOME-CURSO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO@NOME-CURSO-INGLES`
- `OUTRAS-PARTICIPACOES-EM-BANCA@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-BANCA@NATUREZA`
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-BANCA@TIPO`
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-BANCA@DOI`
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-BANCA@TIPO-INGLES`
- `DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-BANCA@NOME-DO-CANDIDATO`
- `DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-BANCA@NOME-INSTITUICAO`
- `DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-BANCA@CODIGO-ORGAO`
- `DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-BANCA@NOME-ORGAO`
- `DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-BANCA@NOME-CURSO`
- `DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-BANCA@NOME-CURSO-INGLES`

</details>

<details><summary>Bancas julgadoras (banca-julgadora)</summary>

**com opções**

- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-PROFESSOR-TITULAR@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-PROFESSOR-TITULAR@IDIOMA` ← `F_IDIOMA` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-CONCURSO-PUBLICO@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-CONCURSO-PUBLICO@IDIOMA` ← `F_IDIOMA` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-LIVRE-DOCENCIA@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-LIVRE-DOCENCIA@IDIOMA` ← `F_IDIOMA` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-AVALIACAO-CURSOS@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-AVALIACAO-CURSOS@IDIOMA` ← `F_IDIOMA` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-BANCAS-JULGADORAS@PAIS` ← `f_pais` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-BANCAS-JULGADORAS@IDIOMA` ← `F_IDIOMA` (inferido)

**texto livre**

- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-PROFESSOR-TITULAR@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-PROFESSOR-TITULAR@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-PROFESSOR-TITULAR@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-PROFESSOR-TITULAR@TITULO-INGLES` ← `f_titulo_en` (inferido)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (observado)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-CONCURSO-PUBLICO@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-CONCURSO-PUBLICO@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-CONCURSO-PUBLICO@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-CONCURSO-PUBLICO@TITULO-INGLES` ← `f_titulo_en` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-LIVRE-DOCENCIA@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-LIVRE-DOCENCIA@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-LIVRE-DOCENCIA@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-LIVRE-DOCENCIA@TITULO-INGLES` ← `f_titulo_en` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-AVALIACAO-CURSOS@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-AVALIACAO-CURSOS@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-AVALIACAO-CURSOS@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-AVALIACAO-CURSOS@TITULO-INGLES` ← `f_titulo_en` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-BANCAS-JULGADORAS@TITULO` ← `f_titulo` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-BANCAS-JULGADORAS@ANO` ← `f_ano` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-BANCAS-JULGADORAS@HOME-PAGE` ← `f_homepage` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-BANCAS-JULGADORAS@TITULO-INGLES` ← `f_titulo_en` (inferido)

**oculto**

- `DETALHAMENTO-DA-BANCA-JULGADORA-PARA-PROFESSOR-TITULAR@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)
- `DETALHAMENTO-DA-BANCA-JULGADORA-PARA-CONCURSO-PUBLICO@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DA-BANCA-JULGADORA-PARA-LIVRE-DOCENCIA@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DA-BANCA-JULGADORA-PARA-AVALIACAO-CURSOS@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)
- `DETALHAMENTO-DE-OUTRAS-BANCAS-JULGADORAS@CODIGO-INSTITUICAO` ← `f_cod_inst` (inferido)

**fora do formulário**

- `BANCA-JULGADORA-PARA-PROFESSOR-TITULAR@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-PROFESSOR-TITULAR@NATUREZA`
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-PROFESSOR-TITULAR@DOI`
- `DETALHAMENTO-DA-BANCA-JULGADORA-PARA-PROFESSOR-TITULAR@NOME-INSTITUICAO`
- `PARTICIPANTE-BANCA@NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA`
- `PARTICIPANTE-BANCA@NOME-PARA-CITACAO-DO-PARTICIPANTE-DA-BANCA`
- `PARTICIPANTE-BANCA@ORDEM-PARTICIPANTE`
- `PARTICIPANTE-BANCA@CPF-DO-PARTICIPANTE-DA-BANCA`
- `PARTICIPANTE-BANCA@NRO-ID-CNPQ`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`
- `BANCA-JULGADORA-PARA-CONCURSO-PUBLICO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-CONCURSO-PUBLICO@NATUREZA`
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-CONCURSO-PUBLICO@DOI`
- `DETALHAMENTO-DA-BANCA-JULGADORA-PARA-CONCURSO-PUBLICO@NOME-INSTITUICAO`
- `BANCA-JULGADORA-PARA-LIVRE-DOCENCIA@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-LIVRE-DOCENCIA@NATUREZA`
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-LIVRE-DOCENCIA@DOI`
- `DETALHAMENTO-DA-BANCA-JULGADORA-PARA-LIVRE-DOCENCIA@NOME-INSTITUICAO`
- `BANCA-JULGADORA-PARA-AVALIACAO-CURSOS@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-AVALIACAO-CURSOS@NATUREZA`
- `DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-AVALIACAO-CURSOS@DOI`
- `DETALHAMENTO-DA-BANCA-JULGADORA-PARA-AVALIACAO-CURSOS@NOME-INSTITUICAO`
- `OUTRAS-BANCAS-JULGADORAS@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DE-OUTRAS-BANCAS-JULGADORAS@TIPO`
- `DADOS-BASICOS-DE-OUTRAS-BANCAS-JULGADORAS@NATUREZA`
- `DADOS-BASICOS-DE-OUTRAS-BANCAS-JULGADORAS@DOI`
- `DADOS-BASICOS-DE-OUTRAS-BANCAS-JULGADORAS@TIPO-INGLES`
- `DETALHAMENTO-DE-OUTRAS-BANCAS-JULGADORAS@NOME-INSTITUICAO`

</details>

<details><summary>Participação em eventos (evento)</summary>

**com opções**

- `DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO@NATUREZA` ← `F_COD_PROD` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO@TIPO-PARTICIPACAO` ← `F_TPO` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO@FORMA-PARTICIPACAO` ← `F_FORMA` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO@PAIS` ← `f_pais` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO@TIPO-PARTICIPACAO` ← `F_TPO` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO@FORMA-PARTICIPACAO` ← `F_FORMA` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SIMPOSIO@PAIS` ← `f_pais` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SIMPOSIO@TIPO-PARTICIPACAO` ← `F_TPO` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SIMPOSIO@FORMA-PARTICIPACAO` ← `F_FORMA` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SIMPOSIO@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OFICINA@PAIS` ← `f_pais` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OFICINA@TIPO-PARTICIPACAO` ← `F_TPO` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OFICINA@FORMA-PARTICIPACAO` ← `F_FORMA` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OFICINA@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO@PAIS` ← `f_pais` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO@TIPO-PARTICIPACAO` ← `F_TPO` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO@FORMA-PARTICIPACAO` ← `F_FORMA` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OLIMPIADA@PAIS` ← `f_pais` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OLIMPIADA@TIPO-PARTICIPACAO` ← `F_TPO` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OLIMPIADA@FORMA-PARTICIPACAO` ← `F_FORMA` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OLIMPIADA@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-FEIRA@PAIS` ← `f_pais` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-FEIRA@TIPO-PARTICIPACAO` ← `F_TPO` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-FEIRA@FORMA-PARTICIPACAO` ← `F_FORMA` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-FEIRA@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-EXPOSICAO@PAIS` ← `f_pais` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-EXPOSICAO@TIPO-PARTICIPACAO` ← `F_TPO` (inferido)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-EXPOSICAO@FORMA-PARTICIPACAO` ← `F_FORMA` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-EXPOSICAO@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (documentado)
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@PAIS` ← `f_pais` (documentado)
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@TIPO-PARTICIPACAO` ← `F_TPO` (inferido)
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@FORMA-PARTICIPACAO` ← `F_FORMA` (observado)
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@FLAG-DIVULGACAO-CIENTIFICA` ← `F_STA_DIVULGACAO_CIENTIFICA` (documentado)

**texto livre**

- `DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO@TITULO` ← `f_titulo` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO@TITULO-INGLES` ← `f_titulo_en` (documentado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO@NOME-DO-EVENTO` ← `f_nme_evento` (observado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO@CIDADE-DO-EVENTO` ← `f_cidade` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO@TITULO` ← `f_titulo` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO@ANO` ← `f_ano` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO@TITULO-INGLES` ← `f_titulo_en` (documentado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-SEMINARIO@NOME-DO-EVENTO` ← `f_nme_evento` (documentado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-SEMINARIO@CIDADE-DO-EVENTO` ← `f_cidade` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SIMPOSIO@TITULO` ← `f_titulo` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SIMPOSIO@ANO` ← `f_ano` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SIMPOSIO@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SIMPOSIO@TITULO-INGLES` ← `f_titulo_en` (documentado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-SIMPOSIO@NOME-DO-EVENTO` ← `f_nme_evento` (documentado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-SIMPOSIO@CIDADE-DO-EVENTO` ← `f_cidade` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OFICINA@TITULO` ← `f_titulo` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OFICINA@ANO` ← `f_ano` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OFICINA@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OFICINA@TITULO-INGLES` ← `f_titulo_en` (documentado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-OFICINA@NOME-DO-EVENTO` ← `f_nme_evento` (documentado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-OFICINA@CIDADE-DO-EVENTO` ← `f_cidade` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO@TITULO` ← `f_titulo` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO@ANO` ← `f_ano` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO@TITULO-INGLES` ← `f_titulo_en` (documentado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-ENCONTRO@NOME-DO-EVENTO` ← `f_nme_evento` (documentado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-ENCONTRO@CIDADE-DO-EVENTO` ← `f_cidade` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OLIMPIADA@TITULO` ← `f_titulo` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OLIMPIADA@ANO` ← `f_ano` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OLIMPIADA@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OLIMPIADA@TITULO-INGLES` ← `f_titulo_en` (documentado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-OLIMPIADA@NOME-DO-EVENTO` ← `f_nme_evento` (documentado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-OLIMPIADA@CIDADE-DO-EVENTO` ← `f_cidade` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-FEIRA@TITULO` ← `f_titulo` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-FEIRA@ANO` ← `f_ano` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-FEIRA@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-FEIRA@TITULO-INGLES` ← `f_titulo_en` (documentado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-FEIRA@NOME-DO-EVENTO` ← `f_nme_evento` (documentado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-FEIRA@CIDADE-DO-EVENTO` ← `f_cidade` (observado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-EXPOSICAO@TITULO` ← `f_titulo` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-EXPOSICAO@ANO` ← `f_ano` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-EXPOSICAO@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (documentado)
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-EXPOSICAO@TITULO-INGLES` ← `f_titulo_en` (documentado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-EXPOSICAO@NOME-DO-EVENTO` ← `f_nme_evento` (documentado)
- `DETALHAMENTO-DA-PARTICIPACAO-EM-EXPOSICAO@CIDADE-DO-EVENTO` ← `f_cidade` (observado)
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@TITULO` ← `f_titulo` (documentado)
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@ANO` ← `f_ano` (documentado)
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@HOME-PAGE-DO-TRABALHO` ← `f_homepage` (documentado)
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@TITULO-INGLES` ← `f_titulo_en` (documentado)
- `DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@NOME-DO-EVENTO` ← `f_nme_evento` (documentado)
- `DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@CIDADE-DO-EVENTO` ← `f_cidade` (observado)

**oculto**

- `PARTICIPACAO-EM-CONGRESSO@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)

**fora do formulário**

- `DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO@IDIOMA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO@MEIO-DE-DIVULGACAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO@FLAG-RELEVANCIA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO@DOI`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO@CODIGO-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO@LOCAL-DO-EVENTO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO@NOME-DO-EVENTO-INGLES`
- `PARTICIPANTE-DE-EVENTOS-CONGRESSOS@NOME-COMPLETO-DO-PARTICIPANTE-DE-EVENTOS-CONGRESSOS`
- `PARTICIPANTE-DE-EVENTOS-CONGRESSOS@NOME-PARA-CITACAO-DO-PARTICIPANTE-DE-EVENTOS-CONGRESSOS`
- `PARTICIPANTE-DE-EVENTOS-CONGRESSOS@ORDEM-PARTICIPANTE`
- `PARTICIPANTE-DE-EVENTOS-CONGRESSOS@CPF-DO-PARTICIPANTE-PARTICIPANTE-DE-EVENTOS-CONGRESSOS`
- `PARTICIPANTE-DE-EVENTOS-CONGRESSOS@NRO-ID-CNPQ`
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1`
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2`
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3`
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4`
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5`
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6`
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE`
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE`
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO`
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE`
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1`
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2`
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES`
- `PARTICIPACAO-EM-SEMINARIO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO@NATUREZA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO@IDIOMA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO@MEIO-DE-DIVULGACAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO@FLAG-RELEVANCIA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO@DOI`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-SEMINARIO@CODIGO-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-SEMINARIO@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-SEMINARIO@LOCAL-DO-EVENTO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-SEMINARIO@NOME-DO-EVENTO-INGLES`
- `PARTICIPACAO-EM-SIMPOSIO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SIMPOSIO@NATUREZA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SIMPOSIO@IDIOMA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SIMPOSIO@MEIO-DE-DIVULGACAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SIMPOSIO@FLAG-RELEVANCIA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-SIMPOSIO@DOI`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-SIMPOSIO@CODIGO-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-SIMPOSIO@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-SIMPOSIO@LOCAL-DO-EVENTO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-SIMPOSIO@NOME-DO-EVENTO-INGLES`
- `PARTICIPACAO-EM-OFICINA@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OFICINA@NATUREZA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OFICINA@IDIOMA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OFICINA@MEIO-DE-DIVULGACAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OFICINA@FLAG-RELEVANCIA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OFICINA@DOI`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-OFICINA@CODIGO-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-OFICINA@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-OFICINA@LOCAL-DO-EVENTO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-OFICINA@NOME-DO-EVENTO-INGLES`
- `PARTICIPACAO-EM-ENCONTRO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO@NATUREZA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO@IDIOMA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO@MEIO-DE-DIVULGACAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO@FLAG-RELEVANCIA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO@DOI`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-ENCONTRO@CODIGO-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-ENCONTRO@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-ENCONTRO@LOCAL-DO-EVENTO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-ENCONTRO@NOME-DO-EVENTO-INGLES`
- `PARTICIPACAO-EM-OLIMPIADA@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OLIMPIADA@NATUREZA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OLIMPIADA@IDIOMA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OLIMPIADA@MEIO-DE-DIVULGACAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OLIMPIADA@FLAG-RELEVANCIA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-OLIMPIADA@DOI`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-OLIMPIADA@CODIGO-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-OLIMPIADA@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-OLIMPIADA@LOCAL-DO-EVENTO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-OLIMPIADA@NOME-DO-EVENTO-INGLES`
- `PARTICIPACAO-EM-FEIRA@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-FEIRA@NATUREZA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-FEIRA@IDIOMA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-FEIRA@MEIO-DE-DIVULGACAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-FEIRA@FLAG-RELEVANCIA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-FEIRA@DOI`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-FEIRA@CODIGO-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-FEIRA@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-FEIRA@LOCAL-DO-EVENTO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-FEIRA@NOME-DO-EVENTO-INGLES`
- `PARTICIPACAO-EM-EXPOSICAO@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-EXPOSICAO@NATUREZA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-EXPOSICAO@IDIOMA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-EXPOSICAO@MEIO-DE-DIVULGACAO`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-EXPOSICAO@FLAG-RELEVANCIA`
- `DADOS-BASICOS-DA-PARTICIPACAO-EM-EXPOSICAO@DOI`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-EXPOSICAO@CODIGO-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-EXPOSICAO@NOME-INSTITUICAO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-EXPOSICAO@LOCAL-DO-EVENTO`
- `DETALHAMENTO-DA-PARTICIPACAO-EM-EXPOSICAO@NOME-DO-EVENTO-INGLES`
- `OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@SEQUENCIA-PRODUCAO`
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@NATUREZA`
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@IDIOMA`
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@MEIO-DE-DIVULGACAO`
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@FLAG-RELEVANCIA`
- `DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@DOI`
- `DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@CODIGO-INSTITUICAO`
- `DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@NOME-INSTITUICAO`
- `DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@LOCAL-DO-EVENTO`
- `DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS@NOME-DO-EVENTO-INGLES`

</details>

<details><summary>Demais trabalhos (demais-trabalhos)</summary>

**com opções**

- `DADOS-BASICOS-DE-DEMAIS-TRABALHOS@PAIS` ← `f_pais` (observado)
- `DADOS-BASICOS-DE-DEMAIS-TRABALHOS@IDIOMA` ← `F_IDIOMA` (observado)
- `DADOS-BASICOS-DE-DEMAIS-TRABALHOS@MEIO-DE-DIVULGACAO` ← `f_meio` (observado)
- `DADOS-BASICOS-DE-DEMAIS-TRABALHOS@FLAG-RELEVANCIA` ← `F_RELEV` (observado)

**texto livre**

- `DADOS-BASICOS-DE-DEMAIS-TRABALHOS@NATUREZA` ← `f_natureza` (observado)
- `DADOS-BASICOS-DE-DEMAIS-TRABALHOS@TITULO` ← `f_titulo` (observado)
- `DADOS-BASICOS-DE-DEMAIS-TRABALHOS@ANO` ← `f_ano` (observado)
- `DADOS-BASICOS-DE-DEMAIS-TRABALHOS@HOME-PAGE` ← `f_homepage` (observado)
- `DADOS-BASICOS-DE-DEMAIS-TRABALHOS@TITULO-INGLES` ← `f_titulo_en` (observado)
- `DETALHAMENTO-DE-DEMAIS-TRABALHOS@FINALIDADE` ← `f_finalidade` (observado)
- `DETALHAMENTO-DE-DEMAIS-TRABALHOS@LOCAL` ← `f_local` (observado)
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS-INGLES` ← `f_ref_en` (inferido)

**oculto**

- `DEMAIS-TRABALHOS@SEQUENCIA-PRODUCAO` ← `f_seq` (observado)
- `AUTORES@NOME-COMPLETO-DO-AUTOR` ← `f_autores_l` (inferido)
- `AUTORES@NOME-PARA-CITACAO` ← `f_autores_l` (inferido)
- `AUTORES@ORDEM-DE-AUTORIA` ← `f_autores_l` (inferido)
- `AUTORES@CPF` ← `f_autores_l` (inferido)
- `AUTORES@NRO-ID-CNPQ` ← `f_autores_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-1` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-2` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-3` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-4` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-5` ← `f_plv_l` (inferido)
- `PALAVRAS-CHAVE@PALAVRA-CHAVE-6` ← `f_plv_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-1@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-2@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-GRANDE-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-SUB-AREA-DO-CONHECIMENTO` ← `f_area_l` (inferido)
- `AREA-DO-CONHECIMENTO-3@NOME-DA-ESPECIALIDADE` ← `f_area_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-1` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-2` ← `f_setor_l` (inferido)
- `SETORES-DE-ATIVIDADE@SETOR-DE-ATIVIDADE-3` ← `f_setor_l` (inferido)

**fora do formulário**

- `DADOS-BASICOS-DE-DEMAIS-TRABALHOS@DOI`
- `DADOS-BASICOS-DE-DEMAIS-TRABALHOS@NATUREZA-INGLES`
- `INFORMACOES-ADICIONAIS@DESCRICAO-INFORMACOES-ADICIONAIS`

</details>
