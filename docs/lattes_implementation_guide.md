# Editor de Currículo Lattes: guia de implementação

Público: o agente de código que constrói a primeira versão.
Data: 2026-10-10
Documentos complementares, anexe-os junto com este guia:

| Arquivo                           | O que contém                                                                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lattes_product_requirements.md`  | Por que o produto existe, pesquisa com usuários, análise competitiva e jurídica, estratégia de produto                                                                     |
| `lattes_editor_reconnaissance.md` | Como o editor do Lattes funciona por dentro: stack, catálogo de menus, mapas de campos dos formulários, mecânica de gravação, comportamento da importação conforme testado |
| `lattes_schema_analysis.xlsx`     | Inventários de elementos e atributos a partir do DTD (2014), do XSD (2022) e de exportações reais; campos fantasma                                                         |
| `lattes_maximal_skeleton.xml`     | Todos os elementos e atributos que o schema permite, com os valores de enum em comentários; o mapa de campos da interface                                                  |
| `CurriculoLattes_12_09_2022.xsd`  | Schema principal (CNPq, página do Extrator Lattes)                                                                                                                         |
| `LMPLCurriculo.DTD`               | Schema secundário (CNPq, link no diálogo de Importar), versão 4.0 de 2014, com comentários de changelog                                                                    |
| Uma exportação real `CV_<id>.zip` | Fixture privada. Nunca faça commit dela.                                                                                                                                   |

Leia o relatório de reconhecimento antes de mexer no exportador. A seção 5.1 de lá é o contrato que o exportador precisa cumprir.

---

## 1. Decisões já tomadas

| Tema                                          | Decisão                                                                                                                                                                          | Motivo                                                                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Forma do produto                              | Aplicação web local-first. Carrega uma exportação XML do Lattes, edita e grava um XML que a importação do Lattes aceita. Sem backend, sem contas, sem armazenamento no servidor. | Software livre, um único mantenedor, dados pessoais (CPF, RG, data de nascimento, nome dos pais) nunca saem da máquina                 |
| Caminho de escrita para a produção            | Exportação XML pelo app, importada pelo usuário no próprio diálogo Importar do Lattes                                                                                            | Testado em 2026-10-10 com um item montado à mão; funciona                                                                              |
| Caminho de escrita para as seções biográficas | Fora do escopo da v1. Um conector no navegador é a fase 3, depois que o editor existir.                                                                                          | A importação ignora Dados Gerais, Formação, Atuação, Idiomas, Endereço                                                                 |
| Usuários                                      | Rafael e a turma do primeiro ano do mestrado dele na Unisinos                                                                                                                    | Sem monetização, sem recursos institucionais                                                                                           |
| Idioma                                        | Interface em pt-BR, com os nomes de seção do próprio Lattes para que os usuários os reconheçam                                                                                   | Os usuários alternam entre o app e o Lattes                                                                                            |
| Licença                                       | MIT                                                                                                                                                                              | A mais simples para uma ferramenta pessoal de software livre. Trocar para AGPL só se a hospedagem por terceiros virar uma preocupação. |
| Postura jurídica                              | O app nunca toca no Lattes. O usuário exporta, edita e importa.                                                                                                                  | Evita por completo a cláusula antiautomação e a cláusula de uso comercial da Portaria de 2022                                          |

### Importação sem duplicata (13/10/2026, LAT-50)

O caminho de escrita acima continua valendo para itens novos, mas deixa de ser manual e deixa de ser o único. Quem usa o editor não confere marcadores no Lattes: só a diferença vai, e nada que já existe vira duplicata.

- Itens novos vão pelo Importar do Lattes, num arquivo só com eles (opção 1 da seção 3.3), e o conector roda os passos 1 a 3 sozinho. Se o passo 3 mostrar algum item em vermelho, o conector para sem confirmar. Depois do Confirmar, uma nova exportação confere que cada item entrou uma vez só.
- Alteração em item que já existe nunca passa pelo Importar. Ela vai no lugar, pelo formulário do próprio item: LAT-51 para as produções, LAT-23 para as seções biográficas.
- Exclusão vai pelo "Excluir" do formulário do item (LAT-49; mapa na seção 15 de `lattes_internals.md`).

Isso muda a "Postura jurídica" da tabela acima: o conector, uma extensão que roda na sessão da própria pessoa e só depois de ela confirmar a fila, passa a gravar no Lattes. A decisão de construí-lo já tinha sido tomada (fase "Conector no navegador", seção 5).

Não decidido; use o padrão a menos que Rafael se oponha:

| Tema         | Padrão                                                                                                                                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | Vite, TypeScript, React, nenhum framework de UI além de um pequeno conjunto de componentes, CSS com design tokens. Rafael é engenheiro de front-end e vai revisar a interface pessoalmente.                                                                                                                         |
| Persistência | IndexedDB (Dexie) para a cópia de trabalho e o histórico de salvamento automático, mais um "Salvar arquivo" explícito para o disco. A exportação enviada é a fonte; o app nunca a edita diretamente. O conteúdo vai cifrado (AES-GCM, chave no chaveiro do sistema; `src/model/seal.ts`, `src-tauri/src/chave.rs`). |
| Hospedagem   | Nenhuma para o editor: distribuído como app de desktop (Tauri) nas páginas de lançamento do GitHub. Só a página do projeto (`site/`) fica num host estático. O build web continua abrindo por `file://`.                                                                                                            |
| Testes       | Vitest para testes unitários, Playwright para alguns fluxos, `xmllint --schema` na CI para cada fixture XML gerada                                                                                                                                                                                                  |

## 2. O modelo de dados

### 2.1 Fonte da verdade

O XSD de 2022, corrigido com seis atributos que as exportações atuais trazem e que faltam no XSD:

| Elemento                                                      | Atributo                                              |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| `DADOS-GERAIS`                                                | `PCD`                                                 |
| `ENDERECO`                                                    | `REDE-SOCIAL`, `ELETRONICO`, `OUTRA-FORMA-DE-CONTATO` |
| `MESTRADO` (e provavelmente os outros elementos de titulação) | `ID-OASIS`, `STATUS-OASISBR`                          |

Mantenha o schema corrigido no repositório como `schema/CurriculoLattes_2022_patched.xsd`, gerado a partir do original por um script, com o diff visível. Valide na CI todo XML gerado contra a versão corrigida. Espere que o CNPq acrescente mais atributos com o tempo; o parser nunca pode descartar um atributo ou elemento desconhecido (ver 2.4).

### 2.2 Gere o modelo, não escreva à mão

Um script em tempo de build lê o XSD e emite `src/schema/lattes.json`: para cada um dos 324 elementos, seus filhos com cardinalidade e seus atributos com a marcação de obrigatório, os valores de enum e os padrões. A partir desse JSON, emita os tipos TypeScript. Os formulários da cauda longa de seções são renderizados a partir desse JSON. Formulários desenhados à mão ficam reservados para as seções que as pessoas usam toda semana (seção 4).

Fatos sobre o schema que o gerador precisa respeitar:

- Os dados ficam nos atributos. Os elementos são, na maioria, vazios ou contêm apenas elementos filhos. Três elementos têm conteúdo de texto (`DISCIPLINA`, `INTEGRANTES-DO-PROJETO`, `TREINAMENTO`).
- A ordem dos filhos é uma sequência fixa, e não um conjunto sem ordem. Os filhos de `PRODUCAO-BIBLIOGRAFICA` precisam aparecer na ordem TRABALHOS-EM-EVENTOS, ARTIGOS-PUBLICADOS, LIVROS-E-CAPITULOS, TEXTOS-EM-JORNAIS-OU-REVISTAS, DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA, ARTIGOS-ACEITOS-PARA-PUBLICACAO. O mesmo vale para todo contêiner. O serializador ordena os filhos a partir do schema, nunca pela ordem de inserção.
- São 251 tipos enumerados com 1.086 valores. Os valores de enum estão em UPPER_SNAKE (`CONCLUIDO`, `MEIO_DIGITAL`, `CIENCIAS_SOCIAIS_APLICADAS`). A interface mostra rótulos em pt-BR e grava o enum.
- Datas: strings `DDMMAAAA` em DADOS-GERAIS (`DATA-NASCIMENTO="15031990"`), strings de ano com quatro dígitos nos demais lugares, strings de mês com dois dígitos. Nunca emita datas ISO.
- Todo item de produção tem `SEQUENCIA-PRODUCAO` (seção 3.2). Nas seções biográficas, todo item de lista tem seu próprio atributo `SEQUENCIA-*` (`SEQUENCIA-FORMACAO`, `SEQUENCIA-ATIVIDADE` e assim por diante).
- Os autores são elementos `AUTORES` repetidos, com `NOME-COMPLETO-DO-AUTOR`, `NOME-PARA-CITACAO`, `ORDEM-DE-AUTORIA`, `NRO-ID-CNPQ`. O `NRO-ID-CNPQ` do próprio dono do currículo é o `NUMERO-IDENTIFICADOR` de 16 dígitos que está na raiz.

### 2.3 Codificação

As exportações são `ISO-8859-1` e declaram isso. O `TextEncoder` do navegador só produz UTF-8, então o serializador precisa de um escritor Latin-1 próprio: os code points de 0 a 255 viram bytes únicos, e qualquer coisa acima de 255 vira uma referência numérica de caractere (`&#x2014;`), o que é XML válido num documento Latin-1. Leia com `TextDecoder("iso-8859-1")`. Mantenha a declaração `standalone="no"` como veio na exportação.

### 2.4 Fidelidade de ida e volta

O parser guarda todo atributo e elemento que encontra, conhecido ou não, e o serializador os escreve de volta. Carregar e salvar em seguida precisa produzir um arquivo cujas únicas diferenças em relação ao original sejam a ordem dos atributos e os espaços em branco. Adicione um teste de CI que faz a ida e volta da fixture sintética e compara uma forma canonicalizada dos dois arquivos.

### 2.5 Fixtures

- `fixtures/synthetic_full.xml`: gerada a partir de `lattes_maximal_skeleton.xml`, com valores falsos para todos os atributos. Vai para o repositório. Usada nos testes de ida e volta, de validação e de renderização de formulários.
- `fixtures/synthetic_minimal.xml`: DADOS-GERAIS com os poucos atributos que uma exportação real sempre traz, mais um item em cada seção importável. Vai para o repositório.
- A exportação real do Rafael: no `.gitignore`, usada só localmente.

## 3. O contrato de importação

Tudo nesta seção foi observado na plataforma em produção em 2026-10-10. O relatório de reconhecimento tem as evidências.

### 3.1 O que o Lattes aceita

| Regra                    | Detalhe                                                                                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tipo de arquivo          | `.xml` puro. O ZIP que o próprio Exportar do Lattes gera é recusado. O app descompacta ao carregar e grava `.xml` ao exportar.                                                                                                                              |
| Raiz                     | `CURRICULO-VITAE` com `SISTEMA-ORIGEM-XML="LATTES_OFFLINE"`, `NUMERO-IDENTIFICADOR`, `DATA-ATUALIZACAO` (DDMMAAAA), `HORA-ATUALIZACAO` (HHMMSS). Copie o identificador da exportação carregada. Carimbe a data e a hora no momento da exportação.           |
| Fluxo                    | Passo 1 envio do arquivo, Passo 2 caixas de seleção por módulo (todas marcadas por padrão, com um filtro de ano "a partir de"), Passo 3 lista de itens com marcadores verdes (novo) e vermelhos (já está no currículo), todos marcados, e depois Confirmar. |
| Duplicatas               | Confirmar um item vermelho insere uma duplicata. Não existe atualização no lugar nem exclusão pela importação.                                                                                                                                              |
| Chave de correspondência | `SEQUENCIA-PRODUCAO`.                                                                                                                                                                                                                                       |

### 3.2 Números de sequência

`SEQUENCIA-PRODUCAO` é um contador global único para todos os tipos de produção do currículo (bibliográfica, técnica, artística, eventos, bancas, orientações). Comportamento observado:

| Valor num item novo                          | Resultado                        |
| -------------------------------------------- | -------------------------------- |
| Um número acima do maior da exportação       | Aceito                           |
| Um número ausente da exportação (uma lacuna) | Descartado em silêncio, sem erro |
| Atributo omitido                             | Descartado em silêncio, sem erro |

As lacunas estão ocupadas por linhas excluídas ou ocultas no servidor. Por isso:

- Ao carregar, calcule `maxSeq` sobre todos os `SEQUENCIA-PRODUCAO` do arquivo.
- Cada item novo recebe `maxSeq + n`, atribuído uma única vez e guardado junto com o item. Nunca renumere, nunca reutilize, nunca omita.
- Persista o contador no IndexedDB junto com o documento, para que itens criados em sessões diferentes continuem crescendo.
- Depois que o usuário importar e exportar de novo a partir do Lattes, recarregue a nova exportação; a numeração do servidor passa a valer dali em diante.

Questão em aberto para resolver cedo com um teste (seção 7): qual o tamanho máximo de número aceito. Só `max + 1` foi verificado.

### 3.3 O que vai no arquivo de importação

Há duas opções. A primeira não foi testada e precisa ser antes de o exportador ser projetado em torno dela:

1. Arquivo mínimo: raiz, um `DADOS-GERAIS` com `NOME-COMPLETO` e `NOME-EM-CITACOES-BIBLIOGRAFICAS`, e apenas os itens novos dentro de seus contêineres. Se o Lattes aceitar isso, o Passo 3 mostra só itens verdes e o usuário não consegue duplicar nada por acidente.
2. Arquivo completo: o currículo inteiro com os itens novos acrescentados. Verificado que funciona, mas o Passo 3 passa a listar todos os itens existentes em vermelho e marcados, e o usuário precisa desmarcá-los um por um.

Teste a opção 1 primeiro. Se falhar, publique a opção 2 com a instrução mais chamativa possível na tela: "Em Passo 3, desmarque os itens vermelhos."

Desde 13/10/2026 (LAT-50) a opção 1 é a escolhida, e a opção 2 deixa de ser alternativa: com o Importar automatizado pelo conector, um item vermelho no passo 3 faz o conector parar sem confirmar, em vez de pedir à pessoa que desmarque. O teste da opção 1 continua pendente e é o primeiro passo do LAT-50.

### 3.4 Seções importáveis e seus contêineres XML

As 17 caixas de seleção do Passo 2 e de onde cada uma lê:

| Caixa de seleção do Passo 2              | Contêiner XML                                                                                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artigos completos publicados             | `PRODUCAO-BIBLIOGRAFICA/ARTIGOS-PUBLICADOS/ARTIGO-PUBLICADO`                                                                                                                  |
| Artigos aceitos para publicação          | `PRODUCAO-BIBLIOGRAFICA/ARTIGOS-ACEITOS-PARA-PUBLICACAO/ARTIGO-ACEITO-PARA-PUBLICACAO`                                                                                        |
| Livros e capítulos                       | `PRODUCAO-BIBLIOGRAFICA/LIVROS-E-CAPITULOS/LIVROS-PUBLICADOS-OU-ORGANIZADOS/LIVRO-PUBLICADO-OU-ORGANIZADO` e `.../CAPITULOS-DE-LIVROS-PUBLICADOS/CAPITULO-DE-LIVRO-PUBLICADO` |
| Trabalhos publicados em anais de eventos | `PRODUCAO-BIBLIOGRAFICA/TRABALHOS-EM-EVENTOS/TRABALHO-EM-EVENTOS`                                                                                                             |
| Texto em jornal ou revista               | `PRODUCAO-BIBLIOGRAFICA/TEXTOS-EM-JORNAIS-OU-REVISTAS/TEXTO-EM-JORNAL-OU-REVISTA`                                                                                             |
| Apresentação de Trabalho                 | `PRODUCAO-TECNICA/DEMAIS-TIPOS-DE-PRODUCAO-TECNICA/APRESENTACAO-DE-TRABALHO`                                                                                                  |
| Outras produções bibliográficas          | `PRODUCAO-BIBLIOGRAFICA/DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA/*`                                                                                                             |
| Softwares                                | `PRODUCAO-TECNICA/SOFTWARE`                                                                                                                                                   |
| Produtos                                 | `PRODUCAO-TECNICA/PRODUTO-TECNOLOGICO`                                                                                                                                        |
| Processos                                | `PRODUCAO-TECNICA/PROCESSOS-OU-TECNICAS`                                                                                                                                      |
| Trabalhos técnicos                       | `PRODUCAO-TECNICA/TRABALHO-TECNICO`                                                                                                                                           |
| Outras produções técnicas                | `PRODUCAO-TECNICA/DEMAIS-TIPOS-DE-PRODUCAO-TECNICA/*` (exceto Apresentação de Trabalho)                                                                                       |
| Produção artística/cultural              | `OUTRA-PRODUCAO/PRODUCAO-ARTISTICA-CULTURAL/*`                                                                                                                                |
| Orientações e Supervisões                | `OUTRA-PRODUCAO/ORIENTACOES-CONCLUIDAS/*` e `DADOS-COMPLEMENTARES/ORIENTACOES-EM-ANDAMENTO/*`                                                                                 |
| Demais Trabalhos                         | `OUTRA-PRODUCAO/DEMAIS-TRABALHOS/DEMAIS-TRABALHOS`                                                                                                                            |
| Eventos                                  | `DADOS-COMPLEMENTARES/PARTICIPACAO-EM-EVENTOS-CONGRESSOS/*`                                                                                                                   |
| Bancas                                   | `DADOS-COMPLEMENTARES/PARTICIPACAO-EM-BANCA-TRABALHOS-CONCLUSAO/*` e `.../PARTICIPACAO-EM-BANCA-JULGADORA/*`                                                                  |

Nada do que está sob `DADOS-GERAIS` é importável. O app mostra e edita essas seções (elas são necessárias para o currículo formatado da fase 2) e as rotula como "não importável no Lattes", com uma opção "copiar" por campo para que o usuário cole o valor à mão no formulário do Lattes.

### 3.5 Um item verificado

Exatamente esta forma foi aceita em 2026-10-10. Use-a como modelo para o exportador de trabalhos em eventos e como o primeiro teste do exportador.

```xml
<TRABALHOS-EM-EVENTOS>
  <TRABALHO-EM-EVENTOS SEQUENCIA-PRODUCAO="33">
    <DADOS-BASICOS-DO-TRABALHO NATUREZA="COMPLETO" TITULO-DO-TRABALHO="…" ANO-DO-TRABALHO="2025"
      PAIS-DO-EVENTO="Brasil" IDIOMA="Português" MEIO-DE-DIVULGACAO="MEIO_DIGITAL" HOME-PAGE-DO-TRABALHO=""
      FLAG-RELEVANCIA="NAO" DOI="" TITULO-DO-TRABALHO-INGLES="" FLAG-DIVULGACAO-CIENTIFICA="NAO"/>
    <DETALHAMENTO-DO-TRABALHO CLASSIFICACAO-DO-EVENTO="NACIONAL" NOME-DO-EVENTO="…" CIDADE-DO-EVENTO="…"
      ANO-DE-REALIZACAO="2025" TITULO-DOS-ANAIS-OU-PROCEEDINGS="…" VOLUME="" FASCICULO="" SERIE=""
      PAGINA-INICIAL="1" PAGINA-FINAL="2" ISBN="" NOME-DA-EDITORA="" CIDADE-DA-EDITORA="" NOME-DO-EVENTO-INGLES=""/>
    <AUTORES NOME-COMPLETO-DO-AUTOR="…" NOME-PARA-CITACAO="…" ORDEM-DE-AUTORIA="1" NRO-ID-CNPQ="…"/>
    <PALAVRAS-CHAVE PALAVRA-CHAVE-1="…" PALAVRA-CHAVE-2="" PALAVRA-CHAVE-3="" PALAVRA-CHAVE-4="" PALAVRA-CHAVE-5="" PALAVRA-CHAVE-6=""/>
    <AREAS-DO-CONHECIMENTO>
      <AREA-DO-CONHECIMENTO-1 NOME-GRANDE-AREA-DO-CONHECIMENTO="CIENCIAS_SOCIAIS_APLICADAS" NOME-DA-AREA-DO-CONHECIMENTO="Desenho Industrial" NOME-DA-SUB-AREA-DO-CONHECIMENTO="" NOME-DA-ESPECIALIDADE=""/>
    </AREAS-DO-CONHECIMENTO>
  </TRABALHO-EM-EVENTOS>
</TRABALHOS-EM-EVENTOS>
```

Atributos vazios são escritos como strings vazias, igual ao que o próprio Lattes exporta. Não os omita.

## 4. Escopo por marco

### Marco 0: testes de contrato (meio dia, feitos à mão com a conta do Rafael)

- [ ] Teste do arquivo mínimo (3.3, opção 1)
- [ ] Teste de sequência alta: um item com `SEQUENCIA-PRODUCAO = max + 1000`
- [ ] Segundo tipo de item: um `ARTIGO-PUBLICADO` montado a partir do XSD, para confirmar que o padrão vale além dos trabalhos em eventos
- [ ] Mínimo de `DADOS-GERAIS`: a importação precisa do `CPF` ou basta o nome

O desenho do exportador depende das duas primeiras respostas. Construa os marcos 1 e 2 em paralelo com esses testes; eles só afetam o módulo de exportação.

### Marco 1: carregar, visualizar, salvar (o caminho de leitura)

- [ ] Área de soltar arquivo que aceita `.zip` ou `.xml`; descompactar no navegador; decodificar Latin-1; converter para o modelo
- [ ] Navegação por seções espelhando o menu superior do Lattes: Dados gerais, Formação, Atuação, Projetos, Produções, Patentes e Registros, Inovação, Educação e Popularização de C&T, Eventos, Orientações, Bancas
- [ ] Renderização somente leitura de todas as seções a partir do JSON do schema, com rótulos em pt-BR para nomes de elementos e atributos (um arquivo de rótulos mantido à mão para as seções comuns, com o nome do atributo humanizado como alternativa)
- [ ] Salvamento automático da cópia de trabalho no IndexedDB a cada alteração, com um indicador "salvo" visível e um histórico dos últimos 50 estados
- [ ] "Salvar arquivo" gravando o currículo completo como `.xml`, compatível byte a byte com o original exceto pelas edições
- [ ] Teste de CI de ida e volta contra as duas fixtures sintéticas

Pronto quando Rafael conseguir carregar sua exportação, navegar por todas as seções, salvar e comparar a saída com a entrada sem nenhuma mudança inesperada.

### Marco 2: adicionar itens de produção (o caminho de escrita)

- [x] Formulários desenhados à mão para: Trabalhos publicados em anais de eventos, Artigos completos publicados, Apresentação de trabalho, Participação em eventos, Livros e capítulos. São os cinco que um aluno de mestrado usa.
- [x] Formulário genérico guiado pelo schema para todas as outras seções importáveis
- [x] Atribuição de números de sequência conforme 3.2
- [x] Gestão de autores: uma lista de coautores por documento (nome, nome para citação, `NRO-ID-CNPQ`) reaproveitada entre itens; o dono do currículo é o autor 1 por padrão
- [x] Busca de DOI no Crossref (`api.crossref.org/works/{doi}`, com CORS habilitado, enviando um parâmetro `mailto`) mapeando título, autores, ano, periódico, volume, número, páginas, ISSN, DOI e idioma para o formulário de artigo; o usuário revisa antes de salvar
- [x] "Gerar XML para importação" produzindo o arquivo descrito em 3.3, mais uma lista na tela com os passos no Lattes: Importar, escolher o arquivo, marcar só os módulos listados aqui, conferir os itens verdes, Confirmar, e nunca marcar itens vermelhos
- [x] Um selo "novos itens" por seção, para que o usuário saiba o que a próxima importação vai levar
- [x] Depois que o usuário reimportar e exportar a partir do Lattes, "Recarregar do Lattes" substitui a cópia de trabalho e limpa os marcadores de itens novos
- [x] Caminho manual para as seções não importáveis (Dados gerais, Formação, Atuação, Projetos, Patentes e Registros), adicionado em 2026-10-10:
  - Um botão "copiar" por campo, para que o usuário cole o valor no formulário correspondente do Lattes.
  - Uma lista "Alterações a enviar ao Lattes": todo campo e item que difere da exportação carregada, agrupados por seção e formulário do Lattes, com os valores antigo e novo. Ela é calculada comparando `originalXml` com a cópia de trabalho; os itens são pareados pela chave `SEQUENCIA-*`, e cada entrada pode ser descartada (volta ao valor exportado). Não existe marcação manual de "feito": a próxima exportação é a confirmação, já que uma alteração que o Lattes já tem some da lista depois de "Recarregar do Lattes".
  - A lista é primeiro uma estrutura de dados e só depois uma tela. Ela é a entrada que o conector no navegador da fase 3 vai consumir, de modo que o conector só automatiza o que essa lista já descreve.

Situação em 2026-10-11, com os testes do marco 0 deixados de lado de propósito:

- O arquivo de importação é a opção 2 de 3.3 (currículo inteiro mais os itens novos), a única forma verificada. Os passos na tela dizem ao usuário para desmarcar os itens vermelhos no Passo 3. Mude para a opção 1 só depois que o teste do arquivo mínimo passar.
- Os números de sequência são consumidos ao salvar, nunca ao abrir um formulário, então um rascunho cancelado não deixa lacuna. Remover um item novo já salvo antes da importação deixa, sim, uma lacuna entre os números novos (por exemplo, 33 removido e 34 mantido). Se o Lattes aceita o 34 quando o máximo dele é 32 é a mesma questão em aberto do teste de max + 1000.
- Os itens novos espelham a estrutura que o Lattes exporta: dados básicos e detalhamento com todos os atributos, autores sem CPF, e extras opcionais (palavras-chave, áreas do conhecimento, setores, informações adicionais) só quando preenchidos. As áreas do conhecimento ainda não podem ser editadas nos formulários.
- Os atributos `FLAG-*` começam como `NAO`, como uma caixa desmarcada no formulário do Lattes. Os outros atributos enumerados começam vazios e bloqueiam a exportação até serem escolhidos, porque o Lattes descarta itens inválidos sem mensagem. Parte do painel de validação do marco 3 já existe por esse motivo (`src/model/validate.ts`).
- Os rótulos nos formulários ainda são gerados a partir dos nomes XML, e não tirados dos formulários do Lattes.
- A requisição ao Crossref leva só o DOI. O parâmetro `mailto` sugerido acima ficou de fora porque a seção 8 não permite mais nada na rede. O país não é preenchido a partir do Crossref (nomes em inglês; o Lattes grava em português). O ISSN mantém o hífen como o Crossref o devolve; não foi verificado se o Lattes o grava com ou sem hífen.
- "Alterações a enviar ao Lattes" fica no painel "Enviar ao Lattes", ao lado do arquivo de importação. Os itens são pareados pela chave `SEQUENCIA-*` (não pela `SEQUENCIA-IMPORTANCIA`, que é a ordem de exibição), por uma chave natural para os poucos elementos repetidos que não têm uma, e pela posição como último recurso. Edições em itens de produção que já estão no Lattes também caem aqui, porque a importação nunca atualiza itens existentes. Cada alteração pode ser descartada, o que restaura o valor exportado na cópia de trabalho (`revertChange` em `src/model/changes.ts`). Uma marcação manual "feito no Lattes" foi testada e removida: a próxima exportação confirma o que o Lattes tem, e um tique pode estar errado.

Pronto quando Rafael adicionar um trabalho em evento no app, importá-lo no Lattes, exportar de novo e recarregar, e o app não mostrar nenhum item pendente. Para o caminho manual, pronto quando uma edição numa linha de Atuação aparecer na lista com seus valores antigo e novo, puder ser copiada campo a campo e sair da lista depois que "Recarregar do Lattes" trouxer uma exportação que confere.

### Marco 3: acabamento para a turma

- [ ] Tela de primeiro uso em pt-BR explicando o ciclo (exportar no Lattes, editar aqui, importar no Lattes) com as duas capturas de tela dos diálogos do Lattes
- [ ] Painel de validação: atributos obrigatórios ausentes, valores de enum inválidos, anos fora do intervalo, itens sem autor, formato do DOI
- [ ] Publicado no GitHub Pages com um README em pt-BR e em inglês

## 5. Fases posteriores, fora da v1

| Fase                  | Conteúdo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Pré-condição                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Currículo formatado   | Folha de estilo de impressão que renderiza o currículo carregado num layout limpo, com citações no estilo ABNT, e impressão para PDF pelo navegador. O próprio diálogo de impressão do Lattes (`pkg_impcv.form`) é a referência do que um currículo "Completo" contém.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Marco 1                                                         |
| Extração com LLM      | Colar um BibTeX, uma exportação do ORCID, uma página do Google Scholar ou um currículo; o modelo mapeia o conteúdo para itens do schema, que o usuário revisa. A chave é do próprio usuário, as chamadas saem do navegador e nada é armazenado.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Marco 2                                                         |
| Importação do ORCID   | `pub.orcid.org/v3.0/{orcid}/works`, pública, com CORS habilitado. Mapear as obras para artigos e trabalhos em eventos.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Marco 2                                                         |
| App de desktop        | Downloads prontos para macOS, Windows e Linux, gerados a partir do mesmo código da versão web (que continua no GitHub Pages). Empacotamento com Tauri 2: o app roda no webview do sistema, então os instaladores ficam pequenos; diálogos nativos de abrir e salvar substituem o download do navegador; atalhos no nível do app liberam ⌘1–⌘9 para as seções (uma aba do navegador fica com eles); a cópia de trabalho sai do IndexedDB e vai para um arquivo na pasta de dados do app. A CI gera os três no GitHub Actions (tauri-action) a cada tag de release. Assinatura: o macOS exige um Apple Developer ID e notarização, senão o Gatekeeper bloqueia o app; o Windows funciona sem assinatura, mas o SmartScreen mostra um aviso até que se use um certificado de assinatura de código; o Linux sai como AppImage e .deb. Atualização automática pelo atualizador do Tauri, assinada com uma chave do projeto. | Marco 3, mais uma decisão sobre pagar o Apple Developer Program |
| Conector no navegador | Userscript ou extensão que preenche os formulários biográficos com os dados do app. Os mapas de campos de Atuação e Formação estão no relatório de reconhecimento (seção 4); as gravações são POSTs simples sem token CSRF; a busca de instituição é um POST para `PRC_INST_FORM`. Precisa sobrescrever `window.alert` e `window.confirm` dentro do iframe do formulário e precisa detectar o stub `pkg_sec.logon` nas respostas, porque a sessão no servidor dura pouco. Sua entrada é a lista "Alterações a enviar ao Lattes" do marco 2. Ainda em aberto antes de construir: se `f_ctr=A` atualiza uma linha no lugar (não testado), e os mapas de campos de Idiomas, Resumo e Endereço.                                                                                                                                                                                                                            | Marco 3, e uma decisão do Rafael sobre se ele quer isso         |

## 6. O que vai dar problema

- O Lattes descarta itens em silêncio. Qualquer erro nos números de sequência, na ordem dos elementos ou no contêiner escolhido produz um Passo 3 vazio, sem erro. O painel de validação e a checagem de schema na CI existem para pegar isso antes de o usuário enviar o arquivo.
- `SEQUENCIA-PRODUCAO` é global, e não por seção. Dois itens novos em seções diferentes também precisam de números diferentes.
- O Passo 2 e o Passo 3 vêm com tudo marcado. As instruções de importação na tela importam tanto quanto o arquivo.
- O XSD está atrás da realidade. Seis atributos existem nas exportações e não no schema, e outros vão aparecer. Atributos desconhecidos são preservados, nunca rejeitados.
- Dados pessoais em `DADOS-GERAIS`: CPF, RG com órgão emissor e data, data e local de nascimento, nome dos pais, número do passaporte. O app nunca envia o documento para lugar nenhum, nunca o registra em log, nunca o coloca numa URL, e as buscas de DOI e ORCID enviam só o DOI ou o ORCID iD. Qualquer recurso futuro de "compartilhar" reduz `DADOS-GERAIS` ao nome e ao ID Lattes.
- O ZIP de exportação contém um único XML chamado `<NUMERO-IDENTIFICADOR>.xml`. Mantenha esse nome ao salvar, para que o usuário reconheça o arquivo.
- Rótulos de enum: a interface não pode mostrar `NAO_INFORMADO` ou `MEIO_DIGITAL` crus. Mantenha um mapa de rótulos; os próprios formulários do Lattes são a fonte da redação em pt-BR.
- O DTD e o XSD discordam em alguns nomes de elementos no módulo de produção técnica (`TITULARES`, códigos antigos de patente). Siga o XSD; os arquivos exportados em 2026 concordam com ele.

## 7. Estrutura do repositório

```
lattes-editor/
  schema/
    CurriculoLattes_12_09_2022.xsd        original, untouched
    CurriculoLattes_2022_patched.xsd      generated: original + ghost attributes
    LMPLCurriculo.DTD                      reference only
    patch.json                             the six attributes to add
  scripts/
    gen-schema.ts                          XSD -> src/schema/lattes.json + types
    gen-fixtures.ts                        skeleton -> fixtures/synthetic_*.xml
  src/
    schema/                                generated JSON and types
    model/                                 parse, serialize (Latin-1), sequence counter, diff
    import-export/                         zip handling, import-file builder, Lattes step checklist
    forms/                                 hand-designed forms + generic schema form
    lookups/                               crossref, orcid
    ui/                                    shell, navigation, validation panel
    labels/pt-BR.json                      element, attribute and enum labels
  fixtures/
    synthetic_full.xml
    synthetic_minimal.xml
  docs/
    lattes_product_requirements.md
    lattes_editor_reconnaissance.md
    lattes_implementation_guide.md        this file
```

## 8. Definição de pronto para a v1

- [ ] A exportação do Rafael carrega, todas as seções são renderizadas e salvar faz a ida e volta sem perdas
- [ ] Um trabalho em evento e um artigo de periódico adicionados no app são importados no Lattes sem edição manual do arquivo
- [ ] A CI valida toda fixture gerada contra o XSD corrigido e faz a ida e volta das duas fixtures sintéticas
- [ ] Nenhuma chamada de rede leva nada além de um DOI ou de um ORCID iD
- [ ] Dois colegas da turma completam o ciclo com os próprios currículos usando só as instruções da tela
