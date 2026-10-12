# Roadmap

O que vem a seguir, em ordem aproximada. O estado de cada item muda neste
arquivo quando muda de fato; o detalhe técnico está em
`docs/lattes_implementation_guide.md` e o porquê em
`docs/lattes_product_requirements.md`.

## Agora

- **Travas de segurança da escrita no Lattes.** Protegem o currículo de quem
  usa a ponte. Situação de cada uma:
  - cópia local do XML antes de enviar: existe (ligada por padrão na
    confirmação, baixa o currículo como ele veio do Lattes);
  - diferença antes de enviar: existe, no painel da extensão e na
    confirmação da fila inteira no editor (valor antigo e novo de cada
    campo);
  - mesmo currículo: existe (a ponte recusa enviar se a sessão do Lattes é
    de outro currículo);
  - ler de volta depois de cada gravação: existe;
  - recusar quando o formulário mudou: existe (o valor antigo e o início do
    vínculo precisam bater antes de gravar);
  - saber quando o CNPq mudou o Lattes: existe ("Verificar o Lattes" no
    painel e antes de cada fila, mais o vigia semanal do que é público, em
    `docs/lattes_internals.md`, seção 9). Falta rodar a primeira verificação
    num Lattes real e acertar o contrato onde a transcrição errou.
- **Ponte com o Lattes, além do vínculo, do resumo e dos idiomas.**
  Formação, endereço e identificação já têm o formulário mapeado em
  `docs/lattes_internals.md`; falta escrever a operação de cada um e testar
  com restauração, como foi feito com o vínculo. O idioma tem a operação
  escrita e testada contra o Lattes falso, falta o teste no Lattes real.
- **Criar itens pela ponte.** O Lattes inclui com `f_ctr=I` (visto no
  formulário de atividade nova). Mapeada a inclusão, Formação, Atuação,
  Projetos e Patentes, que o Importar não aceita, ganham "Novo item" no
  editor, enviado pela extensão.
- **Abrir do Lattes pela ponte.** Com a extensão instalada e uma sessão
  aberta no Lattes, o editor pede a exportação e carrega o currículo sem o
  usuário baixar e soltar o `CV_<id>.zip`. A extensão já tem permissão em
  `wwws.cnpq.br` e faz requisições de dentro da aba do Lattes; o Exportar
  (`pkg_impcv.get_arquivo?f_cod=…`) devolve o mesmo ZIP que o editor já
  abre. O primeiro passo é registrar em `docs/lattes_internals.md` a
  requisição real do Exportar, que o reconhecimento não capturou, e ver se a
  sessão cai depois dele (uma caiu cerca de 3 minutos depois de abrir o
  Exportar, sem causa conhecida). O currículo vai da aba do Lattes à
  extensão e dela ao editor, sem passar por servidor.
- **Extensão pronta para a Chrome Web Store.** O que falta está em
  `docs/extensao_chrome_web_store.md`: página da política de privacidade,
  capturas e imagem promocional, e o ID da loja no host nativo do app.
- **Publicação.** O editor só se distribui como app para baixar (macOS,
  Windows e Linux, nas páginas de lançamento do GitHub); nada dele fica
  hospedado. O site é só a página do projeto, publicada no GitHub Pages
  (https://rlueder.github.io/lattes-editor/). Feito: repositório, CI,
  lançamentos automáticos (semantic-release) com os instaladores e a página
  publicada. Falta: definir o identificador do app.

## Marco 3: acabamento para a turma

- Tela de primeiro uso explicando o ciclo: exportar no Lattes, editar aqui,
  levar ao Lattes.
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
- **Revisão de consistência** do currículo inteiro (duplicatas, variações
  de nome de autor, ISSN, períodos que se cruzam), sem IA; ver
  `docs/pesquisa_recursos_de_ia.md`.
- **Achar o DOI** de produções que não têm, pelo Crossref.
- **App de desktop** com Tauri para macOS, Windows e Linux. Feito: diálogos
  nativos de abrir e salvar, builds dos três sistemas na CI com os
  instaladores na página do lançamento, e a ligação com a extensão por
  mensagens nativas (o app é o host; ver `src-tauri/src/ponte.rs`). Falta
  assinar e notarizar no macOS, assinar no Windows, atualizar sozinho e
  testar a ponte no Windows e no Linux.

## Em estudo

- Sincronização cifrada opcional entre aparelhos.
- Busca de outros currículos (coautores, orientadores, bancas) por bases
  abertas como OpenAlex e ORCID.
- Recursos com modelo de linguagem, sempre com o que sai da máquina
  explícito e cada sugestão conferida numa fonte.
