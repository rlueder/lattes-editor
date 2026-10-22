# Documentação

Tudo aqui descreve o editor como ele é hoje. O porquê das decisões antigas
fica no histórico do git e nos tickets do Linear (time LattesEditor).

## Para quem desenvolve

| Arquivo                                            | O que tem                                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [`arquitetura.md`](arquitetura.md)                 | Como as peças se encaixam: a árvore XML, o schema gerado, o banco cifrado, o caminho até o Lattes               |
| [`desenvolvimento.md`](desenvolvimento.md)         | Rodar, testar, geradores, vigias, canal Dev, lançar uma versão, a página do projeto                             |
| [`lattes_internals.md`](lattes_internals.md)       | O editor web do Lattes por dentro, seção por seção: formulários, Exportar, Importar, buscas, exclusão           |
| [`campos_tipados.md`](campos_tipados.md)           | Cada atributo do schema pelo controle que merece (gerado por `node scripts/inventario-campos.ts --md`)          |
| [`inclusao_por_tipo.md`](inclusao_por_tipo.md)     | Cada tipo de item de lista e como um item novo chega ao Lattes (conferido por `tests/create-inventory.test.ts`) |
| [`estilo_da_interface.md`](estilo_da_interface.md) | A escala da interface, o texto de leitura, a ordem dos campos, o modo foco, o teclado                           |
| [`fluxos_de_uso.md`](fluxos_de_uso.md)             | Os quatro estados de uma alteração, o que o app faz sozinho e três jeitos de usar                               |
| [`../AGENTS.md`](../AGENTS.md)                     | Regras para quem contribui (pessoas e agentes de código)                                                        |

## Extensão

| Arquivo                                                        | O que tem                                                                                |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`extensao_chrome_web_store.md`](extensao_chrome_web_store.md) | A extensão frente às regras da loja, o que falta publicar e os textos do painel          |
| `../site/privacidade.html`                                     | A política de privacidade, publicada em rlueder.github.io/lattes-editor/privacidade.html |

## Dados do Lattes

- [`lattes-formularios/`](lattes-formularios/README.md): o censo dos
  formulários do Lattes (campos, opções e ligação com o XML), o relatório de
  cobertura, como capturar e a passada de itens de teste.
- [`lattes-listas/`](lattes-listas/): a captura das listas dos formulários,
  fonte de `src/schema/listas-lattes.json`.
- [`img/loja/`](img/loja/): as imagens da Chrome Web Store, do currículo
  sintético. As do README e do site ficam em `site/img/`.

## Outros

- [`../ROADMAP.md`](../ROADMAP.md): o que vem a seguir.
- [`../CHANGELOG.md`](../CHANGELOG.md): o que mudou em cada versão, gerado
  pelo semantic-release.
- [`../scripts/lattes-simulado/README.md`](../scripts/lattes-simulado/README.md):
  o Lattes simulado, procedimento por procedimento.
- [`../brand/`](../brand/): o símbolo, a assinatura e os ícones
  (`brand/LEIA-ME.txt`).
