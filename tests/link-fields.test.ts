import { describe, expect, it } from 'vitest';

import {
  cleanDoi,
  cleanLinkValue,
  cleanUrl,
  doiError,
  doiLink,
  isDoiAttr,
  isUrlAttr,
  linkError,
  linkHref,
  linkPieces,
  linkRanges,
  shortUrl,
  urlError,
  urlForLink,
} from '../src/ui/link-fields.ts';

describe('DOI', () => {
  it('reconhece DOI e *-DOI', () => {
    expect(isDoiAttr('DOI')).toBe(true);
    expect(isDoiAttr('ALGO-DOI')).toBe(true);
    expect(isDoiAttr('DOIS')).toBe(false);
  });

  it('guarda como foi digitado, só sem espaços nas pontas', () => {
    expect(cleanDoi('  10.1590/s0100-879x2004000100001 ')).toBe('10.1590/s0100-879x2004000100001');
    expect(cleanDoi('https://doi.org/10.1/x')).toBe('https://doi.org/10.1/x');
  });

  it('confere a forma pelo padrão do Crossref, sem diferença de maiúscula', () => {
    expect(doiError('')).toBeUndefined();
    expect(doiError('10.1590/S0100-879X2004000100001')).toBeUndefined();
    expect(doiError('10.1002/(SICI)1097-4636(199712)38:4<370::AID-JBM10>3.0.CO;2-K')).toBe(
      'DOI: formato esperado 10.xxxx/…',
    );
    expect(doiError('1234567890')).toBe('DOI: formato esperado 10.xxxx/…');
    expect(doiError('https://doi.org/10.5555/demo.1')).toBe(
      'DOI: formato esperado 10.xxxx/… (aqui, 10.5555/demo.1)',
    );
  });

  it('o link vai ao doi.org, de qualquer forma colada', () => {
    expect(doiLink('10.5555/demo.1')).toBe('https://doi.org/10.5555/demo.1');
    expect(doiLink('doi:10.5555/demo.1')).toBe('https://doi.org/10.5555/demo.1');
    expect(doiLink('http://dx.doi.org/10.5555/demo.1')).toBe('https://doi.org/10.5555/demo.1');
    expect(doiLink('1234567890')).toBeUndefined();
  });
});

describe('endereço na web', () => {
  it('reconhece HOME-PAGE e parecidos', () => {
    expect(isUrlAttr('HOME-PAGE')).toBe(true);
    expect(isUrlAttr('HOME-PAGE-DO-TRABALHO')).toBe(true);
    expect(isUrlAttr('E-MAIL')).toBe(false);
  });

  it('tira os espaços, nas pontas e no meio, e guarda o resto como veio', () => {
    expect(cleanUrl('  www.ufrgs .br/ genetica ')).toBe('www.ufrgs.br/genetica');
    expect(cleanUrl('http://foo.com')).toBe('http://foo.com');
  });

  it('para abrir, sem esquema vale https://; o http:// digitado fica', () => {
    expect(urlForLink('www.foo.com')).toBe('https://www.foo.com');
    expect(urlForLink('foo.com')).toBe('https://foo.com');
    expect(urlForLink('http://foo.com')).toBe('http://foo.com');
  });

  it('avisa quando o endereço não serve', () => {
    expect(urlError('')).toBeUndefined();
    expect(urlError('https://foo.com')).toBeUndefined();
    expect(urlError('www.ufrgs.br/genetica')).toBeUndefined();
    const bad = 'Endereço inválido: confira o domínio (exemplo: www.ufrgs.br)';
    expect(urlError('foo')).toBe(bad);
    expect(urlError('http://localhost:3000')).toBe(bad);
    expect(urlError('ftp://foo.com')).toBe(bad);
    expect(urlError('https://exa mple')).toBe(bad);
    expect(urlError('http://[::1')).toBe(bad);
  });
});

describe('por atributo', () => {
  it('limpa, avisa e liga só DOI e endereço', () => {
    expect(cleanLinkValue('DOI', ' 10.1/x ')).toBe('10.1/x');
    expect(cleanLinkValue('HOME-PAGE', ' a .com ')).toBe('a.com');
    expect(cleanLinkValue('TITULO', ' a b ')).toBe(' a b ');
    expect(linkError('DOI', 'x')).toBeDefined();
    expect(linkError('HOME-PAGE', 'x')).toBeDefined();
    expect(linkError('TITULO', 'x')).toBeUndefined();
    expect(linkHref('DOI', '10.5555/a')).toBe('https://doi.org/10.5555/a');
    expect(linkHref('HOME-PAGE', 'foo.com')).toBe('https://foo.com');
    expect(linkHref('HOME-PAGE', 'foo')).toBeUndefined();
    expect(linkHref('ORCID-ID', 'https://orcid.org/0000-0002-1825-0097')).toBe(
      'https://orcid.org/0000-0002-1825-0097',
    );
    expect(linkHref('TITULO', 'foo.com')).toBeUndefined();
    expect(linkHref('DOI', ' ')).toBeUndefined();
  });
});

describe('todo endereço da prévia vira link', () => {
  it('pelo valor (http, https, www.) em qualquer campo, e e-mail como mailto', () => {
    expect(linkHref('OUTRA-COISA', 'www.ufrgs.br')).toBe('https://www.ufrgs.br');
    expect(linkHref('OUTRA-COISA', 'http://foo.com/a')).toBe('http://foo.com/a');
    expect(linkHref('OUTRA-COISA', 'texto qualquer')).toBeUndefined();
    expect(linkHref('E-MAIL', 'ana@ufrgs.br')).toBe('mailto:ana@ufrgs.br');
    expect(linkHref('E-MAIL', 'sem arroba')).toBeUndefined();
  });

  it('encurta o texto do link como antes', () => {
    expect(shortUrl('https://www.ufrgs.br/genetica/')).toBe('ufrgs.br/genetica');
    expect(shortUrl('www.ufrgs.br')).toBe('ufrgs.br');
  });

  it('acha endereços e e-mails no texto corrido, sem a pontuação final', () => {
    expect(linkPieces('DOI: https://doi.org/10.5555/a.1.')).toEqual([
      { text: 'DOI: ' },
      { href: 'https://doi.org/10.5555/a.1', text: 'https://doi.org/10.5555/a.1' },
      { text: '.' },
    ]);
    expect(linkPieces('I: ana@ufrgs.br, R: ana@gmail.com')).toEqual([
      { text: 'I: ' },
      { href: 'mailto:ana@ufrgs.br', text: 'ana@ufrgs.br' },
      { text: ', R: ' },
      { href: 'mailto:ana@gmail.com', text: 'ana@gmail.com' },
    ]);
    expect(linkPieces('nada aqui')).toEqual([{ text: 'nada aqui' }]);
    expect(linkRanges('ver https://a.com/x, fim')).toEqual([
      { end: 19, href: 'https://a.com/x', start: 4 },
    ]);
  });
});
