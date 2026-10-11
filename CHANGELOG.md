# Changelog

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
