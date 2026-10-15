// A moldura do editor com as listas do Lattes lidas pelo conector
// (use-lattes-lists.ts) à disposição dos campos que as usam.

import type { ReactNode } from 'react';

import { FocusHandle } from './FocusHandle.tsx';
import { LattesListsContext } from './lattes-lists-context.ts';
import type { FocusShell } from './use-focus-mode.ts';
import { useLattesLists } from './use-lattes-lists.ts';

export function ShellWithLists({
  children,
  features,
  focus,
}: {
  children: ReactNode;
  features: readonly string[];
  /** Modo foco (com ?leitura): classes da moldura e o puxador da borda. */
  focus?: FocusShell;
}) {
  const lists = useLattesLists(features);
  return (
    <LattesListsContext.Provider value={lists}>
      <div className={focus?.className ?? 'shell'}>
        {children}
        {focus?.focus.on && (
          <>
            {/* App de macOS: no modo foco o cabeçalho sai, e esta faixa guarda o
                lugar dos botões da janela e deixa arrastar a janela. Só aparece
                com .desktop-mac (styles.css). */}
            <div data-tauri-drag-region aria-hidden="true" className="mac-titlebar-strip" />
            <FocusHandle open={focus.menuPinned} onToggle={() => focus.setMenuPinned((v) => !v)} />
          </>
        )}
      </div>
    </LattesListsContext.Provider>
  );
}
