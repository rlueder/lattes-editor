# Editor de Currículo Lattes: requisitos de produto e resumo da pesquisa

## O que é este documento

Este é um resumo de uma pesquisa extensa de UX, análise competitiva, análise jurídica e análise técnica do schema, conduzida ao longo de várias sessões de pesquisa sobre a Plataforma Lattes. O objetivo é orientar o desenvolvimento de um produto (nome provisório: "Modelo B"): um editor de currículo moderno que exporta XML Lattes válido e permite aos pesquisadores gerenciar sua produção acadêmica fora do Lattes e importá-la depois pelo recurso de importação XML que o próprio Lattes oferece.

Dois arquivos acompanham este documento e devem ser consultados ao longo dele:

- `lattes_schema_analysis.xlsx`: planilha com quatro abas. Comparação de Schemas (DTD vs XSD vs XML), Inventário Completo de Elementos (324 elementos), Inventário Completo de Atributos (1.927 posições de atributo com tipos, enums e marcação de obrigatório) e a análise dos Campos Fantasma pós-2022
- `lattes_maximal_skeleton.xml`: um arquivo XML de 4.495 linhas com todos os elementos e atributos possíveis do schema Lattes, anotado com marcadores `[REQUIRED]` e os valores de enum em comentários. Esta é a especificação da interface: cada elemento corresponde a uma seção de formulário, cada atributo a um campo e cada enum a um menu suspenso.

---

## 1. Contexto da plataforma

### O que é o Lattes

A Plataforma Lattes é o sistema nacional de currículos acadêmicos do Brasil, operado pelo CNPq (Conselho Nacional de Desenvolvimento Científico e Tecnológico). Foi lançada em 1999 e tem mais de 6,5 milhões de currículos cadastrados. É obrigatória para praticamente toda atividade acadêmica no país: pedidos de bolsa e financiamento, ingresso em programas de pós-graduação, contratação de docentes, cadastro de grupos de pesquisa e avaliação institucional, tudo isso exige um currículo Lattes.

A plataforma não tem concorrente real no Brasil porque é exigida pelo governo. Os pesquisadores não podem escolher uma alternativa e precisam usar o Lattes seja qual for a qualidade dele.

### Por que isso importa

Como o Lattes é obrigatório, seus problemas de UX não fazem os usuários irem embora (eles não podem). O que eles geram é frustração em massa, tempo perdido, dados perdidos e carga administrativa em todo o ecossistema de pesquisa brasileiro. É um público cativo de milhões de usuários com alta escolaridade e sem alternativas.

---

## 2. Problemas de UX: o que encontramos

### Estudo acadêmico de usabilidade

Um estudo formal de usabilidade (artigo acadêmico) testou o Lattes com usuários reais e encontrou **taxa de sucesso de 0%** na tarefa de registrar um artigo publicado. Nenhum participante conseguiu concluir essa tarefa central sem erros ou sem empacar. Principais problemas identificados:

- Falsos sinais de conclusão: o sistema parece salvar quando não salvou
- Hierarquia de formulários confusa, com navegação profundamente aninhada e pouco óbvia
- Sem salvamento automático: perda de dados por timeout, navegação acidental ou expiração da sessão
- Sem validação em linha nem indicadores de progresso
- Rótulos de campo ambíguos e terminologia inconsistente
- Sem desfazer/refazer

### Análise das reclamações no Reclame Aqui (551 reclamações)

Analisamos 551 páginas de reclamações no Reclame Aqui (a principal plataforma de reclamações de consumidores do Brasil). As reclamações se dividem nestas categorias:

| Categoria                                                         | % das reclamações | Descrição                                                                                                                                                                        |
| ----------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cadastro / Validação na RFB                                       | ~30%              | Usuários bloqueados depois de 3 tentativas de validação de CPF sem sucesso, sem desbloqueio por conta própria. Precisam mandar e-mail ao CNPq e esperar dias ou semanas.         |
| Autenticação                                                      | ~25%              | Falhas na recuperação de senha, e-mail não reconhecido, contas bloqueadas, CAPTCHA quebrado.                                                                                     |
| Atraso na publicação                                              | ~15%              | Depois de enviar alterações no currículo, elas levam de dias a semanas para aparecer no perfil público. Os usuários descrevem isso como o purgatório do "aguardando publicação". |
| Desempenho / Instabilidade                                        | ~12%              | Timeouts, telas em branco, erros de servidor. Houve uma indisponibilidade total de mais de 2 semanas em 2021. Erros de certificado SSL.                                          |
| Perda de dados                                                    | ~8%               | Usuários relatam horas de trabalho perdidas por expiração de sessão, gravações que falharam ou dados que sumiram sem explicação.                                                 |
| Outros (confusão na interface, recursos ausentes, acessibilidade) | ~10%              | Problemas variados de UX, falta de suporte a celular, nenhuma conformidade de acessibilidade.                                                                                    |

### Ecossistema de desenvolvedores (ferramentas de contorno)

A frustração deu origem a um ecossistema de mais de 20 ferramentas de terceiros que pesquisadores e instituições criaram para contornar as limitações do Lattes. Entre elas:

- **scriptLattes**: ferramenta em Python que faz scraping do HTML do Lattes para gerar relatórios de grupos de pesquisa, análise de citações e redes de colaboração. Usada por grandes universidades brasileiras.
- **SLattes**: converte exportações XML do Lattes para outros formatos (BibTeX, MODS) usando XSLT. Mantém uma versão atualizada do DTD, que o CNPq deixou de atualizar.
- **Escavador.com**: plataforma comercial que faz scraping e indexa perfis públicos do Lattes, oferecendo uma interface de busca moderna sobre esses dados.
- **getLattes**: pacote em R para extrair e analisar dados XML do Lattes.
- **Lattes Extractor**: ferramentas diversas para extração de dados em massa.
- Várias ferramentas institucionais criadas por universidades para relatórios internos.

A existência desse ecossistema confirma a necessidade de mercado: as pessoas já estão construindo coisas em volta das deficiências do Lattes.

---

## 3. Análise competitiva

### Plataformas analisadas

Comparamos o Lattes com quatro plataformas internacionais de perfil acadêmico em mais de 30 dimensões. Uma planilha detalhada foi produzida numa sessão anterior (`lattes_competitive_analysis.xlsx`, não anexada aqui, mas as conclusões estão resumidas abaixo).

**ORCID**: aberto, sem fins lucrativos. API REST completa, com mais de 1.800 organizações-membro. Importação de publicações via "Search & Link" a partir de Crossref, Scopus e Web of Science. Controle de privacidade por campo (Everyone / Trusted Organizations / Only Me). Modelo de Trusted Organizations para a gestão de dados institucionais. Cadastro em 2 minutos com OAuth2 padrão.

**Ciência Vitae**: a plataforma nacional de currículos acadêmicos de Portugal e a comparação mais diretamente relevante. Substituiu o DeGóis, que por sua vez era derivado do Lattes. A reformulação foi motivada por uma diretriz do governo chamada "Mais Ciência, Menos Burocracia". Principais recursos: um Assistente de Importação que traz publicações de mais de 5 fontes externas, modelos personalizáveis de exportação do currículo e uma interface moderna e responsiva. Ela mostra que uma plataforma exigida pelo governo PODE ter boa UX.

**Academia.edu**: o melhor design visual entre as plataformas acadêmicas. Edição em linha com salvamento automático instantâneo. Painel de análise do perfil (visualizações, downloads, dados geográficos). Apps nativos para celular. Modelo freemium.

**ResearchGate**: visualização da rede de coautores, painel de métricas, fluxo de importação de publicações por DOI, fórum de perguntas e respostas para pesquisadores.

### Placar do Lattes

Em 18 dimensões avaliadas numa escala de 1 a 5:

- Média do Lattes: **1,1**
- Concorrentes concentrados entre: **3,5–4,5**

O Lattes tirou 1 (a nota mais baixa) em quase todas as dimensões, exceto "completude dos dados", em que o caráter obrigatório garante uma cobertura ampla.

### Lições a copiar

- Do ORCID: o fluxo de importação "Search & Link", o controle de privacidade por campo, o modelo de Trusted Organizations
- Do Ciência Vitae: o Assistente de Importação de várias fontes, os modelos de exportação personalizáveis, o enquadramento político de "menos burocracia"
- Do Academia.edu: edição em linha com salvamento instantâneo, análise do perfil, design pensado primeiro para o celular
- Do ResearchGate: fluxo de importação por DOI, visualização da rede de coautores

---

## 4. Análise jurídica

### Como o Escavador.com opera

O Escavador é uma plataforma comercial que exibe dados do Lattes. Sua estratégia jurídica se apoia em três pilares:

1. **Doutrina dos dados públicos**: a empresa se apresenta como indexadora de dados disponíveis publicamente, citando a LGPD, a Lei de Acesso à Informação e o Código de Processo Civil. Os pesquisadores tornaram seus perfis públicos por vontade própria.
2. **Faz scraping do HTML público, e não da API oficial**: o CNPq tem dois canais de dados com regras diferentes. O "Extrator Lattes" (a API oficial de dados em massa) exige credenciamento institucional e a assinatura de um Termo de Responsabilidade, e proíbe expressamente o uso comercial. Os perfis públicos em HTML, por outro lado, são acessíveis por definição, e o Escavador os percorre como faria um buscador.
3. **Somente leitura, sem modificação**: a empresa se posiciona como ferramenta de busca e visualização, que nunca altera dados do Lattes.

Os Termos de Uso de 2022 do CNPq (Portaria 976) acrescentaram uma cláusula antiscraping que proíbe "robôs, spiders, scrapers" sem permissão expressa por escrito, mas a aplicabilidade disso contra um indexador terceiro que nunca aceitou esses termos é juridicamente duvidosa no direito brasileiro quando os dados são de fato públicos.

### Restrições jurídicas para o nosso produto (Modelo B)

Construir uma ferramenta que interaja diretamente com o Lattes em nome dos usuários esbarra em barreiras jurídicas importantes:

- **Proibição de uso comercial nos Termos de Uso**: "vedada a utilização do serviço para finalidades comerciais"
- **Sem OAuth nem delegação de credenciais**: o Lattes não tem OAuth. As senhas são "pessoal e intransferível", e aceitar credenciais do usuário para agir em nome dele violaria os Termos de Uso.
- **Cláusula antiautomação**: a Portaria de 2022 dá ao CNPq base jurídica para bloquear acessos automatizados.
- **Fiscalização ativa**: o CNPq acrescentou CAPTCHAs e outras medidas para bloquear acessos automatizados.

### Opções de modelo de produto

| Modelo       | Descrição                                                                                 | Risco jurídico             | Viabilidade               |
| ------------ | ----------------------------------------------------------------------------------------- | -------------------------- | ------------------------- |
| Modelo A     | Visualizador somente leitura de perfis públicos, no estilo do Escavador                   | Baixo                      | Comprovada pelo Escavador |
| **Modelo B** | **Editor de currículo que exporta XML Lattes válido para importação manual pelo usuário** | **Médio-baixo**            | **A abordagem escolhida** |
| Modelo C     | Extensão de navegador que melhora a interface web do Lattes                               | Zona cinzenta              | Tecnicamente frágil       |
| Modelo D     | Parceria oficial com o CNPq                                                               | Menor risco, maior esforço | Objetivo de longo prazo   |

**O Modelo B é a abordagem escolhida.** Ele nunca toca no Lattes diretamente: os usuários exportam o XML do Lattes, editam na nossa ferramenta e importam o XML de volta no Lattes pelo próprio diálogo de importação do Lattes. Sem delegação de credenciais, sem scraping, sem abuso de API.

---

## 5. O sistema de importação/exportação XML: nossa base técnica

### Como funciona a importação

O Lattes tem um recurso nativo de importação XML, acessível dentro da interface de edição do currículo do usuário. O fluxo é este:

**Passo 1**: enviar um arquivo XML. O diálogo informa que o arquivo precisa estar de acordo com o DTD.

**Passo 2**: escolher, por meio de caixas de seleção, quais módulos importar:

- Artigos completos publicados
- Artigos aceitos para publicação
- Livros e capítulos
- Trabalhos publicados em anais de eventos
- Texto em jornal ou revista
- Apresentação de Trabalho
- Outras produções bibliográficas
- Softwares, Produtos, Processos
- Trabalhos técnicos
- Outras produções técnicas
- Produção artística/cultural
- Orientações e Supervisões
- Demais Trabalhos
- Eventos
- Bancas

Há também um filtro de ano ("Produção C&T a partir de", com 2007 como padrão) para atualizações incrementais.

Em seguida o sistema mostra: "Aguarde, o XML está sendo transferido..."

### Características críticas da importação

- **A importação ACRESCENTA, não substitui**: o texto das caixas de seleção, "Selecione os ítens que deseja importar", e a seleção por categoria confirmam que ela adiciona itens em vez de sobrescrever o currículo inteiro.
- **Cobre só dados de produção e atividades**: não há caixas de seleção para DADOS-GERAIS (dados pessoais), FORMACAO-ACADEMICA (formação), ATUACOES-PROFISSIONAIS (vínculos profissionais), AREAS-DE-ATUACAO ou IDIOMAS. A importação foi pensada apenas para as seções de produção.
- **O filtro de ano permite atualizações incrementais**: os usuários podem importar só a produção a partir de um determinado ano.
- **Cobre as seções mais penosas**: as seções importáveis (publicações, orientações, bancas, eventos) são justamente onde a UX do Lattes é pior e onde o estudo de usabilidade encontrou taxa de sucesso de 0%.

### Como funciona a exportação

Os usuários podem exportar o currículo completo em XML. O arquivo exportado contém tudo: dados pessoais, formação, histórico profissional, idiomas, prêmios e toda a produção. É um retrato completo do perfil, sem se limitar às seções que podem ser importadas.

O XML exportado usa um estilo carregado de atributos, em que os dados ficam nos atributos XML e não no conteúdo de texto dos elementos. Por exemplo:
`<GRADUACAO NOME-CURSO="Design Gráfico" ANO-DE-CONCLUSAO="2004" STATUS-DO-CURSO="CONCLUIDO"/>`

### Implicações para o produto

Nosso produto cuida das seções mais penosas e mais volumosas (publicações, apresentações, produção técnica, bancas, orientações) com uma interface de edição bonita, preenchimento automático por DOI e importação do ORCID. Exportamos um XML válido que os usuários importam direto no Lattes pela seleção de caixas do Passo 2.

Para as seções biográficas (dados pessoais, formação, histórico profissional) que a importação não cobre, podemos oferecer uma boa experiência de visualização e edição com um fluxo de "copiar para o Lattes manualmente", mas a proposta de valor real está nas seções de produção importáveis.

---

## 6. Análise do schema: três fontes, uma verdade

### As três fontes de schema

Descobrimos que existem três fontes diferentes de schema para o XML Lattes, cada uma de uma época:

| Fonte                          | Formato       | Última atualização                  | Onde foi encontrada                                 |
| ------------------------------ | ------------- | ----------------------------------- | --------------------------------------------------- |
| LMPLCurriculo.DTD              | DTD           | Versão 4.0, 21 de fevereiro de 2014 | Link no diálogo de Importação XML                   |
| CurriculoLattes_12_09_2022.xsd | XSD           | 12 de setembro de 2022              | Link na página "Extração de Dados" do Portal Lattes |
| Exportação XML real            | Instância XML | ~2025 (sempre que você exporta)     | Botão Exportar no editor de currículo               |

### Principais conclusões da comparação

**No nível dos elementos**: o DTD define 323 elementos. O XSD define 324 (acrescentou 3, LICENCA, LICENCAS e HISTORICO-SITUACOES-PATENTE, para o licenciamento de patentes, e removeu 2). A estrutura ficou quase idêntica ao longo de mais de 10 anos.

**No nível dos atributos**: é aqui que o XSD se destaca. O XSD define 1.927 posições de atributo em todos os elementos, contra cerca de 386 do DTD. O XSD tem 251 enumerações tipadas com 1.086 valores válidos (por exemplo, STATUS-DO-CURSO só pode ser EM_ANDAMENTO, CONCLUIDO ou INCOMPLETO). O DTD tem listas de valores separadas por barra vertical no próprio texto, mas muito menos campos restritos.

**Elementos com mais atributos** (indicadores de complexidade para o desenho dos formulários):

- DOUTORADO: 35 atributos
- MESTRADO: 29 atributos
- GRADUACAO: 28 atributos
- DADOS-GERAIS: 27 atributos
- MESTRADO-PROFISSIONALIZANTE: 23 atributos
- PROJETO-DE-PESQUISA: 20 atributos

**Lacuna de cobertura**: a exportação XML de um usuário real costuma usar uns 60 dos 324 elementos (dependendo da carreira). Os outros 263 elementos representam áreas da vida acadêmica que a pessoa não usou (por exemplo, patentes, produção artística, orientação de doutorado, conselhos profissionais).

### Campos fantasma: acréscimos pós-2022

Quatro atributos aparecem numa exportação XML de 2025 sem existir NEM no DTD (2014) NEM no XSD (2022):

| Atributo               | Elemento     | Interpretação                                                                                                               |
| ---------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| PCD                    | DADOS-GERAIS | Pessoa com Deficiência (campo sobre deficiência), provavelmente por conformidade com a LGPD ou com normas de acessibilidade |
| REDE-SOCIAL            | ENDERECO     | Links de redes sociais                                                                                                      |
| ELETRONICO             | ENDERECO     | Informações de contato eletrônico                                                                                           |
| OUTRA-FORMA-DE-CONTATO | ENDERECO     | Outras formas de contato                                                                                                    |

Um atributo (ORCID-ID em DADOS-GERAIS) está no XSD mas não no DTD, o que situa seu acréscimo entre 2014 e 2022.

Isso confirma que o modelo de dados interno do CNPq continua evoluindo e que a exportação acompanha essa evolução, enquanto os schemas publicados ficam para trás. O validador da importação deve usar um schema interno, não publicado, mais novo que qualquer documento público.

### Qual schema usar no desenvolvimento

**Use o XSD (2022) como especificação principal.** Ele é tipado, mais rico, 8 anos mais novo que o DTD e define enumerações de verdade. Acrescente nele os 4 campos fantasma vindos da exportação XML. O arquivo XML com o esqueleto máximo (anexo) foi gerado a partir dessa fonte combinada.

O DTD continua útil como referência secundária. Os comentários com o histórico de versões documentam a evolução do schema de 2003 a 2014, e ele define o formato que o diálogo de importação cita explicitamente.

### Histórico de versões do DTD

O DTD traz um changelog extenso nos seus comentários XML:

- v1.1 (mar. 2003) a v1.4.2 (abr. 2004): versões iniciais, estrutura básica
- v1.4.3 (abr. 2006): todos os campos fora de DADOS-GERAIS passaram a ser opcionais
- v1.4.4 (jul. 2006): acrescentado TEXTO-RESUMO-CV-RH
- v1.5–2.0 (sem data): suporte a DOI, cotutela e sanduíche no doutorado, códigos de curso da CAPES
- v2.1–2.4.1 (sem data): traduções dos campos para o inglês, ampliação do módulo de patentes, IDs de coautor
- v3.0 (dez. 2011): web como meio de publicação, tipos de redes sociais, marcações de divulgação científica, marcações de inovação
- v4.0 (fev. 2014): campo de raça/cor, preparação para o ORCID, eventos do tipo olimpíada/exposição/feira

O projeto SLattes (ferramenta de terceiros) mantém uma versão do DTD obtida por engenharia reversa que corrige algumas lacunas, mas o nosso XSD, tirado do próprio site do CNPq, tem mais autoridade e é mais atual.

---

## 7. Estratégia de produto

### Proposta de valor central

Um editor de currículo moderno e bonito para pesquisadores brasileiros, que acaba com o sofrimento de gerenciar a produção acadêmica no Lattes. Os usuários editam na nossa ferramenta com uma interface moderna (salvamento automático, preenchimento automático por DOI, importação do ORCID, validação em linha, indicadores de progresso) e depois importam o XML resultante no Lattes com poucos cliques.

### O que construímos (escopo do MVP)

O foco do MVP devem ser as seções que podem ser importadas. São elas:

1. **Produção bibliográfica** (PRODUCAO-BIBLIOGRAFICA)
   - Artigos publicados em periódicos (ARTIGOS-PUBLICADOS)
   - Artigos aceitos (ARTIGOS-ACEITOS-PARA-PUBLICACAO)
   - Livros e capítulos (LIVROS-E-CAPITULOS)
   - Trabalhos em eventos (TRABALHOS-EM-EVENTOS)
   - Textos em jornais ou revistas (TEXTOS-EM-JORNAIS-OU-REVISTAS)
   - Outras produções bibliográficas (DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA)

2. **Produção técnica** (PRODUCAO-TECNICA)
   - Software (SOFTWARE)
   - Patentes e propriedade intelectual relacionada (PATENTE, CULTIVAR, DESENHO-INDUSTRIAL, MARCA, TOPOGRAFIA)
   - Produtos tecnológicos (PRODUTO-TECNOLOGICO)
   - Processos ou técnicas (PROCESSOS-OU-TECNICAS)
   - Trabalhos técnicos (TRABALHO-TECNICO)
   - Outras produções técnicas

3. **Outra produção** (OUTRA-PRODUCAO)
   - Produção artística/cultural (PRODUCAO-ARTISTICA-CULTURAL)
   - Orientações e supervisões concluídas (ORIENTACOES-CONCLUIDAS)
   - Demais trabalhos (DEMAIS-TRABALHOS)

4. **Dados complementares** (DADOS-COMPLEMENTARES)
   - Participação em bancas examinadoras (PARTICIPACAO-EM-BANCA)
   - Participação em eventos (PARTICIPACAO-EM-EVENTOS-CONGRESSOS)
   - Orientações em andamento (ORIENTACOES-EM-ANDAMENTO)

### O que mostramos mas não importamos

Para as seções que a importação não cobre (dados pessoais, formação, histórico profissional, idiomas, áreas de atuação, prêmios), podemos:

- Exibi-las de forma caprichada a partir de uma exportação XML importada
- Permitir a edição com um fluxo de "copiar estas alterações para o Lattes manualmente"
- Usá-las para gerar currículos formatados em PDF/DOCX (um recurso secundário)

### Recursos prioritários

Com base na análise competitiva e nos dados de reclamações:

- **Importação por DOI**: digitar um DOI e preencher automaticamente todos os campos da publicação a partir do Crossref/DataCite
- **Importação do ORCID**: trazer as publicações do perfil ORCID do usuário
- **Salvamento automático com estado de rascunho**: nunca perder trabalho. Salvar continuamente.
- **Validação em linha contra o schema**: mostrar os erros antes da exportação, e não depois de uma importação que falhou no Lattes
- **Indicadores de progresso**: mostrar o percentual de preenchimento por seção
- **Operações em lote**: adicionar várias publicações de uma vez (por exemplo, colando uma lista de DOIs)
- **Exportação de currículo formatado**: gerar PDF/DOCX a partir dos mesmos dados, nos formatos de currículo acadêmico usuais (ABNT, internacional)
- **Gestão de coautores**: manter uma lista de coautores frequentes com o NRO-ID-CNPQ de cada um, para reaproveitar

### Fluxo

1. O usuário exporta o XML do Lattes (exportação completa do currículo)
2. O usuário envia o XML para a nossa ferramenta
3. A ferramenta interpreta e exibe todos os dados do currículo numa interface moderna
4. O usuário edita ou acrescenta itens de produção na nossa interface
5. A ferramenta exporta um XML válido e compatível com o Lattes
6. O usuário importa o XML no Lattes pelo diálogo de importação, marcando as caixas pertinentes
7. O Lattes acrescenta os itens novos ao currículo

### Considerações sobre modelo de receita

A ferramenta não pode interagir com o Lattes de forma programática (por restrições jurídicas), então a proposta de valor precisa ser forte o bastante para que os pesquisadores paguem pela experiência de edição em si. Ângulos possíveis:

- Freemium: grátis para visualização e edição básica, pago para importação automática por DOI, sincronização com o ORCID, operações em lote e exportação de currículo formatado
- Licenciamento institucional: universidades pagam pelo acesso de departamentos inteiros
- O recurso de exportação de currículo formatado (gerar currículos no padrão ABN a partir dos dados do Lattes) pode ser uma proposta de valor forte por si só

---

## 8. Etapas de validação antes de construir

Estes testes devem ser feitos manualmente antes de se comprometer com o desenvolvimento:

1. **Teste de ida e volta**: exportar o XML do currículo no Lattes, não mudar nada e importá-lo de volta. Verificar que nada quebra, que não surgem duplicatas e que não há perda de dados.

2. **Teste de modificação**: exportar, mudar um único campo (por exemplo, acrescentar uma palavra em RESUMO-CV ou adicionar uma publicação fictícia), importar e verificar se a alteração aparece corretamente.

3. **Teste de XML mínimo**: criar um arquivo XML pequeno com apenas um elemento ARTIGO-PUBLICADO e a estrutura mínima obrigatória em volta. Importá-lo. Ver se o Lattes o aceita ou se exige a estrutura completa do currículo.

4. **Teste de validação de schema**: o Lattes rejeita XML que contém os campos fantasma pós-2022 (PCD, REDE-SOCIAL etc.)? Se o teste de ida e volta passar, isso está respondido: esses campos estão na exportação, então devem sobreviver à importação.

5. **Teste de tratamento de duplicatas**: importar a mesma publicação duas vezes. O Lattes cria duplicatas ou detecta e ignora os itens existentes? Isso define se a nossa ferramenta precisa de lógica de eliminação de duplicatas.

---

## 9. Questões em aberto

- O que exatamente o validador da importação verifica? Ele valida contra o DTD, o XSD, um schema interno, ou é permissivo?
- Como o Lattes detecta duplicatas na importação? Pelo título? Pelo DOI? Por algum número de sequência interno?
- Qual o tamanho máximo de arquivo XML que a importação aceita?
- O diálogo de importação consegue lidar com XML gerado do zero (e não derivado de uma exportação), ou espera certos IDs internos (como NUMERO-IDENTIFICADOR e SEQUENCIA-PRODUCAO) que só o Lattes gera?
- O recurso de importação está disponível para todos os usuários ou só para certos perfis institucionais?
- Com que frequência os usuários usam o recurso de importação hoje? (Isso indica se o fluxo é familiar ou novo para eles.)

---

## 10. Referência dos arquivos anexos

### lattes_schema_analysis.xlsx

Quatro abas:

**Aba 1, Comparação de Schemas**: comparação lado a lado do DTD (2014), do XSD (2022) e da sua exportação XML (2025). Mostra o que cada fonte define, onde concordam e onde divergem.

**Aba 2, Inventário de Elementos**: todos os mais de 324 elementos, com caminhos na hierarquia, presença em cada fonte de schema, contagem de atributos, elementos filhos e agrupamento por categoria. Filtrável. Destaque amarelo indica elementos que não estão no seu XML (seções que você não usou). Verde indica elementos que o seu perfil usa.

**Aba 3, Inventário de Atributos**: todos os atributos de todos os elementos, com situação de obrigatório ou opcional, tipo de dado ou valores de enum, presença no DTD, presença no seu XML e um valor de exemplo da sua exportação, quando houver. É a especificação no nível de campo para construir os formulários.

**Aba 4, Campos Fantasma pós-2022**: os 4 a 6 atributos que existem nas exportações XML recentes mas em nenhum schema publicado. Inclui uma avaliação de risco para cada um.

### lattes_maximal_skeleton.xml

Um arquivo XML de 4.495 linhas que inclui todos os elementos e atributos definidos nas três fontes de schema. Anotado com:

- Marcadores `[REQUIRED]` nos atributos obrigatórios
- Valores de enum em comentários XML (por exemplo, `<!-- SIM|NAO -->`)
- Marcadores `<!-- optional -->` e `<!-- repeatable -->` nos elementos filhos
- Valores vazios de preenchimento em todos os atributos

Este arquivo serve como:

- Especificação completa da interface (cada elemento é uma seção de formulário, cada atributo é um campo)
- Ponto de partida para gerar arquivos XML de teste
- Referência para entender o modelo de dados completo, inclusive as seções que nenhum perfil isolado usaria
