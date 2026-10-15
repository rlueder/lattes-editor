// Os dois painéis de revisão do currículo, que se chamam um ao outro: o
// diagnóstico (o que o Lattes diz e o que mudou lá) e a validação do
// currículo inteiro (LAT-25). Um aberto de cada vez.

import type { LattesStatus } from '../bridge/lattes-status.ts';
import type { XElement } from '../model/xml.ts';
import type { HashRoute } from '../ui/hash-route.ts';
import type { Section } from '../ui/sections.ts';
import type { EspelhoReading } from '../ui/use-bridge.ts';
import { DiagnosisPanel } from './DiagnosisPanel.tsx';
import { ValidationPanel } from './ValidationPanel.tsx';

export type ReviewPanel = 'diagnostico' | 'validacao';

interface Props {
  bridge: {
    available: boolean;
    espelho?: EspelhoReading;
    lattes?: LattesStatus;
    requestEspelho: () => void;
  };
  open: ReviewPanel | null;
  originalXml: string;
  root: XElement;
  sections: Section[];
  version: number;
  onGo: (route: HashRoute) => void;
  onOpen: (panel: ReviewPanel | null) => void;
}

export function ReviewPanels({ bridge, onGo, onOpen, open, ...doc }: Props) {
  return (
    <>
      <DiagnosisPanel
        available={bridge.available}
        espelho={bridge.espelho}
        lattes={bridge.lattes}
        open={open === 'diagnostico'}
        {...doc}
        onClose={() => onOpen(null)}
        onGo={onGo}
        onRequestEspelho={bridge.requestEspelho}
        onValidation={() => onOpen('validacao')}
      />
      <ValidationPanel
        open={open === 'validacao'}
        root={doc.root}
        sections={doc.sections}
        version={doc.version}
        onClose={() => onOpen(null)}
        onGo={onGo}
      />
    </>
  );
}
