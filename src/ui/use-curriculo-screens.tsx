// As duas telas do grupo "Currículo" do ⚙: o Histórico, com o Lattes agora no
// alto (LattesNow.tsx), e a Revisão do currículo. Ficam aqui para o App só
// pedir a abertura e pôr as telas no lugar.

import { useState } from 'react';

import type { Session } from '../forms/use-production.ts';
import type { XDocument } from '../model/xml.ts';
import { LattesNow } from '../review/LattesNow.tsx';
import { ReviewPanel } from '../review/ReviewPanel.tsx';
import type { HashRoute } from './hash-route.ts';
import { HistoryPanel } from './HistoryPanel.tsx';
import type { Section } from './sections.ts';
import type { BridgeState } from './use-bridge.ts';
import { useHistory } from './use-history.ts';

interface Deps {
  bridge: Pick<BridgeState, 'available' | 'espelho' | 'lattes' | 'requestEspelho'>;
  session: Session | null;
  setExportOpen: (open: boolean) => void;
  setSession: (session: Session) => void;
  onEdit: (note: string) => void;
}

export function useCurriculoScreens({ bridge, onEdit, session, setExportOpen, setSession }: Deps) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const history = useHistory({
    available: bridge.available,
    onRestore: (doc: XDocument, note: string) => {
      if (!session) return;
      setSession({ doc, meta: session.meta });
      onEdit(note);
    },
    onShowSent: () => setExportOpen(true),
    requestEspelho: bridge.requestEspelho,
    session,
  });

  /** O Histórico já comparando com o Lattes: o sino, a faixa do envio, a exportação guardada. */
  const compareLattes = () => {
    setExportOpen(false);
    history.show({ compare: true });
  };

  const render = (go: (route: HashRoute) => void, sections: Section[], version: number) =>
    session && (
      <>
        <ReviewPanel
          open={reviewOpen}
          root={session.doc.root}
          sections={sections}
          version={version}
          onClose={() => setReviewOpen(false)}
          onGo={go}
        />
        <HistoryPanel
          history={history}
          lattesNow={
            <LattesNow
              active={history.open}
              available={bridge.available}
              espelho={bridge.espelho}
              lattes={bridge.lattes}
              originalXml={session.meta.originalXml}
              root={session.doc.root}
              sections={sections}
              version={version}
              onGo={(route) => {
                history.close();
                go(route);
              }}
              onRequestEspelho={bridge.requestEspelho}
            />
          }
          onGo={go}
        />
      </>
    );

  return { compareLattes, history, openReview: () => setReviewOpen(true), render };
}
