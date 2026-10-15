// Opções da composição do modo de leitura que vêm da tela: modo de
// privacidade e "Mostrar códigos do Lattes".

import { useHideSensitive } from './privacy.ts';
import type { LayoutOptions } from './reading-layout.ts';
import { useShowCodes } from './show-codes.ts';

export function useLayoutOptions(): LayoutOptions {
  return { hideSensitive: useHideSensitive(), showCodes: useShowCodes() };
}
