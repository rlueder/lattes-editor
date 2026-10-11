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
uma com o valor antigo e o novo, um botão para copiar cada campo e uma
caixa para marcar quando já foi feita no formulário do Lattes.

## Desenvolvimento

```bash
pnpm install
pnpm dev                 # servidor local
pnpm test                # testes
pnpm test:coverage       # testes com limite de 80% de cobertura
pnpm build               # gera dist/index.html, que abre direto por file://
```

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
- `docs/lattes_editor_reconnaissance.md`: como o editor do Lattes funciona por dentro
- `docs/lattes_product_requirements.md`: pesquisa e estratégia de produto
- `AGENTS.md`: regras para quem contribui (pessoas e agentes)

## Licença

MIT
