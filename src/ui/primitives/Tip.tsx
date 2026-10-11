// Dica curta ao passar o mouse ou focar (Tooltip do Base UI). O botão
// continua com aria-label; a dica é só visual.

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { ReactElement } from 'react';

export function Tip({ children, label }: { children: ReactElement; label: string }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner className="popup-positioner" sideOffset={6}>
          <TooltipPrimitive.Popup className="tip">{label}</TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const TipProvider = TooltipPrimitive.Provider;
