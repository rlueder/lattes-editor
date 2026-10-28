// As regras de "Carregar do Lattes" no editor (src/ui/lattes-load.ts): a
// resposta no formato da do Exportar e o que fica no sino.

import { describe, expect, it } from 'vitest';

import { fromBase64 } from '../src/bridge/export.ts';
import { decodeLatin1 } from '../src/model/latin1.ts';
import { element } from '../src/model/xml.ts';
import { LOADED_NAME, loadNotice, loadReply, progressText } from '../src/ui/lattes-load.ts';

const doc = {
  epilog: '\n',
  prolog: '<?xml version="1.0" encoding="ISO-8859-1" standalone="no" ?>\n',
  root: element('CURRICULO-VITAE', { 'NUMERO-IDENTIFICADOR': '1234567890123456' }),
};

describe('loadReply', () => {
  it('leva o XML em Latin-1, com o currículo da sessão', () => {
    const r = loadReply('p1', { doc, gaps: [], pages: 3 }, undefined, 5);
    expect(r).toMatchObject({
      at: 5,
      fileName: LOADED_NAME,
      id: 'p1',
      lattesId: '1234567890123456',
    });
    expect(decodeLatin1(fromBase64(r.zip!))).toContain('NUMERO-IDENTIFICADOR="1234567890123456"');
  });

  it('a leitura parada vira o motivo que a tela do Exportar entende', () => {
    const stopped = {
      gaps: [],
      pages: 0,
      stopped: { error: 'A sessão do Lattes caiu.', reason: 'sessao' as const },
    };
    expect(loadReply('p', stopped, undefined, 1)).toMatchObject({ reason: 'sessao' });
    const erro = { gaps: [], pages: 0, stopped: { error: 'x', reason: 'erro' as const } };
    expect(loadReply('p', erro, { reason: 'consentimento' }, 1)).toMatchObject({
      reason: 'consentimento',
    });
    expect(loadReply('p', erro, { reason: 'sem-aba' }, 1)).toMatchObject({ reason: 'sem-aba' });
    expect(loadReply('p', erro, { reason: 'ocupado' }, 1)).toMatchObject({
      detail: 'x',
      reason: 'erro',
    });
  });
});

describe('o andamento e o sino', () => {
  it('diz a fase e as páginas', () => {
    expect(progressText({ done: 0, phase: 'menu' })).toBe('Lendo o menu do currículo.');
    expect(progressText({ done: 12, phase: 'listas' })).toBe('Lendo as listas (12 páginas).');
    expect(progressText({ done: 40, phase: 'formularios' })).toBe(
      'Lendo os formulários (40 páginas).',
    );
  });

  it('lista o que não veio, com a contagem', () => {
    expect(loadNotice([])).toBeUndefined();
    expect(
      loadNotice([
        {
          count: 9,
          reason: 'o tipo de participação, que a página monta por script',
          section: 'Participação em eventos',
        },
        { count: 1, reason: 'o formulário do item não abriu', section: 'Idiomas' },
      ]),
    ).toEqual({
      id: 'carregar-lattes',
      level: 'info',
      text: 'Participação em eventos: o tipo de participação, que a página monta por script (9). Idiomas: o formulário do item não abriu.',
      title: 'O que não veio dos formulários do Lattes',
    });
  });
});
