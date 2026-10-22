# Changelog

## [0.24.0](https://github.com/rlueder/lattes-editor/compare/v0.23.0...v0.24.0) (2026-10-22)

### Novidades

- **forms:** natureza do evento pelo conector, no mesmo item ([#122](https://github.com/rlueder/lattes-editor/issues/122)) ([cee355c](https://github.com/rlueder/lattes-editor/commit/cee355c15dfe664c41070d291d90365c6bb0893c))
- **forms:** pesquisa e desenvolvimento e treinamento pelo conector ([#117](https://github.com/rlueder/lattes-editor/issues/117)) ([c23b7e5](https://github.com/rlueder/lattes-editor/commit/c23b7e542d5f3fc260b5a218140d2fd3b9b64c6e))
- **ui:** compara todas as seções pelas listas do Lattes ([#124](https://github.com/rlueder/lattes-editor/issues/124)) ([3d43bb0](https://github.com/rlueder/lattes-editor/commit/3d43bb04970e0033649b2164ceec50b044a7c70d))
- **ui:** redesenha ícones das seções com a grade da marca ([#126](https://github.com/rlueder/lattes-editor/issues/126)) ([c1e5b72](https://github.com/rlueder/lattes-editor/commit/c1e5b72b63b44f0289b0fda20d34bb02459ec66b))

### Correções

- **forms:** cobertura parte de um valor que o formulário tem ([#118](https://github.com/rlueder/lattes-editor/issues/118)) ([e119efb](https://github.com/rlueder/lattes-editor/commit/e119efb768ec04db68a6c226ae25435606a1b210))
- **forms:** o que o Lattes não deixa alterar conta como campo que ele não tem ([#119](https://github.com/rlueder/lattes-editor/issues/119)) ([0bfd251](https://github.com/rlueder/lattes-editor/commit/0bfd251ab021fc51259b20c3b5cfa4998060f5f9))
- isola formulários Dev em quadros de origem opaca ([#123](https://github.com/rlueder/lattes-editor/issues/123)) ([da9d12f](https://github.com/rlueder/lattes-editor/commit/da9d12fca87bc1f26bc836b80ff5e8c0d1c9fd21))
- limita tráfego ao CNPq e protege gravações locais ([#120](https://github.com/rlueder/lattes-editor/issues/120)) ([e102968](https://github.com/rlueder/lattes-editor/commit/e1029684829fb44bb4c74c5b37661b9b06758ab7))
- **ui:** ajustes de interface e idioma pelo nome na seção Idiomas ([#125](https://github.com/rlueder/lattes-editor/issues/125)) ([57f67f7](https://github.com/rlueder/lattes-editor/commit/57f67f7dd362b4d5e10e483fcabe4b750bb32f1e))
- **ui:** campos de dentro de um filho que só existe de um lado ([#129](https://github.com/rlueder/lattes-editor/issues/129)) ([733048a](https://github.com/rlueder/lattes-editor/commit/733048a2658959301722600059ea1280e7e66457)), closes [#127](https://github.com/rlueder/lattes-editor/issues/127)
- **ui:** item recriado no Lattes não aparece como removido e novo ([#127](https://github.com/rlueder/lattes-editor/issues/127)) ([c3248f6](https://github.com/rlueder/lattes-editor/commit/c3248f62c33e105d7f11141b568cb1105e73114f))
- **ui:** tela de envio com a declaração inteira e os rótulos do idioma ([#121](https://github.com/rlueder/lattes-editor/issues/121)) ([685c59d](https://github.com/rlueder/lattes-editor/commit/685c59d5193b97ff1e7e339780c9fc3d7515bb73))

## [0.23.0](https://github.com/rlueder/lattes-editor/compare/v0.22.0...v0.23.0) (2026-10-21)

### Novidades

- alteração de evento, prêmio e formação complementar pelo conector, desligada (LAT-58) ([#86](https://github.com/rlueder/lattes-editor/issues/86)) ([df8466c](https://github.com/rlueder/lattes-editor/commit/df8466c82ef6986547f966f758dc45d7908a86ee)), closes [#89](https://github.com/rlueder/lattes-editor/issues/89)
- alteração de eventos de ouvinte pelo conector (LAT-51) ([#85](https://github.com/rlueder/lattes-editor/issues/85)) ([981a597](https://github.com/rlueder/lattes-editor/commit/981a5973db93a04b28996babbe8221504e24977e))
- área, instituição, curso e agência como listas do Lattes, lidas pelo conector (LAT-48) ([#76](https://github.com/rlueder/lattes-editor/issues/76)) ([e1a7e88](https://github.com/rlueder/lattes-editor/commit/e1a7e88ee4e42ee0c716f541a4808aec0949f743))
- censo dos formulários do Lattes com relatório de cobertura (LAT-55) ([#82](https://github.com/rlueder/lattes-editor/issues/82)) ([2f5c1ab](https://github.com/rlueder/lattes-editor/commit/2f5c1ab25e1e0c860e83f761d9ba982d52a3fef4))
- **config:** cobertura do conector por campo do editor ([#101](https://github.com/rlueder/lattes-editor/issues/101)) ([4ee616b](https://github.com/rlueder/lattes-editor/commit/4ee616b12b3845d6d1d482b48f09ca71feb6eca4))
- cópias de segurança com ponto zero intocável e ponto de restauração antes do envio ([#96](https://github.com/rlueder/lattes-editor/issues/96)) ([fe1ba85](https://github.com/rlueder/lattes-editor/commit/fe1ba85b1b7388205597e85416f51b67d56d8dfc))
- criar formação, atuação, projeto e patente no editor (LAT-52) ([#75](https://github.com/rlueder/lattes-editor/issues/75)) ([8cae494](https://github.com/rlueder/lattes-editor/commit/8cae4940d89a4a7dc1031b8db5802c6c3ad58d4b))
- criar pelo editor todo tipo de item do Lattes, com inclusão pelo conector atrás de chave (LAT-57) ([#88](https://github.com/rlueder/lattes-editor/issues/88)) ([3f7141c](https://github.com/rlueder/lattes-editor/commit/3f7141c979bdf1805c153fc42badaf2cb337a19d))
- currículo de demonstração crível para gravar o app ([#68](https://github.com/rlueder/lattes-editor/issues/68)) ([3f7e4c7](https://github.com/rlueder/lattes-editor/commit/3f7e4c7dcec766ee7f85683d43f51d1072f37ad0))
- deduplicação ao trazer itens, tela inicial centrada e regras de escrita ([#94](https://github.com/rlueder/lattes-editor/issues/94)) ([0c3a011](https://github.com/rlueder/lattes-editor/commit/0c3a0112ebc1ebf65a2bbf6b262a24608e94c570))
- diagnóstico único, envio ao CNPq e recarregar pela ponte ([#93](https://github.com/rlueder/lattes-editor/issues/93)) ([62c313b](https://github.com/rlueder/lattes-editor/commit/62c313b93287ca75898cece4b10a6353ead56380))
- edição no lugar de participação em eventos pelo conector, atrás de flag (LAT-51) ([#74](https://github.com/rlueder/lattes-editor/issues/74)) ([12742d0](https://github.com/rlueder/lattes-editor/commit/12742d0dcf929e0eef7b25627a0900298fa2b820))
- excluir idioma e vínculo pelo conector, desligado até teste acompanhado (LAT-49) ([#71](https://github.com/rlueder/lattes-editor/issues/71)) ([dfcf752](https://github.com/rlueder/lattes-editor/commit/dfcf752af63f60d918d769540f035e0a17e4b173))
- extensão Dev vem no app e se atualiza com ele ([#63](https://github.com/rlueder/lattes-editor/issues/63)) ([a0097c9](https://github.com/rlueder/lattes-editor/commit/a0097c91e827ce86c37214fba0f7b82331c917fc))
- **forms:** a própria citação nos itens segue a identificação ([#116](https://github.com/rlueder/lattes-editor/issues/116)) ([416ec93](https://github.com/rlueder/lattes-editor/commit/416ec93172aad63ea430da8b07cf09708a9154cb))
- **forms:** buscas da formação complementar e do endereço pelo conector ([#111](https://github.com/rlueder/lattes-editor/issues/111)) ([32cf65e](https://github.com/rlueder/lattes-editor/commit/32cf65e05fc9d55a3f508540565ba775a6eb8dc4))
- **forms:** depositante e histórico de situações da patente pelo conector ([#109](https://github.com/rlueder/lattes-editor/issues/109)) ([f94c477](https://github.com/rlueder/lattes-editor/commit/f94c47781623b4b6201aba748f21780f9240a5ba))
- **forms:** DOI das produções bibliográficas pelo conector ([#107](https://github.com/rlueder/lattes-editor/issues/107)) ([78ec78f](https://github.com/rlueder/lattes-editor/commit/78ec78f208767ab5e193eea8656d54760745c98f))
- **forms:** natureza das outras orientações concluídas pelo conector ([#112](https://github.com/rlueder/lattes-editor/issues/112)) ([4c09e7d](https://github.com/rlueder/lattes-editor/commit/4c09e7daf945b7cf3b53457890fd9a48d078ac2e))
- **forms:** órgão das atividades pela lista de órgãos do Lattes ([#114](https://github.com/rlueder/lattes-editor/issues/114)) ([a060639](https://github.com/rlueder/lattes-editor/commit/a0606394200a0705f485eb1c1510e026225cd7fc)), closes [#106](https://github.com/rlueder/lattes-editor/issues/106)
- **forms:** patentes, registros, atividades, áreas e setores pelo conector, e grades da formação preservadas ([#102](https://github.com/rlueder/lattes-editor/issues/102)) ([0f75eb7](https://github.com/rlueder/lattes-editor/commit/0f75eb728db2a955522aeec5d480e6654aa714a3)), closes [#101](https://github.com/rlueder/lattes-editor/issues/101) [#101](https://github.com/rlueder/lattes-editor/issues/101)
- **forms:** período do ensino e órgão das atividades pelo conector ([#106](https://github.com/rlueder/lattes-editor/issues/106)) ([ad0a7e7](https://github.com/rlueder/lattes-editor/commit/ad0a7e7ac830274bbf7ca1526f8da7194d9f8a17))
- **forms:** projeto com financiadores e ligações vai pelo conector ([#113](https://github.com/rlueder/lattes-editor/issues/113)) ([7e82cb5](https://github.com/rlueder/lattes-editor/commit/7e82cb5150475266f7fd08ef10fe944dc66d2d61))
- freio de escrita, envio em três passos e alteração no lugar de todos os tipos ([#100](https://github.com/rlueder/lattes-editor/issues/100)) ([2977c4e](https://github.com/rlueder/lattes-editor/commit/2977c4ec0f1d6c497f9d4f9164ffbdeac1c6a118))
- importar itens novos pelo conector, passos 1 e 2, desligado (LAT-50) ([#73](https://github.com/rlueder/lattes-editor/issues/73)) ([eccd903](https://github.com/rlueder/lattes-editor/commit/eccd9035141abd47087c1c9ebffbc743850fffb7))
- inclusão de formação e projeto pelo conector, atrás de flag (LAT-52) ([#77](https://github.com/rlueder/lattes-editor/issues/77)) ([31b079a](https://github.com/rlueder/lattes-editor/commit/31b079a36aeb9f6e3e76aacb64deebf97c9e2c0e))
- Lattes simulado para testes de ponta a ponta do conector (LAT-53) ([#79](https://github.com/rlueder/lattes-editor/issues/79)) ([f30be64](https://github.com/rlueder/lattes-editor/commit/f30be64e647bf3cdebf2408f91e984700ac33c58))
- ligar as ações do conector para teste ao vivo ([#91](https://github.com/rlueder/lattes-editor/issues/91)) ([12d2203](https://github.com/rlueder/lattes-editor/commit/12d22039097df9fe49d406274fa191092d587547))
- operações do conector para formação, endereço e identificação (LAT-23) ([#70](https://github.com/rlueder/lattes-editor/issues/70)) ([650f725](https://github.com/rlueder/lattes-editor/commit/650f725e12ca0f4554f99655f405d6b2b05a72d7))
- página do projeto no sistema visual da Precisa ([#97](https://github.com/rlueder/lattes-editor/issues/97)) ([c040e36](https://github.com/rlueder/lattes-editor/commit/c040e3635037122efb89f0663b9d9884daa19fea))
- Panorama, o currículo em números, com filtros de período e de campos faltando ([#95](https://github.com/rlueder/lattes-editor/issues/95)) ([57066e2](https://github.com/rlueder/lattes-editor/commit/57066e2afd9acc44de47711ae7d054c4a8d37b6b))
- registro do enviado em texto e com as tentativas que falharam (LAT-47) ([#59](https://github.com/rlueder/lattes-editor/issues/59)) ([bf23947](https://github.com/rlueder/lattes-editor/commit/bf23947fbcf8135c242c52f06b318687b326a79d))
- sessão do Lattes expirada oferece recarregar a aba ([#67](https://github.com/rlueder/lattes-editor/issues/67)) ([8a06abb](https://github.com/rlueder/lattes-editor/commit/8a06abbe01a38b2befcda6bd00d2c234f0e3a9d7))
- trocar a foto do currículo no Lattes pelo editor ([#61](https://github.com/rlueder/lattes-editor/issues/61)) ([a268a87](https://github.com/rlueder/lattes-editor/commit/a268a8753f3dda929ff6032db89043fde6bf1b79))
- **ui:** modo de leitura como interface do editor ([#81](https://github.com/rlueder/lattes-editor/issues/81)) ([c879ae1](https://github.com/rlueder/lattes-editor/commit/c879ae10e71c80621513ea280b98f912780e75f8))
- verificar atualizações pelo menu de configurações ([#78](https://github.com/rlueder/lattes-editor/issues/78)) ([76e6092](https://github.com/rlueder/lattes-editor/commit/76e60927b45cf8309d5aae58f3b1e2d79e3d5389))
- vigia confere as listas dos campos tipados (LAT-48) ([#58](https://github.com/rlueder/lattes-editor/issues/58)) ([a3f6ee1](https://github.com/rlueder/lattes-editor/commit/a3f6ee1c0e7861868bfb2c52a7c7895ac6e4c8a4))

### Correções

- alteração de evento confere ano, nome e cidade antes de gravar (LAT-58) ([#89](https://github.com/rlueder/lattes-editor/issues/89)) ([2691eec](https://github.com/rlueder/lattes-editor/commit/2691eec9bcde829ea1a2050ae64b6aa091f960a5))
- botões do estado vazio com um tamanho só e sem "Abrir o Lattes" ([#55](https://github.com/rlueder/lattes-editor/issues/55)) ([2e16cc0](https://github.com/rlueder/lattes-editor/commit/2e16cc0233f8d903832bc1103c7908aa23886547))
- conferir atualização a cada 15 min e tentar de novo logo após falha ([#51](https://github.com/rlueder/lattes-editor/issues/51)) ([2c599a9](https://github.com/rlueder/lattes-editor/commit/2c599a9b532f1f473a6c0c3bbeea4dff685a8edf))
- formação e vínculo conferem a identidade por valores antes de gravar (LAT-58) ([#90](https://github.com/rlueder/lattes-editor/issues/90)) ([d5af394](https://github.com/rlueder/lattes-editor/commit/d5af394b058ddf7884dad1ccb9dbf8b203419985))
- **forms:** remoção dos itens de teste só com a marca na página ([#115](https://github.com/rlueder/lattes-editor/issues/115)) ([3c4fd0f](https://github.com/rlueder/lattes-editor/commit/3c4fd0f514a4929284d199ea49490c0640205ce3))
- **forms:** unidade da atividade grava o órgão de cima no simulado ([#110](https://github.com/rlueder/lattes-editor/issues/110)) ([ea0ee01](https://github.com/rlueder/lattes-editor/commit/ea0ee0183d39432c607a6fb9fdcffdd288f0dff1)), closes [#106](https://github.com/rlueder/lattes-editor/issues/106)
- foto do perfil carrega no app de macOS, e fechar o currículo não o reabre ([#69](https://github.com/rlueder/lattes-editor/issues/69)) ([78b111e](https://github.com/rlueder/lattes-editor/commit/78b111e47c4e0f7929dc8b247f1913e627cc9f7c))
- foto do perfil mostra as iniciais até chegar e tenta de novo quando falha ([#54](https://github.com/rlueder/lattes-editor/issues/54)) ([24cb280](https://github.com/rlueder/lattes-editor/commit/24cb2800cde76e263566a7362af330c433cd9e0f))
- montagem da extensão acha os arquivos no Windows ([#65](https://github.com/rlueder/lattes-editor/issues/65)) ([834aad1](https://github.com/rlueder/lattes-editor/commit/834aad1cdb2d728027748c347d4988f17eb5c3c3))
- sessão vencida do Lattes é reconhecida como sessão, não como Lattes mudado ([#66](https://github.com/rlueder/lattes-editor/issues/66)) ([26d67e0](https://github.com/rlueder/lattes-editor/commit/26d67e0dac7c1e4d54f505583febf9c43de7549c)), closes [#160](https://github.com/rlueder/lattes-editor/issues/160)
- tratar o vínculo empregatício do Lattes como inverso da exportação (LAT-56) ([#84](https://github.com/rlueder/lattes-editor/issues/84)) ([a30074f](https://github.com/rlueder/lattes-editor/commit/a30074f5648eb232fb0748dee8d13c99d505dbca))
- **ui:** campo que o formulário do Lattes não tem some do formulário do item ([#108](https://github.com/rlueder/lattes-editor/issues/108)) ([ba37aac](https://github.com/rlueder/lattes-editor/commit/ba37aac824b8fa8700829613925120f5e9e66b5f))
- **ui:** diálogo de trocar a foto mostra a foto atual antes da escolha ([#83](https://github.com/rlueder/lattes-editor/issues/83)) ([2e25da9](https://github.com/rlueder/lattes-editor/commit/2e25da95edfd12c21b01d888b543cdb66e86aead))
- **ui:** endereço legível, grupo ativo, medida do texto e atalhos por ano na leitura ([#87](https://github.com/rlueder/lattes-editor/issues/87)) ([eb05480](https://github.com/rlueder/lattes-editor/commit/eb05480f05303023e4a05ccf2f68b4c19e03a7a7))
- **ui:** lista do envio em colunas, confirmação ao descartar e voltar/avançar no desktop ([#98](https://github.com/rlueder/lattes-editor/issues/98)) ([bd8f151](https://github.com/rlueder/lattes-editor/commit/bd8f15105f6b3ebbd198ecfba00a9f63663c390f))
- verificação confere endereço e identificação inteiros, e espaço no painel ([#99](https://github.com/rlueder/lattes-editor/issues/99)) ([c64d96b](https://github.com/rlueder/lattes-editor/commit/c64d96b3ebd7c55cb90863abc1ebe77d00403566)), closes [#91](https://github.com/rlueder/lattes-editor/issues/91)

## [0.22.0](https://github.com/rlueder/lattes-editor/compare/v0.21.0...v0.22.0) (2026-10-14)

### Novidades

- revisão de interface e painel "Enviar ao Lattes" em abas ([#50](https://github.com/rlueder/lattes-editor/issues/50)) ([47c1528](https://github.com/rlueder/lattes-editor/commit/47c1528a2d838e60f415b8947a85a9e21dc75128))

## [0.21.0](https://github.com/rlueder/lattes-editor/compare/v0.20.1...v0.21.0) (2026-10-14)

### Novidades

- campos tipados com as listas do Lattes, começando por eventos (LAT-48) ([#49](https://github.com/rlueder/lattes-editor/issues/49)) ([d18ea1c](https://github.com/rlueder/lattes-editor/commit/d18ea1cbe48121632cf1742513c4023d9a0e6048))

## [0.20.1](https://github.com/rlueder/lattes-editor/compare/v0.20.0...v0.20.1) (2026-10-14)

### Correções

- fechar o formulário de item com algo preenchido pede confirmação ([#47](https://github.com/rlueder/lattes-editor/issues/47)) ([c59b7f2](https://github.com/rlueder/lattes-editor/commit/c59b7f20050cbbf85ad71e56a280ff0afd1d8705))

## [0.20.0](https://github.com/rlueder/lattes-editor/compare/v0.19.1...v0.20.0) (2026-10-13)

### Novidades

- tela de primeiro uso (LAT-21) e "ponte" vira "conector" ([#45](https://github.com/rlueder/lattes-editor/issues/45)) ([4d1a7f8](https://github.com/rlueder/lattes-editor/commit/4d1a7f80f7af12e41ddd0b57335bd2edb6e2db3f))

## [0.19.1](https://github.com/rlueder/lattes-editor/compare/v0.19.0...v0.19.1) (2026-10-13)

### Correções

- **ci:** passo da chave de atualização em bash também no Windows ([#46](https://github.com/rlueder/lattes-editor/issues/46)) ([f702efb](https://github.com/rlueder/lattes-editor/commit/f702efbccfb0bb2b6aa0f28904e6e78065598b37))

## [0.19.0](https://github.com/rlueder/lattes-editor/compare/v0.18.0...v0.19.0) (2026-10-13)

### Novidades

- app de desktop se atualiza sozinho, com aviso de versão nova (LAT-19) ([#44](https://github.com/rlueder/lattes-editor/issues/44)) ([d33ea30](https://github.com/rlueder/lattes-editor/commit/d33ea30800a7f7219545839cb87e9a0a8951eb0c))

## [0.18.0](https://github.com/rlueder/lattes-editor/compare/v0.17.0...v0.18.0) (2026-10-13)

### Novidades

- abrir do Lattes pela ponte, sem baixar o ZIP (LAT-22) ([#43](https://github.com/rlueder/lattes-editor/issues/43)) ([94ef189](https://github.com/rlueder/lattes-editor/commit/94ef189b8cf65fb5946695ef2996b319e208b4ff))

## [0.17.0](https://github.com/rlueder/lattes-editor/compare/v0.16.1...v0.17.0) (2026-10-13)

### Novidades

- sino de notificações, app e extensão comparam capacidades, verificação de fundo e links externos ([#42](https://github.com/rlueder/lattes-editor/issues/42)) ([dc37705](https://github.com/rlueder/lattes-editor/commit/dc3770503ffc4d46d1fe2f32487f6683140473b3))

## [0.16.1](https://github.com/rlueder/lattes-editor/compare/v0.16.0...v0.16.1) (2026-10-13)

### Correções

- **ui:** diagnóstico com comparação mais estrita e exportação lida só com o painel aberto ([#41](https://github.com/rlueder/lattes-editor/issues/41)) ([d984cf2](https://github.com/rlueder/lattes-editor/commit/d984cf2c1a87d5b10e8f55e21da1d275c5292e31)), closes [#37](https://github.com/rlueder/lattes-editor/issues/37)

## [0.16.0](https://github.com/rlueder/lattes-editor/compare/v0.15.0...v0.16.0) (2026-10-13)

### Novidades

- **ui:** criar atuação no Lattes pela ponte, desligado até o teste no Lattes real ([#40](https://github.com/rlueder/lattes-editor/issues/40)) ([34ce1c6](https://github.com/rlueder/lattes-editor/commit/34ce1c6fc1b6b3938e13e38c2c7915a11353ad7b))

## [0.15.0](https://github.com/rlueder/lattes-editor/compare/v0.14.0...v0.15.0) (2026-10-13)

### Novidades

- **ui:** linha do tempo de versões do Lattes ([#39](https://github.com/rlueder/lattes-editor/issues/39)) ([ba74c76](https://github.com/rlueder/lattes-editor/commit/ba74c768cb008cc1778236b8502e02e50a1ce637)), closes [#38](https://github.com/rlueder/lattes-editor/issues/38) [#37](https://github.com/rlueder/lattes-editor/issues/37)

## [0.14.0](https://github.com/rlueder/lattes-editor/compare/v0.13.0...v0.14.0) (2026-10-13)

### Novidades

- **ui:** diagnóstico do currículo, com revisão de consistência e o que mudou no Lattes ([#37](https://github.com/rlueder/lattes-editor/issues/37)) ([b195edd](https://github.com/rlueder/lattes-editor/commit/b195edd71da0f9ee5c48bf6e46f185c8f5f07a40)), closes [#36](https://github.com/rlueder/lattes-editor/issues/36) [#35](https://github.com/rlueder/lattes-editor/issues/35)

## [0.13.0](https://github.com/rlueder/lattes-editor/compare/v0.12.0...v0.13.0) (2026-10-13)

### Novidades

- **ui:** dados locais cifrados com a chave no chaveiro do sistema ([#35](https://github.com/rlueder/lattes-editor/issues/35)) ([f4b1dce](https://github.com/rlueder/lattes-editor/commit/f4b1dce50db913fa6050f92c7d078e6bc6a106ef)), closes [#34](https://github.com/rlueder/lattes-editor/issues/34)

## [0.12.0](https://github.com/rlueder/lattes-editor/compare/v0.11.0...v0.12.0) (2026-10-13)

### Novidades

- **ui:** faixa de estados no cabeçalho e estado do Lattes pela extensão ([#33](https://github.com/rlueder/lattes-editor/issues/33)) ([5485ce4](https://github.com/rlueder/lattes-editor/commit/5485ce4916279e1bb5c96acbc75362fdb3bf31f2))

## [0.11.0](https://github.com/rlueder/lattes-editor/compare/v0.10.0...v0.11.0) (2026-10-13)

### Novidades

- **ui:** registro do que foi enviado ao Lattes, com desfazer antes do envio ao CNPq ([#31](https://github.com/rlueder/lattes-editor/issues/31)) ([034da1c](https://github.com/rlueder/lattes-editor/commit/034da1cbbb5d1f7d0e53e219272e71253d336d73))

## [0.10.0](https://github.com/rlueder/lattes-editor/compare/v0.9.1...v0.10.0) (2026-10-12)

### Novidades

- **ui:** extensão pronta para a Chrome Web Store ([#29](https://github.com/rlueder/lattes-editor/issues/29)) ([39c76c2](https://github.com/rlueder/lattes-editor/commit/39c76c26f09ee0981e64b1679a224ee25dc6d99b))

### Correções

- **ui:** painel da ponte sem botões soltos nem texto de ajuda ([#27](https://github.com/rlueder/lattes-editor/issues/27)) ([af7ad38](https://github.com/rlueder/lattes-editor/commit/af7ad387fe0464c88dd5a485e41c185718e68675))

## [0.9.1](https://github.com/rlueder/lattes-editor/compare/v0.9.0...v0.9.1) (2026-10-12)

### Correções

- **ui:** app de desktop abria em branco por marcador do Vite no HTML ([#26](https://github.com/rlueder/lattes-editor/issues/26)) ([cd50ca8](https://github.com/rlueder/lattes-editor/commit/cd50ca8aa29a95992613920065ae9c68b7496fa5))

## [0.9.0](https://github.com/rlueder/lattes-editor/compare/v0.8.0...v0.9.0) (2026-10-12)

### Novidades

- vigia do Lattes, na extensão e no CI ([#24](https://github.com/rlueder/lattes-editor/issues/24)) ([d7d9160](https://github.com/rlueder/lattes-editor/commit/d7d91604f6e847868503c1fd31f865e4d193e193))

## [0.8.0](https://github.com/rlueder/lattes-editor/compare/v0.7.0...v0.8.0) (2026-10-12)

### Novidades

- **ui:** símbolo simplificado da marca em todo lugar e versão sem fundo no cabeçalho do site ([#23](https://github.com/rlueder/lattes-editor/issues/23)) ([a9e7409](https://github.com/rlueder/lattes-editor/commit/a9e74090137b1bc4ee1bb762f0d3a0022d9df700))

## [0.7.0](https://github.com/rlueder/lattes-editor/compare/v0.6.0...v0.7.0) (2026-10-12)

### Novidades

- **ui:** campos de data e de ano com calendário próprio em pt-BR ([#19](https://github.com/rlueder/lattes-editor/issues/19)) ([10e8159](https://github.com/rlueder/lattes-editor/commit/10e81591ab11adf6dbf804192ba597e14faed40c))

### Correções

- **ui:** filtros na altura dos campos e passar o mouse em todo campo ([#18](https://github.com/rlueder/lattes-editor/issues/18)) ([cc9d589](https://github.com/rlueder/lattes-editor/commit/cc9d5890e4dec604608d822d212659c4f85faaa6))

## [0.6.0](https://github.com/rlueder/lattes-editor/compare/v0.5.0...v0.6.0) (2026-10-12)

### Novidades

- **ui:** currículo de exemplo no pnpm dev:exemplo ([#5](https://github.com/rlueder/lattes-editor/issues/5)) ([972862d](https://github.com/rlueder/lattes-editor/commit/972862d9098e9ea006353161abca2c58a0016396))
- **ui:** foto do perfil em tons de cinza no modo de privacidade ([#11](https://github.com/rlueder/lattes-editor/issues/11)) ([bd4574f](https://github.com/rlueder/lattes-editor/commit/bd4574f53bd558fb2ad8b81581abc6d9795484fe))
- **ui:** ícone monocromático na barra de extensões, claro ou escuro conforme o tema ([#17](https://github.com/rlueder/lattes-editor/issues/17)) ([49c93cd](https://github.com/rlueder/lattes-editor/commit/49c93cda9db9dd6584ea37931081d6aa8536da99))
- **ui:** índice do item aberto no painel lateral ([#16](https://github.com/rlueder/lattes-editor/issues/16)) ([4d058ba](https://github.com/rlueder/lattes-editor/commit/4d058ba34b82d534b10b009bb16d2776957f6414))
- **ui:** selo DEV no ícone do app de desenvolvimento e executável LattesEditor ([#10](https://github.com/rlueder/lattes-editor/issues/10)) ([e3e8d5d](https://github.com/rlueder/lattes-editor/commit/e3e8d5d213e2596dc0b6471122bfca9503581b54))
- **ui:** usos das tabelas de apoio agrupados por contêiner ([#12](https://github.com/rlueder/lattes-editor/issues/12)) ([f4a3ce2](https://github.com/rlueder/lattes-editor/commit/f4a3ce2b957c8f55b08a7758c83bd99766abec10))

### Correções

- **ui:** cartões e campos só de leitura mais legíveis ([#15](https://github.com/rlueder/lattes-editor/issues/15)) ([6149dd6](https://github.com/rlueder/lattes-editor/commit/6149dd65f6dd1ff4ed1ae4e76c232df31be62681))
- **ui:** filtros em ordem alfabética, com "Todos" como primeira opção ([#9](https://github.com/rlueder/lattes-editor/issues/9)) ([cc72467](https://github.com/rlueder/lattes-editor/commit/cc72467030415b1187503b415eafd16399fbd405))
- **ui:** item único de um grupo aparece como cartão, como numa lista ([#13](https://github.com/rlueder/lattes-editor/issues/13)) ([89bf2a0](https://github.com/rlueder/lattes-editor/commit/89bf2a02e05798faa1b95068d8d7af7c53e092f1))

## [0.5.0](https://github.com/rlueder/lattes-editor/compare/v0.4.0...v0.5.0) (2026-10-12)

### Novidades

- **ui:** ícones e marca, com a grade de construção e os geradores ([#8](https://github.com/rlueder/lattes-editor/issues/8)) ([a7517d8](https://github.com/rlueder/lattes-editor/commit/a7517d8f9ccf74b79fd32bde994a53e9d177929b)), closes [#463C6D](https://github.com/rlueder/lattes-editor/issues/463C6D)

## [0.4.0](https://github.com/rlueder/lattes-editor/compare/v0.3.0...v0.4.0) (2026-10-12)

### Novidades

- **ui:** seletor de tema na página do projeto, com a captura acompanhando ([#4](https://github.com/rlueder/lattes-editor/issues/4)) ([e71137b](https://github.com/rlueder/lattes-editor/commit/e71137b3869dc785ba3861bf42999f217079843b))

## [0.3.0](https://github.com/rlueder/lattes-editor/compare/v0.2.0...v0.3.0) (2026-10-12)

### Novidades

- **ui:** app de desktop com Tauri e ponte por mensagens nativas ([583caff](https://github.com/rlueder/lattes-editor/commit/583caff462dfb8c987c8cd2db58163cca4a83ebd))
- **ui:** hierarquia do texto em três tons e cabeçalho mais limpo ([50fc0a9](https://github.com/rlueder/lattes-editor/commit/50fc0a961aece0fb86dcba60cb2e2baaf9bed411))
- **ui:** marca no menu lateral, QR atrás do avatar e selo no Levar ao Lattes ([687e676](https://github.com/rlueder/lattes-editor/commit/687e676c5f639870107752eaf3f2a041b39e6db6))
- **ui:** Novo item e Levar ao Lattes de volta junto das configurações ([69f54a4](https://github.com/rlueder/lattes-editor/commit/69f54a4d0f2cfb46ae84ae78b7f571ddf1a428ef))
- **ui:** tela inicial como o editor vazio, IBM Plex e acertos visuais ([b6fbc11](https://github.com/rlueder/lattes-editor/commit/b6fbc112446708085e803396db84328901ad95b1))

### Correções

- **import-export:** cópia antes do envio pelo diálogo de salvar do app ([702b17b](https://github.com/rlueder/lattes-editor/commit/702b17b4db952f11dc9e672779f71a3a559a78ee))
- **ui:** códigos do Lattes aparecem pelo nome ([fdd86bc](https://github.com/rlueder/lattes-editor/commit/fdd86bce0d8877d3cf5a5096a55dfef5a5d21435))
- **ui:** foco inicial do modal procura só dentro do modal ([0cb4246](https://github.com/rlueder/lattes-editor/commit/0cb42463b8a95e5c2879539fe56b32756758dea9))

## [0.2.0](https://github.com/rlueder/lattes-editor/compare/v0.1.1...v0.2.0) (2026-10-12)

### Novidades

- **forms:** ponte grava a proficiência dos idiomas ([0ba9dd0](https://github.com/rlueder/lattes-editor/commit/0ba9dd09df058c0963540df2b7855bca55134687))
- **import-export:** confirmar a fila e baixar cópia antes do envio ([4230ce3](https://github.com/rlueder/lattes-editor/commit/4230ce3470ec45058631948e8c30af79edc0725a))

## [0.1.1](https://github.com/rlueder/lattes-editor/compare/v0.1.0...v0.1.1) (2026-10-11)

### Correções

- **ui:** ponte e foto só valem para o mesmo currículo ([1acb28a](https://github.com/rlueder/lattes-editor/commit/1acb28afb101ccbb6c29b1d187c2b911d6f481f2))

Mudanças do Editor do Currículo Lattes. O formato segue o
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e as versões
seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/). Ainda não
houve lançamento: tudo abaixo está em "Não lançado", na versão 0.1.0 do
`package.json`. Daqui em diante, cada lançamento acrescenta a própria seção no
topo, gerada pelo semantic-release a partir dos commits.

## [Não lançado]

### Leitura e salvamento

- Abre a exportação do Lattes (`.zip` ou `.xml`), mostra o currículo inteiro
  por seções e salva o `.xml` de volta, byte a byte igual quando nada mudou.
- Cópia de trabalho no navegador, salva a cada edição, com histórico das
  últimas 50 versões.
- Latin-1 lido e gravado à mão, com conserto opcional de texto estragado no
  próprio Lattes (acentos e aspas).

### Navegação

- Paleta ⌘K para ir a qualquer seção ou grupo; G e uma letra para cada uma
  das doze seções.
- Linha do tempo por ano nas listas, índice "Nesta seção" com o grupo
  visível, filtros por seção (busca e facetas) e barra do título que aparece
  ao rolar.
- Instituições por país e cursos por área, com onde cada um aparece.

### Produção nova e Importar do Lattes

- Formulário de item novo para os tipos mais usados, com autores, áreas do
  conhecimento e palavras-chave; busca por DOI no Crossref para preencher.
- Validação antes de exportar e arquivo `<id>-importacao.xml` para o
  Importar do Lattes, com os passos na tela.

### Levar ao Lattes

- Lista das alterações que o Importar não leva, com o valor antigo e o novo,
  copiar por campo e descartar por campo ou por item.
- Ponte por extensão do navegador (em teste): grava no Lattes, a partir da
  sessão da própria pessoa, os vínculos da atuação e o resumo, conferindo
  cada alteração depois de gravar.
- Aviso no topo do conteúdo enquanto há alteração ou item novo fora do
  Lattes.

### Dados e privacidade

- Modo de privacidade em Dados gerais, ligado por padrão: documentos,
  nascimento, filiação, raça, deficiência e endereço residencial ficam
  mascarados.
- Campos que o Lattes gera ou que vêm de uma lista (códigos, siglas,
  instituição, curso, idioma, país) ficam só leitura, com o nome ao lado do
  código.
- Foto do perfil carregada do CNPq pelo código do currículo.

### Impressão

- Imprimir ou salvar em PDF, com modelos (resumido, ampliado, completo,
  personalizado), escolha de seções e pré-visualização.
- Página nas regras da NBR 14724 (corpo 12, entrelinha 1,5, margens 3/3/2/2
  cm, em preto) e referências da produção na NBR 6023.

### Interface

- Base UI, tema claro e escuro, escala densa inspirada no Linear, camadas de
  fundo, painel por grupo, estados vazios com ação.

### Documentação

- Guia de implementação, requisitos de produto, reconhecimento do Lattes,
  funcionamento interno do editor do Lattes, estilo da interface e pesquisa
  sobre recursos de IA, todos em pt-BR.
