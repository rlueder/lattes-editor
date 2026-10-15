// Validação de itens contra o schema, antes de gerar o arquivo de importação.
// O Lattes descarta itens inválidos sem avisar (guia, seção 6), então o erro
// tem de aparecer aqui.

import { attributeLabel, elementLabel } from '../labels/labels.ts';
import { outOfList, titleRequired } from '../schema/typed-choices.ts';
import type { LattesSchema } from '../schema/types.ts';
import { authorElementName, readAuthors } from './production.ts';
import { childElements, type XElement } from './xml.ts';

/** De que tipo é o problema, para agrupar na validação do currículo inteiro. */
export type ProblemKind = 'ano' | 'autores' | 'doi' | 'lista' | 'obrigatorio';

export interface Problem {
  /** Atributo envolvido, quando há. */
  attribute?: string;
  /** Elemento onde está o problema (o item ou uma parte dele). */
  element: string;
  kind: ProblemKind;
  message: string;
}

const YEAR_RE = /^\d{4}$/;

/**
 * Problemas de um item: enums inválidos, obrigatórios vazios, ano, título e autoria.
 * `skip` deixa de fora partes que são itens próprios (o projeto dentro da
 * atuação), para cada problema ficar com um item só na validação do currículo.
 */
export function validateItem(
  schema: LattesSchema,
  item: XElement,
  today = new Date(),
  skip?: (el: XElement) => boolean,
): Problem[] {
  const problems: Problem[] = [];
  const check = (el: XElement) => {
    const spec = schema.elements[el.name];
    for (const a of el.attrs) {
      const attrSpec = spec?.attributes.find((s) => s.name === a.name);
      if (!attrSpec) continue;
      const where = { attribute: a.name, element: el.name };
      if (attrSpec.enum && !attrSpec.enum.includes(a.value)) {
        problems.push({
          ...where,
          kind: 'lista',
          message: a.value
            ? `${attributeLabel(a.name)}: valor "${a.value}" não é aceito`
            : `${attributeLabel(a.name)}: escolha uma opção`,
        });
      } else if (outOfList(el, a.name)) {
        problems.push({
          ...where,
          kind: 'lista',
          message: a.value
            ? `${attributeLabel(a.name)}: "${a.value}" não está na lista do Lattes`
            : `${attributeLabel(a.name)}: escolha uma opção`,
        });
      } else if (attrSpec.required && !a.value.trim()) {
        problems.push({
          ...where,
          kind: 'obrigatorio',
          message: `${attributeLabel(a.name)}: obrigatório`,
        });
      } else if (/^ANO($|-)/.test(a.name) && a.value && !validYear(a.value, today)) {
        problems.push({
          ...where,
          kind: 'ano',
          message: `${attributeLabel(a.name)}: ano inválido`,
        });
      }
    }
    for (const c of childElements(el)) if (!skip?.(c)) check(c);
  };
  check(item);

  const basics = childElements(item).find((c) => c.name.startsWith('DADOS-BASICOS'));
  if (basics) {
    const title = basics.attrs.find(
      (a) => a.name.startsWith('TITULO') && !a.name.endsWith('INGLES'),
    );
    // Participação em evento: o Lattes só pede título a convidado e participante.
    if (title && !title.value.trim() && titleRequired(basics)) {
      problems.push({
        attribute: title.name,
        element: basics.name,
        kind: 'obrigatorio',
        message: 'Título: obrigatório',
      });
    }
    const year = basics.attrs.find((a) => /^ANO($|-)/.test(a.name));
    if (year && !year.value.trim()) {
      problems.push({
        attribute: year.name,
        element: basics.name,
        kind: 'obrigatorio',
        message: 'Ano: obrigatório',
      });
    }
  }

  const authorEl = authorElementName(schema, item.name);
  if (authorEl) {
    const authors = readAuthors(item);
    // Eventos e bancas têm participantes, não autores; a regra é a mesma.
    const who = authorEl.startsWith('PARTICIPANTE') ? 'participante' : 'autor';
    const Who = who === 'autor' ? 'Autor' : 'Participante';
    if (authors.length === 0) {
      problems.push({ element: item.name, kind: 'autores', message: `Inclua ao menos um ${who}` });
    }
    authors.forEach((a, i) => {
      if (!a.name.trim()) {
        problems.push({
          element: authorEl,
          kind: 'autores',
          message: `${Who} ${i + 1}: nome obrigatório`,
        });
      }
      if (a.lattesId && !/^\d{16}$/.test(a.lattesId)) {
        problems.push({
          element: authorEl,
          kind: 'autores',
          message: `${Who} ${i + 1}: ID Lattes tem 16 dígitos`,
        });
      }
    });
  }

  const doi = basics?.attrs.find((a) => a.name === 'DOI')?.value.trim();
  if (doi && !/^10\.\d{4,9}\/\S+$/.test(doi)) {
    problems.push({
      attribute: 'DOI',
      element: basics!.name,
      kind: 'doi',
      message: 'DOI: formato esperado 10.xxxx/…',
    });
  }
  return problems;
}

function validYear(value: string, today: Date): boolean {
  if (!YEAR_RE.test(value)) return false;
  const n = Number(value);
  return n >= 1900 && n <= today.getFullYear() + 5;
}

/** Nome legível do lugar do problema, para a lista na tela. */
export function problemPlace(p: Problem): string {
  return elementLabel(p.element);
}
