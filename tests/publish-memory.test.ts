import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadChoices, saveChoices } from '../src/import-export/publish-memory.ts';
import { initialForm } from '../src/import-export/publish-view.ts';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    removeItem: (k: string) => void data.delete(k),
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

afterEach(() => vi.unstubAllGlobals());

const SCREEN = {
  declaration: 'Declaro…',
  emailAlternative: '',
  emailContact: 'lattes@example.org',
  english: { checked: false, label: 'Autorizo', value: '1' },
  language: {
    options: [
      { label: 'Português', value: '1' },
      { label: 'Inglês', value: '2' },
    ],
  },
};

describe('as escolhas da última vez na janela de envio', () => {
  it('ficam por currículo, só os quatro campos, nunca a declaração', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    const form = {
      declarationAccepted: true,
      emailAlternative: 'alt@example.org',
      emailContact: 'a@example.org',
      english: true,
      language: '2',
    };
    saveChoices('1234', form);
    expect(loadChoices('1234')).toEqual({
      emailAlternative: 'alt@example.org',
      emailContact: 'a@example.org',
      english: true,
      language: '2',
    });
    expect([...storage.data.values()].join()).not.toContain('declaration');
    expect(loadChoices('9999')).toEqual({});
    expect(loadChoices(undefined)).toEqual({});
    // Lixo no armazenamento: começa vazio.
    storage.setItem('lattes-editor:envio-escolhas:1234', '{"english":"sim","language":2}');
    expect(loadChoices('1234')).toEqual({});
    storage.setItem('lattes-editor:envio-escolhas:1234', 'não é json');
    expect(loadChoices('1234')).toEqual({});
  });

  it('o idioma e a versão em inglês voltam; os e-mails do Lattes ganham dos guardados', () => {
    const form = initialForm(SCREEN, {
      emailAlternative: 'alt@example.org',
      emailContact: 'antigo@example.org',
      english: true,
      language: '2',
    });
    expect(form).toEqual({
      // O Lattes trouxe o alternativo vazio: entra o da última vez.
      emailAlternative: 'alt@example.org',
      emailContact: 'lattes@example.org',
      english: true,
      language: '2',
    });
    // Um idioma que a tela não tem mais não volta.
    expect(initialForm(SCREEN, { language: '9' }).language).toBe('');
    // Sem o controle na tela, nada volta: o envio é recusado do mesmo jeito.
    expect(initialForm({ declaration: 'D' }, { english: true, language: '1' })).toEqual({
      emailAlternative: '',
      emailContact: '',
      english: false,
      language: '',
    });
  });
});
