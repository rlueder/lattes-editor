# Extensão: requisitos da Chrome Web Store

A extensão do conector frente às regras de publicação da Chrome Web Store
(políticas do programa e imagens da página, conferidas em 11/10/2026), o que
falta para publicar e os textos do painel do desenvolvedor.

## Já atende

| Regra                                       | Como                                                                                                                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manifest V3, sem código remoto              | Todo o código vai no pacote.                                                                                                                                                                                    |
| Permissões no mínimo                        | Só `https://wwws.cnpq.br/*` como host; `scripting`, `sidePanel`, `storage`, `nativeMessaging` (falar com o app), `alarms` (refazer essa ligação) e `offscreen` (ler o tema do navegador para o ícone da barra). |
| Propósito único                             | Ligar o LattesEditor ao Lattes da própria pessoa, na sessão que ela abriu.                                                                                                                                      |
| Ícone 128 × 128 PNG, arte em 96 × 96        | `extension/icons/`, gerado de `brand/`, também 16, 32 e 48.                                                                                                                                                     |
| Gravar só com confirmação de quem usa       | Cada rodada parte de "Enviar ao Lattes" no editor, depois da revisão; a fila para no primeiro problema e pausa a cada 20 gravações.                                                                             |
| Credenciais protegidas                      | Nenhuma senha passa pela extensão; ela usa a sessão já aberta.                                                                                                                                                  |
| Política de privacidade com Uso Limitado    | https://rlueder.github.io/lattes-editor/privacidade.html (fonte em `site/privacidade.html`).                                                                                                                    |
| Aviso e consentimento antes do primeiro uso | Na instalação, o painel abre numa aba com o que a extensão lê e envia. Até o "ok" (`extension/src/consent.ts`), o service worker recusa verificar, aplicar e ler o currículo.                                   |
| Pacote sem a chave do manifest              | `pnpm build:extension:loja` monta `dist-extension-loja/`; cada lançamento anexa `lattes-editor-extensao-loja.zip`.                                                                                              |
| Imagens da página                           | `img/loja/`, de `pnpm capture:store`, com o painel de verdade e dados fictícios: `promo-440x280.jpg`, `fila-1280x800.jpg`, `aviso-1280x800.jpg`.                                                                |

## Falta, no painel do desenvolvedor

- [ ] Conta de desenvolvedor na Chrome Web Store (taxa única de US$ 5).
- [ ] Primeiro envio do `lattes-editor-extensao-loja.zip` como rascunho. A
      loja mostra o ID da extensão ao criar o item, antes da revisão.
- [ ] O ID da loja em `EXTENSION_IDS` (`src-tauri/src/conector.rs`), ao lado
      do de desenvolvimento (`elkaiefkldcngjdgelfjhjbljefbemac`), num
      lançamento do app antes de a extensão ser publicada.
- [ ] Preencher a página e a aba de privacidade com os textos abaixo e mandar
      para revisão.

## Textos para o painel

**Nome:** LattesEditor: Conector (do manifest).

**Resumo** (do manifest, até 132 caracteres): Envia ao Lattes as alterações
feitas no Editor do Currículo Lattes, a partir da sua própria sessão.

**Categoria:** Produtividade › Ferramentas. **Idioma:** português (Brasil).
**Site:** https://rlueder.github.io/lattes-editor/ **Suporte:**
https://github.com/rlueder/lattes-editor/issues

**Descrição:**

```text
O conector liga o LattesEditor, o editor gratuito e de código aberto do Currículo Lattes para macOS, Windows e Linux, ao seu currículo no Lattes: traz o currículo para o editor e leva de volta o que você mudou.

Como funciona:
1. Com o Lattes aberto numa aba do navegador, o LattesEditor abre o seu currículo pelo conector, sem baixar nem escolher arquivo.
2. Depois de editar, abra "Enviar ao Lattes" no editor, revise cada alteração e confirme.
3. Cada alteração é gravada na sua sessão, lida de volta e conferida antes da próxima. Se algo não bater, a fila para.

O conector grava resumo, idiomas, endereço, identificação, formação, vínculos e atividades de atuação, eventos, prêmios, formação complementar, patentes e registros, orientações, projetos e os campos das produções que o formulário do Lattes tem. Produções novas vão pelo Importar do próprio Lattes, com o arquivo que o editor gera.

Antes de cada envio, a extensão confere se os formulários do Lattes continuam como ela espera e para se o CNPq mudou alguma coisa. Ela não faz login nem vê a sua senha: só age na sessão que você abriu.

Os dados vão só para o Lattes e para o app LattesEditor no seu computador. Não há servidor nem estatística de uso.

Política de privacidade: https://rlueder.github.io/lattes-editor/privacidade.html
Código: https://github.com/rlueder/lattes-editor

Projeto independente, sem vínculo com o CNPq.
```

### Aba "Privacidade"

**Finalidade única:** ligar o LattesEditor ao Currículo Lattes da própria
pessoa, na sessão que ela abriu: trazer o currículo para o editor e levar de
volta as alterações feitas nele, conferindo cada uma depois de gravada.

| Permissão                       | Justificativa                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `https://wwws.cnpq.br/*` (host) | Ler os formulários e o menu do currículo na sessão aberta, pedir o arquivo do "Exportar", gravar as alterações confirmadas e ler de volta para conferir. Nenhum outro domínio. |
| `scripting`                     | Rodar, na aba do Lattes, o código que lê e envia os formulários, porque as requisições precisam sair da sessão da pessoa.                                                      |
| `sidePanel`                     | Mostrar a fila de alterações e o resultado de cada uma ao lado do Lattes.                                                                                                      |
| `storage`                       | Guardar a fila durante a sessão do navegador, o tema do ícone e o registro de que a pessoa aceitou o aviso de uso.                                                             |
| `nativeMessaging`               | Receber a fila do app LattesEditor instalado no computador e devolver o resultado. A conversa não sai da máquina.                                                              |
| `alarms`                        | Refazer a ligação com o app quando ele é aberto depois do navegador.                                                                                                           |
| `offscreen`                     | Um documento sem janela que só lê o tema do navegador (`matchMedia`), para o ícone da barra ser branco nas barras escuras e grafite nas claras.                                |

**Código remoto:** não. **Uso de dados:** informações de identificação
pessoal, sim (o código do currículo e os dados dos formulários); conteúdo do
site, sim (os formulários do Lattes, lidos na sessão); todas as outras
categorias, não. **Declarações:** marcar as três (não vendo nem transfiro
dados a terceiros fora dos casos permitidos; não uso dados para fins alheios
à finalidade única; não uso dados para avaliar crédito). **URL da política:**
https://rlueder.github.io/lattes-editor/privacidade.html

## Risco fora das regras da loja

Os Termos de Uso do Lattes (Portaria CNPq 976/2022) vedam automação sem
autorização. A decisão de seguir com o conector (11/10/2026) é que ele só age
dentro de uma sessão que a própria pessoa abriu, uma alteração por vez, lida
de volta: não contorna login nem credencial, que é o que a política da loja
proíbe. O nome usa "Lattes" para dizer com o que a extensão trabalha, e a
descrição termina com "Projeto independente, sem vínculo com o CNPq", como a
página do projeto, para não parecer produto do CNPq.
