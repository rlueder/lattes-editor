// Revisão de consistência do currículo inteiro, sem IA (LAT-29). O editor
// aponta e a pessoa decide (LAT-11): cada achado diz o que viu e por que vale
// conferir, sem afirmar que está errado.
//
// Só usa o que o XML da exportação permite ver. Nomes de elementos e
// atributos vêm do schema (src/schema/lattes.json, gerado do XSD em
// schema/CurriculoLattes_12_09_2022.xsd). Os limites de tempo abaixo são
// escolhas do editor para dizer "talvez", não regras do Lattes.

import { fold } from '../labels/labels.ts';
import { childElements, firstChild, getAttr, walk, type XElement } from '../model/xml.ts';
import { itemMeta } from '../ui/item-meta.ts';

export type FindingCheck =
  | 'atual-antigo'
  | 'autor-repetido'
  | 'ano-futuro'
  | 'curso-longo'
  | 'fim-antes-do-inicio'
  | 'issn-invalido'
  | 'nome-de-citacao'
  | 'producao-repetida'
  | 'sem-doi';

export interface Finding {
  check: FindingCheck;
  /** O item de lista a abrir no editor (atuação, formação, produção…). */
  item: XElement;
  message: string;
  /** "aviso": provavelmente precisa de correção; "nota": vale conferir. */
  severity: 'aviso' | 'nota';
  title: string;
}

/** Vínculo "atual" que começou há mais que isto merece a pergunta "ainda é atual?". */
export const OLD_CURRENT_YEARS = 10;
/** Curso "em andamento" há mais que isto, em qualquer nível. */
export const LONG_COURSE_YEARS = 8;

/** Elementos de produção que costumam ter DOI: artigos em periódico. */
const DOI_EXPECTED = new Set(['ARTIGO-PUBLICADO', 'ARTIGO-ACEITO-PARA-PUBLICACAO']);
/** Artigo aceito ainda não saiu: ano à frente é esperado. */
const FUTURE_OK = new Set(['ARTIGO-ACEITO-PARA-PUBLICACAO']);
/** Contêineres das produções comparadas entre si e com o ano corrente. */
const PRODUCTION_ROOTS = ['PRODUCAO-BIBLIOGRAFICA', 'PRODUCAO-TECNICA', 'OUTRA-PRODUCAO'];

function year(value: string | undefined): number | undefined {
  if (!value || !/^\d{4}$/.test(value.trim())) return undefined;
  return Number(value.trim());
}

function month(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : 0;
}

/** Título comparável: sem acento, caixa ou pontuação. */
export function normalizeTitle(text: string): string {
  return fold(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Itens de produção (com SEQUENCIA-PRODUCAO) sob os contêineres de produção e de eventos. */
export function productionItems(root: XElement): XElement[] {
  const items: XElement[] = [];
  const roots = [
    ...PRODUCTION_ROOTS.map((n) => firstChild(root, n)),
    firstChild(root, 'DADOS-COMPLEMENTARES'),
  ].filter((el): el is XElement => el !== undefined);
  for (const r of roots) {
    walk(r, (el) => {
      if (getAttr(el, 'SEQUENCIA-PRODUCAO') !== undefined) items.push(el);
    });
  }
  return items;
}

/** ISSN com dígito verificador certo (ISO 3297: pesos 8 a 2, módulo 11, X vale 10). */
export function validIssn(value: string): boolean {
  const s = value.replace(/[-\s]/g, '').toUpperCase();
  if (!/^\d{7}[\dX]$/.test(s)) return false;
  const sum = [...s.slice(0, 7)].reduce((acc, d, i) => acc + Number(d) * (8 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return s[7] === (check === 10 ? 'X' : String(check));
}

function finding(
  check: FindingCheck,
  severity: Finding['severity'],
  item: XElement,
  message: string,
): Finding {
  return { check, item, message, severity, title: itemMeta(item).title || item.name };
}

function atuacao(root: XElement, today: number): Finding[] {
  const found: Finding[] = [];
  const atuacoes = childElements(
    firstChild(root, 'DADOS-GERAIS') ?? root,
    'ATUACOES-PROFISSIONAIS',
  ).flatMap((c) => childElements(c, 'ATUACAO-PROFISSIONAL'));
  for (const a of atuacoes) {
    for (const v of childElements(a, 'VINCULOS')) {
      const start = year(getAttr(v, 'ANO-INICIO'));
      const end = year(getAttr(v, 'ANO-FIM'));
      if (start === undefined) continue;
      if (end === undefined && today - start > OLD_CURRENT_YEARS) {
        found.push(
          finding(
            'atual-antigo',
            'nota',
            a,
            `Vínculo marcado como atual desde ${start}. Ainda é atual? Se terminou, falta o ano de fim.`,
          ),
        );
      }
      if (
        end !== undefined &&
        (end < start ||
          (end === start &&
            month(getAttr(v, 'MES-FIM')) > 0 &&
            month(getAttr(v, 'MES-FIM')) < month(getAttr(v, 'MES-INICIO'))))
      ) {
        found.push(
          finding(
            'fim-antes-do-inicio',
            'aviso',
            a,
            `Vínculo termina antes de começar (${start} a ${end}).`,
          ),
        );
      }
      if (start > today) {
        found.push(finding('ano-futuro', 'aviso', a, `Vínculo começa em ${start}, no futuro.`));
      }
    }
  }
  return found;
}

function formacao(root: XElement, today: number): Finding[] {
  const found: Finding[] = [];
  const container = firstChild(
    firstChild(root, 'DADOS-GERAIS') ?? root,
    'FORMACAO-ACADEMICA-TITULACAO',
  );
  for (const f of container ? childElements(container) : []) {
    const start = year(getAttr(f, 'ANO-DE-INICIO'));
    const end = year(getAttr(f, 'ANO-DE-CONCLUSAO'));
    if (start !== undefined && end !== undefined && end < start) {
      found.push(
        finding(
          'fim-antes-do-inicio',
          'aviso',
          f,
          `Conclusão (${end}) antes do início (${start}).`,
        ),
      );
    }
    if (
      getAttr(f, 'STATUS-DO-CURSO') === 'EM_ANDAMENTO' &&
      start !== undefined &&
      today - start > LONG_COURSE_YEARS
    ) {
      found.push(
        finding(
          'curso-longo',
          'nota',
          f,
          `Em andamento desde ${start}. Se o curso terminou ou foi interrompido, vale atualizar a situação.`,
        ),
      );
    }
  }
  return found;
}

function citationNames(root: XElement): string[] {
  const dg = firstChild(root, 'DADOS-GERAIS');
  return (getAttr(dg ?? root, 'NOME-EM-CITACOES-BIBLIOGRAFICAS') ?? '')
    .split(';')
    .map((n) => normalizeTitle(n))
    .filter(Boolean);
}

function productions(root: XElement, today: number): Finding[] {
  const found: Finding[] = [];
  const ownerId = getAttr(root, 'NUMERO-IDENTIFICADOR');
  const ownNames = citationNames(root);
  const seen = new Map<string, XElement>();

  for (const item of productionItems(root)) {
    const basics = childElements(item).find((c) => c.name.startsWith('DADOS-BASICOS'));
    const details = childElements(item).find((c) => c.name.startsWith('DETALHAMENTO'));
    const meta = itemMeta(item);

    const titleKey = normalizeTitle(meta.title);
    if (titleKey) {
      const key = `${item.name}|${titleKey}|${meta.year ?? ''}`;
      if (seen.has(key)) {
        found.push(
          finding(
            'producao-repetida',
            'aviso',
            item,
            'Mesmo título, mesmo ano e mesmo tipo de outro item. Pode ser uma duplicata, como as que o Importar do Lattes cria.',
          ),
        );
      } else seen.set(key, item);
    }

    if (meta.year !== undefined && meta.year > today && !FUTURE_OK.has(item.name)) {
      found.push(finding('ano-futuro', 'aviso', item, `Ano ${meta.year}, no futuro.`));
    }

    if (DOI_EXPECTED.has(item.name) && basics && !getAttr(basics, 'DOI')?.trim()) {
      found.push(
        finding(
          'sem-doi',
          'nota',
          item,
          'Artigo sem DOI. Se ele tiver um, o editor busca os dados pelo DOI.',
        ),
      );
    }

    const issn = details && getAttr(details, 'ISSN')?.trim();
    if (issn && !validIssn(issn)) {
      found.push(
        finding(
          'issn-invalido',
          'aviso',
          item,
          `ISSN ${issn} com dígito verificador que não confere.`,
        ),
      );
    }

    const authors = childElements(item, 'AUTORES');
    const names = authors.map((a) => normalizeTitle(getAttr(a, 'NOME-PARA-CITACAO') ?? ''));
    const repeated = names.find((n, i) => n && names.indexOf(n) !== i);
    if (repeated) {
      const shown = getAttr(authors[names.lastIndexOf(repeated)]!, 'NOME-PARA-CITACAO');
      found.push(
        finding(
          'autor-repetido',
          'aviso',
          item,
          `${shown} aparece mais de uma vez entre os autores.`,
        ),
      );
    }

    if (ownerId && ownNames.length) {
      for (const a of authors) {
        const cited = getAttr(a, 'NOME-PARA-CITACAO')?.trim();
        if (
          getAttr(a, 'NRO-ID-CNPQ') === ownerId &&
          cited &&
          !ownNames.includes(normalizeTitle(cited))
        ) {
          found.push(
            finding(
              'nome-de-citacao',
              'nota',
              item,
              `Você aparece como "${cited}", que não está entre os seus nomes em citações bibliográficas.`,
            ),
          );
        }
      }
    }
  }
  return found;
}

/** Todos os achados do currículo, na ordem: atuação, formação, produção. */
export function reviewCv(root: XElement, today = new Date()): Finding[] {
  const y = today.getFullYear();
  return [...atuacao(root, y), ...formacao(root, y), ...productions(root, y)];
}
