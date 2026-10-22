// Leitor de ZIP para a exportação do Lattes, com orçamento antes e durante
// a descompressão. A seleção acontece pelos nomes do diretório central.

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

export const ZIP_MAX_INPUT_BYTES = 32 * 1024 * 1024;
export const ZIP_MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
export const ZIP_MAX_ENTRIES = 128;

interface ZipOptions {
  maxEntries?: number;
  maxInputBytes?: number;
  maxOutputBytes?: number;
  select?: (name: string) => boolean;
}

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

export function isZip(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4
  );
}

async function inflateRaw(data: Uint8Array, limit: number): Promise<Uint8Array> {
  const reader = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
    .getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) throw new ZipError('O ZIP ultrapassa o limite de descompressão');
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export async function readZip(bytes: Uint8Array, options: ZipOptions = {}): Promise<ZipEntry[]> {
  const maxInput = options.maxInputBytes ?? ZIP_MAX_INPUT_BYTES;
  const maxOutput = options.maxOutputBytes ?? ZIP_MAX_OUTPUT_BYTES;
  if (bytes.length > maxInput)
    throw new ZipError('O ZIP ultrapassa o limite de tamanho do arquivo');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bounds = (at: number, length: number) => {
    if (at < 0 || length < 0 || at + length > bytes.length)
      throw new ZipError('Arquivo ZIP inválido: entrada corrompida ou truncada');
  };
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (
      view.getUint32(i, true) === EOCD_SIG &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError('Arquivo ZIP inválido: diretório central não encontrado');
  const count = view.getUint16(eocd + 10, true);
  if (count > (options.maxEntries ?? ZIP_MAX_ENTRIES))
    throw new ZipError('O ZIP tem entradas demais');
  let p = view.getUint32(eocd + 16, true);
  const centralSize = view.getUint32(eocd + 12, true);
  bounds(p, centralSize);
  if (p + centralSize > eocd)
    throw new ZipError('Arquivo ZIP inválido: diretório central corrompido');
  const centralEnd = p + centralSize;
  const selected: { raw: Uint8Array; method: number; name: string; size: number }[] = [];
  const decoder = new TextDecoder();
  let declared = 0;
  for (let n = 0; n < count; n++) {
    bounds(p, 46);
    if (p + 46 > centralEnd || view.getUint32(p, true) !== CENTRAL_SIG)
      throw new ZipError('Arquivo ZIP inválido: entrada corrompida');
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const compressed = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const recordSize = 46 + nameLen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    bounds(p, recordSize);
    if (p + recordSize > centralEnd) throw new ZipError('Arquivo ZIP inválido: entrada corrompida');
    const nameBytes = bytes.subarray(p + 46, p + 46 + nameLen);
    const name =
      flags & 0x800
        ? decoder.decode(nameBytes)
        : Array.from(nameBytes, (b) => String.fromCharCode(b)).join('');
    p += recordSize;
    if (name.endsWith('/') || (options.select && !options.select(name))) continue;
    if (flags & 1) throw new ZipError(`Entrada cifrada não suportada: ${name}`);
    declared += size;
    if (declared > maxOutput) throw new ZipError('O ZIP ultrapassa o limite de descompressão');
    bounds(local, 30);
    if (view.getUint32(local, true) !== LOCAL_SIG)
      throw new ZipError(`Cabeçalho local inválido: ${name}`);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    bounds(start, compressed);
    if (start + compressed > view.getUint32(eocd + 16, true))
      throw new ZipError('Arquivo ZIP inválido: dados sobrepostos ao diretório');
    selected.push({ method, name, raw: bytes.subarray(start, start + compressed), size });
  }
  const entries: ZipEntry[] = [];
  let total = 0;
  for (const { method, name, raw, size } of selected) {
    let data: Uint8Array;
    if (method === 0) {
      if (raw.length > Math.min(size, maxOutput - total))
        throw new ZipError('O ZIP ultrapassa o limite de descompressão');
      data = raw.slice();
    } else if (method === 8) data = await inflateRaw(raw, Math.min(size, maxOutput - total));
    else throw new ZipError(`Método de compressão ${method} não suportado em ${name}`);
    if (data.length !== size) throw new ZipError(`Tamanho descomprimido inválido: ${name}`);
    total += data.length;
    entries.push({ data, name });
  }
  return entries;
}
