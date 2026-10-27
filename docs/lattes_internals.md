# Como o editor do Currículo Lattes funciona por dentro

O editor web do Lattes (`wwws.cnpq.br/cvlattesweb`) por dentro, para quem
mexe no conector. O reconhecimento foi feito na sessão logada do próprio
dono do currículo: quase sempre só com leitura (páginas baixadas por GET), e,
onde a seção diz, com um envio acompanhado num item de teste. A seção 23
também confere a estrutura de XMLs públicos, sem acessar sessão alguma.
Cada seção traz a
data; o primeiro reconhecimento é de 10/10/2026, os formulários de edição
são de 11/10/2026, e as seções 16 a 22 vão de 14 a 21/10/2026.

Cada afirmação vem marcada como **observado** (visto no HTML, nos scripts ou
no comportamento do servidor) ou **inferido** (conclusão a partir do que foi
observado, ainda não confirmada). O código cita estas seções pelo número:
elas não são renumeradas.

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
- **Extensão** (`extension/`): o service worker guarda a fila, que o editor
  inicia em "Enviar ao Lattes". O `lattes-runner` roda dentro da aba do
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

| Modal      | Papel                                 | Exemplo                                                    |
| ---------- | ------------------------------------- | ---------------------------------------------------------- |
| `modalCV1` | Lista da seção                        | `pkg_ativ.lista`, `pkg_formacao.lista?f_tipo=FA`           |
| `modalCV2` | Formulário de inclusão ou edição      | `PKG_ATIV.inclui`, `pkg_formacao.form?f_tipo=FA&f_nivel=9` |
| `modalCV3` | Buscas                                | `prc_inst_form`, `prc_inst_ativ`                           |
| `caixaMsg` | Confirmação e combo da própria página | aviso de alterações não salvas, seletor de nível           |

Abrir uma seção é `modalCVn.setarUrl(url, true)`; a página filha chama
`self.parent.modalCVn.habilitaModal()` quando fica pronta e alcança o
formulário pai por `self.parent.modalCV2.getDocument().document.forms[0]`.
Há `alert()` e `confirm()` por toda parte (digitar uma instituição à mão,
excluir, sair com alterações, o logout); eles travam automação que conduz a
interface, e o conector os evita porque lê e envia por `fetch`, que não roda
os scripts da página. **Observado** (10/10/2026).

### Catálogo de procedimentos (10/10/2026)

- Dados gerais: `prc_ident`, `prc_endereco`, `pkg_formacao.lista`
  (`f_tipo=FA` acadêmica, `AP` pós-doutorado e livre-docência),
  `pkg_formacao_compl.lista`, `pkg_idioma.lista`, `pkg_premio.lista`,
  `prc_area_atuacao`, `pkg_resume.form`, `prc_outras_inf`,
  `pkg_licenca.lista`.
- Atuação: `pkg_ativ.lista`, `pkg_linhapesq.lista`, `pkg_revisor.lista`
  (corpo editorial, revisor de periódico, comitê de assessoramento, revisor
  de agência), `pkg_projeto.lista`.
- Produção bibliográfica: `pkg_artigo.lista`, `pkg_artigo_pr.lista`
  (aceitos), `pkg_lvr_cap.lista`, `pkg_trabalho.lista` (anais),
  `pkg_texto.lista`, `prc_bib_demais_lista` (prefácio, tradução, partitura,
  outras).
- Produção técnica: `PKG_PATENTE_REGISTRO.LISTA` (patente, software,
  cultivar, desenho industrial, marca, topografia), `pkg_produto.lista`,
  `pkg_processo.lista`, `pkg_relatorio.lista` (trabalhos técnicos),
  `prc_tec_demais_lista`, `PKG_ASSESSORIA_CONSULTORIA.lista`,
  `PKG_EXTENSAO_TECNOLOGICA.lista`.
- Artística: `pkg_arte_nova.lista`, `prc_arte_lista`. Orientações:
  `pkg_orient.lista`. Bancas: `pkg_banca_trab.lista`, `pkg_banca_julg.lista`.
  Eventos: `pkg_evento.lista`. Demais trabalhos: `pkg_demais.lista`.
- Dicionários: `pkg_dic_autor.lista`, `pkg_identificacao_coautor.form`,
  `pkg_dic_plv_nv.lista`, `pkg_dic_area.lista`,
  `pkg_dic_instituicao_nova.lista`, `pkg_alteracao_periodico.lista`.
- Ferramentas: `pkg_impcv.form` (Imprimir), `pkg_impcv.get_arquivo`
  (Exportar), `pkg_importa_xml.inicio` (Importar), `pkg_import_cv.lista`
  (cópia de item de coautor), `PKG_IMPORT_ASSISTENTE.lista` (só teses e
  dissertações do Oasisbr), `pkg_publicar.mostrar_cv` (Enviar ao CNPq).

## 5. Formulários de edição (11/10/2026)

Nomes, tipos e limites lidos do HTML. Campos ocultos de controle (`f_cod`,
chaves, `*_old`) aparecem no fim de cada lista.

### Vínculo de uma atuação: `GN_ATIV_VINC`, POST `PKG_ATIV.VINCULOS`

Aberto por GET `PKG_ATIV.vinculos` com `f_cod`, `f_codinst`, `f_seq_ativ` e
`f_seq_hist` (sem `f_seq_hist`, abre um vínculo novo).

| Campo                                                                        | Tipo                              | XML (`VINCULOS`)                                                                                |
| ---------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `f_vinc`                                                                     | texto 30                          | `TIPO-DE-VINCULO` / `OUTRO-VINCULO-INFORMADO` (o formulário guarda o rótulo; ver nota)          |
| `f_stavinc`                                                                  | lista: vazio, `0`, `1`            | `FLAG-VINCULO-EMPREGATICIO`, **invertido**: `1` (Sim) sai `NAO`, `0` (Não) sai `SIM` (ver nota) |
| `f_enqua`                                                                    | texto 45                          | `OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO`                                                       |
| `f_enqua_en`                                                                 | texto 45                          | `OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO-INGLES`                                                |
| `f_carga`                                                                    | texto 3                           | `CARGA-HORARIA-SEMANAL`                                                                         |
| `f_regime`                                                                   | caixa, valor `3`                  | `FLAG-DEDICACAO-EXCLUSIVA` (marcada = sim)                                                      |
| `f_mes_ini`, `f_ano_ini`                                                     | texto 2, 4                        | `MES-INICIO`, `ANO-INICIO`                                                                      |
| `f_status`                                                                   | rádio `S` = Atual, `N` = Anterior | atual quando `ANO-FIM` é vazio                                                                  |
| `f_mes_fim`, `f_ano_fim`                                                     | texto 2, 4                        | `MES-FIM`, `ANO-FIM`                                                                            |
| `f_outras_inf`                                                               | área 3950                         | `OUTRAS-INFORMACOES`                                                                            |
| `f_outras_inf_en`                                                            | área 2000                         | `OUTRAS-INFORMACOES-INGLES`                                                                     |
| `f_tipo_privacidade`                                                         | lista `1` público, `2` privado    | sem correspondente no XML                                                                       |
| `f_ctr` (`U`), `f_vinculo`, `f_cod`, `f_codinst`, `f_seq_ativ`, `f_seq_hist` | ocultos                           |                                                                                                 |

**Invertido, observado em 15/10/2026.** O `f_stavinc` ("Possui vínculo
empregatício") é o contrário de `FLAG-VINCULO-EMPREGATICIO` na exportação. A
passada de edição do censo (seção 20) casou os 8 vínculos do dono do
currículo com `f_stavinc` `0` ↔ `SIM` e `1` ↔ `NAO`, e a tela confirmou um
deles: o Lattes mostra "Sim" (`f_stavinc=1`, `selected` no HTML) e a
exportação, lida também pelo editor, traz `NAO`. Até 15/10/2026 esta tabela
dizia `1` = sim: a conferência do "antes" falharia em toda alteração desse
campo e, se passasse, a gravação trocaria o valor real da pessoa. A
dedicação exclusiva não inverte: `f_regime` desmarcado no Lattes sai `NAO`.
Por que o Lattes grava assim não se sabe. O conector traduz os dois
sentidos em `src/bridge/vinculo-flag.ts`, e o Lattes simulado usa um mapa
literal próprio, para que um confira o outro.

Nota sobre o tipo de vínculo: `check()` copia o texto de `f_vinc` para o
oculto `f_vinculo` antes de enviar, e o texto vem de uma lista em
`dominio()` (Servidor público, Celetista, Professor visitante, Bolsista,
Outro). Como esse texto vira o código `TIPO-DE-VINCULO` do XML não foi
visto. **Lacuna.**

Regras de `check()` (mensagens do próprio Lattes): tipo do vínculo e início
obrigatórios; fim obrigatório quando o status é Anterior e proibido quando é
Atual; início antes do fim; nenhuma data no futuro; início não anterior ao
nascimento.

O conector acha o vínculo pela atuação (`f_seq_ativ` e o código da
instituição no link, quando o XML o traz) e pelo `f_seq_hist`, e antes de
gravar confere o início (mês e ano) e, quando a operação não os troca, o fim e
a carga horária, sem acento, caixa nem espaço nas pontas (ligações observadas
nos 8 vínculos do censo de 15/10/2026). Assim, um número de vínculo que não
seja o do item não leva a gravação para outro vínculo do mesmo início.

### Formação acadêmica: `GN_FORMACAO2`, POST `pkg_formacao.FORM`

Aberto por GET `pkg_formacao.form` com `f_cod`, `f_seq` e `f_tipo` (`FA`).
Mesmos campos do formulário de inclusão (seção 17), com `f_ctr=U`, `f_seq`
preenchido e `f_nivel` com o código do nível (`3` = mestrado). `F_STATUS` usa `N` em andamento, `S` concluído, `I`
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
- Pós-doutorado e livre-docência (`pkg_formacao.form` com `f_tipo=AP`, lido
  em 15/10/2026): `f_nivel` 5 é pós-doutorado e 6 livre-docência. O
  formulário de inclusão do pós-doutorado mostra só instituição, rádio
  `F_STATUS` do status do curso (`N` em andamento, `S` concluído, `I`
  incompleto), início e conclusão (ano), rádio `F_BOLSA`, agência financiadora
  e áreas. Título do trabalho (`f_titulo`), ano e mês de obtenção
  (`f_ano_obten`, `f_mes_obten`), orientador e curso vão ocultos. Status do
  estágio, título em inglês e nome do curso em inglês não aparecem. O valor de
  `F_STATUS` no XML não foi conferido numa exportação.
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

A instituição e o órgão do endereço profissional vêm desabilitados (`f_inst`,
`f_orgao`) e só mudam pelas janelas de busca da página, lidas em 20/10/2026
(seção 18, "Endereço profissional"): a de instituição posta para
`PRC_INST_ATIV` e grava `f_inst`, `f_inst_old`, `f_cod_inst` ou
`f_cod_inst2`; a de órgão é `prc_orgao_cargo` e grava `f_orgao`,
`f_orgao_old`, `f_codorgao` ou `f_codorgao2`. **Observado.**

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

### Outras informações relevantes: `GN_OUTRA_INF_RELEV`, POST `PRC_OUTRAS_INF`

Aberto por GET `prc_outras_inf` no menu. Um texto só, `F_TEXTO` (área de
2000 caracteres), e os ocultos `f_cod` e `f_ctr` (`U`). **Observado** no
censo de 15/10/2026. Que o texto seja o atributo `OUTRAS-INFORMACOES-RELEVANTES`
do elemento de mesmo nome é **inferido**: o censo ligou o formulário ao
elemento só pelo nome, e o currículo lido não tinha o texto preenchido.

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
derrubar o primeiro, o que explicaria as quedas rápidas de 10/10; o dono do
currículo vê a sessão durar horas. **Inferido.** Quanto ela dura parada não
foi medido.

Para a sessão não cair enquanto o app está aberto, a extensão pede uma
página pequena a cada 20 minutos (`src/bridge/keepalive.ts`). As menores
páginas da sessão medidas em 27/10/2026, por GET: `pkg_linhapesq.lista`
(4.141 bytes), `pkg_demais.lista` (4.149), `pkg_texto.lista` (4.215) e
`pkg_licenca.lista` (4.282), num currículo sem itens nessas listas; o tamanho
cresce com os itens. **Observado.**

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
- Como `f_vinc` vira `TIPO-DE-VINCULO`.
- Se o POST do Exportar funciona sem o GET da tela antes (seção 12).
- Por que um item confirmado no passo 3 do Importar some (seção 13, item 8),
  e o limite superior de `SEQUENCIA-PRODUCAO`.
- Como a exportação grava a PCD com mais de um tipo marcado, e mais de um
  depositante numa patente (seção 17). Com um tipo só, a exportação de
  27/10/2026 trouxe o rótulo da caixa (`PCD="Deficiência Visual"`), e duas
  redes sociais vieram coladas em `REDE-SOCIAL`, sem separador: o "ID Rede
  Social" da segunda começa logo depois do endereço da primeira. **Observado.**

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
requisição nova (`src/bridge/lattes-status.ts`). O menu aberto na aba só
muda quando é recarregado, então depois de uma fila o estado pode estar
defasado. Que o aviso some depois de "Enviar ao CNPq" foi **observado** em
14/10/2026 (abaixo).

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
só tem "Enviar ao CNPq" (formulário `publicar`, com a concordância no
`f_chk`; o `enviar()` da página navega por GET para `pkg_publicar.enviar`,
ver abaixo) e "Cancelar", que fecha a tela. Nenhuma das
nove ferramentas do menu secundário desfaz alterações. Os textos com "serão
descartadas" no código da página são o aviso genérico de sair de um
formulário sem gravar. **Observado.**

Consequência para o conector: tudo o que ele grava deixa o currículo com
pendência até a pessoa enviar ao CNPq, e até lá o Exportar recusa. Abrir do
Lattes pelo conector precisa reconhecer esse estado e pedir o envio antes; não
adianta tentar de novo. A edição e a exclusão de um evento pelo formulário
acendem a pendência (seção 16, 14/10/2026). **Observado.**

O Exportar entrega a versão publicada, não a de trabalho: um item que entrou
pelo Importar, que não acende a pendência, não aparece numa exportação feita
logo depois (seção 13, 14/10/2026). **Observado.**

E não a última publicada, logo depois de publicar: em 18/10/2026, com o menu
sem pendência depois de envios ao CNPq às ~21h, as exportações das 21h36 e
das 22h03 vieram as duas com `HORA-ATUALIZACAO="190436"`, sem uma rede social
incluída e com itens excluídos antes da publicação. A versão atual
(`pkg_publicar.cv_espelho`) já mostrava tudo. Quanto tempo o Exportar leva
para acompanhar não foi medido. **Observado.** Para o editor: uma exportação
logo depois de publicar pode trazer um currículo atrasado.

Em 27/10/2026, com um envio ao CNPq pelo editor por volta das 12h20 (o menu
passou a mostrar "Última publicação: 27/10/2026"), o Exportar seguiu
entregando o arquivo com `DATA-ATUALIZACAO="22102026"` em pedidos a cada 5
minutos, até pelo menos as 13h51. **Observado.** O editor avisa no sino
quando o arquivo aberto é anterior à última publicação do menu
(`staleExportNotice`, `src/ui/notifications.ts`).

**Enviar ao CNPq** (14/10/2026, feito pela pessoa, com a página observada só
lendo). **Observado.**

- A tela é `pkg_publicar.mostrar_cv?f_cod=…`, aberta no modal. O formulário
  `publicar` declara só `f_chk` (a declaração); o `enviar()` da página monta
  o resto.
- Antes do envio, a página faz três POSTs ajax:
  `pkg_publicar.racapreenchida_raca_cor` com `f_cod`, que responde
  `{"status": true}`, e `pkg_util.existe_email_cadastrado` com `f_email` e
  `f_cod`, uma vez para o e-mail de contato e outra para o alternativo
  (vazio), que responde `{"existe":false ,"mensagem":"Email não encontrado"}`.
- O envio é um **GET** para `pkg_publicar.enviar` com `f_chk=1`,
  `f_idioma=1` (português; `2` seria inglês, **inferido**), `f_chk_en=1`
  (autoriza a versão em inglês), `f_email_contato`, `f_email_alternativo`,
  `f_cod` e `f_ctr=U`. Levou cerca de 18 segundos.
- A resposta é uma página com o `alert("O currículo foi enviado para
publicação.")`, que trava a aba até alguém clicar em OK (um `fetch` não roda
  o script). A página traz também um `enviar()` que navegaria para
  `pkg_publicar.salvar` com os mesmos campos menos `f_chk`; quando ele é
  chamado não foi visto.
- Depois, o menu mostra "Última atualização" e "Última publicação" na data do
  dia, sem o aviso de pendência, e o Exportar volta a exportar.

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

**As listas como segunda leitura (21/10/2026).** A página de conferência só
deixa casar produções e eventos com a exportação, porque as outras seções saem
como texto corrido. As listas que o menu do currículo abre (as mesmas da base
dos itens de teste, `src/bridge/cv-lists.ts`, só GET e nunca endereço com
`f_ctr`) trazem uma linha por item em todas as seções. Formatos **observados**
no Lattes real, com dados trocados aqui:

- atuação (`pkg_ativ.lista`): "Empresa Exemplo Ltda. SIGLA De 2011 até 2012";
- vínculos de uma atuação (`pkg_ativ.cargos_vinculos?f_seq_ativ=N`):
  "01/2011 12/2012 Cargo", o período abrindo a linha;
- formação (`pkg_formacao.lista`): "2006... 2007 Mestrado Universidade";
- evento (`pkg_evento.lista`, que repete na lista de divulgação científica):
  "Nome do Evento Ouvinte 2007 -";
- produções: o título, o tipo e o ano.

São mais de 120 listas, acima do limite de 100 pedidos por tarefa do
conector (`src/bridge/transport.ts`), então a extensão lê a página de
conferência numa tarefa e as listas em partes de 60
(`extension/src/read-cv-lists.ts`), uma lista por vez. O diagnóstico compara
por essas listas quando a extensão as traz (`src/review/lists-diff.ts`),
procurando cada item pelo nome e pelo ano, em palavras inteiras. Lista que
falhou, que não abriu ou que veio vazia com itens na exportação deixa a seção
como "não comparada" em vez de dar os itens como tirados; o mesmo vale para
os vínculos de uma atuação sem página e para lista que a comparação não
conhece. Extensão anterior a isso só manda a página de conferência, e o
diagnóstico diz que comparou só produções e eventos.

**No conector** (`src/bridge/publish.ts`, habilitado por `PUBLISH_ENABLED`),
o caminho abaixo está coberto no Lattes simulado. A integração completa do
app ao CNPq ainda não foi validada num envio acompanhado; essa validação
continua pendente antes do lançamento.

1. GET de `pkg_publicar.mostrar_cv`, que o editor mostra antes do envio: o
   texto ao lado da caixa `f_chk` como declaração, o link "Termo de Uso", e os
   controles `f_idioma`, `f_chk_en`, `f_email_contato` e
   `f_email_alternativo`, se a tela os tiver. Que a tela tenha controles com
   os nomes dos parâmetros do GET, e que a declaração seja o texto ao lado da
   caixa, é **inferido**. Sem declaração legível, o editor não envia; sem o
   link do Termo de Uso, também não.
2. A caixa da declaração começa desmarcada a cada abertura do painel, não é
   guardada e só a pessoa a marca. Sem ela marcada, nem o editor, nem a
   extensão, nem o núcleo na aba iniciam a publicação.
3. Os dois POSTs ajax, na ordem da página. `{"status": false}` na consulta de
   raça ou cor e `"existe": true` na de e-mail param o envio e mandam a pessoa
   à tela do Lattes; o que cada um quer dizer é **inferido** do nome do
   procedimento. Uma resposta que não é esse JSON também para.
4. O GET de `pkg_publicar.enviar` com os parâmetros na ordem observada. Só o
   que foi observado vai: `f_chk_en=1`. Para não autorizar a versão em inglês,
   o editor manda a pessoa à tela do Lattes. `f_idioma` sai das opções da
   própria tela; `2` para inglês continua **inferido**.
5. A conferência é pelo menu (`PKG_MENU.menu`), relido até quatro vezes com 3
   segundos entre elas: "Última publicação" de hoje e sem o aviso de
   pendência. O alerta da resposta não conta como prova.
   Mesmo sem resposta do pedido de envio, o núcleo tenta ler o menu, sem
   repetir a publicação. Sem confirmação, o botão continua bloqueado até
   reabrir o painel e conferir o estado no Lattes.

Os links "Ver a versão em português" e "em inglês" do painel abrem a página de
conferência com `f_idioma=1` e `f_idioma=2` (este **inferido**).

## 11. Inclusão (LAT-24, 13/10/2026)

O que o conector usa para criar uma atuação profissional nova
(`src/bridge/create.ts`), e de onde vem cada parte. A passada de itens de
teste criou e removeu itens de cada formulário de inclusão no Lattes real
(18/10/2026, `lattes-formularios/itens-de-teste.md`); a resposta do POST de
inclusão e o número da atuação nova, lidos pelo conector, seguem inferidos.

- **Observado** (10/10/2026): o formulário `GN_ATIV`, aberto por
  `PKG_ATIV.inclui` a partir da lista de atuações, com `f_ctr=I` e POST para
  `PKG_ATIV.INCLUI`; a busca de instituição por POST para `PRC_INST_FORM`,
  cuja resposta traz `seleciona('<código>','<nome>')`; e a regra de que o
  código vai em `f_cod_inst` quando começa com V e em `f_cod_inst2` nos
  outros casos (seção 18). Os campos:

  | Campo                                                          | Tipo                           | Observações                                                                                                |
  | -------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
  | `f_inst`                                                       | texto 75                       | Só pela busca; digitar à mão dispara `alertainst()`, que restaura `f_inst_old`                             |
  | `f_cod_inst`, `f_cod_inst2`, `f_instold`, `f_inst_old`         | ocultos                        | Código (V em `f_cod_inst`, os outros em `f_cod_inst2`) e valor anterior                                    |
  | `f_vinc`, `f_vinculo`                                          | texto 30, oculto               | Tipo do vínculo pelo combo `dominio()` (Servidor público, Celetista, Professor Visitante, Bolsista, Outro) |
  | `f_stavinc`                                                    | lista: vazio, `0` Não, `1` Sim | Possui vínculo empregatício (invertido na exportação, seção 5)                                             |
  | `f_enqua`, `f_carga`, `f_regime`                               | texto 45, texto 3, caixa       | Enquadramento, carga horária semanal, dedicação exclusiva                                                  |
  | `f_mes_ini`, `f_ano_ini`, `f_status`, `f_mes_fim`, `f_ano_fim` | texto 2 e 4, rádio S/N         | Ano de início obrigatório; S atual, N anterior                                                             |
  | `f_outras_inf`                                                 | área 3950                      |                                                                                                            |
  | `f_tipo_privacidade`                                           | lista 1/2                      | `verificaPriv()` força Público se for o único vínculo                                                      |
  | `f_ctr`, `f_cod`, `f_codinst`, `f_seq_ativ`, `f_seq_hist`      | ocultos                        | Operação e chaves                                                                                          |

  Editar uma linha existente abre
  `PKG_ATIV.cargos_vinculos?f_cod=…&f_codinst=…&f_seq_ativ=N` no `modalCV2`;
  reordenar é `PKG_ATIV.ordenar`.

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
- **Formação e projeto** (LAT-52): com o mapa das seções 17 e 18, as
  inclusões estão em `src/bridge/create-formacao.ts` e
  `src/bridge/create-projeto.ts`. A patente continua fora: a consulta
  `verifica_cadastrado` e o formulário com `f_ctr=R` não foram enviados.

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

O POST só funciona em `/cvlattesweb/PKG_IMPCV.get_arquivo`: feito a partir de
uma página em `/curriculoweb/`, o `fetch` falha com "Failed to fetch"
(14/10/2026). **Observado.** O editor responde nas duas bases; a causa da
falha (redirecionamento ou CORS) é **inferida**.

Se o POST sem o GET da tela antes também funciona não foi testado. O conector
faz os dois, e o GET ainda serve para reconhecer, sem `alert()`, a sessão
caída e a pendência (seção 10). O caminho está em `src/bridge/export.ts`.

## 13. Importar pelo conector: passos 1 e 2 (13/10/2026)

**O contrato do Importar (testado à mão em 10/10/2026, no currículo do dono,
com itens falsos excluídos depois).** **Observado.**

- O passo 1 aceita só um `.xml` puro; o ZIP que o Exportar gera é recusado.
- O passo 2 tem uma caixa por módulo, todas marcadas, e o filtro "Produção
  C&T a partir de", derivado do arquivo.
- O passo 3 lista item a item, com um marcador verde ("não está cadastrada")
  ou vermelho ("está cadastrada"), todos marcados. Confirmar um item
  vermelho insere uma duplicata: o marcador é só aviso. Não existe
  atualização no lugar pela importação.
- A chave é `SEQUENCIA-PRODUCAO`, uma sequência global para todas as
  produções. Um `TRABALHO-EM-EVENTOS` falso com sequência 1 (uma lacuna da
  exportação) foi descartado em silêncio; com 33 (acima do máximo, 32), foi
  listado em verde e aceito; sem o atributo, descartado em silêncio. As
  lacunas da exportação são linhas excluídas ou ocultas no servidor.

Regras para o editor: todo item novo recebe um número maior que o maior da
exportação, nunca uma lacuna, nunca sem o atributo; duplicatas se eliminam
do lado do editor; descompactar ao carregar e gravar `.xml` puro ao exportar.
O limite superior da sequência não é conhecido.

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

**No conector** (`src/bridge/importar.ts`, `IMPORT_ENABLED`): faz os passos 1
e 2 com o arquivo só dos itens novos (`buildMinimalImportFile`) e para na
resposta do Confirmar do passo 2, sem nenhum POST a mais. Pelo teste abaixo,
o currículo precisa ser conferido depois de cada importação.

**Teste acompanhado (14/10/2026), a partir da aba do menu.** **Observado.**

1. Arquivo mínimo com `DADOS-GERAIS` só com `NOME-COMPLETO`,
   `NOME-EM-CITACOES-BIBLIOGRAFICAS`, `NACIONALIDADE` e
   `PERMISSAO-DE-DIVULGACAO` (o que o XSD exige), e de novo com `SEXO`
   acrescentado (o DTD `schema/LMPLCurriculo.DTD` tem `SEXO #REQUIRED`; o XSD
   não): o passo 1 responde com o alerta "Erro. Não foi possível processar o
   arquivo enviado. Certifique-se que o mesmo esteja de acordo com o DTD do
   Curriculo Lattes." Nenhuma solicitação é criada. O Lattes confere o
   arquivo contra o DTD, não contra o XSD.
2. O mesmo arquivo mínimo, mas com **todos** os atributos do `DADOS-GERAIS`
   da exportação real (CPF, nascimento, RG, filiação, `ORCID-ID`, `PCD` e o
   resto), passa da conferência do DTD e cai noutro alerta: "O arquivo
   enviado para importação não contém produções científicas.", quando o único
   item novo é uma `PARTICIPACAO-EM-CONGRESSO` em `DADOS-COMPLEMENTARES`.
   Qual atributo faltava no caso 1 não foi isolado.
3. Opção 2 (a exportação inteira mais o evento, `SEQUENCIA-PRODUCAO` 34): o
   passo 2 vem como mapeado acima (formulário `pkg_imp_xml`, as 17 `f_chkp`
   marcadas, anos 2026, 2007, 2006, 2005 e 2004). Confirmado com `f_chkp=16`
   e `f_ano_prod=2026`, vem o **passo 3**: formulário `pkg_imp_xml`, POST
   para `pkg_importa_xml.mostra_lista_prod`, com `f_cod`, `f_solic`,
   `f_sq=dummy`, `f_ctr`, `f_chkp` (`dummy` e os módulos escolhidos),
   `f_all` e uma caixa `f_sq` por item, todas marcadas. O valor de `f_sq` é
   um id do servidor (20 no teste), **não** o nosso `SEQUENCIA-PRODUCAO`.
   Cada linha tem `<b class="quadrado verde">` ou `<b class="quadrado
vermelho">`; o único item veio verde. `enviar()` exige ao menos um `f_sq`
   marcado e põe `f_ctr=I`; `excluir()` pede confirmação e põe `f_ctr=D`.
4. O Confirmar do passo 3 (POST para `mostra_lista_prod` com `f_ctr=I` e
   `f_sq=20`) responde com
   `caixaMsg.exibir({titulo:'Sucesso',conteudo:'A operação foi realizada com sucesso! !',classe:'ok'})`
   (o texto é esse, com o espaço e o segundo "!"), e a solicitação é
   consumida (o Importar volta ao passo 1).
   Mesmo assim, passados mais de 3 minutos, o item **não** está em
   `pkg_evento.lista` nem em `cv_espelho`. A mensagem de sucesso não quer
   dizer que o item entrou.
5. "Descartar" no passo 2 (POST para `mostra_modulos` com `f_ctr=D`) volta
   ao passo 1 e encerra a solicitação.
6. O Confirmar feito pela própria tela manda os mesmos campos que o POST
   montado de dentro da página: os dois foram comparados campo a campo nos
   passos 2 e 3. A diferença entre o envio do conector e o do navegador não
   explica o item que não entrou. O formulário do passo 2 tem, nesta ordem,
   `f_cod`, `f_solic`, um `f_chkp` oculto com `dummy`, `f_ctr`, `f_all`, as
   caixas `f_chkp` de 1 a 17 e `f_ano_prod`. O envio do navegador no passo 2
   foi `f_cod`, `f_solic`, `f_chkp=dummy`, `f_ctr=I`, `f_chkp=16`,
   `f_ano_prod=2026`, sem `f_all`; no passo 3, `f_cod`, `f_solic`,
   `f_sq=dummy`, `f_ctr=I`, `f_chkp=dummy`, `f_chkp=16`, `f_all=on`,
   `f_sq=20`. **Observado.** O conector manda o passo 2 com os mesmos campos,
   na mesma ordem.
7. No passo 3, o verde e o vermelho comparam pelo título: os eventos de
   ouvinte sem título aparecem como "Produção sem título", todos verdes,
   embora já estejam no currículo. O filtro de ano do passo 2 limita a
   lista do passo 3.
8. Um evento montado à mão (Participante, Apresentação oral, `IDIOMA`
   Português, `TITULO` preenchido, **sem** `PARTICIPANTE-DE-EVENTOS-CONGRESSOS`)
   recebeu o "sucesso" e não entrou, duas vezes, uma delas pela tela. Uma
   cópia de um evento de ouvinte que já estava no currículo, com o
   `PARTICIPANTE-DE-EVENTOS-CONGRESSOS` da própria pessoa e `IDIOMA` vazio,
   só com o nome e o título trocados, entrou. Que o item sem a própria
   pessoa entre os participantes seja descartado em silêncio é **inferido**:
   a causa não foi isolada.
9. Cada importação confirmada gasta um `SEQUENCIA-PRODUCAO`, mesmo a que
   some: o item que entrou ficou com `f_seq=36`, e 34 e 35 foram das duas que
   não entraram (o máximo anterior era 33). O arquivo trazia 34: o número é
   o do servidor, não o do arquivo, e é ele o `f_seq` do formulário de
   edição.
10. O item que entrou não acende o aviso de alterações não enviadas ao CNPq,
    aparece na lista e em `cv_espelho`, e **não** aparece no Exportar: o
    Exportar entrega a versão publicada (seção 10).

Consequências:

- A conferência de uma importação é pela lista ou por `cv_espelho`, nunca
  por uma exportação nova: o Exportar entrega a versão publicada (seção 10),
  e que o item apareça nele depois do envio ao CNPq é **inferido**. A
  mensagem de sucesso não vale como conferência.
- O arquivo mínimo (só os itens novos e um `DADOS-GERAIS` com o que o XSD
  exige) não passa. Para passar do DTD ele precisou de todos os atributos de
  `DADOS-GERAIS`, inclusive dados pessoais, e ainda assim um arquivo só com
  evento foi recusado como sem produções científicas.
- Um evento importado precisa levar a própria pessoa entre os
  participantes (**inferido** do item 8).

O conector reconhece os dois alertas do passo 1 e para com o motivo
`arquivo`, sem solicitação criada.

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
item como estão, entre eles `f_cod` e `f_seq`. Na participação em eventos, o
POST com todos os campos do formulário e `f_ctr=E` exclui: a resposta é a
mesma da alteração (seção 16), a linha sai da lista na hora (de 7 para 6) e
some de `cv_espelho`, e a pendência continua acesa (14/10/2026, num item de
teste). **Observado.** Nas outras telas, que o servidor exclua e o que ele
responde seguem **inferidos**. Também é **inferido** que o POST de exclusão
aceite só `f_ctr`, `f_cod` e `f_seq`, sem os outros campos do formulário.

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
pedem tratamento próprio. A resposta do servidor e a pendência foram vistas
na exclusão de um evento (acima); nas outras telas, ainda só com a pessoa
acompanhando, num item de teste.

O conector exclui idioma e vínculo (`src/bridge/delete.ts`,
`DELETE_ITEMS_ENABLED`): posta o formulário inteiro, como o `del()`, só com
`f_ctr=E`, e não lê a resposta; confere relendo a lista e exigindo que só a
linha do item tenha sumido. A atuação inteira e as duas formações ficam fora
pelos motivos acima.

## 16. Edição de produções existentes (LAT-51, 14/10/2026)

Lido só com GET, de dentro da aba do menu: as listas do menu e os
formulários que as linhas abrem. Nada foi enviado. Os campos de controle
(`f_cod`, `f_seq`, `f_ctr`) aparecem no fim de cada tabela. Os itens
existentes neste currículo, além de idioma e formação (seção 5), estão em
participação em eventos, trabalhos técnicos, editoração e prêmios; o resto
das listas de produção está vazio e só mostra o link de inclusão (seção 17).

### Participação em eventos: `GN_TEC`, POST `PKG_EVENTO.FORM`

A lista é `pkg_evento.lista?f_cod=…` (no `modalCV1`). Cada linha da tabela
tem `onclick="self.parent.modalCV2.setarUrl('PKG_EVENTO.form?f_cod=…&F_STA_DIVULGACAO_CIENTIFICA=&f_seq=N',true)"`;
o "Incluir novo item" é o mesmo endereço sem `f_seq`. Na edição o oculto
`f_ctr` vem `U`; na inclusão, `I`. Os campos são os mesmos nas duas.
**Observado.**

| Campo                                  | Tipo                                                                                                                                              | XML (`DADOS-BASICOS-DA-PARTICIPACAO-EM-*`, `DETALHAMENTO-*`)            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `F_FORMA`                              | rádio `38` Convidado, `39` Participante, `40` Ouvinte                                                                                             | `FORMA-PARTICIPACAO` (**inferido**)                                     |
| `F_TPO`                                | lista vazia no HTML, montada por `montaTipoApres()` ao clicar em `F_FORMA`; o valor de cada opção é o próprio rótulo                              | `TIPO-PARTICIPACAO` (**inferido**)                                      |
| `f_nme_evento`                         | texto 400                                                                                                                                         | `NOME-DO-EVENTO`                                                        |
| `f_ano`                                | texto 4                                                                                                                                           | `ANO`                                                                   |
| `f_classif`                            | rádio `I` Internacional, `N` Nacional, `R` Regional, `L` Local                                                                                    | sem atributo correspondente no XSD                                      |
| `F_COD_PROD`                           | lista `A31` Congresso, `A32` Seminário, `A33` Simpósio, `A34` Oficina, `A35` Encontro, `A36` Olimpíada, `A37` Feira, `A38` Exposição, `A39` Outra | o elemento: `PARTICIPACAO-EM-CONGRESSO`, `-SEMINARIO`, … (**inferido**) |
| `f_cidade`                             | texto 255                                                                                                                                         | `CIDADE-DO-EVENTO` (**inferido**)                                       |
| `f_pais`                               | lista de 244 países, código de 3 letras (`BRA` Brasil, `RFA` Alemanha, `EUA` Estados Unidos)                                                      | `PAIS`                                                                  |
| `f_homepage`                           | texto 250                                                                                                                                         | `HOME-PAGE-DO-TRABALHO`                                                 |
| `f_titulo`                             | texto 255                                                                                                                                         | `TITULO`                                                                |
| `F_STA_DIVULGACAO_CIENTIFICA`          | rádio `S` sim, `N` não                                                                                                                            | `FLAG-DIVULGACAO-CIENTIFICA`                                            |
| `f_titulo_en`                          | texto 400                                                                                                                                         | `TITULO-INGLES`                                                         |
| `f_tipo_privacidade`                   | lista `1` Público, `2` Privado                                                                                                                    |                                                                         |
| `f_ctr` (`U` ou `I`), `f_cod`, `f_seq` | ocultos                                                                                                                                           |                                                                         |

As opções de `F_TPO`, lidas em `montaTipoApres()`: com Convidado,
Conferencista, Simposista, Moderador, Avaliador e Homenageado; com
Participante, "Poster / Painel", "Apresentação oral" e "Outras formas"; com
Ouvinte, só a opção vazia. Como a lista nasce vazia e só ganha opções no
clique, quem grava fora da página precisa mandar o texto do rótulo direto em
`F_TPO`. Os seis eventos deste currículo são de ouvinte, então não se viu
como a edição de um convidado ou participante marca a opção já gravada.
**Lacuna.**

**Alteração enviada** (14/10/2026, num evento de ouvinte de teste). O POST
para `PKG_EVENTO.FORM` com todos os campos do formulário como vieram, só
`f_titulo` trocado, `F_TPO` vazio e `f_ctr=U`, responde com um script que
chama `checkPublicacao()` e
`caixaMsg.exibir({titulo:'Sucesso',conteudo:'A operação foi realizada com sucesso! !',classe:'ok'})`,
a mesma caixa do Confirmar do Importar (seção 13). O conector não lê esse
texto: confere relendo o formulário. Relido, só `f_titulo` mudou. Depois da alteração, o menu passa a
mostrar a pendência e o Exportar recusa. O `f_seq` desse formulário é o
`SEQUENCIA-PRODUCAO` que o servidor deu ao item (seção 13, item 9).
**Observado.**

**No conector (15/10/2026, ligado).** Com esse teste, a alteração de eventos
de ouvinte passou a ir pela extensão (`src/bridge/edit-items.ts`, chave
`EDIT_OUVINTE_ENABLED`), e o formulário `GN_TEC` e a lista `pkg_evento.lista`
entraram no contrato fixo. Só o evento cuja `FORMA-PARTICIPACAO` é "Ouvinte";
convidado e participante ficam atrás da chave seguinte, porque a marcação do
`F_TPO` já gravado não foi vista. Campos que vão: título, ano, país, home page, divulgação
científica, título em inglês e nome do evento. A correspondência de `F_FORMA`
e `F_COD_PROD` com a forma e o elemento do XML continua **inferida**, e por
isso os dois entram na conferência do "antes": se não baterem, nada é
enviado. Desde 15/10/2026, a conferência leva também o ano, o nome do evento e
a cidade, qualquer que seja a parte alterada: o `f_seq` de 3 de 8 trabalhos
técnicos do censo de 15/10/2026 não era o `SEQUENCIA-PRODUCAO` do item
(`lattes-formularios/censo-2026-10-15.json`, ligação `f_seq` do
`trabalho-tecnico`), e com só
a forma, a natureza e o ano um congresso podia ser gravado no lugar de outro
do mesmo ano. Esses três se comparam sem acento,
caixa nem espaço nas pontas, e, quando a outra parte do item muda o campo na
mesma fila, o antes e o depois valem. A exclusão de evento (`f_ctr=E`, seção 15) segue fora do conector.

**Convidado, participante, forma, tipo, natureza e cidade (LAT-58,
15/10/2026).** Atrás da chave `EDIT_EVENTO_ENABLED`, cobertos no Lattes
simulado. O que cada um usa:

- `f_cidade` ↔ `CIDADE-DO-EVENTO` e `F_FORMA` ↔ `FORMA-PARTICIPACAO`,
  **observados** na passada de edição do censo (seção 20). Só a opção 40 foi
  vista com o valor do XML ("Ouvinte"); que 38 e 39 gravem "Convidado" e
  "Participante" vem do rótulo do rádio, **inferido**.
- A natureza é o rótulo da opção de `F_COD_PROD` (**observado** no censo, nos
  congressos e encontros). A página de alteração a troca no mesmo item
  (**observado** em 21/10/2026: num evento de teste, o `check()` da página
  passou `A31` a `A32` e o conector o passou de volta, com o mesmo `f_seq` 36
  e "conferido"). Que a exportação seguinte ponha o evento no elemento da
  natureza nova é **inferido** pela forma do XML, um elemento por natureza.
  O editor oferece as nove naturezas, e o conector confere a do elemento antes
  de enviar a nova.
- `F_TPO` leva o texto do tipo (o valor de cada opção é o rótulo). Como a
  edição de um convidado ou participante marca o tipo gravado continua sendo
  **lacuna**: por isso o tipo vai sempre na conferência do "antes". Se a
  página não mostrar o tipo gravado, nada é enviado, em vez de mandar `F_TPO`
  vazio e apagar o tipo.
- As regras do `check()` valem antes de enviar: convidado e participante
  pedem tipo da lista da forma e título; ouvinte não tem tipo.

Trocar a forma de ouvinte para convidado ou participante fica à mão: a
página monta a lista `F_TPO` por script (`montaTipoApres()`; o censo de
15/10/2026 marcou o campo como preenchido por script), e depois do envio a
releitura do HTML não veria o tipo gravado, deixando o evento trocado com
"não gravou". Pelo mesmo motivo, a troca de convidado ou participante para
ouvinte não oferece "Desfazer".

O que o teste acompanhado ainda precisa mostrar, nesta ordem:

1. Num evento de teste de convidado, abrir o formulário pela lista e ver se o
   tipo gravado vem marcado no HTML. Se não vier, toda alteração de convidado
   e participante para em "Tipo de participação", sem enviar nada, e é isso
   que precisa ser ajustado antes do resto (ler o tipo da chamada de
   `montaTipoApres()`, se o script trouxer os argumentos).
2. Se vier: trocar título e cidade e conferir a releitura.
3. Trocar a forma de convidado para ouvinte e conferir a releitura.
4. Conferir na exportação seguinte que `FORMA-PARTICIPACAO` e
   `TIPO-PARTICIPACAO` vieram com os textos enviados.
5. Só então decidir se a troca de ouvinte para convidado ou participante pode
   ir pelo conector.

O formulário não tem idioma, meio de divulgação, relevância, palavras-chave,
áreas nem participantes, embora o XSD tenha esses campos no evento.
`check()` exige forma de participação, tipo (menos para ouvinte), natureza,
nome do evento, ano (quatro dígitos, entre o nascimento e o ano atual),
país e título (menos para ouvinte); o rótulo do título muda com o tipo
(`rotulo_titulo()`: "Título da conferência", "Título da mesa redonda ou
simpósio", "Natureza da homenagem"). A exigência de o próprio nome estar na
lista de participantes está comentada. **Observado.** Há ainda
`evento_comunicacao()`, que abre `pkg_evento.lista_evento_comunic` no
`modalCV3`, sem botão visível que a chame. **Observado.**

### Trabalhos técnicos: `GN_RELATORIO`, POST `PKG_RELATORIO.FORM`

Lista `pkg_relatorio.lista`; linha abre `pkg_relatorio.form?f_cod=…&f_seq=N`,
inclusão sem `f_seq`. **Observado.**

| Campo                                             | Tipo                                                                                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `F_COD_PROD`                                      | rádio `243` Parecer, `244` Elaboração de projeto, `245` Relatório técnico, `246` Serviços na área da saúde, `247` Extensão tecnológica, `249` Outra |
| `f_titulo`                                        | texto 400                                                                                                                                           |
| `f_ano`                                           | texto 4                                                                                                                                             |
| `f_pais`                                          | lista de 244 países                                                                                                                                 |
| `F_IDIOMA`                                        | lista de 152 idiomas, código de 2 letras (`PT`, `EN`, `ES`, `DE`, `FR`, `IT`, `LB` Libras)                                                          |
| `f_meio`                                          | lista vazio, `I` Impresso, `M` meio magnético, `D` meio digital, `F` filme, `H` hipertexto, `O` outro, `V` impresso e mídia eletrônica              |
| `f_homepage`                                      | texto 250                                                                                                                                           |
| `F_RELEV`                                         | rádio `S`, `N`                                                                                                                                      |
| `f_finalidade`                                    | texto 255                                                                                                                                           |
| `f_duracao`, `f_paginas`                          | texto 5, numéricos                                                                                                                                  |
| `f_disp`                                          | lista vazio, `Restrita`, `Irrestrita`                                                                                                               |
| `f_cidade`, `f_inst`                              | texto 255 (instituição promotora, texto livre)                                                                                                      |
| `f_ref`                                           | área 3950                                                                                                                                           |
| `f_titulo_en`, `f_ref_en`                         | texto 400, área 3800                                                                                                                                |
| `f_tipo_privacidade`                              | lista `1`/`2`                                                                                                                                       |
| `f_ctr` (`U`), `f_cod`, `f_seq`                   | ocultos                                                                                                                                             |
| `f_autores_l`, `f_plv_l`, `f_setor_l`, `f_area_l` | ocultos, preenchidos por `check()` a partir das grades (abaixo)                                                                                     |

`check()` exige natureza, título, ano, país e o próprio nome entre os
autores. **Observado.**

### Editoração: `GN_TEC`, POST `PRC_TEC_EDIT`

Lista `prc_tec_demais_lista?f_cod_tipo=2D`; linha abre
`prc_tec_edit?f_cod=…&f_seq=N`, inclusão sem `f_seq` (`f_ctr=I`).
`F_COD_PROD` é rádio `2D1` Livro, `2D2` Anais, `2D3` Catálogo, `2D4`
Coletânea, `2D5` Enciclopédia, `2D6` Periódico, `2D9` Outro. Os demais
campos são os do trabalho técnico sem finalidade, duração e
disponibilidade, e com `f_editora` (texto 255); `f_inst`, `f_cidade` e
`f_paginas` iguais. `check()` exige também o idioma. Mesmas quatro grades
ocultas. **Observado.**

### Prêmios e títulos: `GN_PREMIO`, POST `pkg_premio.form`

`pkg_premio.form?f_cod=…&f_seq=N`. Só `f_titulo` (texto 200), `f_agencia`
(texto 100, entidade promotora, texto livre), `f_ano` (texto 4),
`f_tipo_privacidade` e os ocultos `f_ctr` (`U`), `f_cod`, `f_seq`.
`check()` exige nome e ano. **Observado.**

**No conector (LAT-58, 15/10/2026).** Prêmios e formação complementar estão
em `src/bridge/edit-lists.ts`, cada um atrás da própria chave
(`EDIT_PREMIO_ENABLED`, `EDIT_FORMACAO_COMPL_ENABLED`), cobertos no Lattes
simulado. Nos dois, a linha não se acha pelo número: o prêmio não tem número na exportação, e o
`f_seq` da formação complementar não bateu com `SEQUENCIA-FORMACAO` num dos
itens do censo. O conector abre o formulário de cada linha da lista (pelo link
da linha) e fica com o único cujos valores, sem acento nem caixa, são os do
item; depois confere o "antes" estrito, envia o formulário como veio, com só
os campos alterados trocados, e lê de volta.

- Prêmio: nome, entidade promotora e ano, ligações **observadas** no censo
  (cinco itens). Que o POST com `f_ctr=U` grave é **inferido**. O nome em
  inglês não tem campo.
- Formação complementar: carga horária e status, com o nível na conferência
  e o curso e a instituição (os ocultos `f_curso_old` e `f_inst_old`) para
  achar a linha. As ligações de carga, status, curso e instituição são
  **observadas**; que `f_nivel` seja o `NIVEL` do XML é **inferido** (a
  passada de edição não ligou o campo ao atributo). Instituição e curso
  visíveis vêm desabilitados e não vão no envio; a releitura confere que não
  mudaram. O envio vai para `FORM2` com o
  `f_ctr` vazio que a página traz (**inferido** que grave assim), e N e I do
  status como `EM_ANDAMENTO` e `INCOMPLETO` vêm do rótulo (**inferido**; só
  "concluído" foi visto). O formulário não tem os anos, o órgão nem o nome do
  curso em inglês: o editor mostra esses campos só para ler. Instituição e
  curso mudam pelas buscas, como na formação acadêmica (seção 18, "Formação
  complementar", desde 20/10/2026, atrás da capacidade
  `buscas-complementar-endereco`); a releitura confere que `f_inst` e
  `f_curso` mostram os nomes novos.

Nos dois, o `f_ctr` não distingue sempre incluir de alterar (o da formação
complementar vem vazio na inclusão e na edição). Depois do envio, o conector
conta de novo as linhas da lista e acusa se ela ganhou uma. Sem nenhuma linha
com o "antes", ele tenta achar a linha só pelos outros valores, e uma única
achada assim vira "divergente" na conferência, em vez de "não encontrado".

O que o teste acompanhado ainda precisa mostrar: num prêmio de teste, trocar a entidade promotora,
conferir a releitura, que a lista não ganhou linha, e a exportação; numa
formação complementar de teste, trocar a carga horária e o status para "em
andamento", conferir a releitura, que a lista não ganhou linha, a exportação
(`STATUS-DO-CURSO`) e que o curso e a instituição não mudaram.

As áreas de atuação e as atividades da atuação, que no começo ficaram fora,
têm caminho desde 18 e 19/10/2026 (seções 18 e 17). Nos idiomas, as quatro
proficiências já vão, e o código do idioma é do sistema no editor, com o
nome atrelado a ele: não sobra campo a enviar.

### Capítulo de livro e prefácio (gravados em 18/10/2026)

O capítulo é o formulário `GN_CAP` (POST `PKG_LVR_CAP.FORM_CAP`), aberto pela
escolha "Capitulo" da lista de livros e capítulos; `f_titulo_cap` é o título
do capítulo e `f_titulo`, o do livro. O alvo `capitulo`
(`src/bridge/production/targets/bibliografica-livros.ts`) gravou num capítulo
de teste editora, páginas, cidade e os dois títulos, conferidos na releitura.
O prefácio está na lista `prc_bib_demais_lista` com `f_cod_tipo=1C` (link
"Prefácio, posfácio" do menu), formulário `GN_BIB` de `prc_bib_prefacio`;
título, editora, cidade, volume, autor da publicação, tipo (prefácio para
posfácio) e natureza foram gravados e conferidos num prefácio de teste.
**Observado.** O formulário de edição do capítulo foi lido só nesse item de
teste; a captura do censo tem o do livro (`PKG_LVR_CAP.FORM_LVR`).

### As grades de autores, palavras-chave, áreas e setores

Os formulários de produção com autores (trabalhos técnicos, editoração,
patente, projeto) desenham grades jQuery (`$.grid`) a partir de vetores
escritos no próprio HTML (`autorProvider`, `palavraProvider`,
`areaProvider`, `setorProvider`) e, no `check()`, serializam cada grade num
oculto: cada linha vira os valores de algumas chaves unidos por `|`, e as
linhas são unidas por `@`. A ordem dos valores é a ordem das chaves no
objeto da linha. **Observado.**

| Oculto                   | Grade         | Chaves que entram                           | Limite (`*NumMaxRegistros`) |
| ------------------------ | ------------- | ------------------------------------------- | --------------------------- |
| `f_autores_l`            | `autorGrid`   | `c`, `l`, `t`, `pais`, `add`                | 2000                        |
| `f_area_l`               | `areaGrid`    | `l`, `c`, `r`, `p`                          | 3                           |
| `f_plv_l`                | `palavraGrid` | `l`, `c`                                    | 6                           |
| `f_setor_l`              | `setorGrid`   | `l`, `c`                                    | 3                           |
| `f_depositante_pessoa_l` | titulares     | `c`, `l`, `t`, `pais`, `add`, `staValidado` | (patente)                   |
| `f_depositante_inst_l`   | titulares     | `c`, `l`, `t`, `tipoInst`, `staValidado`    | (patente)                   |

Uma linha de autor vinda do servidor tem `l` (nome completo), `c` (código,
vazio quando o coautor não é identificado), `t` (nome em citações),
`editable` e `deletable`; o autor incluído na hora ganha `add`. Uma área
tem `l` (nome) e `c` (código de 8 dígitos); uma palavra-chave nova, `l`,
`c=-1` e `add`. **Observado.** O sentido de `r` e de `pais` não foi visto.
**Lacuna.** Antes de enviar, se a privacidade mudou, `verificaPriv()` abre
uma confirmação do `caixaMsg` do menu; se não mudou, envia direto.

Na edição (16/10/2026, só GET no Lattes real, em dois trabalhos técnicos e
numa outra produção bibliográfica): o formulário vem com `f_ctr` U e com os
quatro ocultos vazios, como na inclusão; os vetores trazem as linhas
gravadas, cada um terminado por um objeto vazio. O autor vem com `l`, `c`,
`t`, `editable` e `deletable` nessa ordem (por isso a linha da própria pessoa
vira `l||t`); a palavra-chave gravada vem com `l`, `c` e `editable`, e o `c`
dela é a posição (1, 2, 3...); a área, com `l`, `c` de oito dígitos e
`editable`. O nome e a citação do autor passam por um decodificador de
entidades antes da grade; as outras grades, não. **Observado.** Os
formulários: trabalho técnico `GN_RELATORIO`, aberto por
`pkg_relatorio.form?f_cod=…&f_seq=N` na lista `pkg_relatorio.lista`, POST
`PKG_RELATORIO.FORM`; outra produção bibliográfica `GN_BIB`, aberto por
`prc_bib_outraprod?f_cod=…&f_seq=N` na lista `prc_bib_demais_lista` com
`f_cod_tipo=1Z`, POST `PRC_BIB_OUTRAPROD` (1A, 1B e 1C são as outras listas
de demais tipos). **Observado.** O conector grava as palavras-chave desses
dois pelo motor de produção (`src/bridge/production/grids.ts`), refazendo as
quatro grades como o `check()` faria; um envio com o formulário como veio do GET mandaria as
grades vazias. **Observado** em 19/10/2026: num trabalho técnico de teste,
uma área (Desenho Industrial, 61200000) e um setor (Alimentação, 420228)
gravados pelo conector pelas grades voltaram na releitura
(`src/bridge/production/item-lists.ts`), e num mestrado de teste, uma
palavra-chave (`src/bridge/formacao-grids.ts`). Todo envio de formação leva
as três grades como a página as trouxe: o envio com elas vazias apagou a
palavra-chave do mestrado de teste no Lattes real.

## 17. Formulários de inclusão (LAT-52, 14/10/2026)

Lidos por GET, sem enviar. O mapa de onde fica o "Incluir novo item" de
cada lista vazia deste currículo, lido nos `onclick` das listas
(`modalCV2.setarUrl(…)`), com os parâmetros da URL: **Observado.**

| Lista do menu                                                        | Formulário de inclusão                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pkg_projeto.lista` (`f_cod_tipo` P, D, E, N, O)                     | `PKG_PROJETO.form` com `f_tpo_cooperacao=X`, `f_tpo_acao_inov=X`, `f_tematica=X`, `F_sta_inovacao`, `f_cod_tipo`, `f_cod`                                                                                                                                                                                                  |
| `PKG_PATENTE_REGISTRO.LISTA` (`f_cod_tipo` PP)                       | janela prévia `pkg_patente_registro.informar_dados_patente`, depois `pkg_patente_registro.form`                                                                                                                                                                                                                            |
| `PKG_PATENTE_REGISTRO.LISTA` (PC, CP, CR, DI, MR, TC)                | `PKG_PATENTE_REGISTRO.form` com `f_reg`, `F_STA_DIVULGACAO_CIENTIFICA`, `f_cod`, `f_cod_tipo`                                                                                                                                                                                                                              |
| `pkg_artigo_pr.lista`                                                | `PKG_ARTIGO_PR.form` (`f_cod`, `F_STA_DIVULGACAO_CIENTIFICA`)                                                                                                                                                                                                                                                              |
| `pkg_texto.lista`                                                    | `pkg_texto.form` (`f_sta_divulgacao_cientifica`, `f_cod`)                                                                                                                                                                                                                                                                  |
| `pkg_trabalho.lista`                                                 | `pkg_trabalho.form` (`f_cod`, `F_STA_DIVULGACAO_CIENTIFICA`, `f_seq_ev`)                                                                                                                                                                                                                                                   |
| `pkg_produto.lista`, `pkg_processo.lista`                            | `pkg_produto.form`, `pkg_processo.form` (`F_sta_inovacao`, `f_cod`)                                                                                                                                                                                                                                                        |
| `prc_tec_demais_lista` por `f_cod_tipo`                              | um procedimento por tipo, só com `f_cod`: `prc_tec_apres` (2J), `prc_tec_carta` (2A), `prc_tec_curso` (2B), `prc_tec_desen` (2C), `prc_tec_edit` (2D), `prc_tec_manut` (2E), `prc_tec_maquete` (2F), `prc_tec_org` (2G), `prc_tec_radiotv` (2H), `prc_tec_relat` (2I), `prc_tec_outraprod` (2Z), `prc_midias_sociais` (2L) |
| `prc_bib_demais_lista` (1A, 1B)                                      | `prc_bib_traducao`, `prc_bib_partitura` (`f_cod`)                                                                                                                                                                                                                                                                          |
| `pkg_arte_nova.lista` (AC, MU, AV, OU)                               | `pkg_arte_nova.form` (`f_cod`, `F_TIPO`)                                                                                                                                                                                                                                                                                   |
| `pkg_orient.lista`                                                   | `pkg_orient.form` (`f_cod`, `f_tipo`)                                                                                                                                                                                                                                                                                      |
| `pkg_banca_trab.lista`, `pkg_banca_julg.lista`                       | `PKG_BANCA_TRAB.form`, `PKG_BANCA_JULG.form` (`f_cod`)                                                                                                                                                                                                                                                                     |
| `pkg_revisor.lista` (`f_natur` MB, MA, RV, RA)                       | `PKG_REVISOR.inclui` (`f_cod`, `f_natur`, `f_origem`)                                                                                                                                                                                                                                                                      |
| `PKG_ASSESSORIA_CONSULTORIA.lista`, `PKG_EXTENSAO_TECNOLOGICA.lista` | `.form` do mesmo pacote (`f_cod`)                                                                                                                                                                                                                                                                                          |
| `pkg_licenca.lista`                                                  | `pkg_licenca.form` (`f_cod`)                                                                                                                                                                                                                                                                                               |

As listas de artigos publicados, livros e capítulos, linhas de pesquisa,
pós-doutorado, patente e algumas outras não têm o link no `onclick`; a
inclusão passa por uma função da página (como a patente, abaixo) que não
foi lida em todas. **Lacuna** para artigos e livros.

### Formação acadêmica: `GN_FORMACAO2`, POST `pkg_formacao.FORM`

O "Incluir novo item" da lista `pkg_formacao.lista?f_tipo=FA` chama
`selecionarNivel()`, que abre um combo do `caixaMsg` do menu. Cada opção é
a URL do formulário, `pkg_formacao.form?f_cod=…&f_tipo=FA&f_nivel=<código>`,
com os códigos da tabela abaixo. O formulário de cada nível foi lido; todos
têm `f_ctr=I`, `f_tipo=FA` e `f_nivel` oculto com o código. **Observado.**

A base é a do mestrado (lido em 10/10/2026): `f_tpo_doutorado`,
`f_inst` (75, desabilitado, só pela busca), `f_curso` (75, desabilitado, só
pela busca), `F_STATUS` (`N` em andamento, `S` concluído, `I` incompleto),
`f_ano_ini`, `f_ano_fim`, `f_mes_obten`, `f_ano_obten`, `F_BOLSA` (`S`, `N`),
`f_nme_agencia` (75, desabilitado, pela lista de agências), `f_titulo`
(254), `f_orient` e `f_coorient` (60), os campos do doutorado sanduíche e da
cotutela, as três grades (`f_plv_l`, `f_setor_l`, `f_area_l`) e
`f_tipo_privacidade`; ocultos `f_cod_inst`, `f_cod_inst2`, `f_inst_old`,
`f_cod_curso`, `f_cod_curso2`, `f_curso_old`, `f_agencia`,
`f_id_orientador`, `f_seq_orientacao`, `f_carga`. Um segundo formulário,
`formchk`, sustenta a validação do orientador por
`pkg_formacao.valida_orientador_lates` (POST com `f_cod`, `f_nme`,
`f_nivel`), que preenche `f_id_orientador` e `f_seq_orientacao`. O que muda
por nível:

| Nível (`f_nivel`)                       | Diferença em relação ao mestrado                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Doutorado (4)                           | os mesmos campos; `f_tpo_doutorado` ganha `C` co-tutela e `CS` co-tutela/sanduíche, além de `N` normal e `S` sanduíche          |
| Mestrado profissional (9)               | igual ao mestrado                                                                                                               |
| Graduação (1)                           | sem `f_coorient`; `f_mes_obten` e `f_ano_obten` viram ocultos; `f_titulo` e `f_orient` ficam (trabalho de conclusão)            |
| Especialização (2), Aperfeiçoamento (X) | sem coorientador nem campos de doutorado; `f_tpo_doutorado` e o ano de obtenção ocultos; `f_carga` vira texto 4 (carga horária) |
| Residência médica (D)                   | como a especialização, mas `f_curso` e `f_carga` ocultos (`curso()` recusa curso nesse nível)                                   |
| Ensino técnico (7)                      | sem título, orientador e campos de doutorado (`f_titulo` e `f_orient` ocultos)                                                  |
| Ensino médio (C), fundamental (B)       | como o técnico, e também sem curso e sem bolsa (`f_curso`, `F_BOLSA` ocultos; `agnull()` limpa a agência)                       |

Na graduação, mestrado e doutorado os campos do sanduíche e da cotutela
estão no HTML, dentro de blocos escondidos (`lblDoutorado`, `lblMesesSW1`,
`lblDoutoradoCT`) que `f_tpo_doutorado` mostra. **Observado.**

No XML, `TIPO-DOUTORADO` guarda o código da opção de `f_tpo_doutorado`.
**Observado** para `N` e `S` em quatro exportações reais publicadas no
GitHub (arquivos LATTES_OFFLINE): `N` em RafaelQSantos-RQS/LattesHub
`database/data/lattes/3633682231940138.xml`, NARizzardi/UFPR
`1002/lattes/lattes-cvs/algoritmos/kohayakawa.xml` e
LiaCasatiRamaldes/vira-lattes-db `cv/mock_jean.xml` (este talvez simulado),
todos com os campos `-DOUT`, `-SANDUICHE` e `-CO-TUTELA` vazios; `S` em
RafaelQSantos-RQS/LattesHub `database/data/lattes/5601958689947032.xml`, com
`NOME-INSTITUICAO-DOUT` e `NOME-ORIENTADOR-DOUT` preenchidos e
`NOME-INSTITUICAO-OUTRA-DOUT`, `NOME-DO-ORIENTADOR-SANDUICHE` e
`NOME-DO-ORIENTADOR-CO-TUTELA` vazios. Ou seja, no doutorado sanduíche os
campos `-DOUT` são os do sanduíche. `C` (co-tutela) e `CS`
(co-tutela/sanduíche) não apareceram em nenhuma exportação: **inferidos**
pelas opções do formulário. O editor mostra o tipo como lista
(`src/ui/field-kind.ts`) e rotula os dois campos `-DOUT` do doutorado como
"Instituição do sanduíche" e "Orientador no sanduíche"
(`src/labels/labels.ts`); `NOME-DO-ORIENTADOR-SANDUICHE`, sem exemplo
preenchido, fica "Nome do orientador sanduíche".

A instituição, o curso e a agência só entram pelas buscas (seção 18):
`sele_inst(1)` abre `prc_inst_form?f_cod=…&f_nivel=<nível>`;
`sele_inst(2)`, `(3)` e `(4)` abrem a mesma busca com `f_sta_outra` igual a
`S`, `SW` e `CT`, para as instituições do doutorado, do sanduíche e da
cotutela; `curso()` exige a instituição antes e abre
`prc_curso_form?f_cod=…&f_pgm=FORM&f_nivel=…&f_inst=<código da instituição>`;
`agencia()` marca `F_BOLSA=S` e abre `prc_agencia?f_cod=…`. Digitar no
campo chama `alertainst()`, que avisa e devolve o valor antigo.
`hist_aval_curso()` abre `prc_hist_aval_curso?f_cod_curso=…`, o histórico
de avaliação CAPES. **Observado.**

### Patente: janela prévia e `PKG_PATENTE_REGISTRO`, POST `PKG_PATENTE_REGISTRO.FORM`

A lista `PKG_PATENTE_REGISTRO.LISTA?f_cod_tipo=PP&f_cod=…` não abre o
formulário direto. "Incluir novo item" chama `infDadPat()`, que mostra a
janela "Incluir nova patente" (`$.win` com `url:"pkg_patente_registro.informar_dados_patente?ftipo=PP"`).
Ela tem o formulário `fDatpat`, sem envio próprio, com `f_inst` (texto 75,
preenchido por um combo de escritórios) e `f_cod_reg` (texto 16, o número).
**Observado.**

Os escritórios do combo (`escolhe_inst()`): INPI, Canadian Intellectual
Property Office, German Patent and Trademark Office, Institut National de
la Propriete Industrielle, Japanese Patent Office, Oficina de Armonización
del Mercado Interior, Oficina Española de Patentes y Marcas, Swiss Federal
Institute of Intellectual Property, UK Patent Office, United States Patent
and Trademark Office, WIPO, e "Outra (especifique)", que libera o texto
livre. O valor gravado é o próprio rótulo, com o INPI como "INPI - Instituto
Nacional da Propriedade Industrial". **Observado.**

O "Confirmar" (`handlePatenteSubmit()`) exige os dois campos; com o INPI,
o número precisa casar `^(PI|MU|BR)\d+$` (patente) ou, para programa e
desenho, `\d{5}-\d` ou `BR\d{10}-\d`. Depois pergunta ao servidor se o
número já está cadastrado, por um **POST** síncrono
`pkg_patente_registro.verifica_cadastrado` com `f_pi` (número), `f_cod` e
`f_inst` (resposta `1` = já existe). Esse POST não foi feito. Por fim abre
no `modalCV2` o GET
`pkg_patente_registro.form?f_sta_inovacao=&f_cod=…&f_cod_tipo=PP&f_inst=<escritório>&f_cod_reg=<número>&f_ctr=R`.
**Observado** no código.

O formulário foi lido por GET sem o `f_ctr=R` (com ele, **inferido**, o
servidor preenche `f_inst` e `f_cod_reg` com os da janela prévia; sem ele,
vieram vazios). Depois, a lista seguiu com "Nenhum registro cadastrado".
É uma página de 290 kB, com `f_ctr=I`: **Observado.**

| Campo                                                                                                                               | Tipo                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `f_natureza`                                                                                                                        | rádio `Produto`, `Processo`, `Produto e Processo`, `Outra` (o valor é o rótulo) |
| `f_cod_reg`                                                                                                                         | texto 16, com botão `f_botao` "Recuperar dados" (`recuperaDadosRegistro()`)     |
| `f_inst`                                                                                                                            | texto 75                                                                        |
| `f_pais`                                                                                                                            | lista de 244 países                                                             |
| `f_tipo`                                                                                                                            | rádio `PI` Patente de Invenção, `MU` Patente de Modelo de Utilidade             |
| `f_titulo`                                                                                                                          | texto 400                                                                       |
| `f_nro_deposito_pct`                                                                                                                | texto 16                                                                        |
| `f_sta_inovacao`                                                                                                                    | rádio `S` sim, `N` não (potencial de inovação), com `f_txt_potencial` texto 400 |
| `f_ref`, `f_ref_en`                                                                                                                 | área 3950, 3800                                                                 |
| `f_home_page`, `f_finalidade`                                                                                                       | texto 255                                                                       |
| `f_inst_financ`                                                                                                                     | área 380                                                                        |
| `f_titulo_en`                                                                                                                       | texto 400                                                                       |
| `f_tipo_privacidade`                                                                                                                | lista `1`/`2`                                                                   |
| `f_dados_grid_datas`                                                                                                                | oculto, XML das datas (abaixo)                                                  |
| `F_COD_PROD`, `f_sta_validado`, `f_sta_validado_mapa`, `f_origem`, `f_ano`, `f_dta_dep`, `f_dta_dep_pct`, `f_dta_conc`, `f_dta_exp` | ocultos                                                                         |
| `f_autores_l`, `f_plv_l`, `f_setor_l`, `f_area_l`, `f_depositante_pessoa_l`, `f_depositante_inst_l`                                 | ocultos, das grades (seção 16)                                                  |
| `f_ctr` (`I`), `f_cod`, `f_seq`, `f_cod_tipo` (`PP`)                                                                                | ocultos                                                                         |

As datas não são campos: ficam numa grade (`gridContatos`, colunas
"Descrição" e "Datas") cujo vetor vira XML por `array2xml("item","root",…)`
e vai em `f_dados_grid_datas`. Os códigos de data, de um comentário em
`valorCodigoData()`: `01` depósito, `02` depósito PCT, `03` concessão, `04`
expiração, `05` pedido de exame, `06` comercializada, `07` licenciada, `08`
cedida, `09` aguardando negociação, `10` abandonada. `check()` exige
depositante ou titular, país, natureza, tipo, instituição de registro,
número e data de depósito, e confere a ordem das datas. **Observado.**

"Recuperar dados" busca o pedido no INPI por GET
`PKG_PATENTE_REGISTRO.form_metadata_ajax` com `f_cod_tipo`, `f_cpf` (o CPF
de quem está logado, de uma variável da página), `f_inst` e `f_cod` (o
número do registro, não o do currículo); a resposta é JavaScript que a
página roda com `eval`. Não foi chamado, porque leva o CPF. **Observado** no
código.

### Patentes e registros: a edição (lida e gravada em 19/10/2026)

Uma patente de teste e um item de teste de cada registro (programa de
computador com e sem registro, cultivar protegida e registrada, desenho
industrial, marca, topografia) foram criados, alterados pelo conector e
removidos. **Observado:**

- A edição é `pkg_patente_registro.form` com `f_seq`, `f_ctr=U` e o
  `f_cod_tipo` do tipo. A lista do programa de computador sem registro é
  `PKG_PATENTE_REGISTRO.LISTA?f_reg=N&f_cod_tipo=PC`; a com registro é a de
  PC sem `f_reg`.
- O depositante ou titular é uma entrada do dicionário de coautores
  (`titularPessoaProvider`, `c` é a sequência da entrada). Uma pessoa
  digitada na janela "Inclusão de Depositante/Titular" vai com `c` 0, `add`
  e `staValidado` N, e o Lattes cria a entrada no dicionário. O check()
  serializa `titularPessoaProvider` em `f_depositante_pessoa_l` com as chaves
  `c`, `l`, `t`, `pais`, `add`, `staValidado` e `titularInstProvider` em
  `f_depositante_inst_l` com `c`, `l`, `t`, `tipoInst`, `staValidado`, na
  ordem em que cada linha as tem; o servidor lê os valores pela posição. Com
  as chaves fora da ordem da página, o gatilho
  `FOMENTO.TRG_VER_RE_COAUTOR_PRODUCAO_RH` recusou com ORA-01403.
- Os autores levam a coluna `tit` (`c`, `l`, `t`, `pais`, `add`, `tit`).
- As datas da patente ficam em `providerContatos`, escrito pela página com
  o id sem aspas e com zero à esquerda (`id: 01, contato: "Depósito",
endereco: "10/03/2005"`), e vão em `f_dados_grid_datas` pelo `array2xml`.
  O check() tira `f_ano` da data de depósito ou da do PCT, a que vier antes.
- No desenho industrial, no programa de computador com registro e na
  cultivar protegida, o check() põe em `f_ano` o ano de `f_dta_dep`
  (`dc.f_ano.value = anoDep`). Sem esse ano o Lattes aceita o envio e não
  grava nada. Nesses tipos o `f_ano` da página de edição vem vazio.
- O programa de computador monta `f_ambiente` de `programaProvider`.
- Marca e topografia não têm grade de depositantes.
- O `del()` dos registros exibe a caixa de confirmação e pendura a exclusão
  no botão Confirmar dela (`caixaMsg.btnConfirmar.addEventListener`).
- O dicionário de coautores (`pkg_dic_autor.lista`) não tem exclusão para
  uma entrada sem uso; a de palavras-chave (`PKG_DIC_PLV_NV.form`) tem
  `del()`.

### Patente: exportação, depositante e histórico (lidos em 20/10/2026)

Uma patente de teste (`f_seq` 40) foi exportada e a página de edição dela
(`pkg_patente_registro.form?f_cod_tipo=PP&f_seq=40`) foi lida. **Observado:**

- O `REGISTRO-OU-PATENTE` da exportação traz `NOME-DO-DEPOSITANTE` com o
  nome da pessoa depositante e `NOME-DO-TITULAR` vazio. Na página, essa
  pessoa é a única linha de `titularPessoaProvider` (`l` o nome, `c` 14, a
  entrada dela no dicionário de coautores, `t` a citação, `editable` false,
  `deletable` true, `staValidado` N), e `titularInstProvider` vem vazio
  (`[{}]`).
- A exportação copia a pessoa depositante também nos `AUTORES`, com
  `NRO-ID-CNPQ` vazio e `ORDEM-DE-AUTORIA` 1, antes da própria pessoa, que
  vem também com ordem 1: a ordem dos depositantes é contada à parte. O
  `autorProvider` da página tem só a própria pessoa.
- Cada `HISTORICO-SITUACOES-PATENTE` é uma linha da grade de situações
  (`providerContatos`): `DESCRICAO-SITUACAO-PATENTE` é o rótulo da linha
  ("Depósito", no `contato`) e `DATA-SITUACAO-PATENTE` a data em DDMMAAAA
  (12032007 para `endereco` "12/03/2007"). `STATUS-SITUACAO-PATENTE` veio
  `SIM`; o sentido dele não foi visto. A mesma data está também em
  `DATA-PEDIDO-DE-DEPOSITO`.
- O programa de computador de teste foi exportado como `SOFTWARE` simples,
  sem `REGISTRO-OU-PATENTE`, então só a patente mostrou como a exportação
  guarda os depositantes.

O que o conector faz com isso (`src/bridge/production/holders.ts` e
`targets/registros.ts`):

- Troca o depositante quando o item tem no máximo uma pessoa depositante e o
  valor novo é um nome só. A linha nova sai do vetor `titularPessoaDP` do
  menu, com a mesma forma da linha gravada. **Inferido:** que
  `titularPessoaDP` tenha a forma do `autorDP` (`l`, `c`, `t`) e as entradas
  do dicionário de coautores; a forma dele não foi lida (seção 22). Como a
  exportação junta mais de um depositante não foi visto, e isso fica à mão.
  Nos outros registros com a grade de depositantes (programa de computador,
  cultivares, desenho industrial) a ligação com `NOME-DO-DEPOSITANTE` é
  inferida pela patente.
- O depositante instituição (`titularInstProvider`) vai pela janela de
  titulares (`src/bridge/production/institution-holder.ts`). Em 27/10/2026,
  sem enviar: a janela `pkg_titular_inst.sele_inst` busca por nome num POST
  com `f_cod`, `f_ctr=P` e `f_nome`, e responde com um
  `seleciona('<letra><código>', '<nome>')` por instituição; o `seleciona()`
  põe na grade `{l: nome, c: código sem a letra, tipoInst: a letra,
deletable, editable}`, e o `check()` a serializa como `nome|código|letra`.
  Uma patente de teste com a UFRGS como titular, gravada pela página e
  exportada no mesmo dia, veio com `NOME-DO-DEPOSITANTE="Universidade Federal
do Rio Grande do Sul"` e `NOME-DO-TITULAR` vazio, sem cópia nos `AUTORES`.
  **Observado.** O XML não diz se o depositante é pessoa ou instituição: o
  conector acha o nome de antes numa das duas grades da página e põe o nome
  novo na pessoa do `titularPessoaDP` ou, com a capacidade
  `titular-instituicao`, na única instituição de mesmo nome na busca (sem
  acento nem caixa). Mais de uma, ou nenhuma, fica à mão; `NOME-DO-TITULAR`
  também. **Inferido:** como a exportação junta pessoa e instituição juntas.
  O `titularInstDP` não existe na janela do menu.
- A mudança de autores deixa de fora as linhas de `AUTORES` com o nome de um
  depositante, antes e depois, para conferir com o `autorProvider`, que não
  as tem, e para nunca mandar o depositante como autor. A cópia só se
  reconhece pelo nome. Com mais linhas daquele nome do que depositantes (quem
  inventa e também deposita), o conector não adivinha qual é a cópia, e a
  mudança de autores fica à mão; mexer numa linha com o nome do depositante
  também. O depositante novo de uma troca ainda não exportada não tem cópia.
- A data de uma linha do histórico cuja descrição é uma das datas conhecidas
  (Depósito, Depósito PCT, Concessão, Pedido do Exame, comparadas sem acento
  nem caixa) vai pela grade de situações, como as datas do
  `REGISTRO-OU-PATENTE`. As duas datas são um campo só no Lattes, e o editor
  as mantém juntas (`src/model/linked-attrs.ts`): trocar a data do registro
  troca a da situação com a mesma descrição, e o contrário. A linha do
  histórico que não existe não se cria; sem ela, só o registro muda, e vai.
  As duas mudanças vão ao mesmo campo (a segunda acha o Lattes já com a data
  e não envia nada). Datas que ainda assim discordam (no XML carregado, por
  exemplo) ficam à mão. Incluir ou tirar uma situação, e as outras situações
  também.
- A situação trocada por outra entre essas quatro (Depósito para Concessão,
  por exemplo) tira a linha do código de antes e põe a do código novo com a
  mesma data, num envio só. No editor, a data passa junto do atributo do
  registro da situação de antes para o da nova. É o que a página faz com a
  lixeira e o "Incluir nova", que põe a linha no começo da grade só com
  `id`, `contato` e `endereco` (o combo da própria linha monta as opções de
  uma chave que não existe, seção 24). **Inferido**: que o Lattes aceite a
  troca assim, e que a exportação grave a descrição com o rótulo do combo
  (só "Depósito" foi conferida). A situação repetida em outra linha fica à
  mão, e a linha com `deletable` "false" (a página esconde a lixeira dela,
  menos na concessão) não se exclui: o envio para antes do POST.
- O status da situação não tem controle na página: a grade guarda só a
  situação e a data. O editor o mostra só para ler.

### Dicionário de coautores: a edição (lida em 19/10/2026)

- A lista (`pkg_dic_autor.lista?f_cod=…`, linkada no menu) traz uma linha
  por coautor, `<tr onclick="pp_autor(n)">`, com o nome, o nome em citações e
  quantas produções e projetos o usam. `pp_autor` abre
  `pkg_dic_autor.form?f_cod=…&f_seq=n`.
- O formulário `GN_AUTOR` (POST `PKG_DIC_AUTOR.FORM`) tem `f_nome` e
  `f_nome_cit` (até 60 letras cada), `f_cod`, `f_seq`, `f_tipo` (A), `f_ctr`
  (U na alteração), `f_id`, `f_sta_old` e a caixa `f_chk`.
- Quando a citação muda, o check() pergunta a
  `pkg_dic_autor.existe_prod_validada` (POST com `f_cod` e `f_seq`, resposta
  S ou N); com S, mostra as produções validadas e não envia.
- A linha de autor de cada produção aponta para a entrada pelo `c`. Trocar o
  `t` na linha não pega: a releitura volta com a citação antiga. Trocar a
  entrada muda a citação em todas as produções do coautor (gravado em
  20/10/2026 num item de teste: o `t` da linha do item seguiu a entrada).
- A própria pessoa não está no dicionário: a linha dela no `autorDP` do menu
  tem o `c` vazio.
- A citação da própria pessoa num item não se troca item a item. Num trabalho
  de teste (21/10/2026, demais trabalhos), o `t` da linha dela (`c` vazio,
  `editable: false`) foi trocado no `autorProvider` da página e o `check()`
  da própria página enviou `f_autores_l` com o `t` novo; o Lattes respondeu
  "A operação foi realizada com sucesso" e a releitura voltou com o nome em
  citações da identificação (`providerDetNmeCit`, um nome só nesse
  currículo). **Observado.** Que a equipe do projeto e os participantes de
  banca façam o mesmo é **inferido**: usam a mesma grade, com a linha da
  pessoa de `c` vazio.

### O DOI das produções bibliográficas (lido e gravado em 20/10/2026)

O DOI vai no oculto `f_cod_doi` (no capítulo, um campo de texto); o botão
"Verificar DOI" só recupera os dados da produção. Antes de enviar, o
`check()` de cada página confere o formato (começa por `10.` e tem `/`), se o
DOI já está em outra produção (`pkg_artigo.verifica_doi_duplicado`, POST
`f_doi`, `f_cod`, `f_seq`, resposta `doiDup = 0` ou `1`; artigos, trabalho em
eventos e livro) e o tipo (`pkg_artigo.tipodoi`, POST `fcod` e `ffun`, que
responde `ARTIGO`, `LIVRO`, `CAPITULO`… ou `INEXISTENTE`; sem o `ffun`,
mesmo vazio, um 404). O artigo pede um tipo que comece por A, o trabalho em
eventos por T; o livro tem a conferência comentada e o capítulo não a tem.
O tipo vem da base do Lattes: `10.1038/nature14539`, um artigo da Nature,
volta `LIVRO`. **Observado:** num artigo de teste, o conector gravou
`10.1590/S0034-89102009000500001` e a releitura o trouxe.

### Atividade de uma atuação: a edição (lida e gravada em 19/10/2026)

A tela de cargos e vínculos traz cada atividade como um link
`PKG_ATIV.cargo` com `f_natur_ativ`, `f_seq_ativ`, `f_codinst` e
`f_seq_funcao`, que são a natureza, a `SEQUENCIA-ATIVIDADE` da atuação, o
`CODIGO-INSTITUICAO` (com a letra) e a `SEQUENCIA-FUNCAO-ATIVIDADE` da
atividade. A descrição é a grade `providerDetAtiv` (`{l, c}`), serializada em
`f_espec_l` como `n@c?l!`, completada até 8 com `n@?!`; a linha digitada vai
com `c` 0 e a excluída em `f_exc` (`c?`). O período é `f_status` (N anterior,
S atual), `f_mes_ini`, `f_ano_ini`, `f_mes_fim`, `f_ano_fim`. Na exportação, a
descrição é um atributo da atividade (`ESTAGIO-REALIZADO`,
`SERVICO-REALIZADO`, `CARGO-OU-FUNCAO`…). **Observado:** uma atividade de
teste teve descrição, ano de início e período trocados pelo conector,
conferidos na releitura, sem outro campo mudar.

**Ensino (lido e gravado em 20/10/2026, numa atuação de teste).** Na edição
de uma atividade de ensino, a `providerDetAtiv` são as disciplinas (`{l, c}`,
o `c` a `SEQUENCIA-ESPECIFICACAO` delas). O mês de fim trocado pelo conector,
com a grade mandada como veio, voltou conferido e com as duas disciplinas; o
Lattes as renumerou pela posição na grade (a que era `c` 2 virou 1), como o
Salvar da página faria.

**Pesquisa e desenvolvimento e treinamento ministrado (lidos e gravados em
21/10/2026, na atuação da Campanha Nacional de Escolas da Comunidade).** Os
dois têm o mesmo formulário `GN_ATIV_CARGO`, com órgão ou unidade pela janela
de órgãos da atividade. Na pesquisa e desenvolvimento, a `providerDetAtiv` são
as linhas de pesquisa (`{l, c}`), e o `c` é o `f_seq_linha` da linha no
formulário dela (`PKG_LINHAPESQ.FORM`, `GN_LINHA`, que exige o campo Ativa);
no treinamento, os treinamentos (`{l, c}`). Numa atividade de teste de cada
tipo, com uma linha e um treinamento, o mês de fim e o órgão trocados pelo
conector, com a grade mandada como veio, voltaram conferidos, e a linha de
pesquisa ficou com o título, o objetivo e o `f_seq_linha` de antes.
**Observado** com uma linha só. Com várias linhas e um `c` fora da posição, a
renumeração do Lattes poderia descolar o objetivo de uma linha; o conector
manda a grade como o Salvar da própria página mandaria, então não é pior que
salvar no Lattes, mas isso não foi visto.

**O código da instituição no link.** É o do XML com uma letra na frente (`D`
ou `V`), e o do XML pode começar por letra também: `K4WU00000006` vira
`VK4WU00000006`. Tirar a primeira letra dos dois lados desencontra os dois.

**O órgão da atividade.** A janela é
`prc_orgao_cargo?f_origem=&f_modal_cv=9&f_cod=…&f_cod_inst=<f_codinst>&f_cod_inst2=<órgão de cima>`,
com as mesmas linhas `atribuir(código, nome, tipo, órgão de cima)` da janela
do projeto; o `atribuir()` grava em `f_orgao`, `f_orgao_old` e em
`f_codorgao` (tipo 0) ou `f_codorgao2`. A instituição precisa da letra que o
link da atuação traz: a PUCRS (`000600000001`) lista 44 órgãos com `V` e
nenhum com `D`. Instituição sem órgão só oferece "Cadastrar novo Órgão"
(`prc_outro_orgao`), que grava na base de instituições do Lattes.
**Observado** só por GET; que a gravação do órgão na atividade siga a do
projeto é **inferido**.

### Projeto de pesquisa: `GN_PROJETO`, POST `PKG_PROJETO.FORM`

O projeto não se inclui pela atuação. A tela de cargos e vínculos de uma
atuação (`PKG_ATIV.cargos_vinculos`) só leva a vínculos, atividades
(`pkg_ativ.cargo`, com `selecionarNatureza()`: `1` Direção e administração,
`2` Pesquisa e desenvolvimento, `4` Ensino, `5` Estágio, `6` Serviço técnico
especializado, `7` Extensão universitária, `8` Treinamento, `9` Outra
atividade técnico-científica, `B` Conselhos, comissões e consultoria) e à
exclusão; o formulário da atividade (`GN_ATIV_CARGO`) não tem projeto.
**Observado.**

A inclusão sai do menu: "Projetos de pesquisa" é
`pkg_projeto.lista?f_cod_tipo=P&f_cod=…`, e o "Incluir novo item" abre
`PKG_PROJETO.form?f_tpo_cooperacao=X&f_tpo_acao_inov=X&f_tematica=X&F_sta_inovacao=&f_cod_tipo=P&f_cod=…`.
As outras naturezas (`D` desenvolvimento, `E` extensão, `N` ensino, `O`
outros) usam o mesmo formulário com outro `f_cod_tipo`. A ligação com a
atuação vem da instituição escolhida no formulário. **Observado.**

| Campo                                                                                                      | Tipo                                                                                                                                                 | XML (`PROJETO-DE-PESQUISA`)       |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `f_titulo`, `f_titulo_en`                                                                                  | texto 255                                                                                                                                            | `NOME-DO-PROJETO`, `-INGLES`      |
| `f_ref`, `f_ref_en`                                                                                        | área 3900                                                                                                                                            | `DESCRICAO-DO-PROJETO`, `-INGLES` |
| `F_TPO_NATUREZA`                                                                                           | lista vazio, `D` Desenvolvimento, `E` Extensão, `P` Pesquisa, `N` Ensino, `O` Outra                                                                  | `NATUREZA`                        |
| `F_TPO_SITUACAO`                                                                                           | lista vazio, `D` Desativado, `C` Concluído, `A` Em andamento                                                                                         | `SITUACAO`                        |
| `F_ANO_INIC`, `F_ANO_FIM`                                                                                  | texto 4                                                                                                                                              | `ANO-INICIO`, `ANO-FIM`           |
| `F_NRO_GRADUACAO`, `F_NRO_ESPECIALIZACAO`, `F_NRO_MESTRADO_ACAD`, `F_NRO_MESTRADO_PROF`, `F_NRO_DOUTORADO` | texto 2                                                                                                                                              | `NUMERO-GRADUACAO` etc.           |
| `f_nro_tec_nivel_medio`, `F_NRO_PRIMEIRO_GRAU`, `F_NRO_SEGUNDO_GRAU`                                       | ocultos                                                                                                                                              |                                   |
| `f_sta_inovacao`, `f_txt_potencial`                                                                        | rádio `S`/`N`, texto 400                                                                                                                             | `FLAG-POTENCIAL-INOVACAO`         |
| `f_tpo_pesq_emp`                                                                                           | rádio `S`/`N`; com `S`, `f_cnpj_empresa` (18), `f_txt_nme_empresa`, `f_txt_email_institucional`, `f_txt_setor` (400) e o oculto `f_cod_inst_empresa` |                                   |
| `f_inst`                                                                                                   | texto 75, desabilitado, pela busca; ocultos `f_cod_inst`, `f_cod_inst2`, `f_instold`, `f_inst_old`, `f_instituicoes`                                 |                                   |
| `f_orgao`                                                                                                  | texto, desabilitado, pela busca de órgão; ocultos `f_codorgao`, `f_codorgao2`, `f_orgao_old`                                                         |                                   |
| `f_vinc`, `f_stavinc`, `f_enqua`, `f_carga`, `f_regime`                                                    | ocultos, copiados do vínculo da atuação escolhida                                                                                                    |                                   |
| `f_tpo_cooperacao`, `f_tpo_acao_inov`, `f_tematica`                                                        | ocultos (`X` na URL)                                                                                                                                 |                                   |
| `f_autores_l`, `f_inst_l`, `f_producoes_l`, `f_orientacoes_l`, `f_producoes_d`, `f_orientacoes_d`          | ocultos: equipe, financiadores, produções e orientações ligadas                                                                                      |                                   |
| `f_tipo_privacidade`                                                                                       | lista `1`/`2`                                                                                                                                        |                                   |
| `f_ctr` (`I`), `f_cod`, `f_codinst`, `f_seq_ativ`, `f_seq_funcao`, `f_seq_proj`, `f_cod_tipo` (`P`)        | ocultos; na inclusão, `f_codinst` e as três sequências vêm vazias                                                                                    |                                   |

`check()` exige nome, natureza, situação, ano de início (e de fim quando
concluído), números inteiros nas quantidades de alunos, os dados da empresa
quando é pesquisa em empresa (com e-mail institucional que não seja de conta
gratuita) e o próprio nome na equipe. A grade de financiadores vira
`f_inst_l` com quatro valores por linha unidos por `|` e cada linha
terminada em `|@`. **Observado.**

A instituição vem de `sele_inst()`, que abre
`PKG_PROJETO.pp_lista_inst?f_pgm=INSTVINCULO&f_cod=…`: uma lista das
instituições das atuações do currículo (16 aqui, com código `D` ou `V` mais
12 dígitos), mais uma caixa de busca. A escolha chama
`preencherOpener(enqua, regime, stavinc, ano_inic, ano_fim, carga, vinc, código, nome)`,
que copia o vínculo para os ocultos (o `stavinc` como código do
formulário, invertido em relação à exportação como na seção 5, **inferido**)
e os anos para `F_ANO_INIC` e `F_ANO_FIM`, e `seleciona(código, nome)`, que grava o código **sem** a letra
em `f_cod_inst` (letra `V`) ou `f_cod_inst2` (as outras). A busca de órgão,
`orgao()`, devolve a letra (`V` ou `D`) na frente:
`PKG_PROJETO.pp_orgao_cargo?f_cod=…&f_cod_inst=<letra><código>`.
**Observado.** Que o servidor pendure o projeto na atuação dessa
instituição, criando a atividade de pesquisa e desenvolvimento se for
preciso, é **inferido**: `f_seq_ativ` e `f_seq_funcao` ficam vazios na
inclusão.

Outras janelas do formulário: `PKG_PROJETO.pp_lista_inst?f_pgm=INSTFINANC`
(financiadores), `PKG_PROJETO.pp_lista_autores` (equipe),
`PKG_PROJETO.pp_lista_prod` (produções ligadas). O CNPJ da empresa é
consultado por GET ajax `PKG_PROJETO.PR_RECUPERA_DADOS_INST` com `p_cnpj`,
resposta JSON com `cod`, `nome` e `email`. `chamaVerificaVinculo()` chama
`pkg_projeto.verifica_vinculo_ajax`, que responde 404: o procedimento não
existe mais (ou a assinatura mudou). **Observado.**

## 18. Buscas: instituição, curso, agência e área (LAT-48, 14/10/2026)

### Instituição: `prc_inst_form`

Aberta no `modalCV3` por `self.parent.modalCV3.setarUrl(url,true,70,350,450)`,
com `url` `prc_inst_form?f_cod=…&f_nivel=<nível>` (formação) ou
`…&f_sta_outra=S|SW|CT` (instituições do doutorado). A página traz o
formulário `instituicaoForm`, `method=post`, action `PRC_INST_FORM`, com
os ocultos `F_CTR=C`, `F_COD`, `F_NIVEL`, `F_STA_OUTRA` (`N` por padrão) e
o texto `f_nome`. O botão chama `recuperaInstMacro()`, que tira `%` do
texto, exige ao menos duas letras e faz `dc.submit()`. **Observado.**

O mesmo pedido por GET funciona:
`PRC_INST_FORM?F_CTR=C&F_COD=<10 caracteres>&F_NIVEL=4&F_STA_OUTRA=N&f_nome=<texto>`
devolve a mesma página com os resultados (testado com "Universidade
Estadual de Campinas", um resultado, e "Campinas", 85). O texto vai em
Latin-1 (`escape()`). **Observado.**

A resposta é HTML. Cada resultado é um link
`<a href="javascript:seleciona('<código>','<nome>')">NOME (UF)</a><br>`,
seguido de "Foram encontrados N registros.". O código tem 13 caracteres:
uma letra e 12 dígitos ou letras (`V007900000004` para a Unicamp). As
instituições com `M` vêm em verde, e o texto da página explica que a verde é
a instituição "MACRO (principal)" e as outras são unidades do Diretório de
Instituições. **Observado.** No fim, "Cadastrar nova instituição" chama
`outrainst()`, que navega para
`prc_inst_outra?f_cod=…&f_pgm=CURSO&f_nivel=<nível>`. **Observado.**

`seleciona(vlr, texto)` é gerada pelo servidor conforme o contexto. Com
`F_STA_OUTRA=N` ela escreve, no formulário do `modalCV2`, `f_inst` e
`f_inst_old` com o nome, limpa o curso, e grava o código inteiro (com a
letra) em `f_cod_inst` quando começa com `V` e em `f_cod_inst2` nos outros
casos; depois fecha o modal (`removerModal()`). Com `F_STA_OUTRA=S`
escreve `f_inst_dout`, `f_cod_inst_dout` e `f_cod_inst2_dout`. **Observado.**
Os casos `SW` e `CT` gravam, **inferido** pelo nome dos campos, nos
`*_dout_sw` e `*_dout_ct`.

A letra muda de forma entre telas: a formação guarda o código com a letra,
o projeto guarda sem ela (seção 17), e os links da atuação usam `D` onde a
busca mostra `M` (o `f_codinst=D001000000998` da seção 3). Que `D` e `M`
indiquem o mesmo lado (`f_cod_inst2`) é **inferido**.

### Curso: `prc_curso_form`

`prc_curso_form?f_cod=…&f_pgm=FORM&f_nivel=<nível>&f_inst=<código>` (GET)
devolve o formulário `GN_CURSO_FORM` (action `PRC_CURSO_FORM`) com os
ocultos `f_sta_area=S`, `f_cod_inst`, `f_nme_inst` e uma lista `f_curso`
com os cursos daquele nível na instituição (196 para doutorado na Unicamp).
Não há busca: é uma lista só. O valor de cada opção é uma letra e 8
dígitos (com espaço no fim) e o texto traz o nome e o código CAPES do
programa, como "Administração(33003025005P3)". **Observado.**

`selecionar()` escreve `f_curso` e `f_curso_old` com o texto da opção,
regrava a instituição como acima e grava o curso **sem** a letra em
`f_cod_curso` (letra `V`) ou `f_cod_curso2` (as outras). "Novo curso"
(`novocurso()`) navega para
`prc_curso_outro?f_cod=…&f_nivel=…&f_inst=…&f_sta_area=…`. **Observado.**

### Agência de fomento: `prc_agencia`

`prc_agencia?f_cod=…` é uma lista fixa de 57 agências, sem formulário. Cada
uma é um link `atribuir('<código>','<nome>')`, com código de 12 caracteres;
`atribuir()` escreve `f_nme_agencia` e `f_agencia` e volta. **Observado.**

### Orientações e bancas (lido e gravado em 18/10/2026)

As páginas `pkg_orient.form`, `PKG_BANCA_TRAB.form` e `PKG_BANCA_JULG.form`
abrem as mesmas buscas, com outros parâmetros. **Lido no código das
páginas.** Em 18/10/2026, quatro itens de teste (orientação concluída e em
andamento de mestrado, banca de mestrado, banca julgadora de professor
titular) tiveram instituição, curso e agência trocados pelo conector com os
ocultos abaixo, e a releitura trouxe os códigos novos: **observado** em modo
de alteração.

- Instituição: `prc_inst_form?f_cod=…`, sem `f_nivel` na orientação e na banca
  julgadora; na banca de trabalho, `f_nivel` pela natureza (A11 GM, A12 e A13
  GD, A14 AP, A15 GG, A16 GE). O `seleciona()` grava como na formação: o
  código com `V` em `f_cod_inst`, os outros em `f_cod_inst2`, e o nome em
  `f_inst_old`. Na orientação e na banca de trabalho `f_inst` vem desabilitado;
  na banca julgadora é texto.
- Curso: `prc_curso_form?f_pgm=TESE&f_cod=…&f_inst=<código com a letra>&f_nivel=<retnivel()>&f_sta_area=<N ou vazio>`.
  O `retnivel()` dá 3 para mestrado (9 com o `f_sub_prod` do profissional: 30
  na orientação concluída, 37 na em andamento, "35 " na banca), 4 para
  doutorado, pós-doutorado e qualificação de doutorado, 2 para aperfeiçoamento
  e 1 para graduação, iniciação científica e outra natureza. `f_sta_area` é N
  no terceiro e no quarto rádio da natureza (aperfeiçoamento e graduação na
  orientação; qualificação de doutorado e aperfeiçoamento na banca). A
  supervisão de pós-doutorado não tem curso.
- Agência (só orientação): `prc_agencia`, como na formação, para `f_agencia` e
  o texto `f_nme_agencia`.
- Orientando: o botão Salvar chama `pre_check()`, que depois do `check()` faz
  `pkg_orient.valida_orientador_ajax` (POST síncrono com `f_cod`, `f_nme` em
  `escape()` e `f_nivel`, o F_COD_PROD marcado) e, só com `sta_validado`
  verdadeiro, copia `idOrientado` e `seqFormOrientado` para `f_id_orientado` e
  `f_seq_form_orientado`. Sem validação, os dois ficam como estavam. Uma
  chamada de teste (18/10/2026, nome inexistente) devolveu
  `{"sta_validado":false,"mensagem":"Orientador não encontrado","idOrientado":"","seqFormOrientado":""}`
  e nenhuma lista do currículo mudou: **observado** que só consulta. O
  conector faz a mesma chamada antes de enviar uma orientação com o nome do
  orientando trocado, e só manda os dois ocultos quando o nome valida
  (`src/bridge/production/student.ts`).

### Natureza da orientação: a página de edição (lida em 20/10/2026)

Um GET da página de edição de uma orientação de teste (mestrado, concluída;
`pkg_orient.form`, formulário `PKG_ORIENT`), sem envio. **Observado:**

- A natureza é o rádio `F_COD_PROD`: 41 Dissertação de mestrado, 42 Tese de
  doutorado, 43 Monografia de conclusão de curso de
  aperfeiçoamento/especialização, 44 Trabalho de conclusão de curso de
  graduação, 45 Iniciação Científica, 46 Supervisão de pós-doutorado, 49
  Orientação de outra natureza.
- Ocultos: `f_tipo=C` (concluída), `f_ctr=U`, `f_ctr_natur` vazio,
  `f_sub_prod` vazio, `f_cod_inst` com o código da instituição e a letra
  (V e 12 dígitos), `f_cod_curso` com os 8 dígitos do curso, `f_inst_old` e
  `f_curso_old`. O subtipo vai em
  `f_sub_prod`, que `dominio()` e `atribui(txt)` escrevem como
  `txt.substring(0, txt.indexOf("#"))`; a descrição vai em `f_dsc_outra`, só
  de leitura.
- `testa_nivel(arg)`, a cada clique na natureza: fora de mestrado e doutorado
  (índices 0 e 1), desmarca `f_tpo_orient` (orientador principal O,
  coorientador C, que só vale para 41 e 42); sempre limpa `f_dsc_outra`; no
  pós-doutorado (índice 5), limpa `f_titulo` e os dois códigos de curso; e,
  com uma instituição preenchida, pede para escolher de novo a instituição e o
  curso e limpa `f_cod_inst`, `f_cod_inst2`, `f_cod_curso`, `f_cod_curso2`,
  `f_inst` e `f_curso`.
- `retnivel(vlr)`, o nível da busca de curso: 41 dá 3 (9 com `f_sub_prod` 30),
  42 dá 4, 43 dá 2, 44, 45 e 49 dão 1, 46 dá 4. As em andamento (A41 a A45)
  dão o mesmo, e A41 com `f_sub_prod` 37 dá 9.

No XSD, só os dados básicos das outras orientações concluídas enumeram a
NATUREZA, com as quatro opções de 43, 44, 45 e 49. As outras orientações em
andamento guardam a natureza como texto, e o tipo só tem A49: cada uma das
outras naturezas em andamento tem elemento próprio. Nos demais tipos, o
elemento fixa a natureza.

O conector, com isso (`src/bridge/production/nature.ts`):

- Nas outras orientações concluídas, a troca entre 43, 44 e 45 vai com o
  `F_COD_PROD` novo, `f_dsc_outra` e `f_sub_prod` vazios, e a instituição e o
  curso do item buscados de novo com o nível da natureza nova, como o
  `testa_nivel()` pede. Curso fora da lista do nível novo, ou ausente numa
  natureza que o exige (43 e 44, pelo `check()`), para antes do envio. A
  releitura confere o `F_COD_PROD` e os códigos. **Observado** em 20/10/2026,
  numa orientação de teste das outras concluídas: de graduação (44) para
  iniciação científica (45), o envio parou antes do POST porque o curso do item
  não estava na lista de nível 1 da instituição; com o curso trocado pelo
  conector para um da lista, 44 para 45 gravou e conferiu, com a instituição e
  o curso intactos, e 45 para 44 também.
- De ou para 49 fica à mão: a janela do subtipo não foi lida.
- O conector não desmarca `f_tpo_orient`, que nas outras orientações não
  vem marcado (**inferido**: não visto num item dessas naturezas).
- Onde o elemento fixa a natureza, trocá-la é incluir o item de novo no tipo
  certo, como o nível da formação complementar.
- O curso da supervisão de pós-doutorado não se informa: a lupa (`curso()`)
  responde "Não informe o curso para natureza Supervisão de pós-doutorado", e
  o `testa_nivel()` limpa os códigos do curso. O editor mostra esse curso só
  para ler.
- O tipo do mestrado vai em `f_sub_prod` com o rótulo em `f_dsc_outra`
  (seção 24). Trocar entre acadêmico e profissional com curso no item busca
  o curso de novo no nível do tipo novo. O tipo de outra natureza é texto
  livre que a página pede num `prompt()` e fica à mão.

As páginas de edição das bancas não foram lidas. No censo de 15/10/2026, o
rádio `F_COD_PROD` da banca de trabalho tem A11 Mestrado, A12 Doutorado, A13
Exame de qualificação de doutorado, A14 Curso de aperfeiçoamento/especialização,
A15 Graduação e A16 Exame de qualificação de mestrado, sem opção para as outras
participações; o da banca julgadora tem A21 Professor titular, A22 Concurso
público, A23 Livre-docência, A24 Avaliação de cursos e A29 Outra. O elemento
fixa a natureza em todos menos na qualificação, que guarda A13 e A16 no mesmo
elemento.

Em 27/10/2026, numa página da banca de trabalho carregada sem enviar, um
script da carga (`$(".cod_proc:eq(2)").append($(".cod_proc:eq(5)"))`) põe a
qualificação de mestrado logo depois da de doutorado, e a ordem viva dos
rádios fica A11, A12, A13, A16, A14, A15. O `sele_inst()` e o `curso()` da
página escolhem o nível pelo índice do rádio, então a busca de instituição sai
com GM, GD, GD, AP, GG e GE nessa ordem viva (A16 com AP, A14 com GG, A15 com
GE), e a de curso leva `f_sta_area=N` em A13 e A16; o nível do curso sai do
valor (`retnivel()`). **Observado**: são os endereços que as duas funções da
própria página montaram com cada natureza marcada. O `testa_nivel()` da troca
de tipo limpa só a instituição e o curso, e o conector troca a qualificação
de mestrado pela de doutorado (e o contrário) escolhendo os dois de novo com
os níveis da natureza nova. A troca não foi enviada.

### Órgão e unidade do projeto (lido em 18/10/2026)

O formulário do projeto (`GN_PROJETO`) guarda o órgão em `f_codorgao` ou
`f_codorgao2` e o texto em `f_orgao` (desabilitado) e `f_orgao_old`. A lupa
chama `orgao()`, que abre
`PKG_PROJETO.pp_orgao_cargo?f_cod=…&f_cod_inst=<V e f_cod_inst, ou D e f_cod_inst2>`.
No projeto, `f_cod_inst` vem com o código da atuação sem a letra da busca,
inclusive os de letras (`KCLH00000006`). **Observado.**

A janela lista os órgãos da instituição; cada um tem um link "Expandir
itens" para a mesma janela com `f_origem=&f_modal_cv=2&f_cod_inst2=V<código>`,
que lista o próprio órgão no topo e as unidades dele. A escolha é
`atribuir('<12 dígitos>','<nome>',<tipo>[,'<órgão de cima>'])`: tipo 0 grava
o código em `f_codorgao` (e limpa `f_codorgao2`), os outros em `f_codorgao2`,
e o texto vira `"<órgão de cima>/\n<nome>"` em `f_orgao` e `f_orgao_old`. O
código tem a hierarquia (`000903000008` o centro, `000903003007` uma área
dele) com um dígito final que não segue a do pai. Em todos os órgãos vistos
o tipo era 0. **Observado** numa universidade (`V000900000007`, 16 órgãos no
topo). Das 18 instituições das atuações de quem capturou, só as de código V
têm órgãos na janela.

Na página de alteração (lida em 18/10/2026, num projeto de teste), `f_codorgao`,
`f_codorgao2` e `f_orgao_old` vêm vazios e só o `f_orgao`, desabilitado,
mostra o órgão gravado. O `seleciona()` da janela de instituições do projeto
também limpa os quatro. Dois envios de alteração pelo conector, com o código
e o texto que o `atribuir()` gravaria (uma unidade do mesmo órgão, depois
outro órgão), voltaram com o órgão de antes, sem erro e sem mexer em mais
nada. **Observado.** Se a própria página consegue trocar o órgão na
alteração não foi visto.

Os financiadores, as produções e as orientações ligadas são tabelas
(`criarGrid`, ids `grid2`, `grid3` e `grid4`) que o servidor escreve com as
linhas, e o `check()` as serializa em `f_inst_l`, `f_producoes_l` e
`f_orientacoes_l` a partir de `valores`. Não há vetor `financiadorProvider`,
`producaoProvider` nem `orientacaoProvider` na página, como a especificação
supunha; a equipe, sim, é o `autorProvider`. **Observado.**

Numa página de alteração lida em 20/10/2026 (um projeto de teste com um
financiador e duas produções ligadas incluídos à mão), cada linha traz o
valor que o `check()` envia num `<span>` da célula, ao lado do texto que a
tela mostra (trecho copiado da página, sem formatar):

```text
<table id="grid2"> … <tbody> <tr> <td>FAPESP_PPPROV<span id="cod_inst_aux">VJMOE00000002</span></td> <td>0000<span>0000;N;</span></td> <td>R$ 10,00<span>026|10,00</span></td> <td>Auxílio Financeiro<span>A</span></td> <td><img … onClick="editarLinhaTabela(this)"><img … onClick="apagaLinhaTabela(this)"></td> </tr> </tbody>
<table id="grid3"> … <tbody> <tr> <td tabindex="0">Teste do LattesEditor (apagar)<SPAN>34</SPAN></td> <td tabindex="0">2026</td> <td tabindex="0">Participações em eventos</td> </tr> <tr> <td tabindex="0">TESTE EDITOR APAGAR registro-PC-v1 f_titulo<SPAN>39</SPAN></td> <td tabindex="0">2006</td> <td tabindex="0">Software</td> </tr> <INPUT TYPE="hidden" NAME="f_producoes_d" VALUE="34|39"> </tbody>
<table id="grid4"> … <tbody> <INPUT TYPE="hidden" NAME="f_orientacoes_d" VALUE=""> </tbody>
```

O `criarGrid` da página dá à `grid_2` o `tagValor`
`['span','span','span','span',null]` e à `grid_3` e à `grid_4`
`['span', null, null]`. O `associarValores()` toma, em cada linha e em cada
célula com `tagValor`, o `innerHTML` do primeiro elemento com essa tag, e o
`check()` junta os da `grid_2` como `v0|v1|v2|v3|@` por linha e os das outras
como `v0@`. Neste projeto, então, `f_inst_l` vai
`VJMOE00000002|0000;N;|026|10,00|A|@`, `f_producoes_l` vai `34@39@` e
`f_orientacoes_l` vai vazio. Um valor pode ter `|` dentro (`026|10,00`), e
o `check()` não o escapa. Os ocultos `f_producoes_d` e `f_orientacoes_d`
ficam dentro do corpo das tabelas, com os códigos ligados unidos por `|`.
**Observado.** O sentido de cada valor do financiador (`0000;N;`, a moeda e
o valor) não foi lido, nem o que o servidor faz com os dois ocultos.

O conector manda `f_producoes_d` e `f_orientacoes_d` como a página os serve
e refaz os três ocultos das grades assim a partir da página, com as entidades
como o `innerHTML` as deixa (`&amp;` continua `&amp;`), e os envia junto com
qualquer outra alteração do projeto; depois do envio, confere que voltaram
iguais (`src/bridge/production/opaque.ts`). Quando a tabela falta, ou uma
linha não se lê assim (célula sem o `<span>`, marcação dentro dele), nada é
enviado. Incluir, tirar ou trocar um financiador, uma produção ou uma
orientação ligada continua à mão, e com uma dessas mudanças na fila o resto
do projeto vai à mão junto: o envio levaria de volta as linhas que o Lattes
tem, e a mudança à mão ficaria para trás com o item conferido.

**Inferido**: que a exportação ponha o órgão de cima em
`PARTICIPACAO-EM-PROJETO@CODIGO-ORGAO`/`NOME-ORGAO` e a unidade em
`CODIGO-UNIDADE`/`NOME-UNIDADE`; nenhuma exportação com órgão foi vista. O
conector confere o código de antes (o da unidade, senão o do órgão) contra
`f_codorgao` da página antes de enviar, então uma inferência errada vira
"divergente" e nada vai.

Na lista de projetos real, o link de cada linha é
`PKG_PROJETO.form?f_tpo_cooperacao=…&f_tpo_acao_inov=…&f_tematica=…&F_sta_inovacao=…&f_cod_tipo=…&f_cod=…&F_SEQ_ATIV=…&F_SEQ_FUNCAO=…&F_SEQ_PROJ=…&F_CODINST=…`,
com os números em maiúsculas, e o mesmo projeto aparece também na lista com
`f_sta_inovacao=S`. **Observado.**

### Formação complementar (lido em 20/10/2026)

Num GET da página de edição de um curso de curta duração
(`PKG_FORMACAO_COMPL.form?f_cod=…&f_seq=6`), sem enviar nada: a lupa da
instituição chama `sele_inst()`, que abre
`prc_inst_form?f_cod=…&f_nivel=<f_nivel>`, e a do curso chama `curso()`, que
abre `prc_curso_form?f_cod=…&f_pgm=FORM&f_nivel=<f_nivel>&f_inst=<valor de
f_cod_inst ou de f_cod_inst2>`. São as janelas da formação acadêmica. Os
ocultos vieram assim: `f_cod_inst=V577000000000` (com a letra),
`f_cod_inst2` vazio, `f_cod_curso` vazio, `f_cod_curso2=90000005` (sem a
letra), e `f_inst_old` e `f_curso_old` com os nomes; `f_inst` é texto
desabilitado. **Observado.**

O conector troca instituição e curso com as regras da formação acadêmica
(`src/bridge/formacao-edit.ts` e `formacao-lookups.ts`): a operação leva o
código novo, e na hora de gravar faz a busca `PRC_INST_FORM` com o `f_nivel`
do formulário e `F_STA_OUTRA=N`, fica com o único resultado do código, e pega
o curso na lista da instituição. A instituição nova sem curso escolhido de
novo fica à mão, como na formação. **Inferido**: que o `seleciona()` desta
janela grave como o da formação (o código com a letra, V em `f_cod_inst`, as
outras em `f_cod_inst2`), e que `PKG_FORMACAO_COMPL.FORM2` grave os ocultos.

Em 20/10/2026, num MBA de teste, o envio com a instituição e o curso como as
janelas gravariam (instituição com a letra, curso sem ela, os textos em
`f_inst_old` e `f_curso_old`) foi aceito, e a releitura voltou com os de
antes. O conector acusou divergente e nada mudou. **Observado.**

A causa apareceu em 27/10/2026, num envio pelo próprio navegador capturado
pela ponte local: o `FORM2` tem dois passos. O primeiro POST (`f_ctr` vazio)
não grava nada; devolve outra página `GN_FORMACAO2`, que repete os campos do
primeiro passo como ocultos e traz `f_ctr=U`, `f_ano_ini`, `f_ano_fim`,
`f_ano_obten` (desabilitado no tipo Outros), `F_BOLSA` (S ou N),
`f_nme_agencia` (desabilitado, com o código em `f_agencia` oculto, vindo da
busca de agências), `f_titulo` e `f_orient` ocultos, `f_tipo_privacidade` e as
grades `f_plv_l`, `f_setor_l` e `f_area_l`. Só o POST desse segundo passo
grava, e responde "A operação foi realizada com sucesso". **Observado.** Os
anos de início, conclusão e obtenção e a bolsa saem desse passo, não do
primeiro.

O conector faz os dois passos (`src/bridge/formacao-compl-steps.ts`): manda o
primeiro, lê o segundo, troca os campos que mudaram e confere o texto de
sucesso; na releitura, refaz o primeiro passo sem gravar para conferir os do
segundo. Num curso real, a carga horária foi de 36 para 37 e voltou para 36,
as duas vezes gravada e conferida. **Observado.** A troca de instituição e
curso pelas buscas (`COMPL_LOOKUPS_ENABLED`, capacidade
`buscas-complementar`) está ligada sem envio acompanhado: os cursos do
currículo testado eram de cadastro manual e não havia como desfazer a troca.
**Inferido** que o segundo passo leve os ocultos da instituição e do curso como
vieram do primeiro. A lupa da agência no segundo passo (`agencia()`) abre
`prc_agencia?f_cod=<código do currículo>`, a mesma lista das orientações e
bancas, e marca a bolsa como sim; o conector faz a mesma escolha em
`f_agencia` (só o MBA tem agência no XSD). **Observado** o endereço e a
função, em 27/10/2026, sem enviar; a troca de agência não foi enviada. As buscas do endereço profissional
continuam desligadas (`COMPL_ENDERECO_LOOKUPS_ENABLED`), sem caso reversível.

### Endereço profissional (lido em 20/10/2026)

A instituição do endereço tem outra janela. O formulário dela, `instituicaoForm`,
posta para `PRC_INST_ATIV` com os ocultos `F_CTR=C`, `F_COD=<código do
currículo>`, `F_PGM` vazio e `F_MODAL_CV=1`, e o texto em `f_nome`. Um POST
com `f_nome=Universidade Positivo` devolveu
`seleciona('V577000000000','Universidade Positivo')`, no formato da busca da
formação. O `seleciona(vlr, texto)` dessa janela escreve `texto` em `f_inst`
e `f_inst_old` e grava o código **sem** a letra: com V, `f_cod_inst =
vlr.substring(1)` e `f_cod_inst2` vazio; com outra letra, o contrário.
**Observado.**

O órgão sai de `orgao()`, que abre
`prc_orgao_cargo?f_cod=…&f_cod_inst=<V e f_cod_inst, ou D e f_cod_inst2>`, a
mesma janela do projeto e das atividades: `atribuir(cod, texto, tipo,
texto2)` grava `f_orgao` e `f_orgao_old` e o código em `f_codorgao` (tipo 0)
ou `f_codorgao2`. **Observado** no código da página.

O conector troca a instituição pela busca `PRC_INST_ATIV` (por POST, como a
página): confere antes que `f_cod_inst` ou `f_cod_inst2` tem o código de
antes do XML, fica com o único resultado do código novo, manda os ocultos
como o `seleciona()` os escreveria e, na releitura, confere os ocultos e o
nome em `f_inst`. O órgão vai pela janela das atividades
(`prc_orgao_cargo?f_origem=&f_modal_cv=9&…`, a mesma resolução do projeto e
das atividades, `src/bridge/production/organ.ts`): o código de antes se
confere pelo oculto ou pelo texto de `f_orgao`, e a releitura confere o texto
novo em `f_orgao`. Com a instituição trocada, a janela abre na instituição
nova, com a letra que a busca deu. Se o `seleciona()` limpa o órgão não foi
visto: com órgão no item, a instituição nova só vai com o órgão escolhido de
novo. A unidade não tem campo próprio no formulário: com unidade no item, a
troca de órgão fica à mão. **Inferido**: que a página traga os ocultos da
instituição preenchidos com o valor gravado, que os do órgão venham vazios
(como na alteração do projeto), que `PRC_ENDERECO` grave os dois, e que a
janela pelo endereço das atividades liste os mesmos órgãos que a do
endereço. Nada disso foi enviado a um Lattes real. O editor ainda não oferece
a lista de órgãos no endereço, como nas atividades: o órgão só vai quando o
XML traz o código novo.

### Área do conhecimento: no próprio menu, sem pedido ao servidor

A tabela de áreas não vem de uma busca. O `PKG_MENU.menu` declara em script
o vetor `areaDP`: uma árvore de 1.358 nós, cada um com `l` (nome), `n`
(nível: 9 grandes áreas, 86 áreas, 373 subáreas, 890 especialidades), `c`
(código de 8 dígitos) e `b` (filhos). As grandes áreas são 10000003
Ciências Exatas e da Terra, 20000006 Ciências Biológicas, 30000009
Engenharias, 40000001 Ciências da Saúde, 50000004 Ciências Agrárias,
60000007 Ciências Sociais Aplicadas, 70000000 Ciências Humanas, 80000002
Lingüística, Letras e Artes, 90000005 Outra. O menu declara também
`setorDP` (87 setores de aplicação da CNAE, `l`, `n`, `c` de 6 dígitos) e,
com dados do próprio currículo, `autorDP` (`l`, `c`, `t`, `deletable`) e
`palavraDP` (`l`, `n`, `c`). **Observado.**

Os formulários leem esses vetores de `self.parent`: a caixa `areaSuggest`
(`$.suggest`) procura no nome sem acento a partir de 4 letras, ignorando as
grandes áreas, e `treeTodosArea` (`$.tree`) mostra a árvore inteira; uma
grande área não pode ser escolhida. A escolha vira uma linha de `areaGrid`
com `l`, `c`, `n` e a privacidade (`priv: "1"`, `vis: "Público"`).
"Inclusão de área" (`areaWin`) cria uma área que não está na tabela:
escolhe-se uma área de nível 2 na árvore e digita-se o nome (mínimo de 5
letras), e a linha fica `{l: <nome>, n: 3, c: -1, p: <código da área pai>}`.
O envio leva tudo em `f_area_l` (seção 16), no máximo 3 áreas por
produção. **Observado.**

"Áreas de atuação" (`prc_area_atuacao`, formulário `GN_AREA_ATU`, POST
`prc_area_atuacao`) usa a mesma grade e serializa duas vezes: `f_area_l`
com `l`, `c`, `r`, `p` e `f_privacidade` com `priv`, linha a linha. Em
18/10/2026: o `check()` junta, de cada linha de `areaProvider`, os valores de
`l`, `c`, `r` e `p` que a linha tem, na ordem dela, com "|" (o `r` com a letra
na frente), e as linhas com "@"; `f_privacidade` leva o `priv` de cada linha
com "@", e o envio vai com `f_ctr=I`, a lista inteira. As linhas lidas têm
`l`, `c`, `priv`, `vis` e `editable`, e as da árvore `l`, `n`, `c` e `b`: uma
área escolhida vai como `nome|código`, e a criada à mão como
`nome|-1|código do pai`. O limite da página é 6 (`areaNumMaxRegistros`). Uma
área criada pela pessoa volta da página com código 9999xxxx. Gravado pelo
conector no Lattes real (uma área a mais e a volta), **observado**. A página
ainda tem `abrir_area()`, que abriria a janela antiga
`pkg_area.pp_lista?f_cv_modal=modalCV1&f_origem=AA&f_max=6&f_cod_rh=…`; ela
existe (GET responde 200, formulário `AREA` com `f_gr`, `f_ar`, `f_sb`,
`f_ctr`, `f_nme`) e escreve numa grade `gridArea` que a página nova não
tem. **Observado**; que esteja fora de uso é **inferido**.

Consequência para o conector: a área se resolve sem rede, lendo `areaDP` do
menu que já está na aba (ou guardando uma cópia da tabela no editor), e
instituição e curso são GETs cujos resultados se leem nos links
`seleciona(…)` e nas opções da lista. Nenhuma das três buscas precisa de
POST. As consultas por POST encontradas são a de patente já cadastrada e a
busca de instituição do endereço (`PRC_INST_ATIV`, que o conector faz por
POST como a página; se ela aceita GET não foi testado).

## 19. Dados gerais pelo conector (LAT-23, 14/10/2026; LAT-58, 16/10/2026)

Formação acadêmica, pós-doutorado e livre-docência, endereço, identificação e
outras informações relevantes têm operação escrita em `src/bridge/biographic.ts`
(o caminho e o contrato) e em `formacao-edit.ts`, `formacao-lookups.ts` e
`dados-gerais-edit.ts` (que atributo vai em que campo, e o porquê do que fica
à mão), testada contra o Lattes simulado, atrás de `BIOGRAPHIC_OPS_ENABLED`
(e, para o que a LAT-58 acrescentou e uma extensão antiga gravaria errado,
`BIOGRAPHIC_FULL_ENABLED`, capacidade `alterar-dados-gerais-completo`). No
Lattes real, até 18/10/2026, foram gravados e conferidos a identificação
(PCD e privacidades), o endereço (uma rede social) e as palavras-chave de
um mestrado de teste; o resto segue como marcado abaixo.

| Seção              | Formulário e POST                      | Como o conector acha                                                                                                                                                         | Atributo do XML → campo                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formação           | `GN_FORMACAO2`, `pkg_formacao.FORM`    | `pkg_formacao.lista` com `f_tipo=FA` (ou `AP`, para pós-doutorado e livre-docência) no menu, e na lista o único `pkg_formacao.form` com `f_seq` igual a `SEQUENCIA-FORMACAO` | anos (`f_ano_ini`, `f_ano_fim`, `f_ano_obten`), `STATUS-DO-CURSO` → `F_STATUS`, título → `f_titulo`, orientador → `f_orient`, coorientador → `f_coorient`, tipo do curso → `f_tpo_doutorado`, `FLAG-BOLSA` → `F_BOLSA`, `CARGA-HORARIA` → `f_carga`, orientadores do sanduíche e da cotutela → `f_orient_dout`, `f_orient_dout_sw`, `f_orient_dout_ct`; instituição, curso e agência pelas buscas da seção 18 |
| Endereço           | `GN_ENDERECO`, `PRC_ENDERECO`          | `prc_endereco` no menu                                                                                                                                                       | `ENDERECO-PROFISSIONAL` nos campos `_i` e `ENDERECO-RESIDENCIAL` nos `_r`: logradouro → `f_rua`, `CEP` → `f_cep`, `BAIRRO` → `f_bairro`, `CIDADE` → `f_munic`, `UF` → `f_estado`, `PAIS` → `f_pais` (código do país), `DDD`, `TELEFONE`, `RAMAL`, `FAX`, `CAIXA-POSTAL`, `E-MAIL`, `HOME-PAGE`; `ENDERECO@FLAG-DE-PREFERENCIA` → `f_end_corr` (`R`, `I`)                                                      |
| Identificação      | `GN_IDENT`, `PRC_IDENT`                | `prc_ident` no menu                                                                                                                                                          | `NOME-COMPLETO` → `f_nome`, nome em citações → `f_nome_citacao` e `f_nome_citacao_h`, país de nacionalidade → `f_pais_nacio` (com `f_nacionalidade`), nascimento → `f_pais_nasc`, `f_uf_nasc`, `f_cidade_nasc`, `f_dta_nasc`, `SEXO` → `f_sexo`, identidade → `f_rg_nro`, `f_orgao_rg`, `f_uf_rg`, `f_dta_rg`, passaporte → `f_passaporte`, `RACA-OU-COR` → `fnro_id_raca_cor`                                |
| Outras informações | `GN_OUTRA_INF_RELEV`, `PRC_OUTRAS_INF` | `prc_outras_inf` no menu                                                                                                                                                     | `OUTRAS-INFORMACOES-RELEVANTES` → `F_TEXTO`                                                                                                                                                                                                                                                                                                                                                                   |

- **Observado**: os nomes dos formulários, dos POSTs, dos links do menu e dos
  campos, e o que cada nível da formação mostra, traz oculto ou não tem (censo
  de 15/10/2026, entradas `formacao-FA-*` e `formacao-AP-*`); os códigos de
  `F_STATUS`; o `f_nivel` oculto igual ao `NIVEL` da exportação no mestrado,
  na graduação e no curso técnico; e, pela passada de edição do censo,
  `f_ano_ini`, `f_ano_fim`, `F_BOLSA`, `f_orient`, `f_titulo` (graduação),
  `f_inst_old`, `f_curso_old`, `f_nome_citacao`, `f_cidade_nasc`, `f_uf_nasc`,
  `f_uf_rg`, `f_rg_nro`, `f_orgao_rg`, `f_pais_nacio` ↔
  `SIGLA-PAIS-NACIONALIDADE`, `f_pais_nasc`, `f_sexo` `M`, `f_pais_r` e
  `f_end_corr` `R`.
- **Inferido**: as outras ligações, pelo nome e pelo rótulo do campo. Os
  comentários do começo de `formacao-edit.ts` e `dados-gerais-edit.ts`
  listam uma por uma; as que mais pedem o teste acompanhado são as datas em
  `DD/MM/AAAA`, a cor ou raça pelo rótulo da opção, o `f_nacionalidade` `B`
  só para o Brasil, os orientadores do sanduíche e da cotutela e o
  `f_agencia` igual ao `CODIGO-AGENCIA-FINANCIADORA`.
- **Buscas**: instituição, curso e agência só mudam com o código novo no XML
  (o editor grava código e nome juntos, `src/ui/live-lists.ts`). Na hora de
  gravar, depois de conferir o "antes", o conector faz as mesmas buscas da
  inclusão (`PRC_INST_FORM`, com `F_STA_OUTRA` `N` ou `S`, `prc_curso_form` e
  `prc_agencia`) e manda os ocultos que a página escreveria (`f_cod_inst` ou
  `f_cod_inst2`, `f_inst_old`, `f_cod_curso` ou `f_cod_curso2`,
  `f_curso_old`, `f_agencia`, e os `_dout` do sanduíche); os campos
  desabilitados não vão. A releitura compara o curso sem o código CAPES.
  Uma alteração assim não tem "Desfazer" no registro do enviado. A
  instituição do endereço profissional vai pela busca `PRC_INST_ATIV` da
  página de endereço (seção 18), e o órgão pela janela de órgãos, atrás da
  capacidade `buscas-complementar-endereco`; com órgão no item, a instituição
  nova só vai com o órgão novo.
- **Travas**: além das de toda alteração (o "antes" de cada campo tem de
  bater, só os campos da operação podem mudar depois do envio), a formação
  confere o `f_nivel`, o `f_tipo` e, qualquer que seja o campo alterado, a
  instituição, o curso (os ocultos `f_inst_old` e `f_curso_old`) e o ano de
  início, sem acento, caixa nem espaço nas pontas: o `f_seq` sozinho não
  identifica o item (seção 16). Com a instituição trocada, o código de antes
  tem de ser o do Lattes, e a busca precisa achar exatamente um resultado com
  o código novo. A identificação confere o `f_nacionalidade` com o
  `NACIONALIDADE` do XML, porque esse oculto é preenchido pelo JavaScript da
  página e um GET que o traga vazio mandaria vazio. Sem `B` ou `E` no XML, a
  mudança de identificação segue à mão. Dois atributos que cairiam no mesmo
  campo também mandam a mudança à mão.
- **Fora, com o motivo na tela**: o que o formulário do nível não mostra (o
  título e o ano de obtenção do pós-doutorado, por exemplo), os nomes em
  inglês, o órgão, o número do orientador e os dados do Oasisbr da
  formação; a instituição "outra" (cadastrada fora da busca), que o
  formulário não tem e o editor mostra só para ler; as do sanduíche e da
  cotutela, que a exportação traz só pelo código; o CPF e os nomes dos pais
  (ocultos na página); formato das datas, permissão de divulgação, foto,
  falecimento, e ORCID; a unidade do endereço profissional, e a instituição
  nova dele sem o órgão escolhido de novo; o tipo de vínculo e o
  enquadramento funcional enumerado; os dados da raiz `CURRICULO-VITAE`, que
  o Lattes gera.

Desde 18/10/2026 vão também a pessoa com deficiência (`f_pcd_r`, uma caixa
`f_pcd` por tipo mais o `f_pcd=DUMMY` oculto, `f_priv_pcd`) e as redes
sociais do endereço. **Observado** no Lattes real: PCD visual privada e uma
segunda rede (GitHub) entraram e voltaram na releitura da página. O formato
das duas na exportação ainda não foi visto.

Três formulários montam ocultos em XML no `check()`, e o Lattes recusa o
envio sem eles com "ORA-19032: Era esperado o identificador de XML":

| Formulário    | Oculto                  | Montado de                                                                              |
| ------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| identificação | `f_dados_grid`          | `provider2` (ORCID), pelo `array2xml` da página, com o corte do ORCID                   |
| endereço      | `f_dados_grid`          | `provider` (redes sociais)                                                              |
| endereço      | `f_dados_grid_contatos` | `providerContatos` (outras formas de contato)                                           |
| projeto       | `f_instituicoes`        | `titularInstProvider`: `<root><item><cod>…</cod><tipo_inst>…</tipo_inst></item></root>` |

**Observado** em 18/10/2026. Antes disso nenhuma alteração de identificação
nem de projeto tinha sido gravada pelo conector, e um envio de endereço com
as grades vazias poderia apagar as redes.

As páginas também põem valores por script, depois do HTML:
`$("[name=X]").val("v")` em selects e ocultos e, nos rádios,
`if ("a" == "b") $("input[name=X][value=V]").attr("checked", "true") else {…}`.
Lido só do HTML, o formulário traz o padrão: um envio de identificação assim
mandou as privacidades de nascimento, identidade, passaporte e cor/raça como
Público e a cor/raça vazia (desfeito na hora, conferido igual byte a byte).
O conector aplica os dois (`scriptValues`, `scriptRadios` em
`src/bridge/form.ts`) em toda leitura de formulário. **Observado.**

O contrato da formação é parcial: lista os campos que as operações gravam e
os de controle, menos o ano de obtenção e o título, que não existem em todos
os níveis (a amostra é a primeira formação da lista `FA`, de qualquer nível).
Os outros aparecem como "campo novo" na verificação, que só avisa. O
endereço, a identificação e as outras informações têm o formulário inteiro,
como o censo o leu.

## 20. Censo dos formulários (LAT-55, 15/10/2026)

As seções acima foram escritas formulário a formulário, à mão. O censo faz a
mesma leitura de uma vez, para todos os formulários de inclusão que este
documento e a captura das listas de 13/10/2026 conhecem: abre cada um por GET,
sem `f_seq`, e guarda os campos na ordem da página com o rótulo ao lado, os
ocultos e as opções, sem nenhum valor do currículo. Para os itens que o
currículo de quem roda já tem, abre também o formulário de edição e casa cada
campo com o atributo do mesmo item na exportação, o que transforma em
**observado** a ligação campo ↔ atributo que as tabelas acima marcam como
inferida.

O código está em `src/census/`, a lista de formulários em
`src/census/targets.ts` e `targets-production.ts` (com o que é observado e o
que é inferido em cada entrada), e as capturas, o relatório de cobertura e o
passo a passo em `docs/lattes-formularios/`.

**Primeira captura (15/10/2026)**, na sessão do dono do currículo, cerca de
13 minutos: 77 formulários, 72 lidos, 285 ligações observadas em 15 entradas
com itens no currículo. **Observado**:

- Confirmadas pela passada de edição, entre as que as seções acima marcavam
  como inferidas: no evento, `F_FORMA` → `FORMA-PARTICIPACAO` e `f_cidade` →
  `CIDADE-DO-EVENTO`; na formação (graduação, mestrado, técnico), `f_ano_ini`
  → `ANO-DE-INICIO`, `f_ano_fim` → `ANO-DE-CONCLUSAO`, `f_inst` →
  `NOME-INSTITUICAO`, `f_curso` → `NOME-CURSO`, `F_BOLSA` → `FLAG-BOLSA`,
  `f_titulo` → título do trabalho e `f_orient` → orientador; no endereço
  residencial, rua, bairro, município, UF, país, DDD, telefone e página; o
  `f_seq` do evento, da editoração, do trabalho técnico e do mestrado é o
  `SEQUENCIA-*` do item.
- Contrariado, depois explicado: nos 8 vínculos lidos, `f_stavinc`
  ("Possui vínculo empregatício") 0 veio com
  `FLAG-VINCULO-EMPREGATICIO="SIM"` e 1 com `NAO`, ao contrário da tabela da
  seção 5 (então 1 = sim) e de `src/bridge/plan.ts`. Conferido na tela no
  mesmo dia: um dos vínculos mostra "Sim" no Lattes e `NAO` na exportação,
  e `f_regime` não inverte. A exportação grava o contrário do
  formulário; a seção 5, o conector e o Lattes simulado passaram a tratar
  `f_stavinc` como invertido (LAT-56), e o censo só acusa esse campo se a
  inversão deixar de aparecer.
- Os formulários de corpo editorial, revisão e assessoramento
  (`PKG_REVISOR.inclui`, `f_natur` MB, MA, RV, RA) são `GN_ATIV`, POST
  `PKG_REVISOR.INCLUI`, com os ocultos de uma atividade da atuação
  (`f_codinst`, `f_seq_ativ`, `f_seq_funcao_ativ`) e 7 ou 8 campos (periódico
  ou agência, comitê, mês e ano de início e fim, status). Que elemento do XML
  gravam não se sabe.
- A janela prévia da patente (`informar_dados_patente?ftipo=PP`) responde 404
  com `f_cod`: o Lattes a abre sem ele, e o coletor passou a abrir assim.
- A inclusão de artigos publicados (`PKG_ARTIGO.form`, do link da lista) veio
  sem formulário nenhum; o coletor passou a guardar a forma da página (tamanho
  e contagem de tags) para a próxima leitura dizer o que veio. A de linhas de
  pesquisa não tem link na lista (**inferido**: sai de uma função da página).
- Das produções, só trabalhos técnicos e editoração estão na exportação do
  dono, e as duas foram lidas só até o limite padrão de 8 itens. As outras
  saíram "sem-itens" porque a passada de edição decidia isso só pelo XML, sem
  abrir a lista; a atuação e a atividade saíram "ok" com 0 itens lidos, por
  falta de link de edição reconhecível (a grade de atividades monta o link
  por JavaScript, seção 8). Corrigido na LAT-58: a passada conta os links da
  lista antes do limite, abre a lista mesmo sem item no XML e marca
  `so-na-lista` e `sem-link` (`lattes-formularios/README.md`).
- Nos trabalhos técnicos, `f_seq` ↔ `SEQUENCIA-PRODUCAO` bateu em 5 itens e
  não bateu em 3, com os outros campos casando nos 8: o `f_seq` da lista não
  é sempre o número do item na exportação. **Observado**; o porquê não se sabe.

## 21. Recaptura de 15/10/2026 (LAT-57)

Só leitura, na sessão do dono do currículo, com o `inspect()` e o
`capture({ scripts: true, discover: true })` do censo
(`lattes-formularios/README.md`): 31 páginas, com os scripts da própria
página sem dado pessoal. Os arquivos crus não são versionados; o que virou
entrada do censo está em `lattes-formularios/censo-2026-10-15b.json`. Tudo
abaixo foi lido no código das páginas, sem enviar nada. **Observado**, menos
onde está marcado.

**Datas da patente.** Ficam na grade `gridContatos`, cada linha um objeto
`{id, contato, endereco}`: `id` é o código da situação como número (1
depósito, 2 depósito PCT, 3 concessão, 4 expiração, 5 pedido de exame, 6
comercialização, 7 licenciamento, 8 cessão, 9 aguardando negociação, 10 em
domínio público), `contato` é o rótulo da opção ("Depósito", "Depósito PCT",
"Pedido do Exame", "Licenciamento", "Concessão", "Comercialização", "Cessão",
"Em Domínio Público", "Aguardando Negociação"; a expiração não está no combo)
e `endereco` é a data. A data se digita com a máscara `formatacao.data` e
`check_data()` exige dez caracteres com barras: `dd/mm/aaaa`. Na situação 9
a data vira "Não se Aplica". O `check()` monta `f_dados_grid_datas` com
`array2xml("item", "root", gridContatos.getProvider())`, que passa o vetor por
`json2xml.convert` e troca as marcas numéricas, e tira `<search/>`,
`<getObj/>` e "Não se Aplica". Uma linha fica assim:

```xml
<root><item>
	<id>1</id>
	<contato>Depósito</contato>
	<endereco>01/02/2024</endereco>
</item >
</root >
```

O `check()` da patente exige depositante ou titular (as grades
`titularPessoaGrid` e `titularInstGrid`, que vão em `f_depositante_pessoa_l` e
`f_depositante_inst_l`, com as chaves da seção 16), país, categoria (`f_natureza`), natureza (`f_tipo`),
instituição de registro, número (com o INPI, `^(PI|MU|BR)\d+$`), e a data de
depósito ou a de depósito PCT, de onde ele tira o ano (`f_ano`). O número já
cadastrado é conferido pelo POST `verifica_cadastrado` (`existeCadastrado`).
O sentido de `pais`, `staValidado` e `tipoInst` nas grades de titulares não
foi lido. **Lacuna.**

**Datas dos outros registros.** Na cultivar protegida (`f_dta_dep` "Data de
depósito", `f_dta_conc` "Data de concessão"), na registrada (`f_dta_dep`) e no
desenho industrial (`f_dta_dep` "Data do registro", obrigatória; `f_dta_conc`
"Data de concessão") as datas são campos de texto, e o `check()` as lê como
`dd/mm/aaaa` (`substr(6,4) + substr(3,2) + substr(0,2)`, mensagens "Digite no
formato dd/mm/aaaa"). Na marca e na topografia os mesmos campos são ocultos e
não há campo de data na tela; que só a recuperação de dados do INPI os
preencha é **inferido** do código, que é o mesmo para todos os tipos.

**Autores, inventores e melhoristas.** Em todos os registros e nas produções
lidas (artigo aceito, trabalho em anais, trabalho técnico, bancas), o
`check()` exige o próprio nome na grade (`checkIncluiUsuarioComoAutor`: alguma
linha com o código `c` começando com "-", vazio ou "D"; na cultivar, "lista de
melhoristas"). O formulário de inclusão abre com a grade vazia: o vetor
`autorProvider` é `[{}]`, só a linha em branco do fim. A grade vai em
`f_autores_l` com as chaves `c`, `l`, `t`, `pais` e `add` de cada linha, na
ordem do objeto (nos registros, também `tit`), separadas por `|`, e as
linhas por `@`; nos artigos, o que passa de 32.500 caracteres segue em
`f_autores_l2` a `f_autores_l4`. Um autor digitado na hora vira
`{l, t, c: " ", tit: "n", add: true, …}`; os sugeridos vêm do `autorDP` do
menu (seção 18). A linha do dono no `autorDP` está na seção 22; o sentido de
`pais` não foi lido.

**Projeto.** A equipe usa a mesma grade, com as chaves `c`, `l`, `t`, `tit` e
`add`; o `check()` exige o próprio nome, um coordenador (e só um) e, na
inclusão, o órgão ou unidade (`f_codorgao` ou `f_codorgao2`). Os financiadores
vão em `f_inst_l` com quatro valores da grade `grid_2` por linha, unidos por
`|` e terminados em `|@`; os valores vêm da janela
`pp_lista_inst?f_pgm=INSTFINANC`, e o sentido de cada um não foi lido. As
produções e orientações ligadas vão em `f_producoes_l` e `f_orientacoes_l`, o
primeiro valor de cada linha seguido de `@`. Na página de alteração, cada
valor é o `innerHTML` do `<span>` da célula (seção 18, "Órgão e unidade do
projeto", **observado** em 20/10/2026).

**Programa de computador registrado.** A lista de programas
(`PKG_PATENTE_REGISTRO.LISTA?f_cod_tipo=PC`) abre a janela prévia
`informar_dados_patente?ftipo=PC` e depois
`pkg_patente_registro.form?f_sta_inovacao=&f_reg=S&f_cod_tipo=PC&f_inst=…`. O
formulário com `f_reg=S` tem instituição de registro, número, data do registro
e data do certificado de registro (obrigatórias), linguagens, finalidade,
instituição financiadora e o tipo de programa, todos obrigatórios no
`check()`.

**Artigo publicado.** A lista oferece três entradas: pelo DOI (`F_COD_DOI`),
pelo periódico (`F_ID_PERIOD`) e à mão (`F_ORIGEM_WS=F`). A entrada à mão
abre o formulário, agora no censo.

**Prefácio, posfácio e outra produção bibliográfica.** `prc_bib_demais_lista`
sem `f_cod_tipo` responde 404, e a leitura das listas do menu (`discover`) só
achou inclusão de tradução e partitura entre os demais tipos. Que o Lattes não
ofereça mais incluir esses dois tipos é **inferido**.

**Licença.** `f_tipo_licenca` tem `M` maternidade, `P` paternidade e `A`
adoção; as datas são `dd/mm/aaaa`. O `check()` exige o tipo, o início, o fim e
a data de nascimento ou adoção (`f_dta_nasc_adoc`), início depois dela e
período de até 180 dias. O XML da licença não guarda a data de nascimento ou
adoção, e o XSD só tem `MATERNIDADE`.

**Áreas de atuação.** `prc_area_atuacao` serializa a grade em `f_area_l` com
as chaves `l`, `c`, `r` e `p` (o `r` com a letra "r" na frente) e a
privacidade em `f_privacidade`, linha a linha. O sentido de `r` não foi lido.

**Formação complementar.** O `check()` exige nível, curso (pela busca
`prc_curso_form?f_pgm=FORM&f_nivel=<nível>&f_inst=<instituição>`), instituição
(pela busca `prc_inst_form?f_nivel=<nível>`, dispensada nos níveis B, C, 9, D
e Y), situação (menos na livre-docência) e carga horária numérica, e envia
para `PKG_FORMACAO_COMPL.FORM2`. O formulário não tem os anos; o que vem
depois do envio só se vê enviando. **Lacuna.**

**Linha de pesquisa.** A lista ("Atuação profissional - Linhas de pesquisa")
não tem formulário nem link de inclusão. Que a linha entre pela atividade de
pesquisa e desenvolvimento da atuação é **inferido**.

**Orientações.** A busca de instituição é `prc_inst_form?f_cod=…`, sem nível;
a de curso, `prc_curso_form?f_pgm=TESE&f_cod=…&f_inst=<código>&f_nivel=<nível>&f_sta_area=<s>`,
com o nível tirado da natureza (`retnivel()`: 41 mestrado 3, ou 9 com
`f_sub_prod` 30; 42 doutorado 4; 43 aperfeiçoamento 2; 44, 45 e 49 nível 1;
46 4; os códigos A41 a A49 das orientações em andamento seguem o mesmo, com
`f_sub_prod` 37 para o mestrado profissional) e `f_sta_area` "N" no
aperfeiçoamento e na graduação; a agência é `prc_agencia`. `f_sub_prod` e
`f_dsc_outra` vêm de `atribui("<código>#<descrição>")`. O `check()` exige
natureza, título, ano, país, idioma, tipo de orientação, nome do orientando,
instituição e, menos na supervisão de pós-doutorado, na iniciação científica e
em outra natureza, o curso.

**Corpo editorial, revisão e assessoramento.** As quatro listas só têm o link
de inclusão; o currículo não tem item, e o elemento do XML continua
desconhecido.

## 22. Recaptura de 15/10/2026, lotes 3 a 5 (LAT-57)

Só leitura, na sessão do dono do currículo, com os ajudantes `activities()`,
`authorShape()` e `inspect()` do censo (`lattes-formularios/README.md`).
Os arquivos crus não são versionados; as nove telas de atividade viraram
entradas do censo em `lattes-formularios/censo-2026-10-15c.json`.
**Observado**, menos onde está marcado.

**A linha de autor do menu (lote 4).** O vetor `autorDP` do menu tem 14
linhas, todas com as chaves `l`, `c`, `t` e `deletable`, nessa ordem. O código
`c` é "9" em nove linhas, "99" em quatro e vazio em uma. O `authorShape()`
comparou cada `l` com o nome completo do dono, sem devolvê-lo, e achou duas
linhas, com `codePattern: "99"` na última; se a linha com `c` vazio casou
com o nome, essa rodada não disse. O que o código das páginas mostra:

- o `check()` só reconhece a própria pessoa por uma linha com `c` vazio,
  começando com "-" ou igual a "D" (seção 21);
- o `recuperaPosicaoUsuario()` do projeto procura na grade serializada por
  "||" ou "|-", isto é, um `c` vazio ou negativo logo depois de `l`, e o
  `seqResp()` devolve "0" para o coordenador com `c` vazio;
- o `update.grid()` copia a linha escolhida na sugestão para a grade com
  `$.extend` e acrescenta `editable`;
- um autor digitado na hora vira `{l, t, c: " ", tit, add: true}` e, na grade
  serializada, "l|t| |…";
- em `pp_lista_autores` (abaixo) os códigos são de 1 a 12, mais um -1, cujo
  nome e citação levam um segundo texto entre parênteses; a página pinta de
  azul o código negativo e o esconde quando `ignoraUsuario` vale 1. Que o -1
  seja a própria pessoa é **inferido** do nome da variável.

**Nenhum número do Lattes na grade.** O identificador do dono
(`NUMERO-IDENTIFICADOR`, `f_id`, `id_usuario`, `nro_id_cnpq` e parecidos) foi
procurado nos scripts e ocultos das capturas de 15/10/2026
(`censo-2026-10-15.json`, `b`, `c` e os três arquivos crus da recaptura).
Não aparece em linha nenhuma do
`autorDP`, em nenhuma chave serializada em `f_autores_l` nem em oculto dos
formulários de registro, projeto e atividade. O único `f_id` é o parâmetro do
Importar (`pkg_import_cv.form01`), e o redator troca qualquer número longo por
`[removido]`, então um valor de 16 dígitos não sobraria para ser lido, mas o
nome do campo, sim. Os códigos `c` das outras linhas têm um ou dois dígitos,
como os de `pp_lista_autores`: que sejam posições numa lista, e não
identificadores, é **inferido** do padrão. O número do Lattes que o conector
tem é o do menu (`lattesIdFrom`, o link `lattes.cnpq.br/<16 dígitos>`), e a
fila já para quando ele não é o do currículo aberto no editor.

Daí o conector usar a linha com `c` vazio como a da própria pessoa só quando
ela traz o nome completo (`l`) ou uma das citações (`t`) do `DADOS-GERAIS` do
currículo; senão, para sem enviar. Que essa linha seja a do dono continua
**inferido**: é a única que o `check()` aceita, mas o que o Lattes grava com
ela só se vê numa inclusão, e por isso o registro, o projeto e a atividade
criados voltam com o pedido de conferir no Lattes os inventores, a equipe ou
as disciplinas, que o conector não relê. Desde o freio de escrita (LAT-59)
voltam conferidos pelos outros campos, com o pedido no registro do enviado:
como divergentes, parariam a fila e bloqueariam o envio ao CNPq a cada
inclusão. Com as chaves
na ordem do `autorDP`, a linha da pessoa vai na grade como "l||t" (`deletable`
e `editable` ficam de fora da lista de chaves de cada formulário), e no
projeto, como coordenadora, "l||t|s" (`src/bridge/author-grid.ts`).

**Atividades de uma atuação (lote 3).** `pkg_ativ.cargo?f_natur_ativ=<n>`,
com `f_ctr=I`, envia para `PKG_ATIV.cargo`. As naturezas 1, 2, 5, 6, 7, 8, 9 e
B têm o mesmo formulário: órgão ou unidade (`f_orgao`, desabilitado, que a
busca `prc_orgao_cargo?f_modal_cv=9&f_cod_inst=<instituição>` preenche em
`f_codorgao`), início, período (`f_status` `N` anterior, `S` atual), fim e
privacidade. A de ensino (4) troca o órgão por nível (`f_nivel`) e curso
(`f_curso`, pela busca `prc_curso_form?f_inst=<instituição>&f_nivel=<nível>`,
que preenche `f_cod_curso`). Os campos ocultos são `f_natur_ativ`, `f_ctr`,
`f_espec_l`, `f_cod`, `f_codinst`, `f_seq_ativ`, `f_seq_funcao`,
`f_codorgao`, `f_codorgao2`, `f_exc`, `f_natur_old`, `f_cod_curso`,
`f_cod_curso2`, `f_curso_old` e `f_orgao_old`.

O `check()` exige o órgão em toda natureza menos a de ensino; na de ensino,
exige o curso nos níveis 3, 4 e 401 a 404, e o nível sempre. Exige também o
período, o ano de início (não antes do nascimento, não depois do ano atual),
o fim quando o período é anterior e nenhum fim quando é atual, e ao menos uma
linha na grade de descrições ("Informe a descrição da atividade").

A grade de descrições tem uma coluna, com o rótulo de cada natureza: "Cargo ou
função" (1 e B), "Linhas de pesquisa" (2), "Disciplinas ministradas" (4),
"Estagio Realizado" (5), "Serviço realizado" (6), "Atividade de extensão
realizada" (7), "Treinamento ministrado" (8) e "Outra atividade
técnico-científica" (9). O `check()` serializa a grade em `f_espec_l` como
`<n>@<c>?<nome>!` por linha, oito linhas no mínimo, as vazias como `<n>@?!`.
O número da linha começa em 1, e uma linha digitada vira `{l, c}`, com o `c`
que ela já tinha ou 0 (`edit.atividade`), então uma disciplina nova vai como
`1@0?<nome>!`. O que o Lattes faz com esse código numa alteração não foi
lido. A linha de pesquisa, o treinamento ministrado e
a disciplina entram, então, pela grade da atividade de pesquisa e
desenvolvimento, de treinamento e de ensino, o que confirma o que a seção 21
deixou como inferido para a linha de pesquisa.

A ligação de cada campo com o XML (`TIPO-ENSINO`, `FLAG-PERIODO`, as
disciplinas como `DISCIPLINA` com `SEQUENCIA-ESPECIFICACAO`) é **inferida**
pelo rótulo: o currículo de quem capturou não tem atividade de ensino. Os
níveis de 401 a 409 seguem os rótulos das opções.

**Titular da patente (lote 5).** `pkg_titular_inst.sele_inst` abre uma busca
de instituição por nome com `f_ctr` e `f_cod` ocultos; a resposta foi lida em
27/10/2026 (seção 17, "Patente: exportação, depositante e histórico").
`pkg_titular_inst.sele_inst?f_ctr=O` foi recusado pelo próprio censo, que não abre
endereço com `f_ctr` preenchido (`isSafeGet`). A sugestão de titular
pessoa vem de `self.parent.titularPessoaDP`, no menu, cuja forma não foi
lida. **Lacuna.** O conector o lê com a forma do `autorDP`, o que é
inferido (seção 17, "Patente: exportação, depositante e histórico").

**Financiador, produção e equipe do projeto (lote 5).**
`PKG_PROJETO.pp_lista_inst?f_pgm=INSTFINANC` é uma busca por nome que envia
(POST) para `PKG_PROJETO.PP_LISTA_INST`, com `F_CTR`, `F_COD`, `F_PGM`,
`F_COD_INST`, `F_SEQ_FUNCAO`, `F_SEQ_ATIV` e `F_SEQ_PROJ` ocultos, e um
segundo formulário para `PKG_PROJETO.EDITAR_FINANCIAMENTO` (`P_COD`,
`P_COD_INST`, `P_CTR`). A resposta não foi lida. `PKG_PROJETO.pp_lista_prod`
responde 404 sem parâmetros. `PKG_PROJETO.pp_lista_autores` tem um campo de
busca, a lista de pessoas (cada uma como `p[i]="<código>#<nome>@<citação>"`)
e o link `pkg_projeto.novo_equipe?f_tipo=A&f_nome=`
para incluir quem não está na lista.

## 23. Valores em XML público e opções capturadas (26/10/2026)

Conferência estrutural, sem sessão do dono e sem enviar nada ao CNPq. Foram
lidos em memória os oito XMLs de
[`RafaelQSantos-RQS/LattesHub`, `database/data/lattes/`](https://github.com/RafaelQSantos-RQS/LattesHub/tree/HEAD/database/data/lattes).
Nenhum currículo foi copiado para o repositório. **Observado nesses XMLs:**

- `TIPO-GRADUACAO="N"` em duas exportações. A captura `formacao-FA-1`
  oferece N (normal) e S (sanduíche).
- `CATEGORIA` da patente como `Produto`, `Processo` e `Produto e Processo`.
  `Outra` é a quarta opção da captura; sua grafia no XML segue **inferida**,
  como já era no mapeamento do conector.
- `DISPONIBILIDADE` de processos como `RESTRITA`, `IRRESTRITA` e
  `NAO_INFORMADO`. Nos produtos foram encontrados os dois últimos. Os três
  códigos também constam no enumerado do software no XSD.

Nos XMLs públicos de
[`LiaCasatiRamaldes/vira-lattes-db`, `cv/`](https://github.com/LiaCasatiRamaldes/vira-lattes-db/tree/a6bddccdbcf10e077f0f8f525f6e0ec2eb1cff69/cv)
e [`NARizzardi/UFPR`, `1002/lattes/lattes-cvs/`](https://github.com/NARizzardi/UFPR/tree/37a78374e73a533a327f4aa8b79a17c6745d3730/1002/lattes/lattes-cvs),
também foram encontrados S na graduação, `RESTRITA` e `IRRESTRITA` no
relatório de pesquisa e os três códigos no trabalho técnico. Esses
exemplos documentam a grafia; não substituem um teste de gravação atual.

As capturas de produto, processo, relatório de pesquisa e trabalho técnico
têm o mesmo select `f_disp`: vazio, `Restrita`, `Irrestrita`. A ligação por
valor de 18/10/2026 confirmou os rótulos sem distinguir caixa. O editor
oferece os códigos em maiúsculas e o conector os traduz para o select;
`NAO_INFORMADO` corresponde à opção vazia. Esta última correspondência é
**inferida**, conferida na releitura do formulário, mas ainda sem teste de
gravação acompanhado.

O XML de teste público
[`nsi-iff/lattes_api`, `spec/resources/1234567890123456.xml`](https://github.com/nsi-iff/lattes_api/blob/HEAD/spec/resources/1234567890123456.xml)
usa `RACA-OU-COR="Parda"`. Isso não comprova uma gravação atual no Lattes.
A lista do editor vem das seis opções de `fnro_id_raca_cor` já capturadas;
o conector mantém o mapeamento anterior por rótulo, sem acento nem caixa.

O tipo de licença também usa as três opções capturadas (`f_tipo_licenca`):
Maternidade (M), Paternidade (P) e Adoção (A). `MATERNIDADE` consta no XSD;
`PATERNIDADE` e `ADOCAO` continuam **inferidos** do rótulo, como no mapeamento
que o conector já usava. A lista da interface compartilha esses valores com
o planejador; o tipo vazio é recusado antes do envio. Isso não libera a
inclusão de licença, que ainda exige uma data de nascimento ou adoção fora
do XML (seção 21).

## 24. Recaptura de 26/10/2026

Só leitura, por GET, com o `inspect()` do censo na sessão do dono (a opção
`editOf` abre a alteração do primeiro item de uma lista). O currículo não
tinha livros, orientações, bancas, projetos de pesquisa nem patentes: dessas,
foram lidas as páginas de inclusão, com os scripts. Os arquivos crus não são
versionados. **Observado**, menos onde está marcado.

- **Natureza do livro** (`PKG_LVR_CAP.FORM_LVR`). O `dominio()` abre um combo
  com as opções no próprio script, pelo tipo: 131 tem 1 Coletânea, 2 Texto
  integral, 3 Verbete e 4 Outro; 133 tem 5 Livro, 6 Anais, 7 Catálogo,
  8 Coletânea, 9 Enciclopédia, 10 Periódico e 11 Outro. O `atribui()` grava
  em `f_cod_sub_prod` só o primeiro caractere do código (10 e 11 viram 1) e
  o rótulo em `f_sub_prod`, desabilitado. O `check()` não exige a natureza.
  O conector manda o código pelo tipo; Periódico e o Outro da organização
  ficam à mão. **Inferido:** o valor do XML pelo rótulo.
- **Outra produção bibliográfica** (`prc_bib_outraprod`, `GN_BIB`, lida na
  inclusão e numa alteração). Natureza em texto livre (`f_natureza`, até
  100; o `dominio()` só sugere "Trabalho de Conclusão de Curso"), título,
  ano, país, idioma, meio, home page, `F_RELEV`,
  `F_STA_DIVULGACAO_CIENTIFICA` (S/N), editora, cidade, páginas, ISSN/ISBN,
  `f_ref` e os textos em inglês. Não há DOI nem natureza em inglês.
- **Tipo da orientação** (`pkg_orient.form`). O `dominio()` do mestrado tem
  29 Acadêmico e 30 Profissional nas concluídas, 36 e 37 nas em andamento; o
  `atribui()` grava o código em `f_sub_prod` e o rótulo em `f_dsc_outra`. A
  outra natureza abre "Outro Tipo" e pede o texto num `prompt()`, que vai em
  `f_dsc_outra`; as outras naturezas não têm tipo. **Inferido:** `ACADEMICO` e
  `PROFISSIONALIZANTE` pelos rótulos, e que o `TIPO` das outras orientações
  concluídas seja o texto de `f_dsc_outra`, que o conector manda só na outra
  natureza (lido de novo em 27/10/2026).
- **Banca de trabalho** (`PKG_BANCA_TRAB.form`). O `testa_nivel()` da banca
  limpa só a instituição e o curso (com confirmação); o `check()` aceita
  `f_sub_prod` só no mestrado. Um script move um dos rádios de natureza na
  carga da página, e os índices de `sele_inst()` e `curso()` seguem a ordem
  viva, lida em 27/10/2026 (seção 18).
- **Patente e registros** (`pkg_patente_registro.form`). O titular instituição
  sai de uma sugestão sobre o vetor `titularInstDP` do menu, cuja linha vai
  inteira para a grade, ou da janela `PKG_TITULAR_INST_PATENTE.sele_inst`. O
  combo da linha da grade de situações monta as opções da chave `contato`,
  que as entradas não têm (elas têm `situacao`): trocar a situação na linha
  mandaria o rótulo vazio. O "Incluir nova" usa `unshift` com `id`,
  `contato` e `endereco`, recusa repetidas menos o licenciamento (7), e a
  lixeira some na linha com `deletable` "false", menos na concessão (3). O
  ambiente do programa de computador sai do vetor `programaDP` da página (97
  entradas, `l`, `n` e `c`, até 3 por item); `f_ambiente` leva os `c`. Como a
  exportação grava `AMBIENTE` não foi visto.
- **Projeto** (`PKG_PROJETO.form`, inclusão). O financiador entra pela
  busca `pp_lista_inst?f_pgm=INSTFINANC`, cujo `seleciona()` abre
  `PKG_PROJETO.EDITAR_FINANCIAMENTO` com `P_COD`, `P_COD_INST` e `P_CTR`; a
  linha existente se edita na mesma página, com `P_VALORES` e `P_INDICE`. A
  natureza, a moeda e o valor saem dela, que sem uma linha real responde 404. Os rótulos de natureza que a página conhece são Auxílio Financeiro,
  Bolsa, Remuneração, Cooperação e Outra; o código só foi visto para o
  primeiro (A). As produções e orientações ligadas saem de
  `PKG_PROJETO.pp_lista_prod` com `f_tpo=PROD` ou `f_tpo=TESE`, sem o
  projeto, e cada linha escolhida entra com `importarDados1`; o `check()`
  manda o primeiro valor de cada linha em `f_producoes_l` e
  `f_orientacoes_l`. Que esse valor seja a `SEQUENCIA-PRODUCAO` do item não
  foi conferido. O órgão e a instituição só são exigidos na inclusão
  (`f_ctr` I), e `f_orgao` vai desabilitado.
- **Endereço** (`prc_endereco`). Os tipos de outra forma de contato são
  7 Telegram, 3 MSN e 6 WhatsApp, com a privacidade 1 Público ou 2 Privado;
  o "Inserir nova" usa `unshift` com `id`, `contato`, `endereco`,
  `privacidade` e `visibilidade`, recusa o mesmo tipo com o mesmo endereço e
  aceita até 5. Vai em `f_dados_grid_contatos` pelo mesmo `array2xml` das
  redes. Como a exportação grava `OUTRA-FORMA-DE-CONTATO` não foi visto.
