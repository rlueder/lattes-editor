// Codificação ISO-8859-1 feita à mão.
//
// TextDecoder("iso-8859-1") não serve: pela especificação WHATWG esse rótulo é
// windows-1252, e os bytes 0x80–0x9F viram caracteres como € e aspas curvas.
// Na volta esses caracteres sairiam como &#x20AC;, e o arquivo deixaria de ser
// idêntico ao original. Aqui cada byte é exatamente o ponto de código de mesmo
// número, nos dois sentidos.

const CHUNK = 0x8000;

export function decodeLatin1(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

/**
 * Codifica em Latin-1. Pontos de código acima de 255 saem como referência
 * numérica (&#x2014;), que é XML válido num documento Latin-1. Só pode ser usado
 * sobre XML já serializado, fora de comentários e CDATA, onde referências não
 * são interpretadas; o serializador garante isso para o conteúdo editado.
 */
export function encodeLatin1(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0xff) bytes.push(cp);
    else for (const b of `&#x${cp.toString(16).toUpperCase()};`) bytes.push(b.charCodeAt(0));
  }
  return Uint8Array.from(bytes);
}

const DECL_ENCODING_RE = /^\uFEFF?<\?xml[^?]*?encoding\s*=\s*["']([^"']+)["']/;

/** Lê a codificação declarada no prólogo; o padrão do XML é UTF-8. */
export function declaredEncoding(bytes: Uint8Array): string {
  // Lido como Latin-1, o BOM de UTF-8 (EF BB BF) não casa com \uFEFF; pula os três bytes.
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  const head = decodeLatin1(bytes.subarray(start, start + 200));
  return DECL_ENCODING_RE.exec(head)?.[1]?.toUpperCase() ?? 'UTF-8';
}

export function isLatin1Label(label: string): boolean {
  return ['ISO-8859-1', 'ISO8859-1', 'LATIN1', 'LATIN-1', 'L1'].includes(label.toUpperCase());
}

/**
 * Decodifica o arquivo conforme a declaração. Exportações do Lattes são ISO-8859-1.
 * ignoreBOM mantém o BOM no texto, para o arquivo voltar idêntico ao salvar.
 */
export function decodeXmlBytes(bytes: Uint8Array): { text: string; encoding: string } {
  const encoding = declaredEncoding(bytes);
  if (isLatin1Label(encoding)) return { encoding, text: decodeLatin1(bytes) };
  return {
    encoding,
    text: new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(bytes),
  };
}
