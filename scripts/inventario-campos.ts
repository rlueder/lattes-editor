// Inventário dos campos do currículo para o LAT-48 (campos tipados): cada
// atributo do esquema, classificado pelo tipo de controle que merece, com as
// regras que o próprio editor usa (src/ui/field-kind.ts). O que sobra como
// "lista a capturar" é o que precisa das opções dos formulários do Lattes.
//
//   node scripts/inventario-campos.ts            # resumo no terminal
//   node scripts/inventario-campos.ts --md       # e docs/campos_tipados.md

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';

import type { LattesSchema } from '../src/schema/types.ts';
import { codeAttrFor, codeChoices, isBooleanAttr, isSystemAttr } from '../src/ui/field-kind.ts';

const root = fileURLToPath(new URL('../', import.meta.url));

/** A partir daqui, docs/campos_tipados.md é escrito à mão. */
const MARKER = '<!-- daqui em diante, escrito à mão -->';
const schema = JSON.parse(readFileSync(`${root}src/schema/lattes.json`, 'utf8')) as LattesSchema;

export type FieldClass =
  | 'sistema'
  | 'lista do esquema'
  | 'sim/não'
  | 'lista conhecida'
  | 'código e nome'
  | 'ano'
  | 'data'
  | 'número'
  | 'formato'
  | 'lista a capturar'
  | 'texto livre';

/**
 * Nomes que, no Lattes, são escolhidos numa lista (rádio ou combo) e não
 * digitados. Hipótese de partida: cada um precisa ser conferido no
 * formulário do Lattes antes de virar lista no editor.
 */
const LIST_CANDIDATES =
  /^(NATUREZA|TIPO(-|$)|FORMA-|CLASSIFICACAO|PAIS(-|$)|IDIOMA$|IDIOMA-|SITUACAO|STATUS-|NIVEL|MEIO-|AMBIENTE|FINALIDADE|CATEGORIA|PROFICIENCIA|ESCRITA|LEITURA|FALA|COMPREENDE|AREA-|GRANDE-AREA|SUB-AREA|ESPECIALIDADE|SETOR-|ENQUADRAMENTO|OUTRO-ENQUADRAMENTO|MODALIDADE|PAPEL|FUNCAO|CARATER|DISPONIBILIDADE|INSTITUICAO-FINANCIADORA|VINCULO|UF$|NOME-GRANDE-AREA|NOME-DA-AREA-DO-CONHECIMENTO|NOME-DA-SUB-AREA-DO-CONHECIMENTO|NOME-DA-ESPECIALIDADE)/;

const YEAR = /^ANO(-|$)|-ANO$/;
const DATE = /^(DATA|MES)(-|$)/;
/** Texto com formato conferível: DOI, endereço web, ISBN/ISSN, e-mail, CEP, telefone. */
const FORMAT =
  /^(DOI|HOME-PAGE|HOME-PAGE-DO-TRABALHO|ISBN|ISSN|ISSN-ISBN|E-MAIL|CEP|DDD|TELEFONE|RAMAL|FAX|CAIXA-POSTAL)$/;

const NUMBER = /^(NUMERO-|VOLUME|FASCICULO|SERIE|PAGINA-|CARGA-HORARIA|DURACAO|QUANTIDADE|NUMERO$)/;

export function classify(element: string, attr: string): FieldClass {
  const spec = schema.elements[element]?.attributes.find((a) => a.name === attr);
  if (isSystemAttr(element, attr)) return 'sistema';
  if (spec && isBooleanAttr(attr, spec, '')) return 'sim/não';
  if (spec?.enum) return 'lista do esquema';
  if (codeChoices(element, attr)) return 'lista conhecida';
  if (codeAttrFor(element, attr)) return 'código e nome';
  if (YEAR.test(attr)) return 'ano';
  if (DATE.test(attr)) return 'data';
  if (NUMBER.test(attr)) return 'número';
  if (FORMAT.test(attr)) return 'formato';
  if (LIST_CANDIDATES.test(attr) && !attr.endsWith('-INGLES')) return 'lista a capturar';
  return 'texto livre';
}

const rows = Object.entries(schema.elements).flatMap(([element, spec]) =>
  spec.attributes.map((a) => ({ attr: a.name, class: classify(element, a.name), element })),
);

const counts = new Map<FieldClass, number>();
for (const r of rows) counts.set(r.class, (counts.get(r.class) ?? 0) + 1);
console.log(`${rows.length} atributos em ${Object.keys(schema.elements).length} elementos`);
for (const [k, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`);

// Lista a capturar, agrupada por nome de atributo: o mesmo nome (NATUREZA)
// aparece em muitos itens, e a lista de cada um pode ser outra.
const toCapture = new Map<string, string[]>();
for (const r of rows.filter((x) => x.class === 'lista a capturar')) {
  toCapture.set(r.attr, [...(toCapture.get(r.attr) ?? []), r.element]);
}

if (process.argv.includes('--md')) {
  const lines = [
    '# Campos tipados (LAT-48)',
    '',
    'Gerado por `node scripts/inventario-campos.ts --md`. Cada atributo do',
    'esquema, classificado pelo controle que merece no editor, com as regras de',
    '`src/ui/field-kind.ts`. "Lista a capturar" é o que precisa das opções dos',
    'formulários do próprio Lattes; a classificação é por nome e precisa ser',
    'conferida em cada formulário.',
    '',
    '## Resumo',
    '',
    '| Tipo | Atributos |',
    '| --- | --- |',
    ...[...counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${k} | ${n} |`),
    '',
    '## Listas a capturar, por atributo',
    '',
    '| Atributo | Elementos |',
    '| --- | --- |',
    ...[...toCapture]
      .sort((a, b) => b[1].length - a[1].length)
      .map(
        ([attr, els]) =>
          `| \`${attr}\` | ${els.length}: ${els.map((e) => `\`${e}\``).join(', ')} |`,
      ),
    '',
  ];
  // O que vem depois do marcador é escrito à mão (achados, o que já foi feito)
  // e sobrevive a cada nova geração.
  const path = `${root}docs/campos_tipados.md`;
  const previous = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const kept = previous.includes(MARKER) ? previous.slice(previous.indexOf(MARKER)) : `${MARKER}\n`;
  // Formatado pelo Prettier, senão o format:check e o gerador se reprovam.
  const md = await format(`${lines.join('\n')}\n${kept}`, {
    ...(await resolveConfig(path)),
    filepath: path,
  });
  writeFileSync(path, md);
  console.log('docs/campos_tipados.md');
} else {
  console.log(`\nlista a capturar, por atributo (${toCapture.size}):`);
  for (const [attr, els] of [...toCapture].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${attr} (${els.length})`);
  }
}
