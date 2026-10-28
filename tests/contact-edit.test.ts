import { describe, expect, it } from 'vitest';

import {
  contactValueProblem,
  editableContacts,
  replaceContactValue,
} from '../src/model/contact-edit.ts';

const EMAILS = ' I: contato@example.org ;\r\n R: outro@example.org  ';
const SOCIAL =
  'ID Rede Social: 001, Nome Rede Social: Linkedin, Endereço: https://example.org/antes';

describe('edição de contatos sem reconstruir a serialização', () => {
  it('troca só o e-mail escolhido e preserva prefixos, espaços e separadores', () => {
    const fields = editableContacts('ELETRONICO', EMAILS)!;
    expect(fields.map((f) => [f.label, f.kind, f.value])).toEqual([
      ['E-mail para contato', 'email', 'contato@example.org'],
      ['E-mail alternativo', 'email', 'outro@example.org'],
    ]);
    for (const field of fields) expect(EMAILS.slice(field.start, field.end)).toBe(field.value);
    expect(replaceContactValue(EMAILS, 'ELETRONICO', 1, ' novo+teste@example.org ')).toBe(
      ' I: contato@example.org ;\r\n R: novo+teste@example.org  ',
    );
    expect(replaceContactValue(EMAILS, 'ELETRONICO', 0, fields[0]!.value)).toBe(EMAILS);
  });

  it('troca só a URL, sem normalizar o ID, o nome nem o texto de outros registros', () => {
    const raw = `${SOCIAL}; ID Rede Social: 25, Nome Rede Social: GitHub, Endereço: https://example.org/outro`;
    const fields = editableContacts('REDE-SOCIAL', raw)!;
    expect(fields.map((f) => f.label)).toEqual(['LinkedIn', 'GitHub']);
    expect(replaceContactValue(raw, 'REDE-SOCIAL', 0, 'https://example.org/nova?a=1&b=2')).toBe(
      raw.replace('https://example.org/antes', 'https://example.org/nova?a=1&b=2'),
    );
  });

  it('entradas coladas sem separador, como na exportação real: troca só a URL escolhida', () => {
    const raw = `ID Rede Social: 1, Nome Rede Social: Linkedin, Endereço: https://example.org/in/a/ID Rede Social: 2, Nome Rede Social: GitHub, Endereço: https://example.org/b`;
    const fields = editableContacts('REDE-SOCIAL', raw)!;
    expect(fields.map((f) => [f.label, f.value])).toEqual([
      ['LinkedIn', 'https://example.org/in/a/'],
      ['GitHub', 'https://example.org/b'],
    ]);
    expect(replaceContactValue(raw, 'REDE-SOCIAL', 0, 'https://example.org/in/c/')).toBe(
      raw.replace('https://example.org/in/a/', 'https://example.org/in/c/'),
    );
  });

  it('não reescreve uma legenda com problema de codificação', () => {
    const raw = SOCIAL.replace('Endereço', 'EndereÃ§o');
    expect(replaceContactValue(raw, 'REDE-SOCIAL', 0, 'https://example.org/nova')).toBe(
      raw.replace('https://example.org/antes', 'https://example.org/nova'),
    );
  });

  it.each([
    ['ELETRONICO', 'sem-tipo@example.org'],
    ['ELETRONICO', 'I: a@example.org; I: b@example.org'],
    ['ELETRONICO', 'I: a@example.org; conteúdo desconhecido'],
    ['REDE-SOCIAL', 'https://example.org'],
    ['REDE-SOCIAL', `${SOCIAL}; ${SOCIAL}`],
    ['REDE-SOCIAL', `${SOCIAL}; conteúdo desconhecido`],
    ['REDE-SOCIAL', SOCIAL.replace('001', 'código desconhecido')],
    ['OUTRA-FORMA-DE-CONTATO', 'texto'],
    ['ELETRONICO', ''],
  ])('mantém %s desconhecido ou ambíguo somente para leitura', (attr, raw) => {
    expect(editableContacts(attr!, raw!)).toBeUndefined();
    expect(replaceContactValue(raw!, attr!, 0, 'novo@example.org')).toBeUndefined();
  });

  it.each(['', 'inválido', 'a@b', 'a@example.org; R: extra@example.org', 'a@example.org,extra'])(
    'recusa e-mail inválido: %s',
    (value) => {
      expect(contactValueProblem('email', value)).toBeTruthy();
      expect(replaceContactValue(EMAILS, 'ELETRONICO', 0, value)).toBeUndefined();
    },
  );

  it.each([
    '',
    '/relativo',
    'javascript:alert(1)',
    'ftp://example.org',
    'https://example.org/x;y',
    'https://example.org/x,y',
    'https://example.org/ x',
  ])('recusa URL insegura ou com delimitador: %s', (value) => {
    expect(contactValueProblem('url', value)).toBeTruthy();
    expect(replaceContactValue(SOCIAL, 'REDE-SOCIAL', 0, value)).toBeUndefined();
  });

  it('outra forma de contato: o contato é texto, sem espaço nem delimitador', () => {
    const raw =
      'ID Rede Social: 1000001, Nome Rede Social: MSN, Endereço: a@example.orgID Rede Social: 1000002, Nome Rede Social: WhatsApp, Endereço: 5551999990000';
    const fields = editableContacts('OUTRA-FORMA-DE-CONTATO', raw)!;
    expect(fields.map((f) => [f.kind, f.value])).toEqual([
      ['text', 'a@example.org'],
      ['text', '5551999990000'],
    ]);
    expect(replaceContactValue(raw, 'OUTRA-FORMA-DE-CONTATO', 1, '5551988880000')).toBe(
      raw.replace('5551999990000', '5551988880000'),
    );
    for (const bad of ['', 'dois termos', 'a,b', 'a;b']) {
      expect(contactValueProblem('text', bad)).toBeTruthy();
    }
  });

  it('índice inexistente não altera um contato diferente', () => {
    expect(replaceContactValue(EMAILS, 'ELETRONICO', -1, 'novo@example.org')).toBeUndefined();
    expect(replaceContactValue(EMAILS, 'ELETRONICO', 2, 'novo@example.org')).toBeUndefined();
    expect(contactValueProblem('url', 'http://example.org')).toBeUndefined();
  });
});
