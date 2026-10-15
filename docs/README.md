# Documentação

O que está em cada arquivo. **Atual** descreve o editor como ele é hoje;
**histórico** é o plano ou a pesquisa de quando a decisão foi tomada, e vale
pelo porquê, não pelo estado atual.

## Para quem desenvolve

| Arquivo                                            | O que tem                                                                                                                          | Estado |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------ |
| [`arquitetura.md`](arquitetura.md)                 | Como as peças se encaixam: o currículo como árvore XML, o schema gerado, o banco cifrado, o caminho até o Lattes, o mapa do código | Atual  |
| [`desenvolvimento.md`](desenvolvimento.md)         | Rodar, testar, geradores, vigias, canal Dev e como lançar uma versão                                                               | Atual  |
| [`lattes_internals.md`](lattes_internals.md)       | Como o editor web do Lattes funciona por dentro: menu, formulários, Exportar, Importar, foto, exclusão. A base do conector         | Atual  |
| [`campos_tipados.md`](campos_tipados.md)           | Cada atributo do schema classificado pelo controle que merece, e as listas do Lattes já tipadas                                    | Atual  |
| [`inclusao_por_tipo.md`](inclusao_por_tipo.md)     | Cada tipo de item de lista, como um item novo chega ao Lattes hoje e o formulário de inclusão que o censo conhece (LAT-57)         | Atual  |
| [`estilo_da_interface.md`](estilo_da_interface.md) | Referência visual e regras de interface                                                                                            | Atual  |
| [`fluxos_de_uso.md`](fluxos_de_uso.md)             | Como três tipos de pessoa usam o editor e o que ele faz sozinho por elas                                                           | Atual  |
| [`../AGENTS.md`](../AGENTS.md)                     | Regras para quem contribui (pessoas e agentes de código)                                                                           | Atual  |

## Extensão e Chrome Web Store

| Arquivo                                                                      | O que tem                                                  | Estado |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| [`extensao_chrome_web_store.md`](extensao_chrome_web_store.md)               | A extensão frente às regras da loja e o que falta publicar | Atual  |
| [`politica_de_privacidade_extensao.md`](politica_de_privacidade_extensao.md) | Onde está a política publicada (`site/privacidade.html`)   | Atual  |

## Planos e pesquisa

| Arquivo                                                              | O que tem                                                                                                                         | Estado    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------- |
| [`lattes_implementation_guide.md`](lattes_implementation_guide.md)   | O guia da primeira versão (10/10/2026): decisões, contrato do Importar, marcos. A seção 1 registra as decisões que mudaram depois | Histórico |
| [`lattes_product_requirements.md`](lattes_product_requirements.md)   | Requisitos de produto e resumo da pesquisa de UX, concorrência, aspectos jurídicos e do schema                                    | Histórico |
| [`lattes_editor_reconnaissance.md`](lattes_editor_reconnaissance.md) | O primeiro reconhecimento do editor web do Lattes (10/10/2026); o detalhe atual está em `lattes_internals.md`                     | Histórico |
| [`pesquisa_recursos_de_ia.md`](pesquisa_recursos_de_ia.md)           | Recursos de revisão e preenchimento assistidos, com custos e modelos (11/10/2026)                                                 | Histórico |

## Outros

- [`../ROADMAP.md`](../ROADMAP.md): o que vem a seguir. O estado de cada ticket fica no Linear (time LattesEditor).
- [`../CHANGELOG.md`](../CHANGELOG.md): o que mudou em cada versão, gerado pelo semantic-release.
- [`lattes-listas/`](lattes-listas/): a captura das listas dos formulários do Lattes, fonte de `src/schema/listas-lattes.json`.
- [`lattes-formularios/`](lattes-formularios/): o censo dos formulários do Lattes (campos, opções e ligação com o XML), com o relatório de cobertura, como capturar e o que falta recapturar.
- [`lattes_maximal_skeleton.xml`](lattes_maximal_skeleton.xml): esqueleto anotado com todos os elementos e atributos possíveis, do XSD, do DTD e de uma exportação real. É referência para leitura, não um XML válido.
- [`img/`](img/): as imagens do README e da loja, sempre do currículo sintético.
- [`../brand/`](../brand/): o símbolo, a assinatura e os ícones, com a grade de construção (`brand/LEIA-ME.txt`).
