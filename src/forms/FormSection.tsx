// Parte de um formulário de item novo: aberta com a legenda, como sempre, ou
// fechada numa linha que abre (DisclosureGroup) quando o formulário é longo.

import type { ReactNode } from 'react';

import type { GroupFacts } from '../ui/disclosure.ts';
import { DisclosureGroup } from '../ui/DisclosureGroup.tsx';
import type { GroupStart } from '../ui/use-group-starts.ts';

export function FormSection({
  children,
  facts,
  start,
}: {
  children: ReactNode;
  facts: GroupFacts & { summary: string };
  start: GroupStart;
}) {
  if (!start.collapsible) {
    return (
      <fieldset className="form-fieldset">
        <legend>{facts.label}</legend>
        {children}
      </fieldset>
    );
  }
  return (
    <div className="form-fieldset form-disclosure">
      <DisclosureGroup
        filled={facts.filled}
        forceOpen={facts.error}
        initialOpen={start.open}
        label={facts.label}
        summary={facts.summary}
        titleClass="disclosure-title-legend"
      >
        {children}
      </DisclosureGroup>
    </div>
  );
}
