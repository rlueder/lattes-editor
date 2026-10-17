// Como cada coisa vai ao Lattes hoje, para a aba "A enviar" do painel Enviar ao
// Lattes: pelo conector (a extensão grava e confere), pelo Importar (vai no
// arquivo de importação) ou ainda não (o editor ainda não sabe levar; fica na
// lista, em "Não enviado", e dá para descartar). O objetivo é que tudo vá
// sozinho; sem nada pendente, essa parte some.

import type { ChangeGroup } from '../ui/changes-view.ts';
import { changeCount } from '../ui/changes-view.ts';

export type PanelTab = 'a-enviar' | 'enviado';

/**
 * Separa as alterações entre as que o conector sabe gravar (as chaves da fila
 * planejada) e as que o editor ainda não envia, mantendo os grupos por seção
 * e a ordem.
 */
export function splitByRoute(
  groups: ChangeGroup[],
  connectorKeys: ReadonlySet<string>,
): { conector: ChangeGroup[]; pendente: ChangeGroup[] } {
  const pick = (byConnector: boolean) =>
    groups
      .map((g) => ({
        ...g,
        entries: g.entries.filter((e) => connectorKeys.has(e.change.key) === byConnector),
      }))
      .filter((g) => g.entries.length > 0);
  return { conector: pick(true), pendente: pick(false) };
}

/**
 * O motivo é do Lattes (o formulário não tem o campo, ou não aceita o valor),
 * e não trabalho que falta no editor. Os motivos seguem duas formas: "O
 * formulário de X do Lattes não tem: …" e "… que o (formulário do) Lattes não
 * tem: …", mais o rádio que não volta a vazio e o valor que o Lattes não aceita.
 */
export function lattesLacks(reason: string): boolean {
  return /(formulário|Lattes)[^.;]* não (tem|aceita|volta)/.test(reason);
}

/**
 * Separa o que fica fora do conector: o que o formulário do Lattes não tem
 * onde gravar e o que o editor ainda não envia. Cada alteração leva o motivo
 * do plano; sem motivo (não entrou no plano), fica com o editor.
 */
export function splitPending(
  groups: ChangeGroup[],
  reasons: ReadonlyMap<string, string>,
): { editor: ChangeGroup[]; lattes: ChangeGroup[] } {
  const pick = (byLattes: boolean) =>
    groups
      .map((g) => ({
        ...g,
        entries: g.entries.filter((e) => lattesLacks(reasons.get(e.change.key) ?? '') === byLattes),
      }))
      .filter((g) => g.entries.length > 0);
  return { editor: pick(false), lattes: pick(true) };
}

/** Quantas coisas esperam ir ao Lattes: itens novos mais alterações. */
export function toSendCount(newItems: number, groups: ChangeGroup[]): number {
  return newItems + changeCount(groups);
}

let requested: PanelTab | undefined;
let openPanel: ((tab: PanelTab) => void) | undefined;

/**
 * Pede uma aba do painel (a faixa abre direto no registro). Com o painel
 * aberto, vale na hora; fechado, vale na próxima abertura e só nela.
 */
export function requestTab(tab: PanelTab): void {
  if (openPanel) openPanel(tab);
  else requested = tab;
}

/** O painel aberto recebe os pedidos de aba; ao fechar, deixa de receber. */
export function listenTabRequests(onTab: (tab: PanelTab) => void): () => void {
  openPanel = onTab;
  return () => {
    if (openPanel === onTab) openPanel = undefined;
  };
}

/** A aba pedida, uma vez só; depois volta à escolha normal. */
export function takeRequestedTab(): PanelTab | undefined {
  const tab = requested;
  requested = undefined;
  return tab;
}
