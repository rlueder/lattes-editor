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

| Endereço                 | Mostra                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `?simular-atualizacao`   | O aviso de versão nova e "Verificar atualizações" no ⚙ (`=nenhuma`, `=falha`)                                    |
| `?simular-foto`          | O lápis da foto e a troca (`=falha` para o erro)                                                                 |
| `?primeiro-uso=<estado>` | Um estado fixo da tela de primeiro uso (`src/dev/onboarding-preview.ts`)                                         |
| `?simular-envio`         | A janela "Enviar ao Lattes" com uma tela de envio de exemplo (`src/dev/send-screen-preview.ts`), sem sessão real |
| `?itens-teste`           | O painel dos itens de teste do censo (`lattes-formularios/itens-de-teste.md`)                                    |

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
pnpm test:contact-controls # e-mails e URLs: edição, validação e Escape, em perfil temporário sem janela
pnpm test:publish-controls # painel de publicação com declaração e transporte sintéticos, sem sessão real
pnpm test:modal-controls  # geometria de fechar e expandir, num Brave ou Chrome sem janela
```

O Rust do canal Dev passa pelos mesmos comandos com `--features canal-dev`.
O teste dos controles usa o CSS do app com cabeçalhos fictícios, em três
larguras e nos dois temas. Não abre currículos nem precisa de servidor local.
Os hooks do Husky rodam formatação e lint no commit e, no push, o conjunto
todo com cobertura e, só neste repositório, `pnpm test:ci-extra`: os testes
de contatos e de publicação no navegador sem janela e as montagens do app,
da extensão e do censo, que o CI também roda. A extensão Dev fica fora, para
o push não reescrever a pasta `dist-extension-dev/` carregada no navegador. Os testes de ponta a ponta do conector sobem o Lattes
simulado dentro do próprio teste (`tests/helpers/lattes-simulado.ts`), com
as chaves das operações ligadas; os que cobrem o caminho desligado forçam a
chave ou a opção.

O CI também roda os controles de contatos e publicação num navegador sem
janela, em perfis temporários e portas de depuração próprios. O teste de publicação usa declaração
e transporte sintéticos; não acessa uma sessão real nem envia ao CNPq. Esses
testes recusam `LATTES_PERFIL`, `LATTES_JANELA` e `LATTES_EXTENSAO` para não
reutilizar a sessão de quem está desenvolvendo.
As páginas de teste também bloqueiam HTTP e HTTPS.

`pnpm audit` ignora o aviso GHSA-vfj7-8cjw-p6xm (`braces` 3.0.3, esgotamento
de pilha com padrões aninhados). A lista fica em `pnpm.auditConfig.ignoreGhsas`
no `package.json`. O pacote chega por `micromatch`, dentro do semantic-release,
só roda no lançamento e só lê mensagens de commit do próprio repositório; não
existe versão corrigida. Quando o semantic-release trocar de versão, tirar o
aviso da lista e conferir se o audit volta a passar.

`node scripts/cobertura-conector.ts --resumo` mede o planejamento de envio
com o currículo sintético. `--lista=motivo:` lista cada lacuna; `--so=ELEMENTO`
restringe os elementos avaliados. Os testes em `tests/cobertura-conector.test.ts`
conferem as opções usadas na medição e impedem arredondar lacunas para 100%.
`scripts/cobertura-exemplo.ts` prepara apenas `synthetic_full.xml` para essa
medição, com opções válidas e contatos no formato serializado; um XML passado
como argumento é avaliado sem esses ajustes.

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

Às 9h17 e 21h17 de Brasília (0h17 e 12h17 UTC), o workflow
"DEV: montar o LattesEditor Dev (duas vezes por dia)" (`dev.yml`)
olha a `main`: se ela mudou desde o último Dev, se a mudança não é só
documentação (`docs/`, `site/`, README) e se o CI passou no topo, monta o
**LattesEditor Dev** nos três sistemas, com a extensão Dev dentro, na
pré-estreia [`dev`](https://github.com/rlueder/lattes-editor/releases/tag/dev).
Vários merges entre verificações dão um build só. O GitHub pode atrasar ou
omitir execuções agendadas; os horários não garantem um intervalo exato de 12
horas entre execuções. Para montar sem esperar o horário:

```bash
gh workflow run dev.yml                   # monta se a main mudou
gh workflow run dev.yml -f forcar=true    # monta de qualquer jeito
```

O Dev convive com o app publicado: outro nome e ícone, identificador
(`dev.lattes-editor.app.dev`), pasta de dados, chaveiro e host nativo
(`lattes_editor.conector_dev`); versões como `0.22.0-dev.42`, de onde ele se
atualiza sozinho. Ao abrir, ele copia a extensão Dev para `extensao-dev` na
pasta de dados (no macOS,
`~/Library/Application Support/dev.lattes-editor.app.dev/extensao-dev`); a
pasta se carrega uma vez em `chrome://extensions` e, a cada atualização do
app, é refeita e a extensão se recarrega sozinha.

## Lançar uma versão

Merge na `main` não lança nada. O PROD 1 e o PROD 2 se disparam à mão, em
Actions (os workflows com prefixo PROD; "CI" e "App de desktop" servem aos
dois canais) ou pelo `gh`. O PROD 3 roda no fim do PROD 2 e também à mão:

```bash
gh workflow run release.yml               # PROD 1: lançar versão, cria o rascunho
gh workflow run release.yml -f primeira_estavel=true  # primeira estável: 1.0.0
gh workflow run publicar.yml              # PROD 2: publicar versão, o rascunho mais recente
gh workflow run publicar.yml -f tag=v0.23.0
gh workflow run extensao-loja.yml -f tag=v1.0.0 -f confirmar=true  # PROD 3 à mão
```

1. **"PROD 1: lançar versão"** (`release.yml`) confere que o CI passou no
   commit atual da `main`. O semantic-release junta os commits desde a última
   tag `v*`: `feat` sobe a menor; `fix`, `perf` e `refactor`, a correção;
   `docs`, `ci`, `chore` e `test` não entram nas notas. Ele atualiza o
   `CHANGELOG.md`, cria a tag e o lançamento como rascunho, e o app é montado
   nos três sistemas (`desktop-build.yml`) dentro dele, com os pacotes de
   atualização assinados e o `latest.json`. Cada PR entra na `main` em squash,
   e o título do PR vira a linha das notas: precisa seguir o Conventional
   Commits.
   A opção **primeira_estavel**, desligada por padrão, escolhe `1.0.0`
   quando o último lançamento ainda é `0.x`. Não exige um commit com quebra
   fictícia. A configuração recusa a opção depois de uma versão `1.x` ou
   maior e confere o resultado antes de preparar os pacotes ou criar a tag.
   Os lançamentos seguintes continuam seguindo os tipos dos commits.
2. **O rascunho é o portão.** Só quem cuida do repositório o vê; é dele que
   saem os instaladores para testar.
3. **"PROD 2: publicar versão"** (`publicar.yml`) confere que o rascunho tem
   os instaladores, as duas extensões e um `latest.json` da mesma versão, e o
   publica como o mais recente. Só então o app instalado oferece a
   atualização. Em seguida, chama o PROD 3 com a tag publicada.
4. **"PROD 3: enviar extensão à Chrome Web Store"** (`extensao-loja.yml`)
   baixa `lattes-editor-extensao-loja.zip` do lançamento já publicado e
   confere o SHA-256, a versão, a ausência de `key` e o ID da loja no host
   nativo daquela tag. Não remonta o pacote nem aceita um rascunho ou canal
   Dev. Depois do upload, espera o processamento e pede revisão pela API v2,
   sem pular a análise nem ignorar avisos. A loja publica após aprovar, com a
   visibilidade configurada no painel.

Chamado pelo PROD 2, o PROD 3 primeiro consulta a loja
(`scripts/publicar-extensao.ts --consulta`, que só lê). Não envia nada quando
há revisão pendente, publicação adiada, upload em andamento ou advertência,
nem quando a loja já tem essa versão ou uma mais nova. Nos outros casos,
compara o pacote com o do lançamento da versão que a loja tem
(`scripts/extensao-mudou.ts`, que ignora só `version` e `version_name` do
manifest) e envia apenas se algo mudou. Se esse lançamento não existe ou não
tem o pacote, envia. O motivo fica no resumo do run. Uma falha nesse caminho
vira aviso no resumo e o run do PROD 2 continua verde; nesse caso, rode o
PROD 3 à mão.

À mão, o PROD 3 pede a tag e a confirmação e envia sem comparar. Qualquer
erro derruba o run, inclusive uma revisão pendente ou advertência. Roda só da `main`, com permissão de leitura no GitHub, e
serializa os envios sem cancelar um que já começou. Depois de uma falha de
rede, confira o painel antes de repetir: um POST pode ter sido recebido.
As instruções para configurar o ambiente `chrome-web-store` e as credenciais
estão em [`extensao_chrome_web_store.md`](extensao_chrome_web_store.md).

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
e os modais conhecidos têm uma adaptação local ao quadro, como a ajuda
`veriHelp()`, os vetores de sugestão das grades, o armazenamento e o cookie,
que no quadro ficam só na memória. Todo `parent.` e `top.` dos scripts vai a
essas cópias, e o que elas não têm para a tarefa com o nome pedido, sem volta
ao modo de mesma origem. Scripts e estilos de outro site saem do quadro. O controlador é montado por `scripts/censo-runtime.ts`, no
censo avulso e no canal Dev; a extensão publicada não leva esse código.

`pnpm test:censo-isolation` monta a extensão Dev e testa isso num perfil
temporário do Brave (`/Applications/Brave Browser.app`, ou outro binário em
`LATTES_BROWSER`), com servidor sintético local e DNS externo bloqueado:
origem opaca, tentativas de acesso ao pai, popups, navegação, mensagens
forjadas, rede direta, salvar, excluir, formulários em dois passos,
cancelamento e recusa de envio duplicado. Os validadores de cada formulário
do CNPq ainda pedem conferência específica, porque a regressão usa páginas
sintéticas.

### Censo pela ponte local

Para rodar o censo na aba do Lattes em segundo plano, sem colar no console:
ligue a depuração remota do navegador (`brave://inspect/#remote-debugging`,
"Allow remote debugging for this browser instance"), monte o censo e suba a
ponte. Ela só escuta em `127.0.0.1`, com um token na pasta temporária, e o
navegador pede "Allow" na primeira conexão.

```bash
pnpm build:censo
node scripts/censo-ponte.ts servir &        # mantém a conexão
node scripts/censo-ponte.ts carregar        # põe o censo na aba do menu
node scripts/censo-ponte.ts chamar '__lattesCensus.ledger()'
node scripts/censo-ponte.ts reanexar        # depois de entrar de novo no Lattes
PONTE_ALVO=localhost:5173 node scripts/censo-ponte.ts avaliar '<expr>'  # outra aba
```

`PONTE_ALVO` escolhe a aba pelo endereço (a do editor em desenvolvimento, por
exemplo); com `chrome-extension://<id>`, o worker da extensão Dev.

O censo carregado some quando a aba recarrega; `carregar` de novo. Desligue a
depuração remota ao terminar.

A mesma ponte serve para um envio acompanhado com o núcleo do conector, sem a
extensão: `node scripts/build-conector-ponte.ts` monta
`dist-censo/conector-ponte.js`, `carregar dist-censo/conector-ponte.js` o põe
na aba, e `chamar '__conectorPonte.apply(<operação>)'` roda o mesmo `applyOp`,
com os tetos de pedidos. `capturas` lista os POSTs que a aba fez desde que a
ponte subiu, com os textos mascarados e só os nomes e os campos de controle
(`f_ctr`, os códigos e os `*_old`) à vista: é como se registra o envio feito
pela própria página para comparar com o do conector.

O mesmo script monta `dist-censo/carregar-ponte.js`, para conferir "Carregar
do Lattes" no currículo real: `chamar '__carregarPonte.carregar()'` lê tudo
pelos formulários, com o passo de leitura da extensão, e devolve as contagens
de elementos e o que não foi lido. Para comparar com a exportação,
`chamar '__carregarPonte.exportar()'` (ou `usarExportacao('<ZIP em base64>')`,
quando o Lattes tem pendência e não exporta) e depois
`chamar 'Promise.resolve(__carregarPonte.comparar())'`. Só saem nomes de
elementos e atributos e contagens; `comparar('ELEMENTO@ATRIBUTO')` mostra a
forma dos valores que diferem (letras viram `a`, dígitos viram `9`), nunca o
conteúdo.

`dist-censo/passada-ponte.js` é a passada que exercita toda opção dos
formulários, e grava no currículo: só roda acompanhada, com o "ok" do dono.
`node scripts/inventario-opcoes.ts` lista, por formulário do censo, os campos
de escolha, as opções e quais um valor do XML alcança. Na aba,
`__passada.base()` fotografa as listas, `gerar()` monta itens de teste (título
com `TEST_MARK`) com uma escolha diferente em cada, `rodada()` os leva pelo
Importar em levas de 20, `conferirPaginas()` compara cada página de alteração
com o que o carregamento montou e `exercitar()` grava pelo conector as opções
que nenhum item mostrou ainda. `criarProjetos(financiador)` inclui um projeto
de cada natureza e uma licença de cada tipo, `telaProjetos()` grava neles os
campos só de tela e `lerTela()` mostra o que cada página marca. `registro()`
diz o que as listas têm a mais que a base; `apagar()` tira as linhas com a
marca e `apagarNovas('pkg_licenca.lista', '/200[123] ')` as licenças, que não
têm título: só as linhas a mais naquela lista cujo texto casa com o padrão. O
código fica em `scripts/passada/`.
