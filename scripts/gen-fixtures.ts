// Gera as fixtures sintéticas a partir de src/schema/lattes.json:
//   fixtures/synthetic_full.xml     todo elemento e todo atributo do schema, uma vez,
//                                   com anos, lugares e enumerados variando entre os itens
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
import {
  element,
  firstChild,
  serializeXml,
  type XAttr,
  type XElement,
  type XNode,
} from '../src/model/xml.ts';
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

/** Ano, mês ou data de calendário (os FORMATO-DATA-* são enumerados e ficam de fora). */
function isTemporal(name: string): boolean {
  return (
    !name.startsWith('FORMATO') && (token(name, 'ANO') || token(name, 'MES') || token(name, 'DATA'))
  );
}

/** Partes de um item que compartilham o ano dele, em vez de abrir um item novo. */
function isItemPart(name: string): boolean {
  return name.startsWith('DADOS-BASICOS') || name.startsWith('DETALHAMENTO');
}

/**
 * Um item é o que o editor lista com ano próprio: elemento com datas nos
 * atributos ou com DADOS-BASICOS-* entre os filhos. Dentro de um
 * DETALHAMENTO-* (registro de patente, histórico) tudo herda o ano do item.
 */
function isItem(name: string, stack: string[]): boolean {
  if (isItemPart(name) || stack.some((s) => s.startsWith('DETALHAMENTO'))) return false;
  const spec = schema.elements[name]!;
  return (
    spec.attributes.some((a) => isTemporal(a.name)) ||
    spec.children.some((c) => c.name.startsWith('DADOS-BASICOS'))
  );
}

// Anos e datas variam por item, sem sorteio: o n-ésimo item cai no ano
// FIRST_YEAR + (n * YEAR_STRIDE) % YEAR_SPAN. O passo 5 é primo com 13, então
// itens vizinhos nunca repetem o ano e 13 itens seguidos cobrem 2012 a 2024.
const FIRST_YEAR = 2012;
const YEAR_SPAN = 13;
const YEAR_STRIDE = 5;
/** Data de nascimento fixa: a pessoa do currículo não nasce no meio da produção. */
const BIRTH_DATE = '14071984';

/**
 * Lugares em rodízio para os campos de país, UF e cidade. Elemento com UF
 * só recebe lugar no Brasil, para país e UF nunca se contradizerem.
 */
interface Place {
  city: string;
  country: string;
  countryCode: string;
  uf?: string;
}
const PLACES: Place[] = [
  { city: 'Porto Alegre', country: 'Brasil', countryCode: 'BRA', uf: 'RS' },
  { city: 'Lisboa', country: 'Portugal', countryCode: 'PRT' },
  { city: 'Recife', country: 'Brasil', countryCode: 'BRA', uf: 'PE' },
  { city: 'Buenos Aires', country: 'Argentina', countryCode: 'ARG' },
  { city: 'São Paulo', country: 'Brasil', countryCode: 'BRA', uf: 'SP' },
];
const BRAZIL = PLACES.filter((p) => p.uf);

/**
 * Campos que o Lattes preenche com códigos, mas que o XSD deixa como texto
 * livre (FORMA-PARTICIPACAO, TIPO-PARTICIPACAO). Sem uma lista observada
 * numa exportação real, os valores ficam visivelmente de teste, em rodízio.
 */
const FREE_CATEGORICAL = new Set(['FORMA-PARTICIPACAO', 'TIPO-PARTICIPACAO']);
const VARIANTS = ['A', 'B', 'C'];
/**
 * Enumerados que viram filtro na lista: o rodízio usa só os três primeiros
 * valores, para o filtro ter poucas opções com mais de um item cada, como num
 * currículo real. Os demais enumerados percorrem a lista inteira.
 */
const FACET_ENUMS = new Set(['MEIO-DE-DIVULGACAO', 'NATUREZA', 'TIPO']);

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** Ano de fim (ou ano pontual) e ano de início do n-ésimo item; início sempre antes do fim. */
function itemYears(item: number): { end: number; start: number } {
  const end = FIRST_YEAR + ((item * YEAR_STRIDE) % YEAR_SPAN);
  return { end, start: end - 1 - (item % 4) };
}

class Faker {
  private seqProducao = 0;
  private seqOther = new Map<string, number>();
  private items = 0;
  /** Rodízio por nome de atributo: itens seguidos com o mesmo campo recebem valores diferentes. */
  private turns = new Map<string, number>();

  nextItem(): number {
    return this.items++;
  }

  private turn(key: string): number {
    const n = this.turns.get(key) ?? 0;
    this.turns.set(key, n + 1);
    return n;
  }

  attributes(owner: string, item: number): XAttr[] {
    const specs = schema.elements[owner]!.attributes;
    const places = specs.some((a) => token(a.name, 'UF')) ? BRAZIL : PLACES;
    const place = places[item % places.length]!;
    let dates = 0;
    return specs.map((a) => {
      const order = isTemporal(a.name) && token(a.name, 'DATA') ? dates++ : 0;
      return { name: a.name, value: this.value(owner, a, item, place, order) };
    });
  }

  private value(
    owner: string,
    attr: AttributeSpec,
    item: number,
    place: Place,
    dateOrder: number,
  ): string {
    const n = attr.name;
    if (attr.enum) {
      const size = FACET_ENUMS.has(n)
        ? Math.min(attr.enum.length, VARIANTS.length)
        : attr.enum.length;
      return attr.enum[this.turn(n) % size]!;
    }
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
    const years = itemYears(item);
    const starts = n.includes('INICIO');
    const year = starts ? years.start : years.end;
    if (n === 'DATA-NASCIMENTO') return BIRTH_DATE;
    if (token(n, 'DATA')) {
      // Datas do mesmo elemento em ordem: pedido antes da concessão, estreia antes do encerramento.
      const month = 1 + ((item * 7) % 6) + dateOrder * 2;
      const day = 1 + ((item * 11) % 28);
      return `${pad(day)}${pad(month)}${year}`;
    }
    if (token(n, 'ANO')) return String(year);
    if (token(n, 'MES')) return pad(1 + ((item * (starts ? 7 : 5)) % 12));
    if (/^(PAIS|NOME-PAIS)(-|$)/.test(n)) return place.country;
    if (n.startsWith('SIGLA-PAIS')) return place.countryCode;
    if (token(n, 'UF')) return place.uf ?? '';
    if (n.startsWith('CIDADE')) return place.city;
    if (FREE_CATEGORICAL.has(n))
      return `Valor de teste ${VARIANTS[this.turn(n) % VARIANTS.length]} (${n.toLowerCase()})`;
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
function build(
  name: string,
  faker: Faker,
  full: boolean,
  stack: string[] = [],
  item = 0,
): XElement {
  const spec = schema.elements[name];
  if (!spec) throw new Error(`gen-fixtures: elemento ${name} fora do schema`);
  if (stack.includes(name)) throw new Error(`gen-fixtures: ciclo em ${[...stack, name].join('/')}`);
  const own = isItem(name, stack) ? faker.nextItem() : item;
  const el = element(name, faker.attributes(name, own));
  const children: XNode[] = [];
  for (const c of spec.children) {
    if (full || c.min > 0) children.push(build(c.name, faker, full, [...stack, name], own));
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
