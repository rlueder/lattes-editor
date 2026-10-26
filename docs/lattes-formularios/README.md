# Censo dos formulários do Lattes

O censo registra, para cada formulário do Lattes, os campos que a pessoa vê
com o rótulo ao lado, os ocultos, as opções de cada rádio e lista, e a
ligação de cada campo com o atributo do XML da exportação. Serve para dizer,
atributo por atributo, se o editor cobre o que o Lattes oferece.

| Arquivo                          | O que tem                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `censo-AAAA-MM-DD.json`          | Uma captura feita numa sessão real do Lattes                                         |
| `censo-AAAA-MM-DD-ligacoes.json` | Só a passada de edição, sem formulários (`link(xml, { download: true })`)            |
| `relatorio.md`                   | A cobertura, gerada por `pnpm censo:relatorio`; não editar à mão                     |
| `pendencias.json`                | As divergências já conhecidas, que o teste aceita (`pnpm censo:relatorio --aceitar`) |
| `itens-de-teste.md`              | A passada que cria um item de teste por opção de cada formulário, lê e remove        |

O código está em `src/census/`: a leitura das páginas sem DOM (`html-scan.ts`),
o registro sem dados pessoais (`census-page.ts`), a lista de formulários
(`targets.ts`, `targets-production.ts`), a captura (`run.ts`), a passada de
edição (`link.ts`), o relatório (`report.ts`, `report-render.ts`) e a
inspeção de páginas avulsas (`inspect.ts`). O que roda na aba do Lattes é
`extension/src/censo.ts`.

## O que cada captura guarda, e o que nunca guarda

Por formulário: o caminho aberto (sem o código do currículo e sem números de
item), o nome e o destino de cada `<form>`, os campos na ordem da página com
tipo, limite, rótulo e opções, os nomes dos ocultos e os valores de poucos
ocultos que dizem que formulário é aquele (`f_ctr`, `f_tipo`, `f_nivel`,
`f_cod_tipo`). Listas longas (países, idiomas) ficam uma vez só, em `lists`.
Com `scripts: true`, também os scripts da própria página, sem dado pessoal.

Nunca entram: o que estava digitado, marcado ou escolhido, o código de 10
caracteres, o identificador de 16 dígitos, e-mail, CPF. Um rótulo ou opção
com cara de dado pessoal sai como `[removido]`, e quem roda pode pedir para
esconder outros textos (`redact: ['Seu Nome']`).

A passada de edição (`link()`) lê os valores do currículo para casar campo e
atributo, só em memória, e guarda nomes e contagens: em quantos itens o valor
do campo era o do atributo, quantos links de edição a lista tinha (`listed`),
`so-na-lista` quando o Lattes tem itens que a exportação não tem, `sem-link`
quando a lista não tem link de edição reconhecível (com os procedimentos que
a página abre em `listShape`), e, nos ocultos de grade, quantos vieram
preenchidos e quantos vazios (`grids`). Num campo de opções cujo rótulo não é
o valor do XML, guarda o par código ↔ valor do XSD (`S` ↔ `CONCLUIDO`).

## Como capturar

Só leitura. O censo abre cada formulário por GET, sem `f_seq` (o que não
grava nada, `lattes_internals.md`, seção 2), e nunca envia formulário. A
exceção é `link()` sem XML, que pede a exportação pelo POST do "Exportar"
(seção 12); com alteração pendente, o Exportar recusa, e o XML vai como
argumento. Precisa da extensão Dev atualizada e do menu recarregado
(`desenvolvimento.md`, "Tráfego do censo Dev").

1. `pnpm build:censo` monta `dist-censo/censo-lattes.js`.
2. Com o Lattes aberto e logado, no menu do currículo, cole o conteúdo do
   arquivo no console do navegador.
3. Na mesma aba:

   ```js
   await __lattesCensus.captureAll({ download: true });
   ```

   Faz as duas passadas e baixa `censo-AAAA-MM-DD.json`. As partes avulsas:
   `capture({ download: true })` (só os formulários), `link(xml, { maxItems:
50, download: true })` (só as ligações; são cerca de 150 GETs com pausa),
   `summary(resultado)` (as contagens) e `inspect(caminhos, { download: true })`
   (páginas que ainda não são entrada do censo; baixa
   `recaptura-AAAA-MM-DD.json`, que não é versionado). Opções: `only` restringe
   as entradas, `redact` esconde textos, `discover: true` lê as listas do menu
   e anota inclusões que a lista de formulários não tem, `scripts: true`
   guarda os scripts. `activities()` abre o formulário de atividade de cada
   natureza; `authorShape(nome)` e `vectorShape(vetor, nome)` descrevem um
   vetor do menu sem nome nenhum.

4. Leia o arquivo antes de versionar (procure o próprio nome e o de
   coautores), copie para esta pasta e rode `pnpm censo:relatorio`.
   Divergências novas aparecem no console e reprovam
   `tests/census-coverage.test.ts`: corrija o editor ou, se forem conhecidas,
   aceite com `--aceitar`.

O mesmo `__lattesCensus` roda contra o Lattes simulado (`pnpm dev:lattes`),
que é como os testes conferem a captura e a passada de edição.

## Os grupos do relatório

Cada atributo que um formulário grava cai num grupo, pelo campo ligado a ele
na captura mais recente: **com opções** (rádio, caixa ou lista), **texto
livre**, **oculto** (inclusive as grades serializadas `f_autores_l`,
`f_area_l`, `f_plv_l`, `f_setor_l`), **fora do formulário** (nenhum campo
ligado) e **sem captura** (lacuna, não reprova).

A ligação vem, nesta ordem, da passada de edição (**observado**), das tabelas
de `lattes_internals.md` (**documentado**, ou **inferido** quando a seção
marca assim) e de um palpite pelo nome do campo (**inferido**). Num campo de
opções, a ligação observada precisa de dois itens.

As divergências que o teste acompanha saem de comparar as opções do campo do
Lattes com o controle que o editor mostra (`src/census/option-check.ts`,
decidido como em `src/ui/AttributeField.tsx`):

- `lista-nao-ligada`: o campo do Lattes tem opções e o editor mostra texto
  livre;
- `lista-diferente`: o editor tem a lista, e as opções não batem;
- `booleano-diferente`: o editor mostra sim/não e o campo tem outras opções;
- `valor-contrariado`: nos itens da exportação, o código da opção veio com o
  valor contrário ao que ele diz. Nos campos que o Lattes grava invertidos
  (`INVERTED_FLAGS` em `src/bridge/vinculo-flag.ts`, hoje só `f_stavinc`), a
  divergência passa a ser o código bater com o valor;
- `ordem`: a ordem dos campos no formulário é outra que a de
  `src/ui/form-order.ts`.

## O que ainda não foi lido

Tudo abaixo só se vê enviando, e por isso espera um teste acompanhado, com um
item de teste e a base da passada de itens de teste:

- o passo depois do envio da formação complementar (`FORM2`) e o que ele
  grava com `f_ctr` vazio;
- o elemento do XML que corpo editorial, revisão e assessoramento gravam
  (`PKG_REVISOR.INCLUI`): o currículo não tem item desses;
- a primeira inclusão real de cultivar protegida e registrada, desenho
  industrial, marca e topografia;
- a licença: o Lattes exige a data de nascimento ou adoção, que o XML não
  guarda, então ela não tem como ir pelo formulário;
- a troca de instituição e curso de uma formação complementar e a do órgão
  de um projeto feitas pela própria página, com o corpo do POST registrado
  para comparar com o do conector (os dois envios do conector voltaram com
  os valores de antes, `lattes_internals.md`, seção 18);
- a pessoa com deficiência com um ou dois tipos marcados e a "outra forma de
  contato" incluída, cada uma seguida de uma exportação, para ver como o XML
  grava `PCD` e `OUTRA-FORMA-DE-CONTATO`.

Estas pedem um item de teste, e por isso também um envio acompanhado:

- uma exportação depois de ligar um financiador, uma produção e uma
  orientação a um projeto de teste, para ver a linha de
  `EDITAR_FINANCIAMENTO` e confirmar que a linha de `pp_lista_prod` leva a
  `SEQUENCIA-PRODUCAO`;
- o titular instituição de uma patente de teste e os ambientes de um
  programa de computador de teste, com a exportação de cada um;
- a natureza de uma banca de qualificação aberta na página carregada: a
  ordem dos rádios depois dos scripts, que decide o nível das buscas.

Uma leitura sem envio ainda falta: o vetor `programaDP` do formulário do
programa de computador sem o apagamento de nomes, que hoje leva os rótulos
`l` e `n` dessa lista fixa junto com os dados pessoais. As músicas de teste de
18/10/2026 também precisam do valor exportado de `TIPO-DE-EVENTO` ao lado do
`f_tpo_evento` de cada uma: 3 das 7 não bateram.

Os caminhos inferidos na lista de formulários são os de desenho industrial,
marca e topografia (o `f_reg` não foi lido) e os que saem de um link da
lista (atividade, linhas de pesquisa, artigos, livros, demais trabalhos), que
podem não existir: a inclusão de alguns é por uma função da página. Depois de
lido, o que virar fato vai para `lattes_internals.md`, com a data, e para o
código.
