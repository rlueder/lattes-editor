# Itens de teste: a passada completa

O censo lê os formulários de inclusão e, para os tipos que o currículo já
tem, os de edição. Para os tipos sem item, a ligação entre campo do
formulário e atributo do XML e o link de edição de cada lista ficam
inferidos. Esta passada cria um item de teste por opção de cada escolha
pequena de cada formulário de inclusão, lê o que voltou e remove tudo.

Grava no currículo. Só a pessoa roda, na aba do menu do Lattes, um lote de até três itens por
vez.

## A base e o registro

A limpeza de 18/10/2026 achava os itens pela marca `TESTE EDITOR APAGAR` e
deixou 23 itens no currículo: ensino fundamental, médio e técnico, pós-doutorado
e formação complementar não têm campo de texto onde a marca vá, e uma lista
(`pkg_demais.lista`) o menu abre por um formato de link que a varredura não
pegava. Desde então a passada não depende da marca:

- "Ler formulários" tira a base: todas as listas que o menu abre, em qualquer
  formato de link, e as de dentro delas (a página de cada atuação, os grupos de
  periódico do revisor), com o texto e o link de cada linha. Fica neste
  navegador (`lattes-editor:itens-de-teste:base`). Sem base, nenhum item é
  criado; com itens criados e sem base, a passada para e pede para conferir.
- Cada lote termina lendo as listas de novo: o que está a mais que a base é o
  registro do teste.
- A remoção exclui as linhas do registro, e nada mais. Uma atuação só sai
  inteira se a página dela não existia na base. "Ver o que sai" mostra a
  lista antes.
- Toda linha diferente da base entra no registro, e numa base antiga isso
  inclui um item seu incluído ou alterado depois dela. Por isso uma linha só
  sai se a página do item tem a marca (21/10/2026). A sem marca fica, e o
  painel a lista em "Sem a marca na página". Os itens sem campo de texto
  (ensino fundamental, médio e técnico, pós-doutorado, formação
  complementar) caem ali: confira cada um no Lattes e use "Remover também os
  sem marca", que pede um segundo clique e só tira as linhas listadas, pelo link de cada uma. Uma página que não se lê fica em "Páginas que não se leram" e não sai, nem conferida. A linha da atividade também não mostra a marca, mas a página
  dela mostra, na descrição.
- No fim de cada remoção, o painel mostra o que ainda está a mais e o que
  sumiu da base. Uma linha da base que sumiu é um erro a conferir no Lattes.
  Acabou quando não há nada a mais nem a menos.
- As listas não mostram tudo: as atividades de uma atuação aparecem na página
  dela só pela natureza e pelo período, sem a descrição. Em 18/10/2026, 21
  atividades de teste da primeira passada (anteriores à base) estavam no
  currículo e na base, e por isso passaram por todas as conferências. Por
  isso a base só se tira com a marca ausente do currículo inteiro (a versão
  atual da tela de envio, `pkg_publicar.cv_espelho`, que mostra a descrição),
  e toda remoção termina contando a marca nela (`marcaNoCurriculo`).

As regras ficam em `src/census/test-ledger.ts`; a leitura e a conferência na
página, em `extension/src/censo-test-ledger.ts`; a criação em
`extension/src/censo-test-items.ts` e a exclusão em
`extension/src/censo-test-removal.ts`.

## Como rodar

Pelo editor em desenvolvimento, com `?itens-teste` no endereço e a extensão
Dev instalada, numa aba do menu do Lattes:

1. "Ler formulários": lê os formulários e tira a base. A coleta pode parar no orçamento de pedidos; aguarde a pausa e repita para aproveitar as páginas já lidas.
2. "Criar próximo lote", com o lote de até 3 e 3 a 6 s entre um envio e
   outro. O resultado diz quantos foram criados, quantos faltam e o que
   falhou, com a mensagem do Lattes. "Tentar de novo os que falharam" depois
   de ajustar o que faltava.
3. Com tudo criado, envie ao CNPq (a pessoa marca a declaração) e rode a
   passada de edição com a exportação: `__lattesCensus.link(undefined, {
maxItems: 50, download: true })`. Os marcadores casam campo e atributo.
4. "Ver o que sai", depois "Remover lote" até o painel mostrar zero a mais
   que a base e nada sumido. O que aparecer sem a marca, confira antes de
   "Remover também os sem marca". Envie ao CNPq de novo.
5. Com tudo igual à base, `__lattesCensus.resetTestItems()` esquece o
   andamento e a base.

## Os valores

Todo texto começa com `TESTE EDITOR APAGAR`, seguido do tipo, da variante e
do nome do campo (`src/census/test-plan.ts`). Anos, datas, meses e números
seguem o formato que o check() de cada página pede. Países e idiomas ficam no
Brasil e no português; as outras escolhas variam uma opção por item.

## Fora da passada

Identificação, endereço, resumo, outras informações e áreas de atuação são
de registro único (a edição deles já é lida). Vínculo e atividade dependem de
uma atuação, e linha de pesquisa e prefácio não têm link de inclusão lido. O
idioma fica de fora porque a língua é a chave do item. A patente pede um
depositante com código de pessoa, e só os coautores têm um.

## Interrupção e envio incerto

As leituras, os recursos dos quadros e os envios usam o limite de tráfego da
extensão Dev. Atualize a extensão e recarregue o menu antes de rodar, inclusive
pelo console. O botão "Parar" e `__lattesCensus.cancel()` interrompem a tarefa. Uma gravação que
já chegou ao servidor pode terminar mesmo depois do cancelamento.

Antes de enviar, a inclusão salva uma marca de envio incerto. A confirmação
exige encontrar a tag na página de conferência depois da gravação. Itens sem
campo para levar a tag podem ficar incertos e exigem conferência manual. O
lote para no primeiro envio incerto; `retryFailed` não o repete sozinho, e
`resetTestItems()` recusa apagar o registro nesse estado.

Depois de conferir a tag e o conteúdo no Lattes, use pelo console:

```js
await __lattesCensus.testItems({ retryFailed: true, confirmedPresent: ['tag-conferida'] });
```

Se conferiu que não foi criado, use `confirmedAbsent` com as tags. O censo
relê a página de conferência e recusa essa confirmação quando a tag ainda
aparece. Os links das exclusões incertas ficam em
`__lattesCensus.testProgress().exclusoesIncertas`. Uma exclusão incerta é
conferida pelas listas na chamada seguinte;
se a linha sumiu, o registro é reconciliado. Se continua lá, só uma nova
conferência humana permite usar `confirmedPresent` com o link da linha em
`removeTestItems()`. As verificações de base e marca continuam valendo.

Um receptor opcional de resultados (`receiver`) precisa ser local
(`localhost` ou `127.0.0.1`) e também é cancelado com a tarefa.

Se o registro estiver corrompido, confira os itens diretamente no Lattes
antes de usar `__lattesCensus.resetTestItems({ force: true })`. Essa opção só
permite apagar um registro ilegível; uma tarefa em curso ou um envio incerto
legível continuam exigindo término e reconciliação. Falha do receptor local
retorna em `receptorError`, depois de atualizar o registro pelas listas.

Os quadros usam uma origem opaca (`sandbox="allow-scripts"`, sem
`allow-same-origin`). O navegador impede que scripts do formulário acessem
funções, DOM ou armazenamento do menu, abram popups ou naveguem a janela
principal. Preenchimento e validação executam no quadro; somente dados passam
por uma porta privada. Cada ação autoriza um POST pelo transporte controlado.

As caixas de mensagem e os modais conhecidos têm uma adaptação local. Se um
formulário depender de outro acesso ao menu, a tarefa para com erro. Adapte e
teste esse caso antes de repetir, sem habilitar mesma origem. Um POST já
iniciado permanece incerto até a conferência, como nos demais erros.
