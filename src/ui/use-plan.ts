// O plano do envio: as mudanças da lista viradas em operações do conector,
// com as opções da extensão ligada, os textos que o XML não guarda e a
// exportação carregada, onde a exclusão acha o item que a pessoa tirou
// (delete-items.ts).

import { useMemo } from 'react';

import { planChanges, planOptionsFor } from '../bridge/plan.ts';
import type { Session } from '../forms/use-production.ts';
import { parseXml } from '../model/xml.ts';
import type { ChangeGroup } from './changes-view.ts';
import { useSendExtras } from './send-extras.ts';

export function usePlan(
  session: Session | null,
  groups: ChangeGroup[],
  features: readonly string[],
): ReturnType<typeof planChanges> {
  const entries = useMemo(() => groups.flatMap((g) => g.entries), [groups]);
  // Os textos que o envio pede e o XML não guarda (o potencial de inovação).
  const extras = useSendExtras();
  const originalXml = session?.meta.originalXml;
  const original = useMemo(
    () => (originalXml ? parseXml(originalXml).root : undefined),
    [originalXml],
  );
  return useMemo(
    () =>
      session
        ? planChanges(
            entries,
            session.doc.root,
            { ...planOptionsFor(features), extras, original },
            true,
          )
        : { ops: [], unsupported: [] },
    [session, entries, features, extras, original],
  );
}
