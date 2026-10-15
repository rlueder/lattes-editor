# Inclusão por tipo de item

O inventário da LAT-57: cada tipo de item que o currículo guarda numa lista,
como um item novo desse tipo chega ao Lattes hoje, se o editor oferece criá-lo
e qual formulário de inclusão do Lattes o censo de 15/10/2026 conhece para ele
(`lattes-formularios/`). O objetivo do ticket é que todo tipo possa ser criado
no editor e chegue ao Lattes sem trabalho manual; este documento é o ponto de
partida e registra o que muda a cada etapa.

As tabelas são conferidas por `tests/create-inventory.test.ts` contra o código
(`src/bridge/create-inventory.ts`) e contra a captura mais recente do censo: se
um caminho mudar no código e não aqui, o teste reprova. A coluna "Item" é texto
livre; as outras saem do código.

## As colunas

- **Elemento**: o elemento do XML. Entram todos os que têm um atributo
  `SEQUENCIA-*` (o Lattes numera cada item que inclui) e os três itens de lista
  sem número: idioma, prêmio e licença.
- **Faz parte de**: o item que contém este. Um vínculo só existe dentro de uma
  atuação; uma disciplina, dentro de uma atividade de ensino.
- **Editor cria**: o editor oferece criar o tipo, no "Novo item" das produções
  ou no botão da seção (formação, atuação, projetos, patentes e registros).
- **Caminho hoje**: `conector` quando o conector tem a operação de inclusão
  (todas atrás de `CREATE_ITEMS_ENABLED` e da capacidade `incluir-itens` da
  extensão, ligadas para o teste ao vivo); `importar` quando o item vai no
  arquivo do Importar, pelos passos na tela ou pelo Importar do conector, que
  ainda não pôs um item no currículo num teste real (`lattes_internals.md`,
  seção 13); `nenhum` quando o item novo só chega ao
  Lattes copiado à mão.
- **Formulário no censo**: a entrada do censo (`src/census/targets.ts` e
  `targets-production.ts`) cujo formulário grava o elemento.
- **Captura**: o que a captura de 15/10/2026 trouxe dessa entrada.
- **Endereço/ligação**: se o endereço do formulário foi visto no Lattes e se a
  ligação do formulário com o elemento do XML foi conferida, como o censo
  registra (`observado` ou `inferido`).

## Resumo

São 114 tipos. 96 são itens de uma lista do currículo e 18 fazem parte de
outro item.

| Caminho hoje | Tipos | Editor cria |
| ------------ | ----: | ----------: |
| conector     |    31 |          31 |
| importar     |    60 |          60 |
| nenhum       |    23 |          23 |

O editor cria todos os tipos. Os 23 sem caminho vão para "A enviar" com a
rota "à mão", cada um com o motivo: a patente (o titular sai de um vetor do
menu cuja forma ainda não foi lida), o projeto (o Lattes exige o órgão ou
unidade na inclusão, e o editor não o pede), a formação complementar, a
licença, as áreas de atuação, oito das nove naturezas de atividade de uma
atuação (todas menos a de ensino pedem o órgão, que entra por uma busca cuja
resposta não foi lida), a disciplina numa atividade que já existe, o
treinamento, a linha de pesquisa, o financiador, a produção e a orientação de
um projeto, e a participação em projeto (que nasce com o projeto).

Os outros cinco registros (cultivar protegida, cultivar registrada, desenho
industrial, marca e topografia de circuito) e a atividade
de ensino com as suas disciplinas passaram a ir pelo conector em 15/10/2026,
depois que o lote 4 da recaptura leu a linha da própria pessoa no vetor de
autores do menu. Nenhum deles teve ainda uma inclusão real acompanhada.

O que entra num item que já existe pede, antes do formulário, onde entra: a
atuação do vínculo e das atividades, a atividade de ensino da disciplina, a de
treinamento do treinamento, a de pesquisa e desenvolvimento da linha de
pesquisa, e o projeto do financiador, da produção e da orientação. Disciplina
e treinamento são só um nome, que fica no texto do elemento.

## Tabelas

### Formação

| Elemento                                          | Item                                            | Faz parte de | Editor cria | Caminho hoje | Formulário no censo     | Captura | Endereço/ligação    |
| ------------------------------------------------- | ----------------------------------------------- | ------------ | ----------- | ------------ | ----------------------- | ------- | ------------------- |
| `CURSO-TECNICO-PROFISSIONALIZANTE`                | Curso técnico profissionalizante                |              | sim         | conector     | `formacao-FA-7`         | lido    | observado/observado |
| `ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU`                | Ensino fundamental primeiro grau                |              | sim         | conector     | `formacao-FA-B`         | lido    | observado/inferido  |
| `ENSINO-MEDIO-SEGUNDO-GRAU`                       | Ensino médio segundo grau                       |              | sim         | conector     | `formacao-FA-C`         | lido    | observado/inferido  |
| `GRADUACAO`                                       | Graduação                                       |              | sim         | conector     | `formacao-FA-1`         | lido    | observado/observado |
| `APERFEICOAMENTO`                                 | Aperfeiçoamento                                 |              | sim         | conector     | `formacao-FA-X`         | lido    | observado/inferido  |
| `ESPECIALIZACAO`                                  | Especialização                                  |              | sim         | conector     | `formacao-FA-2`         | lido    | observado/inferido  |
| `MESTRADO`                                        | Mestrado                                        |              | sim         | conector     | `formacao-FA-3`         | lido    | observado/observado |
| `MESTRADO-PROFISSIONALIZANTE`                     | Mestrado profissionalizante                     |              | sim         | conector     | `formacao-FA-9`         | lido    | observado/inferido  |
| `DOUTORADO`                                       | Doutorado                                       |              | sim         | conector     | `formacao-FA-4`         | lido    | observado/inferido  |
| `RESIDENCIA-MEDICA`                               | Residência médica                               |              | sim         | conector     | `formacao-FA-D`         | lido    | observado/inferido  |
| `LIVRE-DOCENCIA`                                  | Livre-docência                                  |              | sim         | conector     | `formacao-AP-6`         | lido    | observado/inferido  |
| `POS-DOUTORADO`                                   | Pós-doutorado                                   |              | sim         | conector     | `formacao-AP-5`         | lido    | observado/inferido  |
| `FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA` | Formação complementar de extensão universitária |              | sim         | nenhum       | `formacao-complementar` | lido    | observado/observado |
| `MBA`                                             | MBA                                             |              | sim         | nenhum       | `formacao-complementar` | lido    | observado/observado |
| `FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO`    | Formação complementar curso de curta duração    |              | sim         | nenhum       | `formacao-complementar` | lido    | observado/observado |
| `OUTROS`                                          | Outros                                          |              | sim         | nenhum       | `formacao-complementar` | lido    | observado/observado |

### Dados gerais

| Elemento          | Item             | Faz parte de | Editor cria | Caminho hoje | Formulário no censo | Captura | Endereço/ligação    |
| ----------------- | ---------------- | ------------ | ----------- | ------------ | ------------------- | ------- | ------------------- |
| `AREA-DE-ATUACAO` | Área de atuação  |              | sim         | nenhum       | `areas-de-atuacao`  | lido    | observado/observado |
| `IDIOMA`          | Idioma           |              | sim         | conector     | `idioma`            | lido    | observado/observado |
| `LICENCA`         | Licença          |              | sim         | nenhum       | `licenca`           | lido    | observado/inferido  |
| `PREMIO-TITULO`   | Prêmio ou título |              | sim         | conector     | `premio`            | lido    | observado/observado |

### Atuação e projetos

| Elemento                             | Item                               | Faz parte de                 | Editor cria | Caminho hoje | Formulário no censo                                             | Captura                      | Endereço/ligação                                                                                        |
| ------------------------------------ | ---------------------------------- | ---------------------------- | ----------- | ------------ | --------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `DISCIPLINA`                         | Disciplina                         | `ENSINO`                     | sim         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `LINHA-DE-PESQUISA`                  | Linha de pesquisa                  | `PESQUISA-E-DESENVOLVIMENTO` | sim         | nenhum       | `linha-de-pesquisa`                                             | sem link                     | inferido/inferido                                                                                       |
| `PROJETO-DE-PESQUISA`                | Projeto                            | `PARTICIPACAO-EM-PROJETO`    | sim         | nenhum       | `projeto-P`, `projeto-D`, `projeto-E`, `projeto-N`, `projeto-O` | lido, lido, lido, lido, lido | observado/observado, observado/observado, observado/observado, observado/observado, observado/observado |
| `FINANCIADOR-DO-PROJETO`             | Financiador do projeto             | `PROJETO-DE-PESQUISA`        | sim         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `PRODUCAO-CT-DO-PROJETO`             | Produção C&T do projeto            | `PROJETO-DE-PESQUISA`        | sim         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `ORIENTACAO`                         | Orientação                         | `PROJETO-DE-PESQUISA`        | sim         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `TREINAMENTO`                        | Treinamento                        | `TREINAMENTO-MINISTRADO`     | sim         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `ATUACAO-PROFISSIONAL`               | Atuação profissional               |                              | sim         | conector     | `atuacao`                                                       | lido                         | observado/observado                                                                                     |
| `VINCULOS`                           | Vínculo                            | `ATUACAO-PROFISSIONAL`       | sim         | conector     | `vinculo`                                                       | lido                         | observado/observado                                                                                     |
| `DIRECAO-E-ADMINISTRACAO`            | Direção e administração            | `ATUACAO-PROFISSIONAL`       | sim         | nenhum       | `atividade-1`                                                   | lido                         | observado/inferido                                                                                      |
| `PESQUISA-E-DESENVOLVIMENTO`         | Pesquisa e desenvolvimento         | `ATUACAO-PROFISSIONAL`       | sim         | nenhum       | `atividade-2`                                                   | lido                         | observado/inferido                                                                                      |
| `ENSINO`                             | Ensino                             | `ATUACAO-PROFISSIONAL`       | sim         | conector     | `atividade-4`                                                   | lido                         | observado/inferido                                                                                      |
| `ESTAGIO`                            | Estágio                            | `ATUACAO-PROFISSIONAL`       | sim         | nenhum       | `atividade-5`                                                   | lido                         | observado/inferido                                                                                      |
| `SERVICO-TECNICO-ESPECIALIZADO`      | Serviço técnico especializado      | `ATUACAO-PROFISSIONAL`       | sim         | nenhum       | `atividade-6`                                                   | lido                         | observado/inferido                                                                                      |
| `EXTENSAO-UNIVERSITARIA`             | Extensão universitária             | `ATUACAO-PROFISSIONAL`       | sim         | nenhum       | `atividade-7`                                                   | lido                         | observado/inferido                                                                                      |
| `TREINAMENTO-MINISTRADO`             | Treinamento ministrado             | `ATUACAO-PROFISSIONAL`       | sim         | nenhum       | `atividade-8`                                                   | lido                         | observado/inferido                                                                                      |
| `OUTRA-ATIVIDADE-TECNICO-CIENTIFICA` | Outra atividade técnico-científica | `ATUACAO-PROFISSIONAL`       | sim         | nenhum       | `atividade-9`                                                   | lido                         | observado/inferido                                                                                      |
| `CONSELHO-COMISSAO-E-CONSULTORIA`    | Conselho, comissão e consultoria   | `ATUACAO-PROFISSIONAL`       | sim         | nenhum       | `atividade-B`                                                   | lido                         | observado/inferido                                                                                      |
| `PARTICIPACAO-EM-PROJETO`            | Participação em projeto            | `ATUACAO-PROFISSIONAL`       | sim         | nenhum       | nenhum                                                          |                              |                                                                                                         |

### Patentes e registros

| Elemento                           | Item                             | Faz parte de | Editor cria | Caminho hoje | Formulário no censo | Captura | Endereço/ligação    |
| ---------------------------------- | -------------------------------- | ------------ | ----------- | ------------ | ------------------- | ------- | ------------------- |
| `PATENTE`                          | Patente                          |              | sim         | nenhum       | `patente`           | lido    | observado/observado |
| `CULTIVAR-PROTEGIDA`               | Cultivar protegida               |              | sim         | conector     | `registro-CP`       | lido    | observado/inferido  |
| `CULTIVAR-REGISTRADA`              | Cultivar registrada              |              | sim         | conector     | `registro-CR`       | lido    | observado/inferido  |
| `DESENHO-INDUSTRIAL`               | Desenho industrial               |              | sim         | conector     | `registro-DI`       | lido    | observado/inferido  |
| `MARCA`                            | Marca                            |              | sim         | conector     | `registro-MR`       | lido    | observado/inferido  |
| `TOPOGRAFIA-DE-CIRCUITO-INTEGRADO` | Topografia de circuito integrado |              | sim         | conector     | `registro-TC`       | lido    | observado/inferido  |

### Eventos

| Elemento                                     | Item                                         | Faz parte de | Editor cria | Caminho hoje | Formulário no censo | Captura | Endereço/ligação    |
| -------------------------------------------- | -------------------------------------------- | ------------ | ----------- | ------------ | ------------------- | ------- | ------------------- |
| `PARTICIPACAO-EM-CONGRESSO`                  | Participação em congresso                    |              | sim         | conector     | `evento`            | lido    | observado/observado |
| `PARTICIPACAO-EM-FEIRA`                      | Participação em feira                        |              | sim         | conector     | `evento`            | lido    | observado/observado |
| `PARTICIPACAO-EM-SEMINARIO`                  | Participação em seminário                    |              | sim         | conector     | `evento`            | lido    | observado/observado |
| `PARTICIPACAO-EM-SIMPOSIO`                   | Participação em simpósio                     |              | sim         | conector     | `evento`            | lido    | observado/observado |
| `PARTICIPACAO-EM-OFICINA`                    | Participação em oficina                      |              | sim         | conector     | `evento`            | lido    | observado/observado |
| `PARTICIPACAO-EM-ENCONTRO`                   | Participação em encontro                     |              | sim         | conector     | `evento`            | lido    | observado/observado |
| `PARTICIPACAO-EM-EXPOSICAO`                  | Participação em exposição                    |              | sim         | conector     | `evento`            | lido    | observado/observado |
| `PARTICIPACAO-EM-OLIMPIADA`                  | Participação em olimpíada                    |              | sim         | conector     | `evento`            | lido    | observado/observado |
| `OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS` | Outras participações em eventos e congressos |              | sim         | conector     | `evento`            | lido    | observado/observado |

### Orientações

| Elemento                                                    | Item                                                         | Faz parte de | Editor cria | Caminho hoje | Formulário no censo    | Captura | Endereço/ligação   |
| ----------------------------------------------------------- | ------------------------------------------------------------ | ------------ | ----------- | ------------ | ---------------------- | ------- | ------------------ |
| `ORIENTACOES-CONCLUIDAS-PARA-MESTRADO`                      | Orientações concluídas para mestrado                         |              | sim         | importar     | `orientacao-concluida` | lido    | observado/inferido |
| `ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO`                     | Orientações concluídas para doutorado                        |              | sim         | importar     | `orientacao-concluida` | lido    | observado/inferido |
| `ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO`                 | Orientações concluídas para pós-doutorado                    |              | sim         | importar     | `orientacao-concluida` | lido    | observado/inferido |
| `OUTRAS-ORIENTACOES-CONCLUIDAS`                             | Outras orientações concluídas                                |              | sim         | importar     | `orientacao-concluida` | lido    | observado/inferido |
| `ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO`                       | Orientação em andamento de mestrado                          |              | sim         | importar     | `orientacao-andamento` | lido    | observado/inferido |
| `ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO`                      | Orientação em andamento de doutorado                         |              | sim         | importar     | `orientacao-andamento` | lido    | observado/inferido |
| `ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO`                  | Orientação em andamento de pós-doutorado                     |              | sim         | importar     | `orientacao-andamento` | lido    | observado/inferido |
| `ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO` | Orientação em andamento de aperfeiçoamento ou especialização |              | sim         | importar     | `orientacao-andamento` | lido    | observado/inferido |
| `ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO`                      | Orientação em andamento de graduação                         |              | sim         | importar     | `orientacao-andamento` | lido    | observado/inferido |
| `ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA`           | Orientação em andamento de iniciação científica              |              | sim         | importar     | `orientacao-andamento` | lido    | observado/inferido |
| `OUTRAS-ORIENTACOES-EM-ANDAMENTO`                           | Outras orientações em andamento                              |              | sim         | importar     | `orientacao-andamento` | lido    | observado/inferido |

### Bancas

| Elemento                                                  | Item                                                       | Faz parte de | Editor cria | Caminho hoje | Formulário no censo | Captura | Endereço/ligação   |
| --------------------------------------------------------- | ---------------------------------------------------------- | ------------ | ----------- | ------------ | ------------------- | ------- | ------------------ |
| `PARTICIPACAO-EM-BANCA-DE-MESTRADO`                       | Participação em banca de mestrado                          |              | sim         | importar     | `banca-trabalho`    | lido    | observado/inferido |
| `PARTICIPACAO-EM-BANCA-DE-DOUTORADO`                      | Participação em banca de doutorado                         |              | sim         | importar     | `banca-trabalho`    | lido    | observado/inferido |
| `PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO`             | Participação em banca de exame de qualificação             |              | sim         | importar     | `banca-trabalho`    | lido    | observado/inferido |
| `PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO` | Participação em banca de aperfeiçoamento ou especialização |              | sim         | importar     | `banca-trabalho`    | lido    | observado/inferido |
| `PARTICIPACAO-EM-BANCA-DE-GRADUACAO`                      | Participação em banca de graduação                         |              | sim         | importar     | `banca-trabalho`    | lido    | observado/inferido |
| `OUTRAS-PARTICIPACOES-EM-BANCA`                           | Outras participações em banca                              |              | sim         | importar     | `banca-trabalho`    | lido    | observado/inferido |
| `BANCA-JULGADORA-PARA-PROFESSOR-TITULAR`                  | Banca julgadora para professor titular                     |              | sim         | importar     | `banca-julgadora`   | lido    | observado/inferido |
| `BANCA-JULGADORA-PARA-CONCURSO-PUBLICO`                   | Banca julgadora para concurso público                      |              | sim         | importar     | `banca-julgadora`   | lido    | observado/inferido |
| `BANCA-JULGADORA-PARA-LIVRE-DOCENCIA`                     | Banca julgadora para livre docência                        |              | sim         | importar     | `banca-julgadora`   | lido    | observado/inferido |
| `BANCA-JULGADORA-PARA-AVALIACAO-CURSOS`                   | Banca julgadora para avaliação de cursos                   |              | sim         | importar     | `banca-julgadora`   | lido    | observado/inferido |
| `OUTRAS-BANCAS-JULGADORAS`                                | Outras bancas julgadoras                                   |              | sim         | importar     | `banca-julgadora`   | lido    | observado/inferido |

### Produções

| Elemento                                               | Item                                                 | Faz parte de | Editor cria | Caminho hoje | Formulário no censo            | Captura               | Endereço/ligação                       |
| ------------------------------------------------------ | ---------------------------------------------------- | ------------ | ----------- | ------------ | ------------------------------ | --------------------- | -------------------------------------- |
| `TRABALHO-EM-EVENTOS`                                  | Trabalho em eventos                                  |              | sim         | importar     | `trabalho-em-eventos`          | lido                  | observado/inferido                     |
| `ARTIGO-PUBLICADO`                                     | Artigo publicado                                     |              | sim         | importar     | `artigo-publicado`             | lido                  | observado/inferido                     |
| `ARTIGO-ACEITO-PARA-PUBLICACAO`                        | Artigo aceito para publicação                        |              | sim         | importar     | `artigo-aceito`                | lido                  | observado/inferido                     |
| `LIVRO-PUBLICADO-OU-ORGANIZADO`                        | Livro publicado ou organizado                        |              | sim         | importar     | `livro-capitulo`               | lido                  | inferido/inferido                      |
| `CAPITULO-DE-LIVRO-PUBLICADO`                          | Capítulo de livro publicado                          |              | sim         | importar     | `livro-capitulo`               | lido                  | inferido/inferido                      |
| `TEXTO-EM-JORNAL-OU-REVISTA`                           | Texto em jornal ou revista                           |              | sim         | importar     | `texto-jornal`                 | lido                  | observado/inferido                     |
| `OUTRA-PRODUCAO-BIBLIOGRAFICA`                         | Outra produção bibliográfica                         |              | sim         | importar     | `prefacio-outras`              | endereço desconhecido | inferido/inferido                      |
| `PARTITURA-MUSICAL`                                    | Partitura musical                                    |              | sim         | importar     | `partitura`                    | lido                  | observado/inferido                     |
| `PREFACIO-POSFACIO`                                    | Prefácio, posfácio                                   |              | sim         | importar     | `prefacio-outras`              | endereço desconhecido | inferido/inferido                      |
| `TRADUCAO`                                             | Tradução                                             |              | sim         | importar     | `traducao`                     | lido                  | observado/inferido                     |
| `SOFTWARE`                                             | Software                                             |              | sim         | importar     | `registro-PC`, `registro-PC-S` | lido, lido            | observado/inferido, observado/inferido |
| `PRODUTO-TECNOLOGICO`                                  | Produto tecnológico                                  |              | sim         | importar     | `produto`                      | lido                  | observado/inferido                     |
| `PROCESSOS-OU-TECNICAS`                                | Processo ou técnica                                  |              | sim         | importar     | `processo`                     | lido                  | observado/inferido                     |
| `TRABALHO-TECNICO`                                     | Trabalho técnico                                     |              | sim         | importar     | `trabalho-tecnico`             | lido                  | observado/observado                    |
| `APRESENTACAO-DE-TRABALHO`                             | Apresentação de trabalho                             |              | sim         | importar     | `tec-2J`                       | lido                  | observado/inferido                     |
| `CARTA-MAPA-OU-SIMILAR`                                | Carta, mapa ou similar                               |              | sim         | importar     | `tec-2A`                       | lido                  | observado/inferido                     |
| `CURSO-DE-CURTA-DURACAO-MINISTRADO`                    | Curso de curta duração ministrado                    |              | sim         | importar     | `tec-2B`                       | lido                  | observado/inferido                     |
| `DESENVOLVIMENTO-DE-MATERIAL-DIDATICO-OU-INSTRUCIONAL` | Desenvolvimento de material didático ou instrucional |              | sim         | importar     | `tec-2C`                       | lido                  | observado/inferido                     |
| `EDITORACAO`                                           | Editoração                                           |              | sim         | importar     | `tec-2D`                       | lido                  | observado/observado                    |
| `MANUTENCAO-DE-OBRA-ARTISTICA`                         | Manutenção de obra artística                         |              | sim         | importar     | `tec-2E`                       | lido                  | observado/inferido                     |
| `MAQUETE`                                              | Maquete                                              |              | sim         | importar     | `tec-2F`                       | lido                  | observado/inferido                     |
| `ORGANIZACAO-DE-EVENTO`                                | Organização de evento                                |              | sim         | importar     | `tec-2G`                       | lido                  | observado/inferido                     |
| `OUTRA-PRODUCAO-TECNICA`                               | Outra produção técnica                               |              | sim         | importar     | `tec-2Z`                       | lido                  | observado/inferido                     |
| `PROGRAMA-DE-RADIO-OU-TV`                              | Programa de rádio ou TV                              |              | sim         | importar     | `tec-2H`                       | lido                  | observado/inferido                     |
| `RELATORIO-DE-PESQUISA`                                | Relatório de pesquisa                                |              | sim         | importar     | `tec-2I`                       | lido                  | observado/inferido                     |
| `MIDIA-SOCIAL-WEBSITE-BLOG`                            | Mídia social, website, blog                          |              | sim         | importar     | `tec-2L`                       | lido                  | observado/inferido                     |
| `APRESENTACAO-DE-OBRA-ARTISTICA`                       | Apresentação de obra artística                       |              | sim         | importar     | nenhum                         |                       |                                        |
| `APRESENTACAO-EM-RADIO-OU-TV`                          | Apresentação em rádio ou TV                          |              | sim         | importar     | nenhum                         |                       |                                        |
| `ARRANJO-MUSICAL`                                      | Arranjo musical                                      |              | sim         | importar     | nenhum                         |                       |                                        |
| `COMPOSICAO-MUSICAL`                                   | Composição musical                                   |              | sim         | importar     | nenhum                         |                       |                                        |
| `CURSO-DE-CURTA-DURACAO`                               | Curso de curta duração                               |              | sim         | importar     | nenhum                         |                       |                                        |
| `OBRA-DE-ARTES-VISUAIS`                                | Obra de artes visuais                                |              | sim         | importar     | nenhum                         |                       |                                        |
| `OUTRA-PRODUCAO-ARTISTICA-CULTURAL`                    | Outra produção artística cultural                    |              | sim         | importar     | `arte-OU`                      | lido                  | observado/inferido                     |
| `SONOPLASTIA`                                          | Sonoplastia                                          |              | sim         | importar     | nenhum                         |                       |                                        |
| `ARTES-CENICAS`                                        | Artes cênicas                                        |              | sim         | importar     | `arte-AC`                      | lido                  | observado/inferido                     |
| `ARTES-VISUAIS`                                        | Artes visuais                                        |              | sim         | importar     | `arte-AV`                      | lido                  | observado/inferido                     |
| `MUSICA`                                               | Música                                               |              | sim         | importar     | `arte-MU`                      | lido                  | observado/inferido                     |
| `DEMAIS-TRABALHOS`                                     | Demais trabalhos                                     |              | sim         | importar     | `demais-trabalhos`             | lido                  | inferido/inferido                      |

## O que o censo diz de cada grupo

**Patentes e registros.** Os seis tipos usam o mesmo formulário,
`PKG_PATENTE_REGISTRO.form` com `f_cod_tipo` (`PP`, `CP`, `CR`, `DI`, `MR`,
`TC`), POST para `PKG_PATENTE_REGISTRO.FORM`, e as capturas leram todos. O
currículo de quem capturou não tem nenhum desses itens, então a ligação de
cada campo com o atributo do XML é inferida em todos, menos na patente (seção
17 de `lattes_internals.md`).

A operação do conector (`src/bridge/create-registro.ts`) liga cada campo ao
atributo pelo rótulo que o censo leu: "Título" é o `TITULO` (a `DENOMINACAO`,
na cultivar), "Ano de desenvolvimento" é o `ANO-DESENVOLVIMENTO` (o
`ANO-SOLICITACAO`, na cultivar), "Instituição de registro" e "Autoridade
Nacional" são a `INSTITUICAO-DEPOSITO-REGISTRO`, e o tipo da marca (`MPD`,
`MSV`, `MCL`, `MCT`) é o `TIPO-PATENTE` que termina com o mesmo código. Tudo
isso é inferido. A recaptura de 15/10/2026 (seção 21) mostrou o formato das
datas (`dd/mm/aaaa`), a grade de datas da patente e o que o `check()` de cada
tipo exige, e a operação passou a mandar as datas: na cultivar e no desenho
industrial em `f_dta_dep` e `f_dta_conc`, na patente em `f_dados_grid_datas`.
A marca e a topografia não têm campo de data na tela; com data, vão à mão.

A recaptura de 15/10/2026 leu também a forma da linha de autor (seção 22):
o vetor `autorDP` do menu traz as chaves `l`, `c`, `t` e `deletable`, nessa
ordem, e uma linha só com o código `c` vazio, que é a única que o `check()`
aceita como a própria pessoa. A operação monta a grade de inventores com essa
linha (`src/bridge/author-grid.ts`), mas só quando ela traz o nome completo
ou uma das citações do currículo; senão, para sem enviar. A linha não tem o
número do Lattes, e a sessão já é conferida pelo número antes da fila. Com
isso, cinco registros voltaram a ir pelo conector: a cultivar protegida e a
registrada, o desenho industrial, a marca e a topografia de circuito. Como a
lista de inventores não é relida depois do envio, a inclusão volta como
divergente, com o pedido de conferir os inventores no Lattes, e não como
conferida. A patente continua à mão: exige também o titular ou depositante,
que vem do vetor `titularPessoaDP`, cuja forma não foi lida.

O programa de computador registrado é um `SOFTWARE` com registro: a lista de
programas abre a janela prévia com `ftipo=PC` e depois o formulário com
`f_reg=S`, que o censo agora tem (`registro-PC-S`).

**Formação, atuação e projetos.** A formação acadêmica e a atuação têm
caminho pelo conector desde a LAT-52, e o aperfeiçoamento, que deu erro na
captura do censo, foi lido na recaptura. O projeto também tem a operação
(`projetoOp`), mas a recaptura mostrou que o `check()` do formulário de
projeto exige a própria pessoa e um coordenador na equipe (que a inclusão
abre vazia) e, na inclusão, o órgão ou unidade. A operação agora manda a
equipe com a linha da própria pessoa como coordenadora (seção 22), mas não
monta o órgão, e o planejamento manda o projeto à mão com esse motivo. Pós-doutorado e livre-docência entram pela lista
`f_tipo=AP` (etapa 5). A formação complementar abre com nível, instituição,
curso, carga horária e situação, sem os anos, e envia para `FORM2`, cujo passo
seguinte só se vê enviando. Atividades de uma atuação usam `pkg_ativ.cargo`, que o lote 3 da recaptura
leu nas nove naturezas (censo `censo-2026-10-15c.json`). A de ensino é a única
sem órgão: tem nível (`f_nivel`, de 401 a 409), curso, período e a grade de
disciplinas em `f_espec_l`, e vai pelo conector
(`src/bridge/create-atividade.ts`), com as disciplinas junto. Volta como
divergente, porque as disciplinas não são relidas. Nos níveis de graduação,
pós-graduação, especialização e aperfeiçoamento (401 a 404) o Lattes exige o
curso da lista de cursos da instituição da atuação
(`prc_curso_form?…&f_pgm=ATIV`, endereço lido no lote 3, resposta não lida), e
o formulário do editor ainda não oferece essa lista na atividade de ensino:
sem o código do curso no item, esses níveis vão à mão, com o motivo. Ligar a
lista pede um parâmetro novo no pedido de cursos à extensão, que entra com a
capacidade da inclusão. As outras oito
pedem o órgão ou unidade por uma busca (`prc_orgao_cargo`) cuja resposta não
foi lida, e vão à mão. Treinamento e linha de pesquisa entram pela grade da
atividade de treinamento e da de pesquisa e desenvolvimento, e a lista de
linhas de pesquisa não tem inclusão própria.

**Dados gerais.** Idioma, prêmio e licença têm formulário lido, simples, com
`f_ctr=I`. Áreas de atuação são uma grade única em `prc_area_atuacao`.

A etapa 5 (`src/bridge/create-general.ts`) inclui pelo conector o idioma
(`GN_IDIOMA`), o prêmio (`GN_PREMIO`) e um vínculo numa atuação que já está
no Lattes (`GN_ATIV_VINC`, pelo "Incluir vínculo" da tela de cargos e
vínculos), e `create-formacao.ts` passa a incluir o pós-doutorado e a
livre-docência pela lista `f_tipo=AP` (níveis 5 e 6). A ligação de cada campo
com o XML é observada no idioma, no prêmio e no vínculo (a passada de edição
do censo casou 3 idiomas, 5 prêmios e 8 vínculos) e inferida no pós-doutorado
e na livre-docência. O vínculo novo não tem "Outras informações" em português,
só em inglês: com o texto em português, vai à mão.

Ficam à mão, com o motivo de cada um: a licença (o `check()` exige a data de
nascimento ou adoção, que o XML da licença não guarda), as áreas de atuação
(a grade `f_area_l` tem a chave `r`, de sentido não lido), a formação
complementar, as atividades que pedem órgão, a disciplina numa atividade que
já existe, o treinamento, a linha de pesquisa e o financiador, a produção e a
orientação do projeto (as buscas de onde vêm os valores dessas grades são POST
e a resposta não foi lida). O que falta ler para cada um está
em `lattes-formularios/recaptura.md`.

**Produções, eventos, orientações e bancas.** A captura leu o formulário de
inclusão de quase todos. Ficaram de fora o artigo publicado (a página veio sem
formulário), prefácio e outra produção bibliográfica (endereço desconhecido) e
os tipos artísticos antigos do XSD (apresentação de obra artística, arranjo,
composição, sonoplastia e outros), que o Lattes de hoje não oferece mais na
inclusão: a produção artística entra por `pkg_arte_nova.form` em artes cênicas,
música, artes visuais e outra. Na recaptura, a lista de artigos mostrou três
entradas (pelo DOI, pelo periódico e à mão), e a entrada à mão abriu o
formulário, que o censo agora tem. Prefácio e outra produção bibliográfica
continuam sem inclusão em nenhuma lista do menu. A escolha entre o Importar e
a inclusão direta está na seção abaixo.

**Formulários sem elemento conhecido.** Corpo editorial, revisão e
assessoramento (`PKG_REVISOR.inclui`, quatro naturezas) foram lidos, mas o
elemento do XML que gravam não se sabe; não entram na tabela.

## Importar ou inclusão direta (etapa 6)

O que o teste acompanhado do Importar mostrou em 14/10/2026 (seção 13 de
`lattes_internals.md`):

- o arquivo mínimo que o guia previa é recusado pelo DTD; para passar, ele
  precisou de todos os atributos de `DADOS-GERAIS`, inclusive dados pessoais, e
  um arquivo só com evento ainda foi recusado como "sem produções científicas".
  O caminho que funciona é o currículo inteiro mais o item novo;
- a mensagem de sucesso do passo 3 não quer dizer que o item entrou. Um evento
  sem a própria pessoa entre os participantes recebeu o "sucesso" e sumiu, duas
  vezes, e cada importação confirmada gastou um `SEQUENCIA-PRODUCAO`, mesmo a
  que sumiu;
- o passo 3 compara pelo título: os eventos de ouvinte sem título aparecem
  como "Produção sem título", todos verdes, embora já estejam no currículo;
- o Importar pelo conector está desligado, e hoje quem importa faz os três
  passos à mão, com o arquivo que o editor gera.

A inclusão pelo formulário de cada tipo grava um item por vez, a conferência
é a releitura da lista, e o número vem do Lattes. O que pesa contra ela é o
que o formulário monta no navegador antes de enviar.

**Eventos: inclusão direta.** O formulário de eventos não tem participantes
(é a própria pessoa quem inclui), não tem grade nenhuma e teve a ligação de
nome, ano, cidade, país, forma e divulgação científica com o XML observada na
passada de edição do censo. A alteração pelo mesmo formulário foi enviada e
conferida em 14/10/2026. Com `CREATE_ITEMS_ENABLED` ligada e uma extensão que
anuncia `incluir-itens`, o evento novo sai do arquivo do Importar
(`src/model/direct-inclusion.ts`) e vai pela lista de alterações, incluído por
`src/bridge/create-evento.ts`. O que o formulário não tem (idioma, meio de
divulgação, DOI, local, instituição promotora, nome em inglês, relevância
"sim", participantes além da pessoa, palavras-chave) faz o evento voltar ao
Importar, quando a própria pessoa está entre os participantes; sem ela, o
Importar descartaria o evento, e ele vai à mão, com o motivo. O evento de quem
apresenta volta como divergente: o tipo da participação não aparece na
releitura, porque a página o monta por script. Com a chave desligada, ou com
uma extensão mais antiga, nada muda: o evento segue no arquivo do Importar.

**Produções bibliográficas, técnicas e artísticas, demais trabalhos e bancas:
Importar, por enquanto.** Os formulários de inclusão desses tipos foram lidos,
e mandam os autores (e, nas bancas, os participantes) na grade `f_autores_l`.
A recaptura de 15/10/2026 (seções 21 e 22) respondeu o que faltava da grade:
o `check()` exige a própria pessoa nela, a inclusão abre com ela vazia (o
vetor `autorProvider` é `[{}]`), a grade vai com as chaves `c`, `l`, `t`,
`pais` e `add` de cada linha, na ordem do objeto, e a linha da própria pessoa
é a do `autorDP` com `c` vazio, com as chaves `l`, `c`, `t` e `deletable`. A
grade já se monta (`src/bridge/author-grid.ts`, a mesma dos registros). Falta
o resto: o sentido de `pais`, a ligação de cada campo com o XML (inferida em
quase todos, porque o currículo de quem capturou tem poucas produções) e as
grades de palavras-chave, áreas e setores. Como o Importar funciona para
esses tipos, a inclusão direta deles não foi construída.

**Orientações: Importar, por enquanto, com o caminho direto mapeado.** O
formulário não tem grade de autores, e a recaptura leu as buscas: a de
instituição sem nível, a de curso com o nível tirado da natureza (`retnivel()`)
e `f_sta_area`, a de agência, e o `f_sub_prod` que acompanha o mestrado
profissional. O `check()` exige natureza, título, ano, país, idioma, tipo de
orientação, nome do orientando, instituição e, na maioria das naturezas, o
curso. A ligação de cada campo com o XML continua inferida (o currículo de
quem capturou não tem orientações), e não há evidência de que o Importar
perca orientações: a inclusão direta fica para depois do primeiro teste
acompanhado de uma inclusão pelo conector.

## Etapas

1. Este inventário.
2. A seção Patentes e Registros cria todos os registros, sem o aviso de "só a
   patente".
3. A operação de inclusão dos registros no conector (`create-registro.ts`), no
   molde das da LAT-52 (plano a partir do formulário do censo, envio,
   releitura e conferência com rótulos legíveis), atrás de
   `CREATE_ITEMS_ENABLED` e coberta no Lattes simulado.
4. O editor cria os tipos que ainda não criava: dados gerais, formação
   complementar e as partes de uma atuação ou de um projeto.
5. Operações de inclusão no conector para esses tipos, onde o censo tem o
   formulário.
6. Para os tipos do Importar, decidir com evidência entre o Importar e a
   inclusão direta, e incluir direto onde o censo tem o formulário.

O que ainda precisa ser lido no Lattes para fechar as lacunas está em
`lattes-formularios/recaptura.md`.
