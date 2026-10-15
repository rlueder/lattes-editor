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
- `__lattesCensus.activities()` e `__lattesCensus.authorShape(nome)` servem
  aos lotes 3 e 4, abaixo.

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
bibliográfica não apareceram em nenhuma lista. O lote 3 não rodou: a lista
de atuações voltou vazia.

## O lote que falta

Com o menu do Lattes aberto na aba e o script colado no console:

```js
const redact = ['Seu Nome Completo', 'SOBRENOME, N.'];

// 3. As atividades de uma atuação, uma por natureza. O lote acha sozinho a
//    primeira atuação com o link "Incluir atividade" (pkg_ativ.lista, depois
//    a tela de cargos e vínculos) e abre o formulário de cada natureza. Os
//    códigos da atuação ficam fora do arquivo.
await __lattesCensus.activities({ redact, download: true });

// 4. A forma das linhas de autor do menu (autorDP), sem nome nenhum: a ordem
//    das chaves, o padrão dos códigos e a linha do dono, achada pelo nome.
copy(JSON.stringify(__lattesCensus.authorShape('Seu Nome Completo'), null, 2));

// 5. As janelas de onde vêm as grades de titulares da patente e as de
//    financiadores, produções e equipe do projeto.
await __lattesCensus.inspect(
  [
    'pkg_titular_inst.sele_inst',
    'pkg_titular_inst.sele_inst?f_ctr=O',
    'PKG_PROJETO.pp_lista_inst?f_pgm=INSTFINANC',
    'PKG_PROJETO.pp_lista_prod',
    'PKG_PROJETO.pp_lista_autores',
  ],
  { redact, download: true },
);
```

## O que extrair de cada item

| Item                                            | Onde                                                      | O que procurar                                                                                                                                                                                                              |
| ----------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A linha do dono na grade de autores e de equipe | o resultado do lote 4                                     | a ordem das chaves do `autorDP` e o padrão do código `c` da linha do dono ("-…", vazio ou "D"): é o que falta para incluir registros, produções, bancas e o projeto                                                         |
| Atividades de uma atuação                       | o lote 3, uma página por natureza                         | os campos de cada natureza (órgão, unidade, cargo, curso, especificação) e a grade `f_espec_l` de disciplinas e treinamentos: chaves e separadores; se a atividade de pesquisa e desenvolvimento leva as linhas de pesquisa |
| Titulares da patente                            | as duas páginas de `pkg_titular_inst.sele_inst` do lote 5 | o que cada linha de titular leva em `pais`, `staValidado` e `tipoInst`                                                                                                                                                      |
| Financiadores, produções e equipe do projeto    | as três janelas de `PKG_PROJETO` do lote 5                | os quatro valores de cada financiador em `f_inst_l`, o valor que liga uma produção ou orientação, e o que a janela de equipe põe numa linha                                                                                 |

O que só se responde enviando, e por isso fica para um teste acompanhado: o
passo depois do envio da formação complementar (`FORM2`) e o elemento do XML
que o corpo editorial, a revisão e o assessoramento gravam (o currículo não
tem nenhum item desses). A licença não tem como ir pelo formulário: o Lattes
exige a data de nascimento ou adoção, que o XML não guarda.

Depois de lido, o que virar fato vai para `docs/lattes_internals.md` (com a
data) e para o código, e a linha sai desta lista.
