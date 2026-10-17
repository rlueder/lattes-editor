// A moldura do editor com as listas do Lattes lidas pelo conector
// (use-lattes-lists.ts) à disposição dos campos que as usam, e o aviso dos
// campos que o formulário do Lattes não tem.

import type { ReactNode } from 'react';

import { FocusHandle } from './FocusHandle.tsx';
import { type FormLacks, FormLacksContext } from './form-lacks-context.ts';
import { LattesListsContext } from './lattes-lists-context.ts';
import type { FocusShell } from './use-focus-mode.ts';
import { useLattesLists } from './use-lattes-lists.ts';

export function ShellWithLists({
  children,
  features,
  focus,
  formLacks,
}: {
  children: ReactNode;
  features: readonly string[];
  /** O campo que o formulário do Lattes não tem (form-lacks-context.ts). */
  formLacks?: FormLacks;
  /** Modo foco (com ?leitura): classes da moldura e o puxador da borda. */
  focus?: FocusShell;
}) {
  const lists = useLattesLists(features);
  return (
    <FormLacksContext.Provider value={formLacks}>
      <LattesListsContext.Provider value={lists}>
        <div className={focus?.className ?? 'shell'}>
          {children}
          {focus?.focus.on && (
            <>
              {/* App de macOS: no modo foco o cabeçalho sai, e esta faixa guarda o
                lugar dos botões da janela e deixa arrastar a janela. Só aparece
                com .desktop-mac (styles.css). */}
              <div data-tauri-drag-region aria-hidden="true" className="mac-titlebar-strip" />
              <FocusHandle
                open={focus.menuPinned}
                onToggle={() => focus.setMenuPinned((v) => !v)}
              />
            </>
          )}
        </div>
      </LattesListsContext.Provider>
    </FormLacksContext.Provider>
  );
}
