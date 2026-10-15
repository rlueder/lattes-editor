# Censo dos formulários do Lattes

O censo (LAT-55) registra, para cada formulário do Lattes, os campos que a
pessoa vê com o rótulo ao lado, os campos ocultos, as opções de cada rádio e
lista, e a ligação de cada campo com o atributo do XML da exportação. Serve
para dizer, atributo por atributo, se o editor cobre o que o Lattes oferece.

| Arquivo                 | O que tem                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `censo-AAAA-MM-DD.json` | Uma captura feita numa sessão real do Lattes (ainda nenhuma nesta pasta)             |
| `relatorio.md`          | A cobertura, gerada por `pnpm censo:relatorio`; não editar à mão                     |
| `pendencias.json`       | As divergências já conhecidas, que o teste aceita (`pnpm censo:relatorio --aceitar`) |

O código está em `src/census/`: a leitura das páginas sem DOM
(`html-scan.ts`), o registro sem dados pessoais (`census-page.ts`), a lista de
formulários (`targets.ts` e `targets-production.ts`), a captura (`run.ts`), a
passada de edição (`link.ts`) e o relatório (`report.ts`,
`report-render.ts`). O que roda na aba do Lattes é `extension/src/censo.ts`.

## O que cada captura guarda, e o que nunca guarda

Por formulário: o caminho aberto (sem o código do currículo e sem números de
item), o nome e o destino de cada `<form>`, os campos na ordem da página com
tipo, limite, rótulo e opções, os nomes dos ocultos e os valores de poucos
ocultos que dizem que formulário é aquele (`f_ctr`, `f_tipo`, `f_nivel`,
`f_cod_tipo`). Listas longas de opções (países, idiomas) ficam uma vez só, em
`lists`, citadas pelo nome nos campos.

Nunca entram: o que estava digitado, marcado ou escolhido na página, o código
de 10 caracteres (`f_cod`), o identificador de 16 dígitos, e-mail, CPF. Um
rótulo ou opção com cara de dado pessoal sai como `[removido]`, e quem roda
pode pedir para esconder outros textos (o próprio nome, por exemplo).

A passada de edição (`link()`) lê os valores do currículo para casar campo e
atributo, só em memória, e guarda nomes e contagens: em quantos itens o valor
do campo era o do atributo, e em quantos era outro. Num campo de opções cujo
rótulo não é o valor do XML, guarda o par código da opção ↔ valor enumerado do
XSD (`S` ↔ `CONCLUIDO`), que vem do Lattes e do XSD, não da pessoa.

## Como capturar

Só leitura. O censo abre cada formulário de inclusão por GET, sem `f_seq`, o
que não grava nada no Lattes (`lattes_internals.md`, seção 2), e nunca envia
formulário. A única exceção é `link()` sem XML, que pede a exportação pelo
mesmo POST de leitura do "Exportar" (seção 12); ele recusa enquanto houver
alteração não enviada ao CNPq, e aí o XML vai como argumento.

1. `pnpm build:censo` monta `dist-censo/censo-lattes.js`.
2. Com o Lattes aberto e logado, no menu do currículo, cole o conteúdo do
   arquivo no console do navegador (ou injete pela automação).
3. Rode na mesma aba:

   ```js
   await __lattesCensus.captureAll({ download: true });
   ```

   Ele faz as duas passadas e baixa `censo-AAAA-MM-DD.json`. As partes
   avulsas são `await __lattesCensus.capture({ download: true })` (só os
   formulários) e `await __lattesCensus.link(xml)` (só as ligações).
   `__lattesCensus.summary(resultado)` mostra as contagens. Opções:
   `{ only: ['formacao', 'evento'] }` restringe as entradas,
   `{ redact: ['Seu Nome'] }` esconde textos, `{ discover: true }` lê as
   listas do menu e anota inclusões que a lista de formulários não tem, e
   `{ delayMs: 300 }` é a pausa entre pedidos.

4. Leia o arquivo antes de versionar (procure o próprio nome), copie para esta
   pasta e rode `pnpm censo:relatorio`. Divergências novas aparecem no console
   e reprovam `tests/census-coverage.test.ts`: corrija o editor ou, se forem
   conhecidas, aceite com `pnpm censo:relatorio --aceitar`.

O mesmo `__lattesCensus` roda contra o Lattes simulado (`pnpm dev:lattes`),
que é como os testes conferem a captura e a passada de edição.

## Os grupos do relatório

Cada atributo que um formulário grava (o item e as partes dele: dados
básicos, detalhamento, autores, palavras-chave...) cai num grupo, pelo campo
ligado a ele na captura mais recente:

- **com opções**: rádio, caixa ou lista;
- **texto livre**: campo de texto ou área;
- **oculto**: um oculto, inclusive as grades serializadas (`f_autores_l`,
  `f_area_l`, `f_plv_l`, `f_setor_l`);
- **fora do formulário**: nenhum campo ligado;
- **sem captura**: o formulário ainda não foi capturado (lacuna, não reprova).

A ligação vem, nesta ordem, da passada de edição (**observado**), das tabelas
de `lattes_internals.md` (**documentado**, ou **inferido** quando a própria
seção marca assim) e de um palpite pelo nome do campo (**inferido**). Ligação
observada ambígua (o mesmo ano em conclusão e em obtenção do título) não
conta; vale a seguinte da lista.

As divergências que o teste acompanha:

- `lista-nao-ligada`: o campo do Lattes tem opções, a ligação é observada ou
  documentada, e o editor mostra texto livre (sem lista em
  `src/schema/typed-choices.ts` nem enumeração no XSD);
- `lista-diferente`: o editor tem a lista, e as opções não batem com as do
  formulário;
- `ordem`: a ordem dos campos no formulário do Lattes é outra que a de
  `src/ui/form-order.ts` (só quando esse arquivo existe).

## O que é conhecido e o que é palpite

A lista de formulários marca, por entrada, se o caminho foi visto no Lattes
(**observado**: seções 5, 16 a 19 de `lattes_internals.md`, o reconhecimento
de 10/10/2026 e a captura das listas de 13/10/2026 em `../lattes-listas/`) e se
a ligação do formulário com os elementos do XML foi conferida. Os caminhos
inferidos são os de desenho industrial, marca e topografia (o `f_reg` não foi
lido), e os que saem de um link da lista (atividade, linhas de pesquisa,
artigos, livros, demais trabalhos), que podem não existir: a inclusão de
alguns é por uma função da página. Prefácio e outra produção bibliográfica
ficam como endereço desconhecido.
