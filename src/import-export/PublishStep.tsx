// ③ Publicar no CNPq, na janela "Enviar ao Lattes" (ExportPanel): o painel
// de envio, ou o porquê de ele ainda não abrir, ou, depois de publicar, a
// confirmação. Sem ela, a janela voltava ao passo ① sem dizer se tinha dado
// certo (teste acompanhado de 16/10/2026).

import type { BridgeState } from '../ui/use-bridge.ts';
import { PublishPanel } from './PublishPanel.tsx';
import { publishLock, timeLabel } from './send-steps.ts';
import { Notice, Step } from './SendSteps.tsx';

export interface PublishContext {
  checks?: { count: number; onOpen: () => void };
  lattesId?: string;
  originalXml?: string;
}

interface Props {
  bridge: BridgeState;
  open: boolean;
  publish: PublishContext;
  /** Quando esta janela publicou; undefined antes. */
  publishedAt?: number;
  toPublish: boolean;
  toWrite: number;
  writing: boolean;
  onClose: () => void;
  onPublished: () => void;
}

export function PublishStep(props: Props) {
  const { bridge, open, publish, publishedAt, toPublish, toWrite, writing } = props;
  if (publishedAt !== undefined && !toPublish) {
    return (
      <Step title="Publicar no CNPq">
        <Notice ok>
          <p>Publicado no CNPq às {timeLabel(publishedAt)}. O Lattes não tem mais nada pendente.</p>
        </Notice>
      </Step>
    );
  }
  const locked = publishLock(writing, toWrite, toPublish);
  return (
    <Step locked={locked} title="Publicar no CNPq">
      <PublishPanel
        inline
        bridge={bridge}
        checks={publish.checks}
        lattesId={publish.lattesId}
        open={open && !locked}
        originalXml={publish.originalXml}
        onClose={props.onClose}
        onPublished={props.onPublished}
      />
    </Step>
  );
}
