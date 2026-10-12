# Changelog

## [0.5.0](https://github.com/rlueder/lattes-editor/compare/v0.4.0...v0.5.0) (2026-10-12)

### Novidades

- **ui:** ícones e marca, com a grade de construção e os geradores ([#8](https://github.com/rlueder/lattes-editor/issues/8)) ([a7517d8](https://github.com/rlueder/lattes-editor/commit/a7517d8f9ccf74b79fd32bde994a53e9d177929b)), closes [#463C6D](https://github.com/rlueder/lattes-editor/issues/463C6D)

## [0.4.0](https://github.com/rlueder/lattes-editor/compare/v0.3.0...v0.4.0) (2026-10-12)

### Novidades

- **ui:** seletor de tema na página do projeto, com a captura acompanhando ([#4](https://github.com/rlueder/lattes-editor/issues/4)) ([e71137b](https://github.com/rlueder/lattes-editor/commit/e71137b3869dc785ba3861bf42999f217079843b))

## [0.3.0](https://github.com/rlueder/lattes-editor/compare/v0.2.0...v0.3.0) (2026-10-12)

### Novidades

- **ui:** app de desktop com Tauri e ponte por mensagens nativas ([583caff](https://github.com/rlueder/lattes-editor/commit/583caff462dfb8c987c8cd2db58163cca4a83ebd))
- **ui:** hierarquia do texto em três tons e cabeçalho mais limpo ([50fc0a9](https://github.com/rlueder/lattes-editor/commit/50fc0a961aece0fb86dcba60cb2e2baaf9bed411))
- **ui:** marca no menu lateral, QR atrás do avatar e selo no Levar ao Lattes ([687e676](https://github.com/rlueder/lattes-editor/commit/687e676c5f639870107752eaf3f2a041b39e6db6))
- **ui:** Novo item e Levar ao Lattes de volta junto das configurações ([69f54a4](https://github.com/rlueder/lattes-editor/commit/69f54a4d0f2cfb46ae84ae78b7f571ddf1a428ef))
- **ui:** tela inicial como o editor vazio, IBM Plex e acertos visuais ([b6fbc11](https://github.com/rlueder/lattes-editor/commit/b6fbc112446708085e803396db84328901ad95b1))

### Correções

- **import-export:** cópia antes do envio pelo diálogo de salvar do app ([702b17b](https://github.com/rlueder/lattes-editor/commit/702b17b4db952f11dc9e672779f71a3a559a78ee))
- **ui:** códigos do Lattes aparecem pelo nome ([fdd86bc](https://github.com/rlueder/lattes-editor/commit/fdd86bce0d8877d3cf5a5096a55dfef5a5d21435))
- **ui:** foco inicial do modal procura só dentro do modal ([0cb4246](https://github.com/rlueder/lattes-editor/commit/0cb42463b8a95e5c2879539fe56b32756758dea9))

## [0.2.0](https://github.com/rlueder/lattes-editor/compare/v0.1.1...v0.2.0) (2026-10-12)

### Novidades

- **forms:** ponte grava a proficiência dos idiomas ([0ba9dd0](https://github.com/rlueder/lattes-editor/commit/0ba9dd09df058c0963540df2b7855bca55134687))
- **import-export:** confirmar a fila e baixar cópia antes do envio ([4230ce3](https://github.com/rlueder/lattes-editor/commit/4230ce3470ec45058631948e8c30af79edc0725a))

## [0.1.1](https://github.com/rlueder/lattes-editor/compare/v0.1.0...v0.1.1) (2026-10-11)

### Correções

- **ui:** ponte e foto só valem para o mesmo currículo ([1acb28a](https://github.com/rlueder/lattes-editor/commit/1acb28afb101ccbb6c29b1d187c2b911d6f481f2))

Mudanças do Editor do Currículo Lattes. O formato segue o
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e as versões
seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/). Ainda não
houve lançamento: tudo abaixo está em "Não lançado", na versão 0.1.0 do
`package.json`. Daqui em diante, cada lançamento acrescenta a própria seção no
topo, gerada pelo semantic-release a partir dos commits.

## [Não lançado]

### Leitura e salvamento

- Abre a exportação do Lattes (`.zip` ou `.xml`), mostra o currículo inteiro
  por seções e salva o `.xml` de volta, byte a byte igual quando nada mudou.
- Cópia de trabalho no navegador, salva a cada edição, com histórico das
  últimas 50 versões.
- Latin-1 lido e gravado à mão, com conserto opcional de texto estragado no
  próprio Lattes (acentos e aspas).

### Navegação

- Paleta ⌘K para ir a qualquer seção ou grupo; G e uma letra para cada uma
  das doze seções.
- Linha do tempo por ano nas listas, índice "Nesta seção" com o grupo
  visível, filtros por seção (busca e facetas) e barra do título que aparece
  ao rolar.
- Instituições por país e cursos por área, com onde cada um aparece.

### Produção nova e Importar do Lattes

- Formulário de item novo para os tipos mais usados, com autores, áreas do
  conhecimento e palavras-chave; busca por DOI no Crossref para preencher.
- Validação antes de exportar e arquivo `<id>-importacao.xml` para o
  Importar do Lattes, com os passos na tela.

### Levar ao Lattes

- Lista das alterações que o Importar não leva, com o valor antigo e o novo,
  copiar por campo e descartar por campo ou por item.
- Ponte por extensão do navegador (em teste): grava no Lattes, a partir da
  sessão da própria pessoa, os vínculos da atuação e o resumo, conferindo
  cada alteração depois de gravar.
- Aviso no topo do conteúdo enquanto há alteração ou item novo fora do
  Lattes.

### Dados e privacidade

- Modo de privacidade em Dados gerais, ligado por padrão: documentos,
  nascimento, filiação, raça, deficiência e endereço residencial ficam
  mascarados.
- Campos que o Lattes gera ou que vêm de uma lista (códigos, siglas,
  instituição, curso, idioma, país) ficam só leitura, com o nome ao lado do
  código.
- Foto do perfil carregada do CNPq pelo código do currículo.

### Impressão

- Imprimir ou salvar em PDF, com modelos (resumido, ampliado, completo,
  personalizado), escolha de seções e pré-visualização.
- Página nas regras da NBR 14724 (corpo 12, entrelinha 1,5, margens 3/3/2/2
  cm, em preto) e referências da produção na NBR 6023.

### Interface

- Base UI, tema claro e escuro, escala densa inspirada no Linear, camadas de
  fundo, painel por grupo, estados vazios com ação.

### Documentação

- Guia de implementação, requisitos de produto, reconhecimento do Lattes,
  funcionamento interno do editor do Lattes, estilo da interface e pesquisa
  sobre recursos de IA, todos em pt-BR.
