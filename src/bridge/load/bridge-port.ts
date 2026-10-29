// A porta de "Carregar do Lattes" (loader.ts) sobre a ponte: o menu e as
// páginas vêm da aba pelo mesmo pedido de "Atualizar do Lattes" ('ler-lattes',
// passos 'menu' e 'paginas'); os formulários são lidos aqui, no navegador do
// editor. `failure` guarda o motivo da última resposta sem a parte pedida
// (sem o "ok" do aviso, sem aba, aba ocupada), para quem chamou dizer à pessoa.

import { readFormInPage } from '../form-dom.ts';
import type { RefreshPart, RefreshRequest } from '../refresh/read.ts';
import type { LoadPort } from './loader.ts';
import type { PageRequest, PagesPart } from './pages.ts';

export interface LoadAnswer {
  error?: string;
  lattesId?: string;
  part?: RefreshPart;
  reason?: string;
}

export interface BridgeLoadPort extends LoadPort {
  /** O motivo da última resposta que não trouxe a parte, e o currículo da sessão. */
  failure(): { lattesId?: string; reason?: string } | undefined;
  /** O currículo da sessão que respondeu por último. */
  lattesId(): string | undefined;
}

const NO_REPLY = 'A aba do Lattes não respondeu.';

export function bridgeLoadPort(
  ask: (request: RefreshRequest) => Promise<LoadAnswer>,
  readForm: LoadPort['readForm'] = readFormInPage,
): BridgeLoadPort {
  let failed: { lattesId?: string; reason?: string } | undefined;
  let session: string | undefined;
  const take = async (request: RefreshRequest) => {
    const a = await ask(request);
    if (a.lattesId) session = a.lattesId;
    if (!a.part) failed = { lattesId: a.lattesId, reason: a.reason };
    return a;
  };
  return {
    failure: () => failed,
    lattesId: () => session,
    async menu() {
      const a = await take({ step: 'menu' });
      if (a.part?.step !== 'menu') throw new Error(a.error ?? 'A aba do Lattes não mandou o menu.');
      return a.part.html;
    },
    async pages(requests: PageRequest[]): Promise<PagesPart> {
      const a = await take({ paths: requests, step: 'paginas' });
      if (a.part?.step === 'paginas') return a.part;
      return { error: a.error ?? NO_REPLY, pages: [], reason: 'erro', rest: requests };
    },
    readForm,
  };
}
