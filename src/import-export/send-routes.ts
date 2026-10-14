// Como cada coisa vai ao Lattes hoje, para a aba "A enviar" do painel Enviar ao
// Lattes: pelo conector (a extensão grava e confere), pelo Importar (vai no
// arquivo de importação) ou à mão (a pessoa copia no formulário do Lattes). O
// objetivo é que tudo vá sozinho; enquanto houver o que vai à mão, a lista diz
// o quê, e sem nada à mão essa parte some.

import type { ChangeGroup } from '../ui/changes-view.ts';
import { changeCount } from '../ui/changes-view.ts';

export type SendRoute = 'conector' | 'importar' | 'mao';

export const ROUTE_LABEL: Record<SendRoute, string> = {
  conector: 'conector',
  importar: 'Importar',
  mao: 'à mão',
};

export type PanelTab = 'a-enviar' | 'enviado';

/**
 * Separa as alterações entre as que o conector sabe gravar (as chaves da fila
 * planejada) e as que ficam à mão, mantendo os grupos por seção e a ordem.
 */
export function splitByRoute(
  groups: ChangeGroup[],
  connectorKeys: ReadonlySet<string>,
): { conector: ChangeGroup[]; mao: ChangeGroup[] } {
  const pick = (byConnector: boolean) =>
    groups
      .map((g) => ({
        ...g,
        entries: g.entries.filter((e) => connectorKeys.has(e.change.key) === byConnector),
      }))
      .filter((g) => g.entries.length > 0);
  return { conector: pick(true), mao: pick(false) };
}

/** Quantas coisas esperam ir ao Lattes: itens novos mais alterações. */
export function toSendCount(newItems: number, groups: ChangeGroup[]): number {
  return newItems + changeCount(groups);
}

/** A aba que abre: "A enviar" quando há algo esperando; senão o registro, se houver. */
export function initialTab(toSend: number, sent: number): PanelTab {
  return toSend === 0 && sent > 0 ? 'enviado' : 'a-enviar';
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
