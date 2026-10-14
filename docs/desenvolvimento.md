# Desenvolvimento

Como rodar, testar, montar e lançar o LattesEditor. Como as peças se encaixam
está em [`arquitetura.md`](arquitetura.md); as regras de quem contribui, em
[`AGENTS.md`](../AGENTS.md).

## Rodar

```bash
pnpm install
pnpm desktop:dev          # o app, com recarga ao vivo e o selo DEV no ícone (precisa de Rust)
pnpm dev                  # só a página do editor, no navegador
pnpm dev:exemplo          # o editor já aberto com o currículo sintético completo
pnpm dev:demo             # o editor com o currículo de demonstração, para gravar e tirar imagens
pnpm build:extension      # a extensão em dist-extension/
```

O app usa Tauri 2 e precisa do Rust e, no macOS, das ferramentas de linha de
comando do Xcode. No `pnpm desktop:dev` e no `pnpm dev` vale uma chave fixa de
desenvolvimento para os dados locais, em vez do chaveiro do sistema.

`pnpm dev:exemplo` abre o editor na porta 5199 com
`fixtures/synthetic_full.xml`, que preenche todas as seções. Cada porta tem o
próprio armazenamento no navegador, então o currículo aberto no `pnpm dev`
(porta 5173) não é tocado. Para recomeçar do exemplo, feche o arquivo no editor
e recarregue a página.

`pnpm dev:demo` abre, na porta 5198, `fixtures/demo.xml`: uma pesquisadora
fictícia (Ana Beatriz Souza Lima, genética da conservação de palmeiras) com
formação, atuação, projeto, artigos, eventos, bancas e orientações críveis.
É o currículo para gravar o app em uso. As pessoas são inventadas;
instituições e periódicos são reais, os títulos não existem e os DOIs usam o
prefixo de teste do Crossref (`10.5555`). O `synthetic_full.xml` continua
sendo o dos testes, com todo elemento do schema e valores de teste.

Algumas telas têm uma prévia no `pnpm dev`, sem precisar do Lattes nem da
extensão:

| Endereço                 | Mostra                                                                      |
| ------------------------ | --------------------------------------------------------------------------- |
| `?simular-atualizacao`   | O aviso de versão nova, com um download simulado                            |
| `?simular-foto`          | O lápis da foto e a troca, com uma resposta simulada (`=falha` para o erro) |
| `?primeiro-uso=<estado>` | Um estado fixo da tela de primeiro uso (`src/dev/onboarding-preview.ts`)    |

Para testar com uma exportação sua, ponha o `CV_<id>.zip` em `fixtures/real/`,
que está no `.gitignore`. As imagens de `docs/img/` e `site/img/` saem sempre
do currículo sintético, nunca de um real.

## Testar

```bash
pnpm test                 # Vitest
pnpm test:coverage        # com o limite de 80% (linhas, instruções, funções e ramos)
pnpm typecheck
pnpm lint
cd src-tauri && cargo test && cargo clippy -- -D warnings
```

O código em Rust do canal Dev passa pelos mesmos comandos com
`--features canal-dev`. Os hooks do Husky rodam formatação e lint no commit e,
no push, o conjunto todo com cobertura.

## Geradores

| Comando                                  | Gera                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm gen:schema`                        | `src/schema/lattes.json` e os tipos, a partir do XSD do Lattes e de `schema/patch.json` |
| `pnpm gen:fixtures`                      | O currículo sintético em `fixtures/`                                                    |
| `pnpm gen:demo`                          | O currículo de demonstração, `fixtures/demo.xml` (`scripts/demo/`)                      |
| `pnpm validate:fixtures`                 | Confere as fixtures contra o XSD                                                        |
| `node scripts/gen-listas.ts`             | `src/schema/listas-lattes.json`, das listas capturadas nos formulários do Lattes        |
| `node scripts/inventario-campos.ts --md` | O inventário de [`campos_tipados.md`](campos_tipados.md)                                |
| `pnpm capture:screenshots`               | As imagens do README e do site                                                          |
| `pnpm capture:store`                     | As imagens da Chrome Web Store, em `docs/img/loja/`                                     |

Os arquivos gerados passam pelo Prettier no próprio gerador; senão, o
`format:check` e o gerador se reprovam um ao outro.

## Vigias do Lattes

O CNPq não avisa quando muda o Lattes. Duas coisas olham por ele:

- **O que é público.** `node scripts/vigia-lattes.ts` confere o XSD (byte a
  byte contra o do repositório), a página que o publica, a foto do perfil e a
  entrada do Lattes. O workflow "Vigia do Lattes" (`vigia-lattes.yml`) roda
  toda segunda-feira e abre uma issue com o rótulo `vigia-lattes` quando algo
  muda.
- **O que fica atrás do login.** A extensão confere, só com leituras, o menu,
  um exemplar de cada formulário que o conector grava e as listas dos campos
  tipados (`src/bridge/contract.ts`). Roda ao abrir o painel e quando o menu
  do Lattes carrega; o painel mostra o relatório quando acha um problema, com
  um link para abrir a issue.

## Canal Dev

A cada merge na `main`, depois do CI verde, o workflow "Versão Dev"
(`dev.yml`) monta o **LattesEditor Dev** nos três sistemas, com a extensão Dev
dentro, na pré-estreia
[`dev`](https://github.com/rlueder/lattes-editor/releases/tag/dev). É o que vai
entrar na próxima versão, para testar antes de lançar. Um build em andamento
sempre termina; o merge que chega espera e monta o topo da `main`. Para montar
sem esperar um merge: `gh workflow run dev.yml`.

O LattesEditor Dev convive com o app publicado:

- outro nome e ícone (com o selo DEV), identificador
  (`dev.lattes-editor.app.dev`), pasta de dados e entrada no chaveiro;
- outro host nativo (`lattes_editor.conector_dev`), que só a extensão Dev chama;
- versões como `0.22.0-dev.42`, pela página `dev`, de onde ele se atualiza
  sozinho. O app publicado nunca vê o canal.

A extensão Dev vem dentro do app. Ao abrir, o LattesEditor Dev a copia para a
pasta `extensao-dev`, na pasta de dados dele (no macOS,
`~/Library/Application Support/dev.lattes-editor.app.dev/extensao-dev`). Essa
pasta se carrega uma vez no Chrome ou no Brave (`chrome://extensions`, modo do
desenvolvedor, "Carregar sem compactação"); o app mostra o caminho quando não
acha a extensão, e ela pode levar até um minuto para aparecer. Depois, a cada
atualização do app, a pasta é refeita e a extensão se recarrega sozinha.

## Lançar uma versão

Merge na `main` não lança nada: as mudanças se acumulam até você decidir. Os
dois passos são manuais, em Actions ou pelo `gh`:

```bash
gh workflow run release.yml               # Lançar versão: cria o rascunho
gh workflow run publicar.yml              # Publicar versão: o rascunho mais recente
gh workflow run publicar.yml -f tag=v0.23.0
```

1. **"Lançar versão"** (`release.yml`) confere que o CI passou no commit atual
   da `main`. O semantic-release junta todos os commits desde a última tag
   `v*` numa versão só: `feat` sobe a menor; `fix`, `perf` e `refactor`, a
   correção; `docs`, `ci`, `chore` e `test` não entram nas notas. Ele atualiza
   o `CHANGELOG.md` com uma seção por versão, cria a tag e a página do
   lançamento como rascunho, e o app é montado nos três sistemas
   (`desktop-build.yml`) dentro do mesmo rascunho, com os pacotes de
   atualização assinados e o `latest.json`. Como cada PR entra na `main` em
   squash, cada um vira uma linha das notas, com o título do PR: o título
   precisa seguir o Conventional Commits.
2. **O rascunho é o portão.** Só quem cuida do repositório o vê; é dele que
   saem os instaladores para testar. O app instalado e a página do projeto
   continuam na versão publicada anterior.
3. **"Publicar versão"** (`publicar.yml`) confere que o rascunho tem os
   instaladores, as duas extensões e um `latest.json` da mesma versão, com os
   endereços apontando para os arquivos dele, e o publica como o mais recente.
   Rascunhos mais antigos saem junto, sem essa marca. Só então o app instalado
   oferece a atualização.

No macOS, o app sai assinado com o Developer ID e notarizado pela Apple; os
segredos `APPLE_*` estão no repositório. O instalador do Windows ainda não é
assinado. A chave de atualização fica nos segredos `TAURI_SIGNING_PRIVATE_KEY`
e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, e a pública em
`src-tauri/tauri.conf.json`. Sem a privada não há como publicar uma
atualização que o app aceite: guarde uma cópia fora do GitHub.

Em PR, os três sistemas só são montados quando muda algo em `src-tauri/`. Para
conferir a montagem antes do merge em outro caso:
`gh workflow run desktop-build.yml --ref <branch>`.

## Página do projeto

`site/` é publicada em [rlueder.github.io/lattes-editor](https://rlueder.github.io/lattes-editor/)
pelo `pages.yml`, quando muda na `main`. A política de
privacidade da extensão é `site/privacidade.html`.
