# Estilo da interface

Referência visual do editor: o Linear (linear.app). Não é para copiar a
marca nem as cores, que continuam o azul do CNPq. O que vale copiar é a
escala: elementos pequenos e densos, ícones finos, pouca borda, e modais
que se parecem com o objeto que estão criando.

Esta nota orienta a próxima rodada de interface. Os números abaixo são
metas nossas, tiradas de capturas de tela do Linear em 11/10/2026, e não
medidas oficiais dele.

## Escala

- Texto base em 13px, títulos de seção em 15 a 16px. Nas linhas de lista
  (cartões), o título sobe para 15px e o subtítulo para 14px; tipo e
  período ficam em 13px. O título de página
  hoje tem 28px e os campos parecem formulário de cadastro, não editor.
- Linhas de lista e itens do menu lateral com cerca de 28 a 32px de
  altura. Os chips de filtro (hoje `--pill-h: 36px`) descem para 24 a
  28px, com raio pequeno e borda de 1px quase invisível.
- Campos de formulário com 28 a 32px de altura. Rótulo pequeno acima, em
  cor secundária.
- Ícones de 14 a 16px, traço de 1,5px, sempre em cor secundária. Ícone
  ao lado do texto no menu lateral, como no Linear (Inbox, My issues).

## Densidade e hierarquia

- Hierarquia por cor e peso, não por tamanho. Texto principal em cor
  forte, metadado (ano, contagem, instituição) em cinza, à direita da
  linha.
- Contagens pequenas e cinzas ao lado do rótulo ("Urgent issues 2"), sem
  pílula em volta.
- Bordas só onde separam regiões (menu lateral, cabeçalho). Dentro do
  conteúdo, separar por espaço e por fundo levemente diferente no
  cabeçalho de grupo.
- Itens de lista ocupam uma linha: identificador, título truncado com
  reticências, etiquetas e data alinhadas à direita.

## Modais

O modal "New issue" do Linear é o modelo para "Novo item":

- Cabeçalho com trilha ("PRE › New issue"), botões de expandir e fechar
  quadrados e discretos à direita.
- O título é um campo sem borda, em fonte maior, com o foco já nele. A
  descrição vem logo abaixo, também sem borda.
- Os atributos (status, prioridade, projeto, etiquetas) são uma fila de
  pílulas compactas com ícone, cada uma abrindo seu próprio menu. Para
  nós: tipo, ano, idioma, autores, áreas.
- Rodapé com o botão principal à direita e opções secundárias (como
  "Create more") num interruptor pequeno ao lado.
- Largura fixa em torno de 560px, altura que cresce com o conteúdo, sem
  rolagem interna até ser preciso.

- Botão de expandir ao lado do fechar, para formulários que precisam de
  mais espaço. No celular o modal já ocupa a tela e o botão não aparece.
- Interruptor "Criar outro" no rodapé: ao salvar, abre outro item em
  branco do mesmo tipo, para quem lança várias produções seguidas. A
  escolha fica lembrada no navegador.

## Dois registros: interface densa e texto de leitura

> Proposta em avaliação. Por enquanto só aparece no `pnpm dev` com
> `?leitura` na URL (veja `docs/desenvolvimento.md`); o editor de sempre
> continua o padrão até a decisão.

A escala do Linear serve ao que se opera: menu lateral, cabeçalho, painel
"Nesta seção", filtro, linhas compactas e formulários. O conteúdo de uma
seção é outra coisa, porque a maior parte do tempo a pessoa lê o próprio
currículo e só às vezes muda um dado. Para esse texto a referência é o
[Typography for Lawyers](https://typographyforlawyers.com/), de Matthew
Butterick, adaptado à tela.

No modo de leitura, Dados gerais, Formação e Produções aparecem compostos
como texto, sem borda de campo, sem rótulo que repete o título do grupo e
sem a caixa branca sobre o fundo cinza: os grupos se separam pelo espaço.
A leitura mostra todo campo preenchido: o que não cabe na frase (o status
do curso, o ISSN, o idioma de um artigo) fica em linhas pequenas de rótulo
e valor logo abaixo. Campo vazio não aparece.

Editar não abre outra tela. O bloco clicado fica no mesmo lugar e cada
pedaço de texto vira um campo onde estava: o ano continua na coluna do ano,
o título onde está o título, rótulo e valor continuam em linha. O pedaço
clicado recebe o foco, com o cursor no ponto do clique. Os campos não têm
borda; ganham um fundo leve no passar do mouse e o contorno do destaque no
foco. Os campos vazios aparecem só na edição, no fim do bloco, depois de um
fio e com rótulo, os obrigatórios primeiro. A ordem é sempre a de leitura,
nunca a do XSD.

Nas produções a referência não se edita como texto. Ela fica no topo do
bloco em edição e acompanha o que se digita; abaixo vêm os campos na ordem
da citação (autores, título, onde saiu, lugar, ano, volume, páginas, DOI) e
os vazios no fim. O campo em uso acende o trecho dele na referência, e
clicar num trecho leva ao campo.

Clique no texto, o botão "Editar" (à vista no foco do teclado, no passar do
mouse e sempre no toque) ou E com o botão focado abrem a edição; dois ou
três cliques selecionam texto. Esc ou "Concluir" voltam ao texto. O modo de
privacidade continua valendo, e os dados escondidos viram uma linha só
("12 dados pessoais ocultos…") na leitura e na edição.

O texto de leitura usa a IBM Plex Serif (regular, itálica e seminegrito,
embutidas como a Plex Sans). Na edição, os valores continuam na serifa e no
mesmo corpo, para o texto não pular; rótulos, botões, legendas e listas de
escolha ficam na Plex Sans. Uma variável só (`--edit-value-font`) passa os
valores editáveis para a sans, se a leitura em serifa e a edição em sans
forem preferidas mesmo com o salto.

Os números escolhidos, com a regra de onde saíram:

| Medida                | Valor                                          | Regra do Typography for Lawyers                                |
| --------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| Corpo                 | 17px, IBM Plex Serif, peso 400                 | Na web, 15 a 25px ("Point size")                               |
| Entrelinha            | 1,5                                            | 120 a 145% no papel; na tela, um pouco acima ("Line spacing")  |
| Medida                | 60ch, de 67 a 73 caracteres por linha          | Média de 45 a 90 caracteres ("Line length")                    |
| Entre parágrafos      | 0,65em (11px, perto de 8pt), sem recuo         | 4 a 10pt de espaço ou recuo, nunca os dois                     |
| Título da página      | 26px, peso 600                                 |                                                                |
| Título de grupo       | 19px, peso 600, 3rem acima e 0,75rem abaixo    | Degrau pequeno de tamanho e espaço acima e abaixo ("Headings") |
| Subtítulo             | 17px, peso 600                                 | No máximo dois níveis dentro do conteúdo                       |
| Rótulo curto (versal) | 12px na sans, 8% de espaçamento                | Caixa alta só em texto curto, com 5 a 12% ("All caps")         |
| Metadado e rótulo     | 15px na cor secundária                         | Hierarquia por cor e tamanho                                   |
| Coluna de anos        | Largura do texto mais longo da lista e 1,1rem  | Anos alinhados, perto do texto                                 |
| Coluna de rótulos     | 13rem; em tela estreita, rótulo acima do valor |                                                                |

Cores do texto de leitura, um pouco abaixo do preto e do branco do cromo,
em tons quentes:

| Tema   | Texto             | Secundário                                       |
| ------ | ----------------- | ------------------------------------------------ |
| Claro  | `#2a2824`, 14,0:1 | `#5f5c55`, 6,3:1 (5,9:1 sobre o realce do mouse) |
| Escuro | `#d9d4ca`, 11,9:1 | `#9b968c`, 6,0:1 (5,5:1 sobre o realce do mouse) |

Mais algumas decisões do mesmo lado:

- Aspas e apóstrofos curvos na tela; o dado no XML não muda.
- Sublinhado só em link.
- Seminegrito (600) só nos títulos e na primeira linha de cada formação;
  nunca 700 no conteúdo. Na formação: o grau em seminegrito, a instituição
  no corpo, o título do trabalho em itálico, orientação e bolsa em cor
  secundária, um ponto menor.
- Produções saem como referência da NBR 6023, a mesma da impressão
  (`src/print/references.ts`), com o destaque (periódico, anais, livro) em
  itálico, que pesa menos que o negrito na serifa. A norma aceita um ou
  outro, desde que o documento use um só; a impressão continua em negrito.
- O ano aparece na primeira linha de cada sequência e fica em branco nas
  seguintes, como num índice impresso; o leitor de tela continua ouvindo o ano.
- O botão "Editar" fica numa margem reservada à direita do bloco e nunca
  cobre o texto.
- Com `?leitura`, o item ativo do menu lateral e do "Nesta seção" no tema
  escuro usa um fundo neutro em vez do azul saturado.
- O ⚙ "Mostrar campos vazios" sai do menu com `?leitura`: a leitura sempre
  esconde os vazios e a edição sempre os mostra. Se o modo de leitura virar
  o padrão, a opção sai de vez.

## Teclado

O Linear trata o teclado como caminho principal, e vale estudar o
conjunto inteiro antes de inventar atalhos nossos. Já temos ⌘K, G e uma letra para cada seção e
⌘Enter para salvar o formulário. Falta levantar o que
o Linear faz para criar item (tecla única), navegar em lista (setas, J/K),
abrir e fechar detalhes, e como ele mostra o atalho junto de cada ação
(na dica e no menu), e decidir quais fazem sentido aqui.

## Celular e acessibilidade

O Lattes é uma plataforma nacional, usada por gente de todo tipo de
aparelho e de necessidade. O editor tem de funcionar bem nos dois casos,
e não como acabamento.

- Meta de acessibilidade: WCAG 2.1 nível AA, e conferir o que o eMAG
  (modelo de acessibilidade do governo federal) acrescenta.
- Todo controle alcançável e operável só pelo teclado, com foco visível.
  Nada de ação que só exista no passar do mouse (o botão de copiar hoje
  aparece no hover; precisa aparecer também no foco, e no toque).
- Contraste AA nos dois temas, inclusive no cinza secundário que a
  escala nova usa mais.
- Alvos de toque de pelo menos 24px (AA), e 44px no celular, onde a
  densidade do desktop não se aplica: no celular a escala volta a
  crescer.
- Rótulos de verdade em todos os campos; o título sem borda tem rótulo
  para leitores de tela.
- Respeitar `prefers-reduced-motion` e o zoom do navegador até 200% sem
  quebrar o layout.
- No celular: menu lateral vira gaveta, modais ocupam a tela, listas sem
  rolagem horizontal.
- Testar com VoiceOver e com o leitor de tela do Android antes de dar a
  rodada por pronta.

## Página inicial

A página de entrada do projeto segue a linha das páginas do Linear sem
copiar: título curto sobre o que o editor resolve, uma imagem real da
interface, e blocos com as funções que já existem (abrir o XML exportado,
navegar por seções e anos, criar produção a partir do DOI, revisar
alterações antes de enviar ao Lattes, tudo local no navegador). Downloads
dos apps de desktop entram quando existirem builds assinados; até lá a
página não mostra botão de download.

## O que não muda

- Azul do CNPq como cor de destaque, nos dois temas.
- Componentes do Base UI.
- Atalhos de teclado e a paleta ⌘K.
