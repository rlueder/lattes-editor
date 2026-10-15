# Recaptura da passada de edição

O que a LAT-58 (enviar pelo editor a alteração de qualquer item) precisa ver
de novo no Lattes. É só leitura: GET das listas do menu e dos formulários de
edição que as linhas abrem, sem enviar nada. Fica num arquivo à parte da
`recaptura.md` da LAT-57 enquanto as duas estão em ramos diferentes.

## Por que a captura de 15/10/2026 marcou quase toda produção como "sem-itens"

Na passada de edição (`link()`, `src/census/link.ts`), o "sem-itens" de uma
entrada saía só da exportação: se o XML não tinha o elemento, a lista do
Lattes nem era aberta. Não foi defeito de link da lista nem de ligação da
entrada com o elemento. As produções do dono que estão na exportação são
trabalhos técnicos e editoração, e as duas foram lidas, mas só 8 de cada
(o limite padrão, `maxItems: 8`), sem dizer que o limite cortou.

A captura também escondia duas coisas:

- a exportação é a versão publicada, e um item que entrou pelo Importar fica
  fora dela até o envio ao CNPq (seção 13 de `../lattes_internals.md`). Um
  item assim aparecia como "sem-itens" mesmo existindo na lista do Lattes;
- a atuação e a atividade da atuação vieram "ok" com 0 itens lidos: o XML
  tem itens, mas a lista não tem link de edição que o censo reconheça (a
  grade de atividades monta o link por JavaScript, seção 8). Saíam como se
  estivesse tudo certo.

Desde este ramo, a passada de edição:

- abre a lista mesmo quando a exportação não tem o elemento, e conta os links
  de edição sem abrir formulário: `so-na-lista` quando o Lattes tem itens que
  a exportação não tem;
- guarda em `listed` quantos links de edição a lista tinha, antes do limite
  (com `read` menor, o limite cortou);
- marca `sem-link` quando a exportação tem itens e a lista não tem link de
  edição reconhecível, e guarda em `listShape` os procedimentos que a página
  abre, só com os nomes dos parâmetros, e quantas vezes o procedimento do
  formulário aparece fora de um link.
- conta, nos ocultos de grade (`f_autores_l`, `f_plv_l`, `f_area_l`,
  `f_setor_l`…) dos formulários de edição lidos, em quantos vieram
  preenchidos e em quantos vazios (`grids`), sem guardar o valor.

## O que rodar

Numa sessão do Lattes, com o menu aberto na aba e nenhuma alteração pendente
de envio ao CNPq (com pendência, o Exportar recusa; veja abaixo).

1. Neste ramo, `pnpm build:censo` monta `dist-censo/censo-lattes.js`.
2. Cole o conteúdo do arquivo no console da aba do menu.
3. Rode:

   ```js
   const r = await __lattesCensus.link(undefined, { maxItems: 50, download: true });
   console.table(r.summary.filter((s) => s.status !== 'sem-itens'));
   ```

   O navegador baixa `censo-AAAA-MM-DD-ligacoes.json`. São cerca de 150 GETs
   com 300 ms de pausa entre eles, alguns minutos.

Com alteração pendente, passe o XML no lugar da exportação: abra o ZIP de
uma exportação recente (a do próprio Lattes, sem edição do editor por cima),
copie o texto do XML e rode `__lattesCensus.link(xml, { maxItems: 50,
download: true })`. Um XML com edições ainda não enviadas conta valores
diferentes como divergência.

4. Leia o arquivo antes de versionar: ele só tem nomes de campo, de atributo,
   de procedimento e de parâmetro, e contagens, mas confira mesmo assim.
5. Copie para esta pasta e rode `pnpm censo:relatorio`. O relatório usa as
   ligações do arquivo mais recente de cada entrada; os formulários seguem os
   da captura de 15/10/2026.

## O que olhar no resultado

| Onde                                                            | O que diz                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `status: 'so-na-lista'`                                         | o Lattes tem itens desse tipo que a exportação não tem. Para ler as ligações deles, envie ao CNPq e rode de novo, ou passe um XML que os tenha                                                                                                                                                         |
| `trabalho-tecnico` e `tec-2D`, `listed` e `read`                | com `maxItems: 50`, os dois iguais: todos os trabalhos técnicos e editorações lidos                                                                                                                                                                                                                    |
| `trabalho-tecnico`, `f_seq` ↔ `SEQUENCIA-PRODUCAO`              | em 15/10/2026, 5 itens bateram e 3 não. Com todos lidos, diz se o `f_seq` da lista é o número do item ou não; até lá, o evento se abre pelo `f_seq` e só grava se ano, nome do evento e cidade baterem, e prêmio e formação complementar se acham pelos valores                                        |
| `atividade` e `atuacao`, `status: 'sem-link'`                   | `listShape.procs` mostra o que a tela de cargos e vínculos abre, e `mentions` quantas vezes `pkg_ativ.cargo` aparece num script: é onde está o link de edição da atividade                                                                                                                             |
| `premio`, `idioma`, `formacao-complementar`, `areas-de-atuacao` | as ligações dos tipos que a LAT-58 já altera, agora com todos os itens                                                                                                                                                                                                                                 |
| `trabalho-tecnico` e `tec-2D`, `grids`                          | se o formulário de edição já traz as grades serializadas (`filled`) ou vazias (`empty`). Vazias, enviar o formulário como veio apagaria autores, palavras-chave, áreas e setores: a edição de produção precisa montar as grades (a de autores é a da LAT-57). Preenchidas, basta mandá-las como vieram |

## Os tipos sem item no currículo

Orientações, bancas, projetos, patentes e registros, e as produções que não
são trabalho técnico nem editoração, não têm item na exportação do dono: a
passada de edição não tem formulário de edição para ler, e o conector não tem
como conferir a ligação de campo e atributo nem o link de edição da lista.
Para observar, alguém inclui à mão no Lattes um item de teste de cada tipo
(o dono decide se e quais), envia ao CNPq para entrar na exportação, e roda o
mesmo `link()` acima com `only` restrito a esses tipos, por exemplo
`{ maxItems: 50, download: true, only: ['orientacao', 'banca', 'projeto'] }`.
Os itens de teste saem depois pelo próprio Lattes.

Depois de lido, o que virar fato vai para `../lattes_internals.md` (seção 20,
com a data) e para o código, e a linha sai desta lista.
