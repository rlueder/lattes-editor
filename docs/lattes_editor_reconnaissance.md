# Editor de Currículo Lattes: relatório de reconhecimento

> **Documento histórico.** Registra o que se sabia e se decidiu na data dele, e
> vale pelo porquê; parte já não descreve o editor. O editor como ele é hoje
> está em [`arquitetura.md`](arquitetura.md); o índice de tudo, em
> [`README.md`](README.md).

Data: 2026-10-10
Método: automação de navegador conduzindo uma sessão autenticada no próprio navegador do Rafael. Toda ação foi abrir, ler e fechar. Nenhum dado foi salvo, excluído ou publicado.
Alcance obtido: estrutura do editor, catálogo de menus, Atuação profissional (lista e formulário de inclusão), Formação acadêmica (lista, seletor de nível, formulário de inclusão, busca de instituição), Assistente de importação, Importação de produção, diálogo Imprimir, pontos de entrada de Exportar e Importar.
Não alcançado pela extensão: DOM do diálogo de importação XML, Idiomas, Resumo, Endereço, diálogo Enviar. Motivo: a sessão no servidor caiu quatro vezes em poucos minutos (ver seção 7). A importação em si foi depois testada à mão com arquivos gerados (seção 5.1).

---

## 1. Stack

| Camada          | Constatação                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Servidor        | Aplicação web em Oracle PL/SQL. Toda URL é `PKG_<module>.<procedure>` ou `prc_<name>` sob `/cvlattesweb/`. A correspondência de parâmetros é estrita: chamar `pkg_formacao.lista` sem `f_tipo` devolve HTTP 404 (o jeito do gateway de dizer "não há procedimento com essa assinatura").                                                                                                   |
| Autenticação    | SSO Keycloak em `login.cnpq.br` (realm `cnpq`, client `lattes`), inicializado na página com `check-sso`. O estado da sessão do lado do editor é um cookie em `.cnpq.br`. Não foi inspecionado além disso.                                                                                                                                                                                  |
| Front-end       | jQuery 1.6.4 e 1.7.2 carregados ao mesmo tempo, jQuery UI 1.8.13 e 1.8.16, jkmegamenu, tooltips tipsy, `modal_cv.js`, `caixa_msg.js`, `gridcv.js`, `lista.js` próprios. Google Analytics `ga.js`.                                                                                                                                                                                          |
| Identificadores | Aparecem dois códigos. A URL da página leva um `f_cod` de 32 caracteres hexadecimais que muda a cada login (sobreviveu a um novo login logo no início e depois mudou nos três seguintes, então trate-o como um token de sessão). Toda chamada de procedimento dentro da página leva outro `f_cod`, de 10 caracteres (o código do próprio currículo). Trate os dois como segredos nos logs. |

## 2. Modelo de navegação

Cada seção é uma página PL/SQL separada, carregada num iframe dentro de um modal feito com divs. Não existe nenhuma janela popup no editor propriamente dito.

| Modal      | Papel                                       | Exemplo                                                                |
| ---------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| `modalCV1` | Lista da seção                              | `pkg_ativ.lista`, `pkg_formacao.lista?f_tipo=FA`                       |
| `modalCV2` | Formulário de inclusão/edição               | `PKG_ATIV.inclui`, `pkg_formacao.form?f_tipo=FA&f_nivel=9`             |
| `modalCV3` | Diálogos de busca                           | `prc_inst_form` (instituições), `prc_inst_ativ`                        |
| `caixaMsg` | Confirmação/combo próprios dentro da página | aviso de "alterações não salvas", seletor de Nível, seletor de Vínculo |

Abrir uma seção é `modalCVn.setarUrl(url, true)`; o modal define `iframe.src = url` e a página filha chama `self.parent.modalCVn.habilitaModal()` quando fica pronta. Modais aninhados fecham com `removerModal()`. As páginas filhas alcançam o formulário pai com `self.parent.modalCV2.getDocument().document.forms[0]`.

Há uma exceção: a página de login abre o editor como uma nova janela (`pkg_login.prc_form` → nova aba com `PKG_MENU.menu`). Foi isso que tirou repetidas vezes a aba do editor do grupo de abas da extensão.

### Catálogo de menus (procedimento por seção)

Dados gerais: `prc_ident` (Identificação, recebe `f_pcd`), `prc_endereco`, `pkg_formacao.lista` (`f_tipo=FA` acadêmica, `f_tipo=AP` pós-doc/livre-docência), `pkg_formacao_compl.lista`, `pkg_idioma.lista`, `pkg_premio.lista`, `prc_area_atuacao`, `pkg_resume.form`, `prc_outras_inf`, `pkg_licenca.lista` (licença-maternidade/paternidade, corresponde ao elemento LICENCA acrescentado ao XSD de 2022).

Atuação: `pkg_ativ.lista`, `pkg_linhapesq.lista`, `pkg_revisor.lista` (corpo editorial, revisor de periódico, comitê de assessoramento, revisor de agência, tudo num só pacote), `pkg_projeto.lista` (pesquisa, extensão, desenvolvimento, ensino, outros).

Produção bibliográfica: `pkg_artigo.lista`, `pkg_artigo_pr.lista` (aceitos), `pkg_lvr_cap.lista`, `pkg_trabalho.lista` (anais), `pkg_texto.lista` (jornal/revista), `prc_bib_demais_lista` (prefácio, tradução, partitura, outras).

Produção técnica: `PKG_PATENTE_REGISTRO.LISTA` (patente, software registrado ou não, cultivar, desenho industrial, marca, topografia), `pkg_produto.lista`, `pkg_processo.lista`, `pkg_relatorio.lista` (trabalhos técnicos), `prc_tec_demais_lista` (apresentação de trabalho, curso de curta duração, material didático, editoração, maquete, cartas/mapas, organização de evento, entrevistas, redes sociais, relatório de pesquisa, outras), `PKG_ASSESSORIA_CONSULTORIA.lista`, `PKG_EXTENSAO_TECNOLOGICA.lista`.

Artística: `pkg_arte_nova.lista` (artes cênicas, música, artes visuais), `prc_arte_lista`.

Orientações: `pkg_orient.lista` (concluídas e em andamento). Bancas: `pkg_banca_trab.lista`, `pkg_banca_julg.lista`. Eventos: `pkg_evento.lista`. Demais trabalhos: `pkg_demais.lista`. Citações: `prc_indicadores`.

Dicionários (compartilhados): `pkg_dic_autor.lista`, `pkg_identificacao_coautor.form`, `pkg_dic_plv_nv.lista` (palavras-chave), `pkg_dic_area.lista`, `pkg_dic_instituicao_nova.lista`, `pkg_alteracao_periodico.lista`.

Ferramentas: `pkg_impcv.form` (Imprimir), `pkg_impcv.get_arquivo` (Exportar XML), `pkg_importa_xml.inicio` (Importar XML), `pkg_import_cv.lista` (Importação de produção), `PKG_IMPORT_ASSISTENTE.lista` (Assistente de importação), `pkg_publicar.mostrar_cv` (Enviar ao CNPq).

## 3. Mecânica de gravação (a parte que define o conector)

Os dois formulários capturados seguem o mesmo padrão:

1. O formulário é um formulário HTML clássico, `method=post`, com action apontando para o mesmo pacote (`PKG_ATIV.INCLUI`, `pkg_formacao.FORM`).
2. O botão Salvar chama um `check()` no cliente que valida os campos obrigatórios e a lógica das datas, junta as mensagens num array e as mostra por meio de `alerta()`.
3. Se tudo estiver certo, `enviar()` executa `dc.submit()`. É um POST de página inteira dentro do iframe. Não há AJAX na gravação em si.
4. O campo oculto `f_ctr` carrega a operação: `I` para inclusão, `V` para cancelar/voltar, e `E` e `A` aparecem no código de Formação para exclusão e alteração.
5. Não há token CSRF em nenhum dos dois formulários. Os únicos valores ligados à sessão são o `f_cod` e o cookie.

O AJAX existe apenas para validadores e efeitos colaterais, devolvendo JSON ou texto puro:

| Endpoint                               | Chamado de                                                                          | Finalidade                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pkg_formacao.valida_orientador_lates` | Formulário de Formação (POST, `f_cod`, `f_nme`, `f_nivel`)                          | Resolve o nome de um orientador para um ID Lattes; preenche `f_id_orientador` e `f_seq_orientacao` |
| `PKG_FORMACAO.SETA_ULTIMO_PUBLICO`     | Formulário de Formação (POST, `f_cod`, `f_seq`, `f_tipo`, `f_op`)                   | Garante que haja "pelo menos uma entrada pública"                                                  |
| `PRC_INST_FORM`                        | Busca de instituição (POST, `f_nome`, `F_CTR=C`, `F_COD`, `F_NIVEL`, `F_STA_OUTRA`) | Devolve uma lista de resultados em HTML; cada resultado é `javascript:seleciona(code, name)`       |

Há diálogos nativos por toda parte: 10 `alert()` e 5 `confirm()` no script do formulário de Atuação, 58 `alert()` e 6 `confirm()` no script do formulário de Formação, 2 `confirm()` na estrutura do editor ao sair. Digitar uma instituição à mão em vez de usar a busca dispara um `alert()` imediato. A exclusão usa `confirm()`. Sair do editor mostra um texto jurídico longo num `alert()` antes do logout do Keycloak. Qualquer automação que conduza a interface real precisa neutralizar esses diálogos (sobrescrever `window.alert`/`window.confirm` dentro do iframe antes de agir).

## 4. Mapas de campos dos formulários

### 4.1 Atuação profissional (`GN_ATIV` → `PKG_ATIV.INCLUI`)

| Campo                                                     | Tipo                                     | Observações                                                                                                                                 |
| --------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `f_inst`                                                  | texto, máx. 75                           | Nome exibido. Precisa vir da busca; digitar à mão dispara `alertainst()`, que restaura `f_inst_old`                                         |
| `f_cod_inst` / `f_cod_inst2`                              | oculto                                   | Código da instituição. A busca preenche `f_cod_inst` quando o código começa com `V`, e `f_cod_inst2` nos outros casos ("outra instituição") |
| `f_instold`, `f_inst_old`                                 | oculto                                   | Guardam o valor anterior                                                                                                                    |
| `f_vinc`                                                  | texto, máx. 30                           | Tipo do vínculo, definido pelo combo `dominio()`: Servidor público, Celetista, Professor Visitante, Bolsista, Outro (texto livre)           |
| `f_vinculo`                                               | oculto                                   | Código interno do vínculo                                                                                                                   |
| `f_stavinc`                                               | select: vazio, 0=Não, 1=Sim              | Possui vínculo empregatício                                                                                                                 |
| `f_enqua`                                                 | texto, máx. 45                           | Enquadramento funcional                                                                                                                     |
| `f_carga`                                                 | texto, máx. 3                            | Carga horária semanal                                                                                                                       |
| `f_regime`                                                | checkbox                                 | Dedicação exclusiva                                                                                                                         |
| `f_mes_ini`, `f_ano_ini`                                  | texto 2 / 4                              | Obrigatório: ano início                                                                                                                     |
| `f_status`                                                | rádio S / N                              | Atual (não finalizado) / Anterior (finalizado)                                                                                              |
| `f_mes_fim`, `f_ano_fim`                                  | texto 2 / 4                              |                                                                                                                                             |
| `f_outras_inf`                                            | textarea, máx. 3950                      |                                                                                                                                             |
| `f_tipo_privacidade`                                      | texto, com um select 1=Público 2=Privado | `verificaPriv()` força Público se for o único vínculo                                                                                       |
| `f_ctr`, `f_cod`, `f_codinst`, `f_seq_ativ`, `f_seq_hist` | oculto                                   | Operação e chaves                                                                                                                           |

Editar uma linha existente abre `PKG_ATIV.cargos_vinculos?f_cod=…&f_codinst=…&f_seq_ativ=N` no `modalCV2`. Reordenar é `PKG_ATIV.ordenar`.

### 4.2 Formação acadêmica (`GN_FORMACAO2` → `pkg_formacao.FORM`)

O nível é escolhido antes de o formulário abrir, num combo `caixaMsg` cujos valores de opção são as URLs dos formulários:

| `f_nivel` | Nível                                |
| --------- | ------------------------------------ |
| 4         | Doutorado                            |
| 3         | Mestrado                             |
| 9         | Mestrado Profissional                |
| 2         | Especialização                       |
| D         | Especialização - Residência médica   |
| 1         | Graduação                            |
| 7         | Ensino Profissional de nível técnico |
| C         | Ensino Médio                         |
| B         | Ensino Fundamental                   |
| X         | Aperfeiçoamento                      |

Campos (55 no total, na variante Mestrado Profissional):

| Grupo             | Campos                                                                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chaves            | `f_ctr=I`, `f_cod`, `f_seq`, `f_tipo=FA`, `f_nivel=9`                                                                                                                                                                               |
| Tipo              | `f_tpo_doutorado` rádio N (normal) / S (sanduíche)                                                                                                                                                                                  |
| Instituição       | `f_inst` (máx. 75, só pela busca), `f_cod_inst`, `f_cod_inst2`, `f_inst_old`                                                                                                                                                        |
| Curso             | `f_curso` (máx. 75, só pela busca), `f_cod_curso`, `f_cod_curso2`, `f_curso_old`, `f_carga` oculto                                                                                                                                  |
| Situação          | `F_STATUS` rádio N (em andamento) / S (concluído) / I (incompleto)                                                                                                                                                                  |
| Período           | `f_ano_ini`, `f_ano_fim`, `f_mes_obten`, `f_ano_obten`                                                                                                                                                                              |
| Bolsa             | `F_BOLSA` rádio S / N, `f_nme_agencia` (máx. 75, busca), `f_agencia` oculto                                                                                                                                                         |
| Detalhamento      | `f_titulo` (máx. 254), `f_orient` (máx. 60), `f_coorient` (máx. 60), `f_id_orientador`, `f_seq_orientacao`                                                                                                                          |
| Só para Doutorado | `f_orient_dout`, `f_inst_dout`, `f_meses_sw`, `f_orient_dout_sw`, `f_inst_dout_sw`, `f_meses_sw_aux`, `f_orient_dout_ct`, `f_inst_dout_ct`, mais seis códigos ocultos `f_cod_inst*_dout*` (instituições do sanduíche e da cotutela) |
| Listas            | `f_plv_l` (palavras-chave), `f_setor_l`, `f_area_l` ocultos, preenchidos por três inputs de texto sem nome, cada um com seu seletor                                                                                                 |
| Privacidade       | select 1=Público 2=Privado, `f_tipo_privacidade`                                                                                                                                                                                    |

Um segundo formulário, `formchk` (`f_cod_chk`, `f_seq_chk`, `start`, `finish`, `status`, `f_nme_orientador`), sustenta a chamada de validação do orientador.

Nota sobre o que está visível: o currículo atual do Rafael tem 3 linhas de Formação (Mestrado 2006–2007 na PUCRS, Graduação 2001–2004 na UFPel, técnico 1995–1998 no CEFET Pelotas) e 17 linhas de Atuação até 2026. A exportação XML de novembro de 2025 analisada antes está desatualizada; a atualização biográfica já está quase toda feita, o que diminui o valor de um caminho de escrita biográfico para o próprio Rafael.

### 4.3 Busca de instituição (`prc_inst_form`, `modalCV3`)

A busca é um POST para `PRC_INST_FORM` com `f_nome`, `F_CTR=C`, `F_COD`, `F_NIVEL`, `F_STA_OUTRA=N`. A resposta é HTML; cada resultado é um link `javascript:seleciona('<code>','<name>')`. `seleciona` escreve o código e o nome no formulário pai e chama `cancelar()` para fechar o modal. Existe um caminho "Cadastrar nova instituição" (`prc_inst_outra`). O mesmo mecanismo atende cursos (`curso()`) e agências de fomento.

Consequência: um conector não precisa conduzir a interface de busca. Ele pode fazer o POST da busca, interpretar os links e escrever `f_inst`, `f_inst_old` e `f_cod_inst` diretamente.

## 5. Superfícies de importação e exportação

| Entrada                  | Procedimento                                   | O que é                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assistente de importação | `PKG_IMPORT_ASSISTENTE.lista`                  | Exatamente uma fonte: teses e dissertações do Oasisbr (Ibict), botão "Importar Dados". Não existe no editor importação por DOI, Crossref, ORCID, Scopus ou Web of Science.                                                                                                                                                                                                                                                                                                                                       |
| Importação de produção   | `pkg_import_cv.lista` → `pkg_import_cv.form01` | Cópia de coautor: quando outro currículo lista você como coautor (pelo recurso de ID de coautor), você pode copiar aquele item. Vazio no caso do Rafael.                                                                                                                                                                                                                                                                                                                                                         |
| Imprimir                 | `pkg_impcv.form` → POST `pkg_impcv.trata`      | Geração de impressão/HTML. Campos: 40 caixas de seleção de seção (`f_check`), `f_tpo` R/A/C/P (Resumido, Ampliado, Completo, Personalizado), `f_est` (com ou sem gráficos), `f_idioma` 1/2 (PT/EN), `f_padrao` A/C (ABNT/Chicago), `f_per_atu` + `f_ano_atu`, `f_per_prod` + `f_ano_prod` (filtros de ano), `f_plv`, `f_setor`, `f_area`, `f_et_al`, `f_inf`, `f_relev`, `f_cit`, `f_exibir_cit`, `f_fmt=H`, `f_tpo_arq=0`. Serve de referência para o que o CNPq considera o layout de um currículo "completo". |
| Exportar                 | `pkg_impcv.get_arquivo?f_cod=…` no `modalCV1`  | Baixa `CV_<id>.zip` contendo um único `<id>.xml` (ISO-8859-1, raiz `SISTEMA-ORIGEM-XML="LATTES_OFFLINE"`). DOM não capturado.                                                                                                                                                                                                                                                                                                                                                                                    |
| Importar                 | `pkg_importa_xml.inicio?f_cod=…` no `modalCV1` | Três passos, e não dois. Testado à mão em 2026-10-10; ver 5.1.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Enviar                   | `pkg_publicar.mostrar_cv?f_cod=…`              | Etapa de publicação. Não foi aberta.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### 5.1 Importação XML, testada

Testes feitos pelo Rafael no próprio currículo, com arquivos gerados a partir da exportação recente. Todos os itens falsos foram excluídos depois.

| Etapa                      | Comportamento observado                                                                                                                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passo 1                    | Aceita só um `.xml` puro. O ZIP que o Exportar gera é recusado, então exportação e importação são assimétricas. O sucesso aparece num `alert()` nativo: "O arquivo foi enviado com sucesso!".                                                  |
| Passo 2                    | Caixas de seleção por módulo, todas marcadas ("Selecionar todos" ligado por padrão). O filtro de ano "Produção C&T a partir de" veio com 2004 desta vez (2007 em fevereiro), então o padrão é derivado do arquivo ou do currículo, e não fixo. |
| Passo 3                    | Lista item a item para os módulos escolhidos. Cada item leva um marcador: verde "não está cadastrada", vermelho "está cadastrada". Todos marcados. Confirmar / Descartar.                                                                      |
| Confirmar um item vermelho | Insere uma duplicata. O marcador é um aviso e não impede nada. Verificado: o TCC de 2004 voltou como duas linhas idênticas.                                                                                                                    |
| Atualização no lugar       | Não existe pela importação. Edições em itens existentes passam pelos formulários.                                                                                                                                                              |
| Chave de correspondência   | `SEQUENCIA-PRODUCAO`, uma única sequência global para todos os tipos de produção do currículo.                                                                                                                                                 |

Comportamento dos números de sequência, a partir de três execuções com um trabalho em evento falso (`TRABALHO-EM-EVENTOS`, válido contra o DTD e o XSD):

| `SEQUENCIA-PRODUCAO` no item falso                     | Resultado no Passo 3     |
| ------------------------------------------------------ | ------------------------ |
| 1 (ausente da exportação, mas uma lacuna na sequência) | Descartado em silêncio   |
| 33 (acima do máximo da exportação, que era 32)         | Listado em verde, aceito |
| Atributo omitido                                       | Descartado em silêncio   |

Interpretação: as lacunas na sequência exportada (1, 3, 7, 14, 19, 23, 24, 28 a 31 neste currículo) estão ocupadas por linhas excluídas ou ocultas no servidor, e o importador descarta, sem mensagem, qualquer item cuja sequência esteja ausente ou já em uso. Regras para o app:

- Todo item novo recebe um número de sequência estritamente maior que o maior número encontrado em qualquer ponto da exportação do usuário.
- Nunca omitir o atributo, nunca reaproveitar uma lacuna.
- Eliminar duplicatas do lado do app e deixar os itens já conhecidos desmarcados por padrão, já que o servidor vai duplicá-los no Confirmar.
- Descompactar ao carregar, gravar `.xml` puro ao exportar.
- O limite superior da sequência é desconhecido; 33 funcionou. Deslocamentos grandes devem ser testados antes de se contar com eles.

## 6. Diálogos nativos e outros riscos para automação

- `alert()` na digitação manual de instituição/curso, na imposição de privacidade e na validação.
- `confirm()` ao excluir e ao sair de um formulário com alterações ("Foram realizadas modificações nesta página…").
- `confirm()` + um `alert()` longo no logout, e a página usa uma proteção de saída que pode impedir o fechamento da aba.
- O componente `caixaMsg` fica dentro da página e é seguro; os nativos travam qualquer automação no estilo WebDriver e chegaram a travar a extensão do Chrome uma vez durante esta sessão.
- Cada página de formulário recarrega o jQuery e seus plugins; `dd.min.js` (skin de dropdown) aparece só nos formulários.

## 7. Comportamento de sessão observado

| Sessão | Como a aba do editor foi aberta                                                     | Tempo de vida até toda chamada redirecionar para `pkg_sec.logon` | O que antecedeu a queda                                          |
| ------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1      | URL direta numa nova aba, com a aba do próprio usuário também aberta                | ~12 min                                                          | Busca de instituição (`prc_inst_ativ`)                           |
| 2      | URL direta numa nova aba, com a aba do próprio usuário também aberta                | ~3,5 min                                                         | Fechar os modais depois de uma busca de instituição bem-sucedida |
| 3      | URL direta numa nova aba, com a aba do usuário fechada                              | ~3 min                                                           | Abrir o Exportar                                                 |
| 4      | Por `pkg_login.prc_form` (login automático via SSO), editor aberto como nova janela | A aba saiu do grupo da extensão antes de qualquer chamada        | n/a                                                              |

Isso não prova uma causa. Sugere que uma sessão nascida de uma URL direta é tratada de forma diferente de uma nascida pela janela de login, ou que duas instâncias do editor para o mesmo currículo invalidam uma à outra. Em qualquer caso, o desenho do conector deve partir do princípio de que a sessão no servidor dura pouco e admite uma instância só, e deve trabalhar na aba que o usuário já tem aberta, em rajadas curtas, verificando a presença do stub `pkg_sec.logon` em cada resposta.

## 8. Veredito para o conector (formatos B, C e D do brainstorm)

- O caminho de escrita é mais simples do que se temia: POST simples, sem CSRF, um único `f_cod`, nomes de campo conhecidos. Um conector pode preencher o formulário real e chamar `enviar()`, ou reproduzir o POST a partir do contexto da página com `fetch`, usando a mesma sessão. A segunda opção é mais enxuta e evita por completo os diálogos nativos, ao custo de ser claramente "automação" segundo a redação da Portaria de 2022.
- O dicionário de instituições é a única dependência real além dos nomes de campo, e é um POST que devolve HTML fácil de interpretar.
- Os diálogos nativos são a principal fragilidade da abordagem de preencher o formulário real; a abordagem por POST passa ao largo deles.
- A instabilidade de sessão observada é o principal risco operacional. Ela favorece operações pequenas e retomáveis, executadas dentro da aba do editor que o usuário já tem, em vez de abrir uma segunda.
- A importação XML está confirmada como o caminho de escrita para itens novos de produção: um `TRABALHO-EM-EVENTOS` montado à mão com um número de sequência novo foi aceito e caiu na seção certa. Ela só insere, usa `SEQUENCIA-PRODUCAO` como chave e duplica quando pedido (seção 5.1).

## 9. Itens em aberto

- [ ] DOM de `pkg_importa_xml.inicio` (nomes dos campos do formulário de envio, valores das caixas de seleção do Passo 2, chaves dos itens do Passo 3, o mecanismo de solicitação pendente)
- [ ] DOM de `pkg_impcv.get_arquivo`
- [ ] Mapas de campos de Idiomas, Resumo (`pkg_resume.form`) e Endereço (`prc_endereco`)
- [ ] Se `f_ctr=A` em `PKG_ATIV.INCLUI` com `f_seq_ativ` atualiza uma linha existente (esperado pelo código, não verificado)
- [ ] Limite superior e regras de reaproveitamento de `SEQUENCIA-PRODUCAO` (max+1000 funciona? um número liberado por uma exclusão manual volta a ser utilizável?)
- [ ] Se a correspondência vermelho/verde do Passo 3 usa só a sequência ou também título e ano (uma sequência nova com um título existente responderia isso)
- [ ] Causa das quedas de sessão; o teste mais barato é uma aba do editor aberta pela janela de login, deixada parada por 15 minutos, e depois um clique
