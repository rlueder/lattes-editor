# Roadmap

O que vem a seguir, em ordem aproximada. O estado de cada item muda neste
arquivo quando muda de fato; o estado de cada ticket fica no Linear. Como o
editor funciona hoje está em `docs/arquitetura.md`; o porquê das decisões
originais, em `docs/lattes_implementation_guide.md` e
`docs/lattes_product_requirements.md`.

## Agora

- **Travas de segurança da escrita no Lattes.** Protegem o currículo de quem
  usa o conector. Situação de cada uma:
  - cópia local do XML antes de enviar: existe (ligada por padrão na
    confirmação, baixa o currículo como ele veio do Lattes);
  - diferença antes de enviar: existe, no painel da extensão e na
    confirmação da fila inteira no editor (valor antigo e novo de cada
    campo);
  - mesmo currículo: existe (o conector recusa enviar se a sessão do Lattes é
    de outro currículo);
  - ler de volta depois de cada gravação: existe;
  - registro do que foi gravado, com desfazer: existe ("Enviado ao Lattes",
    em "Enviar ao Lattes"). O Lattes não mostra nem descarta pendências antes
    de "Enviar ao CNPq", então é aqui que se vê e se volta atrás;
  - recusar quando o formulário mudou: existe (o valor antigo e o início do
    vínculo precisam bater antes de gravar);
  - saber quando o CNPq mudou o Lattes: existe (verificação de fundo na
    extensão, que só aparece no painel com problema, e antes de cada fila, mais o vigia semanal do que é público, em
    `docs/lattes_internals.md`, seção 9). Conferido num Lattes real em
    12/10/2026: o contrato bateu de primeira.
- **Conector, além do vínculo, do resumo e dos idiomas.**
  Formação, endereço e identificação já têm o formulário mapeado em
  `docs/lattes_internals.md`; falta escrever a operação de cada um e testar
  com restauração, como foi feito com o vínculo. O idioma tem a operação
  escrita e testada contra o Lattes falso, falta o teste no Lattes real.
- **Lembrar do envio ao CNPq.** Feito: o painel da extensão e o editor
  dizem no fim de cada fila que nada está público até "Enviar ao CNPq", com
  o caminho do botão. A faixa de estados do cabeçalho (LAT-40) mostra
  original, alterações, o que está no Lattes sem publicar e a data da última
  publicação, lida do menu do Lattes pela extensão.
- **Criar itens pelo conector (LAT-24).** Escrita e testada contra o Lattes
  falso a inclusão de uma atuação profissional com um vínculo
  (`src/bridge/create.ts`), mas desligada (`CREATE_ITEMS_ENABLED`) até um
  teste acompanhado no Lattes real: a resposta do POST de inclusão e alguns
  valores da busca de instituição são inferidos. Falta mapear a busca de
  cursos (Formação) e os formulários de Projetos e Patentes.
- **Abrir do Lattes pelo conector.** Feito: na primeira abertura sem cópia de
  trabalho, com a extensão ligada, o editor pede o ZIP do Exportar à aba do
  Lattes e abre o currículo, sem download (`src/bridge/export.ts`,
  `docs/lattes_internals.md`, seção 12). Com alteração pendente, o Exportar
  recusa e a tela inicial pede o envio ao CNPq. Falta abrir a versão atual
  pela página de conferência nesse caso, como em `docs/fluxos_de_uso.md`.
- **Extensão pronta para a Chrome Web Store.** Feito: política de
  privacidade publicada, aviso e consentimento antes do primeiro uso, pacote
  sem a chave do manifest e imagens da loja. Falta, no painel do
  desenvolvedor: a conta, o primeiro envio e o ID da loja no host nativo do
  app (ver `docs/extensao_chrome_web_store.md`).
- **Publicação.** O editor só se distribui como app para baixar (macOS,
  Windows e Linux, nas páginas de lançamento do GitHub); nada dele fica
  hospedado. O site é só a página do projeto, publicada no GitHub Pages
  (https://rlueder.github.io/lattes-editor/). Feito: repositório, CI,
  lançamentos automáticos (semantic-release) com os instaladores e a página
  publicada. Falta: definir o identificador do app.

## Marco 3: acabamento para a turma

- Tela de primeiro uso explicando o ciclo: exportar no Lattes, editar aqui,
  enviar ao Lattes.
- Painel de validação do currículo inteiro: obrigatórios, enums, anos,
  autores, DOI.
- README também em inglês.
- **Teclado e acessibilidade.** Tudo operável só pelo teclado: navegar nas
  listas com as setas (e J/K), abrir e fechar itens, editar campos e voltar
  à lista sem mouse, atalhos para todas as seções (não só as nove primeiras)
  e uma folha de atalhos no "?". Junto, a meta de acessibilidade de
  `docs/estilo_da_interface.md`: WCAG 2.1 AA, foco visível, leitor de tela,
  zoom até 200% e celular.

## Depois

- **Exportar para gerenciadores de referências:** BibTeX e RIS da produção
  (serve também para importar no ORCID).
- **Exportar em DOCX** para editais que pedem arquivo editável.
- **Revisão de consistência** do currículo inteiro, sem IA (LAT-29). Feito,
  no "Diagnóstico do currículo": produções repetidas, autor repetido no
  mesmo item, nome de citação fora da sua lista, ISSN com dígito errado,
  artigo sem DOI, ano no futuro, fim antes do início, vínculo "atual" há
  mais de 10 anos e curso em andamento há mais de 8. Falta: períodos que se
  cruzam e variações de nome de outros autores.
- **Achar o DOI** de produções que não têm, pelo Crossref.
- **Linha do tempo de versões.** Feito: cada exportação aberta vira uma
  versão (até 24 por currículo, cifradas como o resto), e o app mostra o que
  mudou entre uma e a anterior, por seção, com o caminho até o item no
  editor. A comparação é a mesma da lista de alterações.
- **App de desktop** com Tauri para macOS, Windows e Linux. Feito: diálogos
  nativos de abrir e salvar, builds dos três sistemas na CI com os
  instaladores na página do lançamento, e a ligação com a extensão por
  mensagens nativas (o app é o host; ver `src-tauri/src/conector.rs`). Assinado e
  notarizado no macOS. Falta assinar no Windows, atualizar sozinho e
  testar o conector no Windows e no Linux.

## Em estudo

- Sincronização cifrada opcional entre aparelhos.
- Busca de outros currículos (coautores, orientadores, bancas) por bases
  abertas como OpenAlex e ORCID.
- Recursos com modelo de linguagem, sempre com o que sai da máquina
  explícito e cada sugestão conferida numa fonte.
