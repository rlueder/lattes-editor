import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { encodeCv, loadCv, maxSequenciaProducao } from '../src/model/document.ts';
import { findOrderViolations, insertInSchemaOrder } from '../src/model/schema-order.ts';
import { childElements, element, parseXml, serializeXml } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';

const FIXTURES = join(import.meta.dirname, '../fixtures');
const read = (name: string) => new Uint8Array(readFileSync(join(FIXTURES, name)));

describe('ida e volta das fixtures', () => {
  it.each(['synthetic_full.xml', 'synthetic_minimal.xml', 'synthetic_minimal.zip'])(
    '%s volta byte a byte',
    async (name) => {
      const cv = await loadCv(read(name), name);
      expect(Buffer.from(encodeCv(cv.doc, cv.encoding)).equals(Buffer.from(cv.originalBytes))).toBe(
        true,
      );
    },
  );

  it('usa <NUMERO-IDENTIFICADOR>.xml como nome de arquivo', async () => {
    const cv = await loadCv(read('synthetic_minimal.zip'), 'CV_0000000000000001.zip');
    expect(cv.fileName).toBe('0000000000000001.xml');
  });

  it('as fixtures respeitam a ordem do schema', async () => {
    for (const name of ['synthetic_full.xml', 'synthetic_minimal.xml']) {
      const cv = await loadCv(read(name), name);
      expect(findOrderViolations(lattesSchema, cv.doc.root)).toEqual([]);
    }
  });
});

// Exportação real, só local: coloque o CV_<id>.zip em fixtures/real/ (no .gitignore).
const REAL_DIR = join(FIXTURES, 'real');
const realFiles = existsSync(REAL_DIR)
  ? readdirSync(REAL_DIR).filter((f) => /\.(zip|xml)$/i.test(f))
  : [];

describe.skipIf(realFiles.length === 0)('exportação real (fixtures/real/)', () => {
  it.each(realFiles)('%s volta byte a byte', async (name) => {
    const cv = await loadCv(new Uint8Array(readFileSync(join(REAL_DIR, name))), name);
    expect(Buffer.from(encodeCv(cv.doc, cv.encoding)).equals(Buffer.from(cv.originalBytes))).toBe(
      true,
    );
  });
});

describe('ordem do schema', () => {
  it('insere TRABALHOS-EM-EVENTOS antes de ARTIGOS-PUBLICADOS', () => {
    const pb = parseXml(
      '<PRODUCAO-BIBLIOGRAFICA><ARTIGOS-PUBLICADOS/></PRODUCAO-BIBLIOGRAFICA>',
    ).root;
    insertInSchemaOrder(lattesSchema, pb, element('TRABALHOS-EM-EVENTOS'));
    expect(childElements(pb).map((c) => c.name)).toEqual([
      'TRABALHOS-EM-EVENTOS',
      'ARTIGOS-PUBLICADOS',
    ]);
  });

  it('insere um item repetido depois dos irmãos de mesmo nome', () => {
    const c = parseXml(
      '<TRABALHOS-EM-EVENTOS><TRABALHO-EM-EVENTOS N="1"/></TRABALHOS-EM-EVENTOS>',
    ).root;
    insertInSchemaOrder(lattesSchema, c, element('TRABALHO-EM-EVENTOS', { N: '2' }));
    expect(serializeXml({ prolog: '', root: c, epilog: '' })).toBe(
      '<TRABALHOS-EM-EVENTOS><TRABALHO-EM-EVENTOS N="1"/><TRABALHO-EM-EVENTOS N="2"/></TRABALHOS-EM-EVENTOS>',
    );
  });

  it('aponta elemento fora de ordem', () => {
    const root = parseXml(
      '<PRODUCAO-BIBLIOGRAFICA><ARTIGOS-PUBLICADOS/><TRABALHOS-EM-EVENTOS/></PRODUCAO-BIBLIOGRAFICA>',
    ).root;
    expect(findOrderViolations(lattesSchema, root)).toEqual([
      'PRODUCAO-BIBLIOGRAFICA/TRABALHOS-EM-EVENTOS: fora da ordem do schema',
    ]);
  });
});

describe('SEQUENCIA-PRODUCAO', () => {
  it('pega o maior valor entre todos os tipos de produção', () => {
    const doc = parseXml(
      '<CURRICULO-VITAE><X SEQUENCIA-PRODUCAO="3"/><Y><Z SEQUENCIA-PRODUCAO="32"/></Y><W SEQUENCIA-PRODUCAO="7"/></CURRICULO-VITAE>',
    );
    expect(maxSequenciaProducao(doc)).toBe(32);
  });
});
