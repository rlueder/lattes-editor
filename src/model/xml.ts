// Parser e serializador XML mínimos, feitos para ida e volta sem perda.
//
// O DOMParser do navegador perde detalhes que importam aqui (a forma <X/>
// contra <X></X>, a declaração original com standalone="no") e não existe no
// Node sem jsdom. Este parser guarda tudo o que lê, inclusive
// atributos e elementos que o schema não conhece, e o serializador devolve o
// mesmo texto quando nada foi editado.

export interface XAttr {
  name: string;
  value: string;
}

export interface XElement {
  attrs: XAttr[];
  children: XNode[];
  kind: 'element';
  name: string;
  /** true quando o original era <X/>; elementos novos sem filhos também saem assim. */
  selfClosing: boolean;
}

export interface XText {
  kind: 'text';
  value: string;
}

export interface XCData {
  kind: 'cdata';
  value: string;
}

/** Comentários, instruções de processamento e DOCTYPE: guardados como texto cru. */
export interface XRaw {
  kind: 'raw';
  value: string;
}

export type XNode = XElement | XText | XCData | XRaw;

export interface XDocument {
  /** Tudo depois do fechamento da raiz, cru. */
  epilog: string;
  /** Tudo antes do elemento raiz, cru (declaração, comentários, DOCTYPE, espaços). */
  prolog: string;
  root: XElement;
}

export class XmlParseError extends Error {
  readonly offset: number;
  constructor(message: string, offset: number) {
    super(`${message} (posição ${offset})`);
    this.name = 'XmlParseError';
    this.offset = offset;
  }
}

const NAME_RE = /[A-Za-z_:][-A-Za-z0-9_:.]*/y;
const WS_RE = /[ \t\r\n]*/y;

export function decodeEntities(text: string, offset = 0): string {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|[A-Za-z]+);?/g, (match, body: string) => {
    if (!match.endsWith(';')) throw new XmlParseError(`Entidade sem ';': ${match}`, offset);
    if (body.startsWith('#x')) return String.fromCodePoint(parseInt(body.slice(2), 16));
    if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10));
    switch (body) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default:
        throw new XmlParseError(`Entidade desconhecida: ${match}`, offset);
    }
  });
}

/**
 * Normaliza espaços em valor de atributo como o XML exige: quebras de linha e
 * tabulações literais viram espaço; as escritas como referência (&#10;) ficam.
 */
function normalizeAttrValue(raw: string, offset: number): string {
  return decodeEntities(raw.replace(/[\t\n\r]/g, ' '), offset);
}

export function parseXml(source: string): XDocument {
  let pos = 0;
  const len = source.length;

  const fail = (message: string): never => {
    throw new XmlParseError(message, pos);
  };

  const skipWs = () => {
    WS_RE.lastIndex = pos;
    WS_RE.exec(source);
    pos = WS_RE.lastIndex;
  };

  const readName = (): string => {
    NAME_RE.lastIndex = pos;
    const m = NAME_RE.exec(source);
    if (!m) fail('Nome esperado');
    pos = NAME_RE.lastIndex;
    return m![0];
  };

  const readUntil = (terminator: string, what: string): string => {
    const end = source.indexOf(terminator, pos);
    if (end < 0) fail(`${what} sem fechamento`);
    const text = source.slice(pos, end);
    pos = end + terminator.length;
    return text;
  };

  /** Lê comentário, PI ou DOCTYPE a partir de '<' e devolve o texto cru. */
  const readMarkupDecl = (): string | null => {
    const start = pos;
    if (source.startsWith('<!--', pos)) {
      pos += 4;
      readUntil('-->', 'Comentário');
      return source.slice(start, pos);
    }
    if (source.startsWith('<?', pos)) {
      pos += 2;
      readUntil('?>', 'Instrução de processamento');
      return source.slice(start, pos);
    }
    if (source.startsWith('<!DOCTYPE', pos)) {
      // DOCTYPE com subconjunto interno: conta colchetes até o '>' final.
      let depth = 0;
      pos += 9;
      while (pos < len) {
        const ch = source[pos];
        if (ch === '[') depth++;
        else if (ch === ']') depth--;
        else if (ch === '>' && depth === 0) {
          pos++;
          return source.slice(start, pos);
        }
        pos++;
      }
      fail('DOCTYPE sem fechamento');
    }
    return null;
  };

  const parseElement = (): XElement => {
    if (source[pos] !== '<') fail("'<' esperado");
    pos++;
    const name = readName();
    const attrs: XAttr[] = [];
    const seen = new Set<string>();
    for (;;) {
      const before = pos;
      skipWs();
      if (source.startsWith('/>', pos)) {
        pos += 2;
        return { attrs, children: [], kind: 'element', name, selfClosing: true };
      }
      if (source[pos] === '>') {
        pos++;
        break;
      }
      if (pos === before) fail(`Espaço esperado entre atributos de <${name}>`);
      const attrName = readName();
      skipWs();
      if (source[pos] !== '=') fail(`'=' esperado após ${attrName}`);
      pos++;
      skipWs();
      const quote = source[pos];
      if (quote !== '"' && quote !== "'") fail(`Aspas esperadas em ${attrName}`);
      pos++;
      const valueStart = pos;
      const raw = readUntil(quote!, `Atributo ${attrName}`);
      if (raw.includes('<'))
        throw new XmlParseError(`'<' dentro do atributo ${attrName}`, valueStart);
      if (seen.has(attrName)) fail(`Atributo repetido: ${attrName}`);
      seen.add(attrName);
      attrs.push({ name: attrName, value: normalizeAttrValue(raw, valueStart) });
    }

    const children: XNode[] = [];
    for (;;) {
      if (pos >= len) fail(`<${name}> sem fechamento`);
      if (source.startsWith('</', pos)) {
        pos += 2;
        const closing = readName();
        if (closing !== name) fail(`Esperado </${name}>, encontrado </${closing}>`);
        skipWs();
        if (source[pos] !== '>') fail("'>' esperado");
        pos++;
        return { attrs, children, kind: 'element', name, selfClosing: false };
      }
      if (source.startsWith('<![CDATA[', pos)) {
        pos += 9;
        children.push({ kind: 'cdata', value: readUntil(']]>', 'CDATA') });
        continue;
      }
      if (source[pos] === '<') {
        const raw = readMarkupDecl();
        if (raw !== null) {
          children.push({ kind: 'raw', value: raw });
          continue;
        }
        children.push(parseElement());
        continue;
      }
      const textStart = pos;
      const next = source.indexOf('<', pos);
      pos = next < 0 ? len : next;
      children.push({
        kind: 'text',
        value: decodeEntities(source.slice(textStart, pos), textStart),
      });
    }
  };

  // Prólogo: BOM, declaração, comentários, DOCTYPE e espaços até a raiz.
  if (source.charCodeAt(0) === 0xfeff) pos = 1;
  for (;;) {
    skipWs();
    if (pos >= len) fail('Documento sem elemento raiz');
    if (source[pos] !== '<') fail('Texto antes do elemento raiz');
    if (readMarkupDecl() === null) break;
  }
  const prolog = source.slice(0, pos);
  const root = parseElement();
  const epilogStart = pos;
  for (;;) {
    skipWs();
    if (pos >= len) break;
    if (source[pos] !== '<' || readMarkupDecl() === null) fail('Conteúdo depois do elemento raiz');
  }
  return { epilog: source.slice(epilogStart), prolog, root };
}

export function escapeAttr(value: string): string {
  return value.replace(/[&<"\t\n\r]/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '"':
        return '&quot;';
      case '\t':
        return '&#9;';
      case '\n':
        return '&#10;';
      default:
        return '&#13;';
    }
  });
}

export function escapeText(value: string): string {
  return value.replace(/[&<>\r]/g, (ch) =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&#13;',
  );
}

export function serializeElement(el: XElement, out: string[] = []): string[] {
  out.push('<', el.name);
  for (const a of el.attrs) out.push(' ', a.name, '="', escapeAttr(a.value), '"');
  if (el.children.length === 0 && el.selfClosing) {
    out.push('/>');
    return out;
  }
  out.push('>');
  for (const child of el.children) {
    switch (child.kind) {
      case 'element':
        serializeElement(child, out);
        break;
      case 'text':
        out.push(escapeText(child.value));
        break;
      case 'cdata':
        out.push('<![CDATA[', child.value, ']]>');
        break;
      case 'raw':
        out.push(child.value);
        break;
    }
  }
  out.push('</', el.name, '>');
  return out;
}

/** Serializa o documento como string Unicode; a codificação em bytes é com o latin1.ts. */
export function serializeXml(doc: XDocument): string {
  return doc.prolog + serializeElement(doc.root).join('') + doc.epilog;
}

// Helpers de navegação e edição usados pelo modelo e pela UI.

export function getAttr(el: XElement, name: string): string | undefined {
  return el.attrs.find((a) => a.name === name)?.value;
}

export function setAttr(el: XElement, name: string, value: string): void {
  const existing = el.attrs.find((a) => a.name === name);
  if (existing) existing.value = value;
  else el.attrs.push({ name, value });
}

export function childElements(el: XElement, name?: string): XElement[] {
  return el.children.filter(
    (c): c is XElement => c.kind === 'element' && (name === undefined || c.name === name),
  );
}

export function firstChild(el: XElement, name: string): XElement | undefined {
  return childElements(el, name)[0];
}

/** Percorre a árvore em pré-ordem, com o caminho de ancestrais. */
export function walk(
  el: XElement,
  visit: (node: XElement, ancestors: readonly XElement[]) => void,
  ancestors: XElement[] = [],
): void {
  visit(el, ancestors);
  ancestors.push(el);
  for (const c of el.children) if (c.kind === 'element') walk(c, visit, ancestors);
  ancestors.pop();
}

export function element(
  name: string,
  attrs: Record<string, string> | XAttr[] = [],
  children: XNode[] = [],
): XElement {
  const list = Array.isArray(attrs)
    ? attrs
    : Object.entries(attrs).map(([n, value]) => ({ name: n, value }));
  return { attrs: list, children, kind: 'element', name, selfClosing: children.length === 0 };
}

export function cloneElement(el: XElement): XElement {
  return structuredClone(el);
}
