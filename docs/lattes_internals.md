# Como o editor do Currículo Lattes funciona por dentro

Notas de reconhecimento do editor web do Lattes (`wwws.cnpq.br/cvlattesweb`),
para quem for escrever a ponte com o navegador ou só tiver curiosidade. Tudo
aqui foi observado numa sessão logada do próprio dono do currículo, só com
leitura: as páginas de formulário foram baixadas por GET e analisadas, nenhum
formulário foi enviado.

Datas das observações: 10/10/2026 (primeiro reconhecimento, ver
`lattes_editor_reconnaissance.md`) e 11/10/2026 (formulários de edição, este
documento).

Cada afirmação vem marcada como **observado** (visto no HTML, nos scripts ou
no comportamento do servidor) ou **inferido** (conclusão a partir do que foi
observado, ainda não confirmada).

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

| `f_ctr`   | Onde apareceu                                                                            | Significado                                                                                  |
| --------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `I`       | formulário de item novo (atividade em `pkg_ativ.cargo`, 10/10/2026)                      | incluir, **observado**                                                                       |
| `U`       | formulário de item existente: vínculo, formação, idioma, resumo, endereço, identificação | atualizar, **inferido** (é o valor que o formulário traz preenchido; nenhum envio foi feito) |
| `A`       | código da tela de Formação (10/10/2026)                                                  | alterar, **inferido**                                                                        |
| `E`, `E2` | função `dele` da lista de atuações; código da Formação                                   | excluir, **inferido**                                                                        |
| `V`       | botão de voltar/cancelar (10/10/2026)                                                    | voltar sem salvar, **observado**                                                             |

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

Cada linha de uma lista é identificada por números de sequência que batem
com os do XML exportado: `f_seq_ativ` com `SEQUENCIA-ATIVIDADE`,
`f_seq_hist` com `SEQUENCIA-HISTORICO`, `f_seq` da formação com
`SEQUENCIA-FORMACAO`. **Inferido** pela coincidência de nomes; falta
conferir um valor dos dois lados.

## 4. Telas

O editor é uma página só (`PKG_MENU.menu`) com camadas modais em `iframe`
(`modalCV1` a `modalCV3`): lista, formulário, busca de instituição.
**Observado** (10/10/2026). Cada formulário:

- valida no navegador com uma função `check()` que junta mensagens num
  vetor e as mostra com `alert()`;
- salva com `enviar()`, que faz `submit()` do formulário inteiro: um POST
  clássico, que recarrega o `iframe`;
- não tem token CSRF; o que amarra o envio à sessão é o cookie e o `f_cod`.

**Observado.** Se o servidor repete as validações de `check()`, não se sabe:
nenhum envio foi testado.

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
| `FC_LE`, `FC_CONVERSA`, `FC_ESCREVE`, `FC_COMPR` | caixas                                      | habilitam cada proficiência (**inferido**)                                                       |
| `f_tipo_privacidade`                             | lista `1`/`2`                               |                                                                                                  |
| `f_ctr` (`U`), `f_cod`, `f_seq`                  | ocultos                                     |                                                                                                  |

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

## 6. Sessão

A sessão do editor cai em poucos minutos (3 a 12 nos testes de 10/10/2026)
e passa a responder com a página de `pkg_sec.logon`. Em 11/10/2026, com a
aba aberta pelo próprio usuário, a sessão aguentou todas as leituras deste
documento. **Observado.** Abrir um segundo editor do mesmo currículo parece
derrubar o primeiro. **Inferido.**

## 7. O que ainda não se sabe

- Se `f_ctr=U` grava de fato a alteração (nenhum POST foi feito).
- Se o servidor revalida o que `check()` valida.
- Como `f_vinc` vira `TIPO-DE-VINCULO`, e o formato das grades de contato
  do endereço.
- O formulário de edição de uma atividade existente (`pkg_ativ.cargo` com
  `f_seq_funcao`, montado por JavaScript na grade da atuação).
