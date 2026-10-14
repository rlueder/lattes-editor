# Como o editor do Currículo Lattes funciona por dentro

Notas de reconhecimento do editor web do Lattes (`wwws.cnpq.br/cvlattesweb`),
para quem for escrever o conector com o navegador ou só tiver curiosidade. Tudo
aqui foi observado numa sessão logada do próprio dono do currículo, só com
leitura: as páginas de formulário foram baixadas por GET e analisadas, nenhum
formulário foi enviado.

Datas das observações: 10/10/2026 (primeiro reconhecimento, ver
`lattes_editor_reconnaissance.md`) e 11/10/2026 (formulários de edição, este
documento).

Cada afirmação vem marcada como **observado** (visto no HTML, nos scripts ou
no comportamento do servidor) ou **inferido** (conclusão a partir do que foi
observado, ainda não confirmada).

## Visão geral: os componentes

O caminho de uma alteração, do Lattes ao editor e de volta. Há dois retornos:
itens novos vão pelo Importar do próprio Lattes, num arquivo que o editor gera
(3a); o resto vai pela extensão, que grava nos formulários do Lattes na sessão
do próprio usuário (3b). O app nunca fala com o Lattes direto.

```mermaid
flowchart TB
  subgraph CNPq["CNPq"]
    direction TB
    Gateway["cvlattesweb: aplicação PL/SQL<br/>PKG_MENU, PKG_ATIV,<br/>PKG_RESUME, PKG_IDIOMA"]
    ImpExp["Ferramentas:<br/>Exportar e Importar"]
    Foto["servicosweb:<br/>foto do currículo"]
  end
  Crossref["api.crossref.org<br/>(DOI)"]

  subgraph Nav["Navegador: Chrome, Brave, Edge"]
    direction TB
    subgraph Aba["Aba do Lattes, na sessão do usuário"]
      Runner["lattes-runner<br/>(script injetado)"]
    end
    SW["Service worker<br/>da extensão"]
    Painel["Painel lateral<br/>da extensão"]
  end

  Host["Host nativo<br/>(o mesmo executável, sem janela)"]

  subgraph App["App LattesEditor (Tauri)"]
    direction TB
    Porta["Porta local 127.0.0.1<br/>com segredo em conector.txt"]
    UI["Editor<br/>(página no webview)"]
  end

  Arquivos[("CV_id.zip ou .xml exportado<br/>id-importacao.xml")]

  Arquivos <-- "1. exportação<br/>4. Importar (itens novos)" --> ImpExp
  Arquivos <-- "2. abre<br/>3a. gera os itens novos" --> UI
  UI <-- "3b. fila e resultados" --> Porta
  Porta <-- "TCP, JSON por linha" --> Host
  Host <-- "mensagens nativas,<br/>stdin e stdout" --> SW
  Painel -- "Aplicar" --> SW
  SW -- "executeScript" --> Runner
  Runner -- "GET do formulário,<br/>POST em Latin-1,<br/>GET de conferência" --> Gateway
  UI -.-> Foto
  UI -.-> Crossref
```

- **Editor** (`src/`): lê a exportação, guarda a cópia de trabalho e planeja
  as operações que a extensão sabe levar (`src/bridge/plan.ts`).
- **Porta local e host nativo** (`src-tauri/src/conector.rs`): o navegador só
  inicia programas registrados, então o próprio executável do app, chamado
  com a origem da extensão, faz o papel de host e repassa as mensagens ao app
  aberto. O segredo impede que outro usuário da máquina se ligue à porta.
- **Extensão** (`extension/`): o service worker guarda a fila; o envio só
  começa por um clique no painel. O `lattes-runner` roda dentro da aba do
  Lattes e faz, para cada operação, o que a seção 6 descreve: acha o
  formulário pelos links do próprio Lattes, confere que ele está como o
  editor espera, envia e lê de volta (`src/bridge/apply.ts`).
- **Lattes** (seções 1 a 5): a aplicação PL/SQL que recebe os formulários.
  Exportar e Importar são as únicas portas oficiais para arquivos.
- Em linha tracejada, o que sai do app sem passar pela extensão: a foto do
  perfil e a busca do DOI, só quando pedidas.

## 1. Uma aplicação PL/SQL servida pela web

Toda URL do editor tem a forma

```
/cvlattesweb/PACOTE.procedimento?f_cod=…&f_outro=…
```

por exemplo `pkg_ativ.lista`, `PKG_ATIV.VINCULOS`, `pkg_formacao.form`,
`prc_endereco`. **Observado.**

Esse é o desenho de uma aplicação escrita em PL/SQL, a linguagem de
procedimentos do banco Oracle, servida por um gateway que transforma cada
requisição HTTP numa chamada de procedimento armazenado: o caminho escolhe o
pacote e o procedimento, e cada parâmetro da URL ou do formulário vira um
argumento com o mesmo nome. A página HTML é escrita pelo próprio
procedimento, linha a linha. **Inferido** a partir dos nomes e do
comportamento abaixo; é o modelo do gateway PL/SQL da Oracle (o antigo
mod_plsql e seus sucessores), comum em sistemas de governo do fim dos anos 90
e começo dos 2000.

Duas consequências aparecem no uso:

- **A assinatura manda.** Chamar `pkg_formacao.lista` sem `f_tipo` devolve
  HTTP 404: para o gateway, não existe procedimento com aquela lista de
  argumentos. **Observado** (10/10/2026).
- **Maiúsculas não importam no servidor.** O mesmo formulário mistura
  `f_status` e `F_STATUS`, `f_texto` e `F_TEXTO`, e as URLs alternam
  `PKG_ATIV` e `pkg_ativ`. Identificadores PL/SQL não distinguem caixa, então
  o servidor trata tudo igual. **Observado** (a mistura); **inferido** (a
  causa).

### O prefixo `f_`

Todo parâmetro começa com `f_` (`f_cod`, `f_seq`, `f_ano_ini`,
`f_tipo_privacidade`). **Observado.** O mais provável é uma convenção de
nomes para separar argumentos que vêm do formulário de variáveis internas do
procedimento. **Inferido.**

## 2. `f_ctr`: um procedimento, várias operações

O procedimento que desenha o formulário é o mesmo que recebe o envio dele.
O formulário de vínculo, por exemplo, é aberto por GET em
`PKG_ATIV.vinculos` e postado para `PKG_ATIV.VINCULOS`. **Observado.**

O que diz ao procedimento o que fazer é um campo oculto, `f_ctr` (de
"controle", **inferido**), com uma letra:

| `f_ctr`   | Onde apareceu                                                                            | Significado                                             |
| --------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `I`       | formulário de item novo (atividade em `pkg_ativ.cargo`, 10/10/2026)                      | incluir, **observado**                                  |
| `U`       | formulário de item existente: vínculo, formação, idioma, resumo, endereço, identificação | atualizar, **observado** (envio de 11/10/2026, seção 6) |
| `A`       | código da tela de Formação (10/10/2026)                                                  | alterar, **inferido**                                   |
| `E`, `E2` | função `dele` da lista de atuações; código da Formação                                   | excluir, **inferido**                                   |
| `V`       | botão de voltar/cancelar (10/10/2026)                                                    | voltar sem salvar, **observado**                        |

É o padrão de "despachante" de aplicações CRUD feitas sobre procedimentos:
em vez de uma URL por operação, um procedimento por tela, com um `if` no
começo que olha o código de controle. O mesmo GET sem `f_seq` mostra o
formulário vazio (inclusão); com `f_seq` mostra o registro (alteração).
**Observado** no vínculo (`f_seq_hist`) e na formação (`f_seq`).

## 3. Identificadores

Dois códigos circulam, e os dois devem ser tratados como segredo em logs:

- **O da sessão**: 32 caracteres hexadecimais em `PKG_MENU.menu?f_cod=…`.
  Muda a cada login. **Observado.**
- **O do currículo**: 10 caracteres, usado em `f_cod` por todas as chamadas
  internas. **Observado.**

A exportação XML não traz o código de 10 caracteres, só o identificador
público de 16 dígitos (`NUMERO-IDENTIFICADOR`). Os dois se ligam por
redirecionamento: `lattes.cnpq.br/<16 dígitos>` responde 302 para
`buscatextual.cnpq.br/buscatextual/cv?id=<16 dígitos>`, que responde 302
para `visualizacv.do?metodo=apresentar&id=<10 caracteres>`. **Observado**
(11/10/2026). A foto do currículo sai de
`servicosweb.cnpq.br/wspessoa/servletrecuperafoto?tipo=1&id=<10 caracteres>`;
com o identificador de 16 dígitos o mesmo endereço responde uma imagem
vazia. **Observado.**

Cada linha de uma lista é identificada por números de sequência que batem
com os do XML exportado: `f_seq_ativ` com `SEQUENCIA-ATIVIDADE`,
`f_seq_hist` com `SEQUENCIA-HISTORICO`, `f_seq` da formação com
`SEQUENCIA-FORMACAO`. Conferido na atuação em 11/10/2026: a atividade com
`SEQUENCIA-ATIVIDADE="5"` no XML é a única linha com `f_seq_ativ=5` na lista
do Lattes, na mesma instituição. **Observado** para a atuação; nas outras
telas continua inferido.

O código da instituição não é igual dos dois lados: o XML traz
`CODIGO-INSTITUICAO="001000000998"` e o link do Lattes traz
`f_codinst=D001000000998`, com uma letra na frente. **Observado**; o que a
letra significa não se sabe.

## 4. Telas

O editor é uma página só (`PKG_MENU.menu`) com camadas modais em `iframe`
(`modalCV1` a `modalCV3`): lista, formulário, busca de instituição.
**Observado** (10/10/2026). Cada formulário:

- valida no navegador com uma função `check()` que junta mensagens num
  vetor e as mostra com `alert()`;
- salva com `enviar()`, que faz `submit()` do formulário inteiro: um POST
  clássico, que recarrega o `iframe`;
- não tem token CSRF; o que amarra o envio à sessão é o cookie e o `f_cod`.

**Observado.** Se o servidor repete as validações de `check()`, não se sabe.

## 5. Formulários de edição (11/10/2026)

Nomes, tipos e limites lidos do HTML. Campos ocultos de controle (`f_cod`,
chaves, `*_old`) aparecem no fim de cada lista.

### Vínculo de uma atuação: `GN_ATIV_VINC`, POST `PKG_ATIV.VINCULOS`

Aberto por GET `PKG_ATIV.vinculos` com `f_cod`, `f_codinst`, `f_seq_ativ` e
`f_seq_hist` (sem `f_seq_hist`, abre um vínculo novo).

| Campo                                                                        | Tipo                              | XML (`VINCULOS`)                                                                       |
| ---------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| `f_vinc`                                                                     | texto 30                          | `TIPO-DE-VINCULO` / `OUTRO-VINCULO-INFORMADO` (o formulário guarda o rótulo; ver nota) |
| `f_stavinc`                                                                  | lista: vazio, `0`, `1`            | `FLAG-VINCULO-EMPREGATICIO` (`1` = sim, `0` = não)                                     |
| `f_enqua`                                                                    | texto 45                          | `OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO`                                              |
| `f_enqua_en`                                                                 | texto 45                          | `OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO-INGLES`                                       |
| `f_carga`                                                                    | texto 3                           | `CARGA-HORARIA-SEMANAL`                                                                |
| `f_regime`                                                                   | caixa, valor `3`                  | `FLAG-DEDICACAO-EXCLUSIVA` (marcada = sim)                                             |
| `f_mes_ini`, `f_ano_ini`                                                     | texto 2, 4                        | `MES-INICIO`, `ANO-INICIO`                                                             |
| `f_status`                                                                   | rádio `S` = Atual, `N` = Anterior | atual quando `ANO-FIM` é vazio                                                         |
| `f_mes_fim`, `f_ano_fim`                                                     | texto 2, 4                        | `MES-FIM`, `ANO-FIM`                                                                   |
| `f_outras_inf`                                                               | área 3950                         | `OUTRAS-INFORMACOES`                                                                   |
| `f_outras_inf_en`                                                            | área 2000                         | `OUTRAS-INFORMACOES-INGLES`                                                            |
| `f_tipo_privacidade`                                                         | lista `1` público, `2` privado    | sem correspondente no XML                                                              |
| `f_ctr` (`U`), `f_vinculo`, `f_cod`, `f_codinst`, `f_seq_ativ`, `f_seq_hist` | ocultos                           |                                                                                        |

Nota sobre o tipo de vínculo: `check()` copia o texto de `f_vinc` para o
oculto `f_vinculo` antes de enviar, e o texto vem de uma lista em
`dominio()` (Servidor público, Celetista, Professor visitante, Bolsista,
Outro). Como esse texto vira o código `TIPO-DE-VINCULO` do XML não foi
visto. **Lacuna.**

Regras de `check()` (mensagens do próprio Lattes): tipo do vínculo e início
obrigatórios; fim obrigatório quando o status é Anterior e proibido quando é
Atual; início antes do fim; nenhuma data no futuro; início não anterior ao
nascimento.

### Formação acadêmica: `GN_FORMACAO2`, POST `pkg_formacao.FORM`

Aberto por GET `pkg_formacao.form` com `f_cod`, `f_seq` e `f_tipo` (`FA`).
Mesmos campos do formulário de inclusão descrito no reconhecimento de
10/10/2026, com `f_ctr=U`, `f_seq` preenchido e `f_nivel` com o código do
nível (`3` = mestrado). `F_STATUS` usa `N` em andamento, `S` concluído, `I`
incompleto (rótulos lidos em 10/10/2026), que correspondem a
`STATUS-DO-CURSO` `EM_ANDAMENTO`, `CONCLUIDO`, `INCOMPLETO`.

### Idioma: `GN_IDIOMA`, POST `PKG_IDIOMA.FORM`

| Campo                                            | Tipo                                        | XML (`IDIOMA`)                                                                                   |
| ------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `F_COD_IDIOMA`                                   | lista de idiomas                            | `IDIOMA`                                                                                         |
| `F_LE`, `F_CONVERSA`, `F_ESCREVE`, `F_COMPR`     | rádio `P` pouco, `R` razoavelmente, `B` bem | `PROFICIENCIA-DE-LEITURA`, `-FALA`, `-ESCRITA`, `-COMPREENSAO` (`POUCO`, `RAZOAVELMENTE`, `BEM`) |
| `FC_LE`, `FC_CONVERSA`, `FC_ESCREVE`, `FC_COMPR` | caixas, valor `on`                          | habilitam cada proficiência; `check()` exige ao menos uma marcada                                |
| `f_tipo_privacidade`                             | lista `1`/`2`                               |                                                                                                  |
| `f_ctr` (`U`), `f_cod`, `f_seq`                  | ocultos                                     |                                                                                                  |

A exportação não traz número de sequência do idioma. O conector abre cada link
`pkg_idioma.form` da lista que tem `f_seq` (o que não tem é o de idioma novo)
e escolhe o único cujo `F_COD_IDIOMA` é o código do XML. `NAO_INFORMADO` no
XML corresponde à caixa desmarcada e nenhum rádio.

### Códigos de nível (11/10/2026)

Lidos nos formulários, sem gravar nada:

- Formação complementar (`pkg_formacao_compl.form`), lista `f_nivel`: `F`
  curso de curta duração, `8` extensão universitária, `E` MBA, `Y` outros.
  É o `NIVEL` do XML nesses itens.
- Mestrado (`pkg_formacao.form`, `f_nivel` 3): rádio `f_tpo_doutorado`, `N`
  normal e `S` sanduíche. É o `TIPO-MESTRADO` do XML.
- Formação acadêmica: `f_nivel` vem oculto no formulário (3 no mestrado, 1 na
  graduação, 7 no curso técnico, conforme a exportação); o nível é o próprio
  tipo do item.
- `NIVEL-CURSO="OT"` da tabela de cursos: sentido não encontrado. O XSD tem
  `OT` e `OUTRO` como valores distintos.

### Resumo: `RES`, POST `PKG_RESUME.FORM`

`F_TEXTO` (4000) e `F_TEXTO_EN` (4000), correspondentes a
`TEXTO-RESUMO-CV-RH` e `TEXTO-RESUMO-CV-RH-EN`; ocultos `f_resume_auto`,
`f_resume_auto_en`, `f_cod`, `f_ret`, `f_ctr` (`U`).

### Endereço: `GN_ENDERECO`, POST `PRC_ENDERECO`

Um formulário para os dois endereços: sufixo `_r` residencial, `_i`
institucional. `f_pais_*`, `f_cep_*` (15), `f_rua_*` (180), `f_bairro_*`
(255), `f_munic_*` (45), `f_estado_*` (10), `f_ddd_*`, `f_fone_*`,
`f_ramal_*`, `f_fax_*`, `f_caixa_*`, `f_ddd_cel_*`, `f_fone_cel_*`,
`f_homepage_*` (250); `f_inst` (75) e `f_orgao` do institucional;
`f_email_i`, `f_email_r` (70); `f_end_corr` (rádio, endereço de
correspondência); privacidade por bloco (`f_priv_residencial`,
`f_priv_profissional`, `f_priv_email_*`); `f_ctr` (`U`). Os contatos
eletrônicos e redes sociais vão em grades serializadas nos ocultos
`f_dados_grid` e `f_dados_grid_contatos` (formato não lido). **Lacuna.**

### Identificação: `GN_IDENT`, POST `PRC_IDENT`

Aberto por GET `prc_ident` com `f_cod` e `f_pcd`. Nome (`f_nome` 60), nome
social, nome em citações (oculto), nacionalidade e país, CPF (oculto: não se
edita), sexo, raça ou cor, nascimento (país, UF, cidade, data), RG, passaporte,
nomes dos pais (ocultos), pessoa com deficiência (`f_pcd_r` e caixas
`f_pcd`), e uma lista de privacidade por grupo de dados.

A nacionalidade não se escolhe: o oculto `f_nacionalidade` recebe `B` ou `E`
pelo JavaScript da página, e as validações tratam `B` como brasileira (exige
CPF e RG) e `E` como estrangeira. É o `NACIONALIDADE` do XML. Os grupos de
privacidade são foto, nacionalidade, raça ou cor, nascimento, identidade,
passaporte e deficiência (`f_priv_*`, `1` público, `2` privado).
**Observado** (11/10/2026).

## 6. Primeiro envio (11/10/2026)

Um POST montado fora do formulário, com a autorização do dono do
currículo, para ver se o caminho direto funciona:

1. GET do formulário do vínculo e leitura de todos os campos que o
   navegador enviaria (os desabilitados não vão; `f_vinc` está desabilitado,
   então `f_vinculo` recebe o texto dele, como faz `check()`).
2. POST para `PKG_ATIV.VINCULOS` com os mesmos campos e só
   `f_outras_inf_en` trocado por um marcador, corpo codificado em Latin-1.
3. Novo GET do formulário: só `f_outras_inf_en` mudou.
4. Segundo POST devolvendo o valor original (vazio) e novo GET: formulário
   idêntico ao de antes.

A resposta do POST não é uma página: é um trecho de JavaScript que manda o
`iframe` pai (`modalCV2`) voltar para a grade da atuação e abre
`pkg_aviso_pendencia.inicio`, o aviso de pendências do currículo.
**Observado.** Os dois envios contam como atualização do currículo, então a
data de "última atualização" no Lattes passa a ser a do teste.

## 7. Sessão

A sessão do editor cai em poucos minutos (3 a 12 nos testes de 10/10/2026)
e passa a responder com a página de `pkg_sec.logon`. Em 11/10/2026, com a
aba aberta pelo próprio usuário, a sessão aguentou todas as leituras deste
documento. **Observado.** Abrir um segundo editor do mesmo currículo parece
derrubar o primeiro. **Inferido.**

A aba não percebe que a sessão venceu: o menu já carregado continua na tela, e
só o próximo pedido mostra que acabou. Com a sessão vencida, cada página do
`cvlattesweb` (`pkg_idioma.lista`, `pkg_impcv.get_arquivo`,
`prc_midias_sociais`, entre outras) responde só com um script que redireciona
ao login, sem formulário nenhum. **Observado** em 14/10/2026:

```html
<script>
  location = 'pkg_sec.logon?f_cod=ini';
</script>
```

O `fetch` da extensão não roda esse script, então quem lê a resposta precisa
reconhecer o redirecionamento no HTML (`isLogonPage`, em
`src/bridge/lattes-html.ts`). Sem cookie nenhum, o `PKG_MENU.menu` responde
outra coisa: um `alert("Problemas na autenticação")` antes de mandar para
`lattes.cnpq.br`. **Observado**, com um user-agent de navegador; com o do
`curl`, o Lattes devolve uma página dizendo que o navegador não é suportado.

## 8. O que ainda não se sabe

- Se o servidor revalida o que `check()` valida.
- Como `f_vinc` vira `TIPO-DE-VINCULO`, e o formato das grades de contato
  do endereço.
- O formulário de edição de uma atividade existente (`pkg_ativ.cargo` com
  `f_seq_funcao`, montado por JavaScript na grade da atuação).
- Se o POST do Exportar funciona sem o GET da tela antes (seção 12).

## 9. Vigia: saber quando o CNPq mudou algo

O CNPq não publica roadmap, changelog nem notas de versão da Plataforma
Lattes (procurado em 12/10/2026: o portal gov.br do CNPq, o Portal Memória e
a página do Extrator só trazem notícias gerais e o aviso de que o XSD foi
"atualizado em 12/09/2022"; o feed de notícias do Portal Memória parou em
2015). A única maneira de saber que algo mudou é olhar.

Duas vigias, uma para cada lado do login:

- **Público, no CI.** `scripts/vigia-lattes.ts` roda toda segunda-feira
  (`.github/workflows/vigia-lattes.yml`) e confere o XSD byte a byte contra
  `schema/CurriculoLattes_12_09_2022.xsd`, o texto "atualizado em" e o link
  na página do Extrator, a foto do perfil (`servletrecuperafoto`) e a
  entrada do Lattes. Falhou, abre ou comenta uma issue `vigia-lattes`.
- **Atrás do login, na extensão.** `src/bridge/contract.ts` guarda o que o
  conector espera encontrar: os procedimentos linkados no menu
  (`pkg_ativ.lista`, `pkg_idioma.lista`, `pkg_resume.`) e, para cada
  formulário que ela grava (seção 5), o nome, o POST e os campos com tipo e
  limite. A verificação percorre os mesmos links que a gravação percorre, só
  com GET, lê um exemplar de cada formulário e compara. Roda sozinha ao abrir
  o painel e quando o menu do Lattes carrega, três segundos depois, com uma
  segunda tentativa cinco segundos depois se a leitura falhar (a primeira,
  logo no carregamento, falhava em 13/10/2026). Repete a cada meia hora com
  tudo certo e a cada minuto com problema (`shouldAutoVerify`), e o painel só a
  mostra quando há problema, com "Verificar de novo".
  A mesma verificação roda antes de cada fila; campo sumido, tipo trocado,
  formulário ou link que não existe mais e `f_ctr` fora de `U` param a fila
  antes do primeiro POST. Se a conferência nem chega a ler (aba que não
  responde, erro de rede), a fila também para; e para se a fila tem operação
  num formulário de que o Lattes não mostrou exemplar, porque o conector só
  altera o que já existe. Campo novo e limite diferente só avisam, porque o
  conector reenvia o formulário inteiro como o leu.

O contrato foi escrito a partir das tabelas da seção 5 (11/10/2026), não de
uma captura automática. A primeira verificação num Lattes real, em
12/10/2026, voltou "como o esperado" para o menu e os três formulários, ou
seja, as tabelas estavam certas em nome, tipo e limite. Quando o relatório
apontar diferença, o contrato é corrigido junto com a tabela desta seção.

O relatório da verificação só tem nomes de campos e de procedimentos, a data
e a versão da extensão. Nenhum valor do currículo entra nele, para que possa
ser colado numa issue pública.

## 10. Exportar e alterações pendentes (12/10/2026)

O menu abre só com o cookie: `PKG_MENU.menu` sem `f_cod` mostra o currículo
de quem está logado, e o login passa pelo Keycloak de `login.cnpq.br`.
**Observado.**

O topo do menu mostra "Última atualização: <data>" e "Última publicação:
<data>", e a lista de avisos traz "Existem alterações realizadas em seu
currículo que ainda não foram enviadas ao CNPq" enquanto houver pendência.
**Observado.** A extensão lê os dois do menu que já está na aba, sem
requisição nova (`src/bridge/lattes-status.ts`). Que o aviso some depois de
"Enviar ao CNPq" é **inferido**; o menu aberto na aba também só muda quando
é recarregado, então depois de uma fila o estado pode estar defasado.

"Exportar", no menu secundário, chama
`modalCV1.setarUrl('pkg_impcv.get_arquivo?f_cod=<10 caracteres>', true)`:
um GET que carrega a tela do Exportar num `iframe` modal. **Observado.**

Com alterações ainda não enviadas ao CNPq, essa tela abre com um `alert()`
("Existem alterações realizadas no currículo que só serão aceitas quando
enviadas ao CNPq em definitivo") e não exporta. O `alert()` trava a aba até
alguém clicar em OK, inclusive para a automação do navegador. **Observado.**
Um `fetch` da mesma URL não roda o script da página, então não trava; o
conector pode ler o HTML e reconhecer o aviso.

Não há como descartar alterações pendentes. A tela de envio
(`pkg_publicar.mostrar_cv`, aberta pelo "Enviar" e pelo aviso de pendências)
só tem "Enviar ao CNPq" (formulário `publicar`, POST `pkg_publicar.enviar`,
com a concordância no `f_chk`) e "Cancelar", que fecha a tela. Nenhuma das
nove ferramentas do menu secundário desfaz alterações. Os textos com "serão
descartadas" no código da página são o aviso genérico de sair de um
formulário sem gravar. **Observado.**

Consequência para o conector: tudo o que ele grava deixa o currículo com
pendência até a pessoa enviar ao CNPq, e até lá o Exportar recusa. Abrir do
Lattes pelo conector precisa reconhecer esse estado e pedir o envio antes; não
adianta tentar de novo.

A versão atual do currículo, com o que ainda não foi enviado, sai de
`pkg_publicar.cv_espelho?f_cod=<10 caracteres>&f_idioma=1`, o link "Versão em
Português" da tela de envio (a função `portugues()` monta o endereço com
`f_idioma=1`). Abre só com o cookie e não pede código de segurança, ao
contrário do currículo público em `buscatextual.cnpq.br`. O texto segue a
ordem das seções do currículo; produções e eventos vêm em listas numeradas
("1. AUTOR; AUTOR. Título, 2005."), com o subtítulo da lista logo antes do
item 1 e linhas de detalhe depois de cada item; a página termina com "Totais
de produção" e o aviso "Este arquivo não foi gerado a partir do Currículo
Lattes validado e disponível publicamente". **Observado** pelo texto da
página; as tags que formam essas linhas são **inferidas**. O diagnóstico do
editor lê essa página (`src/bridge/espelho.ts`).

## 11. Inclusão (LAT-24, 13/10/2026)

O que o conector usaria para criar uma atuação profissional nova, e de onde
vem cada parte. Nada disso foi enviado a um Lattes real; o código está em
`src/bridge/create.ts`, desligado.

- **Observado** (reconhecimento de 10/10/2026, seção 4.1 e 4.3): o
  formulário `GN_ATIV`, aberto por `PKG_ATIV.inclui` a partir da lista de
  atuações, com `f_ctr=I` e POST para `PKG_ATIV.INCLUI`; os campos e
  limites da tabela da seção 4.1; a busca de instituição por POST para
  `PRC_INST_FORM`, cuja resposta traz `seleciona('<código>','<nome>')`; e a
  regra de que o código vai em `f_cod_inst` quando começa com V e em
  `f_cod_inst2` nos outros casos.
- **Inferido**: os valores de `F_COD` (o `f_cod` do formulário) e
  `F_NIVEL` (vazio) na busca feita fora do seletor; o texto de `f_vinc` para
  cada `TIPO-DE-VINCULO` (dos rótulos do combo; com
  `OUTRO-VINCULO-INFORMADO`, vale o texto livre); `f_vinculo` igual a
  `f_vinc`, como o `check()` faz na alteração; a resposta do POST de
  inclusão; e que a atuação nova aparece na lista com um `f_seq_ativ` novo,
  que o conector lê de volta e devolve como `SEQUENCIA-ATIVIDADE`.
- **Travas**: recusa se a lista já tem atuação na mesma instituição (seria
  duplicata), exige exatamente um resultado da busca com o código do XML,
  confere os limites, e depois do envio exige exatamente uma atuação nova
  dessa instituição, com o vínculo lido de volta igual ao enviado.
- **Desfazer**: excluir pelo conector não está mapeado para a atuação (o
  `f_ctr=E` só apareceu no código da Formação). Um item criado fica no
  registro do enviado sem "Desfazer no Lattes", com a orientação de excluir
  à mão.
- **Número do item**: a cópia de trabalho guarda o número que o editor deu.
  Até o conector reconciliar com o `SEQUENCIA-ATIVIDADE` que o Lattes devolve,
  o caminho é recarregar a exportação antes de alterar esse item pelo conector.
- **Fora por enquanto**: Formação (o curso só entra pela busca de cursos,
  não mapeada), Projetos e Patentes (formulários de inclusão não lidos).

## 12. Exportar pelo conector (LAT-22, 13/10/2026)

Com o currículo sem pendências (publicado no mesmo dia), a exportação em
XML são duas requisições, as mesmas que a tela faz. **Observado.**

1. `GET pkg_impcv.get_arquivo?f_cod=<10 caracteres>` devolve a tela do
   Exportar: o formulário `PKG_IMP` (POST para `PKG_IMPCV.get_arquivo`), com
   o rádio `f_tpo_arq` (`1` RTF, marcado por padrão; `3` XML) e os ocultos
   `f_cod` e `f_ctr`. O link "Confirmar" chama `check()`, que põe
   `f_ctr = "G"` e envia o formulário; "Cancelar" usa `f_ctr = "V"`.
2. `POST PKG_IMPCV.get_arquivo` com `f_tpo_arq=3`, `f_cod` e `f_ctr=G`
   responde `200`, `application/zip`, `Content-Disposition: attachment;
filename="CV_<16 dígitos>.zip"`, em menos de meio segundo. O ZIP tem uma
   única entrada, `<16 dígitos>.xml`, comprimida com deflate. É o mesmo
   arquivo do download pelo navegador.

A sessão continuou de pé: o menu respondeu logo depois e cinco minutos
depois do POST. **Observado** uma vez; a queda de 10/10/2026, cerca de três
minutos depois de abrir o Exportar, segue sem causa conhecida.

Se o POST sem o GET da tela antes também funciona não foi testado. O conector
faz os dois, e o GET ainda serve para reconhecer, sem `alert()`, a sessão
caída e a pendência (seção 10). O caminho está em `src/bridge/export.ts`.

## 13. Importar pelo conector: passos 1 e 2 (13/10/2026)

O menu leva ao Importar por `pkg_importa_xml.inicio?f_cod=<10 caracteres>`.
**Observado.**

**Passo 1.** A tela tem o formulário `fl`, POST multipart para
`pkg_importa_xml.inicio`, com o arquivo em `file` e os ocultos `f_cod`,
`f_ctr=I` e `f_ret` (vazio). O botão "Enviar" chama `check()`, que só confere
se há arquivo e se o nome termina em `.xml`, e então envia o formulário.
**Observado.**

O teste enviou um arquivo gerado pelo próprio caminho do editor
(`buildImportFile`, a opção 2: o currículo inteiro mais o item novo), com
uma participação em congresso nova: NATUREZA "Congresso", PAIS "Alemanha",
IDIOMA "Inglês", FORMA-PARTICIPACAO "Participante", TIPO-PARTICIPACAO
"Apresentação oral". O POST feito de dentro da página, com `FormData` e o
cookie da sessão, foi aceito como o do botão. **Observado.**

**Passo 2.** A resposta ao passo 1 é a tela de seleção, o formulário
`pkg_imp_xml`, POST (urlencoded) para `pkg_importa_xml.mostra_modulos`, com:
**Observado.**

- `f_cod`, `f_solic` (o número da solicitação criada pelo passo 1) e
  `f_ctr` (vazio até a ação);
- uma caixa `f_chkp` por módulo, com o valor na ordem da tela: 1 Artigos
  completos publicados, 2 Artigos aceitos, 3 Livros e capítulos, 4 Trabalhos
  em anais, 5 Texto em jornal ou revista, 6 Apresentação de Trabalho, 7
  Outras produções bibliográficas, 8 Softwares, 9 Produtos, 10 Processos, 11
  Trabalhos técnicos, 12 Outras produções técnicas, 13 Produção
  artística/cultural, 14 Orientações e Supervisões, 15 Demais Trabalhos, 16
  Eventos, 17 Bancas (e `f_all`, "Selecionar todos");
- `f_ano_prod`, "Produção C&T a partir de", com os anos 2026, 2007, 2006,
  2005 e 2004 e 2026 marcado. Que a lista são os anos das produções do
  arquivo, e o padrão o mais recente, é **inferido**;
- "Confirmar" (`enviar()`): exige ao menos um módulo marcado, põe
  `f_ctr=I` e envia; "Descartar" (`excluir()`): pede confirmação, põe
  `f_ctr=D` e envia.

O passo 2 não mostra os itens: ver como o Lattes trata os valores do item
(e a "lista vermelha" do passo seguinte) pede o Confirmar, que o teste não
fez. Se "Participante", "Apresentação oral", "Alemanha" e "Inglês" entram
como estão continua **inferido**.

O passo 1 cria uma solicitação de importação no servidor, que fica pendente:
a tela diz "Existe solicitação de Importação de XML pendente", e reabrir o
Importar leva direto ao passo 2 dela. Nada muda no currículo: depois do
passo 1, o menu seguiu sem o aviso de alterações não enviadas ao CNPq e com a
mesma "Última atualização". **Observado.** A solicitação do teste ficou
pendente, à espera de Confirmar ou Descartar.

Consequência para o conector: os passos 1 e 2 cabem em dois POSTs de dentro
da aba do Lattes, como o Exportar (seção 12), com os módulos marcados pelo
que o arquivo traz (`ImportFile.modules`) e o ano a partir do item novo mais
antigo. O que vem depois do Confirmar (passo 3 e o resultado) ainda precisa
ser observado com a pessoa acompanhando.

## 14. Foto do currículo (13/10/2026)

A foto do menu é trocada pela janela "Enviar sua foto" (`fotoWin`, um
`$.win` do jQuery no próprio menu), que carrega
`prc_upload_foto?f_cod=<10 caracteres>&f_ret=MENU` e tem os botões "Salvar"
(`checkFoto()`) e "Excluir" (`excluirFoto()`). **Observado.**

O conteúdo é o formulário `fl`, POST multipart para `PRC_UPLOAD_FOTO`, com
`file` (aceita `image/jpg,image/jpeg`), `f_cod`, `f_ctr` e `f_ret=MENU`. A
tela pede "uma imagem no formato JPEG com tamanho de até 70kB". **Observado.**

- `checkFoto()` põe `f_ctr=I`, recusa nome sem `.JPG` ou `.JPEG` e chama
  `enviarFoto()`; `excluirFoto()` põe `f_ctr=E` e chama a mesma função.
- `enviarFoto()` envia por `ajaxSubmit` (jQuery Form) e, se a resposta trouxer
  `success`, recarrega a imagem de `pkg_util_img.show_foto?v_cod=...&ts=...`;
  senão, mostra `message`. Que a resposta seja um objeto com `success` e
  `message` é **inferido** do código: nenhum envio foi feito.
- Não há recorte nem passo de confirmação.

Se trocar a foto deixa o currículo com alteração pendente de envio ao CNPq
não foi testado.

Consequência para o editor: trocar a foto pelo conector é um POST multipart
de dentro da aba do Lattes, com a imagem já em JPEG de até 70 kB. O editor
precisa reduzir e comprimir a imagem antes (canvas), e a extensão precisa de
uma mensagem nova para levar os bytes até a aba.

## 15. Exclusão (LAT-49, 13/10/2026)

Como cada seção do Lattes exclui um item, lido sem excluir nada: só GETs das
listas do menu e dos formulários de edição que as linhas da lista abrem, e
leitura do HTML e do JavaScript deles. Nenhum botão de excluir foi clicado e
nenhum `confirm()` foi respondido. Antes e depois, o menu seguiu sem o aviso
de alterações não enviadas ao CNPq e com "Última atualização: 13/10/2026".

**Observado**: as 90 listas do menu (27 procedimentos distintos, os outros
variam só no tipo, como `f_cod_tipo`) não têm controle de exclusão nas
linhas. A exclusão fica sempre no formulário de edição do item, num botão
"Excluir" (`<span class="botao excluir">`, link com `onclick="del(); return false;"`).
Só 8 listas têm item neste currículo; nas outras 82 há apenas os links de
inclusão, sem `f_seq`, e a exclusão delas não pôde ser lida.

O padrão comum, **observado** no código das 8:

```js
function del() {
  if (confirm('\n\nDeseja realmente excluir esta produção?\n\n')) {
    fecha(); // nem todos chamam
    dc.f_ctr.value = 'E';
    enviar(); // ou dc.submit()
  }
}
```

`dc` é o formulário da tela, o mesmo da alteração: POST para o próprio
procedimento (seção 2) com `f_ctr` trocado de `U` para `E` e os campos do
item como estão, entre eles `f_cod` e `f_seq`. Que o servidor exclua com esse
POST e o que ele responde são **inferidos**: nada foi enviado. Também é
**inferido** que o POST de exclusão aceite só `f_ctr`, `f_cod` e `f_seq`, sem
os outros campos do formulário.

| Módulo (lista)                                                                | Onde fica a exclusão                             | Requisição                                                                                                            | Parâmetros                                                                                | Texto do confirm                                                                                                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Idiomas (`pkg_idioma.lista`)                                                  | formulário `pkg_idioma.form`                     | POST `PKG_IDIOMA.FORM` (`GN_IDIOMA`), por `dc.submit()`                                                               | `f_ctr=E`, `f_cod`, `f_seq`                                                               | "Você realmente deseja excluir este Idioma?"                                                                                                     |
| Prêmios e títulos (`pkg_premio.lista`)                                        | formulário `pkg_premio.form`                     | POST `pkg_premio.form` (`GN_PREMIO`)                                                                                  | `f_ctr=E`, `f_cod`, `f_seq`                                                               | "Você realmente deseja excluir este Prêmio/Titulo?"                                                                                              |
| Formação acadêmica/titulação (`pkg_formacao.lista`)                           | formulário `pkg_formacao.form`                   | POST `pkg_formacao.FORM` (`GN_FORMACAO2`); antes, às vezes, POST ajax `PKG_FORMACAO.SETA_ULTIMO_PUBLICO`              | `f_ctr=E`, `f_cod`, `f_seq`, `f_tipo` (FA); no ajax, `f_cod`, `f_seq`, `f_tipo`, `f_op=E` | "Deseja realmente excluir esta formação acadêmica?"                                                                                              |
| Formação complementar (`pkg_formacao_compl.lista`)                            | formulário `PKG_FORMACAO_COMPL.form`             | POST `PKG_FORMACAO_COMPL.FORM2` (`GN_FORMACAO2`); antes, às vezes, POST ajax `PKG_FORMACAO_COMPL.SETA_ULTIMO_PUBLICO` | `f_ctr=E`, `f_cod`, `f_seq`, `f_tipo`; no ajax, `f_cod`, `f_seq`, `f_op=E`                | "Você realmente deseja excluir esta formação acadêmica?"                                                                                         |
| Atuação profissional, vínculo (`pkg_ativ.lista` > `PKG_ATIV.cargos_vinculos`) | formulário `PKG_ATIV.vinculos`                   | POST `PKG_ATIV.VINCULOS` (`GN_ATIV_VINC`)                                                                             | `f_ctr=E`, `f_cod`, `f_codinst`, `f_seq_ativ`, `f_seq_hist`                               | "Deseja realmente excluir este vínculo?"                                                                                                         |
| Atuação profissional, a atuação inteira                                       | tela `PKG_ATIV.cargos_vinculos`, função `dele()` | **GET** `pkg_ativ.form` por `location=`                                                                               | `f_cod`, `f_seq_ativ`, `f_ctr=E2`                                                         | dois em seguida: "Esta operação apagará: Todas as atividades; Vínculos; Projetos; Linhas de pesquisa. Deseja continuar?" e "Confirmar exclusão?" |
| Trabalhos técnicos (`pkg_relatorio.lista`)                                    | formulário `pkg_relatorio.form`                  | POST `PKG_RELATORIO.FORM` (`GN_RELATORIO`)                                                                            | `f_ctr=E`, `f_cod`, `f_seq`                                                               | "Deseja realmente excluir esta produção?"                                                                                                        |
| Produção técnica, Editoração (`prc_tec_demais_lista`, `f_cod_tipo=2D`)        | formulário `prc_tec_edit`                        | POST `PRC_TEC_EDIT` (`GN_TEC`)                                                                                        | `f_ctr=E`, `f_cod`, `f_seq`                                                               | "Deseja realmente excluir esta produção?"                                                                                                        |
| Participação em eventos (`pkg_evento.lista`)                                  | formulário `PKG_EVENTO.form`                     | POST `PKG_EVENTO.FORM` (`GN_TEC`)                                                                                     | `f_ctr=E`, `f_cod`, `f_seq`                                                               | "Deseja realmente excluir esta produção?"                                                                                                        |

Os textos dos `confirm()` estão sem as quebras de linha do original. Vários
formulários guardam, comentada, uma versão antiga do texto ("Você realmente
deseja excluir esta produção?"); a tabela traz a que está ativa.

Pontos fora do padrão, todos **observados** no código:

- **Atuação inteira por GET.** Excluir a atuação (a instituição, com tudo o
  que pende dela) não é um POST: a função `dele()` da tela de cargos e
  vínculos navega para `pkg_ativ.form` com `f_ctr=E2` na URL, depois de dois
  `confirm()`. O primeiro avisa que a exclusão leva junto atividades,
  vínculos, projetos e linhas de pesquisa. É o `E2` que a seção 2 já citava.
  Isso corrige o "Desfazer" da seção 11: a exclusão da atuação está mapeada,
  mas apaga em cascata, e o conector não deve usá-la para desfazer uma
  inclusão sem que a pessoa veja esse aviso.
- **Formação mexe na visibilidade antes de excluir.** Nas duas formações,
  quando `contPriv` é `"0"` (**inferido**: nenhuma outra formação pública), o
  `del()` faz antes um POST síncrono para `SETA_ULTIMO_PUBLICO` com
  `f_op=E`. A resposta `SETOU` vira o alerta "É necessário que pelo menos
  uma formação acadêmica tenha visibilidade Público. Sua última formação
  acadêmica concluída foi alterada para Público."; `ULTIMO` segue sem aviso;
  outra resposta mostra "Ocorreu um erro!" e para. Ou seja, excluir uma
  formação pode tornar pública outra.
- **Formação complementar posta para `FORM2`**, não para o procedimento que
  desenha a tela, e o `f_ctr` do formulário vem sem valor (nas outras vem
  `U`).
- **`enviar()` varia pouco**: em Idiomas o `del()` chama `dc.submit()` direto;
  nas outras, `enviar()`, que fecha a janela (`fecha()`) e faz `dc.submit()`.
  Prêmios não tem `fecha()`.

Consequência para o conector: na maioria das seções, excluir é o mesmo POST
da alteração com `f_ctr=E`, a partir de um formulário de edição carregado
por GET (que traz `f_cod` e `f_seq`). As duas formações e a atuação inteira
pedem tratamento próprio. O que ainda falta observar é a resposta do
servidor a uma exclusão e se ela deixa o currículo com alteração pendente
de envio ao CNPq; isso só com a pessoa acompanhando, num item de teste.
