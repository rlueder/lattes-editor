import { describe, expect, it } from 'vitest';

import { DEV_PAGE_URL, isDevVersion } from '../src/desktop/dev-channel.ts';
import { connectionLink, connectionText, devExtensionHowTo } from '../src/ui/notifications.ts';

describe('canal Dev', () => {
  it('reconhece a versão do canal Dev', () => {
    expect(isDevVersion('0.22.0-dev.42')).toBe(true);
    expect(isDevVersion('0.22.0')).toBe(false);
    expect(isDevVersion('0.22.0-dev')).toBe(false);
  });

  it('sem extensão, o app Dev diz qual pasta carregar', () => {
    const folder = '/Users/x/Library/Application Support/dev.lattes-editor.app.dev/extensao-dev';
    const text = connectionText({ kind: 'sem-extensao' }, '0.22.0-dev.3', folder);
    expect(text).toContain('A extensão Dev não respondeu.');
    expect(text).toContain(`a pasta ${folder}`);
    expect(text).toContain('Carregar sem compactação');
    // Sem a pasta ainda lida, aponta a página do canal.
    expect(devExtensionHowTo(undefined)).toContain(DEV_PAGE_URL);
    // O app publicado continua com o texto de sempre.
    expect(connectionText({ kind: 'sem-extensao' }, '0.22.0')).toContain(
      'A extensão do LattesEditor não respondeu.',
    );
  });

  it('a extensão Dev desatualizada vem da página do canal', () => {
    expect(
      connectionLink({ kind: 'extensao-antiga', version: '0.22.0-dev.1' }, '0.22.0-dev.3'),
    ).toEqual({
      href: DEV_PAGE_URL,
      label: 'Baixe a extensão Dev da página do canal.',
    });
    expect(connectionLink({ kind: 'extensao-antiga', version: '0.21.0' }, '0.22.0')?.href).not.toBe(
      DEV_PAGE_URL,
    );
  });
});
