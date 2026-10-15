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
  (todas atrás de `CREATE_ITEMS_ENABLED`, desligada até o teste acompanhado);
  `importar` quando o item vai no arquivo do Importar, que a pessoa envia pelos
  passos na tela, porque o Importar pelo conector também está desligado
  (`lattes_internals.md`, seção 13); `nenhum` quando o item novo só chega ao
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
| conector     |    17 |          17 |
| importar     |    69 |          69 |
| nenhum       |    28 |           3 |

Os 3 que o editor cria e que não têm caminho são a patente, o pós-doutorado e
a livre-docência: o item novo vai para "A enviar" com a rota "à mão". Os 25
restantes sem caminho o editor nem cria: formação complementar, idioma, prêmio,
licença, áreas de atuação e as partes de uma atuação (vínculo novo, atividades,
disciplinas, treinamentos, linhas de pesquisa, financiadores, produções e
orientações do projeto, e a participação em projeto, que o editor cria junto
com o projeto).

## Tabelas

### Formação

| Elemento                                          | Item                                            | Faz parte de | Editor cria | Caminho hoje | Formulário no censo     | Captura | Endereço/ligação    |
| ------------------------------------------------- | ----------------------------------------------- | ------------ | ----------- | ------------ | ----------------------- | ------- | ------------------- |
| `CURSO-TECNICO-PROFISSIONALIZANTE`                | Curso técnico profissionalizante                |              | sim         | conector     | `formacao-FA-7`         | lido    | observado/observado |
| `ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU`                | Ensino fundamental primeiro grau                |              | sim         | conector     | `formacao-FA-B`         | lido    | observado/inferido  |
| `ENSINO-MEDIO-SEGUNDO-GRAU`                       | Ensino médio segundo grau                       |              | sim         | conector     | `formacao-FA-C`         | lido    | observado/inferido  |
| `GRADUACAO`                                       | Graduação                                       |              | sim         | conector     | `formacao-FA-1`         | lido    | observado/observado |
| `APERFEICOAMENTO`                                 | Aperfeiçoamento                                 |              | sim         | conector     | `formacao-FA-X`         | erro    | observado/inferido  |
| `ESPECIALIZACAO`                                  | Especialização                                  |              | sim         | conector     | `formacao-FA-2`         | lido    | observado/inferido  |
| `MESTRADO`                                        | Mestrado                                        |              | sim         | conector     | `formacao-FA-3`         | lido    | observado/observado |
| `MESTRADO-PROFISSIONALIZANTE`                     | Mestrado profissionalizante                     |              | sim         | conector     | `formacao-FA-9`         | lido    | observado/inferido  |
| `DOUTORADO`                                       | Doutorado                                       |              | sim         | conector     | `formacao-FA-4`         | lido    | observado/inferido  |
| `RESIDENCIA-MEDICA`                               | Residência médica                               |              | sim         | conector     | `formacao-FA-D`         | lido    | observado/inferido  |
| `LIVRE-DOCENCIA`                                  | Livre-docência                                  |              | sim         | nenhum       | `formacao-AP-6`         | lido    | observado/inferido  |
| `POS-DOUTORADO`                                   | Pós-doutorado                                   |              | sim         | nenhum       | `formacao-AP-5`         | lido    | observado/inferido  |
| `FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA` | Formação complementar de extensão universitária |              | não         | nenhum       | `formacao-complementar` | lido    | observado/observado |
| `MBA`                                             | MBA                                             |              | não         | nenhum       | `formacao-complementar` | lido    | observado/observado |
| `FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO`    | Formação complementar curso de curta duração    |              | não         | nenhum       | `formacao-complementar` | lido    | observado/observado |
| `OUTROS`                                          | Outros                                          |              | não         | nenhum       | `formacao-complementar` | lido    | observado/observado |

### Dados gerais

| Elemento          | Item             | Faz parte de | Editor cria | Caminho hoje | Formulário no censo | Captura | Endereço/ligação    |
| ----------------- | ---------------- | ------------ | ----------- | ------------ | ------------------- | ------- | ------------------- |
| `AREA-DE-ATUACAO` | Área de atuação  |              | não         | nenhum       | `areas-de-atuacao`  | lido    | observado/observado |
| `IDIOMA`          | Idioma           |              | não         | nenhum       | `idioma`            | lido    | observado/observado |
| `LICENCA`         | Licença          |              | não         | nenhum       | `licenca`           | lido    | observado/inferido  |
| `PREMIO-TITULO`   | Prêmio ou título |              | não         | nenhum       | `premio`            | lido    | observado/observado |

### Atuação e projetos

| Elemento                             | Item                               | Faz parte de                 | Editor cria | Caminho hoje | Formulário no censo                                             | Captura                      | Endereço/ligação                                                                                        |
| ------------------------------------ | ---------------------------------- | ---------------------------- | ----------- | ------------ | --------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `DISCIPLINA`                         | Disciplina                         | `ENSINO`                     | não         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `LINHA-DE-PESQUISA`                  | Linha de pesquisa                  | `PESQUISA-E-DESENVOLVIMENTO` | não         | nenhum       | `linha-de-pesquisa`                                             | sem link                     | inferido/inferido                                                                                       |
| `PROJETO-DE-PESQUISA`                | Projeto                            | `PARTICIPACAO-EM-PROJETO`    | sim         | conector     | `projeto-P`, `projeto-D`, `projeto-E`, `projeto-N`, `projeto-O` | lido, lido, lido, lido, lido | observado/observado, observado/observado, observado/observado, observado/observado, observado/observado |
| `FINANCIADOR-DO-PROJETO`             | Financiador do projeto             | `PROJETO-DE-PESQUISA`        | não         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `PRODUCAO-CT-DO-PROJETO`             | Produção C&T do projeto            | `PROJETO-DE-PESQUISA`        | não         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `ORIENTACAO`                         | Orientação                         | `PROJETO-DE-PESQUISA`        | não         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `TREINAMENTO`                        | Treinamento                        | `TREINAMENTO-MINISTRADO`     | não         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `ATUACAO-PROFISSIONAL`               | Atuação profissional               |                              | sim         | conector     | `atuacao`                                                       | lido                         | observado/observado                                                                                     |
| `VINCULOS`                           | Vínculo                            | `ATUACAO-PROFISSIONAL`       | não         | nenhum       | `vinculo`                                                       | lido                         | observado/observado                                                                                     |
| `DIRECAO-E-ADMINISTRACAO`            | Direção e administração            | `ATUACAO-PROFISSIONAL`       | não         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `PESQUISA-E-DESENVOLVIMENTO`         | Pesquisa e desenvolvimento         | `ATUACAO-PROFISSIONAL`       | não         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `ENSINO`                             | Ensino                             | `ATUACAO-PROFISSIONAL`       | não         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `ESTAGIO`                            | Estágio                            | `ATUACAO-PROFISSIONAL`       | não         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `SERVICO-TECNICO-ESPECIALIZADO`      | Serviço técnico especializado      | `ATUACAO-PROFISSIONAL`       | não         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `EXTENSAO-UNIVERSITARIA`             | Extensão universitária             | `ATUACAO-PROFISSIONAL`       | não         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `TREINAMENTO-MINISTRADO`             | Treinamento ministrado             | `ATUACAO-PROFISSIONAL`       | não         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `OUTRA-ATIVIDADE-TECNICO-CIENTIFICA` | Outra atividade técnico-científica | `ATUACAO-PROFISSIONAL`       | não         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `CONSELHO-COMISSAO-E-CONSULTORIA`    | Conselho, comissão e consultoria   | `ATUACAO-PROFISSIONAL`       | não         | nenhum       | nenhum                                                          |                              |                                                                                                         |
| `PARTICIPACAO-EM-PROJETO`            | Participação em projeto            | `ATUACAO-PROFISSIONAL`       | não         | nenhum       | nenhum                                                          |                              |                                                                                                         |

### Patentes e registros

| Elemento                           | Item                             | Faz parte de | Editor cria | Caminho hoje | Formulário no censo | Captura | Endereço/ligação    |
| ---------------------------------- | -------------------------------- | ------------ | ----------- | ------------ | ------------------- | ------- | ------------------- |
| `PATENTE`                          | Patente                          |              | sim         | nenhum       | `patente`           | lido    | observado/observado |
| `CULTIVAR-PROTEGIDA`               | Cultivar protegida               |              | sim         | conector     | `registro-CP`       | lido    | observado/inferido  |
| `CULTIVAR-REGISTRADA`              | Cultivar registrada              |              | sim         | conector     | `registro-CR`       | lido    | observado/inferido  |
| `DESENHO-INDUSTRIAL`               | Desenho industrial               |              | sim         | conector     | `registro-DI`       | lido    | inferido/inferido   |
| `MARCA`                            | Marca                            |              | sim         | conector     | `registro-MR`       | lido    | inferido/inferido   |
| `TOPOGRAFIA-DE-CIRCUITO-INTEGRADO` | Topografia de circuito integrado |              | sim         | conector     | `registro-TC`       | lido    | inferido/inferido   |

### Eventos

| Elemento                                     | Item                                         | Faz parte de | Editor cria | Caminho hoje | Formulário no censo | Captura | Endereço/ligação    |
| -------------------------------------------- | -------------------------------------------- | ------------ | ----------- | ------------ | ------------------- | ------- | ------------------- |
| `PARTICIPACAO-EM-CONGRESSO`                  | Participação em congresso                    |              | sim         | importar     | `evento`            | lido    | observado/observado |
| `PARTICIPACAO-EM-FEIRA`                      | Participação em feira                        |              | sim         | importar     | `evento`            | lido    | observado/observado |
| `PARTICIPACAO-EM-SEMINARIO`                  | Participação em seminário                    |              | sim         | importar     | `evento`            | lido    | observado/observado |
| `PARTICIPACAO-EM-SIMPOSIO`                   | Participação em simpósio                     |              | sim         | importar     | `evento`            | lido    | observado/observado |
| `PARTICIPACAO-EM-OFICINA`                    | Participação em oficina                      |              | sim         | importar     | `evento`            | lido    | observado/observado |
| `PARTICIPACAO-EM-ENCONTRO`                   | Participação em encontro                     |              | sim         | importar     | `evento`            | lido    | observado/observado |
| `PARTICIPACAO-EM-EXPOSICAO`                  | Participação em exposição                    |              | sim         | importar     | `evento`            | lido    | observado/observado |
| `PARTICIPACAO-EM-OLIMPIADA`                  | Participação em olimpíada                    |              | sim         | importar     | `evento`            | lido    | observado/observado |
| `OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS` | Outras participações em eventos e congressos |              | sim         | importar     | `evento`            | lido    | observado/observado |

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

| Elemento                                               | Item                                                 | Faz parte de | Editor cria | Caminho hoje | Formulário no censo   | Captura               | Endereço/ligação    |
| ------------------------------------------------------ | ---------------------------------------------------- | ------------ | ----------- | ------------ | --------------------- | --------------------- | ------------------- |
| `TRABALHO-EM-EVENTOS`                                  | Trabalho em eventos                                  |              | sim         | importar     | `trabalho-em-eventos` | lido                  | observado/inferido  |
| `ARTIGO-PUBLICADO`                                     | Artigo publicado                                     |              | sim         | importar     | `artigo-publicado`    | sem formulário        | inferido/inferido   |
| `ARTIGO-ACEITO-PARA-PUBLICACAO`                        | Artigo aceito para publicação                        |              | sim         | importar     | `artigo-aceito`       | lido                  | observado/inferido  |
| `LIVRO-PUBLICADO-OU-ORGANIZADO`                        | Livro publicado ou organizado                        |              | sim         | importar     | `livro-capitulo`      | lido                  | inferido/inferido   |
| `CAPITULO-DE-LIVRO-PUBLICADO`                          | Capítulo de livro publicado                          |              | sim         | importar     | `livro-capitulo`      | lido                  | inferido/inferido   |
| `TEXTO-EM-JORNAL-OU-REVISTA`                           | Texto em jornal ou revista                           |              | sim         | importar     | `texto-jornal`        | lido                  | observado/inferido  |
| `OUTRA-PRODUCAO-BIBLIOGRAFICA`                         | Outra produção bibliográfica                         |              | sim         | importar     | `prefacio-outras`     | endereço desconhecido | inferido/inferido   |
| `PARTITURA-MUSICAL`                                    | Partitura musical                                    |              | sim         | importar     | `partitura`           | lido                  | observado/inferido  |
| `PREFACIO-POSFACIO`                                    | Prefácio, posfácio                                   |              | sim         | importar     | `prefacio-outras`     | endereço desconhecido | inferido/inferido   |
| `TRADUCAO`                                             | Tradução                                             |              | sim         | importar     | `traducao`            | lido                  | observado/inferido  |
| `SOFTWARE`                                             | Software                                             |              | sim         | importar     | `registro-PC`         | lido                  | observado/inferido  |
| `PRODUTO-TECNOLOGICO`                                  | Produto tecnológico                                  |              | sim         | importar     | `produto`             | lido                  | observado/inferido  |
| `PROCESSOS-OU-TECNICAS`                                | Processo ou técnica                                  |              | sim         | importar     | `processo`            | lido                  | observado/inferido  |
| `TRABALHO-TECNICO`                                     | Trabalho técnico                                     |              | sim         | importar     | `trabalho-tecnico`    | lido                  | observado/observado |
| `APRESENTACAO-DE-TRABALHO`                             | Apresentação de trabalho                             |              | sim         | importar     | `tec-2J`              | lido                  | observado/inferido  |
| `CARTA-MAPA-OU-SIMILAR`                                | Carta, mapa ou similar                               |              | sim         | importar     | `tec-2A`              | lido                  | observado/inferido  |
| `CURSO-DE-CURTA-DURACAO-MINISTRADO`                    | Curso de curta duração ministrado                    |              | sim         | importar     | `tec-2B`              | lido                  | observado/inferido  |
| `DESENVOLVIMENTO-DE-MATERIAL-DIDATICO-OU-INSTRUCIONAL` | Desenvolvimento de material didático ou instrucional |              | sim         | importar     | `tec-2C`              | lido                  | observado/inferido  |
| `EDITORACAO`                                           | Editoração                                           |              | sim         | importar     | `tec-2D`              | lido                  | observado/observado |
| `MANUTENCAO-DE-OBRA-ARTISTICA`                         | Manutenção de obra artística                         |              | sim         | importar     | `tec-2E`              | lido                  | observado/inferido  |
| `MAQUETE`                                              | Maquete                                              |              | sim         | importar     | `tec-2F`              | lido                  | observado/inferido  |
| `ORGANIZACAO-DE-EVENTO`                                | Organização de evento                                |              | sim         | importar     | `tec-2G`              | lido                  | observado/inferido  |
| `OUTRA-PRODUCAO-TECNICA`                               | Outra produção técnica                               |              | sim         | importar     | `tec-2Z`              | lido                  | observado/inferido  |
| `PROGRAMA-DE-RADIO-OU-TV`                              | Programa de rádio ou TV                              |              | sim         | importar     | `tec-2H`              | lido                  | observado/inferido  |
| `RELATORIO-DE-PESQUISA`                                | Relatório de pesquisa                                |              | sim         | importar     | `tec-2I`              | lido                  | observado/inferido  |
| `MIDIA-SOCIAL-WEBSITE-BLOG`                            | Mídia social, website, blog                          |              | sim         | importar     | `tec-2L`              | lido                  | observado/inferido  |
| `APRESENTACAO-DE-OBRA-ARTISTICA`                       | Apresentação de obra artística                       |              | sim         | importar     | nenhum                |                       |                     |
| `APRESENTACAO-EM-RADIO-OU-TV`                          | Apresentação em rádio ou TV                          |              | sim         | importar     | nenhum                |                       |                     |
| `ARRANJO-MUSICAL`                                      | Arranjo musical                                      |              | sim         | importar     | nenhum                |                       |                     |
| `COMPOSICAO-MUSICAL`                                   | Composição musical                                   |              | sim         | importar     | nenhum                |                       |                     |
| `CURSO-DE-CURTA-DURACAO`                               | Curso de curta duração                               |              | sim         | importar     | nenhum                |                       |                     |
| `OBRA-DE-ARTES-VISUAIS`                                | Obra de artes visuais                                |              | sim         | importar     | nenhum                |                       |                     |
| `OUTRA-PRODUCAO-ARTISTICA-CULTURAL`                    | Outra produção artística cultural                    |              | sim         | importar     | `arte-OU`             | lido                  | observado/inferido  |
| `SONOPLASTIA`                                          | Sonoplastia                                          |              | sim         | importar     | nenhum                |                       |                     |
| `ARTES-CENICAS`                                        | Artes cênicas                                        |              | sim         | importar     | `arte-AC`             | lido                  | observado/inferido  |
| `ARTES-VISUAIS`                                        | Artes visuais                                        |              | sim         | importar     | `arte-AV`             | lido                  | observado/inferido  |
| `MUSICA`                                               | Música                                               |              | sim         | importar     | `arte-MU`             | lido                  | observado/inferido  |
| `DEMAIS-TRABALHOS`                                     | Demais trabalhos                                     |              | sim         | importar     | `demais-trabalhos`    | lido                  | inferido/inferido   |

## O que o censo diz de cada grupo

**Patentes e registros.** Os seis tipos usam o mesmo formulário,
`PKG_PATENTE_REGISTRO.form` com `f_cod_tipo` (`PP`, `CP`, `CR`, `DI`, `MR`,
`TC`), POST para `PKG_PATENTE_REGISTRO.FORM`, e a captura leu todos. Para
desenho industrial, marca e topografia o censo marca o endereço como inferido
porque o `f_reg` não tinha sido lido antes; a captura abriu os três com
`f_reg` vazio e recebeu o formulário de inclusão do tipo certo
(`f_cod_tipo` no oculto). O currículo de quem capturou não tem nenhum desses
itens, então a ligação de cada campo com o atributo do XML é inferida em todos,
menos na patente (seção 17 de `lattes_internals.md`).

A operação do conector (`src/bridge/create-registro.ts`, etapa 3) cobre os seis
tipos e liga cada campo ao atributo pelo rótulo que o censo leu: "Título" é o
`TITULO` (a `DENOMINACAO`, na cultivar), "Ano de desenvolvimento" é o
`ANO-DESENVOLVIMENTO` (o `ANO-SOLICITACAO`, na cultivar), "Instituição de
registro" e "Autoridade Nacional" são a `INSTITUICAO-DEPOSITO-REGISTRO`, e o
tipo da marca (`MPD`, `MSV`, `MCL`, `MCT`) é o `TIPO-PATENTE` que termina com o
mesmo código. Tudo isso é inferido. O conector não manda datas: na patente, na
marca e na topografia elas só entram pela grade serializada em
`f_dados_grid_datas`, cujo formato (`array2xml`) não foi observado; na cultivar
e no desenho industrial há o campo `f_dta_dep` (e `f_dta_conc`), mas o formato
da data nele também não foi observado. Um registro com data vai à mão, com esse
motivo. A patente vai sempre à mão: o `check()` do formulário exige a data de
depósito e o titular ou depositante, e os dois vão em grades. Por isso a
patente continua com caminho `nenhum` na tabela.

**Formação, atuação e projetos.** Os doze tipos com caminho pelo conector são
os da LAT-52. Pós-doutorado e livre-docência têm formulário lido
(`pkg_formacao.form` com `f_tipo=AP`); a formação complementar também
(`PKG_FORMACAO_COMPL.form`, com o nível numa lista). O aperfeiçoamento deu erro
na captura, embora o conector tenha a operação (a mesma do resto da formação
acadêmica). Atividades de uma atuação usam `pkg_ativ.cargo`, lido sem a
natureza; disciplina, treinamento e linha de pesquisa não têm formulário
próprio conhecido.

**Dados gerais.** Idioma, prêmio e licença têm formulário lido, simples, com
`f_ctr=I`. Áreas de atuação são uma grade única em `prc_area_atuacao`.

**Produções, eventos, orientações e bancas.** Todos vão pelo Importar hoje. A
captura leu o formulário de inclusão de quase todos. Ficaram de fora o artigo
publicado (a página veio sem formulário), prefácio e outra produção
bibliográfica (endereço desconhecido) e os tipos artísticos antigos do XSD
(apresentação de obra artística, arranjo, composição, sonoplastia e outros),
que o Lattes de hoje não oferece mais na inclusão: a produção artística entra
por `pkg_arte_nova.form` em artes cênicas, música, artes visuais e outra. Se
vale trocar o Importar pela inclusão direta é a etapa 4.

**Formulários sem elemento conhecido.** Corpo editorial, revisão e
assessoramento (`PKG_REVISOR.inclui`, quatro naturezas) foram lidos, mas o
elemento do XML que gravam não se sabe; não entram na tabela.

## Etapas

1. Este inventário.
2. A seção Patentes e Registros cria todos os registros, sem o aviso de "só a
   patente".
3. Operações de inclusão no conector para os tipos sem caminho, começando pelos
   registros, depois os itens gerais, depois produções, eventos, orientações e
   bancas. Cada uma no molde das da LAT-52 (plano a partir do formulário do
   censo, envio, releitura e conferência com rótulos legíveis), atrás de
   `CREATE_ITEMS_ENABLED` e coberta no Lattes simulado.
4. Para os tipos do Importar, decidir com evidência entre o Importar e a
   inclusão direta.
