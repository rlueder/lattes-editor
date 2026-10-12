# LattesEditor

Um editor para o Currículo Lattes que roda no seu computador. Você exporta o
currículo no Lattes, edita aqui com busca, atalhos e formulários que não se
perdem, e leva as mudanças de volta ao Lattes. A página do projeto fica em
[rlueder.github.io/lattes-editor](https://rlueder.github.io/lattes-editor/).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/producoes-escuro.jpg" />
  <img src="docs/img/producoes-claro.jpg" alt="O editor aberto em Produções: menu de seções à esquerda, itens agrupados por tipo e ano no centro e, à direita, o filtro e o índice da seção." />
</picture>

## Baixar

O editor é um app para macOS, Windows e Linux. Os instaladores ficam na
[página do último lançamento](https://github.com/rlueder/lattes-editor/releases/latest):

| Sistema     | Arquivo                                          |
| ----------- | ------------------------------------------------ |
| macOS       | `LattesEditor-macOS.dmg` (Apple Silicon e Intel) |
| Windows     | `LattesEditor-Windows-setup.exe`                 |
| Linux       | `LattesEditor-Linux.deb` (Debian, Ubuntu, Mint)  |
| Outro Linux | `LattesEditor-Linux.AppImage`                    |

No macOS, o app é assinado e notarizado pela Apple e abre sem aviso. O
instalador do Windows ainda não tem assinatura: o SmartScreen avisa na
primeira abertura; abra os detalhes do aviso e escolha executar.

No Linux, o `.deb` é pequeno porque usa o WebKitGTK do sistema, que o
gerenciador de pacotes instala junto. O AppImage roda em qualquer
distribuição sem instalar nada e por isso leva o WebKitGTK dentro, o que o
deixa dezenas de vezes maior.

## Como funciona

1. **Exporte do Lattes.** Ferramentas › Exportar baixa o `CV_<id>.zip`.
2. **Abra no app** e escolha o arquivo, ou solte-o na janela.
3. **Edite.** O menu lateral leva às seções; <kbd>⌘K</kbd> (<kbd>Ctrl</kbd>+<kbd>K</kbd>
   fora do Mac) acha qualquer seção, grupo ou tipo de item. Cada edição fica
   salva no app.
4. **Leve ao Lattes.** Produções novas entram pelo Importar do próprio
   Lattes, com o arquivo que o app gera. O resto vai pela extensão da ponte
   ou, sem ela, campo a campo, com o valor antigo e o novo lado a lado.
   Depois, exporte de novo e use "Recarregar do Lattes": o que já chegou lá
   sai da lista.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/ir-para-escuro.jpg" />
  <img src="docs/img/ir-para-claro.jpg" alt="A busca do ⌘K aberta com o termo artigo, listando seções e tipos de item novo." />
</picture>

Para cadastrar uma produção, use **+** ao lado da busca. Colar um DOI preenche
o formulário pelo Crossref.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/novo-item-escuro.jpg" />
  <img src="docs/img/novo-item-claro.jpg" alt="O modal Novo item de produção com a busca de tipos e os tipos mais usados." />
</picture>

Também dá para imprimir ou salvar em PDF nas regras da NBR 14724, com
referências na NBR 6023, e compartilhar o currículo por um código QR.

## Privacidade

Não há servidor nem conta. O currículo é lido e guardado no próprio
computador, e o arquivo salvo vai para o seu disco. Saem dele só a busca do
DOI no Crossref, quando você pede, e a foto do perfil, buscada no CNPq.

Em Dados gerais, documentos, nascimento, filiação e endereço ficam
mascarados até você clicar no olho, ao lado do título.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/dados-gerais-escuro.jpg" />
  <img src="docs/img/dados-gerais-claro.jpg" alt="Dados gerais com os dados pessoais mascarados." />
</picture>

## Extensão da ponte (em teste)

A extensão para Brave e Chrome envia ao Lattes, na sua própria sessão, as
alterações que de outro jeito se copiam à mão. Cada uma é gravada, lida de
volta e conferida, e a fila para no primeiro problema. Nenhuma senha passa
pela extensão nem pelo app. Hoje ela leva o resumo e campos do vínculo de uma
atuação; os idiomas ainda estão em teste.

O app e a extensão conversam por mensagens nativas do navegador: ao abrir,
o app se registra no Chrome, no Brave, no Edge e no Chromium. Enquanto a
extensão não está na Chrome Web Store, instale assim:

1. Baixe `lattes-editor-extensao.zip` da página do lançamento e descompacte.
2. Em `brave://extensions` (ou `chrome://extensions`), ligue o "Modo do
   desenvolvedor" e use "Carregar sem compactação" na pasta.
3. Com o currículo aberto no Lattes numa aba, "Levar ao Lattes" no app passa
   a oferecer o envio pela extensão.

O que a extensão lê e envia está em
[`docs/politica_de_privacidade_extensao.md`](docs/politica_de_privacidade_extensao.md).

## Desenvolvimento

```bash
pnpm install
pnpm desktop:dev          # o app, com recarga ao vivo e o selo DEV no ícone (precisa de Rust)
pnpm dev                  # só a página do editor, no navegador
pnpm dev:exemplo          # o editor já aberto com o currículo sintético completo
pnpm test                 # testes (pnpm test:coverage com o limite de 80%)
pnpm build:extension      # a extensão em dist-extension/
pnpm capture:screenshots  # refaz as imagens deste README
```

O app usa Tauri 2 e precisa do Rust e, no macOS, das ferramentas de linha de
comando do Xcode. As imagens em `docs/img/` e `site/img/` saem sempre do
currículo sintético em `fixtures/`, nunca de um real. Para testar com uma
exportação sua, ponha o `CV_<id>.zip` em `fixtures/real/`, que está no
`.gitignore`.

`pnpm dev:exemplo` abre o editor na porta 5199 com `fixtures/synthetic_full.xml`,
que preenche todas as seções. Cada porta tem o próprio armazenamento no
navegador, então o currículo aberto no `pnpm dev` (porta 5173) não é tocado.
Para recomeçar do exemplo, feche o arquivo no editor e recarregue a página.

Os scripts `pnpm gen:schema`, `pnpm gen:fixtures` e `pnpm validate:fixtures`
geram o modelo a partir do XSD do Lattes e validam as fixtures.

## Lançamentos

Cada push na `main` passa pelo CI. Com ele verde, o semantic-release decide a
versão pelos commits (`feat` sobe a menor; `fix`, `perf` e `refactor`, a
correção), atualiza o `CHANGELOG.md`, cria a tag e publica a página do
lançamento. Em seguida o app é montado nos três sistemas e os instaladores
entram na mesma página.

## Documentação

- [`ROADMAP.md`](ROADMAP.md): o que vem a seguir
- [`CHANGELOG.md`](CHANGELOG.md): o que mudou
- [`docs/lattes_internals.md`](docs/lattes_internals.md): como o editor do
  Lattes funciona por dentro, base da ponte
- [`docs/estilo_da_interface.md`](docs/estilo_da_interface.md): referência
  visual e regras de interface
- [`docs/lattes_implementation_guide.md`](docs/lattes_implementation_guide.md)
  e [`docs/lattes_product_requirements.md`](docs/lattes_product_requirements.md):
  decisões e pesquisa de produto
- [`docs/extensao_chrome_web_store.md`](docs/extensao_chrome_web_store.md):
  o que falta para publicar a extensão
- [`brand/`](brand/): o símbolo, a assinatura e os ícones de cada sistema,
  com a grade de construção e os scripts que os geram (`brand/LEIA-ME.txt`)
- [`AGENTS.md`](AGENTS.md): regras para quem contribui

## Licença

MIT. A fonte IBM Plex vem sob a SIL Open Font License, em
`src/ui/fonts/LICENSE.txt` e `brand/construction/fonts/LICENSE.txt`.
