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
