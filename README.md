# LattesEditor

Um editor para o Currículo Lattes que roda no seu computador. O currículo
abre direto do Lattes, você edita aqui com busca, atalhos e formulários que
não se perdem, e o app leva as mudanças de volta ao Lattes. A página do
projeto fica em
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
primeira abertura; abra os detalhes do aviso e escolha executar. No Linux, o
`.deb` usa o WebKitGTK do sistema; o AppImage leva o próprio e por isso é bem
maior.

O app se atualiza sozinho. Ao abrir e a cada 15 minutos, ele confere se saiu
versão nova; se saiu, um aviso no canto oferece "Atualizar", e o app baixa o
pacote, confere a assinatura e reinicia. Para conferir na hora, use "Verificar
atualizações" no menu ⚙.

## Como funciona

1. **Instale a extensão do conector** no Chrome ou no Brave (ver abaixo) e
   entre no Lattes como sempre.
2. **Abra o app.** Ele pede ao Lattes, na sua sessão, a mesma exportação do
   "Exportar" e abre o currículo sozinho. Sem a extensão, exporte no Lattes
   (Ferramentas › Exportar) e solte o `CV_<id>.zip` na janela.
3. **Edite.** O menu lateral leva às seções, e <kbd>⌘K</kbd>
   (<kbd>Ctrl</kbd>+<kbd>K</kbd> fora do Mac) acha qualquer seção, grupo ou tipo
   de item. Os campos que no Lattes são listas (país, idioma, natureza e forma
   de participação) são listas aqui também. Com a extensão ligada, a área do
   conhecimento vira a tabela de áreas do Lattes, e na formação acadêmica a
   instituição sai da busca do Lattes, o curso da lista da instituição e a
   agência de fomento da lista de agências. O app guarda uma cópia das áreas e
   das agências; sem cópia e sem extensão, esses campos continuam texto livre.
   Cada edição fica salva no app.
4. **Envie ao Lattes.** O painel "Enviar ao Lattes" mostra cada alteração e
   como ela vai: produções novas pelo Importar do próprio Lattes, com o
   arquivo que o app gera; o resumo, os vínculos de atuação, a foto e as
   alterações em eventos de que você participou como ouvinte pela extensão,
   gravados e conferidos um a um (os idiomas ainda em teste); o resto campo a campo, com o valor antigo e
   o novo lado a lado. A aba "Enviado" guarda o que já foi, com o antes e o
   depois, e deixa desfazer.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/ir-para-escuro.jpg" />
  <img src="docs/img/ir-para-claro.jpg" alt="A busca do ⌘K aberta com o termo artigo, listando seções e tipos de item novo." />
</picture>

Para cadastrar uma produção, use **+** ao lado da busca. Colar um DOI
preenche o formulário pelo Crossref. Formação acadêmica (escolhendo o nível,
como no Lattes), atuação profissional, projeto e patente se criam pelo botão
da própria seção. Como o Importar do Lattes não lê essas seções, o item novo
entra na lista de alterações do painel "Enviar ao Lattes", para cadastrar à
mão com os valores ao lado.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/novo-item-escuro.jpg" />
  <img src="docs/img/novo-item-claro.jpg" alt="O modal Novo item de produção com a busca de tipos e os tipos mais usados." />
</picture>

Cada exportação aberta vira uma versão, e o app diz o que mudou desde a
anterior ("Versões do Lattes", no ⚙), inclusive o que foi editado direto no
Lattes. O **Diagnóstico do currículo** mostra a data da última publicação e o
que mudou no Lattes desde a exportação. A **Validação do currículo**, também
no ⚙, confere o currículo inteiro de uma vez, item por item: campos
obrigatórios, valores fora das listas do Lattes, anos, autores, DOI e ISSN,
duplicatas e vínculos antigos ainda marcados como atuais. Só aponta; nada
muda sem você.

Também dá para imprimir ou salvar em PDF nas regras da NBR 14724, com
referências na NBR 6023, e compartilhar o currículo por um código QR.

## Privacidade

Não há servidor nem conta. O currículo é lido e guardado no próprio
computador. Saem dele só a busca do DOI no Crossref, quando você pede, e a
foto do perfil, buscada no CNPq. O que vai ao Lattes vai pela sua própria
sessão, no seu navegador.

O que o app guarda entre uma sessão e outra fica cifrado com AES-GCM, com a
chave no chaveiro do sistema (Keychain no macOS, Gerenciador de Credenciais no
Windows, Secret Service no Linux). Sem chaveiro, o app avisa e não guarda nada
naquela sessão, em vez de deixar o currículo legível no disco. Se a chave
some, os dados guardados não podem mais ser lidos, e o app oferece começar de
novo a partir do Lattes.

Em Dados gerais, documentos, nascimento, filiação e endereço ficam mascarados
até você clicar no olho, ao lado do título.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/dados-gerais-escuro.jpg" />
  <img src="docs/img/dados-gerais-claro.jpg" alt="Dados gerais com os dados pessoais mascarados." />
</picture>

## Extensão do conector

A extensão para Chrome e Brave é o que deixa o app abrir o currículo do Lattes
e enviar as alterações direto ao Lattes. Ela trabalha na aba do Lattes em que
você já está logado; nenhuma senha passa por ela nem pelo app. Cada alteração
é gravada, lida de volta e conferida, e a fila para no primeiro problema.

Enquanto a extensão não está na Chrome Web Store, instale assim:

1. Baixe `lattes-editor-extensao.zip` da
   [página do último lançamento](https://github.com/rlueder/lattes-editor/releases/latest)
   e descompacte.
2. Em `chrome://extensions` (ou `brave://extensions`), ligue o "Modo do
   desenvolvedor" e use "Carregar sem compactação" na pasta.
3. No primeiro uso, o painel da extensão mostra o que ela lê e envia e pede um
   "ok"; sem ele, ela não toca no Lattes.

Extensão carregada assim não se atualiza sozinha: quando o app avisa que ela
está desatualizada, troque a pasta pela do zip novo e clique em recarregar.

O que o conector grava fica pendente no Lattes até você clicar em "Enviar ao
CNPq", e o Lattes não mostra nem descarta essas pendências. Por isso o app
guarda o registro do que foi gravado, com o valor de antes e o de depois, e
pode desfazer. O que a extensão lê e envia está na
[política de privacidade da extensão](https://rlueder.github.io/lattes-editor/privacidade.html).

## Documentação

- [`docs/README.md`](docs/README.md): o índice de tudo, com o que é atual e o
  que é histórico
- [`docs/arquitetura.md`](docs/arquitetura.md): como as peças se encaixam
- [`docs/desenvolvimento.md`](docs/desenvolvimento.md): rodar, testar, canal
  Dev e como lançar uma versão
- [`ROADMAP.md`](ROADMAP.md) e [`CHANGELOG.md`](CHANGELOG.md): o que vem e o que
  mudou

## Licença

MIT. A fonte IBM Plex vem sob a SIL Open Font License, em
`src/ui/fonts/LICENSE.txt` e `brand/construction/fonts/LICENSE.txt`.
