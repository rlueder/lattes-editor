// Carregar e salvar o currículo: ZIP ou XML de entrada, XML de saída na mesma
// codificação declarada (ISO-8859-1 nas exportações do Lattes).

import { isZip, readZip } from '../import-export/zip.ts';
import { withoutScreenAttrs } from '../schema/screen-fields.ts';
import { decodeXmlBytes, encodeLatin1, isLatin1Label } from './latin1.ts';
import { getAttr, parseXml, serializeXml, walk, type XDocument } from './xml.ts';

export const ROOT_ELEMENT = 'CURRICULO-VITAE';

export interface LoadedCv {
  doc: XDocument;
  encoding: string;
  /** Nome a usar ao salvar: <NUMERO-IDENTIFICADOR>.xml quando houver. */
  fileName: string;
  /** Bytes do XML original, para comparar e para o histórico. */
  originalBytes: Uint8Array;
}

export class CvLoadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CvLoadError';
  }
}

/** Aceita a exportação do Lattes (.zip com um .xml) ou o .xml solto. */
export async function loadCv(bytes: Uint8Array, sourceName: string): Promise<LoadedCv> {
  let xmlBytes = bytes;
  let xmlName = sourceName;
  if (isZip(bytes)) {
    const entries = await readZip(bytes, { select: (name) => name.toLowerCase().endsWith('.xml') });
    if (entries.length !== 1) {
      throw new CvLoadError(
        `O ZIP deveria ter exatamente um arquivo .xml, e tem ${entries.length}.`,
      );
    }
    xmlBytes = entries[0]!.data;
    xmlName = entries[0]!.name.split('/').pop()!;
  }

  const { encoding, text } = decodeXmlBytes(xmlBytes);
  let doc: XDocument;
  try {
    doc = parseXml(text);
  } catch (err) {
    throw new CvLoadError(`O arquivo não é um XML válido: ${(err as Error).message}`, {
      cause: err,
    });
  }
  if (doc.root.name !== ROOT_ELEMENT) {
    throw new CvLoadError(
      `Elemento raiz é ${doc.root.name}; um currículo Lattes começa com ${ROOT_ELEMENT}.`,
    );
  }

  const id = getAttr(doc.root, 'NUMERO-IDENTIFICADOR');
  const fileName = id ? `${id}.xml` : xmlName.replace(/\.zip$/i, '.xml');
  return { doc, encoding, fileName, originalBytes: xmlBytes };
}

/**
 * Bytes do documento na codificação que o prólogo declara, sem os campos só
 * de tela (schema/screen-fields.ts): o XSD não os tem e o Lattes não os lê.
 */
export function encodeCv(doc: XDocument, encoding: string): Uint8Array {
  const text = serializeXml(withoutScreenAttrs(doc));
  if (isLatin1Label(encoding)) return encodeLatin1(text);
  return new TextEncoder().encode(text);
}

/** Maior SEQUENCIA-PRODUCAO do arquivo: um contador único para toda a produção. */
export function maxSequenciaProducao(doc: XDocument): number {
  let max = 0;
  walk(doc.root, (el) => {
    const raw = getAttr(el, 'SEQUENCIA-PRODUCAO');
    if (raw === undefined) return;
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return max;
}
