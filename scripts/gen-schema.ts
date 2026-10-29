// Gera, a partir do XSD de 2022 e do schema/patch.json:
//   schema/CurriculoLattes_2022_patched.xsd  XSD original + atributos fantasma
//   src/schema/lattes.json                   modelo usado pela UI e pelo serializador
//   src/schema/lattes.ts                     tipos derivados do modelo
//
// Uso: pnpm gen:schema

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodeLatin1, encodeLatin1 } from '../src/model/latin1.ts';
import { childElements, getAttr, parseXml, type XElement } from '../src/model/xml.ts';
import type { AttributeSpec, ChildSpec, ElementSpec, LattesSchema } from '../src/schema/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const XSD_PATH = join(ROOT, 'schema/CurriculoLattes_12_09_2022.xsd');
const PATCHED_PATH = join(ROOT, 'schema/CurriculoLattes_2022_patched.xsd');
const PATCH_PATH = join(ROOT, 'schema/patch.json');
const JSON_PATH = join(ROOT, 'src/schema/lattes.json');
const TS_PATH = join(ROOT, 'src/schema/lattes.ts');

interface Patch {
  attributes: { element: string; attribute: string }[];
  /** Valores de enumerados que o XSD não lista e uma exportação real trouxe. */
  enumValues?: { element: string; attribute: string; values: string[] }[];
}

function fail(message: string): never {
  throw new Error(`gen-schema: ${message}`);
}

function parseAttribute(node: XElement, elementName: string): AttributeSpec {
  const name = getAttr(node, 'name') ?? fail(`atributo sem nome em ${elementName}`);
  const spec: AttributeSpec = { name, required: getAttr(node, 'use') === 'required' };
  const def = getAttr(node, 'default');
  if (def !== undefined) spec.default = def;
  const simple = childElements(node, 'xs:simpleType')[0];
  if (simple) {
    const restriction =
      childElements(simple, 'xs:restriction')[0] ??
      fail(`${elementName}/@${name}: simpleType sem restriction`);
    const values = childElements(restriction, 'xs:enumeration').map(
      (e) => getAttr(e, 'value') ?? '',
    );
    if (values.length > 0) spec.enum = values;
  }
  return spec;
}

function parseElement(node: XElement): ElementSpec {
  const name = getAttr(node, 'name') ?? fail('elemento sem nome');
  const complex = childElements(node, 'xs:complexType')[0] ?? fail(`${name} sem complexType`);
  const spec: ElementSpec = {
    attributes: [],
    children: [],
    mixed: getAttr(complex, 'mixed') === 'true',
  };
  for (const part of childElements(complex)) {
    if (part.name === 'xs:sequence') {
      for (const ref of childElements(part)) {
        if (ref.name !== 'xs:element')
          fail(`${name}: ${ref.name} dentro de sequence não suportado`);
        const refName = getAttr(ref, 'ref') ?? fail(`${name}: elemento local sem ref`);
        const maxRaw = getAttr(ref, 'maxOccurs') ?? '1';
        const child: ChildSpec = {
          max: maxRaw === 'unbounded' ? 'unbounded' : Number(maxRaw),
          min: Number(getAttr(ref, 'minOccurs') ?? '1'),
          name: refName,
        };
        spec.children.push(child);
      }
    } else if (part.name === 'xs:attribute') {
      spec.attributes.push(parseAttribute(part, name));
    } else {
      fail(`${name}: ${part.name} não suportado`);
    }
  }
  return spec;
}

/** Insere os atributos do patch no texto do XSD, antes do </xs:complexType> de cada elemento. */
function patchXsdText(xsd: string, patch: Patch): string {
  const eol = xsd.includes('\r\n') ? '\r\n' : '\n';
  let out = xsd;
  const byElement = new Map<string, string[]>();
  for (const { attribute, element } of patch.attributes) {
    byElement.set(element, [...(byElement.get(element) ?? []), attribute]);
  }
  for (const [element, attributes] of byElement) {
    const start = out.indexOf(`<xs:element name="${element}">`);
    if (start < 0) fail(`patch: elemento ${element} não existe no XSD`);
    const close = out.indexOf('</xs:complexType>', start);
    const lineStart = out.lastIndexOf(eol, close) + eol.length;
    const indent = out.slice(lineStart, close);
    const lines = attributes
      .map(
        (a) =>
          `${indent}  <!-- patch.json: presente em exportações reais, ausente do XSD de 2022 -->${eol}${indent}  <xs:attribute name="${a}"/>${eol}`,
      )
      .join('');
    out = out.slice(0, lineStart) + lines + out.slice(lineStart);
  }
  for (const { attribute, element, values } of patch.enumValues ?? []) {
    const start = out.indexOf(`<xs:element name="${element}">`);
    if (start < 0) fail(`patch: elemento ${element} não existe no XSD`);
    const end = out.indexOf('</xs:element>', start);
    const at = out.indexOf(`<xs:attribute name="${attribute}">`, start);
    if (at < 0 || at > end) fail(`patch: ${element}/@${attribute} sem enumerado no XSD`);
    const close = out.indexOf('</xs:restriction>', at);
    const lineStart = out.lastIndexOf(eol, close) + eol.length;
    const indent = out.slice(lineStart, close);
    const lines = values
      .map(
        (v) =>
          `${indent}  <!-- patch.json: visto em exportação real, ausente do XSD de 2022 -->${eol}${indent}  <xs:enumeration value="${v}"/>${eol}`,
      )
      .join('');
    out = out.slice(0, lineStart) + lines + out.slice(lineStart);
  }
  return out;
}

function main() {
  const xsdBytes = readFileSync(XSD_PATH);
  const xsdText = decodeLatin1(xsdBytes);
  const patch = JSON.parse(readFileSync(PATCH_PATH, 'utf8')) as Patch;

  const patchedText = patchXsdText(xsdText, patch);
  writeFileSync(PATCHED_PATH, encodeLatin1(patchedText));

  const doc = parseXml(patchedText);
  const elements: Record<string, ElementSpec> = {};
  for (const node of childElements(doc.root, 'xs:element')) {
    const name = getAttr(node, 'name')!;
    if (elements[name]) fail(`elemento duplicado: ${name}`);
    elements[name] = parseElement(node);
  }
  const patched = new Set(patch.attributes.map((p) => `${p.element}/${p.attribute}`));
  for (const [name, spec] of Object.entries(elements)) {
    for (const a of spec.attributes) if (patched.has(`${name}/${a.name}`)) a.patched = true;
    for (const c of spec.children)
      if (!elements[c.name]) fail(`${name} referencia ${c.name}, que não existe`);
  }

  const schema: LattesSchema = {
    elements,
    root: 'CURRICULO-VITAE',
    source: 'CurriculoLattes_12_09_2022.xsd + schema/patch.json',
  };
  writeFileSync(JSON_PATH, `${JSON.stringify(schema, null, 2)}\n`);

  const names = Object.keys(elements).sort();
  const enumCount = Object.values(elements).reduce(
    (n, e) => n + e.attributes.filter((a) => a.enum).length,
    0,
  );
  const ts = [
    '// Gerado por scripts/gen-schema.ts. Não editar à mão.',
    '',
    "import type { LattesSchema } from './types.ts';",
    "import data from './lattes.json' with { type: 'json' };",
    '',
    'export const lattesSchema = data as LattesSchema;',
    '',
    'export type LattesElementName =',
    ...names.map((n, i) => `  | '${n}'${i === names.length - 1 ? ';' : ''}`),
    '',
    'export interface LattesAttributeNames {',
    ...names.map((n) => {
      const attrs = elements[n]!.attributes.map((a) => `'${a.name}'`);
      return `  '${n}': ${attrs.length ? attrs.join(' | ') : 'never'};`;
    }),
    '}',
    '',
  ].join('\n');
  writeFileSync(TS_PATH, ts);

  console.log(
    `gen-schema: ${names.length} elementos, ${Object.values(elements).reduce((n, e) => n + e.attributes.length, 0)} atributos, ${enumCount} enums, ${patch.attributes.length} atributos do patch`,
  );
}

main();
