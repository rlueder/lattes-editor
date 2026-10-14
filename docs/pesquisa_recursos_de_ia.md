# Recursos de IA no editor do Lattes: pesquisa

> **Documento histórico.** Registra o que se sabia e se decidiu na data dele, e
> vale pelo porquê; parte já não descreve o editor. O editor como ele é hoje
> está em [`arquitetura.md`](arquitetura.md); o índice de tudo, em
> [`README.md`](README.md).

Data: 11/10/2026. Público: quem decide o que entra no editor depois do marco 2,
e pesquisadores que querem saber o que o editor faria com o currículo deles.

Este documento propõe recursos de revisão e preenchimento assistidos para o
editor. Boa parte do que costuma ser vendido como "IA" aqui se resolve com
regras determinísticas e consultas a bases bibliográficas abertas, e o texto
diz isso caso a caso. Onde um modelo de linguagem ajuda de fato, o documento
diz exatamente o que sairia do computador e o que o usuário confere antes de
qualquer mudança.

Cada número sobre APIs, preços, tamanhos de modelo e navegadores vem de uma
página oficial aberta em 11/10/2026 (seção 8) ou de uma requisição feita
naquele dia e descrita no texto. O que não foi possível confirmar aparece como
**não confirmado**.

## 1. Contexto

### O que o editor faz hoje

O editor carrega a exportação do Lattes (`CV_<id>.zip` ou o `.xml`), mantém a
cópia de trabalho no IndexedDB e grava dois arquivos: o currículo completo e o
`<id>-importacao.xml` que o Importar do Lattes aceita. Não há servidor nem
conta. As partes que importam para esta pesquisa:

- `src/model/validate.ts` valida um item novo antes da exportação: enums
  inválidos, obrigatórios vazios, ano fora de 1900 até o ano atual mais 5,
  título e ano vazios, item sem autor, ID Lattes de coautor que não tem 16
  dígitos e DOI fora do formato `10.xxxx/…`. A validação roda por item, no
  formulário. Não existe ainda uma passada sobre o currículo inteiro.
- `src/lookups/crossref.ts` busca um DOI em `api.crossref.org/works/{doi}` e
  preenche título, autores, ano, periódico, volume, fascículo, páginas, ISSN,
  ISBN, editora e idioma num item novo. A requisição leva só o DOI, sem o
  parâmetro `mailto`. Os autores devolvidos são trocados pelos coautores já
  conhecidos quando o nome normalizado bate (`crossrefAuthors`).
- `src/model/changes.ts` calcula a lista "Alterações a enviar ao Lattes": a
  diferença entre a exportação carregada (`originalXml`) e a cópia de
  trabalho, com valor antigo e novo por campo, e permite descartar cada
  mudança (`revertChange`, `revertField`).
- `src/model/mojibake.ts` conserta dois defeitos que o próprio Lattes grava
  (UTF-8 lido como Latin-1, como em "EndereÃ§o", e entidades escapadas duas
  vezes). Hoje o conserto é oferecido campo a campo, em `AttributeField.tsx`,
  quando a pessoa abre o campo.
- As áreas do conhecimento de um item novo (até 3) são editadas em
  `AreasEditor.tsx`. A grande área vem do enum do XSD. Área, subárea e
  especialidade são texto livre, com atalhos para as combinações que o
  currículo já usa. O editor não tem a tabela oficial de áreas.

### Restrições que já valem

O `AGENTS.md` e a seção 8 do guia de implementação fixam uma regra: nenhuma
chamada de rede leva nada além de um DOI ou de um ORCID iD. Vários recursos
deste documento quebram essa regra (a busca de DOI por título manda o título e
os sobrenomes dos autores, por exemplo). Cada um deles precisa de uma decisão
explícita do mantenedor e de uma mudança no `AGENTS.md` e no guia, não de um
desvio silencioso.

Outro fato limita o alcance de qualquer correção: o Importar do Lattes só
insere itens novos e nunca altera os que já estão lá (guia, seção 3.1). Quando
a revisão encontra um ano errado ou um DOI faltando num artigo que já está no
Lattes, a correção vai para a lista "Alterações a enviar ao Lattes" e o usuário
a copia à mão no formulário do Lattes. O ganho é real, porque o editor diz o
que corrigir e com qual valor, mas não é automático.

### Quem usa

O público da v1 é o Rafael e a turma do primeiro ano do mestrado dele. Para um
mestrando, o currículo tem poucas dezenas de itens: alguns trabalhos em
eventos, apresentações, participação em eventos, talvez um artigo. Um docente
com vinte anos de carreira tem centenas, com o histórico de grafias
inconsistentes que o Lattes acumula. Os dois perfis aparecem no ranking.

## 2. Ideias

### 2.1 Ranking

Valor é o ganho para um pós-graduando ou pesquisador brasileiro. Custo é o
esforço de construção num projeto de um mantenedor. Risco junta privacidade,
chance de dado errado entrar no currículo e dependência de terceiros. A coluna
"Modelo?" diz se o recurso precisa de um modelo de linguagem. "Não" quer dizer
regra determinística ou consulta a uma API bibliográfica.

| #   | Ideia                                                        | Valor | Custo       | Risco | Modelo?                        |
| --- | ------------------------------------------------------------ | ----- | ----------- | ----- | ------------------------------ |
| 1   | Revisão de consistência do currículo inteiro                 | Alto  | Baixo       | Baixo | Não                            |
| 2   | Busca de DOI para itens que não têm                          | Alto  | Médio       | Médio | Não                            |
| 3   | Conferência dos itens com DOI contra o registro              | Alto  | Baixo       | Baixo | Não                            |
| 4   | Item novo a partir de citação colada ou lista de DOIs        | Alto  | Médio       | Médio | Só como último recurso         |
| 5   | Coautores ligados ao ID Lattes e ao ORCID                    | Médio | Médio       | Médio | Não                            |
| 6   | Tradução dos títulos para os campos em inglês                | Médio | Baixo       | Baixo | Sim (local ou chave própria)   |
| 7   | Sugestão de áreas do conhecimento                            | Médio | Médio       | Baixo | Opcional (vocabulário fechado) |
| 8   | Resumo do que mudou desde a última exportação                | Médio | Baixo       | Baixo | Não                            |
| 9   | Item novo a partir de um PDF                                 | Médio | Médio, alto | Médio | Só como último recurso         |
| 10  | Sugestão de palavras-chave                                   | Baixo | Baixo       | Baixo | Sim                            |
| 11  | Rascunho do texto do resumo do currículo                     | Baixo | Médio       | Alto  | Sim                            |
| 12  | Agente de revisão com modelo, sobre os casos que sobram do 1 | Baixo | Alto        | Alto  | Sim                            |

Os três primeiros não usam modelo nenhum e cobrem quase todos os exemplos que
motivaram a pesquisa (duplicatas, ano que não bate com o DOI, autor grafado de
várias formas, periódico sem ISSN, mojibake, áreas faltando). O agente com
modelo ficou em último porque, depois das regras, sobra pouco para ele fazer.

### 2.2 Revisão de consistência (sem modelo)

Uma passada sobre o currículo inteiro, sob demanda, que produz uma lista de
achados agrupados por seção. Cada achado aponta o item, diz o que está
estranho e, quando existe uma correção segura, oferece aplicá-la. Reaproveita
o formato `Problem` de `validate.ts` (elemento, atributo, mensagem) com um
campo a mais para a gravidade ("erro" bloqueia o arquivo de importação,
"aviso" só informa).

As regras, todas determinísticas:

- **Produção duplicada.** Mesmo DOI em dois itens é duplicata certa. Sem DOI, o
  candidato é o par com o mesmo tipo de item, o mesmo ano e o título igual
  depois de normalizado (`fold` de `labels.ts`, sem pontuação, espaços
  colapsados). Título parecido mas não igual entra como aviso, com a
  similaridade mostrada. O caso clássico é o mesmo trabalho registrado como
  "Trabalho em evento" e como "Apresentação de trabalho", que pode ser
  legítimo: vira aviso, não erro.
- **Ano incoerente.** Ano no futuro em "Artigos publicados" é erro. Um item
  em "Artigos aceitos para publicação" com ano de dois ou mais anos atrás
  provavelmente já saiu e deveria ter sido movido. A conferência do ano contra
  o registro do DOI está na seção 2.4.
- **Autor grafado de várias formas.** O currículo inteiro já tem a lista de
  coautores (`AUTORES` em todos os itens). Agrupar por `NRO-ID-CNPQ` e mostrar
  quando o mesmo ID aparece com `NOME-PARA-CITACAO` diferentes resolve a maior
  parte. Sem ID, agrupar por sobrenome normalizado mais iniciais e mostrar os
  grupos com mais de uma grafia. O dono do currículo é um caso especial: o
  `NUMERO-IDENTIFICADOR` da raiz deveria aparecer como `NRO-ID-CNPQ` de um dos
  autores em toda produção dele. Quando não aparece, o Lattes não liga o item
  ao autor.
- **Periódico sem ISSN, ou com ISSN inválido.** Campo vazio é uma checagem
  trivial. O oitavo dígito do ISSN é verificador, calculado por módulo 11 sobre
  os sete anteriores, e pode ser "X" quando o resultado é 10 (ISSN
  International Centre). Isso pega erro de digitação sem rede. Para preencher
  o ISSN que falta, a busca do mesmo periódico em outros itens do próprio
  currículo resolve muitos casos. Em seguida vêm `api.crossref.org/journals/{issn}`
  e `api.openalex.org/sources/issn:{issn}` para confirmar o título, consultas
  que em 11/10/2026 devolveram "Nature" com os dois ISSNs para `0028-0836`.
  Achar o ISSN a partir só do nome do periódico é uma busca por texto, que
  cai nas regras de etiqueta da seção 5.
- **O mesmo evento com nomes diferentes.** Agrupar `NOME-DO-EVENTO` por ano e
  por nome normalizado, e depois por similaridade de tokens (sem números
  ordinais, sem "Anais do"). Exemplo: "XV Congresso Brasileiro de Design" e
  "15º CBD" não se juntam por regra simples, e aí um modelo de embeddings local
  poderia ajudar (seção 3.1). Na primeira versão, só os agrupamentos por regra.
- **Mojibake.** `repairMojibake` já existe. Falta rodar sobre todos os
  atributos do documento e listar os campos com conserto disponível, com um
  botão "consertar todos" que passa pela lista de alterações como qualquer
  outra edição.
- **Formações com período sobreposto.** Duas formações do mesmo nível (dois
  mestrados, por exemplo) com intervalos de anos que se cruzam viram aviso.
  Níveis diferentes se cruzando é comum (especialização durante o mestrado,
  doutorado sanduíche) e não deve ser apontado. Formação concluída sem ano de
  conclusão, ou com conclusão antes do início, é erro.
- **Áreas do conhecimento faltando.** Item de produção sem
  `AREAS-DO-CONHECIMENTO` é uma checagem trivial. A sugestão do que preencher
  está na seção 2.8.
- **O que `validate.ts` já faz, aplicado a tudo.** Hoje a validação roda só no
  item aberto no formulário. Rodar `validateItem` em todos os itens novos de
  uma vez é o que o painel de validação do marco 3 já previa.

Custo baixo: tudo isso é código sobre o modelo XML que já existe, testável com
as fixtures sintéticas. Nenhum byte sai da máquina, exceto as consultas de
ISSN, que mandam só o ISSN.

### 2.3 Busca de DOI para itens que não têm (sem modelo)

Para cada artigo, trabalho em evento, livro ou capítulo sem DOI, o editor
procura candidatos e mostra os melhores ao lado do item. O usuário escolhe um
ou descarta.

O desenho segue o que a própria Crossref descreveu para ligar preprints a
artigos (Tkaczyk, 2023): os candidatos vêm do parâmetro `query.bibliographic`
da API REST, com o título e os sobrenomes dos autores concatenados. Cada
candidato recebe notas independentes para título (comparação aproximada),
autores (por ORCID ou nome) e ano (dentro de uma janela), e a nota final é a
média. A decisão usa dois parâmetros: uma nota mínima e uma diferença máxima
para o primeiro colocado. Um candidato que empata com outro não é sugerido como
certo.

Detalhes para o editor:

- **Filtro por tipo.** Um `ARTIGO-PUBLICADO` só aceita `journal-article`; um
  `TRABALHO-EM-EVENTOS` só `proceedings-article`. O mapeamento inverso já
  existe em `itemNameFor`.
- **Nota mínima.** A Crossref não publica um limiar universal para o `score`
  que a busca devolve. O jeito honesto é calibrar com um conjunto rotulado (o
  currículo real do Rafael, localmente) e preferir precisão a cobertura: um
  DOI errado num currículo é pior que um DOI faltando.
- **Fallback no OpenAlex.** Quando a Crossref não traz candidato bom, o
  OpenAlex pode ter o trabalho por outra via. A busca lá custa mais (seção 5),
  então ela vem depois e só para os itens que sobraram.
- **Cobertura esperada.** Anais de eventos brasileiros sem DOI não vão
  aparecer em lugar nenhum. A fração de itens de um currículo típico que tem
  DOI registrado é **não confirmada**; o teste com o currículo real responde.
- **O que sai da máquina.** O título do item, os sobrenomes dos autores e o
  ano. Títulos de produção são públicos no Lattes, mas nomes de coautores são
  dados de terceiros, e isso quebra a regra atual do `AGENTS.md`. Por isso a
  busca é ligada pelo usuário, com a lista do que será enviado à vista.

O DOI escolhido entra no item como qualquer edição. Para item novo, vai no
arquivo de importação. Para item que já está no Lattes, aparece em
"Alterações a enviar ao Lattes" com valor antigo vazio e valor novo, para o
usuário colar no formulário do Lattes.

### 2.4 Conferência dos itens com DOI (sem modelo)

Para todo item que já tem DOI, buscar o registro em `/works/{doi}` (a
consulta que o editor já faz) e comparar campo a campo: ano, título, periódico,
volume, páginas, ISSN, número de autores. Diferença no ano é o caso mais comum
e o mais fácil de explicar: o registro tem datas de publicação impressa e
online, e o item no Lattes pode ter uma ou outra. Diferença de um ano vira
aviso com as duas datas. Diferença maior, ou título que não se parece com o do
registro, sugere DOI colado no item errado.

Custo baixo, porque `fetchCrossref` já existe. A requisição continua levando
só o DOI. Um currículo com 40 DOIs leva uns 8 segundos no limite público de 5
consultas por segundo.

Um DOI que a Crossref não conhece (404) pode ter sido registrado por outra
agência de registro de DOI. Como tratar esses casos está em aberto (seção 7).

### 2.5 Item novo a partir de citação colada ou lista de DOIs

A pessoa cola uma referência no formato ABNT, APA ou o que vier, ou uma lista
de DOIs, e o editor monta os itens.

A ordem de tentativas importa:

1. **DOI no texto.** `normalizeDoi` já extrai um DOI de qualquer string. Se
   houver, a busca por DOI resolve tudo e nenhum modelo é necessário. Uma
   lista de DOIs, um por linha, é a "operação em lote" que os requisitos de
   produto já pediam.
2. **Busca da citação inteira.** `query.bibliographic` existe para isso:
   recebe a referência como texto livre. Um candidato com nota alta e do tipo
   certo vira o item, com os dados do registro, não os da citação colada.
3. **Modelo de linguagem, só no fim.** Para o que não tem DOI (anais de evento
   nacional, capítulo de livro de editora pequena), um modelo separa a citação
   nos campos do Lattes. Esse item sai marcado como "não verificado", com cada
   campo vindo do texto colado e nenhum vindo do conhecimento do modelo (seção
   5). O que sai da máquina é só a citação que a pessoa colou.

BibTeX e RIS têm formato fixo e se resolvem com um parser, sem modelo. Exigem
uma dependência nova ou código próprio, e o `AGENTS.md` pede aprovação antes
de qualquer dependência de execução.

### 2.6 Coautores ligados ao ID Lattes e ao ORCID

Duas fontes que não precisam de modelo:

- **O próprio currículo.** Um coautor que aparece com `NRO-ID-CNPQ` num item e
  sem ID em outro, com o mesmo nome normalizado, recebe a sugestão do ID que
  já está no arquivo. É a mesma lógica de `crossrefAuthors`, aplicada ao
  documento inteiro.
- **O registro do DOI.** A Crossref devolve o ORCID dos autores quando o
  editor o depositou. O Lattes guarda `ORCID-ID` só em `DADOS-GERAIS`, não nos
  autores de cada item, então o ORCID de um coautor serve para desempatar
  grafias, não para ser gravado.

Para um ID Lattes que não está no currículo não existe fonte aberta. O
Extrator Lattes exige credenciamento institucional e proíbe uso comercial
(requisitos de produto, seção 4), e a busca pública de currículos do CNPq não é
uma API. O editor não deve tentar.

A busca por nome no ORCID (`pub.orcid.org/v3.0/expanded-search/`) devolve
iD, nomes, instituição e, às vezes, e-mail. Em 11/10/2026 ela respondeu sem
token a uma consulta de teste, embora o tutorial oficial diga que a busca pede
um token `/read-public`. A busca manda o nome de um terceiro para fora e devolve
dados pessoais de outras pessoas, então fica fora da primeira entrega.

### 2.7 Tradução dos títulos para os campos em inglês

Quase todo item do Lattes tem um campo `-INGLES` (`TITULO-DO-TRABALHO-INGLES`,
`NOME-DO-EVENTO-INGLES`) que a maioria deixa vazio. Traduzir títulos é uma
tarefa curta, de baixo risco de invenção (o texto de origem está ali) e fácil
de conferir.

A opção mais barata e mais privada é a Translator API do Chrome: disponível a
partir do Chrome 138 no desktop, com português (`pt`) e inglês (`en`) na
lista de idiomas, e com um modelo baixado na primeira vez que um site a usa. A
documentação fala em "modelos locais de IA" mas não afirma, com essas
palavras, que o texto nunca sai do aparelho. Firefox e Safari não têm a API,
e ela não funciona no celular. Fora do Chrome, a tradução usa a chave do
próprio usuário (seção 3.2).

Os títulos traduzidos entram como sugestão, campo a campo, e a pessoa aceita
ou edita.

### 2.8 Sugestão de áreas do conhecimento

A grande área é um enum fechado do XSD. Área, subárea e especialidade são
texto livre no Lattes, mas os valores seguem a Tabela de Áreas do
Conhecimento que a CAPES publica (um `.doc` de uns 2 MB, publicado na web em
24/10/2022). Com a tabela convertida para JSON e embutida no editor, a
sugestão vira escolha num vocabulário fechado, e o modelo não tem como
inventar uma área que não existe.

Do jeito mais simples, sem modelo, o editor sugere as áreas que o próprio
currículo já usa, ordenadas pela frequência nos itens do mesmo tipo e do mesmo
evento ou periódico. Um modelo de embeddings local (seção 3.1) compara o
título do item com os nomes da tabela e propõe as três mais próximas. Um
modelo generativo com chave própria escolhe da lista. As três saídas passam
pelo mesmo crivo: só valores que existem na tabela.

Pendências: a licença de redistribuição da tabela dentro de um app MIT é
**não confirmada**, e a correspondência exata entre a tabela da CAPES e os
valores que o Lattes grava não foi conferida contra uma exportação.

### 2.9 Resumo do que mudou desde a última exportação

Já existe, sem modelo: é a lista de `changes.ts`. O que falta é comparar duas
exportações do Lattes entre si (a de março e a de outubro, por exemplo), o
que `diffDocuments` faz se receber as duas. Um texto corrido gerado por modelo
("você acrescentou três trabalhos em eventos…") não acrescenta informação à
lista e exigiria mandar o diff para fora. Fica de fora.

### 2.10 Item novo a partir de um PDF

Ler o PDF no navegador pede o pdf.js ou equivalente, uma dependência de peso
que precisa de aprovação. O caminho seguro é extrair o texto da primeira
página, procurar um DOI por expressão regular e cair na busca por DOI. Sem
DOI, o texto da primeira página vai para a busca bibliográfica, e só então
para um modelo. O PDF de um artigo pode conter dados que o autor não quer
mandar para fora (e-mails, afiliações), então o envio a um modelo mostra o
trecho exato antes.

### 2.11 Palavras-chave

O Lattes aceita até seis palavras-chave por item. Um modelo sugere a partir do
título com facilidade, mas o valor para o pesquisador é baixo: as
palavras-chave quase não aparecem nas avaliações e ninguém reclama da falta
delas. Pode entrar junto com a tradução, usando a mesma chave, se a tradução
existir.

### 2.12 Rascunho do resumo do currículo

O `TEXTO-RESUMO-CV-RH` tem até 4000 caracteres (formulário `RES`, ver
`lattes_internals.md`) e não passa pelo Importar. Um modelo escreve um
rascunho a partir de formação, atuação e títulos das produções. O risco é
alto: o resumo afirma coisas sobre a pessoa, e um modelo tende a enfeitar
(um "especialista em" que não aparece em lugar nenhum do currículo). Também
é o recurso que mais exige dados biográficos na entrada. Se um dia entrar, cada
frase do rascunho precisa apontar o item do currículo que a sustenta, e
frases sem item de apoio são cortadas antes de chegar à tela.

### 2.13 Agente de revisão com modelo

A ideia original era um agente que lê o currículo inteiro e aponta
inconsistências. Depois das regras da seção 2.2 e das consultas das seções
2.3 e 2.4, sobram casos difusos: o mesmo evento com nomes muito diferentes,
uma apresentação que é na verdade o mesmo trabalho publicado nos anais. Para
eles, mandar o currículo a um modelo custa privacidade e a precisão é **não
confirmada**. Um modelo de embeddings local resolve parte disso sem rede. O
agente fica para depois de medir quanto sobra sem ele.

## 3. Arquitetura

### 3.1 Modelos no navegador

**Chrome built-in AI.** O Chrome oferece APIs sobre modelos que ele mesmo
baixa e gerencia. Situação em 11/10/2026, pela tabela oficial:

| API                   | Web             | Extensões       |
| --------------------- | --------------- | --------------- |
| Translator API        | Chrome 138      | Chrome 138      |
| Language Detector API | Chrome 138      | Chrome 138      |
| Summarizer API        | Chrome 138      | Chrome 138      |
| Prompt API            | Chrome 148      | Chrome 138      |
| Writer, Rewriter      | Developer trial | Developer trial |
| Proofreader API       | Developer trial | Developer trial |

A Prompt API e a Summarizer API usam o Gemini Nano e aceitam inglês,
japonês, espanhol, alemão e francês. **Português não está na lista**, e a
documentação diz só que outros idiomas estão em desenvolvimento. Para o
editor, isso tira a Prompt API de qualquer tarefa sobre texto acadêmico em
pt-BR por enquanto. Os requisitos de máquina também excluem muitos notebooks
de estudante: pelo menos 22 GB livres no volume do perfil do Chrome, e GPU com
mais de 4 GB de VRAM ou CPU com 16 GB de RAM e 4 núcleos. Windows 10 ou 11,
macOS 13 ou mais novo, Linux e Chromebook Plus; nada de Android ou iOS. O
tamanho do download do Gemini Nano não é publicado (a página diz que é bem
menor que os 22 GB e manda conferir em `chrome://on-device-internals`).

A Translator API é a exceção útil: tem português, está no Chrome estável desde
a versão 138 e serve à seção 2.7.

**WebLLM.** Roda modelos abertos no navegador com WebGPU e expõe uma API
compatível com a da OpenAI. A configuração de modelos prontos do projeto traz
a memória de vídeo exigida por modelo, por exemplo:

| Modelo (quantização q4f16_1) | VRAM exigida |
| ---------------------------- | ------------ |
| gemma-2-2b-it                | 1.895 MB     |
| Qwen3-1.7B                   | 2.037 MB     |
| Llama-3.2-3B-Instruct        | 2.264 MB     |
| Qwen3-4B                     | 3.432 MB     |
| Llama-3.1-8B-Instruct        | 5.001 MB     |
| Qwen3-8B                     | 5.696 MB     |

O tamanho do download de cada modelo é **não confirmado** (a configuração
traz VRAM, não bytes). A qualidade desses modelos em texto acadêmico em pt-BR
é **não confirmada**: não achei avaliação publicada nesse recorte. O WebGPU
está no Chrome e no Edge desde a versão 113 e no Safari do iOS 26; o caniuse
marca o Safari do macOS como suporte parcial e o Firefox como desativado por
padrão.

**transformers.js.** Roda modelos do Hugging Face no navegador com ONNX
Runtime, em CPU (WebAssembly, o padrão) ou em GPU (WebGPU, que a própria
documentação chama de experimental em muitos navegadores). Serve para tarefas
menores que geração de texto livre: embeddings, classificação sem treino,
tradução. O `Xenova/multilingual-e5-small`, um modelo de embeddings
multilíngue, tem 118 MB na versão quantizada para int8, pelo que o Hugging Face
listava em 11/10/2026. É o candidato para agrupar eventos parecidos (seção 2.2)
e sugerir áreas (seção 2.8) sem rede.

Uma restrição do próprio editor pesa aqui: o build precisa funcionar a partir
de `file://`, com tudo embutido no `index.html` e sem divisão de código
(`AGENTS.md`). Pesos de 100 MB a vários GB não cabem nesse arquivo. Eles
teriam de ser baixados sob demanda de um CDN, o que muda o modelo de
distribuição e precisa ser decidido (seção 7). A Translator API do Chrome não
tem esse problema, porque quem baixa o modelo é o navegador.

### 3.2 Chave própria do usuário (BYOK)

O usuário cola a chave de um provedor e o navegador chama a API direto, sem
intermediário. Em 11/10/2026, uma requisição de preflight CORS feita com
`curl` a partir de uma origem qualquer recebeu permissão dos três provedores:

| Provedor  | Endpoint testado                                             | Observação                                                                                             |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Anthropic | `api.anthropic.com/v1/messages`                              | Exige o cabeçalho `anthropic-dangerous-direct-browser-access: true`; no SDK, `dangerouslyAllowBrowser` |
| OpenAI    | `api.openai.com/v1/responses` e `/chat/completions`          | No SDK, `dangerouslyAllowBrowser`                                                                      |
| Gemini    | `generativelanguage.googleapis.com/v1beta/…:generateContent` | Aceitou `content-type` e `x-goog-api-key` como cabeçalhos                                              |

Os nomes "dangerous" se referem a embutir a chave do desenvolvedor no código
do site, que qualquer visitante copiaria. No modelo BYOK a chave é do próprio
usuário, e o risco que sobra é outro: um script malicioso na página leria a
chave. O editor não carrega script de terceiros, o que ajuda, e a chave deve
ficar só na memória da aba por padrão, com a opção explícita de guardá-la no
IndexedDB.

Preço por milhão de tokens nas páginas oficiais em 11/10/2026, nos modelos
mais baratos de cada um (entrada / saída, em dólares):

| Modelo                                          | Entrada | Saída |
| ----------------------------------------------- | ------- | ----- |
| Claude Haiku 5.5 (até 100 mil tokens de prompt) | 0,10    | 0,50  |
| Claude Haiku 4.5                                | 1,00    | 5,00  |
| gpt-5-nano                                      | 0,05    | 0,40  |
| gpt-5-mini                                      | 0,25    | 2,00  |
| gemini-2.5-flash-lite                           | 0,10    | 0,40  |
| gemini-2.5-flash                                | 0,30    | 2,50  |

Para ter ordem de grandeza: traduzir 100 títulos, com uns 5 mil tokens de
entrada e 5 mil de saída somando instruções, custaria cerca de US$ 0,003 no
Claude Haiku 5.5 e US$ 0,0025 no gemini-2.5-flash-lite. É uma estimativa de
tokens, não uma medição. Modelos que raciocinam antes de responder podem cobrar
tokens de saída a mais, e quanto isso pesa nessas tarefas é **não confirmado**.

O Gemini tem cota gratuita, mas os termos da API dizem, para os serviços não
pagos, que o Google usa o conteúdo para melhorar produtos, que revisores
humanos podem ler entradas e saídas, e pedem para não enviar informação
pessoal. O editor não tem como saber se a chave é gratuita ou paga, então
avisa antes do primeiro envio. Nos serviços pagos do Gemini, na API da OpenAI
e na API da Anthropic, as entradas não são usadas para treino por padrão. A
OpenAI guarda logs de monitoramento de abuso por até 30 dias. A Anthropic
apaga entradas e saídas da API em até 30 dias, com exceções (uso de violação
da política, exigência legal, acordo específico).

Sobre qualidade em pt-BR: a Anthropic publica o desempenho em MMLU traduzido
por profissionais, relativo ao inglês, e o português do Brasil aparece com
96,1% no Claude Haiku 4.5. MMLU mede conhecimento geral, não separar campos de
uma citação ou traduzir título de artigo. Números comparáveis para os modelos
da OpenAI e do Google nesse recorte são **não confirmados**.

### 3.3 App de desktop com Tauri e modelos locais

O guia já prevê um app de desktop com Tauri 2 (fase posterior). Ele abre a
porta para modelos locais via Ollama ou llama.cpp, que rodam fora do navegador
e não dependem de WebGPU nem do suporte do Chrome a português.

- O Ollama escuta em `127.0.0.1:11434` e, por padrão, aceita requisições de
  outras origens só de `127.0.0.1` e `0.0.0.0`. Outras origens se acrescentam
  com `OLLAMA_ORIGINS`. Se a origem do webview do Tauri passa sem
  configuração é **não confirmado**.
- O plugin HTTP do Tauri faz requisições pelo lado Rust (`reqwest`), com uma
  lista de URLs permitidas na configuração de capacidades. A documentação não
  diz se isso contorna o CORS do webview, embora seja o efeito esperado de
  uma requisição feita fora do navegador; **não confirmado**.
- Tamanhos de download na biblioteca do Ollama: `qwen3:4b` com 2,5 GB,
  `qwen3:8b` com 5,2 GB e `qwen3:14b` com 9,3 GB. A qualidade em pt-BR
  acadêmico é **não confirmada**.
- O usuário instala o Ollama à parte e escolhe o modelo. O app não distribui
  pesos.

A versão web, no GitHub Pages, também poderia falar com um Ollama local se o
usuário configurar `OLLAMA_ORIGINS` com a origem do site. Se as restrições
dos navegadores a uma página pública chamando `localhost` deixam isso passar é
**não confirmado**, e a experiência de configurar uma variável de ambiente não
serve à turma do mestrado.

### 3.4 Servidor intermediário hospedado

Um servidor do projeto que recebe o pedido, chama o modelo com uma chave do
projeto e devolve a resposta. Resolve a chave (ninguém precisa criar conta num
provedor) e permite cobrar. Contradiz o produto: o README promete que o
arquivo nunca sai do computador e que não há servidor nem conta, e o guia
escolheu esse desenho justamente porque CPF, RG e nome dos pais nunca saem da
máquina. Com um servidor, o projeto passa a tratar dados pessoais de terceiros
e assume as obrigações da LGPD que hoje não tem, além do custo de cada chamada
e de um alvo para abuso. Não recomendado.

### 3.5 Comparação

| Opção                 | Custo para o usuário           | pt-BR                                           | Download                                 | Navegadores                 | Dados saem da máquina            |
| --------------------- | ------------------------------ | ----------------------------------------------- | ---------------------------------------- | --------------------------- | -------------------------------- |
| Chrome Translator API | Zero                           | Sim (`pt`)                                      | Feito pelo Chrome, tamanho não publicado | Chrome 138+ no desktop      | Não declarado pela documentação  |
| Chrome Prompt API     | Zero                           | Não (en, ja, es, de, fr)                        | Não publicado; exige 22 GB livres        | Chrome 148+ na web, desktop | Não declarado                    |
| WebLLM                | Zero                           | Não confirmado                                  | VRAM de 1,9 GB a 5,7 GB nos exemplos     | Precisa de WebGPU           | Não                              |
| transformers.js       | Zero                           | Embeddings multilíngues; geração não confirmada | 118 MB (e5-small int8)                   | Qualquer um com WebAssembly | Não                              |
| Chave própria         | Frações de centavo por tarefa  | 96,1% do inglês no Haiku 4.5 (MMLU)             | Nenhum                                   | Todos                       | Sim, para o provedor             |
| Tauri com Ollama      | Zero, mais a máquina           | Não confirmado                                  | 2,5 GB a 9,3 GB (qwen3)                  | Não se aplica               | Não                              |
| Servidor hospedado    | Assinatura ou custo do projeto | Igual ao provedor                               | Nenhum                                   | Todos                       | Sim, para o projeto e o provedor |

A recomendação é em camadas: regras e APIs bibliográficas para tudo que der;
Translator API do Chrome para tradução quando existir; chave própria, opcional
e desligada por padrão, para o que sobrar; modelos locais quando o app de
desktop existir.

## 4. Privacidade e LGPD

### 4.1 O que o arquivo tem

A exportação do Lattes traz, em `DADOS-GERAIS`, `CPF`, `NUMERO-IDENTIDADE`,
`NUMERO-DO-PASSAPORTE`, `DATA-NASCIMENTO`, `CIDADE-NASCIMENTO`,
`UF-NASCIMENTO`, `NOME-DO-PAI`, `NOME-DA-MAE`, `SEXO`, `RACA-OU-COR` e `PCD`,
além do endereço e do e-mail. Fora de `DADOS-GERAIS` também há dado de
terceiros: os nomes e IDs Lattes dos coautores e os atributos
`CPF-DO-PARTICIPANTE-DA-BANCA` e
`CPF-DO-PARTICIPANTE-PARTICIPANTE-DE-EVENTOS-CONGRESSOS`, que o XSD define.

A LGPD (Lei 13.709/2018, art. 5º, II) chama de dado pessoal sensível o dado
sobre origem racial ou étnica e o dado referente à saúde, entre outros. Raça
ou cor e deficiência estão no arquivo.

### 4.2 Quem é o controlador

O art. 4º, I, exclui da LGPD o tratamento "realizado por pessoa natural para
fins exclusivamente particulares e não econômicos". Um pesquisador editando o
próprio currículo no próprio computador está, à primeira vista, nesse caso, e
o projeto não trata dado nenhum, porque não recebe nada. Quando o pesquisador
manda trechos do currículo a um provedor de modelo, quem trata esses dados no
outro lado é o provedor, nos termos dele. Os dados de coautores são de
terceiros, e o envio a um provedor no exterior é o tipo de operação que o art.
33 regula (uma das hipóteses é o consentimento específico e em destaque do
titular, inciso VIII). Este documento não é parecer jurídico. A conclusão
prática é desenhar como se a lei se aplicasse: mandar o mínimo, avisar com
clareza e nunca mandar dados de terceiros sem necessidade.

### 4.3 Regras para qualquer recurso que use rede

1. **Desligado por padrão.** Cada recurso que manda algo além de um DOI, um
   ISSN ou um ORCID iD é ligado pelo usuário, um por um, e o editor lembra a
   escolha.
2. **Lista de permissão, não de bloqueio.** O que vai para fora é montado a
   partir de uma lista fechada de atributos por tarefa. Tradução de títulos
   manda só o título. Busca de DOI manda título, sobrenomes e ano. Nada de
   `DADOS-GERAIS` entra em payload nenhum, nem o nome do dono do currículo:
   quando a tarefa precisa saber qual autor é o dono, ele vira um marcador
   ("AUTOR_1"). Um atributo novo que o CNPq acrescente no futuro fica de fora
   até alguém o pôr na lista.
3. **Pré-visualização do envio.** Antes do primeiro envio de cada tipo, a
   tela mostra o texto exato que vai sair, o destino (domínio) e a política
   de retenção do provedor, com um link. A pessoa confirma.
4. **Registro local.** O editor guarda, só no IndexedDB, quando cada envio
   foi feito, para onde e quais itens envolveu (não o conteúdo). A pessoa
   consegue ver e apagar esse registro.
5. **Chave na memória.** A chave de API fica na memória da aba e some ao
   fechar, salvo se a pessoa pedir para guardar.
6. **Nada em URL nem em log.** Vale a regra do `AGENTS.md`. O payload vai no
   corpo da requisição, nunca na URL, com uma exceção inevitável: as buscas da
   Crossref e do OpenAlex são `GET` com a consulta na URL. Isso precisa
   constar no aviso de envio.
7. **E-mail para a Crossref.** O pool "polite" da Crossref pede um e-mail no
   parâmetro `mailto`. O e-mail do usuário é dado pessoal, então ele só vai se
   a pessoa digitar um e-mail para isso. Sem ele, o editor respeita os
   limites do pool público.
8. **Cota gratuita do Gemini.** Aviso explícito de que os termos pedem para
   não enviar informação pessoal à cota gratuita.

## 5. Verificação e confiança

### 5.1 O modelo não é fonte

Nenhum DOI, ISSN, ano, nome de periódico ou coautor entra no currículo
porque um modelo disse. O modelo pode fazer duas coisas: reorganizar texto que
o usuário forneceu (separar uma citação em campos, traduzir um título) e
escolher numa lista fechada (áreas da tabela da CAPES). Para os dois casos
existe uma checagem mecânica:

- **Campos extraídos de uma citação** têm de aparecer no texto colado. Um ano
  que não está na citação, um DOI que não está na citação, é descartado. O
  item sai marcado "não verificado" até uma busca bibliográfica confirmar.
- **DOI, ISSN e periódico** só são aceitos depois de uma consulta à Crossref
  ou ao OpenAlex que devolva o registro. O ISSN passa também pelo dígito
  verificador.
- **Escolhas em vocabulário fechado** são conferidas contra a lista. Valor
  fora dela é descartado sem chegar à tela.
- **Coautores** nunca são criados por um modelo. Eles vêm do texto colado, do
  registro do DOI ou do próprio currículo.

### 5.2 Toda mudança passa pelo usuário

Cada sugestão aparece com origem e estado: "verificado no Crossref em
11/10/2026, DOI 10.…", "verificado no OpenAlex", "da tabela da CAPES", "não
verificado". O usuário aceita ou recusa uma por uma, ou aceita em lote as
verificadas. Nada é aplicado em silêncio.

Ao aceitar, a sugestão vira uma edição comum na cópia de trabalho. Daí em
diante ela aparece onde o editor já mostra mudanças: o selo de item novo e o
arquivo de importação, para produção nova, e a lista "Alterações a levar ao
Lattes", com valor antigo, valor novo e o botão de descartar, para tudo o
mais. Essa lista é a superfície de revisão. Não precisa existir uma segunda.

O XML do Lattes não tem onde guardar a origem de um valor. A origem fica no
IndexedDB, ao lado da cópia de trabalho, ligada à chave da mudança (`key` em
`Change`), e some quando a próxima exportação confirma o valor.

### 5.3 Etiqueta e limites das APIs

| Serviço  | Limites                                                                                                                                                                                                                                                  | Como o editor se comporta                                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crossref | Desde 01/12/2025: pool público com 5 consultas por segundo para registro único e 1 por segundo para listas e buscas, concorrência 1; pool "polite" (com `mailto`) com 10 e 3 por segundo, concorrência 3                                                 | Fila com uma requisição por vez; respeita os cabeçalhos `x-rate-limit-limit` e `x-rate-limit-interval`; recua ao receber 429; guarda em cache no IndexedDB as respostas por DOI |
| OpenAlex | Até 100 requisições por segundo. Orçamento diário em dólares: sem chave, US$ 0,10 por dia; com chave gratuita, US$ 1. Registro único é grátis; lista com filtro custa US$ 0,10 por mil; busca custa US$ 1 por mil. Sem chave, isso dá 100 buscas por dia | Usa registro único (`/works/doi:…`, `/sources/issn:…`) sempre que puder; busca só como fallback; lê `X-RateLimit-Remaining-USD` e para antes de esgotar                         |
| ORCID    | Anônimo: 12 requisições por segundo, fila de até 40, 25 mil leituras por dia por IP; acima da fila, 503. Licença da API pública só para uso não comercial                                                                                                | Busca por nome fica fora da primeira entrega; leitura de um iD é rara                                                                                                           |

Duas observações feitas em 11/10/2026. Uma busca `query.bibliographic` sem
`mailto` voltou com `x-rate-limit-limit: 1` e intervalo de 1 s, e uma consulta
`/works/{doi}` voltou com 5, como o anúncio da Crossref descreve. No OpenAlex,
um filtro `display_name.search` foi cobrado como busca (US$ 0,001), não como
filtro, e a consulta por DOI saiu com custo zero.

Para a busca de DOI de um currículo com 60 itens sem DOI no pool público: 60
segundos de buscas na Crossref, no limite de uma por segundo. É lento o
bastante para mostrar progresso e rápido o bastante para não exigir o pool
"polite".

### 5.4 Como medir antes de ligar

Um conjunto rotulado, montado localmente a partir do currículo real do Rafael
(fora do git, como `fixtures/real/`): para cada item, o DOI certo ou "não
tem". A busca de DOI só liga se a precisão nesse conjunto ficar perto de 100%
no limiar escolhido, aceitando perder cobertura. O mesmo vale para a
detecção de duplicatas e de grafias de autores, com os pares marcados à mão.

## 6. Proposta de primeira entrega

A menor fatia que já vale a pena usa zero modelos e quase nenhuma rede nova.

**Parte A: revisão de consistência (seção 2.2).**

- Um módulo `src/model/review.ts`, puro e testável, que recebe o documento e
  devolve achados com gravidade, elemento, atributo, mensagem e, quando
  houver, a correção proposta.
- Regras da primeira leva: DOI repetido; título normalizado repetido no mesmo
  tipo e ano; mesmo `NRO-ID-CNPQ` com nomes de citação diferentes; dono do
  currículo ausente dos autores; ISSN vazio ou com dígito verificador errado;
  mojibake em qualquer atributo; formações do mesmo nível sobrepostas;
  produção sem área do conhecimento; `validateItem` sobre todos os itens novos.
- Uma tela de achados, por seção, com "ir ao item" e, para mojibake e ISSN
  preenchível a partir do próprio currículo, "aplicar". As correções aplicadas
  aparecem na lista de alterações como qualquer edição.
- Testes com as fixtures sintéticas, com casos plantados para cada regra.

**Parte B: DOI (seções 2.3 e 2.4).**

- Conferência dos itens que já têm DOI, com a requisição que o editor já faz
  (só o DOI). Achado quando ano, título ou periódico divergem.
- Busca de DOI para itens sem DOI, pela Crossref (`query.bibliographic`, um
  por segundo), com o cálculo de nota da seção 2.3 e o limiar calibrado no
  conjunto rotulado. Desligada por padrão, com a pré-visualização do que vai
  sair (título, sobrenomes, ano).
- Cache por DOI e por consulta no IndexedDB, para que revisar de novo não
  repita requisições.

O que a fatia exige antes de começar: a decisão do mantenedor de ampliar a
regra "só DOI ou ORCID iD" para "DOI, ISSN, ORCID iD e, com consentimento,
título, sobrenomes e ano", registrada no `AGENTS.md` e na seção 8 do guia.

O que fica de fora: OpenAlex (entra quando a medição mostrar quanto a Crossref
deixa de achar), ORCID por nome, qualquer modelo de linguagem, qualquer
dependência nova.

Depois dela, a ordem sugerida é a tradução de títulos pela Translator API do
Chrome, que não precisa de chave, e então a citação colada com
`query.bibliographic`. A chave própria só entra quando houver uma tarefa que
nenhuma das camadas anteriores resolve.

## 7. Perguntas em aberto

- O mantenedor aceita ampliar a regra de rede do `AGENTS.md` para a busca de
  DOI por título? Sem isso, a Parte B se reduz à conferência por DOI.
- Pesos de modelo baixados de um CDN são compatíveis com a promessa de um
  `index.html` que funciona por `file://`? Ou modelos locais ficam só no app
  de desktop?
- O Lattes grava o ISSN com ou sem hífen? O guia já registra que isso não foi
  conferido, e a conferência contra o registro do DOI depende da resposta.
- Como tratar DOIs que a Crossref não conhece (404)? Podem ter sido
  registrados por outra agência; a consulta a outra fonte e a política de
  privacidade dela não foram pesquisadas.
- A tabela de áreas da CAPES pode ser redistribuída dentro do editor? Os
  nomes da tabela batem com o que o Lattes grava em
  `NOME-DA-AREA-DO-CONHECIMENTO`?
- Qual a precisão real da busca de DOI em currículos brasileiros, em que boa
  parte da produção é de eventos nacionais sem DOI? Só o conjunto rotulado
  responde.
- A Translator API do Chrome processa o texto inteiramente no aparelho? A
  documentação fala em modelos locais, mas não faz a afirmação com todas as
  letras.
- Quando o Chrome acrescentar português à Prompt API, ela passa a servir para
  separar citações? A qualidade do Gemini Nano nessa tarefa é desconhecida.
- Uma página pública (GitHub Pages) consegue chamar um Ollama em `localhost`
  nos navegadores atuais?

## 8. Fontes

Todas acessadas em 11/10/2026.

- ANTHROPIC. **anthropic-sdk-typescript**: README. GitHub, [s. d.]. Disponível em: https://github.com/anthropics/anthropic-sdk-typescript. (Uso no navegador desligado por padrão; `dangerouslyAllowBrowser`.)
- ANTHROPIC. **How long do you store my organization's data?** Privacy Center, 1 jul. 2026. Disponível em: https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data.
- ANTHROPIC. **Is my data used for model training?** Privacy Center, [s. d.]. Disponível em: https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training.
- ANTHROPIC. **Multilingual support**. Claude Platform Docs, [s. d.]. Disponível em: https://platform.claude.com/docs/en/build-with-claude/multilingual-support.
- ANTHROPIC. **Pricing**. Claude Platform Docs, [s. d.]. Disponível em: https://platform.claude.com/docs/en/about-claude/pricing.
- BRASIL. **Lei nº 13.709, de 14 de agosto de 2018**. Lei Geral de Proteção de Dados Pessoais (LGPD). Disponível em: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm. (Arts. 4º, I; 5º, II; 33, VIII.)
- CAN I USE. **WebGPU**. [S. l.], [s. d.]. Disponível em: https://caniuse.com/webgpu.
- CAPES. **Tabela de Áreas de Conhecimento/Avaliação**. Brasília, 24 out. 2022. Disponível em: https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/avaliacao/instrumentos/documentos-de-apoio/tabela-de-areas-de-conhecimento-avaliacao.
- CROSSREF. **Access and authentication**. [S. l.], 16 out. 2025. Disponível em: https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/.
- CROSSREF. **REST API**. [S. l.], [s. d.]. Disponível em: https://www.crossref.org/documentation/retrieve-metadata/rest-api/.
- CROSSREF. **Tips for using the Crossref REST API**. [S. l.], [s. d.]. Disponível em: https://www.crossref.org/documentation/retrieve-metadata/rest-api/tips-for-using-the-crossref-rest-api/.
- GOOGLE. **Built-in AI**. Chrome for Developers, [s. d.]. Disponível em: https://developer.chrome.com/docs/ai/built-in.
- GOOGLE. **Built-in AI APIs**. Chrome for Developers, [s. d.]. Disponível em: https://developer.chrome.com/docs/ai/built-in-apis.
- GOOGLE. **Gemini API Additional Terms of Service**. Google AI for Developers, 28 abr. 2026. Disponível em: https://ai.google.dev/gemini-api/terms.
- GOOGLE. **Gemini Developer API pricing**. Google AI for Developers, 9 out. 2026. Disponível em: https://ai.google.dev/gemini-api/docs/pricing.
- GOOGLE. **The Prompt API**. Chrome for Developers, [s. d.]. Disponível em: https://developer.chrome.com/docs/ai/prompt-api.
- GOOGLE. **Summarizer API**. Chrome for Developers, [s. d.]. Disponível em: https://developer.chrome.com/docs/ai/summarizer-api.
- GOOGLE. **Translator API**. Chrome for Developers, [s. d.]. Disponível em: https://developer.chrome.com/docs/ai/translator-api.
- HUGGING FACE. **Transformers.js**. [S. l.], [s. d.]. Disponível em: https://huggingface.co/docs/transformers.js/index.
- HUGGING FACE. **Xenova/multilingual-e5-small**: arquivos ONNX. [S. l.], [s. d.]. Disponível em: https://huggingface.co/Xenova/multilingual-e5-small/tree/main/onnx.
- ISSN INTERNATIONAL CENTRE. **Public API documentation**. ISSN Portal, [s. d.]. Disponível em: https://portal.issn.org/public-api-doc.
- ISSN INTERNATIONAL CENTRE. **What is an ISSN?** [S. l.], [s. d.]. Disponível em: https://www.issn.org/understanding-the-issn/what-is-an-issn/.
- MLC AI. **WebLLM documentation**. [S. l.], [s. d.]. Disponível em: https://webllm.mlc.ai/docs/.
- MLC AI. **web-llm**: src/config.ts. GitHub, [s. d.]. Disponível em: https://github.com/mlc-ai/web-llm/blob/main/src/config.ts.
- OLLAMA. **FAQ**. [S. l.], [s. d.]. Disponível em: https://docs.ollama.com/faq.
- OLLAMA. **qwen3**: tags. [S. l.], [s. d.]. Disponível em: https://ollama.com/library/qwen3/tags.
- OPENAI. **openai-node**: README. GitHub, [s. d.]. Disponível em: https://github.com/openai/openai-node.
- OPENAI. **Pricing**. OpenAI API docs, [s. d.]. Disponível em: https://developers.openai.com/api/docs/pricing.
- OPENAI. **Your data**. OpenAI API docs, [s. d.]. Disponível em: https://developers.openai.com/api/docs/guides/your-data.
- OPENALEX. **API overview**. [S. l.], [s. d.]. Disponível em: https://help.openalex.org/how-to-use-the-api/api-overview.
- OPENALEX. **Example costs**. [S. l.], [s. d.]. Disponível em: https://help.openalex.org/access/example-costs.
- OPENALEX. **Pricing**. [S. l.], [s. d.]. Disponível em: https://help.openalex.org/access/pricing.
- OPENALEX. **Rate limits and authentication**. [S. l.], 19 ago. 2026. Disponível em: https://help.openalex.org/how-to-use-the-api/rate-limits-and-authentication.
- ORCID. **API Tutorial: Searching the ORCID Registry**. [S. l.], [s. d.]. Disponível em: https://info.orcid.org/documentation/api-tutorials/api-tutorial-searching-the-orcid-registry/.
- ORCID. **Public APIs Terms of Service**. [S. l.], [s. d.]. Disponível em: https://info.orcid.org/public-client-terms-of-service/.
- ORCID. **What are the API limits?** [S. l.], [s. d.]. Disponível em: https://info.orcid.org/ufaqs/what-are-the-api-limits/.
- RITTMAN, Martyn; MONTILLA, Luis. **Announcing changes to REST API rate limits**. Crossref blog, 5 nov. 2025. Disponível em: https://www.crossref.org/blog/announcing-changes-to-rest-api-rate-limits/.
- TAURI. **HTTP Client**. Tauri v2 docs, [s. d.]. Disponível em: https://v2.tauri.app/plugin/http-client/.
- TKACZYK, Dominika. **Discovering relationships between preprints and journal articles**. Crossref blog, 7 dez. 2023. Disponível em: https://www.crossref.org/blog/discovering-relationships-between-preprints-and-journal-articles/.

Observações próprias, feitas em 11/10/2026 com `curl`: preflight CORS nos
endpoints da Anthropic, OpenAI, Gemini, Crossref, OpenAlex e ORCID;
cabeçalhos de limite da Crossref em `/works/{doi}` e em `query.bibliographic`,
com e sem `mailto`; cabeçalhos de custo do OpenAlex; busca anônima no
`expanded-search` do ORCID; consultas de ISSN em `api.crossref.org/journals`
e `api.openalex.org/sources`.
