# Extensão: requisitos da Chrome Web Store

Situação da extensão do conector frente às regras de publicação da Chrome Web
Store. Fontes, conferidas em 11/10/2026:

- Políticas do programa:
  https://developer.chrome.com/docs/webstore/program-policies/policies
- Imagens da página da extensão:
  https://developer.chrome.com/docs/webstore/images

## Já atende

| Regra                                                     | Como                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manifest V3, sem código remoto                            | Todo o código vai no pacote; nada é baixado e executado.                                                                                                                                                                                                                  |
| Permissões no mínimo necessário                           | Só `https://wwws.cnpq.br/*` como host; `scripting`, `sidePanel`, `storage`, `nativeMessaging` (falar com o app de desktop), `alarms` (refazer essa ligação) e `offscreen` (ler o tema do navegador para o ícone da barra). Saíram `tabs`, `buscatextual` e `servicosweb`. |
| Propósito único e fácil de entender                       | Enviar ao Lattes, da sessão da própria pessoa, as alterações feitas no editor.                                                                                                                                                                                            |
| Ícone 128 × 128 PNG no pacote, arte em 96 × 96 com margem | `extension/icons/`, gerado de `brand/`, também 16, 32 e 48.                                                                                                                                                                                                               |
| Enviar só com confirmação de quem usa                     | Cada envio parte de um clique em "Aplicar"; a fila para no primeiro problema.                                                                                                                                                                                             |
| Credenciais protegidas                                    | Nenhuma senha passa pela extensão; ela usa a sessão já aberta no navegador.                                                                                                                                                                                               |

## Feito para a publicação

- **Política de privacidade publicada**, com a declaração de Uso Limitado:
  https://rlueder.github.io/lattes-editor/privacidade.html (fonte em
  `site/privacidade.html`, link no rodapé da página do projeto).
- **Aviso e consentimento antes do primeiro uso.** Na instalação, o painel
  abre numa aba com o aviso do que a extensão lê e envia. Até o "ok"
  (`extension/src/consent.ts`), ela não lê nem grava nada no Lattes: o
  service worker recusa verificar, aplicar e ler o código do currículo.
- **Pacote para a loja sem a chave do manifest.** `pnpm build:extension:loja`
  monta em `dist-extension-loja/`; cada lançamento anexa
  `lattes-editor-extensao-loja.zip`.
- **Imagens da página na loja**, em `docs/img/loja/`, geradas por
  `pnpm capture:store` com o painel de verdade e dados fictícios:
  `promo-440x280.jpg` (imagem promocional pequena), `fila-1280x800.jpg` e
  `aviso-1280x800.jpg` (capturas).

## Falta, no painel do desenvolvedor

- **Conta de desenvolvedor** na Chrome Web Store (taxa única de US$ 5),
  separada da conta do Google Play.
- **Primeiro envio** do `lattes-editor-extensao-loja.zip` como rascunho. A
  loja mostra o ID da extensão logo ao criar o item, antes da revisão.
- **ID da loja no app.** A extensão fala com o app de desktop por mensagens
  nativas, e o app só aceita as extensões listadas em `EXTENSION_IDS`
  (`src-tauri/src/conector.rs`). Hoje está lá o ID de desenvolvimento, fixado
  pela chave pública do manifest (`elkaiefkldcngjdgelfjhjbljefbemac`). O ID
  da loja entra na lista, ao lado dele, e sai num lançamento do app antes de
  a extensão ser publicada.
- **Preencher a página e as abas de privacidade** com os textos abaixo, e
  mandar para revisão.

## Textos para o painel

**Nome:** LattesEditor: Conector (vem do manifest)

**Resumo** (vem do manifest, até 132 caracteres): Envia ao Lattes as
alterações feitas no Editor do Currículo Lattes, a partir da sua própria
sessão.

**Categoria:** Produtividade › Ferramentas. **Idioma:** português (Brasil).

**Descrição:**

```text
O conector liga o LattesEditor, o editor gratuito e de código aberto do Currículo Lattes para macOS, Windows e Linux, ao seu currículo no Lattes: traz o currículo para o editor e leva de volta o que você mudou.

Como funciona:
1. Com o Lattes aberto numa aba do navegador, o LattesEditor abre o seu currículo pelo conector, sem baixar nem escolher arquivo.
2. Depois de editar, abra "Levar ao Lattes" no editor e clique em "Aplicar" no painel do conector.
3. Cada alteração é gravada na sua sessão, lida de volta e conferida antes da próxima. Se algo não bater, a fila para.

Hoje o conector grava o resumo, os idiomas e os vínculos de atuação. O resto você leva pelo Importar do próprio Lattes, com o arquivo que o editor gera.

Antes de cada envio, a extensão confere se os formulários do Lattes continuam como ela espera e para se o CNPq mudou alguma coisa. Ela não faz login nem vê a sua senha: só age na sessão que você abriu.

Os dados vão só para o Lattes e para o app LattesEditor no seu computador. Não há servidor nem estatística de uso.

Política de privacidade: https://rlueder.github.io/lattes-editor/privacidade.html
Código: https://github.com/rlueder/lattes-editor

Projeto independente, sem vínculo com o CNPq.
```

**Site:** https://rlueder.github.io/lattes-editor/ · **Suporte:**
https://github.com/rlueder/lattes-editor/issues

### Aba "Privacidade"

**Finalidade única:** ligar o LattesEditor ao Currículo Lattes da própria
pessoa, na sessão que ela abriu: trazer o currículo para o editor e levar de
volta as alterações feitas nele, conferindo cada uma depois de gravada.

**Justificativa das permissões:**

| Permissão                       | Justificativa                                                                                                                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://wwws.cnpq.br/*` (host) | Ler os formulários e o menu do currículo na sessão aberta, pedir o mesmo arquivo do "Exportar" para o editor abrir, gravar as alterações confirmadas e ler de volta para conferir. Nenhum outro domínio. |
| `scripting`                     | Rodar, na aba do Lattes, o código que lê e envia os formulários, porque as requisições precisam sair da sessão da pessoa.                                                                                |
| `sidePanel`                     | Mostrar a fila de alterações e o resultado de cada uma ao lado do Lattes.                                                                                                                                |
| `storage`                       | Guardar a fila durante a sessão do navegador, o tema do ícone da barra e o registro de que a pessoa aceitou o aviso de uso.                                                                              |
| `nativeMessaging`               | Receber a fila do app LattesEditor instalado no computador e devolver o resultado de cada alteração. A conversa não sai da máquina.                                                                      |
| `alarms`                        | Refazer a ligação com o app quando ele é aberto depois do navegador.                                                                                                                                     |
| `offscreen`                     | Abrir um documento sem janela que só lê o tema do navegador (`matchMedia`), para o ícone da barra ser branco nas barras escuras e grafite nas claras.                                                    |

**Código remoto:** não. Todo o código vai no pacote.

**Uso de dados** (marcar):

- Informações de identificação pessoal: sim (o código do currículo e os
  dados dos formulários do currículo).
- Conteúdo do site: sim (os formulários do Lattes, lidos na sessão).
- Todas as outras categorias: não.

**Declarações** (marcar as três): não vendo nem transfiro dados a
terceiros fora dos casos permitidos; não uso nem transfiro dados para fins
alheios à finalidade única; não uso nem transfiro dados para avaliar crédito
ou conceder empréstimos.

**URL da política de privacidade:**
https://rlueder.github.io/lattes-editor/privacidade.html

## Risco fora das regras da loja

Os Termos de Uso do Lattes vedam automação sem autorização
(ver `docs/lattes_product_requirements.md`, seção 4). A decisão de seguir
com o conector (Modelo C) está registrada lá. A política da loja também proíbe
"contornar restrições de login"; o conector não faz isso, porque só age dentro
de uma sessão que a própria pessoa abriu.

O nome usa "Lattes" para dizer com o que a extensão trabalha. A política da
loja contra nomes enganosos pede que não pareça produto do CNPq; por isso a
descrição termina com "Projeto independente, sem vínculo com o CNPq", como a
página do projeto.
