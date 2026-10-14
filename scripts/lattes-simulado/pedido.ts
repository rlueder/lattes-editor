// O pedido como o Lattes simulado o vê: o procedimento, os parâmetros da URL
// e do corpo (urlencoded em Latin-1 ou multipart), sem diferença de caixa nos
// nomes, como no gateway PL/SQL (seção 1).

export interface UploadedFile {
  bytes: Uint8Array;
  /** O nome do campo do arquivo no formulário. */
  field: string;
  name: string;
  type: string;
}

export interface SimRequest {
  /** "cvlattesweb" ou "curriculoweb". */
  base: string;
  file?: UploadedFile;
  /** Valor de um parâmetro (o primeiro, sem diferença de caixa no nome). */
  get(name: string): string | undefined;
  /** Todos os valores de um parâmetro repetido (f_chkp, f_sq). */
  getAll(name: string): string[];
  method: string;
  /** Pares na ordem em que chegaram: a URL, depois o corpo. */
  pairs: [string, string][];
  /** O procedimento como veio no caminho ("PKG_IDIOMA.FORM"). */
  proc: string;
}

/** Bytes de um valor %XX e "+" como o navegador manda num formulário Latin-1. */
function decodeLatin1Component(part: string): string {
  const spaced = part.replace(/\+/g, ' ');
  let out = '';
  for (let i = 0; i < spaced.length; i++) {
    const ch = spaced[i]!;
    if (ch === '%' && /^[0-9a-f]{2}$/i.test(spaced.slice(i + 1, i + 3))) {
      out += String.fromCharCode(parseInt(spaced.slice(i + 1, i + 3), 16));
      i += 2;
    } else out += ch;
  }
  // Fora do Latin-1, o navegador manda referência numérica (&#8212;). Que o
  // Lattes guarde o caractere, e não a referência, é inferido.
  return out.replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

export function parseUrlEncoded(body: string): [string, string][] {
  if (!body) return [];
  return body
    .split('&')
    .filter(Boolean)
    .map((part) => {
      const i = part.indexOf('=');
      const key = i < 0 ? part : part.slice(0, i);
      const value = i < 0 ? '' : part.slice(i + 1);
      return [decodeLatin1Component(key), decodeLatin1Component(value)];
    });
}

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

/** Um corpo multipart/form-data: os campos de texto e o arquivo, se houver. */
export function parseMultipart(
  body: Uint8Array,
  contentType: string,
): { fields: [string, string][]; file?: UploadedFile } {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const marker = boundary?.[1] ?? boundary?.[2];
  if (!marker) return { fields: [] };
  const raw = latin1(body);
  const fields: [string, string][] = [];
  let file: UploadedFile | undefined;
  for (const part of raw.split(`--${marker}`)) {
    const head = part.indexOf('\r\n\r\n');
    if (head < 0) continue;
    const headers = part.slice(0, head);
    const content = part.slice(head + 4).replace(/\r\n$/, '');
    const name = /name="([^"]*)"/i.exec(headers)?.[1];
    if (!name) continue;
    const fileName = /filename="([^"]*)"/i.exec(headers)?.[1];
    if (fileName !== undefined) {
      file = {
        bytes: new Uint8Array(Buffer.from(content, 'latin1')),
        field: name,
        name: fileName,
        type: /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() ?? '',
      };
    } else fields.push([name, content]);
  }
  return { fields, file };
}

export function buildRequest(init: {
  base: string;
  body: Uint8Array;
  contentType: string;
  method: string;
  proc: string;
  query: string;
}): SimRequest {
  const pairs = parseUrlEncoded(init.query);
  let file: UploadedFile | undefined;
  if (init.method === 'POST') {
    if (/multipart\/form-data/i.test(init.contentType)) {
      const parsed = parseMultipart(init.body, init.contentType);
      pairs.push(...parsed.fields);
      file = parsed.file;
    } else pairs.push(...parseUrlEncoded(latin1(init.body)));
  }
  const getAll = (name: string) =>
    pairs.filter(([k]) => k.toLowerCase() === name.toLowerCase()).map(([, v]) => v);
  return {
    base: init.base,
    file,
    get: (name) => getAll(name)[0],
    getAll,
    method: init.method,
    pairs,
    proc: init.proc,
  };
}
