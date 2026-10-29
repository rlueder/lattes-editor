// "Revisão do currículo": o que vale conferir no currículo inteiro (os
// achados de validation.ts, em Findings.tsx, LAT-25). Só leitura: cada achado
// leva ao item no editor. O que mudou no Lattes fica no Histórico
// (LattesNow.tsx).

import { useMemo } from 'react';

import type { XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import type { HashRoute } from '../ui/hash-route.ts';
import { Modal } from '../ui/Modal.tsx';
import type { Section } from '../ui/sections.ts';
import { Findings } from './Findings.tsx';
import type { Place } from './locate.ts';
import { validateCv } from './validation.ts';

interface Props {
  open: boolean;
  root: XElement;
  sections: Section[];
  /** Muda a cada edição; o documento é mutado no lugar. */
  version: number;
  onClose: () => void;
  onGo: (route: HashRoute) => void;
}

export function ReviewPanel({ onClose, onGo, open, root, sections, version }: Props) {
  // Só com o painel aberto: a revisão percorre o currículo inteiro.
  const validation = useMemo(
    () => (open ? validateCv(lattesSchema, root, sections) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, root, sections, version],
  );
  const go = (place?: Place) => {
    if (!place) return;
    onClose();
    onGo({ anchor: place.anchor, sectionId: place.sectionId });
  };
  return (
    <Modal
      className="export diagnosis"
      footer={
        <button className="ghost" type="button" onClick={onClose}>
          Fechar
        </button>
      }
      label="Revisão do currículo"
      open={open}
      subtitle="O que vale conferir no currículo inteiro. Nada aqui altera o currículo."
      title="Revisão do currículo"
      onClose={onClose}
    >
      {validation && <Findings validation={validation} onGo={go} />}
    </Modal>
  );
}
