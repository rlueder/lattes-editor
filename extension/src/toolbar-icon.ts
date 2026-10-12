// Ícone da barra de extensões: a variante monocromática de brand/extension-toolbar,
// branca nas barras escuras e grafite nas claras. O service worker não enxerga o
// tema do navegador; o painel e o script da página do editor enxergam
// (prefers-color-scheme) e avisam. O último tema fica guardado para o ícone
// voltar certo quando o service worker acorda.

export type ToolbarTheme = 'clara' | 'escura';

export interface ToolbarThemeMessage {
  toolbar: ToolbarTheme;
}

export const TOOLBAR_SIZES = [16, 20, 24, 32] as const;

/** Barra clara até alguém dizer o contrário: o grafite ainda aparece numa barra escura. */
export const DEFAULT_TOOLBAR_THEME: ToolbarTheme = 'clara';

const FOLDER: Record<ToolbarTheme, string> = { clara: 'light', escura: 'dark' };

/** Caminhos dos PNGs da barra, no formato de chrome.action.setIcon e do manifesto. */
export function toolbarIconPaths(theme: ToolbarTheme): Record<string, string> {
  return Object.fromEntries(
    TOOLBAR_SIZES.map((n) => [String(n), `icons/toolbar/${FOLDER[theme]}/icon-${n}.png`]),
  );
}

export function toolbarTheme(prefersDark: boolean): ToolbarTheme {
  return prefersDark ? 'escura' : 'clara';
}

export function isToolbarThemeMessage(value: unknown): value is ToolbarThemeMessage {
  const t = (value as { toolbar?: unknown } | null)?.toolbar;
  return t === 'clara' || t === 'escura';
}
