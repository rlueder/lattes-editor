// "Trazer itens de outro XML…" (LAT-45): lê o arquivo, passa as produções
// pelo pré-diff contra o currículo aberto e, com a escolha da pessoa, inclui
// as marcadas como itens novos.

import { useState } from 'react';

import type { Session } from '../forms/use-production.ts';
import { loadCv } from '../model/document.ts';
import { type IncomingItem, preDiff } from '../review/dedup.ts';
import { lattesSchema as schema } from '../schema/lattes.ts';
import { toasts } from '../ui/toasts.ts';
import { addIncoming, incomingItems } from './incoming.ts';
import { IncomingReview } from './IncomingReview.tsx';

export function useIncoming(
  session: Session | null,
  setSession: (s: Session) => void,
  onEdit: (note: string) => void,
) {
  const [review, setReview] = useState<{ diff: IncomingItem[]; fileName: string } | undefined>();

  const pick = async (file: File) => {
    if (!session) return;
    try {
      const cv = await loadCv(new Uint8Array(await file.arrayBuffer()), file.name);
      const items = incomingItems(schema, cv.doc.root);
      if (items.length === 0) {
        toasts.add({
          description: 'O arquivo não tem produções que o Importar do Lattes leia.',
          title: 'Nada para trazer',
        });
        return;
      }
      setReview({ diff: preDiff(items, session.doc.root), fileName: file.name });
    } catch (err) {
      toasts.add({ description: (err as Error).message, title: 'O arquivo não abriu' });
    }
  };

  const include = (chosen: IncomingItem[]) => {
    setReview(undefined);
    if (!session || chosen.length === 0) return;
    const next = addIncoming(
      schema,
      session.doc,
      chosen.map((c) => c.item),
      session.meta.nextSequencia,
    );
    setSession({ doc: session.doc, meta: { ...session.meta, nextSequencia: next } });
    onEdit(
      chosen.length === 1 ? '1 item de outro arquivo' : `${chosen.length} itens de outro arquivo`,
    );
  };

  const dialog = (
    <IncomingReview
      diff={review?.diff}
      fileName={review?.fileName}
      onCancel={() => setReview(undefined)}
      onInclude={include}
    />
  );

  return { dialog, pick: (file: File) => void pick(file) };
}
