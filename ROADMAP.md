# Roadmap

O que vem a seguir, em ordem aproximada. O estado de cada item muda neste
arquivo quando muda de fato; o detalhe técnico está em
`docs/lattes_implementation_guide.md` e o porquê em
`docs/lattes_product_requirements.md`.

## Agora

- **Crédito e projetos irmãos.** Uma linha de crédito no README e numa tela
  "Sobre" do editor ("Feito por Rafael Lüder, fundador da Precisa Saúde"),
  com links marcados para o Umami para o medbench, o datasus-viz e o
  fhir-brasil. Os endereços e o padrão de marcação ainda precisam ser
  confirmados antes de escrever os links.
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
    vínculo precisam bater antes de gravar).
- **Ponte com o Lattes, além do vínculo, do resumo e dos idiomas.**
  Formação, endereço e identificação já têm o formulário mapeado em
  `docs/lattes_internals.md`; falta escrever a operação de cada um e testar
  com restauração, como foi feito com o vínculo. O idioma tem a operação
  escrita e testada contra o Lattes falso, falta o teste no Lattes real.
- **Criar itens pela ponte.** O Lattes inclui com `f_ctr=I` (visto no
  formulário de atividade nova). Mapeada a inclusão, Formação, Atuação,
  Projetos e Patentes, que o Importar não aceita, ganham "Novo item" no
  editor, enviado pela extensão.
- **Extensão pronta para a Chrome Web Store.** O que falta está em
  `docs/extensao_chrome_web_store.md`: página da política de privacidade,
  capturas e imagem promocional, e o domínio do editor publicado.
- **Publicação.** Repositório no GitHub, CI, GitHub Pages com a página
  inicial e o editor, e lançamentos automáticos (semantic-release).

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
- **App de desktop** com Tauri para macOS, Windows e Linux, entregando as
  alterações à mesma extensão.

## Em estudo

- Sincronização cifrada opcional entre aparelhos.
- Busca de outros currículos (coautores, orientadores, bancas) por bases
  abertas como OpenAlex e ORCID.
- Recursos com modelo de linguagem, sempre com o que sai da máquina
  explícito e cada sugestão conferida numa fonte.
