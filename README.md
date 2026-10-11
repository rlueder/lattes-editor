# Editor do Currículo Lattes

Editor local para o Currículo Lattes. Você exporta o currículo no Lattes,
abre o arquivo aqui, edita e leva as mudanças de volta: produções novas pelo
Importar do próprio Lattes, e o resto pela extensão da ponte ou copiando
campo a campo.

O arquivo nunca sai do seu computador. Não há servidor nem conta: a cópia
de trabalho fica no IndexedDB do navegador.

## Uso

1. No Lattes, Ferramentas › Exportar, para baixar o `CV_<id>.zip`.
2. Abra o editor e solte o ZIP (ou o `.xml`) na tela.
3. Navegue pelas seções do menu lateral ou com <kbd>⌘K</kbd>
   (<kbd>Ctrl</kbd>+<kbd>K</kbd> fora do Mac).
4. As alterações são salvas no navegador a cada edição. "Salvar arquivo"
   grava o `.xml` no disco, com o mesmo nome da exportação.

Para cadastrar produção nova, use "+ Novo item" (ou <kbd>⌘K</kbd> e
"Novo"). Os itens novos ficam marcados até a próxima importação. Em
"Levar ao Lattes", o editor gera o `<id>-importacao.xml` e mostra os passos no
Lattes: enviar o arquivo, marcar só os módulos listados e desmarcar os itens
vermelhos no Passo 3, que já estão no currículo e seriam duplicados. Depois
de importar, exporte de novo no Lattes e use "Recarregar do Lattes".

As seções Dados gerais, Formação, Atuação e Projetos não passam pelo
Importar do Lattes, e o Importar também não altera itens que já estão lá.
Essas mudanças aparecem em "Levar ao Lattes", na lista de alterações: cada
uma com o valor antigo e o novo, um botão para copiar cada campo e a opção
de descartar a mudança. Depois de copiar tudo no Lattes, exporte de novo e
use "Recarregar do Lattes": o que já estiver lá some da lista.

Outras funções:

- **Imprimir ou salvar em PDF** (⚙ › Imprimir, ou <kbd>⌘P</kbd>): escolha de
  seções e modelos, página nas regras da NBR 14724 e referências na NBR 6023.
- **Privacidade em Dados gerais:** documentos, nascimento, filiação e
  endereço residencial ficam mascarados até você clicar no olho.
- **Aviso de pendências** no topo enquanto alguma alteração ou item novo
  ainda não está no Lattes.

## Ponte com o Lattes (extensão, em teste)

A extensão envia ao Lattes, a partir da sua própria sessão no navegador, as
alterações que hoje se copiam à mão. Cada uma é gravada, lida de volta e
conferida; a fila para no primeiro problema. Nenhuma senha passa pela
extensão nem pelo editor. Por enquanto ela leva campos do vínculo de uma
atuação (datas, carga horária, enquadramento, outras informações) e o resumo;
o resto continua na lista de copiar à mão.

Para instalar a versão de desenvolvimento no Brave ou no Chrome:

1. `pnpm build:extension`, que gera a pasta `dist-extension/`.
2. Abra `brave://extensions` (ou `chrome://extensions`) e ligue o "Modo do
   desenvolvedor".
3. Clique em "Carregar sem compactação" e escolha a pasta `dist-extension/`.
4. Abra o editor (`pnpm dev`, em `localhost`) e, em outra aba, o seu
   currículo no Lattes, na página do menu.
5. No editor, "Levar ao Lattes" mostra "Enviar pela extensão" quando há
   alterações que ela sabe levar. Clique, depois no ícone da extensão, e use
   "Aplicar" numa alteração ou "Aplicar todas".

Depois de mudar o código da extensão, rode `pnpm build:extension` de novo e
clique em "Recarregar" no cartão dela em `brave://extensions`.

A extensão só pede acesso a `wwws.cnpq.br`. O que ela lê, para onde envia e
o que falta para publicá-la na Chrome Web Store estão em
`docs/extensao_chrome_web_store.md` e `docs/politica_de_privacidade_extensao.md`.

## Desenvolvimento

```bash
pnpm install
pnpm dev                 # servidor local
pnpm test                # testes
pnpm test:coverage       # testes com limite de 80% de cobertura
pnpm build               # gera dist/index.html, que abre direto por file://
pnpm build:site          # página inicial em dist-site/, com o editor em dist-site/app/
pnpm build:extension     # gera a extensão da ponte em dist-extension/
```

A página inicial fica em `site/` (HTML e CSS estáticos, sem build próprio).
Com `pnpm dev`, ela abre em `/site/`. As imagens em `site/img/` são capturas
do editor com a fixture sintética, nunca de um currículo real.

Scripts de geração:

```bash
pnpm gen:schema          # XSD + schema/patch.json -> src/schema/lattes.json
pnpm gen:fixtures        # lattes.json -> fixtures/synthetic_*.xml
pnpm validate:fixtures   # valida as fixtures contra o XSD com xmllint
```

Para testar com uma exportação real, coloque o `CV_<id>.zip` em
`fixtures/real/`. A pasta está no `.gitignore` e o teste de ida e volta
passa a cobrir o arquivo.

## Lançamentos

Cada push na `main` passa pelo CI (lint, tipos, testes com cobertura e
build). Com o CI verde, o semantic-release lê os commits desde o último
lançamento e decide a versão: `feat` sobe a versão menor, `fix`, `perf` e
`refactor` sobem a correção, e um rodapé `BREAKING CHANGE` sobe a maior.
`docs`, `chore`, `ci`, `test`, `style` e `build` não geram lançamento.

O lançamento atualiza o `CHANGELOG.md` e a versão do `package.json`, cria a
tag e publica no GitHub o editor num arquivo HTML só e a extensão da ponte
em `.zip`, já com a versão nova. A configuração está em `.releaserc.cjs`.

## Documentação

- `CHANGELOG.md`: o que mudou
- `ROADMAP.md`: o que vem a seguir
- `docs/lattes_internals.md`: **como o editor do Lattes funciona por
  dentro**: a aplicação em PL/SQL, o campo `f_ctr`, os códigos de sessão e de
  currículo, os formulários de edição campo a campo e o primeiro envio direto
  ao Lattes. É a base da ponte.
- `docs/lattes_implementation_guide.md`: plano, decisões e marcos
- `docs/lattes_product_requirements.md`: pesquisa e estratégia de produto
- `docs/lattes_editor_reconnaissance.md`: primeiro reconhecimento do editor
  do Lattes (menus, inclusão, Importar)
- `docs/estilo_da_interface.md`: referência visual e regras de interface
- `docs/pesquisa_recursos_de_ia.md`: pesquisa sobre recursos de IA no editor
- `docs/extensao_chrome_web_store.md` e
  `docs/politica_de_privacidade_extensao.md`: publicação da extensão
- `AGENTS.md`: regras para quem contribui (pessoas e agentes)

## Licença

MIT
