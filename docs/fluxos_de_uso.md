# Fluxos de uso

Como três tipos de pessoa usam o editor, e o que o app faz sozinho para que
nenhuma delas precise entender o Lattes por dentro. O ponto de partida é o
que o Lattes não faz: não mostra o que está pendente, não deixa descartar
alterações e bloqueia o Exportar enquanto há pendência
(`lattes_internals.md`, seção 10).

## O caminho de uma alteração

1. **Original.** O currículo como veio da última exportação. Como o Exportar
   recusa com pendência, toda exportação é uma versão publicada.
2. **Alterado no editor.** Só existe no app. Desfaz-se no editor ou
   restaurando um ponto do histórico.
3. **Gravado no Lattes.** O conector gravou e conferiu, e o CNPq ainda não
   publicou. O Lattes não tem como descartar: o único jeito de voltar é
   gravar o valor anterior de novo ("Desfazer no Lattes", no registro do
   enviado). Enquanto houver algo aqui, o Exportar fica bloqueado.
4. **Publicado.** Depois de "Enviar ao CNPq". A próxima exportação vira o
   novo original.

A contagem do estado 2 fica no selo do botão "Enviar ao Lattes" e no aviso de
pendências no alto da página. O estado 3 e a data da última publicação ficam
numa linha no alto do painel "Enviar ao Lattes" (`3 no Lattes · publicado em
17/08/2026`), lidos do menu do Lattes pela extensão; a contagem abre o
registro do enviado. Pendência que o app não gravou (feita direto no Lattes
ou por outro aparelho) aparece como "pendências que o editor não conhece", na
mesma linha e no sino, e abre o diagnóstico.

Sem leitura do Lattes, o sino ao lado do ⚙ diz o motivo (extensão ausente ou
desatualizada, aviso da extensão não aceito, Lattes fechado ou fora do menu,
sessão de outro currículo) e o que fazer. A extensão relê o menu quando a aba
do Lattes termina de carregar, então abrir o Lattes depois do app basta.

## O que acontece sozinho

Nada disto é pergunta ou chave para a pessoa decidir:

- **Ponto no histórico** antes de cada envio e a cada currículo aberto,
  cifrado no app. Quem quer um arquivo usa "Salvar cópia" no histórico.
- **Ponto zero**: a primeira exportação de cada currículo, byte a byte, em
  `Documentos/LattesEditor/Cópias de segurança/<id>/`, sem cifra. Vale a que
  vem pelo conector e o ZIP do Exportar aberto como veio. O app nunca a
  apaga.
- **Ponto de restauração** antes de cada rodada de escrita: o conector
  exporta o Lattes como está e guarda o ZIP ao lado do ponto zero. Com
  pendência no Lattes, o Exportar recusa, e o app só grava depois de
  "Gravar sem ponto de restauração".
- **Registro do enviado**, com o antes e o depois de cada campo e o
  "Desfazer no Lattes".
- **Leitura do estado do Lattes** ao abrir o app e depois de cada fila.
- **Lembrete de publicar** no fim de cada fila.

## Estudante com o Lattes recém-criado

Currículo quase vazio; precisa cadastrar formação, atuação e as primeiras
produções.

1. Instala o app. A tela de primeiro uso mostra três passos que se marcam
   sozinhos: instalar a extensão e aceitar o aviso dela, entrar no Lattes no
   mesmo navegador e, com isso, o currículo abre. Quem não quer a extensão
   tem "Prefiro abrir o arquivo exportado".
2. Preenche seção por seção. Produções vão pelo arquivo do Importar;
   formação, atuação e projeto vão pela inclusão do conector.
3. Manda tudo de uma vez, e o lembrete leva ao "Enviar ao CNPq".

## Docente que atualiza todo mês

Já tem um currículo grande; acrescenta poucas produções e corrige detalhes.

1. Abre o app, que já tem a versão do mês passado. "Recarregar do Lattes"
   traz a de agora e diz, numa faixa, quantos itens são novos, alterados e
   removidos, inclusive o que foi editado direto no Lattes; "Versões do
   Lattes", no ⚙, mostra o detalhe de cada exportação.
2. Acrescenta produções pelo DOI e ajusta o que precisa.
3. Manda, confere a faixa e publica.

## Quem volta ao Lattes depois de anos

O currículo está desatualizado, e a pessoa não sabe o que ficou pendente.

1. "Abrir do Lattes". Se o Exportar estiver bloqueado, o app abre a última
   versão publicada que tiver deste currículo e compara com a versão atual
   do Lattes (`pkg_publicar.cv_espelho`) no diagnóstico. A página de
   conferência é texto, então ela serve de comparação e não vira o currículo
   editável. Sem nenhuma versão guardada, a tela inicial pede o envio ao
   CNPq, que libera o Exportar.
2. O "Diagnóstico do currículo" (no ⚙ e no aviso do sino) confere o
   currículo inteiro (obrigatórios, listas, anos, autores, DOI, a revisão de
   consistência) e, logo abaixo, mostra a data da última publicação, o que
   está pendente e o que mudou no Lattes desde a exportação
   (`src/review/espelho-diff.ts`).
3. A pessoa decide o que mantém e o que desfaz, trabalha em lotes ao longo de
   dias e publica no fim.
