# Roadmap

O que vem a seguir, em ordem aproximada. O estado de cada ticket fica no
Linear (time LattesEditor); o que já saiu está no `CHANGELOG.md`, e como o
editor funciona hoje, em `docs/arquitetura.md`.

## Agora

- **Teste acompanhado das ações do conector que ainda não gravaram no Lattes
  real.** As chaves estão ligadas, e a tabela "Chaves e capacidades" de
  `docs/arquitetura.md` diz o que cada uma ainda precisa mostrar. As três
  desligadas: `COMPL_ENDERECO_LOOKUPS_ENABLED` (buscas da formação
  complementar e do endereço profissional), `PROJECT_ORGAN_ENABLED` (o órgão
  do projeto, que o Lattes recebeu e manteve o antigo) e `PUBLISH_ENABLED`
  (o envio ao CNPq pelo editor, LAT-54).
- **Substituir** (incluir o novo e excluir o antigo) para as trocas que mudam
  o tipo do item, como o nível de uma formação: uma operação só, que inclui,
  confere e só então exclui. A exclusão da formação ainda precisa ser vista
  no Lattes real.
- **Extensão na Chrome Web Store.** Falta a conta de desenvolvedor, o
  primeiro envio e o ID da loja no host nativo do app
  (`docs/extensao_chrome_web_store.md`).
- **Assinatura do instalador do Windows** e teste do conector no Windows e
  no Linux.

## Depois

- README também em inglês.
- Teclado e acessibilidade: navegar nas listas com as setas (e J/K), abrir e
  fechar itens sem mouse, atalhos para todas as seções e uma folha de
  atalhos no "?"; WCAG 2.1 AA, leitor de tela, zoom até 200% e celular
  (`docs/estilo_da_interface.md`).
- Exportar para gerenciadores de referências (BibTeX e RIS) e em DOCX.
- Achar o DOI de produções que não têm, pelo Crossref.
- Revisão de consistência: períodos que se cruzam e variações de nome de
  outros autores.
- Comparar com a versão pública do currículo, que pede o código de segurança.

## Em estudo

- Sincronização cifrada opcional entre aparelhos.
- Busca de outros currículos (coautores, orientadores, bancas) em bases
  abertas como OpenAlex e ORCID.
- Recursos com modelo de linguagem, sempre com o que sai da máquina explícito
  e cada sugestão conferida numa fonte.
- Licença vitalícia para alguns recursos sobre o núcleo gratuito.
