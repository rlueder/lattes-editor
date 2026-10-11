# Estilo da interface

Referência visual do editor: o Linear (linear.app). Não é para copiar a
marca nem as cores, que continuam o azul do CNPq. O que vale copiar é a
escala: elementos pequenos e densos, ícones finos, pouca borda, e modais
que se parecem com o objeto que estão criando.

Esta nota orienta a próxima rodada de interface. Os números abaixo são
metas nossas, tiradas de capturas de tela do Linear em 11/10/2026, e não
medidas oficiais dele.

## Escala

- Texto base em 13px, títulos de seção em 15 a 16px. O título de página
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

## O que não muda

- Azul do CNPq como cor de destaque, nos dois temas.
- Componentes do Base UI.
- Atalhos de teclado e a paleta ⌘K.
