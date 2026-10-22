# Desenvolvimento

Como rodar, testar, montar e lançar o LattesEditor. Como as peças se encaixam
está em [`arquitetura.md`](arquitetura.md); as regras de quem contribui, em
[`AGENTS.md`](../AGENTS.md).

## Rodar

```bash
pnpm install
pnpm desktop:dev          # o app, com recarga ao vivo e o selo DEV no ícone (precisa de Rust)
pnpm dev                  # só a página do editor, no navegador (porta 5173)
pnpm dev:exemplo          # o editor com fixtures/synthetic_full.xml, todas as seções (porta 5199)
pnpm dev:demo             # o editor com fixtures/demo.xml, o currículo das imagens (porta 5198)
pnpm build:extension      # a extensão em dist-extension/
pnpm dev:lattes           # o Lattes simulado
```

O app usa Tauri 2 e precisa do Rust e, no macOS, das ferramentas de linha de
comando do Xcode. No `pnpm desktop:dev` e no `pnpm dev` vale uma chave fixa de
desenvolvimento para os dados locais, no lugar do chaveiro. Cada porta tem o
próprio armazenamento no navegador.

`fixtures/demo.xml` é uma pesquisadora fictícia (Ana Beatriz Souza Lima,
genética da conservação de palmeiras), com formação, atuação, projeto,
artigos, eventos, bancas e orientações críveis. Instituições e periódicos são
reais, os títulos não existem e os DOIs usam o prefixo de teste do Crossref
(`10.5555`). `synthetic_full.xml` é o dos testes, com todo elemento do schema.

Prévias no `pnpm dev`, sem Lattes nem extensão:

| Endereço                 | Mostra                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `?simular-atualizacao`   | O aviso de versão nova e "Verificar atualizações" no ⚙ (`=nenhuma`, `=falha`)                                               |
| `?simular-foto`          | O lápis da foto e a troca (`=falha` para o erro)                                                                            |
| `?primeiro-uso=<estado>` | Um estado fixo da tela de primeiro uso (`src/dev/onboarding-preview.ts`)                                                    |
| `?simular-envio`         | A janela "Enviar ao Lattes" com uma tela de envio de exemplo (`src/dev/send-screen-preview.ts`); `&publicar` mostra a caixa |
| `?itens-teste`           | O painel dos itens de teste do censo (`lattes-formularios/itens-de-teste.md`)                                               |

## Ícones das seções

A prancha `/brand/sections/` (no `pnpm dev`, entrada em
`scripts/section-art-preview.tsx`) mostra o ícone do estado vazio de cada
seção com a grade de construção e os dois temas. Os desenhos ficam no mapa
`ART` de `src/ui/empty-art.tsx`, em 96 × 96 px, no módulo de 8 px, com as
medidas de `brand/construction/proportions.json`; `Ring` e `Lines` guardam as
proporções dos anéis e das barras do logo. A cor principal é `currentColor`
e o menta é `--section-art-accent`. Sem arquivos externos nem ids repetidos
entre desenhos. `brand/rebuild.py` não toca nesses desenhos.

## Lattes simulado

```bash
pnpm dev:lattes           # http://127.0.0.1:5197/cvlattesweb/PKG_MENU.menu
```

Um Lattes de mentira com `fixtures/demo.xml` em memória: menu, listas,
formulários de edição e inclusão, Exportar, os três passos do Importar, a
página de conferência, a foto, o envio ao CNPq e a sessão que vence. Os POSTs
com `f_ctr` U, I e E mudam o estado e acendem a pendência, como no Lattes. O
que cada procedimento faz, e o que é observado ou palpite, está em
[`../scripts/lattes-simulado/README.md`](../scripts/lattes-simulado/README.md).

Para usar com o app e a extensão:

1. `pnpm dev:lattes` e abra o menu no Chrome ou no Brave.
2. Monte a extensão Dev com `node scripts/build-extension.ts --canal-dev` e
   carregue `dist-extension-dev/` em `chrome://extensions` (ou use a que vem
   com o LattesEditor Dev). Só ela acha o Lattes em `localhost`; a publicada
   só conhece `wwws.cnpq.br`.
3. Abra o LattesEditor Dev (`pnpm desktop:dev` também serve).

`GET /__simulado/estado` mostra o estado; `POST` em `/__simulado/expirar`,
`/entrar`, `/publicar` e `/gravar` derruba a sessão, a devolve, publica e
acende a pendência.

Para testar com uma exportação sua, ponha o `CV_<id>.zip` em `fixtures/real/`,
que está no `.gitignore`. As imagens do site saem sempre do currículo
sintético.

## Testar

```bash
pnpm test                 # Vitest
pnpm test:coverage        # com o limite de 80% (linhas, instruções, funções e ramos)
pnpm typecheck
pnpm lint
cd src-tauri && cargo test && cargo clippy -- -D warnings
pnpm test:censo-isolation # os quadros do censo Dev num Brave sem janela (abaixo)
```

O Rust do canal Dev passa pelos mesmos comandos com `--features canal-dev`.
Os hooks do Husky rodam formatação e lint no commit e, no push, o conjunto
todo com cobertura. Os testes de ponta a ponta do conector sobem o Lattes
simulado dentro do próprio teste (`tests/helpers/lattes-simulado.ts`), com
as chaves das operações ligadas; os que cobrem o caminho desligado forçam a
chave ou a opção.

## Geradores

| Comando                                  | Gera                                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `pnpm gen:schema`                        | `src/schema/lattes.json` e os tipos, do XSD e de `schema/patch.json`                                                   |
| `pnpm gen:fixtures`                      | O currículo sintético em `fixtures/`                                                                                   |
| `pnpm gen:demo`                          | `fixtures/demo.xml` (`scripts/demo/`)                                                                                  |
| `pnpm validate:fixtures`                 | Confere as fixtures contra o XSD                                                                                       |
| `node scripts/gen-listas.ts`             | `src/schema/listas-lattes.json`, das listas capturadas nos formulários do Lattes                                       |
| `node scripts/inventario-campos.ts --md` | [`campos_tipados.md`](campos_tipados.md)                                                                               |
| `pnpm censo:relatorio`                   | `lattes-formularios/relatorio.md`                                                                                      |
| `node scripts/cobertura-conector.ts`     | Quantos campos do editor o conector envia, por seção, e o motivo do que falta                                          |
| `pnpm build:censo`                       | `dist-censo/censo-lattes.js`, o censo para rodar na aba do Lattes                                                      |
| `pnpm capture:screenshots`               | As capturas do site (`site/img/`)                                                                                      |
| `pnpm capture:animacoes`                 | As animações do site e do README (`site/img/homepage/*.webp`); precisa do `img2webp` (`brew install webp`)             |
| `pnpm capture:store`                     | As imagens da Chrome Web Store, em `img/loja/`                                                                         |
| `scripts/limpar-branches-mesclados.sh`   | Ensaio dos worktrees e branches locais de PR mesclado; `--yes` os remove, `--incluir-fechados` também os de PR fechado |

Os arquivos gerados passam pelo Prettier no próprio gerador.

## Vigias do Lattes

O CNPq não avisa quando muda o Lattes. Duas coisas olham por ele:

- **O que é público.** `node scripts/vigia-lattes.ts` confere o XSD byte a
  byte contra o do repositório, a página que o publica, a foto do perfil e a
  entrada do Lattes. O workflow `vigia-lattes.yml` roda toda segunda-feira e
  abre uma issue `vigia-lattes` quando algo muda.
- **O que fica atrás do login.** A extensão confere, só com leituras, o menu,
  um exemplar de cada formulário que o conector grava e as listas dos campos
  tipados (`src/bridge/contract.ts`), ao abrir o painel, quando o menu carrega
  e antes de cada fila. O painel mostra o relatório quando acha um problema,
  com um link para abrir a issue.

## Canal Dev

A cada merge na `main`, depois do CI verde, o workflow `dev.yml` monta o
**LattesEditor Dev** nos três sistemas, com a extensão Dev dentro, na
pré-estreia [`dev`](https://github.com/rlueder/lattes-editor/releases/tag/dev).
Para montar sem esperar um merge: `gh workflow run dev.yml`.

O Dev convive com o app publicado: outro nome e ícone, identificador
(`dev.lattes-editor.app.dev`), pasta de dados, chaveiro e host nativo
(`lattes_editor.conector_dev`); versões como `0.22.0-dev.42`, de onde ele se
atualiza sozinho. Ao abrir, ele copia a extensão Dev para `extensao-dev` na
pasta de dados (no macOS,
`~/Library/Application Support/dev.lattes-editor.app.dev/extensao-dev`); a
pasta se carrega uma vez em `chrome://extensions` e, a cada atualização do
app, é refeita e a extensão se recarrega sozinha.

## Lançar uma versão

Merge na `main` não lança nada. Os dois passos são manuais, em Actions ou
pelo `gh`:

```bash
gh workflow run release.yml               # Lançar versão: cria o rascunho
gh workflow run publicar.yml              # Publicar versão: o rascunho mais recente
gh workflow run publicar.yml -f tag=v0.23.0
```

1. **Lançar versão** (`release.yml`) confere que o CI passou no commit atual
   da `main`. O semantic-release junta os commits desde a última tag `v*`:
   `feat` sobe a menor; `fix`, `perf` e `refactor`, a correção; `docs`, `ci`,
   `chore` e `test` não entram nas notas. Ele atualiza o `CHANGELOG.md`, cria
   a tag e o lançamento como rascunho, e o app é montado nos três sistemas
   (`desktop-build.yml`) dentro dele, com os pacotes de atualização assinados
   e o `latest.json`. Cada PR entra na `main` em squash, e o título do PR
   vira a linha das notas: precisa seguir o Conventional Commits.
2. **O rascunho é o portão.** Só quem cuida do repositório o vê; é dele que
   saem os instaladores para testar.
3. **Publicar versão** (`publicar.yml`) confere que o rascunho tem os
   instaladores, as duas extensões e um `latest.json` da mesma versão, e o
   publica como o mais recente. Só então o app instalado oferece a
   atualização.

No macOS, o app sai assinado com o Developer ID e notarizado; os segredos
`APPLE_*` estão no repositório. O instalador do Windows ainda não é
assinado. A chave de atualização fica em `TAURI_SIGNING_PRIVATE_KEY` e
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, e a pública em
`src-tauri/tauri.conf.json`: sem a privada não há como publicar uma
atualização que o app aceite, então guarde uma cópia fora do GitHub.

Em PR, os três sistemas só são montados quando muda algo em `src-tauri/`;
para montar em outro caso, `gh workflow run desktop-build.yml --ref <branch>`.

## Página do projeto

`site/` é publicada em [rlueder.github.io/lattes-editor](https://rlueder.github.io/lattes-editor/)
pelo `pages.yml`, quando muda na `main`. Para ver sem compilar o editor:

```bash
python3 -m http.server 8858 --bind 127.0.0.1 --directory site
```

HTML, CSS e JavaScript sem etapa de build: `homepage.css` atende as duas
páginas e `homepage.js`, só a inicial. A política de privacidade
(`privacidade.html`) usa o mesmo cabeçalho e rodapé, com o texto numa coluna
de leitura (`.prose`). A página segue a linguagem visual dos projetos abertos
da Precisa (`platform/docs/design/linguagem-visual.md`): grade de 14 colunas,
cabeçalho roxo, Pausa nos títulos e Margem no resto, tokens de cor de
`@precisa-saude/themes` copiados para `homepage.css`; IBM Plex é a
alternativa quando as fontes remotas não carregam. O botão principal lê o
sistema de quem visita e aponta para o instalador dele.

As imagens saem de `pnpm capture:screenshots`, sempre com `fixtures/demo.xml`,
da janela de 1440 × 860 em 2x (2880 × 1720). Preserve as dimensões nos
atributos `width` e `height` e na tabela `images` do `homepage.js`. As
animações (`hero-*.webp`, `panorama*.webp`, `busca.webp`, `enviar.webp`) saem
de `pnpm capture:animacoes`, na mesma janela, a 10 quadros por segundo, como
WebP animado com perdas; para regravar uma só, passe o nome depois da URL
(`pnpm capture:animacoes http://localhost:5173/ busca`). Quem pede movimento
reduzido vê a captura parada. O README usa as mesmas animações.

A cena `enviar` grava de verdade no Lattes simulado, pela extensão Dev num
navegador sem janela:

1. `pnpm dev:lattes` e `node scripts/build-extension.ts --canal-dev --sem-app`
   (`dist-extension-gravacao/`: a extensão Dev sem o host nativo, para não
   acordar o LattesEditor Dev instalado).
2. Um perfil de navegador com o "ok" do aviso da extensão: carregue
   `dist-extension-dev/` no seu Chrome ou Brave, aceite o aviso no painel e
   copie `Local Extension Settings/<id da extensão>` do seu perfil para
   `<perfil>/Default/` de uma pasta nova.
3. `LATTES_EXTENSAO=dist-extension-gravacao LATTES_PERFIL=<perfil> pnpm capture:animacoes http://localhost:5173/ enviar`.

## Tráfego do censo Dev

O censo e os itens de teste (`lattes-formularios/`) só rodam com a extensão
Dev atualizada e o menu recarregado, inclusive pelo console: sem a ponte de
tráfego, nenhum pedido é feito. A coleta respeita os mesmos tetos e pausas do
conector; `only` restringe os tipos, e `__lattesCensus.cancel()` para a
tarefa, sem desfazer um POST já recebido. A permissão
`declarativeNetRequestWithHostAccess` existe só no canal Dev e bloqueia
navegações HTTP dos quadros durante a tarefa.

Os quadros de formulário usam uma origem opaca (`sandbox="allow-scripts"`,
sem `allow-same-origin`): o navegador impede que scripts do formulário
acessem o DOM, as funções e o armazenamento do menu, abram popups ou naveguem
a janela principal. `extension/src/censo-frame-runtime.ts` roda o
preenchimento, os validadores e as confirmações dentro do quadro; a
comunicação é uma `MessageChannel` privada, aceita uma única vez e só do pai,
e o pai autoriza um POST por ação de salvar ou excluir, validando campos e
destino da mesma origem antes de passar ao transporte. As caixas de mensagem
e os modais conhecidos têm uma adaptação local ao quadro; um formulário que
dependa de outro acesso ao menu para a tarefa com erro, sem volta ao modo de
mesma origem. O controlador é montado por `scripts/censo-runtime.ts`, no
censo avulso e no canal Dev; a extensão publicada não leva esse código.

`pnpm test:censo-isolation` monta a extensão Dev e testa isso num perfil
temporário do Brave (`/Applications/Brave Browser.app`, ou outro binário em
`LATTES_BROWSER`), com servidor sintético local e DNS externo bloqueado:
origem opaca, tentativas de acesso ao pai, popups, navegação, mensagens
forjadas, rede direta, salvar, excluir, formulários em dois passos,
cancelamento e recusa de envio duplicado. Os validadores de cada formulário
do CNPq ainda pedem conferência específica, porque a regressão usa páginas
sintéticas.
