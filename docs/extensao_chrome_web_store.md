# Extensão: requisitos da Chrome Web Store

Situação da extensão da ponte frente às regras de publicação da Chrome Web
Store. Fontes, conferidas em 11/10/2026:

- Políticas do programa:
  https://developer.chrome.com/docs/webstore/program-policies/policies
- Imagens da página da extensão:
  https://developer.chrome.com/docs/webstore/images

## Já atende

| Regra                                                     | Como                                                                                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Manifest V3, sem código remoto                            | Todo o código vai no pacote; nada é baixado e executado.                                                                    |
| Permissões no mínimo necessário                           | Só `https://wwws.cnpq.br/*` como host; `scripting`, `sidePanel` e `storage`. Saíram `tabs`, `buscatextual` e `servicosweb`. |
| Propósito único e fácil de entender                       | Enviar ao Lattes, da sessão da própria pessoa, as alterações feitas no editor.                                              |
| Ícone 128 × 128 PNG no pacote, arte em 96 × 96 com margem | `extension/icons/` (provisório, até existir o logo), também 16, 32 e 48.                                                    |
| Enviar só com confirmação de quem usa                     | Cada envio parte de um clique em "Aplicar"; a fila para no primeiro problema.                                               |
| Credenciais protegidas                                    | Nenhuma senha passa pela extensão; ela usa a sessão já aberta no navegador.                                                 |

## Falta antes de publicar

- **Política de privacidade publicada num site** e com o link no painel do
  desenvolvedor. O rascunho está em `docs/politica_de_privacidade_extensao.md`;
  falta a página (GitHub Pages).
- **Declaração de uso limitado** ("Limited Use") no mesmo site.
- **Aviso e consentimento antes do primeiro uso**, na própria extensão:
  dizer o que ela lê e envia e pedir um "ok" explícito. Hoje o painel
  explica, mas não pede consentimento.
- **Imagens da página na loja:** imagem promocional pequena de 440 × 280
  (obrigatória), de 1 a 5 capturas de 1280 × 800 ou 640 × 400, e, se quiser
  destaque, a de 1400 × 560.
- **Domínio do editor publicado** nos `matches` do script de conteúdo; hoje só
  `localhost`.
- **Formulário de práticas de dados** no painel do desenvolvedor, coerente
  com a política de privacidade.

## Risco fora das regras da loja

Os Termos de Uso do Lattes vedam automação sem autorização
(ver `docs/lattes_product_requirements.md`, seção 4). A decisão de seguir
com a ponte (Modelo C) está registrada lá. A política da loja também proíbe
"contornar restrições de login"; a ponte não faz isso, porque só age dentro
de uma sessão que a própria pessoa abriu.
