# Itens de teste: a passada completa

Para os tipos que o currículo não tem, o censo só infere a ligação entre
campo e atributo e o link de edição de cada lista. Esta passada cria um item
de teste por opção de cada escolha pequena de cada formulário de inclusão,
lê o que voltou e remove tudo. Grava no currículo: só a pessoa roda, na aba
do menu do Lattes, com a extensão Dev, um lote de até três itens por vez.

## A base e o registro

A passada não depende da marca de texto para achar o que criou (ensino
fundamental, médio e técnico, pós-doutorado e formação complementar não têm
campo onde a marca vá, e a primeira limpeza, em 18/10/2026, deixou 23 itens
para trás por isso):

- "Ler formulários" tira a **base**: todas as listas que o menu abre, em
  qualquer formato de link, e as de dentro delas (a página de cada atuação,
  os grupos de periódico do revisor), com o texto e o link de cada linha.
  Fica neste navegador (`lattes-editor:itens-de-teste:base`). Sem base,
  nenhum item é criado.
- Cada lote termina lendo as listas de novo: o que está a mais que a base é o
  **registro** do teste.
- A remoção exclui as linhas do registro, e só as que têm a marca na página
  do item. A linha sem marca fica em "Sem a marca na página": confira cada
  uma no Lattes e use "Remover também os sem marca", que pede um segundo
  clique. Uma página que não se lê não sai. Uma atuação só sai inteira se a
  página dela não existia na base.
- No fim de cada remoção, o painel mostra o que ainda está a mais e o que
  sumiu da base. Uma linha da base que sumiu é um erro a conferir no Lattes.
  Acabou quando não há nada a mais nem a menos, e a marca não aparece na
  versão atual da tela de envio (`pkg_publicar.cv_espelho`), que mostra as
  descrições das atividades que as listas não mostram.

As regras ficam em `src/census/test-ledger.ts`; a leitura e a conferência na
página, em `extension/src/censo-test-ledger.ts`; a criação em
`extension/src/censo-test-items.ts` e a exclusão em
`extension/src/censo-test-removal.ts`.

## Poucos tipos, no teto de pedidos

Cada tarefa do conector para em 100 pedidos. Com `only`, a preparação lê só os
formulários desses tipos, os seus itens de onde as buscas são copiadas e as
listas deles, cada etapa numa chamada que devolve `preparando`; a base guarda
os pacotes lidos, e o registro de cada lote relê só esses:

```js
await __lattesCensus.testItems({ only: ['banca-trabalho'], batch: 1 }); // repita até sair do preparando
await __lattesCensus.ledger(); // só leitura: o que as listas têm a mais e a menos que a base
```

Em 27/10/2026, no quadro isolado, nenhum item foi criado: a orientação, a
banca e outros formulários validam no salvar por uma chamada ajax síncrona
(`pkg_orient.valida_orientador_ajax`, por exemplo), que o quadro sem rede não
responde, e a formação complementar responde ao primeiro passo do `FORM2` com
um segundo passo que o quadro não segue (o conector já segue os dois na
alteração). Até um desses ser adaptado, a passada só
cria tipos sem validação de rede no salvar.

## Como rodar

Pelo editor em desenvolvimento, com `?itens-teste` no endereço e a extensão
Dev instalada, numa aba do menu do Lattes:

1. "Ler formulários": lê os formulários e tira a base. A coleta pode parar no
   orçamento de pedidos; aguarde a pausa e repita.
2. "Criar próximo lote", com o lote de até 3 e 3 a 6 s entre um envio e
   outro. O resultado diz quantos foram criados, quantos faltam e o que
   falhou, com a mensagem do Lattes. "Tentar de novo os que falharam" depois
   de ajustar o que faltava.
3. Com tudo criado, envie ao CNPq (a pessoa marca a declaração) e rode a
   passada de edição com a exportação:
   `__lattesCensus.link(undefined, { maxItems: 50, download: true })`. Os
   marcadores casam campo e atributo.
4. "Ver o que sai", depois "Remover lote" até o painel mostrar zero a mais
   que a base e nada sumido. Envie ao CNPq de novo.
5. Com tudo igual à base, `__lattesCensus.resetTestItems()` esquece o
   andamento e a base.

Todo texto começa com `TESTE EDITOR APAGAR`, seguido do tipo, da variante e
do nome do campo (`src/census/test-plan.ts`). Anos, datas e números seguem o
formato que o `check()` de cada página pede. Países e idiomas ficam no Brasil
e no português; as outras escolhas variam uma opção por item.

Ficam fora da passada: identificação, endereço, resumo, outras informações e
áreas de atuação (registro único, cuja edição já é lida); vínculo e
atividade (dependem de uma atuação); linha de pesquisa e prefácio (sem link
de inclusão lido); idioma (a língua é a chave do item); patente (pede um
depositante com código de pessoa).

## Interrupção e envio incerto

O botão "Parar" e `__lattesCensus.cancel()` interrompem a tarefa. Uma
gravação que já chegou ao servidor pode terminar mesmo depois do
cancelamento.

Antes de enviar, a inclusão salva uma marca de envio incerto, e a confirmação
exige encontrar a tag na página de conferência depois da gravação. O lote
para no primeiro envio incerto; `retryFailed` não o repete sozinho, e
`resetTestItems()` recusa apagar o registro nesse estado. Depois de conferir
no Lattes:

```js
await __lattesCensus.testItems({ retryFailed: true, confirmedPresent: ['tag-conferida'] });
```

Se conferiu que não foi criado, use `confirmedAbsent` com as tags; o censo
relê a página de conferência e recusa quando a tag ainda aparece. Os links
das exclusões incertas ficam em
`__lattesCensus.testProgress().exclusoesIncertas`; uma exclusão incerta é
conferida pelas listas na chamada seguinte, e, se a linha continua lá, só uma
nova conferência humana permite `confirmedPresent` com o link da linha em
`removeTestItems()`.

Um registro corrompido só pode ser apagado depois de conferir os itens no
Lattes, com `__lattesCensus.resetTestItems({ force: true })`; a opção não
libera o reset de uma tarefa em curso nem de um envio incerto legível. Um
receptor opcional de resultados (`receiver`) precisa ser local (`localhost`
ou `127.0.0.1`) e é cancelado com a tarefa; uma falha dele volta em
`receptorError`, depois de atualizar o registro pelas listas.

Os quadros de formulário usam uma origem opaca (`sandbox="allow-scripts"`),
sem acesso ao menu: preenchimento e validação rodam no quadro, só dados
passam pela porta privada, e cada ação autoriza um POST pelo transporte. As
caixas de mensagem e os modais conhecidos têm uma adaptação local; um
formulário que dependa de outro acesso ao menu para a tarefa com erro, e
precisa ser adaptado e testado antes de repetir, sem habilitar mesma origem.
