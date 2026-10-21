// Gera fixtures/demo.xml: o currículo de demonstração, de uma pesquisadora
// fictícia com dados críveis, para gravar o app em uso e tirar imagens
// (pnpm dev:demo). O synthetic_full.xml continua sendo o que cobre o schema
// inteiro nos testes; este aqui só preenche o que uma pessoa de verdade teria.
//
// As pessoas são fictícias, inclusive coautores, orientandos e bancas.
// Instituições e periódicos são reais, os títulos dos trabalhos não existem e
// os DOIs usam o prefixo de teste do Crossref (10.5555), que não aponta para
// trabalho nenhum. E-mail, rede social e telefone usam o domínio reservado
// example.org e o número 0000-1234, que não colidem com contato real. O ORCID é o de exemplo da documentação do ORCID (Josiah Carberry).
//
// Cada atributo vem do schema (src/schema/lattes.json): um nome que não existe
// no elemento ou um valor fora do enumerado para a geração, e o resultado é
// validado contra o XSD por pnpm validate:fixtures.
//
// Uso: node scripts/gen-demo.ts

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodeLatin1 } from '../src/model/latin1.ts';
import { insertInSchemaOrder } from '../src/model/schema-order.ts';
import { element, serializeXml, type XElement, type XNode } from '../src/model/xml.ts';
import { schema } from './demo/build.ts';
import { generalData } from './demo/general-data.ts';
import { bibliography, complementary, otherProduction, preface } from './demo/production.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROLOG = '<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>\n';

/** Identificador da demonstração; src/dev/example.ts abre o arquivo pelo nome. */
const DEMO_ID = '3871592046158372';

/** Indenta com dois espaços, sem mexer dentro de elementos com texto. */
function indent(node: XElement, level = 0): void {
  if (schema.elements[node.name]?.mixed || node.children.length === 0) return;
  const pad = (n: number) => ({ kind: 'text' as const, value: `\n${'  '.repeat(n)}` });
  const out: XNode[] = [];
  for (const child of node.children) {
    out.push(pad(level + 1));
    if (child.kind === 'element') indent(child, level + 1);
    out.push(child);
  }
  out.push(pad(level));
  node.children = out;
}

const root = element('CURRICULO-VITAE', [
  { name: 'SISTEMA-ORIGEM-XML', value: 'LATTES_OFFLINE' },
  { name: 'NUMERO-IDENTIFICADOR', value: DEMO_ID },
  { name: 'DATA-ATUALIZACAO', value: '06102026' },
  { name: 'HORA-ATUALIZACAO', value: '163000' },
]);
for (const part of [generalData(), bibliography(), otherProduction(), complementary()]) {
  insertInSchemaOrder(schema, root, part);
}
// O prefácio entra por último, com a sequência seguinte à de todos os outros.
const bib = root.children.find(
  (c): c is XElement => c.kind === 'element' && c.name === 'PRODUCAO-BIBLIOGRAFICA',
)!;
let others = bib.children.find(
  (c): c is XElement => c.kind === 'element' && c.name === 'DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA',
);
if (!others) {
  others = element('DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA');
  insertInSchemaOrder(schema, bib, others);
}
insertInSchemaOrder(schema, others, preface());
indent(root);
const text = serializeXml({ epilog: '\n', prolog: PROLOG, root });
writeFileSync(join(ROOT, 'fixtures/demo.xml'), encodeLatin1(text));
console.log('gen-demo: fixtures/demo.xml');
