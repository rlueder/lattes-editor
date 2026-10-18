# Plano: o que ainda vai à mão no conector

## Objetivo

Levar ao envio pelo conector as trocas que hoje vão à mão por limitação do
editor, e não do Lattes. A medida é `node scripts/cobertura-conector.ts`: no
`fixtures/demo.xml`, 390 de 665 trocas de atributo viram envio (18/10/2026).
Das 275 que não viram, 148 são limite do próprio Lattes (campo que o
formulário não tem, dado que o Lattes gera, DOI) e ficam como estão. As
outras 127 são o alvo deste plano.

## Estado atual

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
  órgão. Falta ver se a página do próprio Lattes troca o órgão na alteração:
  a tentativa de rodar o Salvar da página num quadro foi barrada. Se ela
  também não trocar, o órgão vai para "fica à mão" (excluir e incluir o
  projeto).
- O mesmo teste achou o motivo de nenhuma alteração de projeto ir: o
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
  `seqFormOrientado`) e nenhuma lista mudou, ou seja, só consulta. Falta
  ligar no envio da orientação quando o nome do orientando muda.

Gravação no Lattes real em 18/10/2026, com base e registro da Fase 0: quatro
itens de teste (orientação concluída e em andamento de mestrado, banca de
mestrado, banca julgadora de professor titular) tiveram instituição, curso e
agência trocados pelo `apply` do conector, com as buscas refeitas na hora.
Os quatro voltaram "conferido" na releitura (instituição V0192…, curso
42000254, agência K4WU…). Os 6 itens registrados (o lote de andamento criou 3
variantes) foram removidos pelo registro, e a releitura de todas as listas
ficou igual à base, sem linha a mais nem a menos.

### Fase 3: capítulo de livro e prefácio

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
- Potencial de inovação: pedir o texto (até 400) ao passar de não para sim e
  mandar com `f_sta_inovacao=S`.
- Áreas de atuação: `f_area_l` como `l|c@…` e `f_privacidade` como `1@…`, com o
  código de 8 dígitos tirado da árvore `areaDP`; até 6 áreas. Uma gravação de
  teste confirma o formato sem a chave `r`.
- Contatos do endereço (e-mails, redes sociais, outra forma): capturar os
  scripts de `prc_endereco` e uma gravação de teste.
- Pessoa com deficiência: capturar o script de `prc_ident` e uma gravação de
  teste com um tipo e com dois.

### Fase 5: nome para citação

O `t` vai em cada linha de `f_autores_l`, mas uma troca só da citação já
voltou "conferido" com o Lattes guardando a antiga. Uma gravação de teste
decide entre mandar o `t` novo na linha ou alterar a entrada do dicionário de
coautores (`pkg_dic_autor.lista`, 13 linhas no currículo), que muda a citação
em todos os itens que a usam.

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
