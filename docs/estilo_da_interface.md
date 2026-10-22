# Estilo da interface

Duas referências, uma para cada registro da tela. O que se opera (menu
lateral, cabeçalho, "Nesta seção", filtros, linhas de lista, formulários)
segue a escala do Linear (linear.app): elementos pequenos e densos, ícones
finos, pouca borda. O que se lê (o conteúdo de cada seção, que é o próprio
currículo) segue o [Typography for Lawyers](https://typographyforlawyers.com/),
de Matthew Butterick, adaptado à tela. A marca e as cores não vêm de nenhum
dos dois: o destaque continua o azul do CNPq, nos dois temas, e os
componentes são do Base UI.

## A escala densa

Os números são metas tiradas de capturas do Linear em 11/10/2026, não medidas
oficiais dele.

- Texto base em 13px, títulos de seção em 15 a 16px. Nas linhas de lista, o
  título em 15px e o subtítulo em 14px; tipo e período em 13px.
- Linhas de lista e itens do menu lateral com 28 a 32px de altura; chips de
  filtro com 24 a 28px, raio pequeno e borda de 1px quase invisível.
- Campos de formulário com 28 a 32px de altura, rótulo pequeno acima, em cor
  secundária.
- Ícones de 14 a 16px, traço de 1,5px, em cor secundária, ao lado do texto
  no menu lateral.
- Hierarquia por cor e peso, não por tamanho: texto principal em cor forte,
  metadado (ano, contagem, instituição) em cinza, à direita da linha.
  Contagens pequenas e cinzas ao lado do rótulo, sem pílula.
- Bordas só onde separam regiões (menu lateral, cabeçalho). Dentro do
  conteúdo, espaço e um fundo levemente diferente no cabeçalho de grupo.

O modal "Novo item" segue o "New issue" do Linear: trilha no cabeçalho,
botões de expandir e fechar discretos à direita, título num campo sem borda
com o foco já nele, os atributos (tipo, ano, idioma, autores, áreas) numa
fila de pílulas compactas, rodapé com o botão principal à direita e o
interruptor "Criar outro", que abre outro item em branco do mesmo tipo ao
salvar e fica lembrado no navegador. Largura em torno de 560px; no celular o
modal ocupa a tela.

## O texto de leitura

Todas as seções aparecem compostas como texto, sem borda de campo, sem rótulo
que repete o título do grupo e sem caixa branca sobre fundo cinza: os grupos
se separam pelo espaço. A leitura mostra todo campo preenchido; o que não
cabe na frase (o status do curso, o ISSN, o idioma de um artigo) fica abaixo
numa grade de três colunas (duas em tela estreita), com o rótulo pequeno
acima do valor. Um valor de mais de 24 caracteres ocupa duas colunas, e um de
mais de 48, a linha inteira. Campo vazio não aparece.

Atuação, projetos, orientações, bancas e eventos leem como registro: período
ou ano, título, uma linha de onde e de que forma ("69º Congresso Brasileiro
de Genética · Convidado · Conferencista"), quem o item envolve e o resto em
grade. O que se repete dentro do item (vínculos, atividades, integrantes)
vira uma lista recuada. As produções leem como referência da NBR 6023, a
mesma da impressão (`src/print/references.ts`), com o destaque em itálico. As
tabelas de apoio de "Outros dados" continuam como cartões, por causa do "Onde
aparece".

| Medida                | Valor                                          | Regra do Typography for Lawyers                  |
| --------------------- | ---------------------------------------------- | ------------------------------------------------ |
| Corpo                 | 17px, IBM Plex Serif, peso 400                 | Na web, 15 a 25px                                |
| Entrelinha            | 1,5                                            | 120 a 145% no papel; na tela, um pouco acima     |
| Medida                | 60ch, de 67 a 73 caracteres por linha          | 45 a 90 caracteres                               |
| Entre parágrafos      | 0,65em, sem recuo                              | 4 a 10pt de espaço ou recuo, nunca os dois       |
| Título da página      | 26px, peso 600                                 |                                                  |
| Título de grupo       | 19px, peso 600, 3rem acima e 0,75rem abaixo    | Degrau pequeno de tamanho, espaço acima e abaixo |
| Subtítulo             | 17px, peso 600                                 | No máximo dois níveis dentro do conteúdo         |
| Rótulo curto (versal) | 12px na sans, 8% de espaçamento                | Caixa alta só em texto curto, com 5 a 12%        |
| Metadado e rótulo     | 15px na cor secundária                         |                                                  |
| Coluna de anos        | Largura do texto mais longo da lista e 1,1rem  |                                                  |
| Coluna de rótulos     | 13rem; em tela estreita, rótulo acima do valor |                                                  |

| Tema   | Texto             | Secundário                                       |
| ------ | ----------------- | ------------------------------------------------ |
| Claro  | `#2a2824`, 14,0:1 | `#5f5c55`, 6,3:1 (5,9:1 sobre o realce do mouse) |
| Escuro | `#d9d4ca`, 11,9:1 | `#9b968c`, 6,0:1 (5,5:1 sobre o realce do mouse) |

Decisões do mesmo lado: aspas e apóstrofos curvos na tela (o XML não muda);
sublinhado só em link; seminegrito (600) só nos títulos e na primeira linha
de cada formação, nunca 700 no conteúdo; o ano na primeira linha de cada
sequência e em branco nas seguintes, como num índice impresso (o leitor de
tela continua ouvindo o ano); o botão "Editar" numa margem à direita do
bloco, sem cobrir o texto; no tema escuro, o item ativo do menu com fundo
neutro. A leitura sempre esconde os campos vazios e a edição sempre os
mostra.

### Edição no lugar

Clique no texto, o botão "Editar" (à vista no foco, no passar do mouse e
sempre no toque) ou E com o botão focado abrem a edição; dois ou três
cliques selecionam texto. O texto do bloco fica no topo como prévia, na
tipografia de leitura, e acompanha o que se digita; abaixo, depois de um
fio, vêm os campos na Plex Sans e na escala densa, inclusive os vazios, no
fim de cada grupo. Esc ou "Concluir" voltam ao texto. Só um bloco fica em
edição: abrir outro fecha o anterior, gravando antes o campo em foco. O modo
de privacidade continua valendo, e os dados escondidos viram uma linha só
("12 dados pessoais ocultos…").

### Ordem dos campos

Por padrão, os campos seguem a ordem da prévia (`src/ui/preview-order.ts`):
cada campo fica onde o valor dele aparece no texto, e os da grade em
"Detalhes". Um campo vazio já fica onde vai aparecer quando for preenchido.
Nas produções, os campos da referência vêm na ordem da citação.

O ⚙ tem "Ordem dos campos: como na prévia / como no Lattes". Na segunda, os
campos seguem o formulário do próprio Lattes quando ele é conhecido
(`src/ui/form-order.ts`, das seções 5, 16 e 17 de `lattes_internals.md`); os
grupos são trechos seguidos desse formulário, e um campo do XML que o Lattes
não pede fica em "Outros dados".

Nas duas ordens, um campo que decide as opções de outros vem logo antes do
primeiro que depende dele: a grande área antes da área, a forma de
participação antes do tipo, o tipo de doutorado antes dos campos do sanduíche
(`src/ui/field-dependencies.ts`).

### Modo foco

Inspirado no iA Writer: fica só o conteúdo e o índice "Nesta seção". O menu
de seções e o cabeçalho saem de cena, a coluna do menu fica vazia e a janela
vira uma folha só. Liga e desliga com ⌘⇧F (Ctrl+Shift+F fora do Mac) ou pelo
⚙, lembrado neste aparelho. O ponteiro na borda esquerda (faixa de 16px,
espera de 150ms) traz o menu por cima do conteúdo; a borda de cima faz o
mesmo com o cabeçalho. Pelo teclado, G mostra o menu enquanto espera a letra
da seção, o ⌘K mostra o cabeçalho e o Tab alcança os dois painéis. Em tela de
toque, um puxador na borda esquerda abre e fecha o menu.

## Teclado

⌘K abre a busca; G e uma letra vão a uma seção; ⌘Enter salva o formulário; E
edita o bloco focado; ⌘⇧F liga o modo foco. No app de desktop, ⌘[ e ⌘] (ou
⌘← e ⌘→ fora de campos de texto) voltam e avançam, como os botões ao lado do
"Ir para"; fora do Mac, Ctrl+[ e Ctrl+], Alt+← e Alt+→. Nas seções com o
índice "Nesta seção", ↓ e ↑ pulam para o grupo seguinte e o anterior, só
fora de campos, listas e menus, sem modificador e sem janela aberta; no
primeiro e no último grupo, a tecla segue para a rolagem normal.

## Celular e acessibilidade

O Lattes é uma plataforma nacional, usada de todo tipo de aparelho e com
todo tipo de necessidade. Metas:

- WCAG 2.1 nível AA, mais o que o eMAG acrescenta.
- Todo controle alcançável e operável só pelo teclado, com foco visível.
  Nada que só exista no passar do mouse.
- Contraste AA nos dois temas, inclusive no cinza secundário.
- Alvos de toque de pelo menos 24px, e 44px no celular, onde a escala volta
  a crescer.
- Rótulos em todos os campos; o título sem borda tem rótulo para leitores de
  tela.
- `prefers-reduced-motion` respeitado e zoom do navegador até 200% sem
  quebrar o layout.
- No celular: menu lateral vira gaveta, modais ocupam a tela, listas sem
  rolagem horizontal.
- Testar com VoiceOver e com o leitor de tela do Android.
