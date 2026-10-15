# Fluxos de uso

Como três tipos de pessoa usam o editor, e o que o app faz sozinho para que
nenhuma delas precise entender o Lattes por dentro. Escrito em 13/10/2026,
depois de ver que o Lattes não mostra o que está pendente, não deixa
descartar alterações e bloqueia o Exportar enquanto há pendência
(`lattes_internals.md`, seção 10).

## O caminho de uma alteração

Toda alteração passa por quatro estados, e o Lattes só deixa voltar atrás
nos dois primeiros sem esforço:

1. **Original.** O currículo como veio da última exportação. Como o Exportar
   recusa quando há pendência, toda exportação que o app tem é uma versão
   publicada e limpa.
2. **Alterado no editor.** Só existe no app. Desfaz-se no próprio editor ou
   restaurando um ponto do histórico.
3. **Gravado no Lattes.** O conector gravou e conferiu, mas o CNPq ainda não
   publicou. O Lattes não tem como descartar; o único jeito de voltar é
   gravar o valor anterior de novo ("Desfazer no Lattes", no registro do
   enviado). Enquanto houver algo aqui, o Exportar fica bloqueado.
4. **Publicado.** Depois de "Enviar ao CNPq", no Lattes. Daqui em diante, o
   currículo público mostra a alteração, e a próxima exportação vira o novo
   original.

### Onde aparecem

A contagem das alterações do editor fica no selo do botão "Enviar ao
Lattes", no cabeçalho, e no aviso de pendências no alto da página. O que
está no Lattes e ainda não foi publicado e a data da última publicação ficam
numa linha discreta no alto do painel "Enviar ao Lattes", por exemplo `3 no
Lattes · publicado em 17/08/2026`; a contagem do Lattes abre o registro do
enviado (aba "Enviado"). O canto esquerdo do cabeçalho mostra o símbolo e o
nome do app.

As contagens de 2 e 3 o app já sabe (lista de alterações e registro do
enviado). A data de publicação e a pendência no Lattes vêm da extensão, que
lê o menu do Lattes na sessão aberta. Pendência que o app não gravou (feita
direto no Lattes, ou por outro aparelho) aparece como "pendências que o
editor não conhece", na mesma linha do painel e como aviso no sino, e os
dois abrem o diagnóstico.

Sem leitura do Lattes, o sino ao lado das configurações diz o motivo
(extensão ausente ou desatualizada, aviso da extensão não aceito, Lattes
fechado ou fora do menu, sessão de outro currículo) e o que fazer. O mesmo
sino avisa quando o app não está guardando o trabalho. A extensão relê o menu quando a aba do Lattes termina de carregar,
então abrir o Lattes depois do app basta.

## O que acontece sozinho

Nenhuma destas coisas é pergunta ou chave para a pessoa decidir:

- **Ponto no histórico antes de cada envio** e a cada currículo aberto,
  guardado no app (cifrado, LAT-39). Quem quer um arquivo usa "Salvar cópia"
  no histórico.
- **Ponto zero** (LAT-59): a primeira exportação de cada currículo fica byte
  a byte numa pasta da pessoa, `Documentos/LattesEditor/Cópias de
segurança/<id>/`, sem cifra. Vale a que vem pelo conector e o ZIP aberto de
  um arquivo quando ele é exatamente o que o Exportar dá (o nome
  `CV_<id>.zip` e um único `<id>.xml` dentro). Um XML solto ou um ZIP
  refeito abre normalmente, mas não vira ponto zero; o primeiro ponto de
  restauração faz esse papel. O app nunca sobrescreve nem apaga esse arquivo,
  e nenhum "Limpar" chega nele.
- **Ponto de restauração antes de cada rodada de escrita** (LAT-59): ao
  confirmar a fila em "Enviar ao Lattes", e antes da primeira gravação, o
  conector exporta o Lattes como está e guarda o ZIP ao lado do ponto zero.
  Se o Lattes já tem pendência, o Exportar recusa: o app diz que não houve
  ponto, mostra a cópia mais recente e só grava depois de "Continuar sem ponto
  de restauração". Se a sessão caiu, a rodada para sem gravar nada. As
  cópias ficam em ⚙ › Versões do Lattes, em "Cópias de segurança".
- **Registro do enviado**, com o antes e o depois de cada campo e o
  "Desfazer no Lattes".
- **Leitura do estado do Lattes** pela extensão, ao abrir o app e depois de
  cada fila: data da última publicação, se há pendência, se o Exportar está
  bloqueado.
- **Lembrete de publicar** no fim de cada fila: o que foi gravado só aparece
  no currículo público depois de "Enviar ao CNPq".

## Estudante com o Lattes recém-criado

Currículo quase vazio; precisa cadastrar formação, atuação e as primeiras
produções.

1. Instala o app. A tela de primeiro uso mostra três passos que se marcam
   sozinhos (LAT-21): instalar a extensão e aceitar o aviso dela, entrar no
   Lattes no mesmo navegador e, com isso, o currículo abre. Quem não quer a
   extensão tem "Prefiro abrir o arquivo exportado". Sem resposta da
   extensão, o app não distingue extensão ausente de navegador fechado, e o
   texto do primeiro passo cobre os dois.
2. "Abrir do Lattes" carrega o currículo pelo conector, sem baixar nem escolher
   arquivo (LAT-22).
3. Preenche seção por seção. Produções vão pelo arquivo do Importar; formação
   e atuação o Importar não aceita, então precisam ser criadas pelo conector
   (LAT-24). Para esta pessoa, criar itens é o recurso que falta.
4. Manda tudo de uma vez, a faixa do cabeçalho mostra "no Lattes", e o
   lembrete leva ao "Enviar ao CNPq".

## Docente que atualiza todo mês

Já tem um currículo grande; acrescenta poucas produções e corrige detalhes.

1. Abre o app, que já tem a versão do mês passado. "Recarregar do Lattes"
   (pela extensão, sem escolher arquivo, LAT-46) traz a de agora e diz, numa faixa, quantos itens são novos, alterados e
   removidos desde a anterior, inclusive o que foi editado direto no Lattes;
   "Versões do Lattes", no ⚙, mostra o detalhe de cada exportação (LAT-12,
   feito).
2. Acrescenta produções pelo DOI (LAT-30) e ajusta o que precisa.
3. Manda, confere a faixa e publica.

O que importa aqui é um ciclo curto e sempre igual, sem passos que dependam
de lembrar como foi da última vez.

## Quem volta ao Lattes depois de anos

O currículo está desatualizado, e a pessoa não sabe o que ficou pendente de
antes (o caso que originou este documento).

1. "Abrir do Lattes". Se o Exportar estiver bloqueado, o app não para: abre a
   última versão publicada que tiver deste currículo e compara com a versão
   atual do Lattes (`pkg_publicar.cv_espelho`, que não pede código de
   segurança), no diagnóstico. A página de conferência é texto, então ela
   serve de comparação e não vira o currículo editável (LAT-46, feito).
2. Mostra um diagnóstico antes de tudo: data da última publicação, o que está
   pendente e o que provavelmente envelheceu, como vínculos ainda "Atual" e
   períodos antigos (revisão de consistência, LAT-29). Feito em 13/10/2026
   como "Diagnóstico do currículo" (no ⚙ e no aviso do sino), com a
   comparação por títulos das produções e dos eventos
   (`src/review/espelho-diff.ts`). Desde a LAT-25, o diagnóstico abre com
   a conferência do currículo inteiro (obrigatórios, listas, anos, autores,
   DOI e a revisão de consistência), e o que o Lattes diz vem logo abaixo.
3. A pessoa decide o que mantém e o que desfaz, trabalha em lotes ao longo de
   dias (o app guarda tudo) e publica no fim.

Sem nenhuma exportação anterior no app, não há com o que comparar: a tela
inicial diz que o app não guardou nenhuma versão e pede o envio ao CNPq, que
libera o Exportar. Comparar com a versão pública, que pede o código de
segurança, continua por fazer.

## Ordem sugerida

1. O que acontece sozinho (já começou: o ponto de histórico substituiu a
   chave da cópia, e o registro do enviado existe).
2. Faixa de estados no cabeçalho.
3. Abrir do Lattes pelo conector (LAT-22). Feito, com o caso do Exportar
   bloqueado (LAT-46): a tela inicial abre a última versão guardada no app e
   compara com a página de conferência.
4. Diagnóstico para quem volta (comparação e revisão de consistência).
5. Criar itens pelo conector (LAT-24).
6. Linha do tempo de versões (LAT-12). Feito: até 24 exportações por
   currículo, cifradas, com o que mudou entre cada uma e a anterior.
