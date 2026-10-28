// Formulários do Lattes simulado montados a partir das capturas do censo
// (docs/lattes-formularios/, LAT-55; a mais recente, de 27/10/2026): o nome e
// o destino do <form>, os campos na ordem da página com tipo, limite, rótulo e
// opções, e os nomes dos ocultos saem da captura, e são **observados**. A
// ligação de cada campo com um atributo do XML é declarada por quem usa o
// módulo e é **inferida** sempre que a passada de edição do censo não a
// observou (os tipos sem item no currículo de quem capturou).
//
// O desenho (rótulo ao lado do campo, um por linha) é do simulado; o Lattes de
// verdade usa tabelas. Nada disso muda o que o conector lê: nomes, tipos,
// limites, opções e valores.

import censo from '../../docs/lattes-formularios/censo-2026-10-15.json' with { type: 'json' };
import recapturaB from '../../docs/lattes-formularios/censo-2026-10-15b.json' with { type: 'json' };
import recapturaC from '../../docs/lattes-formularios/censo-2026-10-15c.json' with { type: 'json' };
import recaptura27 from '../../docs/lattes-formularios/censo-2026-10-27.json' with { type: 'json' };
import { foldText } from '../../src/model/fold-text.ts';
import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import type { LattesState } from './estado.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';

interface CapturedOption {
  label: string;
  value: string;
}

export interface CapturedField {
  label?: string;
  maxLength?: number;
  name: string;
  /** Opções lidas, ou o nome de uma lista longa guardada uma vez em `lists`. */
  options?: CapturedOption[] | string;
  type: string;
}

export interface CapturedForm {
  action: string;
  fields: CapturedField[];
  hidden: string[];
  name: string;
}

interface CensusJson {
  entries: { id: string; page?: { forms?: CapturedForm[] } }[];
  lists?: Record<string, CapturedOption[]>;
}

/** As capturas versionadas, da mais recente para a mais antiga (as recapturas trazem só algumas entradas). */
const CAPTURES = [recaptura27, recapturaC, recapturaB, censo] as unknown as CensusJson[];

/** O primeiro formulário que a captura mais recente leu para a entrada do censo. */
export function capturedForm(entry: string): CapturedForm {
  for (const file of CAPTURES) {
    const form = file.entries.find((e) => e.id === entry)?.page?.forms?.[0];
    if (form) return form;
  }
  throw new Error(`O censo não tem formulário para ${entry}`);
}

/** As opções [valor, rótulo] de um campo capturado. */
export function capturedOptions(field: CapturedField): [string, string][] {
  const list =
    typeof field.options === 'string'
      ? CAPTURES.map((f) => f.lists?.[field.options as string]).find(Boolean)
      : field.options;
  return (list ?? []).map((o) => [o.value, o.label]);
}

/**
 * Onde mora o atributo: o caminho de partes a partir do item, cada uma pelo
 * começo do nome (DADOS-BASICOS-, DETALHAMENTO-, REGISTRO-OU-PATENTE).
 */
export interface FieldLink {
  attr: string;
  /** Do XML para o valor do campo (padrão: o mesmo texto). */
  toForm?: (xml: string) => string;
  /** Do valor que veio no POST para o XML (padrão: o mesmo texto). */
  toXml?: (form: string) => string;
  under?: string[];
}

/** A parte do item pelo começo do nome; com `create`, nasce na ordem do schema. */
function partOf(item: XElement, under: string[], create: boolean): XElement | undefined {
  let current: XElement | undefined = item;
  for (const prefix of under) {
    if (!current) return undefined;
    const parent: XElement = current;
    let next = childElements(parent).find((c) => c.name.startsWith(prefix));
    if (!next && create) {
      const name = lattesSchema.elements[parent.name]?.children.find((c) =>
        c.name.startsWith(prefix),
      )?.name;
      if (!name) return undefined;
      next = element(name);
      insertInSchemaOrder(lattesSchema, parent, next);
    }
    current = next;
  }
  return current;
}

/** Lista de opções do campo, pelo rótulo: o XML guarda o nome, o formulário o código. */
export function byLabel(field: CapturedField): Pick<FieldLink, 'toForm' | 'toXml'> {
  const options = capturedOptions(field);
  return {
    toForm: (xml) => options.find(([, label]) => foldText(label) === foldText(xml))?.[0] ?? '',
    toXml: (form) => options.find(([value]) => value === form)?.[1] ?? '',
  };
}

/** Rádio S/N ↔ SIM/NAO. */
export const yesNo: Pick<FieldLink, 'toForm' | 'toXml'> = {
  toForm: (xml) => ({ NAO: 'N', SIM: 'S' })[xml] ?? '',
  toXml: (form) => ({ N: 'NAO', S: 'SIM' })[form] ?? '',
};

export interface CensusScreen {
  /** A entrada do censo (registro-CP, idioma…). */
  entry: string;
  /** Campo do formulário → atributo do XML. */
  links: Record<string, FieldLink>;
}

function control(field: CapturedField, value: string): string {
  const o = { maxLength: field.maxLength };
  switch (field.type) {
    case 'textarea':
      return h.textarea(field.name, value, o);
    case 'radio':
      return h.radios(field.name, capturedOptions(field), value);
    case 'checkbox':
      return h.checkbox(field.name, capturedOptions(field)[0]?.[0] ?? 'on', value !== '');
    case 'select-one': {
      const options = capturedOptions(field);
      // A captura não guarda a opção vazia; sem ela, a lista mandaria a primeira
      // opção num envio sem escolha (inferido: o Lattes começa vazio).
      const withEmpty = options.some(([v]) => v === '') ? options : [['', ''], ...options];
      return h.select(field.name, withEmpty as [string, string][], value, o);
    }
    default:
      return h.text(field.name, value, o);
  }
}

/**
 * O formulário da entrada, com os valores do item (ou vazio, na inclusão).
 * `hidden` dá o valor dos ocultos de identidade (f_ctr, f_cod, f_seq…); os
 * outros ocultos vão vazios.
 */
export function renderCensusForm(
  screen: CensusScreen,
  item: XElement | undefined,
  hidden: Record<string, string>,
  state: LattesState,
): string {
  const form = capturedForm(screen.entry);
  const rows = form.fields.map((field) => {
    let value = '';
    if (field.name === 'f_tipo_privacidade') value = item ? (state.privacy.get(item) ?? '1') : '1';
    const link = screen.links[field.name];
    if (item && link) {
      const raw = getAttr(partOf(item, link.under ?? [], false) ?? element(''), link.attr) ?? '';
      value = link.toForm ? link.toForm(raw) : raw;
    }
    return `<p><label>${h.esc(field.label ?? '')}</label> ${control(field, value)}</p>`;
  });
  const hiddenInputs = form.hidden.map((name) => h.hidden(name, hidden[name] ?? '')).join('');
  return `<form name="${form.name}" method="post" action="${form.action}">
${rows.join('\n')}
${hiddenInputs}
${h.formButtons(Boolean(item))}
</form>
${h.formScripts(form.name, item ? 'Deseja realmente excluir esta produção?' : undefined)}`;
}

/** Grava no item o que o POST trouxe, pelos campos ligados. */
export function applyCensusForm(
  screen: CensusScreen,
  item: XElement,
  req: SimRequest,
  state: LattesState,
): void {
  const form = capturedForm(screen.entry);
  for (const field of form.fields) {
    const value = req.get(field.name);
    if (field.name === 'f_tipo_privacidade') {
      state.privacy.set(item, value || '1');
      continue;
    }
    const link = screen.links[field.name];
    if (!link) continue;
    // Rádio e caixa sem marca não vêm no POST: ficam vazios.
    if (value === undefined && field.type !== 'radio' && field.type !== 'checkbox') continue;
    const target = partOf(item, link.under ?? [], true);
    if (!target) continue;
    setAttr(target, link.attr, link.toXml ? link.toXml(value ?? '') : (value ?? ''));
  }
}
