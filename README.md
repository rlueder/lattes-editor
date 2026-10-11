# Editor do Currículo Lattes

Editor local para o Currículo Lattes. Você exporta o currículo no Lattes,
abre o arquivo aqui, edita e salva. A partir do marco 2, o editor também
gera o XML que o Importar do próprio Lattes aceita, para cadastrar
produções novas sem passar pelos formulários.

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

## Documentação

- `docs/lattes_implementation_guide.md`: plano, decisões e marcos
- `docs/lattes_editor_reconnaissance.md`: primeiro reconhecimento do editor do Lattes (menus, inclusão, Importar)
- `docs/lattes_internals.md`: como o editor do Lattes funciona por dentro (PL/SQL, `f_ctr`, formulários de edição)
- `docs/lattes_product_requirements.md`: pesquisa e estratégia de produto
- `AGENTS.md`: regras para quem contribui (pessoas e agentes)

## Licença

MIT
