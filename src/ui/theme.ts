// Preferência de tema: "sistema" segue o sistema operacional; "claro" e
// "escuro" fixam o tema com data-theme no <html>. Fica no localStorage deste
// navegador, que pode falhar (janela anônima, armazenamento bloqueado); nesse
// caso o tema volta a seguir o sistema.

import { useEffect, useState } from 'react';

export type ThemePref = 'sistema' | 'claro' | 'escuro';

const KEY = 'lattes-editor:tema';

export function readTheme(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'claro' || v === 'escuro' ? v : 'sistema';
  } catch {
    return 'sistema';
  }
}

export function applyTheme(pref: ThemePref, root: HTMLElement = document.documentElement): void {
  if (pref === 'sistema') delete root.dataset.theme;
  else root.dataset.theme = pref === 'claro' ? 'light' : 'dark';
}

export function useTheme(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(readTheme);
  useEffect(() => {
    applyTheme(pref);
    try {
      if (pref === 'sistema') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch {
      // Sem armazenamento: o tema vale só até recarregar a página.
    }
  }, [pref]);
  return [pref, setPref];
}
