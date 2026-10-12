import { describe, expect, it } from 'vitest';

import {
  isToolbarThemeMessage,
  toolbarIconPaths,
  toolbarTheme,
} from '../extension/src/toolbar-icon.ts';

describe('ícone da barra de extensões', () => {
  it('branco na barra escura, grafite na clara', () => {
    expect(toolbarTheme(true)).toBe('escura');
    expect(toolbarTheme(false)).toBe('clara');
    expect(toolbarIconPaths('escura')).toEqual({
      16: 'icons/toolbar/dark/icon-16.png',
      20: 'icons/toolbar/dark/icon-20.png',
      24: 'icons/toolbar/dark/icon-24.png',
      32: 'icons/toolbar/dark/icon-32.png',
    });
    expect(toolbarIconPaths('clara')['16']).toBe('icons/toolbar/light/icon-16.png');
  });

  it('só aceita mensagem com um dos dois temas', () => {
    expect(isToolbarThemeMessage({ toolbar: 'escura' })).toBe(true);
    expect(isToolbarThemeMessage({ toolbar: 'azul' })).toBe(false);
    expect(isToolbarThemeMessage({ cmd: 'aplicar' })).toBe(false);
    expect(isToolbarThemeMessage(null)).toBe(false);
  });
});
