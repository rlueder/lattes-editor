# Itens de teste: a passada completa

O censo lê os formulários de inclusão e, para os tipos que o currículo já
tem, os de edição. Para os tipos sem item, a ligação entre campo do
formulário e atributo do XML e o link de edição de cada lista ficam
inferidos. Esta passada cria um item de teste por opção de cada escolha
pequena de cada formulário de inclusão, lê o que voltou e remove tudo.

Grava no currículo. Só a pessoa roda, na aba do menu do Lattes, um lote por
vez.

## Como rodar

1. `pnpm build:censo` e cole `dist-censo/censo-lattes.js` no console da aba do
   menu (ou carregue pelo servidor local).
2. Um lote por chamada, 10 itens com 3 a 6 s entre um envio e outro:

   ```js
   await __lattesCensus.testItems({ batch: 10 });
   ```

   A primeira chamada lê os formulários (alguns minutos). O andamento fica
   neste navegador; a chamada seguinte continua de onde parou. O resultado
   diz quantos foram criados, quantos faltam e o que falhou, com a mensagem
   do Lattes. Depois de ajustar o que faltava, `{ retryFailed: true }` tenta
   de novo os que falharam.

3. Com tudo criado, envie ao CNPq (a pessoa marca a declaração) e rode a
   passada de edição com a exportação: `__lattesCensus.link(undefined, {
maxItems: 50, download: true })`. Os marcadores casam campo e atributo.
4. Remova, também em lotes, e envie ao CNPq de novo:

   ```js
   await __lattesCensus.removeTestItems({ batch: 10 });
   __lattesCensus.resetTestItems();
   ```

## Os valores

Todo texto começa com `TESTE EDITOR APAGAR`, seguido do tipo, da variante e
do nome do campo (`src/census/test-plan.ts`). Anos, datas, meses e números
seguem o formato que o check() de cada página pede. Países e idiomas ficam no
Brasil e no português; as outras escolhas variam uma opção por item. A
remoção acha os itens pelo marcador, lista por lista.

## Fora da passada

Identificação, endereço, resumo, outras informações e áreas de atuação são
de registro único (a edição deles já é lida). Vínculo e atividade dependem de
uma atuação, e linha de pesquisa e prefácio não têm link de inclusão lido.
