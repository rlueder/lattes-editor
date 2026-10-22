import { describe, expect, it } from 'vitest';

import { isZip, readZip, ZipError } from '../src/import-export/zip.ts';
import { CvLoadError, encodeCv, loadCv } from '../src/model/document.ts';
import { declaredEncoding, decodeXmlBytes, encodeLatin1 } from '../src/model/latin1.ts';
import { buildZip } from './helpers/zip.ts';

const CV =
  '<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?><CURRICULO-VITAE NUMERO-IDENTIFICADOR="0000000000000001"><DADOS-GERAIS NOME-COMPLETO="Ação"/></CURRICULO-VITAE>';
const latin1 = (s: string) => encodeLatin1(s);

describe('readZip', () => {
  it('lê entradas armazenadas e comprimidas, e ignora diretórios', async () => {
    const zip = await buildZip([
      { data: new Uint8Array(), method: 0, name: 'pasta/' },
      { data: latin1('abc'), method: 0, name: 'a.txt' },
      { data: latin1('x'.repeat(500)), method: 8, name: 'b.txt' },
    ]);
    const entries = await readZip(zip);
    expect(entries.map((e) => e.name)).toEqual(['a.txt', 'b.txt']);
    expect(entries[1]!.data.length).toBe(500);
  });

  it('decodifica nome UTF-8 quando o bit 11 está ligado', async () => {
    const zip = await buildZip([{ data: latin1('1'), flags: 0x800, name: 'currículo.xml' }]);
    expect((await readZip(zip))[0]!.name).toBe('currículo.xml');
  });

  it.each([
    [[{ data: latin1('1'), flags: 0x1, name: 'x.xml' }], 'cifrada'],
    [[{ data: latin1('1'), method: 99 as const, name: 'x.xml' }], 'Método de compressão 99'],
  ])('recusa entradas sem suporte (%#)', async (entries, message) => {
    await expect(readZip(await buildZip(entries))).rejects.toThrow(message);
  });

  it('recusa arquivo sem diretório central', async () => {
    const bytes = new Uint8Array(40);
    bytes.set([0x50, 0x4b, 0x03, 0x04]);
    expect(isZip(bytes)).toBe(true);
    await expect(readZip(bytes)).rejects.toThrow(ZipError);
  });

  it('recusa entrada central e cabeçalho local corrompidos', async () => {
    const zip = await buildZip([{ data: latin1('1'), name: 'x.xml' }]);
    const badCentral = zip.slice();
    const centralAt = new DataView(badCentral.buffer).getUint32(badCentral.length - 6, true);
    badCentral[centralAt] = 0;
    await expect(readZip(badCentral)).rejects.toThrow('entrada corrompida');

    const badLocal = zip.slice();
    badLocal[0] = 0;
    await expect(readZip(badLocal)).rejects.toThrow('Cabeçalho local');
  });
});

describe('loadCv', () => {
  it('carrega ZIP com um XML e usa o identificador como nome', async () => {
    const zip = await buildZip([{ data: latin1(CV), name: 'qualquer.xml' }]);
    const cv = await loadCv(zip, 'CV_0000000000000001.zip');
    expect(cv.fileName).toBe('0000000000000001.xml');
  });

  it('sem identificador, deriva o nome do arquivo de origem', async () => {
    const cv = await loadCv(latin1('<CURRICULO-VITAE/>'), 'meu.zip');
    expect(cv.fileName).toBe('meu.xml');
  });

  it('recusa ZIP sem XML ou com mais de um', async () => {
    const none = await buildZip([{ data: latin1('x'), name: 'a.txt' }]);
    await expect(loadCv(none, 'a.zip')).rejects.toThrow('tem 0');
    const two = await buildZip([
      { data: latin1(CV), name: 'a.xml' },
      { data: latin1(CV), name: 'b.xml' },
    ]);
    await expect(loadCv(two, 'a.zip')).rejects.toThrow('tem 2');
  });

  it('recusa XML malformado e raiz errada', async () => {
    await expect(loadCv(latin1('<A>'), 'a.xml')).rejects.toThrow(CvLoadError);
    await expect(loadCv(latin1('<OUTRA/>'), 'a.xml')).rejects.toThrow('CURRICULO-VITAE');
  });

  it('preserva o BOM de um arquivo UTF-8', async () => {
    const bytes = new TextEncoder().encode(
      '\uFEFF<?xml version="1.0" encoding="UTF-8"?><CURRICULO-VITAE A="é"/>',
    );
    const cv = await loadCv(bytes, 'a.xml');
    expect(cv.encoding).toBe('UTF-8');
    expect(encodeCv(cv.doc, cv.encoding)).toEqual(bytes);
  });

  it('respeita UTF-8 declarado na leitura e na escrita', async () => {
    const text = '<?xml version="1.0" encoding="UTF-8"?><CURRICULO-VITAE A="ação —"/>';
    const bytes = new TextEncoder().encode(text);
    const cv = await loadCv(bytes, 'a.xml');
    expect(cv.encoding).toBe('UTF-8');
    expect(encodeCv(cv.doc, cv.encoding)).toEqual(bytes);
  });
});

describe('codificação declarada', () => {
  it('assume UTF-8 sem declaração e lê o rótulo com BOM', () => {
    expect(declaredEncoding(latin1('<A/>'))).toBe('UTF-8');
    expect(
      declaredEncoding(new TextEncoder().encode('﻿<?xml version="1.0" encoding="latin1"?><A/>')),
    ).toBe('LATIN1');
    expect(
      decodeXmlBytes(latin1('<?xml version="1.0" encoding="iso-8859-1"?><A B="é"/>')).text,
    ).toContain('é');
  });
});

describe('orçamento do ZIP', () => {
  it('seleciona o XML antes de descompactar uma entrada que nem é suportada', async () => {
    const zip = await buildZip([
      { data: latin1(CV), name: 'a.xml' },
      { data: latin1('ignorar'), method: 99, name: 'extra.bin' },
    ]);
    expect((await loadCv(zip, 'a.zip')).doc.root.name).toBe('CURRICULO-VITAE');
  });

  it('recusa excesso de entrada, quantidade e saída declarada antes da expansão', async () => {
    const zip = await buildZip([{ data: latin1('x'.repeat(1000)), name: 'a.xml' }]);
    await expect(readZip(zip, { maxInputBytes: 10 })).rejects.toThrow('tamanho');
    await expect(readZip(zip, { maxEntries: 0 })).rejects.toThrow('entradas demais');
    await expect(readZip(zip, { maxOutputBytes: 100 })).rejects.toThrow('descompressão');
  });

  it('mede a saída real, mesmo com tamanho declarado falso', async () => {
    const zip = await buildZip([{ data: latin1('x'.repeat(10_000)), name: 'a.xml' }]);
    const view = new DataView(zip.buffer);
    const central = view.getUint32(zip.length - 6, true);
    view.setUint32(central + 24, 1, true);
    await expect(readZip(zip, { maxOutputBytes: 100 })).rejects.toThrow('descompressão');
    await expect(readZip(zip)).rejects.toThrow('descompressão');
  });

  it('recusa a expansão acima do tamanho da entrada mesmo com orçamento global livre', async () => {
    const zip = await buildZip([{ data: latin1('x'.repeat(200_000)), name: 'a.xml' }]);
    const view = new DataView(zip.buffer);
    const central = view.getUint32(zip.length - 6, true);
    view.setUint32(central + 24, 0, true);
    await expect(readZip(zip)).rejects.toThrow('descompressão');
    view.setUint32(central + 24, 300_000, true);
    await expect(readZip(zip)).rejects.toThrow('Tamanho descomprimido');
  });

  it('recusa cabeçalhos truncados com um erro de ZIP', async () => {
    const zip = await buildZip([{ data: latin1('x'), name: 'a.xml' }]);
    const view = new DataView(zip.buffer);
    const central = view.getUint32(zip.length - 6, true);
    view.setUint32(central + 42, zip.length - 1, true);
    await expect(readZip(zip)).rejects.toThrow(ZipError);
  });
});
