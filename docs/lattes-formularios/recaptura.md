# Recaptura: o que falta ler no Lattes

O que a LAT-57 (criar pelo editor todo tipo de item) precisa ver no Lattes e a
captura de 15/10/2026 não guardou. Tudo é leitura: GET de lista e de
formulário de inclusão, sem `f_seq` e sem enviar nada. Roda numa sessão só,
com o mesmo `dist-censo/censo-lattes.js` do censo (`README.md` desta pasta).

Estas chamadas servem para isso:

- `__lattesCensus.capture({ scripts: true, … })` guarda também os scripts da
  própria página de cada formulário, sem dado pessoal;
- `__lattesCensus.inspect([caminhos], { download: true })` abre páginas que o
  censo ainda não tem como entrada e guarda, de cada uma, o formulário, os
  scripts e os endereços do Lattes que ela abre. Os caminhos vão sem `f_cod`
  (o código entra sozinho); `{ path, noCode: true }` abre sem ele, e um
  caminho que já traz `f_cod` (copiado do Lattes) não ganha outro. O arquivo
  baixado é `recaptura-AAAA-MM-DD.json` e não é um censo versionado;
- `__lattesCensus.activities()` abre o formulário de atividade de cada
  natureza numa atuação do currículo;
- `__lattesCensus.authorShape(nome)` e `__lattesCensus.vectorShape(vetor,
nome)` descrevem um vetor do menu (`autorDP`, `titularPessoaDP`) sem nome
  nenhum: a ordem das chaves, o padrão dos códigos e as linhas que casam com o
  nome dado.

Em 15/10/2026, a lista de atuações aberta à mão com `f_cod` voltou com 53
bytes e sem links. Que o `f_cod` repetido pelo `inspect` tenha causado isso é
**inferido** (o gateway responde 404 a um parâmetro que o procedimento não
declara, seção 1 de `lattes_internals.md`; o parâmetro repetido não foi
testado). O lote 3 agora acha a atuação sozinho.

Dos scripts sai, linha a linha, todo e-mail, CPF e número longo (código e
identificador do currículo), cada texto passado em `redact` e as linhas que
montam os dados das grades (`autorProvider` e parecidas). Mesmo assim, leia o
arquivo antes de entregar: procure o próprio nome e o de coautores.

## O que a recaptura de 15/10/2026 respondeu

Os lotes 1 e 2 rodaram em 15/10/2026, em 96 segundos. O que se leu está na
seção 21 de `../lattes_internals.md`, e as entradas novas do censo em
`censo-2026-10-15b.json` (aperfeiçoamento, artigo publicado, programa de
computador registrado e a janela prévia da patente). Responderam: as datas e
a grade de datas da patente, o formato das datas dos registros, o `check()`
de cada registro, o programa de computador registrado, o artigo publicado, a
licença, a grade de áreas (em parte), as grades do projeto (em parte), a
formação complementar (até o envio), a lista de linhas de pesquisa, a grade
de autores (em parte) e as buscas das orientações. Prefácio e outra produção
bibliográfica não apareceram em nenhuma lista. O lote 3 não rodou na primeira
vez: a lista de atuações voltou vazia.

Os lotes 3 a 5 rodaram depois, no mesmo dia (seção 22 de
`../lattes_internals.md`; as nove telas de atividade em
`censo-2026-10-15c.json`). Responderam: a linha da própria pessoa no
`autorDP` (o que destravou os registros, menos a patente, e a equipe do
projeto), os campos e o `check()` de cada natureza de atividade, o formato de
`f_espec_l` e o rótulo da grade de cada natureza (a linha de pesquisa entra
pela atividade de pesquisa e desenvolvimento), e a forma das buscas de
titular e de financiador, que são POST e por isso não trouxeram resultado.
`PKG_PROJETO.pp_lista_prod` respondeu 404.

## O lote que falta

Com o menu do Lattes aberto na aba e o script colado no console. Os códigos
entre `<…>` se copiam do Lattes: o da instituição está no link da busca de
órgão do formulário de atividade, e o link de alteração de uma atividade de
ensino está na tela de cargos e vínculos da atuação.

```js
const redact = ['Seu Nome Completo', 'SOBRENOME, N.'];

// 6. A forma do vetor de titulares pessoa do menu, sem nome nenhum.
copy(JSON.stringify(__lattesCensus.vectorShape('titularPessoaDP', 'Seu Nome Completo'), null, 2));

// 7. A busca de órgão de uma atuação (a das atividades e a do projeto) e a
//    tela de alteração de uma atividade de ensino que já existe.
await __lattesCensus.inspect(
  [
    'prc_orgao_cargo?f_modal_cv=9&f_cod_inst=<código da instituição>',
    'PKG_PROJETO.pp_orgao_cargo?f_cod_inst=<código da instituição>',
    '<link de alteração de uma atividade de ensino>',
  ],
  { redact, download: true },
);
```

## O que extrair de cada item

| Item                                 | Onde                                 | O que procurar                                                                                                                                                              |
| ------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Titular pessoa da patente            | o resultado do lote 6                | a ordem das chaves do `titularPessoaDP` e a linha da própria pessoa: é o que falta para a patente ir pelo conector                                                          |
| Órgão ou unidade de uma atuação      | as duas buscas de órgão do lote 7    | se a busca responde por GET com a lista de órgãos, e o código que ela põe em `f_codorgao`: é o que falta para as outras oito naturezas de atividade e para o projeto        |
| Atividade que já existe              | a tela de alteração do lote 7        | onde ficam as disciplinas que a atividade já tem (o `Provider` da grade) e o código `c` de cada uma: é o que falta para incluir uma disciplina numa atividade que já existe |
| Financiadores e produções do projeto | o resultado das buscas, que são POST | os quatro valores de cada financiador em `f_inst_l` e o valor que liga uma produção ou orientação; ler a resposta pede enviar a busca, e isso é decisão do dono             |

O que só se responde enviando, e por isso fica para um teste acompanhado: o
passo depois do envio da formação complementar (`FORM2`), o elemento do XML
que o corpo editorial, a revisão e o assessoramento gravam (o currículo não
tem nenhum item desses) e a primeira inclusão real de cada tipo que o
conector já inclui sem ter sido acompanhado: os cinco registros que não são
patente e a atividade de ensino, que dependem da linha da própria pessoa e do
formato de `f_espec_l` lidos no código, sem envio. A licença não tem como ir pelo formulário: o Lattes
exige a data de nascimento ou adoção, que o XML não guarda.

Depois de lido, o que virar fato vai para `docs/lattes_internals.md` (com a
data) e para o código, e a linha sai desta lista.
