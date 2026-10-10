// Leitor de ZIP mínimo para a exportação do Lattes (um único XML, deflate).
// Usa DecompressionStream("deflate-raw"), presente no navegador e no Node 18+,
// para não depender de biblioteca de compressão.

export interface ZipEntry {
  data: Uint8Array;
  name: string;
}

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipError';
  }
}

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

export function isZip(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZip(bytes: Uint8Array): Promise<ZipEntry[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // O registro final fica nos últimos 22 bytes mais um comentário de até 64 KiB.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError('Arquivo ZIP inválido: diretório central não encontrado');

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];

  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== CENTRAL_SIG)
      throw new ZipError('Arquivo ZIP inválido: entrada corrompida');
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const nameBytes = bytes.subarray(p + 46, p + 46 + nameLen);
    // Bit 11: nome em UTF-8; sem ele, o padrão é CP437, que para nomes ASCII dá no mesmo.
    const name = flags & 0x800 ? decoder.decode(nameBytes) : String.fromCharCode(...nameBytes);
    p += 46 + nameLen + extraLen + commentLen;

    if (flags & 0x1) throw new ZipError(`Entrada cifrada não suportada: ${name}`);
    if (name.endsWith('/')) continue;

    if (view.getUint32(localOffset, true) !== LOCAL_SIG)
      throw new ZipError(`Cabeçalho local inválido: ${name}`);
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const raw = bytes.subarray(start, start + compressedSize);

    let data: Uint8Array;
    if (method === 0) data = raw.slice();
    else if (method === 8) data = await inflateRaw(raw);
    else throw new ZipError(`Método de compressão ${method} não suportado em ${name}`);
    entries.push({ data, name });
  }
  return entries;
}
