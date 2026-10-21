# Plano: o que ainda vai à mão no conector

## Objetivo

Levar ao envio pelo conector as trocas que hoje vão à mão por limitação do
editor, e não do Lattes. A medida é `node scripts/cobertura-conector.ts`, que
conta campos: cada campo do editor (o caminho do elemento e o atributo) uma
vez só, de `fixtures/synthetic_full.xml`, que tem todos os elementos do
schema. Cada campo vai pelo conector, falta no conector, ou o formulário do
Lattes não tem onde gravá-lo (fica só para ler). O alvo é a segunda coluna.
Até 19/10/2026 a medida era por troca de atributo em cada currículo de
exemplo, o que dependia de quantos itens de cada tipo o exemplo tinha; ela
segue em `--por-curriculo`, e os números abaixo de 19/10/2026 são dela. No
começo do plano, 390 de 665 trocas do demo viravam envio (18/10/2026).
Das 275 que não viram, 148 são limite do próprio Lattes (campo que o
formulário não tem, dado que o Lattes gera, DOI) e ficam como estão. As
outras 127 são o alvo deste plano.

## Estado atual

- 21/10/2026, à noite: sete campos que o Lattes não deixa alterar por
  caminho nenhum passaram a "o formulário do Lattes não tem", e o editor os
  mostra sem edição, com o motivo: nome do pai e da mãe (ocultos na
  identificação), tipo do vínculo (desabilitado no formulário), a instituição
  da atuação, o órgão do ensino e o nome do idioma (segue o código). Os
  motivos de valor (tipo de participação, tipo de graduação) ficaram: ali
  outros valores vão. 2619 de 2731 (96%).
- 21/10/2026, à noite: período e órgão da pesquisa e desenvolvimento e do
  treinamento ministrado pelo conector, gravados no Lattes real com uma
  atividade de teste de cada tipo e removidos pelo registro. A grade (linhas
  de pesquisa, treinamentos) vai como a página a trouxe, e a linha de
  pesquisa de teste ficou com o objetivo. 2619 de 2738 campos (96%), eram 2605.
- 21/10/2026, à noite: a própria citação nos itens segue a identificação, e
  o Lattes não guarda outra item a item (Fase 5). Passou a campo que o
  formulário não tem: 2605 de 2738 (95%).
- 21/10/2026: órgão e unidade das atividades pela lista. O envio existia
  desde a #106, mas o editor só oferecia a janela de órgãos no projeto, e
  numa atividade só dava para digitar o nome, que o conector recusa sem o
  código. Agora direção, estágio, serviço, extensão, outras atividades e
  conselhos usam a janela da atividade (`prc_orgao_cargo`, capacidade
  `orgao-atividades`, caminhos em `src/bridge/organ-windows.ts`); o ensino, a
  pesquisa e desenvolvimento e o treinamento ficam sem a lista. O script de
  cobertura também passou a escolher o curso de novo depois de trocar a
  instituição da formação, como o painel pede: o editor já limpava o curso, e
  as duas escolhas juntas vão. 2605 de 2787 campos vão (93%), eram 2586. A
  instituição da formação complementar passou a aparecer com o motivo real (as
  buscas dela estão desligadas, `COMPL_ENDERECO_LOOKUPS_ENABLED`).
  No Lattes real, numa atividade de direção de teste na atuação da Campanha
  Nacional de Escolas da Comunidade, o conector trocou o órgão, depois o órgão
  por uma unidade, uma unidade por outra e a unidade de volta para um órgão,
  com o período e o cargo mantidos; a atividade saiu pelo registro, com a base
  tirada na hora. O teste achou dois erros na releitura, os dois corrigidos: a
  página mostra o órgão sem unidade como "/ Órgão" e a unidade só como
  "/Unidade", sem o órgão de cima, e o conector dava "não gravou" com o
  Lattes já gravado. A releitura agora confere o código, que a página da
  atividade devolve em `f_codorgao` (o da unidade, quando há), e o Lattes
  simulado devolve como a página real.
- 20/10/2026: o depositante pessoa e as datas do histórico de situações da
  patente pelo conector (`src/bridge/production/holders.ts`,
  `targets/registros.ts`), a partir da exportação e da página de edição de
  uma patente de teste no Lattes real (`docs/lattes_internals.md`, seção 17).
  O depositante vai com um nome só, escolhido do `titularPessoaDP` do menu;
  a data de uma situação conhecida vai pela grade de situações; os autores
  copiados dos depositantes ficam fora da mudança de autores. Seguem à mão o
  titular instituição (busca de instituições), mais de um depositante e o
  resto do histórico. Na patente de teste do Lattes real, o depositante foi
  tirado e posto de volta, e uma data do histórico foi trocada e desfeita. A
  data do registro e a da situação são um campo só no Lattes, e o editor as
  troca juntas (`src/model/linked-attrs.ts`); datas que ainda discordam ficam
  à mão. 2560 de 2801 campos vão (91%), eram 2554. A descrição da situação no
  `synthetic_full.xml` passou a ser "Depósito", como na exportação.
- 20/10/2026: projeto com financiadores, produções ou orientações ligadas
  pelo conector. O envio refaz `f_inst_l`, `f_producoes_l` e
  `f_orientacoes_l` das tabelas `grid2`, `grid3` e `grid4` da página, como o
  `check()` faz, e confere depois que voltaram iguais
  (`src/bridge/production/opaque.ts`); antes, o projeto com qualquer uma
  delas ficava inteiro à mão. Incluir, tirar ou trocar uma linha dessas
  grades continua à mão, e leva junto o resto do projeto na mesma fila. 2579 de 2787 campos vão (93%); eram 2564 de 2791.
  Os 4 que saíram da conta passaram a "o formulário do Lattes não tem", o
  motivo que a recusa do projeto escondia.

- 19/10/2026, noite: demais trabalhos, licenças e linhas de pesquisa pelo
  motor de produção (`targets/demais.ts`), testados no Lattes real com itens
  de teste e removidos. A linha de pesquisa entra pela descrição de uma
  atividade de pesquisa e desenvolvimento e se altera em `pkg_linhapesq.form`.
  Passam a contar como campo que o Lattes não tem: as áreas, palavras-chave e
  setores da formação complementar (o formulário não tem as grades) e as
  informações adicionais de cursos e instituições (o menu não tem tela). 2569
  de 2809 campos vão (91%).

- 19/10/2026, fim da tarde: áreas do conhecimento e setores de atividade de
  produções, orientações e bancas pelo conector
  (`src/bridge/production/item-lists.ts`), e palavras-chave, áreas e setores da
  formação (`src/bridge/formacao-grids.ts`). Antes, uma troca de área ou setor
  numa produção aparecia como campo que o Lattes não tem, o que não era
  verdade: o formulário tem as grades. No Lattes real, um trabalho técnico de
  teste recebeu uma área (Desenho Industrial, 61200000) e um setor
  (Alimentação, 420228), e um mestrado de teste uma palavra-chave, todos
  conferidos. **Erro corrigido:** desde a #100, todo envio de formação mandava
  `f_plv_l`, `f_area_l` e `f_setor_l` vazios, como a página os carrega, e o
  Lattes apagava as palavras-chave, áreas e setores da formação; o envio da
  página tal como vinha apagou a palavra do mestrado de teste no Lattes real.
  Agora todo envio de formação leva as três grades como a página as trouxe.
  As áreas, palavras-chave e setores dos eventos contam como campo que o
  Lattes não tem: a página de edição do evento não tem essas grades. 2444 de
  2854 campos vão (86%).

- 19/10/2026, à tarde: atividades das atuações pelo conector
  (`src/bridge/edit-atividade.ts`, capacidade `alterar-atividades`): período e
  descrição, testados no Lattes real com uma atividade de teste (descrição e
  ano de início, depois anterior para atual) e removida pelo registro. O
  órgão da atividade, as disciplinas e os treinamentos (filhos) e uma
  descrição com mais de uma linha ficam à mão. Os tipos artísticos antigos
  (apresentação de obra, composição, arranjo, sonoplastia, rádio e TV, curso
  de curta duração artístico) contam como campo que o Lattes não tem: o menu
  real de 19/10/2026 só tem artes cênicas, música, artes visuais e outra
  produção artística. 1448 de 2092 campos vão (69%).

- 19/10/2026, mais tarde: patentes e registros pelo motor de produção
  (`src/bridge/production/targets/registros.ts`). Os oito tipos foram
  alterados no Lattes real com itens de teste e conferidos, com depositantes,
  autores e datas mantidos; os itens foram removidos pelo registro. 1397 de
  2382 campos vão (59%). Ficam à mão nesses tipos: o nome do titular e do
  depositante, o histórico de situações da patente e o ambiente do programa
  de computador (o formato deles na exportação não foi visto), e a citação
  dos autores (Fase 5). Sobrou no dicionário de coautores a entrada
  "TESTE EDITOR APAGAR Depositante", sem uso, que o Lattes não deixa excluir
  pela página.

- 19/10/2026: medida por campo. 1256 de 2582 campos que o Lattes aceita vão
  pelo conector (49%); outros 1166 o formulário do Lattes não tem. O que mais
  falta: patentes e registros (330 campos), os tipos de produção técnica sem
  formulário ainda, como software e cultivar (306), os tipos artísticos que
  o censo não achou no Lattes (286) e as atividades da atuação (98).

- 18/10/2026, fim do dia: o demo ganhou um prefácio e a cobertura passou a
  medir os dois currículos: demo 447 de 662, synthetic_full 1113 de 3748.

- 18/10/2026, mais tarde: o script de cobertura passou a ignorar o que o
  editor não deixa digitar (`isSystemAttr`: códigos, IDs do orientador e do
  orientado, datas do Lattes, sigla do país), como o próprio editor. A conta
  ficou em 409 de 640.

- 18/10/2026: passada completa no Lattes real terminada (PR #100). 340 itens de
  teste criados e removidos, 2181 ligações campo ↔ atributo observadas, 13
  divergências em `docs/lattes-formularios/pendencias.json`.
- A limpeza dos itens de teste se apoiou na marca "TESTE EDITOR APAGAR" e
  deixou 23 itens para trás (formações sem campo de texto e uma lista que o
  menu abre por outro formato de link). Tudo removido e republicado; daqui em
  diante vale a Fase 0.
- Fases 0 e 1 feitas em 18/10/2026 (commits locais no PR #100).

## Fases

### Fase 0: base e registro dos itens de teste (só código)

Antes de qualquer item de teste novo no Lattes real:

1. "Ler formulários" guarda uma cópia de todas as listas que o menu abre, em
   qualquer formato de link, com o texto e o link de cada linha. Sem essa
   base, o lote não começa.
2. Depois de cada lote, o registro guarda as linhas que apareceram, com o link.
3. A remoção trabalha pelo registro: exclui só a linha registrada, e só se o
   texto dela ainda bate.
   Desde 21/10/2026, também só se a página do item tem a marca; a linha sem
   ela fica para a pessoa conferir (`markedBatch`, `src/census/test-ledger.ts`).
4. Fim só quando todas as listas voltam a ser iguais à base. O que sobrar, ou o
   que faltar da base, aparece no painel.

### Fase 1: o script de cobertura simula a escolha pela busca (só código)

`scripts/cobertura-conector.ts` troca só o nome da instituição, do curso e da
agência, sem o código, que é justamente o caso que o planejador recusa. Com a
troca simulada como a escolha pela lista faz (código e nome juntos), as
recusas da formação (cerca de 14) deixam de contar. Nenhuma mudança no envio. Feito em 18/10/2026: 390 → 394. O que sobra da
formação é real: depois de trocar a instituição o curso precisa ser escolhido
de novo, e a instituição do sanduíche e da cotutela (`NOME-INSTITUICAO-DOUT*`)
não tem seletor no editor (entra na Fase 2).

### Fase 2: buscas do Lattes em orientações e bancas

O seletor e as buscas da formação já existem (`src/ui/LiveListField.tsx`,
`src/ui/live-lists.ts`, `src/bridge/formacao-lookups.ts`, mensagens
`buscar-instituicao` e `pedir-cursos`). Falta:

- O seletor por par de atributos (`NOME-DA-INSTITUICAO`, `NOME-DO-CURSO`,
  `NOME-DA-AGENCIA` das orientações concluídas; `NOME-INSTITUICAO` e
  `NOME-CURSO` das em andamento e das bancas).
- `pedir-cursos` com `f_pgm=TESE` e o nível da natureza (`retnivel()` da
  página de orientação).
- No envio, os ocultos `f_cod_inst`/`f_cod_inst2` (V no primeiro), `f_inst_old`,
  `f_cod_curso`/`f_cod_curso2`, `f_curso_old`, `f_agencia`, `f_nme_agencia`.
- ID do orientando: `pkg_orient.valida_orientador_ajax` preenche
  `f_id_orientado` e `f_seq_form_orientado`. É um POST; conferir que só
  consulta antes de usar.
- Órgão do projeto: `PKG_PROJETO.pp_orgao_cargo` grava `f_codorgao`,
  `f_codorgao2`, `f_orgao_old`. A resposta ainda não foi lida.

No Lattes real: as buscas são só leitura; uma gravação acompanhada por tipo
(orientação concluída, em andamento, banca, órgão do projeto).

Feito em 18/10/2026, só no código e no Lattes simulado (capacidade
`buscas-producao`): instituição, curso e agência de orientações e bancas pela
escolha na lista (`src/bridge/production/lookups.ts`, o seletor em
`src/ui/live-lists.ts`), e a instituição do sanduíche e da cotutela na
formação. 399 → 410 de 663. Falta: o ID do orientando, o órgão do projeto (a busca `PKG_PROJETO.pp_orgao_cargo` foi lida em 18/10/2026: `atribuir(código, nome, tipo)` grava `f_codorgao` com tipo 0 e `f_codorgao2` nos outros, e o nome em `f_orgao` e `f_orgao_old`; os órgãos se abrem em árvore pelo `f_cod_inst2`), o
curso dos tipos com mais de uma natureza (outras orientações concluídas,
qualificação).

O resto, também em 18/10/2026 (capacidade `orgao-projeto` e `natures` nas
buscas):

- Órgão e unidade do projeto: seletor em dois passos no editor
  (`src/ui/OrganField.tsx`), mensagem `pedir-orgaos`, envio em
  `src/bridge/production/organ.ts`, tudo atrás de `PROJECT_ORGAN_ENABLED`,
  **desligada**. No teste ao vivo de 18/10/2026 (projeto de teste na atuação
  da Campanha Nacional de Escolas da Comunidade), o Lattes recebeu o envio e
  continuou com o órgão de antes, tanto para uma unidade quanto para outro
  órgão. A tentativa de rodar o Salvar da página num quadro foi barrada, e o
  teste à mão ficou para depois (ver o ORA-19032 abaixo): por ora o órgão fica à mão, com esse motivo
  (`src/bridge/atuacao-by-hand.ts`).
- Toda alteração de projeto voltava do Lattes com "ORA-19032: Era esperado o
  identificador de XML": o `check()` da página monta `f_instituicoes`
  (`<root><item><cod>…</cod><tipo_inst>…</tipo_inst></item></root>`) a partir
  de `titularInstProvider`, e o conector mandava o oculto vazio. Corrigido em
  18/10/2026 com o gancho `built` do alvo, e conferido no Lattes real pelo
  potencial de inovação. É provável que o órgão tenha falhado pelo mesmo
  motivo; o reteste pede ligar `PROJECT_ORGAN_ENABLED`.
- O mesmo teste achou outro motivo de nenhuma alteração de projeto ir: o
  conector procurava os vetores `financiadorProvider`, `producaoProvider` e
  `orientacaoProvider`, que a página real não tem. As grades são as tabelas
  `grid2`, `grid3` e `grid4`; corrigido. Uma alteração de campo de projeto
  ainda não foi gravada no Lattes real.
- Curso das orientações e bancas de várias naturezas (outras orientações
  concluídas, qualificação): o nível sai da NATUREZA do item, pela tabela da
  especificação (`natures`, ligações do censo de 18/10/2026).
- ID do orientando: não é campo do editor (é de sistema, como o Lattes o
  trata). O conector manda o que a página trouxe, como a página faz quando o
  nome não valida. Mandar o ID novo quando o nome muda pede chamar
  `pkg_orient.valida_orientador_ajax`, um POST. Testado em 18/10/2026 com um
  nome de teste: devolve JSON (`sta_validado`, `mensagem`, `idOrientado`,
  `seqFormOrientado`) e nenhuma lista mudou, ou seja, só consulta. Ligado
  no envio da orientação (`src/bridge/production/student.ts`): com o nome do
  orientando trocado, o conector faz a mesma validação antes do envio e,
  como a página, só manda o identificador quando o nome valida. Testado no
  Lattes simulado.

Gravação no Lattes real em 18/10/2026, com base e registro da Fase 0: quatro
itens de teste (orientação concluída e em andamento de mestrado, banca de
mestrado, banca julgadora de professor titular) tiveram instituição, curso e
agência trocados pelo `apply` do conector, com as buscas refeitas na hora.
Os quatro voltaram "conferido" na releitura (instituição V0192…, curso
42000254, agência K4WU…). Os 6 itens registrados (o lote de andamento criou 3
variantes) foram removidos pelo registro, e a releitura de todas as listas
ficou igual à base, sem linha a mais nem a menos.

### Fase 3: capítulo de livro e prefácio

Capítulo feito em 18/10/2026: o formulário `GN_CAP` (`PKG_LVR_CAP.FORM_CAP`,
aberto pela escolha "Capitulo" da lista de livros e capítulos) foi lido, e o
alvo `capitulo` (`bibliografica-livros.ts`) foi gravado no Lattes real num
capítulo de teste: editora, páginas, cidade, título do capítulo e título do
livro, todos conferidos, e a remoção pelo registro deixou as listas iguais à
base. O título do capítulo é `f_titulo_cap`; `f_titulo` é o do livro. A
cobertura foi a 428 de 640.

Prefácio feito em 18/10/2026: a lista é `prc_bib_demais_lista` com
`f_cod_tipo=1C` (link do menu "Prefácio, posfácio") e o formulário `GN_BIB` de
`prc_bib_prefacio`. Num prefácio de teste no Lattes real, título, editora,
cidade, volume, autor da publicação, tipo (prefácio para posfácio) e natureza
foram gravados e conferidos, e a remoção deixou as listas iguais à base.

O formulário de edição do capítulo nunca foi lido; a captura só tem o do
livro (`PKG_LVR_CAP.FORM_LVR`, sem opção de capítulo). O currículo não tem
capítulo, então a leitura pede um item de teste (com a Fase 0). Depois, um
alvo `CAPITULO` em `src/bridge/production/targets/bibliografica-livros.ts`
no molde do livro. Prefácio: confirmar o `f_cod_tipo` da lista (1C).

### Fase 4: grades e o resto

- Nacionalidade: feito em 18/10/2026. O país de nacionalidade virou lista
  dos países do Lattes e leva a sigla e a nacionalidade (B para o Brasil, E
  para os outros); a nacionalidade fica só para ler.
- Coordenador do projeto: a regra é do Lattes (um e só um) e o editor já a
  explica; a troca feita com os dois botões vai pelo conector. O script de
  cobertura agora simula a troca em vez de virar um botão só (feito em
  18/10/2026). Falta, se valer a pena, o coordenador no editor da equipe de
  um projeto novo.
- Potencial de inovação: feito em 18/10/2026. Ao passar de não para sim, o
  editor pede o texto (até 400, `src/ui/InnovationText.tsx`) e o envio leva
  `f_sta_inovacao=S` com `f_txt_potencial`; ao passar para não, o texto vai
  vazio, como a página faz. O rádio só é marcado por script na página
  (`scriptRadios` em `src/bridge/form.ts`). No Lattes real, num projeto de
  teste, sim para não e não para sim com texto voltaram "conferido", e a
  página de depois só mudou nesses dois campos.
- Áreas de atuação: feito em 18/10/2026 (`src/bridge/areas-atuacao.ts`,
  capacidade `alterar-areas-atuacao`). A página `prc_area_atuacao` grava a
  lista inteira: `f_area_l` com `nome|código` de cada área, `f_privacidade` e
  `f_ctr=I`; a chave `r` não aparece nas linhas nem na árvore. No Lattes real,
  uma terceira área (Desenho Industrial, 61200000) entrou e saiu pelo
  conector, conferida nas duas vezes, e as duas suas voltaram com os mesmos
  códigos e a mesma privacidade (a área criada por você, 99990007, inclusive).
- Valores postos por script: as páginas marcam selects, ocultos e rádios por
  script (`$("[name=X]").val("v")` e `if ("a" == "b") $("input[name=X]
[value=V]").attr("checked")`), e o HTML sozinho traz o padrão. Um envio de
  identificação lido só do HTML mandou as privacidades de nascimento,
  identidade, passaporte e cor/raça como Público e a cor/raça vazia em
  18/10/2026; foi desfeito na hora, sem publicação no meio. Desde então todo
  `readForm` passa por `withScriptValues`.
- Contatos do endereço: feito no envio em 18/10/2026
  (`src/bridge/endereco-contatos.ts`). A página serializa as redes em
  `f_dados_grid` e as outras formas de contato em `f_dados_grid_contatos`
  com o `array2xml` dela; todo envio do endereço leva as duas grades, porque
  os ocultos vazios poderiam apagá-las. Os e-mails são `f_email_i` e
  `f_email_r`. No Lattes real, o GitHub entrou ao lado do LinkedIn pelo
  conector. Falta ver na exportação o formato de `REDE-SOCIAL` com duas
  redes (a exportação atrasa horas) e a tela de contatos no editor.
- Identificação: o `check()` da página monta `f_dados_grid` (a grade do
  ORCID, `provider2`) e o nome para citação vem da grade de citações. Sem
  isso o Lattes recusava com ORA-19032, e nenhuma alteração de identificação
  tinha sido gravada ao vivo antes de 18/10/2026 (`src/bridge/ident-grids.ts`).
- Pessoa com deficiência: o script de `prc_ident` foi lido em 18/10/2026. O
  formulário tem o rádio `f_pcd_r` (N/S), uma caixa `f_pcd` por tipo (A
  auditiva, F física, I intelectual, V visual, E espectro autista, M
  múltipla) mais um `f_pcd=DUMMY` oculto, e a privacidade `f_priv_pcd`; com
  "Não", a exportação traz `PCD=""`. O envio foi feito em 18/10/2026
  (`src/bridge/pcd.ts`): no Lattes real, PCD visual (privado) entrou pelo
  conector, "conferido", e só as linhas de PCD da página mudaram. Falta ver
  como a exportação grava o tipo, depois tirar a PCD de teste pelo conector
  e republicar.

### Fase 5: nome para citação

O `t` vai em cada linha de `f_autores_l`, mas uma troca só da citação já
voltou "conferido" com o Lattes guardando a antiga. Uma gravação de teste
decide entre mandar o `t` novo na linha ou alterar a entrada do dicionário de
coautores (`pkg_dic_autor.lista`, 13 linhas no currículo), que muda a citação
em todos os itens que a usam.

Decidido em 19/10/2026: pelo dicionário (`src/bridge/edit-citacao.ts`, chave
`alterar-citacoes`). A troca só da citação de um coautor confere a entrada,
pergunta se há produção validada, grava e relê; a linha do painel avisa que a
citação muda em todas as produções do coautor. A própria citação fica à mão
(a pessoa não está no dicionário). Gravado e conferido no Lattes real em
20/10/2026: num item de teste de demais trabalhos com o coautor de teste
(entrada 14 do dicionário), a troca no dicionário mudou o `t` da linha do
item; depois a citação voltou e o item saiu pelo registro (marca no espelho:
0).

Fechado em 21/10/2026: a própria citação não tem como ir item a item. Num
item de teste de demais trabalhos, o `check()` da própria página mandou a
linha da pessoa com outra citação, o Lattes respondeu sucesso e guardou o nome
em citações da identificação. As 49 trocas da própria citação passaram a
"o formulário do Lattes não tem", e o editor mostra o campo sem edição,
apontando para a identificação, que vai pelo conector. 2605 de 2738 campos vão
(95%).

### Fase 6: substituir (incluir o novo e excluir o antigo)

Para trocas que mudam o tipo do item (nível da formação, natureza do evento):
uma operação só, que inclui, confere e só então exclui. Se a inclusão falha,
nada é excluído; se a exclusão falha, os dois ficam e o envio ao CNPq trava
até a pessoa resolver. Começa por eventos e formação. A exclusão da formação
ainda precisa ser vista no Lattes real.

## Ficam à mão, com o motivo

- Nome do pai e da mãe: o formulário de identificação só tem o oculto.
- Substituir atuação: excluir a atuação apaga atividades, vínculos, projetos
  e linhas de pesquisa, e quase nada disso se inclui de novo pelo conector.
- Substituir orientação ou banca: o conector não inclui nem exclui produções,
  e projetos apontam para elas.

## Ordem

0 e 1 (só código), as partes só de código da 4, depois 2, 3, o resto da 4, 5
e 6. Cada sessão no Lattes real começa pela base da Fase 0.

## Contexto

- Relatórios dos quatro levantamentos de 18/10/2026: buscas (formação já tem
  seletor; faltam orientações, bancas, ID do orientando e órgão), substituir
  (inclusão existe para formação, eventos e parte da atuação; exclusão só de
  idioma e vínculo), capítulo e citação, grades.
- Páginas salvas da investigação: `orient.html`, `projeto-P.html`,
  `inst-form.html`, `inst-ativ.html`, `revisor-agencia.html`, `periodico.html`
  (fora do repositório).
- `docs/lattes_internals.md`, seção 18, para as buscas.
