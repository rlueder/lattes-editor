// Gera as fixtures sintéticas a partir de src/schema/lattes.json:
//   fixtures/synthetic_full.xml     todo elemento e todo atributo do schema, uma vez
//   fixtures/synthetic_minimal.xml  DADOS-GERAIS mínimo e um item por módulo do Passo 2
//
// O guia sugeria partir de docs/lattes_maximal_skeleton.xml, mas aquele arquivo
// não é XML bem formado (tem comentários dentro das tags). O lattes.json vem do
// mesmo XSD com o mesmo patch, então as fixtures cobrem o mesmo conteúdo.
//
// Todos os valores são falsos. Uso: pnpm gen:fixtures

import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { IMPORT_MODULES } from '../src/import-export/importable.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { insertInSchemaOrder } from '../src/model/schema-order.ts';
import { element, firstChild, serializeXml, type XElement, type XNode } from '../src/model/xml.ts';
import schemaJson from '../src/schema/lattes.json' with { type: 'json' };
import type { AttributeSpec, LattesSchema } from '../src/schema/types.ts';

const schema = schemaJson as LattesSchema;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROLOG = '<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>\n';
const FAKE_ID = '0000000000000001';

function token(name: string, t: string): boolean {
  return (
    name === t || name.startsWith(`${t}-`) || name.endsWith(`-${t}`) || name.includes(`-${t}-`)
  );
}

class Faker {
  private seqProducao = 0;
  private seqOther = new Map<string, number>();
  private enumTurn = 0;

  value(owner: string, attr: AttributeSpec): string {
    const n = attr.name;
    if (attr.enum) return attr.enum[this.enumTurn++ % attr.enum.length]!;
    if (attr.default !== undefined) return attr.default;
    if (n === 'SEQUENCIA-PRODUCAO') return String(++this.seqProducao);
    if (n.startsWith('SEQUENCIA')) {
      const next = (this.seqOther.get(n) ?? 0) + 1;
      this.seqOther.set(n, next);
      return String(next);
    }
    if (n === 'NRO-ID-CNPQ' || n === 'NUMERO-IDENTIFICADOR' || n.startsWith('NUMERO-ID-'))
      return FAKE_ID;
    if (n === 'CPF') return '00000000000';
    if (n === 'ORCID-ID') return 'https://orcid.org/0000-0000-0000-0000';
    if (n === 'DOI') return '10.0000/lattes-editor.teste';
    if (n === 'ISSN') return '00000000';
    if (n === 'ISBN') return '0000000000';
    if (token(n, 'HORA')) return '101500';
    if (token(n, 'DATA')) return '15032024';
    if (token(n, 'ANO')) return '2024';
    if (token(n, 'MES')) return '03';
    if (n.startsWith('PAGINA')) return n.endsWith('FINAL') ? '12' : '1';
    if (n.includes('HOME-PAGE') || n.includes('URL') || n === 'REDE-SOCIAL')
      return 'http://example.org/teste';
    if (n.includes('E-MAIL') || n === 'ELETRONICO') return 'teste@example.org';
    if (n.startsWith('TITULO') && !n.endsWith('INGLES'))
      return `Título de teste de ${owner.toLowerCase()} — revisão`;
    if (n.startsWith('NOME-COMPLETO') || n === 'NOME-DO-AUTOR') return 'Pessoa de Teste Ação';
    if (n.includes('CITACAO') || n.includes('CITACOES')) return 'TESTE, P. A.';
    return `Valor de teste (${n.toLowerCase()})`;
  }
}

/** Instancia um elemento com todos os atributos; em modo "full", todos os filhos. */
function build(name: string, faker: Faker, full: boolean, stack: string[] = []): XElement {
  const spec = schema.elements[name];
  if (!spec) throw new Error(`gen-fixtures: elemento ${name} fora do schema`);
  if (stack.includes(name)) throw new Error(`gen-fixtures: ciclo em ${[...stack, name].join('/')}`);
  const el = element(
    name,
    spec.attributes.map((a) => ({ name: a.name, value: faker.value(name, a) })),
  );
  const children: XNode[] = [];
  for (const c of spec.children) {
    if (full || c.min > 0) children.push(build(c.name, faker, full, [...stack, name]));
  }
  if (spec.mixed)
    children.push({ kind: 'text', value: `Conteúdo de teste de ${name.toLowerCase()}` });
  el.children = children;
  el.selfClosing = children.length === 0;
  return el;
}

function setRootAttrs(root: XElement): void {
  root.attrs = [
    { name: 'SISTEMA-ORIGEM-XML', value: 'LATTES_OFFLINE' },
    { name: 'NUMERO-IDENTIFICADOR', value: FAKE_ID },
    { name: 'DATA-ATUALIZACAO', value: '15032024' },
    { name: 'HORA-ATUALIZACAO', value: '101500' },
  ];
}

/** Indenta com dois espaços, sem mexer dentro de elementos com texto. */
function indent(el: XElement, level = 0): void {
  if (schema.elements[el.name]?.mixed || el.children.length === 0) return;
  const pad = (n: number) => ({ kind: 'text' as const, value: `\n${'  '.repeat(n)}` });
  const out: XNode[] = [];
  for (const child of el.children) {
    out.push(pad(level + 1));
    if (child.kind === 'element') indent(child, level + 1);
    out.push(child);
  }
  out.push(pad(level));
  el.children = out;
}

function write(file: string, root: XElement): void {
  indent(root);
  const text = serializeXml({ epilog: '\n', prolog: PROLOG, root });
  writeFileSync(join(ROOT, 'fixtures', file), encodeLatin1(text));
}

function full(): XElement {
  const root = build('CURRICULO-VITAE', new Faker(), true);
  setRootAttrs(root);
  return root;
}

function minimal(): XElement {
  const faker = new Faker();
  const root = element('CURRICULO-VITAE');
  setRootAttrs(root);
  const required = new Set(['NOME-COMPLETO', 'NOME-EM-CITACOES-BIBLIOGRAFICAS', 'NACIONALIDADE']);
  const dg = build('DADOS-GERAIS', faker, false);
  dg.attrs = dg.attrs.filter(
    (a) =>
      required.has(a.name) ||
      schema.elements['DADOS-GERAIS']!.attributes.find((s) => s.name === a.name)?.required,
  );
  insertInSchemaOrder(schema, root, dg);

  for (const mod of IMPORT_MODULES) {
    for (const path of mod.paths) {
      const segments = path.split('/');
      let parent = root;
      for (let i = 0; i < segments.length; i++) {
        let seg = segments[i]!;
        const isLast = i === segments.length - 1;
        if (seg === '*') {
          seg = schema.elements[parent.name]!.children.map((c) => c.name).find(
            (c) => !mod.exclude?.includes(c),
          )!;
        }
        if (isLast) {
          insertInSchemaOrder(schema, parent, build(seg, faker, true));
        } else {
          let next = firstChild(parent, seg);
          if (!next) {
            next = element(seg);
            insertInSchemaOrder(schema, parent, next);
          }
          parent = next;
        }
      }
    }
  }
  return root;
}

write('synthetic_full.xml', full());
write('synthetic_minimal.xml', minimal());
// A exportação do Lattes chega como ZIP; a fixture zipada testa esse caminho.
// -X tira atributos extras do macOS, para o ZIP ser estável entre máquinas.
rmSync(join(ROOT, 'fixtures/synthetic_minimal.zip'), { force: true });
execFileSync('zip', ['-X', '-q', 'synthetic_minimal.zip', 'synthetic_minimal.xml'], {
  cwd: join(ROOT, 'fixtures'),
});
console.log(
  'gen-fixtures: fixtures/synthetic_full.xml, fixtures/synthetic_minimal.xml, fixtures/synthetic_minimal.zip',
);
